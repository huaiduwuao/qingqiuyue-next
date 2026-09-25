/**
 * 规则执行器:按服务器下发的规则(见 ./rules)在本机把源站页面地址解析成可播放的媒体地址。
 * 所有接口请求走原生 HTTP(./native),用的是用户自己的网络和 IP —— 源站地址里常带请求方 IP,
 * 在服务器上解析、拿到手机上播放是播不了的。
 */

import { md5 } from './md5';
import { nativeFetch } from './native';
import { mediaSourceCtor } from './dash';
import { loadRules, matchProvider, type DashOutput, type ProgressiveOutput, type ProviderRule, type RuleStep } from './rules';

export interface DashTrack {
  /** 主地址 + 备用地址,按顺序尝试 */
  urls: string[];
  mime: string;
  codecs: string;
  /** SegmentBase:初始化段、sidx 索引的字节范围(闭区间) */
  init: [number, number];
  index: [number, number];
}

export type LocalStream =
  | { kind: 'dash'; provider: string; duration: number; video: DashTrack; audio?: DashTrack; mediaHeaders: Record<string, string> }
  | { kind: 'progressive'; provider: string; duration: number; urls: string[]; mediaHeaders: Record<string, string> };

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
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // 风控页通常是 HTML
    throw new Error(`${rule.id}/${step.id}: 非 JSON 响应(HTTP ${res.status})`);
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

function supported(mime: string, codecs: string): boolean {
  const MS = mediaSourceCtor();
  return !!MS && MS.ctor.isTypeSupported(`${mime}; codecs="${codecs}"`);
}

function pickDash(json: unknown, out: DashOutput): { video: DashTrack; audio?: DashTrack } {
  const toTrack = (t: unknown): DashTrack | null => {
    const urls = [...strList(firstPath(t, out.url)), ...strList(firstPath(t, out.backup))];
    const init = toRange(firstPath(t, out.init));
    const index = toRange(firstPath(t, out.index));
    const mime = String(firstPath(t, out.mime) ?? '');
    const codecs = String(firstPath(t, out.codecs) ?? '');
    if (!urls.length || !init || !index || !mime) return null;
    return { urls: [...new Set(urls)], mime, codecs, init, index };
  };
  const videos = (getPath(json, out.video) as unknown[] | undefined) ?? [];
  const maxH = out.maxHeight ?? 720;
  // 能解的编码里,不超过 maxHeight 的最高一档;AVC 兼容性最好,同高度优先
  const candidates = videos
    .map((v) => ({ v, h: Number(firstPath(v, out.height) ?? 0), t: toTrack(v) }))
    .filter((c): c is { v: unknown; h: number; t: DashTrack } => !!c.t && supported(c.t.mime, c.t.codecs))
    .sort((a, b) => {
      const ah = a.h <= maxH ? a.h : -a.h;
      const bh = b.h <= maxH ? b.h : -b.h;
      if (ah !== bh) return bh - ah;
      return Number(b.t.codecs.startsWith('avc')) - Number(a.t.codecs.startsWith('avc'));
    });
  if (!candidates.length) throw new Error('没有本机能解码的视频流');
  const audios = out.audio ? ((getPath(json, out.audio) as unknown[] | undefined) ?? []) : [];
  const audio = audios.map(toTrack).find((t): t is DashTrack => !!t && supported(t.mime, t.codecs)) ?? undefined;
  return { video: candidates[0].t, audio };
}

/** 客户端里能不能本地解析这条源站地址(同步;规则未加载时按内置默认判断) */
export function canResolveLocally(pageUrl: string): boolean {
  return !!matchProvider(pageUrl);
}

/**
 * 解析。失败抛错(调用方退回外链播放器)。同一条地址在 cacheSeconds 内复用结果。
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
  const duration = Number(out.duration ? getPath(last, out.duration) : 0) || 0;
  if (out.type === 'dash') {
    const { video, audio } = pickDash(last, out);
    stream = { kind: 'dash', provider: rule.id, duration, video, audio, mediaHeaders };
  } else {
    const p = out as ProgressiveOutput;
    const first = ((getPath(last, p.list) as unknown[] | undefined) ?? [])[0];
    const urls = [...strList(firstPath(first, p.url)), ...strList(firstPath(first, p.backup))];
    if (!urls.length) throw new Error('解析结果里没有播放地址');
    stream = { kind: 'progressive', provider: rule.id, duration, urls, mediaHeaders };
  }
  resolved.set(pageUrl, { stream, until: Date.now() + (rule.cacheSeconds ?? 900) * 1000 });
  return stream;
}
