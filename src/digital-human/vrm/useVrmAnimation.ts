/**
 * vrm/useVrmAnimation.ts — 统一动画状态机
 *
 * Phase 4 设计：
 *   替换现有 last-writer-wins 隐式约定，用显式优先级：
 *     action > dance > walk > talk > pose > idle
 *
 * 每种"动画源"可设置自己的状态，状态机按优先级合成每帧的最终 bone rotation。
 *
 * 设计原则：
 *   - 各源独立运作（不互相等待）
 *   - 高优先级覆盖低优先级（同 bone）
 *   - emotion / viseme 独立通道（不与 bone 覆盖）
 *   - 物理独立通道（场景位置由物理决定）
 *
 * Phase 4.1 落地：定义类型 + helper
 * Phase 4.2 落地：替换 useVrmDance 和 VrmStage 里的 frame loop（next PR）
 */

import { useCallback, useRef, useState } from 'react';
import type { ConfigBundle } from './config/types';

// ---------- 状态机类型 ----------

export type AnimState =
  | { kind: 'idle' }
  | { kind: 'action'; name: string; startedAt: number; speed: number; repeat: number; expiresAt: number }
  | { kind: 'pose'; name: string; blend: number }  // 永远 active，blend 从 0 升到 1
  | { kind: 'dance'; style: string; bpm: number; amp: number; startedAt: number }
  | { kind: 'walk'; phase: number; style: 'walk' | 'run' | 'idle' }
  | { kind: 'talk'; visemeAt: (t: number) => { shape: string; weight: number } | null };

export type AnimPriority =
  | 'action'   // 最高
  | 'dance'
  | 'walk'
  | 'talk'
  | 'pose'
  | 'idle';    // 最低

const PRIORITY_RANK: Record<string, number> = {
  action: 6, dance: 5, walk: 4, talk: 3, pose: 2, idle: 1,
};

// ---------- 状态机实例 ----------

export class AnimationStateMachine {
  /** 当前优先级最高的状态 */
  active: AnimState = { kind: 'idle' };
  /** 所有运行中的状态（按优先级排序） */
  stack: AnimState[] = [{ kind: 'idle' }];

  /**
   * 设置一个状态（自动按优先级合并到 stack）
   * 同优先级的新状态会覆盖旧状态
   */
  set(state: AnimState) {
    // 同 kind 的状态覆盖
    this.stack = this.stack.filter((s) => s.kind !== state.kind);
    this.stack.push(state);
    // 按优先级排序（高到低）
    this.stack.sort((a, b) => (PRIORITY_RANK[b.kind] ?? 0) - (PRIORITY_RANK[a.kind] ?? 0));
    this.active = this.stack[0];
  }

  /** 移除某个状态（fallback 到 idle） */
  remove(kind: AnimState['kind']) {
    this.stack = this.stack.filter((s) => s.kind !== kind);
    if (this.stack.length === 0) this.stack.push({ kind: 'idle' });
    this.active = this.stack[0];
  }

  /** 取所有"还在动"的状态（用于 tick 时按优先级合成） */
  activeByPriority(): AnimState[] {
    return [...this.stack].sort((a, b) => (PRIORITY_RANK[b.kind] ?? 0) - (PRIORITY_RANK[a.kind] ?? 0));
  }
}

// ---------- React hook ----------

export interface UseVrmAnimationOptions {
  /** 用于 formula 查表 */
  configBundle: ConfigBundle;
  /** VRM humanoid（用于 getBone） */
  humanoid: any;
  /** 物理 body（如有，物理控制位置） */
  physicsBody?: any;
}

export function useVrmAnimation(opts: UseVrmAnimationOptions) {
  const { configBundle, humanoid } = opts;
  const smRef = useRef<AnimationStateMachine>(new AnimationStateMachine());
  const sm = smRef.current;

  /** 状态 setter（外部调用） */
  const setState = useCallback((s: AnimState) => sm.set(s), [sm]);
  const removeState = useCallback((kind: AnimState['kind']) => sm.remove(kind), [sm]);

  /**
   * tick(elapsed, dt, bones) — 状态机驱动 bone rotation
   *
   * 优先级合成：低优先级状态写 bone，高优先级状态覆盖。
   * 同 kind 的状态：先 setState 一次的最新值。
   * 不同 kind 同 bone：低优先级先写，高优先级后覆盖。
   *
   * 注：当前实现不实际执行 bone rotation（保留 useVrmDance / VrmStage 现有逻辑）
   * Phase 4.2 会把 useVrmDance 拆掉，全切到本 hook
   */
  function tick(_elapsed: number, _dt: number) {
    // Phase 4.2 落地
    // 1. idle 写入默认站姿
    // 2. pose 覆盖（如果 blend < 1）
    // 3. talk 覆盖 mouth 骨骼
    // 4. walk 覆盖 leg/arm
    // 5. dance 覆盖 dance 涉及的 bone
    // 6. action 覆盖所有 bone
  }

  return {
    state: sm,
    activeState: () => sm.active,
    setState,
    removeState,
    tick,
  };
}
