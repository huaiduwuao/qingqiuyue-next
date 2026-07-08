/**
 * vrm/useVrmDance.ts — 程序化舞蹈（BPM 驱动 + 2 套风格：groove / idol）
 *
 * 用法：
 *   const danceApi = useVrmDance({ vrm, audio });
 *   danceApi.tick(elapsed, dt);
 *   danceApi.setDancing(true); danceApi.setStyle('idol');
 */

import { useCallback, useRef, useState } from 'react';
import { POSES } from './poses';
import type { PoseName, DanceStyle } from './types';
import type { AudioHandle } from './audio';
import { getBone } from './vrmCompat';

export interface UseVrmDanceOptions {
  /**
   * VRM 引用（ref，而不是值 — VRM 是异步加载的，首次渲染时 vrmRef.current 是 null）
   * 父组件用 useRef 存 vrm 实例，dance 内部每帧读 vrmRef.current
   */
  vrmRef: React.MutableRefObject<any>;
  audio: AudioHandle;
  initialBpm?: number;
  initialAmp?: number;
  initialStyle?: DanceStyle;
  initialDancing?: boolean;
  /** 行走状态（ref）—— 内部读 .current 拿 { moving, phase, style } */
  walkRef?: React.MutableRefObject<{ moving: boolean; phase: number; style: 'walk' | 'run' | 'idle' | 'teleport' }>;
}

const P = Math.PI;

export function useVrmDance(opts: UseVrmDanceOptions) {
  const { vrmRef, audio, walkRef, initialBpm = 120, initialAmp = 1, initialStyle = 'groove', initialDancing = false } = opts;
  const [dancing, setDancing] = useState(initialDancing);
  const [style, setStyle] = useState<DanceStyle>(initialStyle);
  const [bpm, setBpm] = useState(initialBpm);
  const [amp, setAmp] = useState(initialAmp);
  const dancingRef = useRef(dancing);
  const styleRef = useRef(style);
  const bpmRef = useRef(bpm);
  const ampRef = useRef(amp);
  const danceBlendRef = useRef(0);
  const freeBeatRef = useRef(0);
  const hipsBaseYRef = useRef(0);
  const poseBlendRef = useRef(0);
  const currentPoseRef = useRef<PoseName>('idle');
  dancingRef.current = dancing;
  styleRef.current = style;
  bpmRef.current = bpm;
  ampRef.current = amp;

  const setPose = useCallback((name: PoseName, instant = false) => {
    currentPoseRef.current = name;
    if (instant && vrmRef.current) {
      const H = (n: string) => getBone(vrmRef.current.humanoid, n);
      const spec = POSES[name] as Record<string, [number, number, number]>;
      for (const [bone, rot] of Object.entries(spec)) {
        const o = H(bone);
        if (o) o.rotation.set(rot[0], rot[1], rot[2]);
      }
    }
    poseBlendRef.current = instant ? 1 : 0;
  }, [vrmRef]);

  /** 第一次拿到 vrm 时记录 hip 基线 */
  const setHipsBaseY = useCallback((y: number) => { hipsBaseYRef.current = y; }, []);

  function beatNow(dt: number) {
    // 优先用音频上下文的精确时间（与演示歌曲同步）
    const ctx: AudioContext | null = (audio as any).audioCtx;
    if (audio.isSongOn() && ctx) {
      return (ctx.currentTime - audio.getSongStartTime()) * 120 / 60;
    }
    freeBeatRef.current += dt * bpmRef.current / 60;
    return freeBeatRef.current;
  }

  /** 每帧调用 */
  function tick(elapsed: number, dt: number) {
    const vrm = vrmRef.current;
    if (!vrm) return;
    const H = (n: string) => getBone(vrm.humanoid, n);
    const set = (n: string, x: number, y: number, z: number) => {
      const o = H(n); if (o) o.rotation.set(x, y, z);
    };
    const hips = H('hips'); if (!hips) return;
    danceBlendRef.current += ((dancingRef.current ? 1 : 0) - danceBlendRef.current) * Math.min(1, dt * 4);
    const A = danceBlendRef.current * ampRef.current;
    const b = beatNow(dt);
    const breath = Math.sin(elapsed * 1.6) * 0.02;
    const frame = audio.poll();
    let hipsY = hipsBaseYRef.current, hipsRX = 0, hipsRY = 0, hipsRZ = 0;
    let spineX = breath, spineY = 0, spineZ = 0;
    let headX = 0, headY = 0, headZ = 0;
    let lSh = { x: 0, y: 0, z: -1.15 }, rSh = { x: 0, y: 0, z: 1.15 };
    let lEl = { x: 0, y: 0, z: -0.15 }, rEl = { x: 0, y: 0, z: 0.15 };
    let legBend = 0;

    if (styleRef.current === 'groove') {
      const bounce = Math.abs(Math.sin(b * P));
      const sway = Math.sin(b * P / 2);
      legBend = A * (0.32 - bounce * 0.22 + frame.bass * 0.25);
      hipsY -= legBend * 0.16;
      hipsRY = A * 0.30 * sway;
      hipsRZ = A * 0.06 * Math.sin(b * P);
      spineY = -hipsRY * 0.55; spineZ = -hipsRZ * 0.6;
      headZ = A * 0.10 * Math.sin(b * P + 0.6);
      headX = A * 0.08 * Math.sin(b * 2 * P);
      headY = -hipsRY * 0.4;
      const sw = Math.sin(b * P / 2);
      lSh = { x: A * (-0.45 + 0.45 * sw), y: A * 0.12, z: -1.15 + A * 0.18 * Math.sin(b * P) };
      rSh = { x: A * (-0.45 - 0.45 * sw), y: -A * 0.12, z: 1.15 - A * 0.18 * Math.sin(b * P) };
      lEl = { x: 0, y: A * (0.9 + 0.3 * sw), z: -0.2 };
      rEl = { x: 0, y: -A * (0.9 - 0.3 * sw), z: 0.2 };
    } else {
      const wave = Math.sin(b * P / 2);
      legBend = A * (0.12 + 0.10 * Math.abs(Math.sin(b * P)));
      hipsY -= legBend * 0.12;
      hipsRZ = A * 0.10 * wave;
      hipsRY = A * 0.12 * Math.sin(b * P / 4);
      spineZ = A * 0.10 * wave;
      headZ = A * 0.16 * wave;
      headX = -A * 0.05;
      lSh = { x: A * 0.2 * wave, y: 0, z: 0.95 * A - 1.15 * (1 - A) };
      rSh = { x: -A * 0.2 * wave, y: 0, z: -0.95 * A + 1.15 * (1 - A) };
      lEl = { x: 0, y: 0, z: A * (0.5 + 0.45 * wave) };
      rEl = { x: 0, y: 0, z: -A * (0.5 - 0.45 * wave) };
    }
    hips.position.y = hipsY;
    hips.rotation.set(hipsRX, hipsRY, hipsRZ);
    set('spine', spineX, spineY, spineZ);
    set('chest', spineX * 0.6, spineY * 0.5, spineZ * 0.5);
    set('neck', headX * 0.4, headY * 0.4, headZ * 0.4);
    set('head', headX, headY, headZ);
    set('leftUpperArm', lSh.x, lSh.y, lSh.z);
    set('rightUpperArm', rSh.x, rSh.y, rSh.z);
    set('leftLowerArm', lEl.x, lEl.y, lEl.z);
    set('rightLowerArm', rEl.x, rEl.y, rEl.z);
    set('leftUpperLeg', -legBend, 0, 0.03);
    set('rightUpperLeg', -legBend, 0, -0.03);
    set('leftLowerLeg', legBend * 1.9, 0, 0);
    set('rightLowerLeg', legBend * 1.9, 0, 0);

    // —— 行走覆盖：moving=true 时腿前后摆动 + 身体轻微颠簸 ——
    if (walkRef?.current?.moving) {
      const w = walkRef.current;
      const swing = Math.sin(w.phase) * 0.55;
      const kneeBend = Math.max(0, -Math.sin(w.phase)) * 0.6;  // 后摆时膝盖弯
      const bounce = Math.abs(Math.sin(w.phase * 2)) * 0.03;   // 上下颠簸
      set('leftUpperLeg', swing, 0, 0);
      set('rightUpperLeg', -swing, 0, 0);
      set('leftLowerLeg', kneeBend, 0, 0);
      set('rightLowerLeg', kneeBend, 0, 0);
      // 身体轻微上下
      if (hips) hips.position.y = hipsBaseYRef.current + bounce;
      // 手臂轻微反向摆（自然行走）
      set('leftUpperArm', 0, 0, -1.15 + swing * 0.25);
      set('rightUpperArm', 0, 0, 1.15 - swing * 0.25);
    } else if (hips) {
      // 静止时归位
      hips.position.y = hipsBaseYRef.current;
    }

    // pose 平滑混合（在 dance 写入之后做"覆盖"，不破坏 dance 的动态）
    poseBlendRef.current = Math.min(1, poseBlendRef.current + dt * 3);
    const spec = POSES[currentPoseRef.current] as Record<string, [number, number, number]>;
    const k = poseBlendRef.current;
    if (currentPoseRef.current !== 'idle' || k > 0) {
      for (const [bone, rot] of Object.entries(spec)) {
        const o = H(bone);
        if (!o) continue;
        o.rotation.x = o.rotation.x * (1 - k) + rot[0] * k;
        o.rotation.y = o.rotation.y * (1 - k) + rot[1] * k;
        o.rotation.z = o.rotation.z * (1 - k) + rot[2] * k;
      }
    }
  }

  return {
    dancing, setDancing, style, setStyle, bpm, setBpm, amp, setAmp,
    setPose, setHipsBaseY, tick,
  };
}
