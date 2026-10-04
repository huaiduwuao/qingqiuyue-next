'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { currentDeepLinks, onDeepLink } from '@/lib/clientAuth';
import { hasPendingOauthState } from '@/lib/auth/oauthState';

/**
 * 接住客户端的 qingqiuyue:// 回跳。
 *
 * 微信授权是在系统浏览器里完成的,后端回调时 302 到
 *   qingqiuyue://social-login?action=login&code=<一次性 code>&from=...
 * 系统把它交给 App,Rust 侧转成 deep-link://open 事件,这里把人送到对应页面。
 *
 * qingqiuyue://open?path=/detail/...:网页在会接管视频的国产浏览器里(lib/hijackBrowser)给的「打开 App」,
 * 只接受站内路径。
 *
 * 网页里 window.__TAURI__ 不存在,onDeepLink 直接返回空订阅,什么都不做。
 */
function sessionFlag(key: string): boolean {
  try {
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, '1');
  } catch {
    /* 存不了就当第一次 */
  }
  return false;
}

export default function DeepLinkBridge() {
  const router = useRouter();
  // 回跳被拒(state 没有 / 过期 / 链接不是本 App 发起的)时给个提示,别让用户在系统浏览器授权完回来什么都没发生
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const handle = (url: URL) => {
      // qingqiuyue://social-login?... —— 自定义协议下 host 是 social-login
      const route = (url.host || url.pathname.replace(/^\/+/, '')).toLowerCase();
      if (route === 'open') {
        const path = url.searchParams.get('path') || '';
        // 只认站内路径:/xxx,不能是 //host 或 /\host
        if (/^\/(?![/\\])/.test(path)) router.push(path);
        return;
      }
      if (route !== 'social-login') return;

      const from = url.searchParams.get('from') || '/home/recommend';
      if (url.searchParams.get('action') === 'bind') {
        router.replace('/account/settings?bind=success');
        return;
      }
      // 任何网页都能触发 qingqiuyue://social-login?…:只转发本 App 自己发起、还没用掉的那次登录,
      // 带 session_id 的(老格式 / 伪造)一律丢弃。state 留给登录收尾页交给后端核对。
      const code = url.searchParams.get('code') || '';
      if (!code || url.searchParams.has('session_id') || !hasPendingOauthState()) {
        setRejected(true);
        return;
      }
      const q = new URLSearchParams({ code, from });
      router.replace(`/user/social-login/wx?${q.toString()}`);
    };
    // App 没在运行时,链接随冷启动进来、早于这里的监听:补收一次(登录回跳不会冷启动,只补 open)
    void currentDeepLinks().then((urls) => {
      // get_current 整个进程里一直返回启动那条链接:只处理一次,页面重载 / 组件重挂不再跳
      if (cancelled || sessionFlag('qq-cold-deeplink')) return;
      for (const u of urls) if (u.host === 'open') handle(u);
    });
    onDeepLink(handle).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [router]);

  if (!rejected) return null;
  return (
    <Snackbar
      open
      autoHideDuration={6000}
      onClose={() => setRejected(false)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert severity="error" variant="filled" onClose={() => setRejected(false)}>
        微信登录已过期或不是在本应用里发起的,请回到登录页重新点「微信登录」
      </Alert>
    </Snackbar>
  );
}
