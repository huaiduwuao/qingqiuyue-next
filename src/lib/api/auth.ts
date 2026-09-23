// 登录会话令牌的唯一读写口 + 带会话的裸 fetch。
//
// 此前 13 处各自 localStorage.getItem('session_id') || getItem('token'):登出只清 session_id,
// 这些地方却还会捡起早就没人写的旧 'token' 键继续发请求;裸 fetch 收到 401 也不通知 AuthContext,
// 会话过期后页面还显示已登录。现在统一从这里读,axios 之外的请求走 authFetch。

export const SESSION_KEY = 'session_id';
/** 很早以前的登录写的键,现在没人写了,只在登出时顺手清掉 */
const LEGACY_TOKEN_KEY = 'token';

/**
 * 会话失效事件:带着会话的请求收到 401 时在 window 上派发,AuthContext 据此复核并清掉本地会话。
 * 不带会话的请求(登录接口本身、匿名浏览)返回 401 不派发。
 */
export const AUTH_EXPIRED_EVENT = 'auth:expired';

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(SESSION_KEY) || null;
  } catch {
    return null;
  }
}

/** 登录写入 / 登出清除(null)。清除时连旧 'token' 键一起删。 */
export function setAuthToken(sessionId: string | null): void {
  try {
    if (sessionId) localStorage.setItem(SESSION_KEY, sessionId);
    else localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    /* 隐私模式等不可用时只保留内存态 */
  }
}

export function notifyAuthExpired(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

/** { Authorization: 'Bearer …' },没登录时是空对象。 */
export function authHeaders(): Record<string, string> {
  const t = getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/**
 * 带会话的 fetch:自动补 Authorization(调用方自己给了就不覆盖),
 * 带着会话却收到 401 时派发 AUTH_EXPIRED_EVENT。其余行为和 fetch 完全一样(不抛 HTTP 错误)。
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAuthToken();
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401 && headers.has('Authorization')) notifyAuthExpired();
  return res;
}
