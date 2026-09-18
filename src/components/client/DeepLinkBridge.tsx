'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onDeepLink } from '@/lib/clientAuth';

/**
 * 接住客户端的 qingqiuyue:// 回跳。
 *
 * 微信授权是在系统浏览器里完成的,后端回调时 302 到
 *   qingqiuyue://social-login?action=login&session_id=...&from=...
 * 系统把它交给 App,Rust 侧转成 deep-link://open 事件,这里把人送到对应页面。
 *
 * 网页里 window.__TAURI__ 不存在,onDeepLink 直接返回空订阅,什么都不做。
 */
export default function DeepLinkBridge() {
  const router = useRouter();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    onDeepLink((url) => {
      // qingqiuyue://social-login?... —— 自定义协议下 host 是 social-login
      const route = (url.host || url.pathname.replace(/^\/+/, '')).toLowerCase();
      if (route !== 'social-login') return;

      const from = url.searchParams.get('from') || '/home/recommend';
      if (url.searchParams.get('action') === 'bind') {
        router.replace('/account/settings?bind=success');
        return;
      }
      const sessionId = url.searchParams.get('session_id') || '';
      router.replace(
        `/user/social-login/wx?session_id=${encodeURIComponent(sessionId)}&from=${encodeURIComponent(from)}`,
      );
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [router]);

  return null;
}
