'use client';

import { useEffect } from 'react';
import { EMBED_MESSAGE } from '@/digital-human/scene-ui/displays';

/** 当前页面是不是开在同源的 iframe 里(数字人场景里的显示器) */
export function isSceneEmbedded(): boolean {
  if (typeof window === 'undefined' || window.self === window.top) return false;
  try {
    return window.parent.location.origin === window.location.origin;
  } catch {
    return false; // 被别的站嵌了,不是我们的显示器
  }
}

/**
 * 页面开在数字人场景的显示器里时,接管「返回」。
 *
 * 浏览器的历史栈是整个标签页共用的:iframe 里的 history.back()(详情页左上角的返回、
 * 各处的 router.back())退的可能是另一块屏,第一页上再退就把外层的数字人页面退走了。
 * 所以转发给外层,由那块屏按自己的访问栈处理。
 */
export default function EmbedBridge() {
  useEffect(() => {
    if (!isSceneEmbedded()) return;
    const original = window.history.back;
    window.history.back = () => {
      window.parent.postMessage({ source: EMBED_MESSAGE, action: 'back' }, window.location.origin);
    };
    return () => {
      window.history.back = original;
    };
  }, []);
  return null;
}
