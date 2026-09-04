// 通用流解析入口:解析引擎已下沉到后端 content-api(配置驱动,Doris module_stream_parser)。
// 本模块只做转发;后端不可用时降级用本地默认解析器跑同一套逻辑。
//
// 走同源相对路径,由 next.config.ts 的 dev rewrites(或生产环境 nginx/APISIX)代理到真后端,
// 与本仓库其余 API 客户端(src/lib/api/client.ts 等)保持一致的连接方式,避免跨域和端口硬编码。
const BACKEND = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

interface StreamParser {
  id: number;
  name: string;
  platform: string;
  url_pattern: string;
  api_endpoint: string;
  method: string;
  headers: string;
  params_template: string;
  response_parse_script: string;
  priority: number;
}

function getDefaultParsers(): StreamParser[] {
  return [
    {
      id: 1,
      name: '芒果TV',
      platform: 'mgtv',
      url_pattern: String.raw`(mgtv\.com|www\.mgtv\.com)/b/(\d+)/(\d+)`,
      api_endpoint: 'https://pcweb.api.mgtv.com/video/streamList',
      method: 'GET',
      headers: JSON.stringify({
        'Origin': 'https://www.mgtv.com',
        'Referer': 'https://www.mgtv.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }),
      params_template: JSON.stringify({
        'playType': '1', 'auth_mode': '1', 'definitionType': '2', 'video_id': '$3',
        'did': '$random32', 'suuid': '$random36', 'vf': 'av01,h265,h264', 'type': 'pch5',
        '_support': '10000000', 'src': 'mgtv', 'abroad': '0', 'appVersion': '9.0.4'
      }),
      response_parse_script: JSON.stringify({
        'streamsExpr': 'data.stream.concat(data.stream_h265)',
        'urlPath': 'item.url',
        'qualityPath': 'item.standardName',
        'needpayPath': 'item.needPay',
        'domainPath': 'data.stream_domain[0]',
        'playableMatch': ['.m3u8', 'm3u8?', '/atcl?', 'pm2='],
        'resolve': {
          'match': ['/atcl?', 'pm2='],
          'headers': { 'Referer': 'https://www.mgtv.com/' },
          'urlField': 'info',
          'finalExt': '.m3u8'
        }
      }),
      priority: 10
    }
  ];
}

function generateRandomId(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

function getNestedValue(obj: any, path: string): any {
  if (!path || !obj) return undefined;
  let result = obj;
  for (const part of path.split('.')) {
    if (result == null) return undefined;
    const indexMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (indexMatch) {
      result = result[indexMatch[1]];
      if (Array.isArray(result)) result = result[parseInt(indexMatch[2])];
    } else {
      result = result[part];
    }
  }
  return result;
}

function extractParams(parser: StreamParser, url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const matches = url.match(new RegExp(parser.url_pattern));
  if (!matches) return params;
  const template = JSON.parse(parser.params_template);
  for (const [key, value] of Object.entries(template)) {
    let v = value as string;
    if (typeof v === 'string') {
      for (let i = 1; i < matches.length; i++) v = v.replace(`$${i}`, matches[i] || '');
      v = v.replace('$random32', generateRandomId(32)).replace('$random36', generateRandomId(36));
    }
    if (v) params[key] = v;
  }
  return params;
}

async function resolveDispatchUrl(dispatchUrl: string, cfg: any): Promise<string> {
  try {
    const resp = await fetch(dispatchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', ...(cfg.headers || {}) }
    });
    if (!resp.ok) return dispatchUrl;
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('mpegurl') || ct.includes('octet-stream')) return dispatchUrl;
    const json: any = await resp.json().catch(() => null);
    const real = cfg.urlField ? getNestedValue(json, cfg.urlField) : null;
    return real && typeof real === 'string' && real.startsWith('http') ? real : dispatchUrl;
  } catch {
    return dispatchUrl;
  }
}

async function extractStreams(parser: StreamParser, apiResponse: any): Promise<any[]> {
  const script = JSON.parse(parser.response_parse_script);
  const data = apiResponse.data || apiResponse;
  let items: any[] = [];
  if (script.streamsExpr.includes('concat')) {
    const m = script.streamsExpr.match(/data\.(\w+)\.concat\(data\.(\w+)\)/);
    if (m) items = [...(getNestedValue(data, m[1]) || []), ...(getNestedValue(data, m[2]) || [])];
  } else {
    items = getNestedValue(data, script.streamsExpr.replace(/^data\./, '')) || [];
  }
  if (!Array.isArray(items)) return [];

  const domain = script.domainPath ? getNestedValue(data, script.domainPath.replace(/^data\./, '')) : '';
  const patterns: string[] = script.playableMatch?.length ? script.playableMatch : ['.m3u8', 'm3u8?', '.mp4', '/atcl?', 'pm2='];
  const isPlayable = (u: string) => u && patterns.some(p => u.includes(p));

  const raw = items.map((item: any) => {
    let url = '';
    const dispInfo = item.disp?.info || '';
    if (dispInfo) url = dispInfo;
    else {
      url = getNestedValue(item, script.urlPath.replace(/^item\./, '')) || '';
      if (url && !url.startsWith('http') && domain) url = domain + url;
    }
    const quality = getNestedValue(item, (script.qualityPath || '').replace(/^item\./, '')) || '';
    const resolution = item.videoWidth && item.videoHeight ? `${item.videoWidth}x${item.videoHeight}` : '';
    const needPay = getNestedValue(item, (script.needpayPath || '').replace(/^item\./, ''));
    return { quality: quality || resolution, resolution, url, needPay: needPay === 1 || needPay === true, format: 'm3u8' };
  }).filter((s: any) => isPlayable(s.url));

  if (script.resolve?.match?.length && script.resolve.urlField) {
    const finalExt = script.resolve.finalExt || '.m3u8';
    await Promise.all(raw.map(async (s: any) => {
      if (s.url && !s.url.includes(finalExt) && script.resolve.match.some((m: string) => s.url.includes(m))) {
        s.url = await resolveDispatchUrl(s.url, script.resolve);
      }
    }));
    return raw.filter((s: any) => s.url && s.url.includes(finalExt));
  }
  return raw;
}

/**
 * 解析视频流
 * GET /api/stream?url=xxx
 */
export async function parseStream(url: string) {
  // 1) 后端统一实时解析(缓存+平台分发:配置驱动/代码层/浏览器层)。推荐页短视频/短剧第一集走这里。
  try {
    const resp = await fetch(`${BACKEND}/api/content/stream/resolve?url=${encodeURIComponent(url)}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    if (resp.ok) {
      const data = await resp.json();
      // 兼容:后端未解析出流时返回 code=200 但 streams 为空,交给本地降级再试一次
      if (data?.data?.streams?.length) return data;
    }
  } catch (e) {
    console.error('[stream] backend parse failed, fallback to local:', e);
  }

  // 2) 降级:本地默认解析器
  try {
    const parsers = getDefaultParsers().sort((a, b) => a.priority - b.priority);
    const urlNoProto = url.replace(/^https?:\/\//, '');
    let matched: StreamParser | null = null;
    for (const p of parsers) {
      if (new RegExp(p.url_pattern).test(urlNoProto) || new RegExp(p.url_pattern).test(url)) { matched = p; break; }
    }
    if (!matched) {
      return { code: 404, msg: '不支持的URL平台', data: { url } };
    }

    const params = extractParams(matched, urlNoProto);
    const headers = JSON.parse(matched.headers);
    let apiResponse: any;
    if (matched.method === 'POST') {
      apiResponse = await fetch(matched.api_endpoint, { method: 'POST', headers, body: JSON.stringify(params) }).then(r => r.json());
    } else {
      const qs = new URLSearchParams(params).toString();
      const apiUrl = matched.api_endpoint.includes('?') ? `${matched.api_endpoint}&${qs}` : `${matched.api_endpoint}?${qs}`;
      apiResponse = await fetch(apiUrl, { headers }).then(r => r.json());
    }

    const streams = await extractStreams(matched, apiResponse);
    if (streams.length === 0) {
      return { code: 0, msg: '该视频可能需要VIP或无法解析', data: { url, platform: matched.platform, streams: [] } };
    }
    streams.sort((a, b) => (parseInt((b.resolution || '0').split('x')[0]) || 0) - (parseInt((a.resolution || '0').split('x')[0]) || 0));
    return {
      code: 0, msg: 'success',
      data: { url, platform: matched.platform, platformName: matched.name, streams, defaultStream: streams[0] }
    };
  } catch (error) {
    return { code: 500, msg: `解析失败: ${error instanceof Error ? error.message : '未知错误'}` };
  }
}
