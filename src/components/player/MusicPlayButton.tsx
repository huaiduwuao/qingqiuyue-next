'use client';

import React, { useEffect, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import type { SxProps, Theme } from '@mui/material/styles';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import { useMusicPlayer, musicPlayer, currentTrack } from '@/lib/player/musicPlayer';
import { playMusicById } from '@/lib/player/playMusic';

interface Props {
  id: string | number;
  title?: string;
  size?: number;
  sx?: SxProps<Theme>;
}

/**
 * 音乐卡片上的播放按钮:不进详情页,直接交给全局播放器(边浏览列表边听)。
 * 放在可点击的卡片里也没关系 —— 点击不会冒泡成「打开详情」。
 */
export default function MusicPlayButton({ id, title, size = 40, sx }: Props) {
  const key = String(id);
  const isCurrent = useMusicPlayer((s) => currentTrack(s)?.id === key);
  const playing = useMusicPlayer((s) => isCurrent && s.playing);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    if (isCurrent) {
      musicPlayer.toggle();
      return;
    }
    setBusy(true);
    try {
      const ok = await playMusicById(key);
      if (!ok) setNotice('暂无可播放音源(版权或平台限制)');
    } catch {
      setNotice('音源加载失败,请稍后再试');
    } finally {
      setBusy(false);
    }
  };

  const label = playing ? '暂停' : `播放${title ? ` ${title}` : ''}`;

  return (
    <Tooltip title={notice || (playing ? '暂停' : '直接播放')} open={notice ? true : undefined} placement="top">
      <IconButton
        onClick={onClick}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label={label}
        sx={[
          {
            width: size,
            height: size,
            bgcolor: 'rgba(254, 44, 85, 0.92)',
            color: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            '&:hover': { bgcolor: 'primary.main', transform: 'scale(1.06)' },
            transition: 'transform 0.15s',
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {busy ? (
          <CircularProgress size={size * 0.45} sx={{ color: '#fff' }} />
        ) : playing ? (
          <PauseRoundedIcon sx={{ fontSize: size * 0.6 }} />
        ) : (
          <PlayArrowRoundedIcon sx={{ fontSize: size * 0.6 }} />
        )}
      </IconButton>
    </Tooltip>
  );
}
