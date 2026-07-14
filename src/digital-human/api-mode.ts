/**
 * 数字人 API —— 统一透传到 Go 后端数据库
 *
 * 后端路由: /api/realtime/digital-human/*
 * DIGITAL_HUMAN_API_URL: Go 后端 base URL (默认 http://localhost:10005)
 */

export function digitalHumanBaseURL(): string {
  return process.env.DIGITAL_HUMAN_API_URL || 'http://localhost:10005';
}

/** 给 API route 用的辅助:fetch with timeout,失败时抛出 */
export async function fetchDigitalHuman(
  path: string,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const url = `${digitalHumanBaseURL()}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}
