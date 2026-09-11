'use client';

export type ClientPlatform = 'windows' | 'macos' | 'ios' | 'android';

export interface PlatformInfo {
  key: ClientPlatform;
  label: string;
  sub: string;
  /** 真实安装包扩展名(exe / dmg / ipa / apk),占位文件后缀为 .txt */
  ext: string;
  /** 探测顺序里的别名,大小写不敏感 */
  aliases: string[];
}

export const PLATFORMS: PlatformInfo[] = [
  { key: 'windows', label: 'Windows', sub: 'Win 10/11 · 64 位', ext: 'exe', aliases: ['win32', 'wow64', 'windows'] },
  { key: 'macos', label: 'macOS', sub: 'Apple Silicon / Intel', ext: 'dmg', aliases: ['macintel', 'macppc', 'mac'] },
  { key: 'ios', label: 'iOS', sub: 'iPhone · iPad', ext: 'ipa', aliases: ['iphone', 'ipad', 'ios'] },
  { key: 'android', label: 'Android', sub: 'Android 8.0+', ext: 'apk', aliases: ['android', 'linux arm'] },
];

const PLATFORM_BY_ALIAS: Record<string, ClientPlatform> = PLATFORMS.reduce((acc, p) => {
  p.aliases.forEach((a) => {
    acc[a.toLowerCase()] = p.key;
  });
  acc[p.key] = p.key;
  return acc;
}, {} as Record<string, ClientPlatform>);

/** 探测当前运行环境,SSR 安全,失败回 'unknown'。 */
export function detectPlatform(): ClientPlatform | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  const plat = (navigator as any).platform?.toLowerCase?.() || '';
  // 移动优先(否则 iPad 在桌面 UA 里可能误判为 Mac)
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  for (const a of [plat, ...ua.match(/mac|windows|linux/i)?.toString().split(' ') || []]) {
    const hit = PLATFORM_BY_ALIAS[a];
    if (hit) return hit;
  }
  return 'unknown';
}

/** 触发浏览器从 URL 下载。 */
export function downloadFromUrl(url: string, filename: string) {
  if (typeof window === 'undefined') return;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export interface DownloadOptions {
  platform: ClientPlatform;
  version: string;
  /** 真实安装包地址(环境变量 NEXT_PUBLIC_CLIENT_URL_*);未配置表示该平台尚未发布 */
  installUrl?: string;
}

/**
 * 统一下载入口:只从真实安装包地址下载。
 * 未配置地址时返回 false,由调用方提示「暂未发布」,不生成任何占位文件。
 */
export function triggerClientDownload({ platform, version, installUrl }: DownloadOptions): boolean {
  const info = PLATFORMS.find((p) => p.key === platform);
  if (!info || !installUrl) return false;
  downloadFromUrl(installUrl, `qingqiuyue-client-${version}-${platform}.${info.ext}`);
  return true;
}
