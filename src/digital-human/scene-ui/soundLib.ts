/**
 * scene-ui/soundLib.ts — 声音库(服务端 world_sound,go worldapp/sounds.go)在浏览器这边
 *
 *   - soundList():库的列表(读一次缓存着;规则效果 / 实体属性按 key 用);
 *   - playLibSound(key):播一下(WebAudio,解码过的缓存着);key 不在库里返回 false(交给内置的合成提示音);
 *   - AmbientMixer:实体属性 sound {key, volume, radius} —— 人走近了循环播,越远越小声,出了半径停;
 *     同一个声音放了好几个也只按最近的那个算一路(省得叠成噪音)。
 * 浏览器要人点过一下页面才让出声,第一次点的时候把 AudioContext 叫醒。
 */

import { listSounds, worldFileUrl, type WorldSoundRow } from '@/apis/world';

let listP: Promise<Map<string, WorldSoundRow>> | null = null;

export function soundList(): Promise<Map<string, WorldSoundRow>> {
  if (!listP) listP = listSounds().then((l) => new Map(l.map((s) => [s.key, s]))).catch(() => { listP = null; return new Map(); });
  return listP;
}

let ctx: AudioContext | null = null;
export function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    const wake = () => { void ctx?.resume(); };
    window.addEventListener('pointerdown', wake, { passive: true });
    window.addEventListener('keydown', wake);
  }
  return ctx;
}

const buffers = new Map<string, Promise<AudioBuffer | null>>();
function bufferOf(key: string, file: string): Promise<AudioBuffer | null> {
  let p = buffers.get(key);
  if (!p) {
    const c = audioCtx();
    p = c ? fetch(worldFileUrl(file)).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)).catch(() => null) : Promise.resolve(null);
    buffers.set(key, p);
  }
  return p;
}

/** 播一下库里的声音;不在库里 / 放不了返回 false */
export async function playLibSound(key: string, gain = 0.7): Promise<boolean> {
  const s = (await soundList()).get(key);
  const c = audioCtx();
  if (!s || !c) return false;
  const buf = await bufferOf(key, s.file);
  if (!buf) return false;
  const src = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g).connect(c.destination);
  src.start();
  return true;
}

export interface AmbientSource { id: string; key: string; x: number; y: number; z: number; volume: number; radius: number }

/** 环境声:每次 update 给出现在有哪些声源、人在哪,按距离开 / 关 / 调音量 */
export class AmbientMixer {
  private voices = new Map<string, { src: AudioBufferSourceNode; gain: GainNode }>();
  private loading = new Set<string>();

  async update(sources: readonly AmbientSource[], at: { x: number; y: number; z: number }) {
    const c = audioCtx();
    if (!c) return;
    // 每个 key 只取最响的那个声源
    const want = new Map<string, number>();
    for (const s of sources) {
      const d = Math.hypot(s.x - at.x, s.y - at.y, s.z - at.z);
      const r = Math.max(1, Math.min(30, s.radius));
      if (d > r) continue;
      const v = Math.max(0, Math.min(1, s.volume)) * (1 - d / r) ** 2;
      want.set(s.key, Math.max(want.get(s.key) ?? 0, v));
    }
    for (const [key, v] of this.voices) {
      const target = want.get(key) ?? 0;
      v.gain.gain.setTargetAtTime(target, c.currentTime, 0.25);
      if (!target) {
        const voice = v;
        this.voices.delete(key);
        window.setTimeout(() => { try { voice.src.stop(); } catch { /* 已经停了 */ } voice.src.disconnect(); }, 1200);
      }
    }
    const list = await soundList();
    for (const [key, target] of want) {
      if (this.voices.has(key) || this.loading.has(key)) continue;
      const s = list.get(key);
      if (!s) continue;
      this.loading.add(key);
      const buf = await bufferOf(key, s.file);
      this.loading.delete(key);
      if (!buf || this.voices.has(key)) continue;
      const src = c.createBufferSource();
      const gain = c.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(target, c.currentTime, 0.4);
      src.buffer = buf;
      src.loop = true;
      src.connect(gain).connect(c.destination);
      src.start();
      this.voices.set(key, { src, gain });
    }
  }

  dispose() {
    for (const v of this.voices.values()) { try { v.src.stop(); } catch { /* 已经停了 */ } v.src.disconnect(); }
    this.voices.clear();
  }
}

/** 实体属性 sound:字符串 = key;{key, volume, radius} */
export function soundPropOf(p: unknown): { key: string; volume: number; radius: number } | null {
  if (typeof p === 'string' && p) return { key: p, volume: 0.8, radius: 6 };
  if (p && typeof p === 'object') {
    const o = p as { key?: unknown; volume?: unknown; radius?: unknown };
    if (typeof o.key === 'string' && o.key) return { key: o.key, volume: typeof o.volume === 'number' ? o.volume : 0.8, radius: typeof o.radius === 'number' ? o.radius : 6 };
  }
  return null;
}
