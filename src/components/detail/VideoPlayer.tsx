'use client';

import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AIGCBadge from '@/components/AIGCBadge';

/** 将各平台视频页 URL 转换为 iframe embed URL */
function toEmbedUrl(url: string): string | null {
  if (!url) return null;

  // B站: BV号 → player.bilibili.com
  const bvMatch = url.match(/bilibili\.com\/video\/(BV[\w]+)/);
  if (bvMatch) return `https://player.bilibili.com/player.html?bvid=${bvMatch[1]}&autoplay=0`;

  // B站: av号
  const avMatch = url.match(/bilibili\.com\/video\/av(\d+)/);
  if (avMatch) return `https://player.bilibili.com/player.html?aid=${avMatch[1]}&autoplay=0`;

  // 腾讯视频: vid → v.qq.com/iframe/player
  const txVidMatch = url.match(/v\.qq\.com\/.*?vid=([^&/?#]+)/);
  if (txVidMatch) {
    return `https://v.qq.com/iframe/player.html?vid=${txVidMatch[1]}&width=100%&height=100%&autoplay=0`;
  }
  // 腾讯视频 cover 格式: /x/cover/{vid}.html
  const txCoverMatch = url.match(/v\.qq\.com\/x\/cover\/([^/.?#]+)/);
  if (txCoverMatch) {
    return `https://v.qq.com/iframe/player.html?vid=${txCoverMatch[1]}&width=100%&height=100%&autoplay=0`;
  }

  // 芒果 TV: /b/{bid}/{cid}.html → player.mgtv.com iframe play
  const mgMatch = url.match(/mgtv\.com\/b\/(\d+)\/(\d+)/);
  if (mgMatch) return `https://player.mgtv.com/mgtv-iframe-play/?bid=${mgMatch[1]}&cid=${mgMatch[2]}`;

  // 芒果 TV 短格式: /b/{bid}/
  const mgBidMatch = url.match(/mgtv\.com\/b\/(\d+)/);
  if (mgBidMatch) return `https://player.mgtv.com/mgtv-iframe-play/?bid=${mgBidMatch[1]}`;

  // 虎牙直播
  const hyMatch = url.match(/huya\.com\/(\w+)/);
  if (hyMatch) return `https://live.huya.com/l/${hyMatch[1]}`;

  // 网易云音乐
  const wyMatch = url.match(/music\.163\.com\/song\?id=(\d+)/);
  if (wyMatch) return `https://music.163.com/outchain/player?id=${wyMatch[1]}&type=0&height=90`;

  return null;
}

/** 检测 source URL 是否来自禁止 iframe 的平台 */
function isIframeBlocked(url: string): boolean {
  if (!url) return true;
  return /douyin\.com/i.test(url);
}

interface Props {
  src?: string;
  /** 外部平台视频页 URL（如 https://www.bilibili.com/video/BVxxx ） */
  sourceUrl?: string;
  poster?: string;
  initialDuration?: number;
  onEnded?: () => void;
  autoPlay?: boolean;
  /** 国家网信办 AIGC 合规:当视频内容由 AI 生成时,显示「AI 生成」角标 */
  isAIGenerated?: boolean;
}

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({ src, sourceUrl, poster, initialDuration = 600, onEnded, autoPlay = false, isAIGenerated = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // 优先用 sourceUrl iframe 嵌入播放；无 sourceUrl 则用直接 src
  const embedUrl = sourceUrl ? toEmbedUrl(sourceUrl) : null;
  const iframeMode = !!embedUrl && !src;
  const iframeBlocked = sourceUrl && isIframeBlocked(sourceUrl);

  useEffect(() => {
    if (autoPlay && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [autoPlay, src]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) {
      setPlaying((p) => !p);
      return;
    }
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoaded = () => {
    if (videoRef.current) setDuration(videoRef.current.duration || initialDuration);
  };

  const handleSeek = (_: any, v: number | number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = v as number;
      setCurrentTime(v as number);
    }
  };

  const handleVolume = (_: any, v: number | number[]) => {
    const n = v as number;
    setVolume(n);
    if (videoRef.current) videoRef.current.volume = n / 100;
    if (n > 0) setMuted(false);
  };

  const seek = (delta: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + delta));
    }
  };

  const goFullscreen = () => {
    const el = videoRef.current?.parentElement;
    if (el && document.fullscreenElement) {
      document.exitFullscreen();
    } else if (el?.requestFullscreen) {
      el.requestFullscreen();
    }
  };

  return (
    <Box
      onMouseMove={() => setControlsVisible(true)}
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9',
        bgcolor: '#000',
        borderRadius: 2,
        overflow: 'hidden',
        '&:hover .controls': { opacity: 1 },
      }}
    >
      {/* iframe 嵌入模式:sourceUrl 有可嵌入播放器时使用 */}
      {iframeMode ? (
        <iframe
          src={embedUrl!}
          allowFullScreen
          allow="autoplay; fullscreen"
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="视频播放器"
        />
      ) : src ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoaded}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            onEnded?.();
          }}
          style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            backgroundImage: poster ? `url(${poster})` : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {/* iframe 被平台禁止时:显示封面 + 跳转按钮 */}
          {iframeBlocked ? (
            <Box sx={{ textAlign: 'center' }}>
              <IconButton
                component="a"
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  bgcolor: 'rgba(254, 44, 85, 0.9)',
                  color: '#fff',
                  '&:hover': { bgcolor: 'primary.main' },
                  width: 80,
                  height: 80,
                }}
              >
                <OpenInNewIcon sx={{ fontSize: 36 }} />
              </IconButton>
              <Box sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, mt: 1 }}>
                跳转到平台播放
              </Box>
            </Box>
          ) : !playing ? (
            <IconButton
              onClick={togglePlay}
              sx={{
                bgcolor: 'rgba(254, 44, 85, 0.9)',
                color: 'text.primary',
                '&:hover': { bgcolor: 'primary.main' },
                width: 80,
                height: 80,
              }}
            >
              <PlayArrowIcon sx={{ fontSize: 48 }} />
            </IconButton>
          ) : null}
        </Box>
      )}

      {/* AIGC 合规角标:视频左上角,只在 isAIGenerated=true 时出现 */}
      {isAIGenerated && <AIGCBadge variant="overlay" top={10} left={10} label="AI 生成视频" />}

      {/* 中心播放按钮 (视频模式,暂停时显示;iframe 模式由外部播放器控制) */}
      {src && !playing && !iframeMode && (
        <Box
          onClick={togglePlay}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              bgcolor: 'rgba(254, 44, 85, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            }}
          >
            <PlayArrowIcon sx={{ fontSize: 44, color: 'text.primary' }} />
          </Box>
        </Box>
      )}

      {/* 控制条 (iframe 模式由外部播放器控制,不显示) */}
      {src && !iframeMode && (
        <Box
          className="controls"
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
            p: 1.5,
            opacity: controlsVisible ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
        >
          <Slider
            size="small"
            value={currentTime}
            max={duration}
            onChange={handleSeek}
            sx={{ color: 'primary.main', mb: 1, py: 0.5 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}>
            <IconButton onClick={togglePlay} size="small" sx={{ color: 'text.primary' }}>
              {playing ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <IconButton onClick={() => seek(-10)} size="small" sx={{ color: 'text.primary' }}>
              <Replay10Icon fontSize="small" />
            </IconButton>
            <IconButton onClick={() => seek(10)} size="small" sx={{ color: 'text.primary' }}>
              <Forward10Icon fontSize="small" />
            </IconButton>
            <Box sx={{ fontSize: 12, minWidth: 80 }}>
              {fmt(currentTime)} / {fmt(duration)}
            </Box>
            <Box sx={{ flex: 1 }} />
            <IconButton onClick={() => setMuted((m) => !m)} size="small" sx={{ color: 'text.primary' }}>
              {muted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
            </IconButton>
            <Slider
              size="small"
              value={muted ? 0 : volume}
              onChange={handleVolume}
              sx={{ color: 'primary.main', width: 80, mx: 1 }}
            />
            <IconButton onClick={goFullscreen} size="small" sx={{ color: 'text.primary' }}>
              <FullscreenIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}
    </Box>
  );
}
