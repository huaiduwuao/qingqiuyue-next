/**
 * vrm/useExpressionLerp.ts — 表情/口型/动作的平滑过渡
 *
 * Phase 3.2：替换之前直接 em.setValue(name, value) 的"跳变"
 * 现在用 lerp(current, target, factor) 平滑过渡
 *
 * 用法：
 *   const lerp = useExpressionLerp({ em: expressionManager });
 *   lerp.setTarget({ mouthSmileLeft: 0.8, mouthSmileRight: 0.8 });  // 想要
 *   // 每帧 frame loop 调：
 *   lerp.tick(dt);  // 把 current 往 target 推
 *
 * 自动处理：
 *   - 切到新 dict 时，旧 channels 淡出（target=0），新 channels 淡入
 *   - 同 channel 一直保持的，target 保持
 */

import { useCallback, useRef } from 'react';

export interface UseExpressionLerpOptions {
  /** expressionManager ref（从 vrmDataRef）—— 异步加载，render 时可能为 null */
  emRef: React.MutableRefObject<any>;
  /** 过渡速度（1=慢, 8=快, 默认 6 = ~150ms 完成） */
  speed?: number;
}

export function useExpressionLerp(opts: UseExpressionLerpOptions) {
  const { emRef, speed = 6 } = opts;
  const targetRef = useRef<Record<string, number>>({});
  const currentRef = useRef<Record<string, number>>({});

  /** 设置目标 dict（每个 channel 的值）。下一帧开始 lerp。 */
  const setTarget = useCallback((dict: Record<string, number>) => {
    const newTarget: Record<string, number> = {};
    for (const k of Object.keys(dict)) {
      const v = dict[k];
      if (typeof v === 'number') newTarget[k] = v;
    }
    // 旧 channels 淡出（如果不在 newTarget 里）
    for (const k of Object.keys(targetRef.current)) {
      if (!(k in newTarget)) {
        // 当前 target 是旧值，淡出到 0
        newTarget[k] = 0;
      }
    }
    targetRef.current = newTarget;
  }, []);

  /** 立即重置（debug 用：清空 current 让模型回到中性） */
  const reset = useCallback(() => {
    targetRef.current = {};
    currentRef.current = {};
    const em = emRef.current;
    if (!em) return;
    if (em._expressionMap) {
      for (const k of Object.keys(em._expressionMap)) em.setValue(k, 0);
    }
  }, [emRef]);

  /**
   * 每帧调一次：把 current 往 target 推并写到 em
   *   current += (target - current) * min(1, speed * dt)
   */
  function tick(dt: number) {
    const em = emRef.current;
    if (!em) return;
    const target = targetRef.current;
    const current = currentRef.current;
    const k = Math.min(1, speed * dt);
    for (const kk of Object.keys(target)) {
      const tv = target[kk] ?? 0;
      const cv = current[kk] ?? 0;
      const next = Math.abs(tv - cv) < 0.001 ? tv : cv + (tv - cv) * k;
      current[kk] = next;
      if (Math.abs(next) > 0.001) {
        em.setValue(kk, next);
      } else if (kk in current && Math.abs(cv) > 0.001) {
        em.setValue(kk, 0);
      }
    }
    for (const kk of Object.keys(current)) {
      if (!(kk in target) && Math.abs(current[kk] ?? 0) < 0.001) {
        delete current[kk];
      }
    }
  }

  return { setTarget, tick, reset, getCurrent: () => ({ ...currentRef.current }) };
}
