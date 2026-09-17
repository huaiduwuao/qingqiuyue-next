'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha, useTheme } from '@mui/material/styles';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import SkipPreviousRoundedIcon from '@mui/icons-material/SkipPreviousRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import QueueMusicRoundedIcon from '@mui/icons-material/QueueMusicRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import RepeatOneRoundedIcon from '@mui/icons-material/RepeatOneRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import ShuffleRoundedIcon from '@mui/icons-material/ShuffleRounded';
import PlaylistAddRoundedIcon from '@mui/icons-material/PlaylistAddRounded';
import LibraryMusicRoundedIcon from '@mui/icons-material/LibraryMusicRounded';
import Snackbar from '@mui/material/Snackbar';
import { useMusicPlayer, musicPlayer, currentTrack, type MusicTrack } from '@/lib/player/musicPlayer';
import PlaylistPicker from './PlaylistPicker';

const BAR_H = 64;
const DISC = 56;

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

/** 底部导航存在时贴在它上面,否则贴屏幕底(含安全区) */
const BOTTOM = 'calc(max(var(--bottom-nav-inset, 0px), var(--sab, 0px)) + 10px)';

function Cover({ track, size, spin }: { track: MusicTrack; size: number; spin: boolean }) {
  const [broken, setBroken] = useState(false);
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        bgcolor: 'action.selected',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 0 3px rgba(0,0,0,0.75), 0 2px 10px rgba(0,0,0,0.3)',
        animation: 'qqDiscSpin 14s linear infinite',
        animationPlayState: spin ? 'running' : 'paused',
        '@keyframes qqDiscSpin': { to: { transform: 'rotate(360deg)' } },
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }}
    >
      {track.cover && !broken ? (
        <Box component="img" src={track.cover} alt="" onError={() => setBroken(true)} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <MusicNoteRoundedIcon sx={{ color: 'text.secondary', fontSize: size * 0.45 }} />
      )}
    </Box>
  );
}

function QueueList({ onPick, onSave, onOpen }: { onPick: () => void; onSave: () => void; onOpen: (href: string) => void }) {
  const queue = useMusicPlayer((s) => s.queue);
  const index = useMusicPlayer((s) => s.index);
  const playing = useMusicPlayer((s) => s.playing);
  const source = useMusicPlayer((s) => s.source);
  return (
    <Box sx={{ width: 320, maxWidth: 'calc(100vw - 32px)', maxHeight: 400, overflow: 'auto', py: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.5, position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary' }}>播放队列 · {queue.length}</Box>
          {source && (
            <Box
              component={source.href ? 'button' : 'div'}
              onClick={source.href ? () => onOpen(source.href!) : undefined}
              sx={{ all: 'unset', display: 'block', maxWidth: '100%', fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: source.href ? 'pointer' : 'default', '&:hover': source.href ? { color: 'primary.main' } : undefined }}
            >
              来自:{source.name}
            </Box>
          )}
        </Box>
        <Tooltip title="我的歌单">
          <IconButton size="small" aria-label="我的歌单" onClick={() => onOpen('/playlist')} sx={{ color: 'text.secondary' }}>
            <LibraryMusicRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="把队列存为歌单">
          <IconButton size="small" aria-label="把队列存为歌单" onClick={onSave} sx={{ color: 'text.secondary' }}>
            <PlaylistAddRoundedIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>
      {queue.map((t, i) => (
        <Box
          key={t.id}
          onClick={() => {
            if (i !== index) musicPlayer.playAt(i);
            onPick();
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 0.75,
            cursor: 'pointer',
            bgcolor: i === index ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: 'action.hover' },
            '&:hover .rm': { opacity: 1 },
          }}
        >
          <Box sx={{ width: 18, color: 'primary.main', display: 'flex' }}>
            {i === index && playing ? <GraphicEqRoundedIcon sx={{ fontSize: 16 }} /> : null}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ fontSize: 13, color: i === index ? 'primary.main' : 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.title}
            </Box>
            {t.artist && (
              <Box sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.artist}</Box>
            )}
          </Box>
          <IconButton
            className="rm"
            size="small"
            aria-label={`从队列移除 ${t.title}`}
            onClick={(e) => {
              e.stopPropagation();
              musicPlayer.remove(i);
            }}
            sx={{ opacity: { xs: 1, md: 0 }, color: 'text.secondary' }}
          >
            <CloseRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
}

/**
 * 全站音乐底栏。离开详情页、切路由都不停,直到用户点 ✕。
 * 可收成左下角一张转动的唱片(不挡页面),点唱片展开。
 */
export default function GlobalMusicBar() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const track = useMusicPlayer((s) => currentTrack(s));
  const playing = useMusicPlayer((s) => s.playing);
  const buffering = useMusicPlayer((s) => s.buffering);
  const currentTime = useMusicPlayer((s) => s.currentTime);
  const duration = useMusicPlayer((s) => s.duration);
  const volume = useMusicPlayer((s) => s.volume);
  const muted = useMusicPlayer((s) => s.muted);
  const repeat = useMusicPlayer((s) => s.repeat);
  const shuffle = useMusicPlayer((s) => s.shuffle);
  const queueIds = useMusicPlayer((s) => s.queue).map((t) => t.id);
  const sourceName = useMusicPlayer((s) => s.source?.name);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toast, setToast] = useState('');
  const collapsed = useMusicPlayer((s) => s.collapsed);
  const error = useMusicPlayer((s) => s.error);
  const queueLen = useMusicPlayer((s) => s.queue.length);
  const [queueAnchor, setQueueAnchor] = useState<HTMLElement | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // persist 从 localStorage 恢复之前别渲染,免得 SSR/首帧不一致
  useEffect(() => setHydrated(true), []);

  // 正在看这首歌的详情页:页面自己就是大号播放器,底栏让位
  const onOwnPage = !!track && pathname === '/detail/music-detail' && searchParams.get('id') === track.id;
  const showBar = hydrated && !!track && !collapsed && !onOwnPage;
  const showDisc = hydrated && !!track && collapsed && !onOwnPage;

  // 给页面留出底栏的高度(globals.css 里 body 和首页 main 读这个变量)
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--player-inset', showBar ? `${BAR_H + 20}px` : '0px');
    return () => root.style.setProperty('--player-inset', '0px');
  }, [showBar]);

  if (!track || (!showBar && !showDisc)) return null;

  const openDetail = () => router.push(track.href);
  const shown = scrub ?? currentTime;
  const glass = {
    bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.78 : 0.86),
    backdropFilter: 'blur(20px) saturate(1.6)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
    border: '1px solid',
    borderColor: 'divider',
    boxShadow: theme.palette.mode === 'dark' ? '0 10px 40px rgba(0,0,0,0.6)' : '0 10px 40px rgba(0,0,0,0.14)',
  };

  const playBtn = (big: boolean) => (
    <IconButton
      onClick={() => musicPlayer.toggle()}
      aria-label={playing ? '暂停' : '播放'}
      sx={{
        width: big ? 42 : 36,
        height: big ? 42 : 36,
        bgcolor: 'primary.main',
        color: '#fff',
        position: 'relative',
        '&:hover': { bgcolor: 'primary.dark' },
      }}
    >
      {playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
      {buffering && playing && (
        <CircularProgress size={big ? 46 : 40} thickness={2} sx={{ position: 'absolute', color: 'primary.light' }} />
      )}
    </IconButton>
  );

  const queuePopover = (
    <Popover
      open={!!queueAnchor}
      anchorEl={queueAnchor}
      onClose={() => setQueueAnchor(null)}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      slotProps={{ paper: { sx: { borderRadius: 2, mb: 1 } } }}
    >
      <QueueList
        onPick={() => setQueueAnchor(null)}
        onSave={() => {
          setQueueAnchor(null);
          setPickerOpen(true);
        }}
        onOpen={(href) => {
          setQueueAnchor(null);
          router.push(href);
        }}
      />
    </Popover>
  );

  const extras = (
    <>
      <PlaylistPicker open={pickerOpen} onClose={() => setPickerOpen(false)} contentIds={queueIds} suggestName={sourceName} onDone={setToast} />
      <Snackbar open={!!toast} autoHideDuration={2600} onClose={() => setToast('')} message={toast} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} />
    </>
  );

  if (showDisc) {
    const pct = duration > 0 ? currentTime / duration : 0;
    return (
      <Tooltip title={`${track.title}${track.artist ? ' · ' + track.artist : ''}`} placement="right">
        <Box
          role="button"
          tabIndex={0}
          aria-label={`展开播放器:${track.title}`}
          onClick={() => musicPlayer.setCollapsed(false)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && musicPlayer.setCollapsed(false)}
          sx={{
            position: 'fixed',
            left: 16,
            bottom: BOTTOM,
            zIndex: 1300,
            width: DISC + 8,
            height: DISC + 8,
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `conic-gradient(${theme.palette.primary.main} ${pct * 360}deg, ${alpha(theme.palette.text.primary, 0.12)} 0)`,
            boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
            transition: 'transform 160ms',
            '&:hover': { transform: 'scale(1.06)' },
          }}
        >
          <Cover track={track} size={DISC} spin={playing} />
          {!playing && (
            <PlayArrowRoundedIcon sx={{ position: 'absolute', color: '#fff', fontSize: 28, filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }} />
          )}
        </Box>
      </Tooltip>
    );
  }

  return (
    <Box
      role="region"
      aria-label="音乐播放器"
      sx={{
        position: 'fixed',
        left: { xs: 8, md: '50%' },
        right: { xs: 8, md: 'auto' },
        transform: { md: 'translateX(-50%)' },
        width: { md: 'min(880px, calc(100vw - 48px))' },
        bottom: BOTTOM,
        height: BAR_H,
        zIndex: 1300,
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1, md: 1.5 },
        pl: 0.75,
        pr: { xs: 0.75, md: 1.5 },
        overflow: 'hidden',
        animation: 'qqBarIn 260ms cubic-bezier(.2,.8,.2,1)',
        '@keyframes qqBarIn': { from: { opacity: 0, translate: '0 20px' }, to: { opacity: 1, translate: '0 0' } },
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        ...glass,
      }}
    >
      {/* 移动端:顶边一条细进度 */}
      <Box sx={{ display: { xs: 'block', md: 'none' }, position: 'absolute', left: 24, right: 24, bottom: 0, height: 2, bgcolor: 'divider' }}>
        <Box sx={{ height: '100%', width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, bgcolor: 'primary.main' }} />
      </Box>

      <Box
        role="button"
        tabIndex={0}
        aria-label="打开歌曲详情"
        onClick={openDetail}
        onKeyDown={(e) => e.key === 'Enter' && openDetail()}
        sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, flex: { xs: 1, md: '0 1 240px' }, cursor: 'pointer' }}
      >
        <Cover track={track} size={52} spin={playing} />
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {track.title}
          </Box>
          <Box sx={{ fontSize: 12, color: error ? 'error.main' : 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {error || [track.artist, track.preview ? '试听片段' : ''].filter(Boolean).join(' · ') || '清秋月'}
          </Box>
        </Box>
      </Box>

      {/* 桌面端:居中控制 + 进度 */}
      <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title={repeat === 'one' ? '单曲循环' : repeat === 'all' ? '列表循环' : '不循环'}>
            <IconButton size="small" onClick={() => musicPlayer.cycleRepeat()} aria-label="循环模式" sx={{ color: repeat === 'off' ? 'text.disabled' : 'primary.main' }}>
              {repeat === 'one' ? <RepeatOneRoundedIcon fontSize="small" /> : <RepeatRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={() => musicPlayer.prev()} aria-label="上一首" sx={{ color: 'text.primary' }}>
            <SkipPreviousRoundedIcon />
          </IconButton>
          {playBtn(false)}
          <IconButton size="small" onClick={() => musicPlayer.next()} aria-label="下一首" sx={{ color: 'text.primary' }}>
            <SkipNextRoundedIcon />
          </IconButton>
          <Tooltip title={shuffle ? '随机播放:开' : '随机播放:关'}>
            <IconButton size="small" onClick={() => musicPlayer.toggleShuffle()} aria-label="随机播放" aria-pressed={shuffle} sx={{ color: shuffle ? 'primary.main' : 'text.disabled' }}>
              <ShuffleRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', mt: -0.75 }}>
          <Box sx={{ fontSize: 11, color: 'text.secondary', minWidth: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(shown)}</Box>
          <Slider
            size="small"
            aria-label="播放进度"
            value={Math.min(shown, duration || 0)}
            max={duration || 1}
            disabled={!duration}
            onChange={(_, v) => setScrub(v as number)}
            onChangeCommitted={(_, v) => {
              musicPlayer.seek(v as number);
              setScrub(null);
            }}
            sx={{ py: 0.5, '& .MuiSlider-thumb': { width: 10, height: 10 } }}
          />
          <Box sx={{ fontSize: 11, color: 'text.secondary', minWidth: 34, fontVariantNumeric: 'tabular-nums' }}>{fmt(duration)}</Box>
        </Box>
      </Box>

      {/* 移动端:只留播放 + 下一首 */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
        {playBtn(false)}
        <IconButton size="small" onClick={() => musicPlayer.next()} aria-label="下一首" sx={{ color: 'text.primary' }}>
          <SkipNextRoundedIcon />
        </IconButton>
      </Box>

      <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', width: 120 }}>
        <IconButton size="small" onClick={() => musicPlayer.toggleMute()} aria-label={muted ? '打开声音' : '静音'} sx={{ color: 'text.secondary' }}>
          {muted || volume === 0 ? <VolumeOffRoundedIcon fontSize="small" /> : <VolumeUpRoundedIcon fontSize="small" />}
        </IconButton>
        <Slider
          size="small"
          aria-label="音量"
          value={muted ? 0 : Math.round(volume * 100)}
          onChange={(_, v) => musicPlayer.setVolume((v as number) / 100)}
          sx={{ mx: 1, '& .MuiSlider-thumb': { width: 10, height: 10 } }}
        />
      </Box>

      <Tooltip title="播放队列">
        <IconButton size="small" onClick={(e) => setQueueAnchor(e.currentTarget)} aria-label={`播放队列,共 ${queueLen} 首`} sx={{ color: 'text.secondary' }}>
          <QueueMusicRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="收起">
        <IconButton size="small" onClick={() => musicPlayer.setCollapsed(true)} aria-label="收起播放器" sx={{ color: 'text.secondary' }}>
          <KeyboardArrowDownRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="停止并关闭">
        <IconButton size="small" onClick={() => musicPlayer.close()} aria-label="停止并关闭播放器" sx={{ color: 'text.secondary' }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {queuePopover}
      {extras}
    </Box>
  );
}
