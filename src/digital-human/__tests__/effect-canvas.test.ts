import { describe, expect, it } from 'vitest';
import { mountEffectCanvas } from '../effectCanvas';

describe('mountEffectCanvas', () => {
  it('每次挂载都是一块新的 canvas,unmount 后从宿主移除', () => {
    const host = document.createElement('div');
    const first = mountEffectCanvas(host);
    expect(host.contains(first.canvas)).toBe(true);
    expect(first.canvas.style.width).toBe('100%');
    expect(first.canvas.style.height).toBe('100%');
    expect(first.canvas.style.display).toBe('block');

    first.unmount();
    expect(host.contains(first.canvas)).toBe(false);

    // 模拟依赖变化重跑 effect:不能复用已 forceContextLoss 的旧 canvas
    const second = mountEffectCanvas(host);
    expect(second.canvas).not.toBe(first.canvas);
    expect(host.querySelectorAll('canvas')).toHaveLength(1);

    second.unmount();
    second.unmount(); // 重复调用不抛
    expect(host.querySelectorAll('canvas')).toHaveLength(0);
  });
});
