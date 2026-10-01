/**
 * lib/world/voice/aiSpeech.ts — 创世四期:房间里的 AI 把话念出来
 *
 * 用浏览器自带的朗读(speechSynthesis),在每个听的人的电脑上本地合成:不花服务端的钱,也不依赖
 * 平台的 TTS 服务(它在内网另一台机器上,不一定在线)。代价是不能放进 Web Audio 做声像,只能按距离调音量;
 * 每位 AI 按 id 固定挑一个中文声音和音高,听得出谁是谁。设备上没有中文声音(英文版系统、部分安卓 WebView)
 * 就不念 —— 拿英文声音念中文要么不出声要么乱码 —— 只出字,界面上也不显示「念」的开关。
 *
 * 嘴型:朗读没有音量数据,念的时候按时间做一个起伏的开合,念完闭上。
 */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 念之前清掉不该念的:括号里的旁白、表情符号、网址 */
export function speakableText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[(（][^()（）]{0,20}[)）]/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 距离 → 音量(房间不大,近处 1,远了也留一点) */
export function volumeForDistance(d: number): number {
  return Math.max(0.15, Math.min(1, 1.15 - d / 12));
}

export class AiSpeech {
  readonly supported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  private current: string | null = null;
  private queued = 0;

  private voiceFor(id: string): SpeechSynthesisVoice | null {
    const all = window.speechSynthesis.getVoices();
    const zh = all.filter((v) => /^zh/i.test(v.lang));
    // 本地声音优先:在线声音(Google 等)在国内大多连不上,会一声不吭
    const pool = zh.filter((v) => v.localService).length ? zh.filter((v) => v.localService) : zh;
    return pool.length ? pool[hash(id) % pool.length] : null;
  }

  /** 设备上有中文声音(声音列表是异步加载的,voiceschanged 之后再问一次) */
  hasChineseVoice(): boolean {
    return this.supported && window.speechSynthesis.getVoices().some((v) => /^zh/i.test(v.lang));
  }

  /** 念一句;没念(不支持 / 没有中文声音 / 没有能念的字)返回 false */
  speak(id: string, text: string, volume = 1): boolean {
    if (!this.supported) return false;
    const t = speakableText(text);
    if (!t) return false;
    const v = this.voiceFor(id);
    if (!v) return false;
    const synth = window.speechSynthesis;
    // 排太长就把旧的清掉,不让 AI 隔半分钟才念完上一句
    if (this.queued >= 2) { synth.cancel(); this.queued = 0; this.current = null; }
    const u = new SpeechSynthesisUtterance(t.slice(0, 200));
    u.lang = v.lang || 'zh-CN';
    u.voice = v;
    u.pitch = 0.85 + (hash(id) % 35) / 100;
    u.rate = 1.05;
    u.volume = Math.max(0, Math.min(1, volume));
    this.queued++;
    u.onstart = () => { this.current = id; };
    const done = () => { this.queued = Math.max(0, this.queued - 1); if (this.current === id) this.current = null; };
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
    return true;
  }

  /** 某位 AI 此刻嘴张多大 */
  level(id: string): number {
    if (this.current !== id) return 0;
    const t = performance.now() / 1000;
    return 0.25 + 0.3 * Math.abs(Math.sin(t * 9.5)) * (0.6 + 0.4 * Math.sin(t * 2.3));
  }

  get speakingId() {
    return this.current;
  }

  cancel() {
    if (!this.supported) return;
    window.speechSynthesis.cancel();
    this.queued = 0;
    this.current = null;
  }
}
