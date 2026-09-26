'use client';

import { useEffect } from 'react';
import { authPlatform } from '@/lib/clientAuth';

const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';

/**
 * 给 <html> 打平台标记,globals.css 按它收掉只在桌面网页里才合适的交互
 * (长按选中界面文字、网页式的点击反馈、顶部提示条等),让手机上的手感更接近原生应用:
 * - 客户端里:data-client="android|windows|macos|ios"
 * - 手机/平板浏览器(触屏、没有悬停):data-touch —— 网页也要原生手感,不只是客户端
 */
export default function ClientPlatformAttr() {
  useEffect(() => {
    const p = authPlatform();
    if (p === 'web') return;
    const root = document.documentElement;
    root.dataset.client = p;
    return () => {
      delete root.dataset.client;
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.(TOUCH_QUERY);
    if (!mq) return;
    const root = document.documentElement;
    const apply = () => {
      if (mq.matches) root.dataset.touch = '';
      else delete root.dataset.touch;
    };
    apply();
    mq.addEventListener?.('change', apply);
    return () => {
      mq.removeEventListener?.('change', apply);
      delete root.dataset.touch;
    };
  }, []);
  return null;
}
