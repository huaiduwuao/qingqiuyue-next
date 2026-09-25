/**
 * 流解析规则(客户端本地解析 + 服务端解析共用一份)。
 *
 * 客户端(安卓 / Windows / macOS)在用户自己的设备上、用用户自己的 IP 调源站接口拿播放地址,
 * 再用本站播放器播放 —— 视频不经本站服务器,也不再是一个吞掉触摸的跨域 iframe。
 * 网页端没有原生请求能力(浏览器不许页面自己设 Referer / Origin / Cookie),由服务器按同一份规则解析
 * (GET /api/content/stream/rules/resolve),地址交给本站播放器;客户端本地解析失败时也退到服务端。
 *
 * 各站点「怎么解析」全部是数据:服务器下发这份规则(GET /api/content/stream/rules),
 * 客户端按规则执行。源站改了接口/签名/字段,改服务器上的规则即可,不用发版。
 * 原生层(Rust,tauri-plugin-http)只提供一个能力:带任意请求头发 HTTPS 请求 —— 这是浏览器不给的。
 * 能访问哪些域名由客户端打包时的 capabilities 限定(src-tauri/capabilities/default.json),
 * 规则只能在那个范围内选,所以服务端规则被篡改也不能拿客户端去请求任意地址。
 *
 * 取规则的顺序:内存 → 服务器(带本地缓存)→ 本地缓存 → 内置默认(下面的 DEFAULT_RULES)。
 * 内置默认让新功能在后端还没部署时也能用,服务器版本更新后自动覆盖。
 *
 * ⚠️ 每条请求都要显式带 Origin:tauri-plugin-http 会给没带 Origin 的请求补上应用自己的来源
 * (http://tauri.localhost),B 站 nav / pagelist / playurl 对陌生 Origin 一律回 403 的 HTML
 * (2026-09-26 从客户端诊断日志里查出来的)。
 */

import { API_PREFIX } from '@/lib/api/prefix';

/** 模板:{{变量}}、{{m1}}(match 的第 1 个捕获组)、{{now}};过滤器 {{x|basename}} {{x|urlencode}} */
export type Template = string;

export interface SignWbi {
  type: 'wbi';
  imgKey: Template;
  subKey: Template;
  /** mixin key 置换表(64 项) */
  mixin: number[];
}

export interface RuleStep {
  id: string;
  url: Template;
  query?: Record<string, Template>;
  headers?: Record<string, Template>;
  sign?: SignWbi;
  /**
   * 响应不是 JSON 而是网页时:用这个正则在响应文本里找,第 1 个捕获组是 JSON 文本
   * (AcFun 的播放信息内嵌在页面脚本里)。写法要同时是 JS 和 RE2(服务端 Go)都认的。
   */
  regex?: string;
  /** 这些路径上的值是「JSON 字符串」,解析后原地替换(AcFun 的 ksPlayJson) */
  jsonStrings?: string[];
  /** 断言,不满足则整条解析失败(如 code == 0) */
  expect?: { path: string; equals: string | number };
  /** 变量名 → JSON 路径(点号分隔,数组下标用数字:data.0.cid) */
  extract?: Record<string, string>;
  /** 执行后写入该站点 cookie 罐:cookie 名 → 模板 */
  cookies?: Record<string, Template>;
  /** 这一步提取出的变量可复用多久(秒)。游客 cookie、签名密钥这类不必每条视频都拿 */
  reuseSeconds?: number;
}

export interface DashOutput {
  type: 'dash';
  /** 总时长的路径;durationUnit = 'ms' 时按毫秒读 */
  duration?: string;
  durationUnit?: 'ms' | 's';
  video: string;
  audio?: string;
  /** 取字段时依次尝试的键名(源站的驼峰/下划线两套命名) */
  url: string[];
  backup?: string[];
  mime: string[];
  codecs: string[];
  height?: string[];
  init: string[];
  index: string[];
  /** 选画质:不超过这个高度里最高的一档 */
  maxHeight?: number;
}

export interface ProgressiveOutput {
  type: 'progressive';
  duration?: string;
  durationUnit?: 'ms' | 's';
  list: string;
  url: string[];
  backup?: string[];
  height?: string[];
  maxHeight?: number;
}

/** HLS(m3u8)列表:按 maxHeight 挑一档,交给 hls.js / 系统原生 HLS */
export interface HlsOutput {
  type: 'hls';
  duration?: string;
  durationUnit?: 'ms' | 's';
  list: string;
  url: string[];
  backup?: string[];
  height?: string[];
  maxHeight?: number;
}

export type RuleOutput = DashOutput | ProgressiveOutput | HlsOutput;

export interface ProviderRule {
  id: string;
  label: string;
  enabled: boolean;
  /** 源站页面地址的正则(字符串形式),捕获组在模板里是 {{m1}}、{{m2}}… */
  match: string[];
  /** 服务端在 SQL 里粗筛这类页面的 LIKE 模式(推荐召回用);客户端不用 */
  sourceLike?: string[];
  /** 默认请求头(每一步都带,步骤里的同名头覆盖) */
  headers?: Record<string, Template>;
  steps: RuleStep[];
  output: RuleOutput;
  /** 拉媒体文件时的请求头。浏览器 fetch 不带 Referer 先试,失败再走原生请求带上这些头 */
  media?: { headers?: Record<string, Template> };
  /** 解析结果可复用多久(秒),源站地址本身有有效期 */
  cacheSeconds?: number;
}

export interface RuleSet {
  schema: 1;
  version: string;
  providers: ProviderRule[];
}

const BILI_MIXIN = [46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52];
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';

/**
 * 内置默认规则。与后端 internal/streamrules/default_rules.json 保持一致(那边是线上真正下发的版本)。
 * B 站流程(2026-09-25 从中国/美国两处出口实测过):游客 cookie(spi)→ wbi 签名密钥(nav)
 * → cid(pagelist;view 接口会被风控返回 HTML)→ 签名的 wbi/playurl(DASH)。
 * 媒体:mcdn.bilivideo.cn 不带 Referer 可取且带 CORS *,upos-*.bilivideo.com 必须带 B 站 Referer
 * (不校验请求方 IP:服务器解析出的地址在别的设备上照样 206,2026-09-26 实测)。
 * AcFun(2026-09-26 实测):播放信息在页面脚本 window.videoInfo 里,HLS 地址不校验 Referer 且带 CORS *,
 * 网页端 / 客户端都能直接放。
 */
/** B 站投稿:BV 号和 av 号两种地址,除了传给接口的 id 参数名(bvid / aid)以外完全一样 */
function bilibiliProvider(id: string, idParam: 'bvid' | 'aid', match: string, sourceLike: string): ProviderRule {
  return {
    id,
    label: '哔哩哔哩',
    enabled: true,
    match: [match],
    sourceLike: [sourceLike],
    headers: { 'User-Agent': DESKTOP_UA, Referer: 'https://www.bilibili.com/', Origin: 'https://www.bilibili.com' },
    steps: [
      {
        id: 'spi',
        url: 'https://api.bilibili.com/x/frontend/finger/spi',
        expect: { path: 'code', equals: 0 },
        extract: { b3: 'data.b_3', b4: 'data.b_4' },
        cookies: { buvid3: '{{b3}}', buvid4: '{{b4|urlencode}}', b_nut: '{{now}}' },
        reuseSeconds: 86400,
      },
      {
        id: 'nav',
        url: 'https://api.bilibili.com/x/web-interface/nav',
        extract: { imgUrl: 'data.wbi_img.img_url', subUrl: 'data.wbi_img.sub_url' },
        reuseSeconds: 3600,
      },
      {
        id: 'pages',
        url: 'https://api.bilibili.com/x/player/pagelist',
        query: { [idParam]: '{{m1}}' },
        expect: { path: 'code', equals: 0 },
        extract: { cid: 'data.0.cid' },
      },
      {
        id: 'play',
        url: 'https://api.bilibili.com/x/player/wbi/playurl',
        headers: { Origin: 'https://player.bilibili.com', Referer: 'https://player.bilibili.com/' },
        query: {
          [idParam]: '{{m1}}',
          cid: '{{cid}}',
          qn: '80',
          fnver: '0',
          fnval: '16',
          fourk: '0',
          gaia_source: 'external-link',
          from_client: 'BROWSER',
          is_main_page: 'false',
          need_fragment: 'false',
          isGaiaAvoided: 'true',
          web_location: '1315873',
        },
        sign: { type: 'wbi', imgKey: '{{imgUrl|basename}}', subKey: '{{subUrl|basename}}', mixin: BILI_MIXIN },
        expect: { path: 'code', equals: 0 },
      },
    ],
    output: {
      type: 'dash',
      duration: 'data.dash.duration',
      video: 'data.dash.video',
      audio: 'data.dash.audio',
      url: ['baseUrl', 'base_url'],
      backup: ['backupUrl', 'backup_url'],
      mime: ['mimeType', 'mime_type'],
      codecs: ['codecs'],
      height: ['height'],
      init: ['SegmentBase.Initialization', 'segment_base.initialization'],
      index: ['SegmentBase.indexRange', 'segment_base.index_range'],
      maxHeight: 720,
    },
    media: { headers: { 'User-Agent': DESKTOP_UA, Referer: 'https://www.bilibili.com/', Origin: 'https://www.bilibili.com' } },
    cacheSeconds: 1800,
  };
}

export const DEFAULT_RULES: RuleSet = {
  schema: 1,
  version: '2026-09-26.3',
  providers: [
    bilibiliProvider('bilibili', 'bvid', '^https?://(?:www\\.|m\\.)?bilibili\\.com/video/(BV[0-9A-Za-z]{10})', '%bilibili.com/video/BV%'),
    bilibiliProvider('bilibili-av', 'aid', '^https?://(?:www\\.|m\\.)?bilibili\\.com/video/av(\\d+)', '%bilibili.com/video/av%'),
    {
      id: 'acfun',
      label: 'AcFun',
      enabled: true,
      match: ['^https?://(?:www\\.|m\\.)?acfun\\.cn/v/(ac\\d+(?:_\\d+)?)'],
      sourceLike: ['%acfun.cn/v/ac%'],
      headers: { 'User-Agent': DESKTOP_UA, Referer: 'https://www.acfun.cn/', Origin: 'https://www.acfun.cn' },
      steps: [
        {
          id: 'page',
          url: 'https://www.acfun.cn/v/{{m1}}',
          regex: 'window\\.videoInfo\\s*=\\s*(\\{.*?\\});\\s*\\n',
          jsonStrings: ['currentVideoInfo.ksPlayJson'],
          extract: { videoId: 'currentVideoInfo.id' },
        },
      ],
      output: {
        type: 'hls',
        duration: 'currentVideoInfo.durationMillis',
        durationUnit: 'ms',
        list: 'currentVideoInfo.ksPlayJson.adaptationSet.0.representation',
        url: ['url'],
        backup: ['backupUrl'],
        height: ['height'],
        maxHeight: 720,
      },
      media: {},
      cacheSeconds: 1800,
    },
  ],
};

const CACHE_KEY = 'qq:stream-rules';
const REFRESH_MS = 30 * 60 * 1000;
let memo: { rules: RuleSet; at: number } | null = null;
let inflight: Promise<RuleSet> | null = null;

/** 结构校验:服务器那边写入时已经校验过,这里再校一遍,坏规则不执行、退回上一份好的 */
export function validateRules(x: unknown): RuleSet | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as RuleSet;
  if (r.schema !== 1 || typeof r.version !== 'string' || !Array.isArray(r.providers)) return null;
  const providers = r.providers.filter((p) => {
    if (!p || typeof p.id !== 'string' || !Array.isArray(p.match) || !Array.isArray(p.steps) || !p.output) return false;
    try {
      p.match.forEach((m) => new RegExp(m));
      p.steps.forEach((s) => s?.regex && new RegExp(s.regex));
    } catch {
      return false;
    }
    if (!p.steps.every((s) => s && typeof s.id === 'string' && typeof s.url === 'string' && /^https:\/\//.test(s.url))) return false;
    if (p.output.type !== 'dash' && p.output.type !== 'progressive' && p.output.type !== 'hls') return false;
    return true;
  });
  return { schema: 1, version: r.version, providers };
}

function readCache(): RuleSet | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? validateRules(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** 当前生效的规则。拿不到服务器版本时不报错,用缓存或内置默认 */
export async function loadRules(): Promise<RuleSet> {
  if (memo && Date.now() - memo.at < REFRESH_MS) return memo.rules;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(`${API_PREFIX}/api/content/stream/rules`, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const body = await res.json();
        const rules = validateRules(body?.data ?? body);
        if (rules && rules.providers.length) {
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(rules));
          } catch {
            /* 隐私模式 */
          }
          memo = { rules, at: Date.now() };
          return rules;
        }
      }
    } catch {
      /* 离线 / 后端还没有这个接口:往下退 */
    }
    const rules = readCache() ?? DEFAULT_RULES;
    memo = { rules, at: Date.now() };
    return rules;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** 这条源站地址有没有可用的解析规则(同步版,用已加载的规则;没加载过用内置默认) */
export function matchProvider(pageUrl: string, rules: RuleSet = memo?.rules ?? DEFAULT_RULES): { rule: ProviderRule; groups: string[] } | null {
  if (!pageUrl) return null;
  for (const rule of rules.providers) {
    if (!rule.enabled) continue;
    for (const src of rule.match) {
      const m = new RegExp(src).exec(pageUrl);
      if (m) return { rule, groups: m.slice(1) };
    }
  }
  return null;
}
