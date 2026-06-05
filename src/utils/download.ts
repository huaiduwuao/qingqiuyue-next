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

const fakeSha256 = (): string =>
  Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

/** 触发浏览器下载一个 Blob(占位文件用)。 */
export function downloadBlob(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  installUrl?: string;
  /** 安装包占位文件大小(MB),仅占位文件使用 */
  sizeMb?: number;
}

/** 统一下载入口:有 installUrl 走 URL,否则生成占位 .txt。 */
export function triggerClientDownload({ platform, version, installUrl, sizeMb }: DownloadOptions) {
  const info = PLATFORMS.find((p) => p.key === platform);
  if (!info) return;
  const ext = info.ext;
  const filename = `qingqiuyue-client-${version}-${platform}.${ext}`;

  if (installUrl) {
    downloadFromUrl(installUrl, filename);
    return;
  }
  const now = new Date().toISOString();
  const sha = fakeSha256();
  const size = (sizeMb ?? Math.random() * 80 + 40).toFixed(1);
  const content = [
    '============================================',
    '  清秋月(qingqiuyue) 桌面/移动客户端 · 占位文件',
    '============================================',
    '',
    `  平台:   ${info.label} (${platform})`,
    `  版本:   ${version}`,
    `  类型:   ${ext} (placeholder)`,
    `  大小:   ${size} MB`,
    `  SHA256: ${sha}`,
    `  下载时间: ${now}`,
    '',
    '  说明: 真实安装包 URL 尚未配置,本文件为前端占位产物。',
    '  后端接入后请将 installUrls.windows/macos/ios/android',
    '  配置到环境变量 NEXT_PUBLIC_CLIENT_URL_* 即可。',
    '',
    '============================================',
    '',
  ].join('\n');
  downloadBlob(`${filename}.txt`, content);
}
