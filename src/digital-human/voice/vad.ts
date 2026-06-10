/**
 * VAD —— 基于 Web Audio 能量的语音活动检测。
 * 开启后持续监听麦克风:检测到说话 → onSpeechStart;静音超过 hangover → onSpeechEnd。
 * 配合 ASR:说话开始时启动识别,结束时取最终结果 → 实现"一直检测说话意图"。
 */
export class VAD {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private raf: number | null = null;
  private speaking = false;
  private silenceMs = 0;
  private last = 0;

  onSpeechStart: (() => void) | null = null;
  onSpeechEnd: (() => void) | null = null;
  onLevel: ((rms: number) => void) | null = null;

  constructor(
    private threshold = 0.022, // 触发阈值
    private hangoverMs = 900,   // 静音多久判定说完
  ) {}

  async start() {
    if (this.ctx) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = this.ctx.createMediaStreamSource(this.stream);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    this.last = performance.now ? performance.now() : 0;

    const loop = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      this.onLevel?.(rms);

      const now = performance.now ? performance.now() : this.last + 16;
      const dt = now - this.last;
      this.last = now;

      if (rms > this.threshold) {
        this.silenceMs = 0;
        if (!this.speaking) {
          this.speaking = true;
          this.onSpeechStart?.();
        }
      } else if (this.speaking) {
        this.silenceMs += dt;
        if (this.silenceMs > this.hangoverMs) {
          this.speaking = false;
          this.onSpeechEnd?.();
        }
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close();
    this.ctx = null;
    this.stream = null;
    this.speaking = false;
  }

  get active() {
    return !!this.ctx;
  }
}
