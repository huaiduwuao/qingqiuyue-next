/**
 * lib/world/voice/gate.ts — 创世四期:开麦模式的人声闸门(每 20ms 一帧喂一次音量)
 *
 * 不说话就不发包:省流量,也免得把键盘声、风扇声送进别人耳朵。
 *   - 底噪自适应:开头 warmFrames 帧只量底噪不开门;之后往下跟得快、往上跟得慢(开着门时更慢),
 *     说话的停顿会把底噪拉回去,一直响的风扇声则会慢慢变成底噪、把门关上;
 *   - 门槛 = max(绝对下限, 底噪 + margin);连续 attack 帧超过门槛才开,开了以后低于「门槛 − 6dB」
 *     持续 hangMs 才关(句中停顿不断句);
 *   - 开的那一刻把前面 preroll 帧也补发出去(引擎负责),第一个字不被切掉。
 */

export interface GateOptions {
  frameMs: number;
  attackFrames: number;
  hangMs: number;
  /** 绝对下限(dBFS),再安静的环境也不低于它 */
  minDb: number;
  /** 比底噪高多少才算说话 */
  marginDb: number;
  /** 开头这么多帧只量底噪 */
  warmFrames: number;
}

export const DEFAULT_GATE: GateOptions = { frameMs: 20, attackFrames: 2, hangMs: 450, minDb: -52, marginDb: 12, warmFrames: 10 };

export function rmsDb(frame: Float32Array): number {
  let s = 0;
  for (let i = 0; i < frame.length; i++) s += frame[i] * frame[i];
  const rms = Math.sqrt(s / Math.max(1, frame.length));
  return rms > 1e-9 ? 20 * Math.log10(rms) : -120;
}

export class VoiceGate {
  open = false;
  floorDb = -70;
  private above = 0;
  private quietMs = 0;
  private frames = 0;
  constructor(private o: GateOptions = DEFAULT_GATE) {}

  get thresholdDb() {
    return Math.max(this.o.minDb, this.floorDb + this.o.marginDb);
  }

  /** 喂一帧的音量(dBFS),返回这一帧之后闸门开没开、是不是刚开 / 刚关 */
  push(db: number): { open: boolean; opened: boolean; closed: boolean } {
    this.frames++;
    if (this.frames <= this.o.warmFrames) {
      this.floorDb = this.frames === 1 ? db : this.floorDb + (db - this.floorDb) / this.frames;
      return { open: false, opened: false, closed: false };
    }
    const th = this.thresholdDb;
    // 底噪:往下跟得快,往上跟得慢(开着门时更慢)
    this.floorDb += (db - this.floorDb) * (db < this.floorDb ? 0.3 : this.open ? 0.004 : 0.015);
    if (!this.open) {
      if (db > th) this.above++;
      else this.above = 0;
      if (this.above >= this.o.attackFrames) {
        this.open = true;
        this.quietMs = 0;
        return { open: true, opened: true, closed: false };
      }
      return { open: false, opened: false, closed: false };
    }
    if (db > th - 6) this.quietMs = 0;
    else this.quietMs += this.o.frameMs;
    if (this.quietMs >= this.o.hangMs) {
      this.open = false;
      this.above = 0;
      return { open: false, opened: false, closed: true };
    }
    return { open: true, opened: false, closed: false };
  }

  reset() {
    this.open = false;
    this.above = 0;
    this.quietMs = 0;
  }
}
