/**
 * 客户端「检查更新」的纯逻辑部分(版本比较 / 读发布信息 / 手动触发)。
 *
 * - 桌面端(Windows / macOS)走官方 tauri-plugin-updater:Rust 侧读
 *   releases/latest/download/latest.json、校验签名、下载安装,见 components/client/AppUpdater.tsx。
 * - 安卓没有 Tauri updater,只做「有新版 → 打开系统浏览器下载 APK」,版本信息从这里取。
 * - 网页里什么都不做(isDesktopClient() 为 false)。
 */

import { authPlatform } from '@/lib/clientAuth';

export const RELEASE_REPO ='huaiduwuao/qingqiuyue-next';
export const LATEST_MANIFEST_URL = `https://github.com/${RELEASE_REPO}/releases/latest/download/latest.json`;
export const LATEST_RELEASE_API = `https://api.github.com/repos/${RELEASE_REPO}/releases/latest`;
export const ANDROID_APK_URL = `https://github.com/${RELEASE_REPO}/releases/latest/download/qingqiuyue-android.apk`;

/** 手动「检查更新」:任何地方 dispatch 这个事件,常驻的 AppUpdater 负责检查并给出结果。 */
export const APP_UPDATE_CHECK_EVENT = 'qq:app-update-check';

export type UpdateMode = 'desktop' | 'android' | null;

/**
 * 当前运行环境用哪种更新方式。网页 / iOS(走 App Store)返回 null,调用方什么都不做。
 * 只在浏览器里(useEffect 之后)调用才有意义 —— 预渲染时恒为 null。
 */
export function updateMode(): UpdateMode {
  const p = authPlatform();
  if (p === 'windows' || p === 'macos') return 'desktop';
  if (p === 'android') return 'android';
  return null;
}

export function requestUpdateCheck(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_UPDATE_CHECK_EVENT));
}

type ParsedVersion = { core: [number, number, number]; pre: string[] };

/** 解析 x.y.z[-pre][+build],容忍前缀 v;解析不了返回 null。 */
export function parseVersion(input: string): ParsedVersion | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(input).trim());
  if (!m) return null;
  return {
    core: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] ? m[4].split('.') : [],
  };
}

/**
 * 按 semver 2.0 比较:a < b 返回负数,相等 0,a > b 正数。
 * 预发布版低于同号正式版(1.2.0-rc.1 < 1.2.0);数字标识按数值比,数字标识低于字母标识;build 元数据忽略。
 * 任一边解析失败按相等处理 —— 宁可不提示,也别因为脏数据天天弹窗。
 */
export function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return 0;
  for (let i = 0; i < 3; i++) {
    if (va.core[i] !== vb.core[i]) return va.core[i] - vb.core[i];
  }
  if (!va.pre.length && !vb.pre.length) return 0;
  if (!va.pre.length) return 1;
  if (!vb.pre.length) return -1;
  const n = Math.max(va.pre.length, vb.pre.length);
  for (let i = 0; i < n; i++) {
    const x = va.pre[i];
    const y = vb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const xn = /^\d+$/.test(x);
    const yn = /^\d+$/.test(y);
    if (xn && yn) return Number(x) - Number(y);
    if (xn) return -1;
    if (yn) return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0;
}

export type LatestRelease = { version: string; notes: string; date?: string };

/** latest.json(Tauri 静态更新清单)→ 版本信息 */
export function parseManifest(json: unknown): LatestRelease | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  const version = typeof o.version === 'string' ? o.version.replace(/^v/, '') : '';
  if (!parseVersion(version)) return null;
  return {
    version,
    notes: typeof o.notes === 'string' ? o.notes : '',
    date: typeof o.pub_date === 'string' ? o.pub_date : undefined,
  };
}

/** GitHub releases/latest API → 版本信息(草稿 / 预发布不算) */
export function parseGithubRelease(json: unknown): LatestRelease | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  if (o.draft === true || o.prerelease === true) return null;
  const version = typeof o.tag_name === 'string' ? o.tag_name.replace(/^v/, '') : '';
  if (!parseVersion(version)) return null;
  return {
    version,
    notes: typeof o.body === 'string' ? o.body : '',
    date: typeof o.published_at === 'string' ? o.published_at : undefined,
  };
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { cache: 'no-store', ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 查最新正式版(安卓用)。
 *
 * 先走 GitHub API:它带 Access-Control-Allow-Origin: *,WebView 里能直接读。
 * latest.json 放在 github.com/…/releases/latest/download 下,那个 302 响应不带 CORS 头,
 * 页面(http://tauri.localhost)里 fetch 会被浏览器拦下,只作为 API 限流(未登录 60 次/小时/IP)时的兜底。
 */
export async function fetchLatestRelease(fetchImpl: typeof getJson = getJson): Promise<LatestRelease> {
  const errors: string[] = [];
  try {
    const rel = parseGithubRelease(
      await fetchImpl(LATEST_RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } }),
    );
    if (rel) return rel;
    errors.push('api: no usable release');
  } catch (e) {
    errors.push(`api: ${(e as Error)?.message || e}`);
  }
  try {
    const rel = parseManifest(await fetchImpl(LATEST_MANIFEST_URL));
    if (rel) return rel;
    errors.push('latest.json: invalid');
  } catch (e) {
    errors.push(`latest.json: ${(e as Error)?.message || e}`);
  }
  throw new Error(errors.join('; '));
}
