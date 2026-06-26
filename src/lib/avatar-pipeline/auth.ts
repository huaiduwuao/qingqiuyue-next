/**
 * avatar-pipeline auth.ts —— 路由级鉴权
 *
 * 与现有 AuthContext 对齐:auth-token cookie 存在即视为登录。
 * 不做 JWT 签名校验(Go 后端也不做;只查 cookie 是否有)。
 * userId 用 token 的 SHA-256 前 16 hex 当 stable id(同 token 永远同 userId)。
 *
 * 跨用户访问保护:每个 JobState 存 ownerUserId,GET/DELETE 时校验。
 */

import { createHash } from 'crypto';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';

const TOKEN_COOKIE = 'auth-token';

export interface AvatarUser {
  /** 稳定的 userId(SHA-256 前 16 hex) */
  userId: string;
  /** 原始 token(用于子进程环境变量) */
  token: string;
  /** 是不是 admin(目前 avatar pipeline 不区分,预留) */
  isAdmin: boolean;
}

function deriveUserId(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

/**
 * 从 NextRequest(用于 route handler 第一参数 req)读 token。
 * 失败返回 null,handler 应返回 401。
 */
export function getUserFromRequest(req: NextRequest): AvatarUser | null {
  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  return {
    userId: deriveUserId(token),
    token,
    isAdmin: false, // 暂不区分
  };
}

/**
 * 从 Next.js 16 的 cookies() helper 读(用于 server components / server actions)。
 */
export async function getUserFromCookies(): Promise<AvatarUser | null> {
  const store = await cookies();
  const token = store.get(TOKEN_COOKIE)?.value;
  if (!token) return null;
  return {
    userId: deriveUserId(token),
    token,
    isAdmin: false,
  };
}

/** 简单的 401 / 403 响应工厂 */
export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized', msg: '需要登录' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function forbiddenResponse(): Response {
  return new Response(JSON.stringify({ error: 'forbidden', msg: '无权访问该 job' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
