'use client';

/**
 * /digital-human 的调试开关与采样(从 ImmersiveDigitalHuman.tsx 拆出,行为不变)。
 * ⚠️ 有模块级副作用(定 window.__DIGITAL_HUMAN_DEBUG),ImmersiveDigitalHuman 把它放在最后一个 import,
 * 求值时机与原来写在组件文件里一致。
 */
import React from 'react';
import { devLog } from '@/lib/dev-log';

// ── 调试：排查 runtime.lastError 来源 ──
// 只在开发环境,或地址栏带 ?dhdebug=1 时启用。以前模块一加载就给整个 app 挂
// 全局 keydown、替换 window.requestAnimationFrame、起一个永不清理的 setInterval:
// 线上用户访问过一次 /digital-human 之后,在任何页面按个「1」都会写进 noThree,
// 下次刷新 3D 就不渲染了。
// 操作步骤:
//   1. 打开 http://localhost:3000/digital-human(线上加 ?dhdebug=1)
//   2. 先记下控制台错误出现频率
//   3. 按 1 → 刷新页面 → 看错误是否停止 (排除 Three.js)
//   4. 按 2 → 刷新页面 → 点麦克风 → 看错误是否出现 (排除 VAD)
//   5. 按 3 → 刷新页面 → 点麦克风 → 看错误是否出现 (排除 ONNX wake-word)
//   "开关状态" 会打印在控制台，切换后需手动刷新页面生效
//   按 0 清除所有开关
const STORAGE_KEY = 'dh_debug_flags';
const loadFlags = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
};
const saveFlags = (f: Record<string, boolean>) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch { /* 隐私模式写不进去 */ }
  devLog.log('[debug] flags saved:', f, '(刷新页面生效)');
};
const debugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (process.env.NODE_ENV !== 'production') return true;
  try { return new URLSearchParams(window.location.search).has('dhdebug'); } catch { return false; }
};
if (typeof window !== 'undefined') {
  // 子组件(BlenderAvatar / VAD / 唤醒词)在自己的 effect 里读这个开关,比本组件的 effect 早,
  // 所以开关值要在模块加载时就定好。没开调试时一律视为关闭 —— 即使 localStorage 里
  // 残留了以前误触写进去的 noThree。
  const flags = debugEnabled() ? loadFlags() : {};
  (window as any).__DIGITAL_HUMAN_DEBUG = { noThree: !!flags.noThree, noVoice: !!flags.noVoice, noWake: !!flags.noWake };
}

/** 调试快捷键 + rAF/音频帧率采样:只在调试开启且本组件挂载期间生效,卸载时全部还原 */
export function useDigitalHumanDebug() {
  React.useEffect(() => {
    if (!debugEnabled()) return;
    devLog.log('[debug] current flags:', (window as any).__DIGITAL_HUMAN_DEBUG, '| 按 1/2/3 切换, 0 清除, 需刷新生效');

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; // 不在输入框里触发
      if ((e.target as HTMLElement | null)?.isContentEditable) return;
      const f = loadFlags();
      switch (e.key) {
        case '1': f.noThree = !f.noThree; saveFlags(f); break;
        case '2': f.noVoice = !f.noVoice; saveFlags(f); break;
        case '3': f.noWake  = !f.noWake;  saveFlags(f); break;
        case '0': try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } devLog.log('[debug] all flags cleared'); break;
      }
    };
    window.addEventListener('keydown', onKey);

    // 每 2 秒采样一次，统计 rAF / audio 帧率
    let rAFCount = 0, audioFrameCount = 0;
    const origRAF = window.requestAnimationFrame;
    const wrappedRAF = (cb: FrameRequestCallback) => origRAF.call(window, (t: number) => { rAFCount++; cb(t); });
    window.requestAnimationFrame = wrappedRAF;
    const timer = setInterval(() => {
      if (rAFCount > 0 || audioFrameCount > 0) {
        devLog.debug(`[debug] rAF=${rAFCount}/2s (~${Math.round(rAFCount/2)}fps) audioFrame=${audioFrameCount}/2s`);
        rAFCount = 0; audioFrameCount = 0;
      }
    }, 2000);
    (window as any).__DEBUG_audioFrameInc = () => { audioFrameCount++; };

    return () => {
      window.removeEventListener('keydown', onKey);
      clearInterval(timer);
      // 期间别人又包了一层就不动,免得把别人的包装拆掉
      if (window.requestAnimationFrame === wrappedRAF) window.requestAnimationFrame = origRAF;
      delete (window as any).__DEBUG_audioFrameInc;
    };
  }, []);
}
