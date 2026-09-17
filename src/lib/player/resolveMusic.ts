/**
 * 音乐音源解析 —— 详情页和全局播放器共用。
 *
 * 详情数据里有 audioUrl 就直接用;没有时从 source / playSources 里抠酷狗 hash,
 * 走爬虫实时取音源和 LRC 歌词。全局播放器在音源过期(签名直链 403)时也调这里重取。
 */
import { detail as contentDetail } from '@/apis/content-music';
import { spiderClient } from '@/lib/api/client';
import { mediaUrl } from '@/lib/media';

export interface LyricLine {
  time: number;
  text: string;
}

export function parseLrc(value: unknown): LyricLine[] {
  if (Array.isArray(value)) return value as LyricLine[];
  if (typeof value !== 'string') return [];
  return value.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
    if (!match) return [];
    return [{ time: Number(match[1]) * 60 + Number(match[2]), text: match[3].trim() }];
  });
}

function extractHash(data: any): string | null {
  const playSources = (data?.playSources || []) as Array<{ source?: string; sourceUrl?: string }>;
  const urls = [data?.source, data?.sourceUrl, ...playSources.map((p) => p.source || p.sourceUrl)].filter(Boolean);
  for (const url of urls) {
    const match = String(url).match(/hash=([a-f0-9]+)/i);
    if (match) return match[1];
  }
  return null;
}

/** 返回可直接交给 <audio> 的地址(已过 mediaUrl)和实时歌词;都拿不到时为空。 */
export async function resolveMusic(data: any): Promise<{ src: string; lyrics: LyricLine[] }> {
  if (data?.audioUrl) return { src: mediaUrl(data.audioUrl), lyrics: [] };
  const hash = extractHash(data);
  if (!hash) return { src: '', lyrics: [] };

  let src = '';
  let lyrics: LyricLine[] = [];
  try {
    const audioRes: any = await spiderClient(`/music/audio/${hash}`);
    if (audioRes?.data?.audio_url) src = mediaUrl(audioRes.data.audio_url);
    const detailRes: any = await spiderClient(`/music/detail/${hash}`);
    lyrics = parseLrc(detailRes?.data?.lyrics_lrc || detailRes?.data?.lyrics);
  } catch (err) {
    console.warn('获取音频/歌词失败:', err);
  }
  return { src, lyrics };
}

/**
 * 按内容 id 拉详情并解析 —— 歌单 / 队列里的歌只存了 id 和标题,轮到它播时才来取音源,
 * 顺便把列表接口没有的字段(歌手、专辑、是否试听)补齐。
 */
export async function resolveTrackById(id: string): Promise<{
  src: string;
  title?: string;
  artist?: string;
  album?: string;
  cover?: string;
  preview: boolean;
}> {
  const res: any = await contentDetail('music', { id });
  const data = res?.data;
  const { src } = await resolveMusic(data);
  return {
    src,
    title: data?.title || undefined,
    artist: data?.artist || data?.author || undefined,
    album: data?.album || undefined,
    cover: mediaUrl(data?.cover || data?.coverUrl) || undefined,
    preview: data?.audioStatus === 'preview',
  };
}

/** 按内容 id 重新拉详情再解析 —— 全局播放器换链用。 */
export async function resolveMusicById(id: string): Promise<string> {
  const res: any = await contentDetail('music', { id });
  return (await resolveMusic(res?.data)).src;
}
