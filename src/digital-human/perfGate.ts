/**
 * digital-human/perfGate.ts — 数字人界面的设备性能门槛:跑不动就提示、不让进
 *
 * 两道关:
 *   1. 进门前的快检(毫秒级):没有 WebGL2、显卡是软件渲染(SwiftShader / llvmpipe / Microsoft Basic Render —— 没开硬件加速
 *      或者根本没有显卡)、内存 < 2 GB、CPU < 2 核 → 直接拦。
 *   2. 进门后量帧率(useFpsGate):只在页面可见时算,前 5 秒(加载、编译着色器)不算;
 *      高画质持续 < 24 帧 → 先自动降到流畅画质;流畅画质下还持续 < 18 帧 → 拦。
 * 不记结论:每次进来都现场检测(快检 + 量帧率),「重新检测」就是再测一遍。
 */

import * as React from 'react';

export interface GateVerdict {
  blocked: boolean;
  reason: string;
  detail?: string;
}

const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|microsoft basic render|basic render driver|mesa offscreen/i;

/** 进门前的快检:不读任何素材,只问浏览器和显卡 */
export function quickCheck(): GateVerdict {
  if (typeof window === 'undefined') return { blocked: false, reason: '' };
  const canvas = document.createElement('canvas');
  let gl: WebGL2RenderingContext | null = null;
  try { gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }); } catch { gl = null; }
  if (!gl) {
    return { blocked: true, reason: '浏览器不支持 WebGL2', detail: '数字人世界需要 WebGL2 来画 3D 场景。请换用新版 Chrome / Edge / Safari,或在浏览器设置里开启「硬件加速」。' };
  }
  let renderer = '';
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch { /* 拿不到就算了 */ }
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  if (SOFTWARE_GPU.test(renderer)) {
    return { blocked: true, reason: '显卡在用软件渲染', detail: `浏览器没用上显卡(${renderer}),3D 画面会非常卡。请在浏览器设置里打开「使用硬件加速」,或更新显卡驱动后再来。` };
  }
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 2) {
    return { blocked: true, reason: '设备内存不足', detail: `这台设备只有约 ${nav.deviceMemory} GB 内存,数字人世界至少需要 2 GB。` };
  }
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency < 2) {
    return { blocked: true, reason: '处理器太弱', detail: '这台设备只有单核处理器,跑不动数字人世界。' };
  }
  return { blocked: false, reason: '', detail: renderer };
}

/**
 * 进门后量帧率。返回当前的拦截结论(null = 放行)。
 * quality / setQuality:高画质跑不动先降级,降级后还跑不动才拦。
 */
export function useFpsGate(opts: { enabled: boolean; quality: 'high' | 'low'; setQuality: (q: 'high' | 'low') => void; onDegrade?: () => void }) {
  const [verdict, setVerdict] = React.useState<GateVerdict | null>(null);
  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  React.useEffect(() => {
    if (!opts.enabled || verdict) return;
    let raf = 0;
    let last = 0;
    let visibleFor = 0;   // 页面可见的累计时长(秒)
    let windowT = 0, windowFrames = 0;
    let slowFor = 0;      // 连续慢了多久(秒)
    const WARMUP = 5, WINDOW = 2;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const visible = document.visibilityState === 'visible';
      if (!last || !visible) { last = now; return; }
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      visibleFor += dt;
      if (visibleFor < WARMUP) return;
      windowT += dt;
      windowFrames += 1;
      if (windowT < WINDOW) return;
      const fps = windowFrames / windowT;
      windowT = 0; windowFrames = 0;
      const o = optsRef.current;
      const floor = o.quality === 'high' ? 24 : 18;
      slowFor = fps < floor ? slowFor + WINDOW : 0;
      if (slowFor >= (o.quality === 'high' ? 6 : 8)) {
        slowFor = 0;
        visibleFor = 0; // 换了画质重新热身
        if (o.quality === 'high') {
          o.setQuality('low');
          o.onDegrade?.();
        } else {
          const v: GateVerdict = { blocked: true, reason: '设备性能不够', detail: `流畅画质下只有约 ${Math.round(fps)} 帧/秒,会一直卡顿。` };
          setVerdict(v);
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [opts.enabled, verdict]);

  return { verdict, reset: () => setVerdict(null) };
}
