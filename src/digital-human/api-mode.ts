/**
 * api-mode —— 数字人后端模式开关
 *
 * 配置项 (写在 .env.local):
 *   USE_EXTERNAL_DIGITAL_HUMAN_API  true 时由 Go 后端 (realtime-api) 服务
 *                                  false (默认) 由 Next.js 自己用文件系统服务
 *   DIGITAL_HUMAN_API_URL           Go 后端的 base URL,默认 http://localhost:10005
 *
 * 当 USE_EXTERNAL_DIGITAL_HUMAN_API=true 时:
 *   - /api/digital-human/instructions/*        透传到 Go
 *   - /api/digital-human/tools                 透传到 Go
 *   - /api/digital-human/chat                  不变 (chat 仍由 Next.js 内部 LLM/TTS 处理)
 *
 * 后端 Go 路由在:
 *   - D:/git/really/qingqiuyue-go/internal/digitalhuman/router.go
 *   - Mount: /api/realtime/digital-human/* (与 avatarapp 同一 prefix)
 */

export function isExternalDigitalHumanAPI(): boolean {
  // 支持两种写法:
  // 1. NEXT_PUBLIC_USE_EXTERNAL_DIGITAL_HUMAN_API=true (Vercel/Docker)
  // 2. USE_EXTERNAL_DIGITAL_HUMAN_API=true (PM2/直接运行)
  const v = process.env.NEXT_PUBLIC_USE_EXTERNAL_DIGITAL_HUMAN_API ?? process.env.USE_EXTERNAL_DIGITAL_HUMAN_API;
  return v === 'true';
}

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
