/**
 * ASR —— 默认用浏览器 Web Speech API(Chrome 可用,零依赖)。
 * 生产可替换为 Whisper 服务端流式识别(实现同样的 SpeechInput 接口即可)。
 */

export interface SpeechInput {
  start(): void;
  stop(): void;
  readonly supported: boolean;
  onResult: ((text: string, final: boolean) => void) | null;
  onError: ((msg: string) => void) | null;
  onEnd: (() => void) | null;
}

export class BrowserASR implements SpeechInput {
  private rec: any = null;
  onResult: ((text: string, final: boolean) => void) | null = null;
  onError: ((msg: string) => void) | null = null;
  onEnd: (() => void) | null = null;

  constructor(lang = 'zh-CN') {
    if (typeof window === 'undefined') return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      if (final) this.onResult?.(final, true);
      else if (interim) this.onResult?.(interim, false);
    };
    rec.onerror = (e: any) => this.onError?.(e.error || 'asr_error');
    rec.onend = () => this.onEnd?.();
    this.rec = rec;
  }

  get supported() {
    return !!this.rec;
  }
  start() {
    try {
      this.rec?.start();
    } catch {
      /* already started */
    }
  }
  stop() {
    try {
      this.rec?.stop();
    } catch {
      /* noop */
    }
  }
}
