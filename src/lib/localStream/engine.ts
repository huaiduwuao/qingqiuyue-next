/**
 * 规则执行器:按服务器下发的规则(见 ./rules)把源站页面地址解析成可播放的媒体地址。
 *
 * 两条路,结果同构(LocalStream):
 *   - 本地(客户端):所有接口请求走原生 HTTP(./native),用的是用户自己的网络和 IP;
 *   - 服务端(网页,或客户端本地失败时的兜底):GET /api/content/stream/rules/resolve,
 *     后端 internal/streamrules/engine.go 按同一份规则解析。
 * resolveStream 负责选路;VideoPlayer 只认 LocalStream。
 */

import { API_PREFIX } from '@/lib/api/prefix';
import { md5 } from './md5';
import { nativeAvailable, nativeFetch } from './native';
import { mediaSourceCtor } from './dash';
import { loadRules, matchProvider, type DashOutput, type HlsOutput, type ProgressiveOutput, type ProviderRule, type RuleStep } from './rules';

export interface DashTrack {
  /** 主地址 + 备用地址,按顺序尝试 */
  urls: string[];
  mime: string;
  codecs: string;
  height?: number;
  /** SegmentBase:初始化段、sidx 索引的字节范围(闭区间) */
  init: [number, number];
  index: [number, number];
}

export type LocalStream =
  | {
      kind: 'dash';
      provider: string;
      duration: number;
      video: DashTrack;
      /** 全部候选视频轨(按画质偏好排序);服务端解析时由本机挑第一条能解码的 */
      videos?: DashTrack[];
      audio?: DashTrack;
      mediaHeaders: Record<string, string>;
      expiresAt?: number;
      source?: 'local' | 'server';
    }
  | { kind: 'progressive'; provider: string; duration: number; urls: string[]; mediaHeaders: Record<string, string>; expiresAt?: number; source?: 'local' | 'server' }
  | { kind: 'hls'; provider: string; duration: number; urls: string[]; mediaHeaders: Record<string, string>; expiresAt?: number; source?: 'local' | 'server' };

type Vars = Record<string, string>;

/** 每个站点一份:cookie 罐 + 可复用的步骤变量(游客 cookie、签名密钥) */
const sessions = new Map<string, { cookies: Record<string, string>; reuse: Map<string, { vars: Vars; until: number }> }>();
const resolved = new Map<string, { stream: LocalStream; until: number }>();

function session(id: string) {
  let s = sessions.get(id);
  if (!s) {
    s = { cookies: {}, reuse: new Map() };
    sessions.set(id, s);
  }
  return s;
}

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const k of path.split('.')) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

/** 把 path 处的值替换掉(父节点必须是对象或数组) */
function setPath(obj: unknown, path: string, val: unknown): boolean {
  const parts = path.split('.');
  const last = parts.pop();
  if (last === undefined) return false;
  const parent = parts.length ? getPath(obj, parts.join('.')) : obj;
  if (!parent || typeof parent !== 'object') return false;
  (parent as Record<string, unknown>)[last] = val;
  return true;
}

function firstPath(obj: unknown, paths: string[] | undefined): unknown {
  for (const p of paths ?? []) {
    const v = getPath(obj, p);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

export function render(tpl: string, vars: Vars): string {
  return tpl.replace(/\{\{\s*([\w.]+)(?:\|(\w+))?\s*\}\}/g, (_, name: string, filter?: string) => {
    let v = name === 'now' ? String(Math.floor(Date.now() / 1000)) : vars[name] ?? '';
    if (filter === 'basename') v = v.split('/').pop()?.split('.')[0] ?? '';
    else if (filter === 'urlencode') v = encodeURIComponent(v);
    return v;
  });
}

/** B 站 wbi 签名:参数按键排序、去掉 !'()* 后编码,加 wts,w_rid = md5(串 + mixin key) */
export function wbiQuery(params: Record<string, string>, imgKey: string, subKey: string, mixin: number[]): string {
  const raw = imgKey + subKey;
  const mixinKey = mixin.map((i) => raw[i] ?? '').join('').slice(0, 32);
  const p: Record<string, string> = { ...params, wts: String(Math.floor(Date.now() / 1000)) };
  const q = Object.keys(p)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(p[k].replace(/[!'()*]/g, ''))}`)
    .join('&');
  return `${q}&w_rid=${md5(q + mixinKey)}`;
}

/** 风控页的开头几十个字(去掉标签),进错误信息方便排查 */
function snippet(text: string): string {
  const t = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return t ? `: ${t.slice(0, 80)}` : '';
}

async function runStep(rule: ProviderRule, step: RuleStep, vars: Vars, signal?: AbortSignal): Promise<unknown> {
  const sess = session(rule.id);
  const query: Record<string, string> = {};
  for (const [k, t] of Object.entries(step.query ?? {})) query[k] = render(t, vars);
  let qs: string;
  if (step.sign?.type === 'wbi') {
    qs = wbiQuery(query, render(step.sign.imgKey, vars), render(step.sign.subKey, vars), step.sign.mixin);
  } else {
    qs = new URLSearchParams(query).toString();
  }
  const base = render(step.url, vars);
  const url = qs ? `${base}${base.includes('?') ? '&' : '?'}${qs}` : base;

  const headers: Record<string, string> = {};
  for (const [k, t] of Object.entries({ ...rule.headers, ...step.headers })) headers[k] = render(t, vars);
  const cookie = Object.entries(sess.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  if (cookie) headers.Cookie = cookie;

  const res = await nativeFetch(url, { headers, signal });
  let text = await res.text();
  if (step.regex) {
    const m = new RegExp(step.regex).exec(text);
    if (!m || m[1] === undefined) throw new Error(`${rule.id}/${step.id}: 页面里没找到数据(HTTP ${res.status})`);
    text = m[1];
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // 风控页通常是 HTML
    throw new Error(`${rule.id}/${step.id}: 非 JSON 响应(HTTP ${res.status})${snippet(text)}`);
  }
  for (const p of step.jsonStrings ?? []) {
    const s = getPath(json, p);
    if (typeof s !== 'string') throw new Error(`${rule.id}/${step.id}: ${p} 不是字符串`);
    let inner: unknown;
    try {
      inner = JSON.parse(s);
    } catch {
      throw new Error(`${rule.id}/${step.id}: ${p} 不是合法 JSON`);
    }
    setPath(json, p, inner);
  }
  if (step.expect && getPath(json, step.expect.path) !== step.expect.equals) {
    throw new Error(`${rule.id}/${step.id}: ${step.expect.path}=${String(getPath(json, step.expect.path))}`);
  }
  for (const [name, path] of Object.entries(step.extract ?? {})) {
    const v = getPath(json, path);
    if (v === undefined || v === null) throw new Error(`${rule.id}/${step.id}: 缺少 ${path}`);
    vars[name] = String(v);
  }
  for (const [name, t] of Object.entries(step.cookies ?? {})) sess.cookies[name] = render(t, vars);
  return json;
}

function toRange(v: unknown): [number, number] | null {
  const m = /^(\d+)-(\d+)$/.exec(String(v ?? ''));
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && !!x);
  return typeof v === 'string' && v ? [v] : [];
}

export function supported(mime: string, codecs: string): boolean {
  const MS = mediaSourceCtor();
  return !!MS && MS.ctor.isTypeSupported(`${mime}; codecs="${codecs}"`);
}

/** 画质偏好:不超过 maxH 里最高的优先,再是超出 maxH 里最低的 */
function heightRank(h: number, maxH: number): number {
  return h <= maxH ? h : -h;
}

/** 候选视频轨按偏好排序(同高度 AVC 优先,兼容性最好),只留本机能解码的 */
export function rankTracks(tracks: DashTrack[], maxH: number): DashTrack[] {
  return tracks
    .filter((t) => supported(t.mime, t.codecs))
    .sort((a, b) => {
      const d = heightRank(b.height ?? 0, maxH) - heightRank(a.height ?? 0, maxH);
      if (d !== 0) return d;
      return Number(b.codecs.startsWith('avc')) - Number(a.codecs.startsWith('avc'));
    });
}

function pickDash(json: unknown, out: DashOutput): { video: DashTrack; videos: DashTrack[]; audio?: DashTrack } {
  const toTrack = (t: unknown): DashTrack | null => {
    const urls = [...strList(firstPath(t, out.url)), ...strList(firstPath(t, out.backup))];
    const init = toRange(firstPath(t, out.init));
    const index = toRange(firstPath(t, out.index));
    const mime = String(firstPath(t, out.mime) ?? '');
    const codecs = String(firstPath(t, out.codecs) ?? '');
    if (!urls.length || !init || !index || !mime) return null;
    return { urls: [...new Set(urls)], mime, codecs, height: Number(firstPath(t, out.height) ?? 0) || 0, init, index };
  };
  const videos = ((getPath(json, out.video) as unknown[] | undefined) ?? []).map(toTrack).filter((t): t is DashTrack => !!t);
  const ranked = rankTracks(videos, out.maxHeight ?? 720);
  if (!ranked.length) throw new Error('没有本机能解码的视频流');
  const audios = out.audio ? ((getPath(json, out.audio) as unknown[] | undefined) ?? []) : [];
  const audio = audios.map(toTrack).find((t): t is DashTrack => !!t && supported(t.mime, t.codecs)) ?? undefined;
  return { video: ranked[0], videos: ranked, audio };
}

/** progressive / hls:按 maxHeight 挑一档,返回主 + 备地址 */
function pickList(json: unknown, out: ProgressiveOutput | HlsOutput): string[] {
  const list = (getPath(json, out.list) as unknown[] | undefined) ?? [];
  const maxH = out.maxHeight ?? 720;
  const cands = list
    .map((it) => ({ urls: [...new Set([...strList(firstPath(it, out.url)), ...strList(firstPath(it, out.backup))])], h: Number(firstPath(it, out.height) ?? 0) || 0 }))
    .filter((c) => c.urls.length)
    .sort((a, b) => heightRank(b.h, maxH) - heightRank(a.h, maxH));
  if (!cands.length) throw new Error('解析结果里没有播放地址');
  return cands[0].urls;
}

function readDuration(json: unknown, out: { duration?: string; durationUnit?: 'ms' | 's' }): number {
  const d = Number(out.duration ? getPath(json, out.duration) : 0) || 0;
  return out.durationUnit === 'ms' ? d / 1000 : d;
}

/** 这条源站地址有没有解析规则(同步;规则未加载时按内置默认判断)。网页端和客户端都用它决定走本站播放器 */
export function canResolveLocally(pageUrl: string): boolean {
  return !!matchProvider(pageUrl);
}

/**
 * 本地解析(只在客户端里可用)。失败抛错。同一条地址在 cacheSeconds 内复用结果。
 */
export async function resolveLocalStream(pageUrl: string, opts: { signal?: AbortSignal; refresh?: boolean } = {}): Promise<LocalStream> {
  const cached = resolved.get(pageUrl);
  if (cached && !opts.refresh && cached.until > Date.now()) return cached.stream;

  const rules = await loadRules();
  const hit = matchProvider(pageUrl, rules);
  if (!hit) throw new Error('没有匹配的解析规则');
  const { rule, groups } = hit;
  const vars: Vars = {};
  groups.forEach((g, i) => {
    vars[`m${i + 1}`] = g ?? '';
  });

  const sess = session(rule.id);
  let last: unknown = null;
  for (const step of rule.steps) {
    const reuse = step.reuseSeconds ? sess.reuse.get(step.id) : undefined;
    if (reuse && reuse.until > Date.now() && !opts.refresh) {
      Object.assign(vars, reuse.vars);
      continue;
    }
    const before = { ...vars };
    last = await runStep(rule, step, vars, opts.signal);
    if (step.reuseSeconds) {
      const added: Vars = {};
      for (const k of Object.keys(vars)) if (before[k] !== vars[k]) added[k] = vars[k];
      sess.reuse.set(step.id, { vars: added, until: Date.now() + step.reuseSeconds * 1000 });
    }
  }

  const mediaHeaders: Record<string, string> = {};
  for (const [k, t] of Object.entries(rule.media?.headers ?? {})) mediaHeaders[k] = render(t, vars);

  let stream: LocalStream;
  const out = rule.output;
  const duration = readDuration(last, out);
  if (out.type === 'dash') {
    const { video, videos, audio } = pickDash(last, out);
    stream = { kind: 'dash', provider: rule.id, duration, video, videos, audio, mediaHeaders, source: 'local' };
  } else {
    stream = { kind: out.type, provider: rule.id, duration, urls: pickList(last, out), mediaHeaders, source: 'local' };
  }
  remember(pageUrl, stream, rule.cacheSeconds ?? 900);
  return stream;
}

function remember(pageUrl: string, stream: LocalStream, cacheSeconds: number) {
  let until = Date.now() + cacheSeconds * 1000;
  if (stream.expiresAt) until = Math.min(until, stream.expiresAt * 1000 - 60_000);
  resolved.set(pageUrl, { stream, until });
}

/**
 * 服务端解析:后端按同一份规则解析,返回同构的流。服务器不知道本机能解什么码,
 * dash 的候选轨(videos)在这里挑第一条 MediaSource 认的。
 */
export async function resolveServerStream(pageUrl: string, opts: { signal?: AbortSignal; refresh?: boolean } = {}): Promise<LocalStream> {
  const cached = resolved.get(pageUrl);
  if (cached && !opts.refresh && cached.until > Date.now()) return cached.stream;
  const q = new URLSearchParams({ url: pageUrl });
  if (opts.refresh) q.set('refresh', '1');
  const res = await fetch(`${API_PREFIX}/api/content/stream/rules/resolve?${q}`, { cache: 'no-store', signal: opts.signal ?? AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`服务端解析 HTTP ${res.status}`);
  const body = (await res.json()) as { code?: number; message?: string; data?: LocalStream };
  if (body?.code !== 0 || !body.data) throw new Error(body?.message || '服务端解析失败');
  const s = body.data;
  let stream: LocalStream;
  if (s.kind === 'dash') {
    const ranked = rankTracks(s.videos?.length ? s.videos : [s.video], 720);
    if (!ranked.length) throw new Error('没有本机能解码的视频流');
    stream = { ...s, video: ranked[0], videos: ranked, mediaHeaders: s.mediaHeaders ?? {}, source: 'server' };
  } else if (s.kind === 'progressive' || s.kind === 'hls') {
    if (!s.urls?.length) throw new Error('服务端解析结果里没有播放地址');
    stream = { ...s, mediaHeaders: s.mediaHeaders ?? {}, source: 'server' };
  } else {
    throw new Error('服务端解析结果格式不认识');
  }
  remember(pageUrl, stream, 900);
  return stream;
}

/**
 * 选路:客户端先本地(用户自己的 IP,源站风控压力分散在每台设备上),失败退到服务端;
 * 网页端只能服务端。两边都失败时把两个原因都带上,诊断日志里看得到。
 */
export async function resolveStream(pageUrl: string, opts: { signal?: AbortSignal; refresh?: boolean } = {}): Promise<LocalStream> {
  if (!nativeAvailable()) return resolveServerStream(pageUrl, opts);
  try {
    return await resolveLocalStream(pageUrl, opts);
  } catch (localErr) {
    if (opts.signal?.aborted) throw localErr;
    try {
      return await resolveServerStream(pageUrl, opts);
    } catch (serverErr) {
      const a = localErr instanceof Error ? localErr.message : String(localErr);
      const b = serverErr instanceof Error ? serverErr.message : String(serverErr);
      throw new Error(`${a};服务端:${b}`);
    }
  }
}
