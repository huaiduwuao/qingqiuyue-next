'use client';

import { detail as contentDetail } from '@/apis/content-music';
import { mediaUrl } from '@/lib/media';
import { musicPlayer, type MusicTrack } from './musicPlayer';
import { resolveMusic } from './resolveMusic';

/** 详情数据 + 已解析好的音源 → 全局播放器曲目 */
export function trackFromDetail(id: string, data: any, src: string): MusicTrack {
  return {
    id,
    title: data?.title || '未知歌曲',
    artist: data?.artist || '',
    album: data?.album || '',
    cover: mediaUrl(data?.cover || data?.coverUrl),
    src,
    href: `/detail/music-detail?id=${encodeURIComponent(id)}`,
    preview: data?.audioStatus === 'preview',
  };
}

/**
 * 列表卡片上直接播放:拉详情、解析音源,交给全局播放器。
 * 没有可播放音源(版权 / VIP)时返回 false,由调用方提示。
 */
export async function playMusicById(id: string | number): Promise<boolean> {
  const key = String(id);
  const res: any = await contentDetail('music', { id: key });
  const data = res?.data;
  if (!data) return false;
  const { src } = await resolveMusic(data);
  if (!src) return false;
  musicPlayer.play(trackFromDetail(key, data, src));
  return true;
}
