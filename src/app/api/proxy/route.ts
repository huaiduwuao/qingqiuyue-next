import { NextRequest, NextResponse } from 'next/server';
import { proxyRequest } from '@/apis/stream-proxy';

// 流媒体防盗链代理:GET /api/proxy?url=xxx
// 转发 m3u8 / ts 分片,按平台注入 Referer;m3u8 内分片路径重写为同源代理地址。
// 注意:proxyRequest 内部对非法/内网地址已做 SSRF 防护(isAllowed)。

// 关闭 Next 默认的 body 解析与缓存,流式透传
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url') || '';
  if (!url) {
    return new NextResponse('missing url', { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const result = await proxyRequest(url, origin);

  if (result.code !== 0) {
    return new NextResponse(result.msg || 'proxy error', { status: result.code });
  }

  const headers = new Headers();
  headers.set('Content-Type', result.contentType || 'application/octet-stream');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Cache-Control', 'public, max-age=300');

  // body 可能是 string(重写后的 m3u8 文本)或 ReadableStream(ts 分片/二进制流)
  const body = result.body as BodyInit;
  return new NextResponse(body, { status: 200, headers });
}
