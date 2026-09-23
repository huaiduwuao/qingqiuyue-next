// 登录后回跳地址的唯一出入口。
//
// 此前 LoginGate 往 sessionStorage 写了 login_redirect,登录页却从不读,登录成功一律
// 跳 /home/recommend;AuthContext 把未登录用户踢去登录页时也不记来源。现在所有
// "去登录"都经 loginHref(),登录/注册成功统一 consumeRedirect()。

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
  // 控制字符(\t \n 等)和反斜杠一律拒:浏览器会把 "/\t/evil.com" 里的 tab 去掉,变成 //evil.com
  if (/[\x00-\x1f\x7f\\]/.test(path)) return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  // 再按浏览器的规则解析一遍,解析完必须还在本站
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
