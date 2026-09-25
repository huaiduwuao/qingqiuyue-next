'use client';

/**
 * 客户端(Tauri 包)里的微信登录。
 *
 * 两件事跟网页不一样:
 * 1. 请求地址必须是绝对的 —— 客户端页面跑在 tauri.localhost 上,相对的 /api/... 会落到应用自己身上,
 *    根本到不了网关(之前客户端里点「微信登录」什么都不会发生,就是这个原因)。
 * 2. 授权得在系统浏览器里走完 —— 微信不认客户端自带的 WebView;走完之后后端会 302 到
 *    qingqiuyue://social-login?...,由 DeepLinkBridge 接住,把人送回 App 内的登录收尾页。
 *
 * 这里一律用 withGlobalTauri 暴露的 window.__TAURI__,不额外引 @tauri-apps 的 JS 包。
 */

const GATEWAY = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

type TauriGlobal = {
  core?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> };
  event?: {
    listen: (name: string, cb: (e: { payload: unknown }) => void) => Promise<() => void>;
  };
};

function tauri(): TauriGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { __TAURI__?: TauriGlobal }).__TAURI__ ?? null;
}

/**
 * 客户端里用系统打开外链(https):安卓上 B 站 / 抖音等链接会交给已装的 App,没装就开系统浏览器。
 * 客户端 WebView 里 <a target="_blank"> 什么都不会发生,所以要显式走 open_external。
 * 返回 true 表示已交给系统处理;网页里返回 false,调用方按普通链接处理。
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  const t = tauri();
  if (!t?.core) return false;
  try {
    await t.core.invoke('open_external', { url });
    return true;
  } catch {
    return false;
  }
}

/** 是否跑在打包客户端里(网页里恒为 false)。 */
export function isDesktopClient(): boolean {
  return tauri() != null;
}

export type AuthPlatform = 'web' | 'windows' | 'macos' | 'android' | 'ios';

/** 告诉后端该用哪一个微信应用 —— 网站应用和移动应用的 AppID 不通用。 */
export function authPlatform(): AuthPlatform {
  if (!isDesktopClient()) return 'web';
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Mac OS X|Macintosh/i.test(ua)) return 'macos';
  return 'windows';
}

/**
 * 微信授权入口。网页下是同源相对地址,客户端下是网关绝对地址 + platform。
 * state 由 lib/auth/oauthState 生成,作为 client_state 交给后端(不带后端直接 400),
 * 后端把它和回跳的一次性 code 绑定,换会话时核对。
 */
export function wechatLoginUrl(from: string, state: string): string {
  const platform = authPlatform();
  const base = platform === 'web' ? '' : GATEWAY;
  const q = `from=${encodeURIComponent(from)}&platform=${platform}&client_state=${encodeURIComponent(state)}`;
  return `${base}/api/core/oauth/login/wechat?${q}`;
}

/**
 * 客户端里发起微信登录:把授权地址交给系统浏览器。
 * 返回 false 表示不在客户端里(调用方照旧 window.location.href 即可)。
 */
export async function startWechatLoginInBrowser(from: string, state: string): Promise<boolean> {
  const t = tauri();
  if (!t?.core) return false;
  await t.core.invoke('open_external', { url: wechatLoginUrl(from, state) });
  return true;
}

/** 订阅 deep link(Rust 侧 on_open_url 转发过来的)。返回取消订阅函数。 */
export async function onDeepLink(cb: (url: URL) => void): Promise<() => void> {
  const t = tauri();
  if (!t?.event) return () => {};
  return t.event.listen('deep-link://open', (e) => {
    const raw = e.payload;
    const list = Array.isArray(raw) ? raw : [raw];
    for (const item of list) {
      try {
        cb(new URL(String(item)));
      } catch {
        // 不是合法 URL 就忽略,别让一条脏数据把监听搞挂
      }
    }
  });
}
