/**
 * lib/world/voice/voiceEngine.ts — 创世四期:房间语音的浏览器端
 *
 * 为什么不是 WebRTC:线上对外只有网关的 HTTP 端口(UDP 进不来、没有 TURN),点对点在对称 NAT 后面大面积连不上。
 * 所以语音走房间那条 WebSocket(core-api worldapp/voice.go 转发),浏览器自己编解码:
 *
 *   麦克风(回声消除 / 降噪 / 自动增益)→ AudioWorklet 切成 20ms 一帧 → 开麦模式过人声闸门(gate.ts)
 *   或按住说话 → WebCodecs AudioEncoder(Opus 24kbps)→ 两帧一包 → packet.ts 上行
 *
 *   下行包 → 每个说话人一个 AudioDecoder → 排进播放时间线(jitter.ts)→ 增益 → HRTF 声像(PannerNode,
 *   跟着他在房间里的位置)→ 总音量 → 扬声器;同时记下每段的音量,给同伴的嘴型和「在说话」用。
 *
 * AudioContext 必须在用户点了按钮之后建(浏览器的自动播放限制)。不支持 WebCodecs Opus 的浏览器
 * (老 Safari、部分安卓 WebView)voiceSupport() 会说明,界面上不给开。
 */

import { encodeUp, decodeDown, MAX_UP_BYTES } from './packet';
import { VoiceGate, rmsDb } from './gate';
import { LevelTimeline, mouthOpen, scheduleChunk } from './jitter';

export const SAMPLE_RATE = 48000;
export const FRAME_SAMPLES = 960; // 20ms
const FRAMES_PER_PACKET = 2;
const PREROLL_FRAMES = 3;

const ENC_CONFIG = { codec: 'opus', sampleRate: SAMPLE_RATE, numberOfChannels: 1, bitrate: 24000 } as const;
const DEC_CONFIG = { codec: 'opus', sampleRate: SAMPLE_RATE, numberOfChannels: 1 } as const;

export interface VoiceSupport {
  listen: boolean;
  talk: boolean;
  reason?: string;
}

type ACtor = typeof AudioContext;
function audioContextClass(): ACtor | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: ACtor }).webkitAudioContext;
}

export async function voiceSupport(): Promise<VoiceSupport> {
  if (!audioContextClass()) return { listen: false, talk: false, reason: '这个浏览器不能播放房间语音' };
  if (typeof AudioDecoder === 'undefined') return { listen: false, talk: false, reason: '这个浏览器不支持房间语音(缺 WebCodecs),换新版 Chrome / Edge / Safari 试试' };
  const dec = await AudioDecoder.isConfigSupported(DEC_CONFIG).catch(() => null);
  if (!dec?.supported) return { listen: false, talk: false, reason: '这个浏览器解不了 Opus 语音' };
  const mic = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  if (!mic) return { listen: true, talk: false, reason: '这里拿不到麦克风(需要 https 或 App 的录音权限),只能听' };
  if (typeof AudioEncoder === 'undefined') return { listen: true, talk: false, reason: '这个浏览器不能编码语音,只能听' };
  const enc = await AudioEncoder.isConfigSupported(ENC_CONFIG).catch(() => null);
  if (!enc?.supported) return { listen: true, talk: false, reason: '这个浏览器不能编码 Opus,只能听' };
  return { listen: true, talk: true };
}

// 把麦克风切成 20ms 一帧送回主线程
const WORKLET_SRC = `
class QQMicFrames extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(${FRAME_SAMPLES}); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === ${FRAME_SAMPLES}) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor('qq-mic-frames', QQMicFrames);
`;

interface Speaker {
  decoder: AudioDecoder;
  gain: GainNode;
  panner: PannerNode;
  next: number;
  ts: number;
  levels: LevelTimeline;
  volume: number;
  muted: boolean;
  endAt: number;
}

export interface VoiceEngineOptions {
  /** 发一包上行语音;连接没开时返回 false */
  send: (pkt: Uint8Array) => boolean;
  /** 测试台 / 自动化:用这个流代替麦克风 */
  micStream?: (ctx: AudioContext) => Promise<MediaStream>;
}

export interface VoiceStats {
  sent: number;
  received: number;
  decoded: number;
  dropped: number;
}

export class VoiceEngine {
  readonly ctx: AudioContext;
  private master: GainNode;
  private speakers = new Map<string, Speaker>();
  private micStream: MediaStream | null = null;
  private micNodes: AudioNode[] = [];
  private encoder: AudioEncoder | null = null;
  private gate = new VoiceGate();
  private preroll: Float32Array<ArrayBuffer>[] = [];
  private pending: Uint8Array[] = [];
  private seq = 0;
  private frameNo = 0;
  private transmitting = false;
  private disposed = false;
  /** 开麦模式(过人声闸门);false 时只有按住说话才发 */
  openMic = false;
  /** 正按着说话键 */
  ptt = false;
  /** 自己此刻的音量(0..1),给按钮上的电平条 */
  selfLevel = 0;
  stats: VoiceStats = { sent: 0, received: 0, decoded: 0, dropped: 0 };

  constructor(private opts: VoiceEngineOptions) {
    const AC = audioContextClass();
    if (!AC) throw new Error('no AudioContext');
    let ctx: AudioContext;
    try { ctx = new AC({ sampleRate: SAMPLE_RATE, latencyHint: 'interactive' }); } catch { ctx = new AC(); }
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
  }

  async resume() {
    if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {});
  }

  get running() {
    return this.ctx.state === 'running';
  }

  /** 正在往外发声音(开麦且在说 / 按着键) */
  get talking() {
    return this.transmitting;
  }

  get micReady() {
    return !!this.micStream;
  }

  setMasterVolume(v: number) {
    this.master.gain.setTargetAtTime(Math.max(0, Math.min(2, v)), this.ctx.currentTime, 0.05);
  }

  // ── 收 ──

  private speaker(id: string): Speaker {
    const sp = this.speakers.get(id);
    if (sp) return sp;
    const gain = this.ctx.createGain();
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.2;
    panner.maxDistance = 40;
    panner.rolloffFactor = 1.1;
    gain.connect(panner).connect(this.master);
    const levels = new LevelTimeline();
    const s: Speaker = {
      decoder: null as unknown as AudioDecoder, gain, panner, next: 0, ts: 0, levels, volume: 1, muted: false, endAt: 0,
    };
    s.decoder = new AudioDecoder({
      output: (data) => this.onDecoded(s, data),
      error: () => { /* 坏包:下一包 configure 前会重建 */ },
    });
    s.decoder.configure(DEC_CONFIG);
    this.speakers.set(id, s);
    return s;
  }

  private onDecoded(s: Speaker, data: AudioData) {
    if (this.disposed) { data.close(); return; }
    const n = data.numberOfFrames;
    const pcm = new Float32Array(n);
    try { data.copyTo(pcm, { planeIndex: 0, format: 'f32-planar' }); } catch { data.close(); return; }
    const rate = data.sampleRate;
    data.close();
    this.stats.decoded++;
    const buf = this.ctx.createBuffer(1, n, rate);
    buf.copyToChannel(pcm, 0);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += pcm[i] * pcm[i];
    const slot = scheduleChunk(this.ctx.currentTime, s.next, buf.duration);
    if (!slot) { this.stats.dropped++; return; }
    s.next = slot.next;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(s.gain);
    src.start(slot.start);
    s.levels.push(slot.start, slot.next, s.muted ? 0 : mouthOpen(Math.sqrt(sum / Math.max(1, n))));
  }

  /** 收到一包下行语音 */
  receive(buf: ArrayBuffer | Uint8Array) {
    if (this.disposed) return;
    const d = decodeDown(buf);
    if (!d) return;
    this.stats.received++;
    const s = this.speaker(d.id);
    if (s.decoder.state === 'closed') {
      this.speakers.delete(d.id);
      return;
    }
    for (const f of d.packet.frames) {
      s.ts += 20_000;
      try { s.decoder.decode(new EncodedAudioChunk({ type: 'key', timestamp: s.ts, data: f })); } catch { /* 解码器坏了:丢 */ }
    }
  }

  /** 我(听的人)在哪、朝哪(yaw:绕 Y 轴,0 = 朝 +Z) */
  setListener(x: number, z: number, yaw: number) {
    const l = this.ctx.listener;
    const t = this.ctx.currentTime;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    if (l.positionX) {
      l.positionX.setTargetAtTime(x, t, 0.05);
      l.positionY.setTargetAtTime(1.5, t, 0.05);
      l.positionZ.setTargetAtTime(z, t, 0.05);
      l.forwardX.setTargetAtTime(fx, t, 0.05);
      l.forwardY.setTargetAtTime(0, t, 0.05);
      l.forwardZ.setTargetAtTime(fz, t, 0.05);
      l.upX.setTargetAtTime(0, t, 0.05);
      l.upY.setTargetAtTime(1, t, 0.05);
      l.upZ.setTargetAtTime(0, t, 0.05);
    } else {
      (l as unknown as { setPosition: (a: number, b: number, c: number) => void }).setPosition(x, 1.5, z);
      (l as unknown as { setOrientation: (...a: number[]) => void }).setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  /** 说话人在哪(嘴大约 1.5 米高) */
  setSpeakerPos(id: string, x: number, z: number) {
    const s = this.speakers.get(id);
    if (!s) return;
    const p = s.panner;
    const t = this.ctx.currentTime;
    if (p.positionX) {
      p.positionX.setTargetAtTime(x, t, 0.05);
      p.positionY.setTargetAtTime(1.5, t, 0.05);
      p.positionZ.setTargetAtTime(z, t, 0.05);
    } else {
      (p as unknown as { setPosition: (a: number, b: number, c: number) => void }).setPosition(x, 1.5, z);
    }
  }

  /** 我这边把某人调小 / 屏蔽(只影响自己听到的) */
  setPeerVolume(id: string, volume: number, muted: boolean) {
    const s = this.speaker(id);
    s.volume = volume;
    s.muted = muted;
    s.gain.gain.setTargetAtTime(muted ? 0 : volume, this.ctx.currentTime, 0.03);
  }

  /** 某人此刻嘴张多大(0..1) */
  level(id: string): number {
    const s = this.speakers.get(id);
    return s ? s.levels.at(this.ctx.currentTime) : 0;
  }

  /** 此刻在说话的人 */
  speaking(threshold = 0.06): string[] {
    const t = this.ctx.currentTime;
    const out: string[] = [];
    for (const [id, s] of this.speakers) if (!s.muted && s.levels.until > t && s.levels.at(t) > threshold) out.push(id);
    return out;
  }

  speakerIds(): string[] {
    return Array.from(this.speakers.keys());
  }

  removeSpeaker(id: string) {
    const s = this.speakers.get(id);
    if (!s) return;
    this.speakers.delete(id);
    try { s.decoder.close(); } catch { /* ignore */ }
    s.gain.disconnect();
    s.panner.disconnect();
  }

  // ── 说 ──

  /** 接上麦克风(会弹权限框);失败抛错,消息可直接给用户看 */
  async startMic() {
    if (this.micStream || this.disposed) return;
    if (typeof AudioEncoder === 'undefined') throw new Error('这个浏览器不能编码语音');
    let stream: MediaStream;
    try {
      stream = this.opts.micStream
        ? await this.opts.micStream(this.ctx)
        : await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (e) {
      const name = (e as { name?: string })?.name;
      throw new Error(name === 'NotAllowedError' ? '没有麦克风权限:在浏览器地址栏左边允许一下' : name === 'NotFoundError' ? '没找到麦克风' : '麦克风打不开');
    }
    if (this.disposed) { stream.getTracks().forEach((t) => t.stop()); return; }
    const enc = new AudioEncoder({
      output: (chunk) => this.onEncoded(chunk),
      error: () => { /* 编码器出错:关麦,用户重开 */ this.stopMic(); },
    });
    enc.configure(ENC_CONFIG);
    this.encoder = enc;
    const src = this.ctx.createMediaStreamSource(stream);
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    sink.connect(this.ctx.destination);
    let node: AudioNode;
    try {
      const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
      await this.ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const w = new AudioWorkletNode(this.ctx, 'qq-mic-frames', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
      w.port.onmessage = (ev) => this.onFrame(ev.data as Float32Array<ArrayBuffer>);
      node = w;
    } catch {
      // 不让加载 worklet(CSP / 老内核):退回 ScriptProcessor,自己攒成 20ms 一帧
      const sp = this.ctx.createScriptProcessor(2048, 1, 1);
      let acc = new Float32Array(FRAME_SAMPLES);
      let n = 0;
      sp.onaudioprocess = (ev) => {
        const ch = ev.inputBuffer.getChannelData(0);
        for (let i = 0; i < ch.length; i++) {
          acc[n++] = ch[i];
          if (n === FRAME_SAMPLES) { this.onFrame(acc); acc = new Float32Array(FRAME_SAMPLES); n = 0; }
        }
      };
      node = sp;
    }
    src.connect(node);
    node.connect(sink);
    this.micStream = stream;
    this.micNodes = [src, node, sink];
  }

  stopMic() {
    this.endTalk();
    this.micStream?.getTracks().forEach((t) => t.stop());
    this.micStream = null;
    for (const n of this.micNodes) { try { n.disconnect(); } catch { /* ignore */ } }
    this.micNodes = [];
    if (this.encoder && this.encoder.state !== 'closed') { try { this.encoder.close(); } catch { /* ignore */ } }
    this.encoder = null;
    this.selfLevel = 0;
    this.gate.reset();
  }

  private onFrame(frame: Float32Array<ArrayBuffer>) {
    if (this.disposed || !this.encoder) return;
    const db = rmsDb(frame);
    this.selfLevel = Math.max(0, Math.min(1, (db + 55) / 40));
    const g = this.gate.push(db);
    const want = this.ptt || (this.openMic && g.open);
    if (!want) {
      if (this.transmitting) this.endTalk();
      this.preroll.push(frame);
      if (this.preroll.length > PREROLL_FRAMES) this.preroll.shift();
      return;
    }
    if (!this.transmitting) {
      this.transmitting = true;
      for (const f of this.preroll) this.encode(f);
      this.preroll = [];
    }
    this.encode(frame);
  }

  private encode(frame: Float32Array<ArrayBuffer>) {
    const enc = this.encoder;
    if (!enc || enc.state !== 'configured') return;
    const data = new AudioData({ format: 'f32-planar', sampleRate: this.ctx.sampleRate, numberOfFrames: frame.length, numberOfChannels: 1, timestamp: this.frameNo * 20_000, data: frame as Float32Array<ArrayBuffer> });
    this.frameNo++;
    try { enc.encode(data); } finally { data.close(); }
  }

  private onEncoded(chunk: EncodedAudioChunk) {
    const b = new Uint8Array(chunk.byteLength);
    chunk.copyTo(b);
    this.pending.push(b);
    if (this.pending.length >= FRAMES_PER_PACKET) this.flush(false);
  }

  private flush(end: boolean) {
    if (!this.pending.length && !end) return;
    let frames = this.pending;
    this.pending = [];
    let pkt = encodeUp({ seq: this.seq, end, frames });
    // 理论上两帧远不到上限;万一编码器吐了大帧,宁可丢也不让服务端整包扔
    while (pkt.length > MAX_UP_BYTES && frames.length > 1) {
      frames = frames.slice(1);
      pkt = encodeUp({ seq: this.seq, end, frames });
    }
    this.seq = (this.seq + 1) & 0xffff;
    if (this.opts.send(pkt)) this.stats.sent++;
  }

  /** 一段话说完:把编码器里剩的吐出来,带上「说完了」 */
  private endTalk() {
    if (!this.transmitting) return;
    this.transmitting = false;
    const enc = this.encoder;
    if (enc && enc.state === 'configured') {
      enc.flush().then(() => this.flush(true)).catch(() => this.flush(true));
    } else {
      this.flush(true);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.stopMic();
    this.disposed = true;
    for (const id of Array.from(this.speakers.keys())) this.removeSpeaker(id);
    void this.ctx.close().catch(() => {});
  }
}
