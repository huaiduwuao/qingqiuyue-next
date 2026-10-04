/**
 * lib/world/voice/jitter.ts — 创世四期:收到的语音排到什么时候播,以及某一刻「嘴张多大」
 *
 * 包走 TCP(WebSocket),不丢但会扎堆到。每个说话人一条播放时间线 next:
 *   - next 已经落后于「现在 + 一点余量」(刚开口 / 断了一阵)→ 从「现在 + target」重新起头;
 *   - next 比现在超前太多(网络卡了一下、一口气到了一串)→ 这一段丢掉,追上实时,不让延迟越积越长;
 *   - 否则紧接着上一段播。
 * 口型:每段解出来的声音算一个音量,挂在它的播放时间段上,渲染时按当前时间查。
 */

export interface JitterOptions {
  /** 起头时留多少缓冲(秒) */
  target: number;
  /** 超前多少就丢(秒) */
  max: number;
  /** next 离「现在」不足这么多就当作已经落后(秒) */
  guard: number;
}

export const DEFAULT_JITTER: JitterOptions = { target: 0.12, max: 0.6, guard: 0.015 };

export function scheduleChunk(now: number, next: number, dur: number, o: JitterOptions = DEFAULT_JITTER): { start: number; next: number; reset: boolean } | null {
  if (next < now + o.guard) {
    const start = now + o.target;
    return { start, next: start + dur, reset: true };
  }
  if (next - now > o.max) return null;
  return { start: next, next: next + dur, reset: false };
}

/** 一个说话人的「什么时候多大声」 */
export class LevelTimeline {
  private spans: { t0: number; t1: number; v: number }[] = [];

  push(t0: number, t1: number, v: number) {
    this.spans.push({ t0, t1, v });
    if (this.spans.length > 200) this.spans.splice(0, this.spans.length - 200);
  }

  at(t: number): number {
    // 丢掉一秒以前播完的
    let drop = 0;
    while (drop < this.spans.length && this.spans[drop].t1 < t - 1) drop++;
    if (drop) this.spans.splice(0, drop);
    for (const s of this.spans) if (t >= s.t0 && t < s.t1) return s.v;
    return 0;
  }

  /** 排到的最后一段什么时候播完(还在说 = 比现在晚) */
  get until(): number {
    return this.spans.length ? this.spans[this.spans.length - 1].t1 : 0;
  }

  clear() {
    this.spans = [];
  }
}

/** 均方根音量 → 0..1 的「嘴张多大」(-50dB 闭嘴,-12dB 张满) */
export function mouthOpen(rms: number): number {
  if (rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.max(0, Math.min(1, (db + 50) / 38));
}
