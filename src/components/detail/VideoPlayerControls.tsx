'use client';

/**
 * VideoPlayer 的控制条(从 VideoPlayer.tsx 拆出,JSX 原样搬):进度条 / 时间文字(各自订阅
 * TimeStore,播放进度不进播放器 state)、详情页底部控制条、推荐流右上角按钮 + 贴底进度条、页内全屏浮层。
 */
import React, { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import PictureInPictureAltIcon from '@mui/icons-material/PictureInPictureAlt';
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';
import { formatDuration } from '@/lib/utils/format';
import { type ScrubEndHandler, type ScrubHandler, type TimeStore } from './videoPlayerUtils';

/** 推荐流右上角的圆形玻璃按钮 */
const FILL_BTN_SX = {
  color: '#fff',
  bgcolor: 'rgba(0,0,0,0.35)',
  backdropFilter: 'blur(6px)',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.55)' },
} as const;

/**
 * 进度条:看得见的轨道 3–4px,可点/可拖的区域上下各多出 10–16px(手指不用瞄准一根细线);
 * 悬停或拖动时轨道加粗、滑块放大。thick = 推荐流那条贴底的。
 */
function seekBarSx(thick: boolean) {
  return {
    display: 'block',
    color: '#FE2C55',
    height: thick ? 4 : 3,
    borderRadius: 2,
    py: thick ? '14px' : '10px',
    '@media (pointer: coarse)': { py: thick ? '16px' : '12px' },
    transition: 'height 0.15s',
    '&:hover, &:has(.Mui-active)': { height: thick ? 8 : 6 },
    '& .MuiSlider-rail': { bgcolor: '#fff', opacity: 0.3 },
    '& .MuiSlider-track': { border: 'none' },
    '& .MuiSlider-thumb': {
      width: thick ? 12 : 14,
      height: thick ? 12 : 14,
      transition: 'box-shadow 0.15s, width 0.15s, height 0.15s',
      '&::before': { boxShadow: 'none' },
      '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 0 6px rgba(254,44,85,0.22)' },
      '&.Mui-active': { width: 20, height: 20, boxShadow: '0 0 0 8px rgba(254,44,85,0.22)' },
    },
    '& .MuiSlider-valueLabel': { bgcolor: 'rgba(0,0,0,0.75)', fontSize: 12, fontVariantNumeric: 'tabular-nums' },
  } as const;
}

/** 推荐流贴底进度条:桌面上再粗一点(模块级常量,memo 的进度条不因 sx 新对象重渲染) */
const FILL_SEEK_SX = {
  ...seekBarSx(true),
  '@media (min-width: 900px)': {
    height: 6,
    '&:hover, &:has(.Mui-active)': { height: 10 },
    '& .MuiSlider-thumb': { width: 14, height: 14 },
  },
};
const BAR_SEEK_SX = seekBarSx(false);

/** 进度条:自己订阅播放进度;拖动中(scrub 非 null)显示拖动位置,松手才 seek */
export const SeekSlider = memo(function SeekSlider({
  time,
  scrub,
  duration,
  onScrub,
  onScrubEnd,
  sx,
  valueLabel = false,
}: {
  time: TimeStore;
  scrub: number | null;
  duration: number;
  onScrub: ScrubHandler;
  onScrubEnd: ScrubEndHandler;
  sx: object;
  valueLabel?: boolean;
}) {
  const t = useSyncExternalStore(time.subscribe, time.get, time.get);
  return (
    <Slider
      aria-label="播放进度"
      value={scrub ?? t}
      max={duration || 100}
      onChange={onScrub}
      onChangeCommitted={onScrubEnd}
      valueLabelDisplay={valueLabel ? 'auto' : undefined}
      valueLabelFormat={valueLabel ? formatDuration : undefined}
      sx={sx}
    />
  );
});

/** 「当前 / 总时长」文字:只订阅到整秒,一秒最多刷新一次 */
export const PlayTime = memo(function PlayTime({ time, scrub, duration }: { time: TimeStore; scrub: number | null; duration: number }) {
  const getSec = useCallback(() => Math.floor(time.get()), [time]);
  const sec = useSyncExternalStore(time.subscribe, getSec, getSec);
  return (
    <>
      {formatDuration(scrub ?? sec)} / {formatDuration(duration)}
    </>
  );
});

/**
 * 推荐流(fill):抖音式 —— 底边一整条粗进度条(拖动时加粗 + 大号时间),声音/全屏收到右上角,
 * 不再在底部叠一整排按钮(会压住作者和标题)。单击画面暂停由 RecommendVideoFeed 处理。
 */
export const FillControls = memo(function FillControls({
  time,
  scrub,
  duration,
  muted,
  volume,
  pip,
  pipOk,
  isFs,
  onToggleMute,
  onVolume,
  onTogglePip,
  onFullscreen,
  onScrub,
  onScrubEnd,
}: {
  time: TimeStore;
  scrub: number | null;
  duration: number;
  muted: boolean;
  volume: number;
  pip: boolean;
  pipOk: boolean;
  isFs: boolean;
  onToggleMute: () => void;
  onVolume: (e: unknown, v: number | number[]) => void;
  onTogglePip: () => void;
  onFullscreen: () => void;
  onScrub: ScrubHandler;
  onScrubEnd: ScrubEndHandler;
}) {
  return (
    <>
      <Box
        data-no-drag
        className="controls"
        sx={{ position: 'absolute', top: 10, right: 10, zIndex: 6, display: 'flex', gap: 0.75 }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            borderRadius: 99,
            ...FILL_BTN_SX,
            '& .qq-vol': { width: 0, opacity: 0, transition: 'width 0.2s, opacity 0.2s, margin 0.2s' },
            '@media (hover: hover)': {
              '&:hover .qq-vol, &:focus-within .qq-vol': { width: 84, opacity: 1, ml: 0.5, mr: 1.5 },
            },
          }}
        >
          <IconButton onClick={onToggleMute} size="small" aria-label={muted ? '打开声音' : '静音'} sx={{ color: '#fff' }}>
            {muted || volume === 0 ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
          </IconButton>
          <Box className="qq-vol" sx={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <Slider
              size="small"
              aria-label="音量"
              value={muted ? 0 : volume}
              onChange={onVolume}
              sx={{ color: '#fff', width: 76, mx: 0.5, flexShrink: 0 }}
            />
          </Box>
        </Box>
        {pipOk && (
          <IconButton onClick={onTogglePip} size="small" aria-label={pip ? '退出画中画' : '画中画'} title={pip ? '退出画中画' : '画中画'} sx={{ ...FILL_BTN_SX, color: pip ? '#FE2C55' : '#fff' }}>
            <PictureInPictureAltIcon fontSize="small" />
          </IconButton>
        )}
        <IconButton onClick={onFullscreen} size="small" aria-label={isFs ? '退出全屏' : '全屏'} sx={FILL_BTN_SX}>
          {isFs ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
        </IconButton>
      </Box>
      {/* 拖动时的大号时间,放在作者/标题浮层(底部 ~30–120px)上面 */}
      {scrub !== null && (
        <Box
          aria-hidden
          sx={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(var(--player-inset, 0px) + 132px)', zIndex: 6, textAlign: 'center', pointerEvents: 'none', color: '#fff', fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}
        >
          {formatDuration(scrub)} <Box component="span" sx={{ opacity: 0.6 }}>/ {formatDuration(duration)}</Box>
        </Box>
      )}
      <Box
        data-no-drag
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          // 手机:贴着底栏;桌面:圆角画布里、离底边一点,不被圆角和视口底边切掉
          bottom: { xs: 'calc(var(--player-inset, 0px) - 10px)', md: 'calc(var(--player-inset, 0px) - 2px)' },
          zIndex: 6,
          px: { xs: 1.5, md: 2 },
        }}
      >
        <SeekSlider time={time} scrub={scrub} duration={duration} onScrub={onScrub} onScrubEnd={onScrubEnd} sx={FILL_SEEK_SX} />
      </Box>
    </>
  );
});

/** 详情页底部控制条 */
export const ControlBar = memo(function ControlBar({
  time,
  scrub,
  duration,
  compact,
  controlsVisible,
  playing,
  muted,
  volume,
  pip,
  pipOk,
  isFs,
  onTogglePlay,
  onSeek,
  onToggleMute,
  onVolume,
  onTogglePip,
  onFullscreen,
  onScrub,
  onScrubEnd,
}: {
  time: TimeStore;
  scrub: number | null;
  duration: number;
  compact: boolean;
  controlsVisible: boolean;
  playing: boolean;
  muted: boolean;
  volume: number;
  pip: boolean;
  pipOk: boolean;
  isFs: boolean;
  onTogglePlay: () => void;
  onSeek: (delta: number) => void;
  onToggleMute: () => void;
  onVolume: (e: unknown, v: number | number[]) => void;
  onTogglePip: () => void;
  onFullscreen: () => void;
  onScrub: ScrubHandler;
  onScrubEnd: ScrubEndHandler;
}) {
  return (
    <Box
      data-no-drag
      className="controls"
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
        px: compact ? 1 : 1.5,
        pb: compact ? 0.5 : 1,
        pt: 2,
        opacity: controlsVisible ? 1 : 0,
        transition: 'opacity 0.2s',
      }}
    >
      <SeekSlider time={time} scrub={scrub} duration={duration} onScrub={onScrub} onScrubEnd={onScrubEnd} sx={BAR_SEEK_SX} valueLabel />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: compact ? 0.25 : 1, color: '#fff' }}>
        <IconButton onClick={onTogglePlay} size="small" aria-label={playing ? '暂停' : '播放'} sx={{ color: '#fff' }}>
          {playing ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        {!compact && (
          <>
            <IconButton onClick={() => onSeek(-10)} size="small" aria-label="后退 10 秒" sx={{ color: '#fff' }}>
              <Replay10Icon fontSize="small" />
            </IconButton>
            <IconButton onClick={() => onSeek(10)} size="small" aria-label="快进 10 秒" sx={{ color: '#fff' }}>
              <Forward10Icon fontSize="small" />
            </IconButton>
          </>
        )}
        <Box sx={{ fontSize: compact ? 11 : 12, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          <PlayTime time={time} scrub={scrub} duration={duration} />
        </Box>
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onToggleMute} size="small" aria-label={muted ? '打开声音' : '静音'} sx={{ color: '#fff' }}>
          {muted || volume === 0 ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
        </IconButton>
        {/* 手机上音量走系统按键,不放音量条(放了整行就挤出屏幕,全屏键被切掉) */}
        {!compact && (
          <Slider
            size="small"
            aria-label="音量"
            value={muted ? 0 : volume}
            onChange={onVolume}
            sx={{ color: '#FE2C55', width: 80, mx: 1 }}
          />
        )}
        {pipOk && (
          <IconButton onClick={onTogglePip} size="small" aria-label={pip ? '退出画中画' : '画中画'} title={pip ? '退出画中画' : '画中画'} sx={{ color: pip ? '#FE2C55' : '#fff' }}>
            <PictureInPictureAltIcon fontSize="small" />
          </IconButton>
        )}
        <IconButton onClick={onFullscreen} size="small" aria-label={isFs ? '退出全屏' : '全屏'} sx={{ color: '#fff' }}>
          {isFs ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
        </IconButton>
      </Box>
    </Box>
  );
});

/**
 * 页内全屏:铺满视口的黑底浮层,<video> 由 VideoPlayer 挪进 hostRef。点画面切换控制条,
 * 控制条 3 秒不动自己收起。挂在 body 下(推荐流的祖先有 transform,fixed 在里面铺不满)。
 */
export const PseudoFullscreen = memo(function PseudoFullscreen({
  hostRef,
  playing,
  time,
  scrub,
  duration,
  muted,
  onTogglePlay,
  onScrub,
  onScrubEnd,
  onToggleMute,
  onExit,
}: {
  hostRef: (node: HTMLDivElement | null) => void;
  playing: boolean;
  time: TimeStore;
  scrub: number | null;
  duration: number;
  muted: boolean;
  onTogglePlay: () => void;
  onScrub: ScrubHandler;
  onScrubEnd: ScrubEndHandler;
  onToggleMute: () => void;
  onExit: () => void;
}) {
  const [shown, setShown] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poke = useCallback(() => {
    setShown(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(false), 3000);
  }, []);
  useEffect(() => {
    poke();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poke]);
  return (
    <Box
      data-no-drag
      data-no-swipe
      role="dialog"
      aria-label="全屏播放"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      sx={{ position: 'fixed', inset: 0, zIndex: 1600, bgcolor: '#000', animation: 'qq-fade-in 0.2s ease-out both', touchAction: 'none' }}
    >
      <Box ref={hostRef} onClick={() => (shown ? setShown(false) : poke())} sx={{ position: 'absolute', inset: 0 }} />
      <Box
        onPointerDown={poke}
        sx={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          px: 'max(12px, env(safe-area-inset-left))',
          pb: 'max(8px, var(--sab, 0px))',
          pt: 3,
          background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
          color: '#fff',
          opacity: shown ? 1 : 0,
          pointerEvents: shown ? 'auto' : 'none',
          transition: 'opacity 0.2s',
        }}
      >
        <SeekSlider time={time} scrub={scrub} duration={duration} onScrub={onScrub} onScrubEnd={onScrubEnd} sx={BAR_SEEK_SX} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={onTogglePlay} aria-label={playing ? '暂停' : '播放'} sx={{ color: '#fff' }}>
            {playing ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
          <Box sx={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
            <PlayTime time={time} scrub={scrub} duration={duration} />
          </Box>
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={onToggleMute} aria-label={muted ? '打开声音' : '静音'} sx={{ color: '#fff' }}>
            {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </IconButton>
          <IconButton onClick={onExit} aria-label="退出全屏" sx={{ color: '#fff' }}>
            <FullscreenExitIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
});
