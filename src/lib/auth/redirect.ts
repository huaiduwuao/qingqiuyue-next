// 登录后回跳地址的唯一出入口。
//
// 此前 LoginGate 往 sessionStorage 写了 login_redirect,登录页却从不读,登录成功一律
// 跳 /home/recommend;AuthContext 把未登录用户踢去登录页时也不记来源。现在所有
// "去登录"都经 loginHref(),登录/注册成功统一 consumeRedirect()。

import { safeSitePath } from '@/lib/safeUrl';

const STORAGE_KEY = 'login_redirect';
export const LOGIN_PATH = '/user/login';
export const DEFAULT_AFTER_LOGIN = '/home/recommend';

/** 只接受站内相对路径,防止 ?redirect=https://evil 形式的开放跳转;登录页自身不作为回跳目标。 */
export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return null;
  }
  // 控制字符 / 反斜杠只查 ? / # 之前的路径部分("/\t/evil.com" 会被浏览器当成 //evil.com);
  // 查询串里的 \ 和换行(搜索词、富文本参数)跑不出本站,整段拒掉会把正常回跳丢成默认页。
  const cut = path.search(/[?#]/);
  const pathname = cut === -1 ? path : path.slice(0, cut);
  if (safeSitePath(pathname) === null) return null;
  // 解析后是否还在本站,按整段地址判断
  try {
    const base = 'http://same-origin.invalid';
    if (new URL(path, base).origin !== base) return null;
  } catch {
    return null;
  }
  if (path.startsWith(LOGIN_PATH)) return null;
  return path;
}

function currentPath(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search;
}

/** 登录页地址,带上登录后要回到的页面(默认当前页)。 */
export function loginHref(returnTo: string = currentPath()): string {
  const safe = safeRedirectPath(returnTo);
  return safe ? `${LOGIN_PATH}?redirect=${encodeURIComponent(safe)}` : LOGIN_PATH;
}

/** 记住回跳地址(OAuth 等会丢失 query 的跳转前调用)。 */
export function rememberRedirect(returnTo: string = currentPath()): void {
  const safe = safeRedirectPath(returnTo);
  if (!safe || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, safe);
  } catch {
    /* 隐私模式等不可用时忽略,回跳退回默认页 */
  }
}

/** 取出并清除回跳地址:优先 URL 上的 ?redirect=,其次 sessionStorage,最后默认页。 */
export function consumeRedirect(fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (typeof window === 'undefined') return fallback;
  const fromQuery = safeRedirectPath(new URLSearchParams(window.location.search).get('redirect'));
  let fromStorage: string | null = null;
  try {
    fromStorage = safeRedirectPath(sessionStorage.getItem(STORAGE_KEY));
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return fromQuery ?? fromStorage ?? fallback;
}
