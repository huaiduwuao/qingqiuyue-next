'use client';

import { useEffect } from 'react';
import { authPlatform } from '@/lib/clientAuth';

/**
 * 客户端里给 <html> 打上 data-client="android|windows|macos|ios",网页里什么都不做。
 * globals.css 按它收掉只在网页里才有的交互(长按选中界面文字、整页橡皮筋回弹等),
 * 让安卓客户端的手感更接近原生应用。
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
  return null;
}
