'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import PictureInPictureAltRoundedIcon from '@mui/icons-material/PictureInPictureAltRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import { useVideoDock, videoDock, pipSupported, togglePip, inPip, claimMediaSession, mediaSessionPaused } from '@/lib/player/videoDock';

const POS_KEY = 'qq-video-dock-pos';
const EDGE = 12;

function size() {
  const w = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const width = w < 600 ? Math.min(240, w - EDGE * 2) : 360;
  return { width, height: Math.round((width * 9) / 16) };
}

/** 默认右下角,避开底部导航和音乐底栏 */
function defaultPos() {
  const { width, height } = size();
  const inset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--player-inset')) || 0;
  return {
    x: window.innerWidth - width - EDGE,
    y: window.innerHeight - height - EDGE - inset - bottomNav(),
  };
}

function bottomNav() {
  const nav = document.querySelector('[data-mobile-bottom-nav]') as HTMLElement | null;
  return nav ? nav.offsetHeight : 0;
}

function clamp(p: { x: number; y: number }) {
  const { width, height } = size();
  return {
    x: Math.max(EDGE, Math.min(p.x, window.innerWidth - width - EDGE)),
    y: Math.max(EDGE, Math.min(p.y, window.innerHeight - height - EDGE - bottomNav())),
  };
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

/**
 * 全站视频小窗。可拖动;悬停出控制条:播放 / 静音 / 画中画 / 回到原位 / 关闭。
 * 视频元素本身由 VideoPlayer 创建,这里只负责把它挂进窗口(见 lib/player/videoDock)。
 */
export default function FloatingVideoDock() {
  const entry = useVideoDock((s) => s.entry);
  const router = useRouter();
  const slotRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [paused, setPaused] = useState(true);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState({ t: 0, d: 0 });
  const [pip, setPip] = useState(false);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  // 把视频元素挂进窗口。窗口要等位置算出来才渲染,所以 slot 出现和 entry 变化两头都要挂。
  const mount = () => {
    const v = entry?.el;
    const slot = slotRef.current;
    if (v && slot && v.parentNode !== slot) slot.appendChild(v);
  };
  const mountRef = useRef(mount);
  useLayoutEffect(() => {
    mountRef.current = mount;
    mount();
  });
  const slotCallback = useCallback((node: HTMLDivElement | null) => {
    slotRef.current = node;
    mountRef.current();
  }, []);

  // 同步元素状态
  useEffect(() => {
    const v = entry?.el;
    if (!v) return;
    const sync = () => {
      setPaused(v.paused);
      setMuted(v.muted);
      setTime({ t: v.currentTime, d: isFinite(v.duration) ? v.duration : 0 });
      setPip(inPip(v));
    };
    sync();
    // 页面已离开时,播放器的事件监听也跟着没了 —— 系统媒体控制由小窗来维护
    const onPlay = () => { if (!entry.owner) claimMediaSession(v, entry.title, entry.poster); };
    const onPause = () => mediaSessionPaused(v);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    const events = ['play', 'pause', 'timeupdate', 'volumechange', 'durationchange', 'enterpictureinpicture', 'leavepictureinpicture', 'webkitpresentationmodechanged'];
    events.forEach((e) => v.addEventListener(e, sync));
    return () => {
      events.forEach((e) => v.removeEventListener(e, sync));
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [entry]);

  // 位置:第一次出现时读上次的,窗口尺寸变化时夹回可视区
  useEffect(() => {
    if (!entry) return;
    setPos((p) => {
      if (p) return clamp(p);
      try {
        const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
        if (saved && typeof saved.x === 'number') return clamp(saved);
      } catch {
        /* ignore */
      }
      return clamp(defaultPos());
    });
    const onResize = () => setPos((p) => (p ? clamp(p) : p));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [entry]);

  if (!entry || !pos) return null;
  const { width, height } = size();
  const v = entry.el;

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const next = clamp({ x: e.clientX - d.dx, y: e.clientY - d.dy });
    if (Math.abs(next.x - pos.x) + Math.abs(next.y - pos.y) > 2) d.moved = true;
    setPos(next);
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) {
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(pos));
      } catch {
        /* ignore */
      }
    } else if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const goBack = () => {
    if (entry.owner) entry.onReturn?.();
    else router.push(entry.href);
  };

  const btn = { color: '#fff', p: 0.75, '&:hover': { bgcolor: 'rgba(255,255,255,0.16)' } };
  const progress = time.d > 0 ? (time.t / time.d) * 100 : 0;

  return (
    <Box
      role="region"
      aria-label={`小窗播放:${entry.title}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      sx={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width,
        height,
        zIndex: 1350,
        borderRadius: 2.5,
        overflow: 'hidden',
        bgcolor: '#000',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)',
        touchAction: 'none',
        cursor: 'grab',
        userSelect: 'none',
        animation: 'qqDockIn 220ms cubic-bezier(.2,.8,.2,1)',
        '@keyframes qqDockIn': { from: { opacity: 0, transform: 'translateY(16px) scale(0.96)' }, to: { opacity: 1, transform: 'none' } },
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        '&:active': { cursor: 'grabbing' },
        '& .dock-ui': { opacity: paused ? 1 : 0, transition: 'opacity 160ms' },
        '&:hover .dock-ui, &:focus-within .dock-ui': { opacity: 1 },
        '@media (hover: none)': { '& .dock-ui': { opacity: 1 } },
      }}
    >
      <Box ref={slotCallback} sx={{ position: 'absolute', inset: 0, '& video': { width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' } }} />

      {pip && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13, bgcolor: '#111' }}>
          正在画中画中播放
        </Box>
      )}

      <Box
        className="dock-ui"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), transparent 40%, transparent 60%, rgba(0,0,0,0.7))',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 1.25, pr: 0.5, pt: 0.5 }}>
          <Box sx={{ flex: 1, minWidth: 0, color: '#fff', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {entry.title}
          </Box>
          <Tooltip title={entry.owner ? '回到原位' : '回到视频页'}>
            <IconButton size="small" onClick={goBack} sx={btn} aria-label="回到视频页">
              <OpenInFullRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="关闭">
            <IconButton size="small" onClick={() => videoDock.close()} sx={btn} aria-label="关闭小窗">
              <CloseRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, pb: 0.75 }}>
          <IconButton size="small" onClick={() => (v.paused ? v.play().catch(() => {}) : v.pause())} sx={btn} aria-label={paused ? '播放' : '暂停'}>
            {paused ? <PlayArrowRoundedIcon /> : <PauseRoundedIcon />}
          </IconButton>
          <IconButton size="small" onClick={() => { v.muted = !v.muted; }} sx={btn} aria-label={muted ? '打开声音' : '静音'}>
            {muted ? <VolumeOffRoundedIcon sx={{ fontSize: 18 }} /> : <VolumeUpRoundedIcon sx={{ fontSize: 18 }} />}
          </IconButton>
          <Box sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontVariantNumeric: 'tabular-nums', ml: 0.5 }}>
            {fmt(time.t)}{time.d > 0 ? ` / ${fmt(time.d)}` : ''}
          </Box>
          <Box sx={{ flex: 1 }} />
          {pipSupported(v) && (
            <Tooltip title={pip ? '退出画中画' : '画中画'}>
              <IconButton size="small" onClick={() => togglePip(v)} sx={btn} aria-label="画中画">
                <PictureInPictureAltRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, bgcolor: 'rgba(255,255,255,0.18)' }}>
        <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: 'primary.main', transition: 'width 250ms linear' }} />
      </Box>
    </Box>
  );
}
