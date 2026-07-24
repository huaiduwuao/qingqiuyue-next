import { NextRequest, NextResponse } from 'next/server';

// 运行时缓存配置
let configCache: StreamParser[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

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
  m3u8_url_field: string;
  quality_field: string;
  quality_sort_key: string;
  priority: number;
}

interface ParsedConfig {
  headers: Record<string, string>;
  params: Record<string, string>;
  extractors: {
    streamsExpr: string;
    urlPath: string;
    qualityPath: string;
    resPath?: string;
    needpayPath?: string;
    domainPath?: string;
  };
}

/**
 * 获取解析器配置（带缓存）
 */
async function getParsers(): Promise<StreamParser[]> {
  const now = Date.now();
  if (configCache && now - cacheTime < CACHE_TTL) {
    return configCache;
  }

  try {
    // 通过 content-api 后端查询配置
    const resp = await fetch('http://10.9.1.2:8080/api/content/stream-parser/list', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (resp.ok) {
      const data = await resp.json();
      configCache = data.data || [];
      cacheTime = now;
      return configCache!;
    }
  } catch (e) {
    console.error('Failed to fetch parsers from backend:', e);
  }

  // Fallback: 返回内置默认配置
  return getDefaultParsers();
}

function getDefaultParsers(): StreamParser[] {
  return [
    {
      id: 1,
      name: '芒果TV',
      platform: 'mgtv',
      url_pattern: 'mgtv\\.com/b/(\\d+)/(\\d+)',
      api_endpoint: 'https://pcweb.api.mgtv.com/video/streamList',
      method: 'GET',
      headers: JSON.stringify({
        'Origin': 'https://www.mgtv.com',
        'Referer': 'https://www.mgtv.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }),
      params_template: JSON.stringify({
        'playType': '1',
        'auth_mode': '1',
        'definitionType': '2',
        'definition': '2',
        'video_id': '$2',
        'did': '$random32',
        'suuid': '$random36',
        'vf': 'av01,h265,h264',
        'type': 'pch5',
        '_support': '10000000',
        'src': 'mgtv',
        'abroad': '0',
        'appVersion': '9.0.4'
      }),
      response_parse_script: JSON.stringify({
        'streamsExpr': 'data.stream.concat(data.stream_h265)',
        'urlPath': 'item.url',
        'qualityPath': 'item.standardName',
        'resPath': 'item.videoWidth + "x" + item.videoHeight',
        'needpayPath': 'item.needPay',
        'domainPath': 'data.stream_domain[0]'
      }),
      m3u8_url_field: 'url',
      quality_field: 'resolution',
      quality_sort_key: 'resolution',
      priority: 10
    },
    {
      id: 2,
      name: 'B站',
      platform: 'bilibili',
      url_pattern: 'bilibili\\.com/video/(BV[\\w]+|av\\d+)',
      api_endpoint: 'https://api.bilibili.com/x/player/playurl',
      method: 'GET',
      headers: JSON.stringify({
        'Origin': 'https://www.bilibili.com',
        'Referer': 'https://www.bilibili.com/',
        'User-Agent': 'Mozilla/5.0'
      }),
      params_template: JSON.stringify({
        'avid': '$bv_or_av',
        'cid': '$cid',
        'qn': '127',
        'fnval': '4048',
        'fnver': '0',
        'fourk': '1'
      }),
      response_parse_script: JSON.stringify({
        'streamsExpr': 'data.dash.video',
        'urlPath': 'item.baseUrl',
        'qualityPath': 'item.new_description',
        'resPath': 'item.width + "x" + item.height'
      }),
      m3u8_url_field: 'url',
      quality_field: 'quality',
      quality_sort_key: 'quality',
      priority: 20
    },
    {
      id: 3,
      name: '腾讯视频',
      platform: 'qq',
      url_pattern: 'v\\.qq\\.com.*?vid=([^&]+)',
      api_endpoint: 'https://vd.l.qq.com/proxyhttp',
      method: 'POST',
      headers: JSON.stringify({
        'Origin': 'https://v.qq.com',
        'Referer': 'https://v.qq.com/',
        'Content-Type': 'application/json'
      }),
      params_template: JSON.stringify({ 'vid': '$vid' }),
      response_parse_script: JSON.stringify({
        'streamsExpr': 'data.vinfo.adlist[0].transcode',
        'urlPath': 'item.cdns[0].url',
        'qualityPath': 'item.qualitylabel'
      }),
      m3u8_url_field: 'url',
      quality_field: 'quality',
      quality_sort_key: 'quality',
      priority: 30
    },
    {
      id: 4,
      name: '网易云音乐',
      platform: 'music163',
      url_pattern: 'music\\.163\\.com/song\\?id=(\\d+)',
      api_endpoint: 'https://music.163.com/api/song/enhance/play/url',
      method: 'GET',
      headers: JSON.stringify({
        'Referer': 'https://music.163.com/',
        'User-Agent': 'Mozilla/5.0'
      }),
      params_template: JSON.stringify({ 'ids': '[$song_id]', 'br': '320000' }),
      response_parse_script: JSON.stringify({
        'streamsExpr': 'data',
        'urlPath': 'item.url',
        'qualityPath': 'item.br'
      }),
      m3u8_url_field: 'url',
      quality_field: 'quality',
      quality_sort_key: 'quality',
      priority: 40
    },
    {
      id: 5,
      name: '虎牙直播',
      platform: 'huya',
      url_pattern: 'huya\\.com/(\\w+)',
      api_endpoint: 'https://www.huya.com/live-share/live-detail',
      method: 'GET',
      headers: JSON.stringify({
        'Referer': 'https://www.huya.com/',
        'User-Agent': 'Mozilla/5.0'
      }),
      params_template: JSON.stringify({ 'do': 'getLiveShareInfo', 'roomId': '$room_id' }),
      response_parse_script: JSON.stringify({
        'streamsExpr': 'data.stream',
        'urlPath': 'item.url',
        'qualityPath': 'item.name'
      }),
      m3u8_url_field: 'url',
      quality_field: 'quality',
      quality_sort_key: 'quality',
      priority: 50
    }
  ];
}

/**
 * 匹配 URL 对应的解析器
 */
function matchParser(parsers: StreamParser[], url: string): StreamParser | null {
  for (const parser of parsers) {
    try {
      const regex = new RegExp(parser.url_pattern);
      if (regex.test(url)) {
        return parser;
      }
    } catch (e) {
      console.error(`Invalid regex for parser ${parser.platform}:`, e);
    }
  }
  return null;
}

/**
 * 提取 URL 中的参数
 */
function extractParams(parser: StreamParser, url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const regex = new RegExp(parser.url_pattern);
  const matches = url.match(regex);

  if (!matches) return params;

  const template = JSON.parse(parser.params_template);
  for (const [key, value] of Object.entries(template)) {
    let v = value as string;
    if (typeof v === 'string') {
      // 替换 $1, $2 等捕获组
      for (let i = 1; i < matches.length; i++) {
        v = v.replace(`$${i}`, matches[i] || '');
      }
      // 替换特殊变量
      v = v.replace('$random32', generateRandomId(32));
      v = v.replace('$random36', generateRandomId(36));
      // 提取 bv_or_av
      if (v === '$bv_or_av' && matches[1]) {
        v = matches[1].startsWith('BV') ? matches[1] : matches[1].replace('av', '');
      }
      // 歌曲 ID
      if (v === '$song_id' && matches[1]) {
        v = matches[1];
      }
      // 房间 ID
      if (v === '$room_id' && matches[1]) {
        v = matches[1];
      }
    }
    if (v && v !== '') {
      params[key] = v;
    }
  }
  return params;
}

/**
 * 解析响应，提取流信息
 */
function extractStreams(parser: StreamParser, apiResponse: any): any[] {
  try {
    const script = JSON.parse(parser.response_parse_script);
    const { streamsExpr, urlPath, qualityPath, resPath, needpayPath, domainPath } = script;

    // 使用简单的路径表达式解析
    const data = apiResponse.data || apiResponse;
    const streamsExprClean = streamsExpr.replace(/^data\./, '');

    // 分割表达式
    const parts = streamsExprClean.split('.');
    let items: any[] = [];

    // 简单处理: data.stream.concat(data.stream_h265)
    if (streamsExpr.includes('concat')) {
      const concatMatch = streamsExpr.match(/data\.(\w+)\.concat\(data\.(\w+)\)/);
      if (concatMatch) {
        const arr1 = getNestedValue(data, concatMatch[1]) || [];
        const arr2 = getNestedValue(data, concatMatch[2]) || [];
        items = [...arr1, ...arr2];
      }
    } else {
      items = getNestedValue(data, streamsExpr) || [];
    }

    if (!Array.isArray(items)) return [];

    const domain = domainPath ? getNestedValue(data, domainPath) : '';

    return items.map((item: any) => {
      const url = getNestedValue(item, urlPath) || '';
      const quality = getNestedValue(item, qualityPath) || '';
      const resolution = resPath ? getNestedValue(item, resPath) || '' : '';
      const needPay = needpayPath ? getNestedValue(item, needpayPath) : false;

      // 构建完整 URL
      let fullUrl = url;
      if (url && !url.startsWith('http') && domain) {
        fullUrl = domain + url;
      }

      return {
        quality: quality || resolution,
        resolution: resolution,
        url: fullUrl,
        needPay: needPay === 1 || needPay === true,
        format: 'm3u8'
      };
    }).filter((s: any) => s.url && s.url.length > 10);
  } catch (e) {
    console.error('Parse streams error:', e);
    return [];
  }
}

/**
 * 获取嵌套属性值
 */
function getNestedValue(obj: any, path: string): any {
  if (!path || !obj) return undefined;
  const parts = path.split('.');

  // 处理数组索引如 items[0]
  const current = parts[0].replace(/\[\d+\]/, '');
  const indexMatch = parts[0].match(/\[(\d+)\]/);
  let result = obj[current];

  if (indexMatch && Array.isArray(result)) {
    result = result[parseInt(indexMatch[1])];
  }

  for (let i = 1; i < parts.length; i++) {
    if (result == null) return undefined;
    const part = parts[i].replace(/\[\d+\]/, '');
    result = result[part];
  }
  return result;
}

/**
 * 生成随机 ID
 */
function generateRandomId(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * 通用流解析 API
 * GET /api/stream?url=xxx
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { code: 400, msg: '缺少 url 参数' },
      { status: 400 }
    );
  }

  try {
    // 获取解析器配置
    const parsers = await getParsers();

    // 匹配解析器
    const parser = matchParsers(parsers, url);
    if (!parser) {
      return NextResponse.json({
        code: 404,
        msg: '不支持的URL平台',
        data: { url, supportedPlatforms: parsers.map(p => p.platform) }
      });
    }

    // 提取参数
    const params = extractParamsFromParser(parser, url);

    // 调用平台 API
    const headers = JSON.parse(parser.headers);
    let apiResponse: any;

    if (parser.method === 'POST') {
      apiResponse = await fetch(parser.api_endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(params)
      }).then(r => r.json());
    } else {
      const queryString = new URLSearchParams(params).toString();
      const apiUrl = parser.api_endpoint.includes('?')
        ? `${parser.api_endpoint}&${queryString}`
        : `${parser.api_endpoint}?${queryString}`;

      apiResponse = await fetch(apiUrl, { headers }).then(r => r.json());
    }

    // 提取流
    const streams = extractStreamsFromParser(parser, apiResponse);

    if (streams.length === 0) {
      return NextResponse.json({
        code: 0,
        msg: '该视频可能需要VIP或无法解析',
        data: { url, platform: parser.platform, streams: [] }
      });
    }

    // 按分辨率排序
    streams.sort((a, b) => {
      const aRes = parseInt((a.resolution || '0').split('x')[0]) || 0;
      const bRes = parseInt((b.resolution || '0').split('x')[0]) || 0;
      return bRes - aRes;
    });

    return NextResponse.json({
      code: 0,
      msg: 'success',
      data: {
        url,
        platform: parser.platform,
        platformName: parser.name,
        streams,
        defaultStream: streams[0]
      }
    });

  } catch (error) {
    console.error('Stream parse error:', error);
    return NextResponse.json(
      { code: 500, msg: `解析失败: ${error instanceof Error ? error.message : '未知错误'}` },
      { status: 500 }
    );
  }
}

// 辅助函数
function matchParsers(parsers: StreamParser[], url: string): StreamParser | null {
  for (const parser of parsers.sort((a, b) => a.priority - b.priority)) {
    try {
      const regex = new RegExp(parser.url_pattern);
      if (regex.test(url)) {
        return parser;
      }
    } catch (e) {
      // ignore
    }
  }
  return null;
}

function extractParamsFromParser(parser: StreamParser, url: string): Record<string, string> {
  const params: Record<string, string> = {};
  try {
    const regex = new RegExp(parser.url_pattern);
    const matches = url.match(regex);
    if (!matches) return params;

    const template = JSON.parse(parser.params_template);
    for (const [key, value] of Object.entries(template)) {
      let v = value as string;
      if (typeof v === 'string') {
        for (let i = 1; i < matches.length; i++) {
          v = v.replace(`$${i}`, matches[i] || '');
        }
        v = v.replace('$random32', generateRandomId(32));
        v = v.replace('$random36', generateRandomId(36));
        if (v === '$bv_or_av' && matches[1]) {
          v = matches[1].startsWith('BV') ? matches[1] : matches[1].replace('av', '');
        }
        if (v === '$song_id' && matches[1]) v = matches[1];
        if (v === '$room_id' && matches[1]) v = matches[1];
      }
      if (v && v !== '') params[key] = v;
    }
  } catch (e) {
    console.error('Extract params error:', e);
  }
  return params;
}

function extractStreamsFromParser(parser: StreamParser, apiResponse: any): any[] {
  try {
    const script = JSON.parse(parser.response_parse_script);
    const { streamsExpr, urlPath, qualityPath, resPath, needpayPath, domainPath } = script;
    const data = apiResponse.data || apiResponse;

    let items: any[] = [];
    if (streamsExpr.includes('concat')) {
      const concatMatch = streamsExpr.match(/data\.(\w+)\.concat\(data\.(\w+)\)/);
      if (concatMatch) {
        const arr1 = getNestedValue(data, concatMatch[1]) || [];
        const arr2 = getNestedValue(data, concatMatch[2]) || [];
        items = [...arr1, ...arr2];
      }
    } else {
      items = getNestedValue(data, streamsExpr) || [];
    }

    if (!Array.isArray(items)) return [];

    const domain = domainPath ? getNestedValue(data, domainPath) : '';

    return items.map((item: any) => {
      const url = getNestedValue(item, urlPath) || '';
      const quality = getNestedValue(item, qualityPath) || '';
      const resolution = resPath ? getNestedValue(item, resPath) || '' : '';
      const needPay = needpayPath ? getNestedValue(item, needpayPath) : false;

      let fullUrl = url;
      if (url && !url.startsWith('http') && domain) {
        fullUrl = domain + url;
      }

      return {
        quality: quality || resolution,
        resolution: resolution,
        url: fullUrl,
        needPay: needPay === 1 || needPay === true,
        format: 'm3u8'
      };
    }).filter((s: any) => s.url && s.url.length > 10);
  } catch (e) {
    console.error('Extract streams error:', e);
    return [];
  }
}
