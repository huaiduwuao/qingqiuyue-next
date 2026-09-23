/**
 * 每次 effect 运行都新建一块 <canvas>,cleanup 时移除。
 *
 * three 的 renderer 在 cleanup 里会 forceContextLoss() 释放 WebGL context,
 * 被丢掉 context 的 canvas 不能再拿来 getContext —— 如果 canvas 由 React 渲染并复用,
 * 切资产 / 画质 / modelUrl 重跑 effect 时 new WebGLRenderer 就会初始化失败。
 * 所以 canvas 跟着 effect 的生命周期走,而不是跟着组件。
 */
export const EFFECT_CANVAS_STYLE: Partial<CSSStyleDeclaration> = {
  width: '100%',
  height: '100%',
  display: 'block',
  outline: 'none',
};

export function mountEffectCanvas(host: HTMLElement): {
  canvas: HTMLCanvasElement;
  unmount: () => void;
} {
  const canvas = host.ownerDocument.createElement('canvas');
  Object.assign(canvas.style, EFFECT_CANVAS_STYLE);
  host.appendChild(canvas);
  return {
    canvas,
    unmount: () => {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}
