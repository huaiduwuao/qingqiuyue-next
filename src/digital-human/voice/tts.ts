/**
 * TTS —— 默认用浏览器 SpeechSynthesis(零依赖),并在播放时驱动口型。
 * 生产可替换为 CosyVoice/GPT-SoVITS 服务端 TTS + AnalyserTTS(对返回音频做
 * AnalyserNode 取 RMS → mouthOpen,口型与真实音频波形严格对齐)。
 *
 * 两条路径:
 *  - BrowserTTS:零依赖,口型用 word-boundary 触发 + 阻尼正弦,够用但不是真波形。
 *  - AnalyserTTS:接受一段 audio URL,挂到 <audio> + MediaElementSource + AnalyserNode,
 *    每帧用 time-domain 字节算 RMS,再经过 0.7 阻尼后推到 onMouth,贴合真人。
 */

export interface SpeechOutput {
  speak(text: string): Promise<void>;
  cancel(): void;
  readonly supported: boolean;
  onMouth: ((open: number) => void) | null;
  onStart: (() => void) | null;
  onEnd: (() => void) | null;
}

/** 把一个 0~255 的时域字节数组归一化到 0~1 的"短时能量" */
function rmsFromTimeDomain(buf: Uint8Array): number {
  if (!buf || !buf.length) return 0;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = (buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

export class BrowserTTS implements SpeechOutput {
  onMouth: ((open: number) => void) | null = null;
  onStart: (() => void) | null = null;
  onEnd: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private wordPulse = 0;

  constructor(private lang = 'zh-CN') {}

  get supported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  speak(text: string): Promise<void> {
    if (!this.supported || !text.trim()) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = this.lang;
      u.rate = 1.05;
      u.onstart = () => {
        this.onStart?.();
        // 没有真音频,按 word boundary 触发张合 + 阻尼正弦(比纯伪随机更跟节拍)
        let t = 0;
        this.wordPulse = 0;
        this.timer = setInterval(() => {
          t += 0.06;
          this.wordPulse *= 0.85; // 阻尼
          const open = 0.3 + 0.4 * Math.abs(Math.sin(t * 7)) + 0.3 * this.wordPulse;
          this.onMouth?.(Math.min(1, open));
        }, 60);
      };
      u.onboundary = (e) => {
        if (e.name === 'word') this.wordPulse = 1;
      };
      const finish = () => {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.onMouth?.(0);
        this.onEnd?.();
        resolve();
      };
      u.onend = finish;
      u.onerror = finish;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    });
  }

  cancel() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.supported) window.speechSynthesis.cancel();
    this.onMouth?.(0);
  }
}

/**
 * 接真 TTS(CosyVoice / GPT-SoVITS / Edge-TTS 等返回 mp3/wav 的服务)。
 * 走真音频波形 → AnalyserNode.timeDomain → RMS,口型贴合真人。
 *
 * 用法:
 *   const tts = new AnalyserTTS({
 *     fetchAudio: async (text) => '/api/tts?text=' + encodeURIComponent(text), // 返回 audio/mpeg URL
 *   });
 *   await tts.speak('你好');
 */
export class AnalyserTTS implements SpeechOutput {
  onMouth: ((open: number) => void) | null = null;
  onStart: (() => void) | null = null;
  onEnd: (() => void) | null = null;

  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf: number | null = null;
  private gain: number = 0;

  constructor(private opts: { fetchAudio: (text: string) => Promise<string>; lang?: string }) {}

  get supported() {
    return typeof window !== 'undefined' && typeof AudioContext !== 'undefined';
  }

  async speak(text: string): Promise<void> {
    if (!this.supported || !text.trim()) return;
    const url = await this.opts.fetchAudio(text);
    if (!url) return;
    this.cancel();
    this.audio = new Audio(url);
    this.audio.crossOrigin = 'anonymous';
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = this.ctx.createMediaElementSource(this.audio);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.4;
    src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    const buf = new Uint8Array(this.analyser.fftSize);

    this.onStart?.();
    this.audio.onended = () => {
      this.stopLoop();
      this.onMouth?.(0);
      this.onEnd?.();
    };
    this.audio.onerror = () => {
      this.stopLoop();
      this.onMouth?.(0);
      this.onEnd?.();
    };
    try {
      await this.audio.play();
    } catch {
      this.stopLoop();
      this.onEnd?.();
      return;
    }
    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(buf);
      const rms = rmsFromTimeDomain(buf);
      // rms 自然在 0~0.5,放大并钳制,阻尼让动作不抖
      const target = Math.min(1, rms * 2.5);
      this.gain = this.gain * 0.6 + target * 0.4;
      this.onMouth?.(this.gain);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopLoop() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch {}
      this.analyser = null;
    }
    if (this.ctx) {
      try { this.ctx.close(); } catch {}
      this.ctx = null;
    }
  }

  cancel() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.audio) {
      try { this.audio.pause(); } catch {}
      this.audio = null;
    }
    this.stopLoop();
    this.onMouth?.(0);
  }
}
