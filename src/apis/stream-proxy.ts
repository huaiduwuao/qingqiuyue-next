// 流媒体防盗链代理:转发 m3u8 / ts 分片,注入平台 Referer,绕过 CORS+防盗链。
// m3u8 文本内的相对分片路径会被重写成代理地址,保证整条链路都走同源。

// 平台域 → 需要的 Referer
const REFERER_MAP: Array<[RegExp, string]> = [
  [/mgtv\.com/, 'https://www.mgtv.com/'],
  [/bilibili\.com|bilivideo\.com|hdslb\.com/, 'https://www.bilibili.com/'],
  [/qq\.com|gtimg\.com/, 'https://v.qq.com/'],
  [/163\.com|126\.net/, 'https://music.163.com/'],
  [/huya\.com/, 'https://www.huya.com/'],
];

function refererFor(url: string): string {
  for (const [re, ref] of REFERER_MAP) {
    if (re.test(url)) return ref;
  }
  return '';
}

function isAllowed(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * 流媒体代理
 * GET /api/proxy?url=xxx
 */
export async function proxyRequest(url: string, origin: string) {
  if (!isAllowed(url)) {
    return { code: 403, msg: '非法目标地址' };
  }

  const referer = refererFor(url);
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  if (referer) {
    headers['Referer'] = referer;
    headers['Origin'] = referer.replace(/\/$/, '');
  }

  let resp: Response;
  try {
    resp = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  } catch {
    return { code: 502, msg: '上游请求失败' };
  }

  if (!resp.ok) {
    return { code: resp.status, msg: `上游返回 ${resp.status}` };
  }

  const contentType = resp.headers.get('content-type') || '';
  const isM3u8 = contentType.includes('mpegurl') ||
    contentType.includes('application/vnd.apple') ||
    /\.m3u8(\?|$)/i.test(url);

  if (isM3u8) {
    const text = await resp.text();
    const rewritten = rewriteM3u8(text, url, origin);
    return {
      code: 0,
      contentType: 'application/vnd.apple.mpegurl',
      body: rewritten,
    };
  }

  const body = resp.body;
  return {
    code: 0,
    contentType: contentType || 'video/mp2t',
    body,
  };
}

// 把 m3u8 里的分片/子播放列表地址改写成走代理的绝对地址
function rewriteM3u8(text: string, baseUrl: string, origin: string): string {
  const base = new URL(baseUrl);
  const lines = text.split('\n');
  const out: string[] = [];

  for (let line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('#') && trimmed.includes('URI="')) {
      out.push(line.replace(/URI="([^"]+)"/g, (_m, uri) => {
        const abs = resolveUrl(uri, base);
        return `URI="${toProxy(abs, origin)}"`;
      }));
      continue;
    }

    if (trimmed.startsWith('#') || trimmed === '') {
      out.push(line);
      continue;
    }

    const abs = resolveUrl(trimmed, base);
    out.push(toProxy(abs, origin));
  }
  return out.join('\n');
}

function resolveUrl(uri: string, base: URL): string {
  if (/^https?:\/\//i.test(uri)) return uri;
  try {
    return new URL(uri, base).toString();
  } catch {
    return uri;
  }
}

function toProxy(absUrl: string, origin: string): string {
  return `${origin}/api/proxy?url=${encodeURIComponent(absUrl)}`;
}
