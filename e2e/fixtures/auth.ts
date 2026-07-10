import type { APIRequestContext } from '@playwright/test';

export const AUTH_COOKIE = 'auth-token'; // 与 AuthContext.login 一致（proxy.ts 读它）
export const LS_KEY = 'token'; // account/* 客户端守卫读它（AuthContext.checkAuth）

export interface Creds {
  name: string;
  password: string;
}

/**
 * 直接打后端登录接口拿 token（同源 → next rewrites → 网关）。
 * accountLogin → POST /api/core/login，响应 { code, msg, data: { token, user } }。
 */
export async function loginViaApi(request: APIRequestContext, { name, password }: Creds): Promise<string> {
  const res = await request.post('/api/core/login', { data: { name, password } });
  const json = await res.json().catch(() => ({} as any));
  // 后端 code 0 或 200 均表成功（与 client.ts 拦截器一致）；msg 可能是 'success'
  const code = json?.code;
  const ok = !!json?.data?.token && (code === 200 || code === '200' || code === 0 || code === '0');
  if (!ok) {
    throw new Error(`登录失败：HTTP ${res.status()} code=${code} msg=${json?.msg}`);
  }
  return json.data.token as string;
}

/**
 * 构造 storageState：同时写 cookie[auth-token] + localStorage.token。
 * - cookie：供 Next 16 src/proxy.ts 放行 /system、/admin 等非白名单路径。
 * - localStorage：供 /account、/user 等白名单路径的客户端 AuthContext.checkAuth。
 * 二者缺一不可。cookie domain=localhost 让 app 域可读（勿绑网关 IP）。
 */
export function buildStorageState(token: string, origin = 'http://localhost:3000') {
  const expires = Math.floor(Date.now() / 1000) + 86400; // 对齐 AuthContext max-age=86400
  return {
    cookies: [
      {
        name: AUTH_COOKIE,
        value: token,
        domain: 'localhost',
        path: '/',
        expires,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [{ origin, localStorage: [{ name: LS_KEY, value: token }] }],
  };
}
