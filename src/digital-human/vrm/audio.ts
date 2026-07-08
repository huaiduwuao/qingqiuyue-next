/**
 * vrm/audio.ts — WebAudio 合成 + 频谱分析
 *
 * 三个模式共享一个 AudioContext + Analyser：
 *   1. 演示歌曲（WebAudio 合成，A 大调五声音阶，122 BPM）
 *   2. 本地音频文件（用户上传）
 *   3. 麦克风（实时分析）
 *
 * 频谱通过回调（onFrame）输出 { aa, ih, ou, bass }，供 useVrmLipSync 写到 VRM 表情。
 * （不直接 import React — 由 hooks 层包装。）
 */

const SONG_BPM = 122;
const MELODY: number[] = [
  69, 0, 71, 73, 76, 0, 73, 71, 69, 0, 66, 64, 66, 0, 0, 0,
  69, 0, 71, 73, 76, 0, 78, 76, 73, 71, 69, 66, 64, 0, 0, 0,
  64, 0, 66, 69, 71, 0, 69, 66, 73, 0, 71, 69, 66, 64, 0, 0,
  69, 71, 73, 76, 78, 0, 76, 73, 81, 0, 78, 76, 73, 0, 0, 0,
];
const BASSLINE: number[] = [45, 45, 52, 52, 42, 42, 50, 50];
const midiHz = (m: number) => (m ? 440 * Math.pow(2, (m - 69) / 12) : 0);

export interface LipFrame {
  aa: number;
  ih: number;
  ou: number;
  oh: number;
  bass: number;
}

export interface AudioHandle {
  ensureAudio: () => void;
  startSong: (onStart?: (bpm: number, startTime: number) => void) => void;
  stopSong: () => void;
  isSongOn: () => boolean;
  getSongStartTime: () => number;
  /** 解析频谱 + 平滑输出 lip frame（每帧调一次） */
  poll: () => LipFrame;
  /** 停止所有源 */
  stopAll: () => void;
  /** 麦克风 */
  startMic: () => Promise<boolean>;
  stopMic: () => void;
  /** 本地音频 file（外部 <audio> element + analyser 共用） */
  connectElement: (el: HTMLAudioElement) => void;
}

export function createAudioHandle(): AudioHandle {
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let freqData: Uint8Array | null = null;
  let masterGain: GainNode | null = null;
  let micStream: MediaStream | null = null;
  let micSrc: MediaStreamAudioSourceNode | null = null;
  let elemSrc: MediaElementAudioSourceNode | null = null;

  let songOn = false;
  let songTimer: ReturnType<typeof setInterval> | null = null;
  let songStep = 0;
  let songNextTime = 0;
  let songStartTime = 0;

  const lip: LipFrame = { aa: 0, ih: 0, ou: 0, oh: 0, bass: 0 };

  function ensureAudio() {
    if (audioCtx) { audioCtx.resume(); return; }
    const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    audioCtx = new AC();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.5;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.9;
    masterGain.connect(audioCtx.destination);
  }

  function scheduleVoice(midi: number, t: number, dur: number) {
    if (!audioCtx || !analyser || !masterGain) return;
    const o1 = audioCtx.createOscillator(); o1.type = 'triangle';
    const o2 = audioCtx.createOscillator(); o2.type = 'sawtooth'; o2.detune.value = 6;
    o1.frequency.value = midiHz(midi); o2.frequency.value = midiHz(midi);
    const vib = audioCtx.createOscillator(); vib.frequency.value = 5.6;
    const vibG = audioCtx.createGain(); vibG.gain.value = 4.5;
    vib.connect(vibG); vibG.connect(o1.frequency); vibG.connect(o2.frequency);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.03);
    g.gain.setValueAtTime(0.16, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    const g2 = audioCtx.createGain(); g2.gain.value = 0.25;
    o2.connect(g2); g2.connect(g); o1.connect(g);
    g.connect(analyser); g.connect(masterGain);
    o1.start(t); o2.start(t); vib.start(t);
    o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  }
  function scheduleBass(midi: number, t: number, dur: number) {
    if (!audioCtx || !masterGain) return;
    const o = audioCtx.createOscillator(); o.type = 'square';
    o.frequency.value = midiHz(midi);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + dur);
  }
  function scheduleKick(t: number) {
    if (!audioCtx || !masterGain) return;
    const o = audioCtx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.2);
  }
  function scheduleHat(t: number) {
    if (!audioCtx || !masterGain) return;
    const len = 0.04, buf = audioCtx.createBuffer(1, audioCtx.sampleRate * len, audioCtx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = audioCtx.createBufferSource(); s.buffer = buf;
    const f = audioCtx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = audioCtx.createGain(); g.gain.value = 0.12;
    s.connect(f); f.connect(g); g.connect(masterGain);
    s.start(t);
  }
  function songScheduler() {
    if (!audioCtx) return;
    const stepDur = 60 / SONG_BPM / 2;
    while (songNextTime < audioCtx.currentTime + 0.12) {
      const i = songStep % 64, t = songNextTime;
      const m = MELODY[i];
      if (m) scheduleVoice(m, t, stepDur * (MELODY[(i + 1) % 64] ? 0.95 : 1.8));
      if (i % 2 === 0) scheduleBass(BASSLINE[(i >> 3) % 8], t, stepDur * 1.6);
      if (i % 2 === 0) scheduleKick(t);
      else scheduleHat(t);
      songNextTime += stepDur; songStep++;
    }
  }
  function stopSongInternal() {
    if (songTimer) { clearInterval(songTimer); songTimer = null; }
    songOn = false;
  }

  function startSong(onStart?: (bpm: number, startTime: number) => void) {
    ensureAudio();
    if (!audioCtx) return;
    stopSongInternal();
    songOn = true; songStep = 0;
    songNextTime = audioCtx.currentTime + 0.1;
    songStartTime = songNextTime;
    songTimer = setInterval(songScheduler, 25);
    onStart?.(SONG_BPM, songStartTime);
  }
  function stopSong() { stopSongInternal(); }

  function band(a: number, b: number): number {
    if (!analyser || !freqData || !audioCtx) return 0;
    const nyq = audioCtx.sampleRate / 2, N = freqData.length;
    const ia = Math.max(0, Math.round(a / nyq * N)), ib = Math.min(N - 1, Math.round(b / nyq * N));
    let s = 0; for (let i = ia; i <= ib; i++) s += freqData[i];
    return s / ((ib - ia + 1) * 255);
  }
  function poll(): LipFrame {
    if (analyser && freqData && audioCtx && audioCtx.state === 'running') {
      analyser.getByteFrequencyData(freqData as Uint8Array<ArrayBuffer>);
      const low = band(80, 400), mid = band(400, 1800), high = band(1800, 5000);
      const bass = band(30, 150);
      lip.bass = bass;
      const sens = 1.8;  // 默认灵敏度（在 VrmStage 内可由 UI 改，这里走固定值）
      const vol = Math.min(1, (low * 0.5 + mid * 1.1 + high * 0.8) * sens);
      if (vol > 0.06) {
        const tot = low + mid + high + 1e-6;
        const tOU = Math.min(1, vol * (low / tot) * 1.6);
        const tAA = Math.min(1, vol * (mid / tot) * 1.9);
        const tIH = Math.min(1, vol * (high / tot) * 1.5);
        const k = 0.5;  // 平滑常数（每帧调用，外部可叠加更大平滑）
        lip.aa += (tAA - lip.aa) * k;
        lip.ih += (tIH - lip.ih) * k;
        lip.ou += (tOU - lip.ou) * k;
      }
      lip.oh = lip.ou * 0.4;
    }
    return lip;
  }

  async function startMic(): Promise<boolean> {
    ensureAudio();
    if (!audioCtx || !analyser) return false;
    try {
      stopSong(); if (elemSrc) { try { elemSrc.disconnect(); } catch {} elemSrc = null; }
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micSrc = audioCtx.createMediaStreamSource(micStream);
      micSrc.connect(analyser);
      return true;
    } catch (e) {
      console.warn('[audio] mic failed', e);
      return false;
    }
  }
  function stopMic() {
    if (micSrc) { try { micSrc.disconnect(); } catch {} micSrc = null; }
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  }
  function connectElement(el: HTMLAudioElement) {
    ensureAudio();
    if (!audioCtx || !analyser || !masterGain) return;
    if (elemSrc) { try { elemSrc.disconnect(); } catch {} }
    elemSrc = audioCtx.createMediaElementSource(el);
    elemSrc.connect(analyser);
    elemSrc.connect(masterGain);
  }
  function stopAll() { stopSong(); stopMic(); if (elemSrc) { try { elemSrc.disconnect(); } catch {} elemSrc = null; } }
  function isSongOn() { return songOn; }
  function getSongStartTime() { return songStartTime; }

  return { ensureAudio, startSong, stopSong, isSongOn, getSongStartTime, poll, stopAll, startMic, stopMic, connectElement };
}
