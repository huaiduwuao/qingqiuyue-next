'use client';

/**
 * 歌单 ↔ 全局播放器。
 *
 * 歌单里的歌只有 id / 标题 / 封面,没有音源 —— 进队列时 src 留空,轮到哪首播哪首再解析
 * (见 musicPlayer.load),所以「播放全部」点了就响,不用先把整张歌单的音源取一遍。
 */
import { getMyListContent, getMyListDetail, type MyListContentItem, type MyListItem } from '@/apis/my-list';
import { accountClient } from '@/lib/api/client';
import { mediaUrl } from '@/lib/media';
import { musicPlayer, type MusicTrack, type QueueSource } from './musicPlayer';

export interface TrackSeed {
  id: string | number;
  title?: string;
  artist?: string;
  cover?: string;
}

export const musicHref = (id: string | number) => `/detail/music-detail?id=${encodeURIComponent(String(id))}`;
export const playlistHref = (id: string | number) => `/playlist?id=${encodeURIComponent(String(id))}`;

/** 只知道 id 和标题的歌 → 待解析的队列曲目 */
export function lazyTrack(seed: TrackSeed): MusicTrack {
  const id = String(seed.id);
  return {
    id,
    title: seed.title || '未知歌曲',
    artist: seed.artist || '',
    cover: mediaUrl(seed.cover),
    src: '',
    href: musicHref(id),
  };
}

/** 播放一组歌(替换当前队列)。返回进了队列的数量。 */
export function playTracks(
  seeds: TrackSeed[],
  opts: { startId?: string | number; shuffle?: boolean; source?: QueueSource | null } = {},
): number {
  const tracks = seeds.filter((s) => s?.id).map(lazyTrack);
  if (tracks.length === 0) return 0;
  const at = opts.startId === undefined ? -1 : tracks.findIndex((t) => t.id === String(opts.startId));
  musicPlayer.setQueue(tracks, {
    startIndex: at >= 0 ? at : undefined,
    shuffle: opts.shuffle,
    source: opts.source,
  });
  return tracks.length;
}

/** 加到队尾,不打断当前播放。返回实际加入的数量。 */
export function queueTracks(seeds: TrackSeed[]): number {
  return musicPlayer.enqueueMany(seeds.filter((s) => s?.id).map(lazyTrack));
}

/**
 * 内置歌单「我喜欢的音乐」:不落库,就是点过赞的歌。/playlist?id=liked 打开。
 * 没人建过歌单时,音乐频道的歌单区也不至于是空的。
 */
export const LIKED_MUSIC_ID = 'liked';
export const LIKED_MUSIC_NAME = '我喜欢的音乐';

/** 点过赞的歌,按点赞时间倒序(后端最多给最近 100 条赞,再从里面挑音乐)。 */
export async function getLikedMusic(): Promise<MyListContentItem[]> {
  const res: any = await accountClient('/account/likes/page');
  const list: any[] = res?.list ?? [];
  return list
    .filter((c) => String(c.category || c.contentType || '').toUpperCase() === 'MUSIC')
    .map((c) => ({
      id: String(c.id),
      contentId: String(c.id),
      title: c.title ?? '',
      coverUrl: c.cover ?? '',
      type: 'MUSIC',
      author: c.name ?? '',
      views: c.views ?? 0,
      likes: c.likes ?? 0,
      addTime: '',
    }));
}

/** 「我喜欢的音乐」伪装成一张歌单,详情页和歌单区直接复用。 */
export function likedMusicList(rows: MyListContentItem[]): MyListItem {
  return {
    id: LIKED_MUSIC_ID,
    userId: 0,
    name: LIKED_MUSIC_NAME,
    description: '你点过赞的歌都在这里',
    coverUrl: '',
    covers: rows.map((r) => r.coverUrl).filter(Boolean).slice(0, 4),
    type: 'playlist',
    itemCount: rows.length,
    isPublic: false,
    mine: false,
    createTime: '',
    updateTime: '',
  };
}

/** 播放整张歌单。歌单里没有歌(或没有音乐类内容)时返回 0。 */
export async function playPlaylist(listId: string | number, opts: { shuffle?: boolean; append?: boolean } = {}): Promise<number> {
  if (String(listId) === LIKED_MUSIC_ID) {
    const rows = await getLikedMusic();
    const seeds = rows.map((it) => ({ id: it.contentId, title: it.title, artist: it.author, cover: it.coverUrl }));
    if (opts.append) return queueTracks(seeds);
    return playTracks(seeds, { shuffle: opts.shuffle, source: { kind: 'playlist', name: LIKED_MUSIC_NAME, href: playlistHref(listId) } });
  }
  const [meta, content] = await Promise.all([getMyListDetail(listId).catch(() => null), getMyListContent(listId)]);
  const seeds = (content?.list ?? [])
    .filter((it) => !it.type || it.type === 'MUSIC')
    .map((it) => ({ id: it.contentId, title: it.title, artist: it.author, cover: it.coverUrl }));
  if (opts.append) return queueTracks(seeds);
  return playTracks(seeds, {
    shuffle: opts.shuffle,
    source: { kind: 'playlist', name: meta?.name || '歌单', href: playlistHref(listId) },
  });
}
