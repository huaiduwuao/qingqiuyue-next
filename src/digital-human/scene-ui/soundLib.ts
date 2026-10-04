/**
 * scene-ui/soundLib.ts — 声音库(服务端 world_sound,go worldapp/sounds.go)在浏览器这边
 *
 *   - soundList():库的列表(平台的、我传的、别人公开的;读一次缓存着,传了 / 删了 refreshSounds);
 *     resolveSound(key):列表里没有的(别人私有的 —— 房主的规则用了他自己的声音)按 key 单独问一次;
 *   - playLibSound(key, gain, at?):播一下;给了 at 就从那个位置传过来(3D 声场,HRTF);key 查不到返回 false;
 *   - setListener:听的人在哪、朝哪(人物的头、镜头的朝向),转镜头时左右跟着变;
 *   - AmbientMixer:实体属性 sound {key, volume, radius} —— 人走近了循环播,音量按距离自己算(越远越小),
 *     方向交给声场(从那个东西那边传来);同一个声音放了好几个只按最近的那个算一路(省得叠成噪音)。
 * 浏览器要人点过一下页面才让出声,第一次点的时候把 AudioContext 叫醒。
 */

import { getSound, listSounds, worldFileUrl, type WorldSoundRow } from '@/apis/world';

let listP: Promise<Map<string, WorldSoundRow>> | null = null;

export function soundList(): Promise<Map<string, WorldSoundRow>> {
  if (!listP) listP = listSounds().then((l) => new Map(l.map((s) => [s.key, s]))).catch(() => { listP = null; return new Map(); });
  return listP;
}

/** 传了 / 删了 / 改了以后:下次重新读列表 */
export function refreshSounds() { listP = null; extra.clear(); }

const extra = new Map<string, Promise<WorldSoundRow | null>>();
/** 按 key 找一个:先看列表,没有再单独问(私有的也给;下架的 / 删掉的返回 null) */
export async function resolveSound(key: string): Promise<WorldSoundRow | null> {
  const s = (await soundList()).get(key);
  if (s) return s;
  let p = extra.get(key);
  if (!p) {
    p = getSound(key).catch(() => null);
    extra.set(key, p);
  }
  return p;
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

export interface Vec3 { x: number; y: number; z: number }

/** 听的人在哪、朝哪(forward 是水平朝向,上方向固定朝上) */
export function setListener(at: Vec3, forward: { x: number; z: number }) {
  const c = audioCtx();
  if (!c) return;
  const l = c.listener;
  const len = Math.hypot(forward.x, forward.z) || 1;
  const fx = forward.x / len, fz = forward.z / len;
  if (l.positionX) {
    const t = c.currentTime;
    l.positionX.setTargetAtTime(at.x, t, 0.05);
    l.positionY.setTargetAtTime(at.y, t, 0.05);
    l.positionZ.setTargetAtTime(at.z, t, 0.05);
    l.forwardX.setTargetAtTime(fx, t, 0.05);
    l.forwardY.setTargetAtTime(0, t, 0.05);
    l.forwardZ.setTargetAtTime(fz, t, 0.05);
    l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
  } else {
    // 老 Safari
    const old = l as unknown as { setPosition: (x: number, y: number, z: number) => void; setOrientation: (a: number, b: number, c: number, d: number, e: number, f: number) => void };
    old.setPosition(at.x, at.y, at.z);
    old.setOrientation(fx, 0, fz, 0, 1, 0);
  }
}

/** 只管方向的声场节点:距离衰减我们自己按半径算,所以这里关掉(参考距离很大) */
function makePanner(c: AudioContext, at: Vec3): PannerNode {
  const p = c.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = 'linear';
  p.refDistance = 1e4;
  p.maxDistance = 1e4 + 1;
  p.rolloffFactor = 0;
  if (p.positionX) { p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z; } else (p as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(at.x, at.y, at.z);
  return p;
}

/** 播一下库里的声音(给了 at 就从那儿传来);查不到 / 放不了返回 false */
export async function playLibSound(key: string, gain = 0.7, at?: Vec3 | null): Promise<boolean> {
  const s = await resolveSound(key);
  const c = audioCtx();
  if (!s || !c) return false;
  const buf = await bufferOf(key, s.file);
  if (!buf) return false;
  const src = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  if (at) src.connect(g).connect(makePanner(c, at)).connect(c.destination);
  else src.connect(g).connect(c.destination);
  src.start();
  return true;
}

export interface AmbientSource { id: string; key: string; x: number; y: number; z: number; volume: number; radius: number }

/** 环境声:每次 update 给出现在有哪些声源、人在哪,按距离开 / 关 / 调音量,方向跟着最近的那个声源 */
export class AmbientMixer {
  private voices = new Map<string, { src: AudioBufferSourceNode; gain: GainNode; panner: PannerNode }>();
  private loading = new Set<string>();

  async update(sources: readonly AmbientSource[], at: Vec3) {
    const c = audioCtx();
    if (!c) return;
    // 每个 key 只取最响的那个声源(音量、位置)
    const want = new Map<string, { v: number; pos: Vec3 }>();
    for (const s of sources) {
      const d = Math.hypot(s.x - at.x, s.y - at.y, s.z - at.z);
      const r = Math.max(1, Math.min(30, s.radius));
      if (d > r) continue;
      const v = Math.max(0, Math.min(1, s.volume)) * (1 - d / r) ** 2;
      const cur = want.get(s.key);
      if (!cur || v > cur.v) want.set(s.key, { v, pos: { x: s.x, y: s.y + 0.5, z: s.z } });
    }
    const t = c.currentTime;
    for (const [key, voice] of this.voices) {
      const w = want.get(key);
      voice.gain.gain.setTargetAtTime(w?.v ?? 0, t, 0.25);
      if (w) {
        voice.panner.positionX?.setTargetAtTime(w.pos.x, t, 0.1);
        voice.panner.positionY?.setTargetAtTime(w.pos.y, t, 0.1);
        voice.panner.positionZ?.setTargetAtTime(w.pos.z, t, 0.1);
      } else {
        this.voices.delete(key);
        window.setTimeout(() => { try { voice.src.stop(); } catch { /* 已经停了 */ } voice.src.disconnect(); voice.panner.disconnect(); }, 1200);
      }
    }
    for (const [key, w] of want) {
      if (this.voices.has(key) || this.loading.has(key)) continue;
      this.loading.add(key);
      const s = await resolveSound(key);
      const buf = s ? await bufferOf(key, s.file) : null;
      this.loading.delete(key);
      if (!buf || this.voices.has(key)) continue;
      const src = c.createBufferSource();
      const gain = c.createGain();
      const panner = makePanner(c, w.pos);
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(w.v, c.currentTime, 0.4);
      src.buffer = buf;
      src.loop = true;
      src.connect(gain).connect(panner).connect(c.destination);
      src.start();
      this.voices.set(key, { src, gain, panner });
    }
  }

  dispose() {
    for (const v of this.voices.values()) { try { v.src.stop(); } catch { /* 已经停了 */ } v.src.disconnect(); v.panner.disconnect(); }
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
