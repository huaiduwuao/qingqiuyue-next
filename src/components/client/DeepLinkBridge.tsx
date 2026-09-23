'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onDeepLink } from '@/lib/clientAuth';
import { matchesOauthState } from '@/lib/auth/oauthState';

/**
 * 接住客户端的 qingqiuyue:// 回跳。
 *
 * 微信授权是在系统浏览器里完成的,后端回调时 302 到
 *   qingqiuyue://social-login?action=login&code=...&state=...&from=...(老后端是 session_id=...)
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
      // 任何网页都能触发 qingqiuyue://social-login?session_id=<攻击者的会话>:
      // 只转发本 App 自己发起的那次登录(state 对得上),其余一律丢弃。
      const code = url.searchParams.get('code') || '';
      const state = url.searchParams.get('state');
      const q = new URLSearchParams({ from });
      if (code) {
        if (!matchesOauthState(state ?? '')) return;
        q.set('code', code);
        q.set('state', state ?? '');
      } else {
        // 老后端:直接带 session_id、不回传 state
        const sessionId = url.searchParams.get('session_id') || '';
        if (!sessionId || !matchesOauthState(state)) return;
        q.set('session_id', sessionId);
        if (state) q.set('state', state);
      }
      router.replace(`/user/social-login/wx?${q.toString()}`);
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
