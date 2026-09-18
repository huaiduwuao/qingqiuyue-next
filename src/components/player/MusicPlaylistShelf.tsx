'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PlaylistCover from '@/components/player/PlaylistCover';
import { getMyLists, getPublicLists, type MyListItem } from '@/apis/my-list';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { getLikedMusic, likedMusicList, playlistHref, playPlaylist } from '@/lib/player/playlist';

const TILE_W = { xs: 128, md: 148 };

/**
 * 音乐频道顶上的「歌单」区:我喜欢的音乐 + 我建的歌单 + 平台编排的歌单 + 新建,横向一排。
 * 歌单和歌放在同一个频道里,不用再去头像菜单里找。
 *
 * 平台编排的歌单(见后端 internal/playlistcurator)未登录也给 —— 新用户点进音乐频道
 * 至少有一排能直接播的歌单,而不是一格"登录后建歌单"。
 */
export default function MusicPlaylistShelf() {
  const router = useRouter();
  const { isAuthenticated, status } = useAuth();
  const [toast, setToast] = useState('');

  const lists = useQuery({
    queryKey: ['my-lists', 'playlist'],
    queryFn: () => getMyLists('playlist'),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
  const liked = useQuery({
    queryKey: ['liked-music'],
    queryFn: getLikedMusic,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
  const square = useQuery({
    queryKey: ['playlist-square', 'shelf'],
    queryFn: () => getPublicLists({ type: 'playlist', sort: 'hot', size: 20 }),
    staleTime: 60_000,
  });

  const loading =
    status === 'loading' || (isAuthenticated && (lists.isLoading || liked.isLoading)) || square.isLoading;
  const mineIds = new Set((lists.data?.list ?? []).map((l) => String(l.id)));
  const tiles: MyListItem[] = [
    ...(liked.data?.length ? [likedMusicList(liked.data)] : []),
    ...(lists.data?.list ?? []),
    // 自己的公开歌单也会出现在广场里,去个重
    ...(square.data?.list ?? []).filter((l) => !mineIds.has(String(l.id))),
  ];

  const play = async (id: MyListItem['id']) => {
    try {
      const n = await playPlaylist(id);
      if (n === 0) setToast('这张歌单里还没有歌');
    } catch {
      setToast('播放失败,稍后再试');
    }
  };

  return (
    <Box component="section" aria-label="歌单" sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 1.25 }}>
        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700, flex: 1 }}>
          歌单
        </Typography>
        <Box
          component="button"
          type="button"
          onClick={() => router.push('/playlist')}
          sx={{ all: 'unset', display: 'inline-flex', alignItems: 'center', fontSize: 12, color: 'text.secondary', cursor: 'pointer', '&:hover': { color: 'primary.main' }, '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', borderRadius: 1 } }}
        >
          全部
          <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          overflowX: 'auto',
          pb: 1,
          scrollSnapType: 'x proximity',
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'action.selected', borderRadius: 3 },
        }}
      >
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <Box key={i} sx={{ width: TILE_W, flexShrink: 0 }}>
              <Skeleton variant="rounded" sx={{ width: '100%', height: 'auto', aspectRatio: '1 / 1', borderRadius: 2 }} />
              <Skeleton width="70%" sx={{ mt: 1 }} />
            </Box>
          ))
        ) : (
          <>
            {tiles.map((l) => (
              <PlaylistTile key={String(l.id)} list={l} onOpen={() => router.push(playlistHref(l.id))} onPlay={() => play(l.id)} />
            ))}
            {isAuthenticated ? (
              <>
                <GhostTile
                  icon={<AddRoundedIcon />}
                  title="新建歌单"
                  hint={tiles.length === 0 ? '也可以在歌曲页点「加入歌单」' : undefined}
                  onClick={() => router.push('/playlist?new=1')}
                />
                <GhostTile
                  icon={<DownloadRoundedIcon />}
                  title="导入歌单"
                  hint="网易云 / QQ / 酷狗 / 汽水"
                  onClick={() => router.push('/playlist?import=1')}
                />
              </>
            ) : (
              <GhostTile
                icon={<LockRoundedIcon />}
                title="登录后建歌单"
                hint="攒喜欢的歌,一键全部播放"
                onClick={() => router.push(loginHref())}
              />
            )}
          </>
        )}
      </Box>

      <Snackbar open={!!toast} autoHideDuration={2400} onClose={() => setToast('')} message={toast} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} />
    </Box>
  );
}

function PlaylistTile({ list, onOpen, onPlay }: { list: MyListItem; onOpen: () => void; onPlay: () => void }) {
  const isLiked = list.id === 'liked';
  return (
    <Box
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      sx={{
        width: TILE_W,
        flexShrink: 0,
        cursor: 'pointer',
        scrollSnapAlign: 'start',
        '&:hover .cv, &:focus-visible .cv': { transform: 'translateY(-3px)' },
        '&:hover .play, &:focus-within .play': { opacity: 1, transform: 'none' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', borderRadius: 2 },
      }}
    >
      <Box className="cv" sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', boxShadow: 2, transition: 'transform 180ms' }}>
        {isLiked && list.covers.length === 0 ? (
          <Box sx={{ aspectRatio: '1 / 1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)' }}>
            <FavoriteRoundedIcon sx={{ fontSize: 48, color: '#fff' }} />
          </Box>
        ) : (
          <PlaylistCover covers={list.covers} coverUrl={list.coverUrl} size="100%" radius={0} />
        )}
        {isLiked && list.covers.length > 0 && (
          <Box sx={{ position: 'absolute', left: 6, top: 6, width: 24, height: 24, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FavoriteRoundedIcon sx={{ fontSize: 14, color: '#FE2C55' }} />
          </Box>
        )}
        <IconButton
          className="play"
          aria-label={`播放 ${list.name}`}
          disabled={list.itemCount === 0}
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          sx={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            width: 36,
            height: 36,
            bgcolor: 'primary.main',
            color: '#fff',
            boxShadow: 3,
            opacity: { xs: 1, md: 0 },
            transform: { xs: 'none', md: 'translateY(4px)' },
            transition: 'opacity 150ms, transform 150ms',
            '&:hover': { bgcolor: 'primary.dark' },
            '&.Mui-disabled': { display: 'none' },
          }}
        >
          <PlayArrowRoundedIcon />
        </IconButton>
      </Box>
      <Typography sx={{ mt: 1, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{list.name}</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
        {list.itemCount} 首
        {list.official ? ' · 官方' : list.ownerName ? ` · ${list.ownerName}` : list.mine && list.isPublic ? ' · 公开' : ''}
      </Typography>
    </Box>
  );
}

function GhostTile({ icon, title, hint, onClick }: { icon: React.ReactNode; title: string; hint?: string; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{ all: 'unset', alignSelf: 'flex-start', width: TILE_W, flexShrink: 0, cursor: 'pointer', scrollSnapAlign: 'start', '&:focus-visible .gh': { outline: '2px solid', outlineColor: 'primary.main' } }}
    >
      <Box
        className="gh"
        sx={{
          aspectRatio: '1 / 1',
          borderRadius: 2,
          border: '1.5px dashed',
          borderColor: 'divider',
          color: 'text.secondary',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'border-color 150ms, color 150ms',
          '& svg': { fontSize: 36 },
          '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ mt: 1, fontSize: 13, fontWeight: 600 }}>{title}</Typography>
      {hint && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{hint}</Typography>}
    </Box>
  );
}
