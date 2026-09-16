/**
 * 2D 数字人(真人片段 / 数字人视频)的片段选择。
 *
 * public/avatar/clips.json(或形象资产里的 clips.json)是一张「状态/动作 → 视频片段」表:
 *   { idle: {url, loop}, speaking: {...}, thinking: {...}, greet: {...}, wave: {...}, ... }
 * 这里只做选片:先按动作(有对应片段且非循环的动作播一次),否则按状态,再不行退到 idle。
 */

export interface ClipEntry {
  url: string;
  loop?: boolean;
}

export type ClipTable = Record<string, ClipEntry | string | undefined>;

export type AvatarSpeakState = 'idle' | 'speaking' | 'thinking';

export interface ClipPick {
  key: string;
  url: string;
  loop: boolean;
}

/** 表里的值可能是字符串(直接给 url)或对象,统一成 ClipEntry。 */
export function normalizeClips(raw: unknown): Record<string, ClipEntry> {
  const out: Record<string, ClipEntry> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k.startsWith('_')) continue;
    if (typeof v === 'string' && v) out[k] = { url: v, loop: k === 'idle' || k === 'speaking' || k === 'thinking' };
    else if (v && typeof v === 'object' && typeof (v as ClipEntry).url === 'string') {
      out[k] = { url: (v as ClipEntry).url, loop: !!(v as ClipEntry).loop };
    }
  }
  return out;
}

/**
 * 选片:动作优先(数字人刚做了 <action:wave/> 且表里有 wave),否则按说话状态,最后 idle。
 * 没有任何可用片段返回 null(调用方显示占位)。
 */
export function pickClip(clips: Record<string, ClipEntry>, state: AvatarSpeakState, action?: string): ClipPick | null {
  const a = (action || '').trim();
  if (a && a !== 'idle' && clips[a]) return { key: a, url: clips[a].url, loop: !!clips[a].loop };
  if (clips[state]) return { key: state, url: clips[state].url, loop: clips[state].loop !== false };
  if (clips.idle) return { key: 'idle', url: clips.idle.url, loop: true };
  const first = Object.entries(clips)[0];
  return first ? { key: first[0], url: first[1].url, loop: true } : null;
}

/** 响应是不是视频:静态站找不到文件时会回退成 index.html(200 text/html),不能只看状态码。 */
export function isVideoResponse(status: number, contentType: string | null): boolean {
  return status >= 200 && status < 300 && /^video\//i.test((contentType || '').trim());
}

/**
 * 片段表能不能用:表能读到,且 idle(没有就第一段)真的是视频。
 * 返回 null 表示可用,否则是给人看的原因。
 */
export async function probeClips(clipsUrl: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  let clips: Record<string, ClipEntry>;
  try {
    const r = await fetchFn(clipsUrl);
    if (!r.ok) return `片段表 ${clipsUrl} 读取失败(HTTP ${r.status})`;
    clips = normalizeClips(await r.json());
  } catch {
    return `片段表 ${clipsUrl} 读取失败`;
  }
  const pick = pickClip(clips, 'idle');
  if (!pick) return '片段表是空的';
  try {
    const r = await fetchFn(pick.url, { method: 'HEAD' });
    if (!isVideoResponse(r.status, r.headers.get('content-type'))) return `片段文件 ${pick.url} 不存在`;
  } catch {
    return `片段文件 ${pick.url} 无法访问`;
  }
  return null;
}
