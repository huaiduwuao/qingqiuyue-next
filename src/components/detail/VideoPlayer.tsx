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
import CircularProgress from '@mui/material/CircularProgress';
import AIGCBadge from '@/components/AIGCBadge';
import { parseStream } from '@/apis/stream';

interface StreamInfo {
  quality: string;
  resolution: string;
  url: string;
  needPay: boolean;
  format: string;
}

interface Props {
  /** 直接的视频文件 URL（优先级最高） */
  src?: string;
  /** 外部平台视频页 URL，自动匹配解析器获取 m3u8 */
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
  const hlsRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [currentStream, setCurrentStream] = useState(0);
  const [platformName, setPlatformName] = useState<string>('');

  // 加载外部平台流（通过通用 API 解析）
  useEffect(() => {
    if (!sourceUrl || src) return;

    // React StrictMode 下 effect 会跑两次,且 unmount 可能晚于异步回调;
    // 用 AbortController 真正取消未完成的请求 + cancelled 标志避免 setState 写已 unmount 组件。
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setStreamError(null);
    setStreams([]);
    setPlatformName('');

    parseStream(sourceUrl)
      .then(data => {
        if (cancelled) return;
        if (data.code === 0 && data.data?.streams?.length > 0) {
          setStreams(data.data.streams);
          setPlatformName(data.data.platformName || data.data.platform || '');
          setCurrentStream(0);
        } else {
          setStreamError(data.msg || '无法解析视频流');
        }
      })
      .catch(e => {
        if (cancelled || e?.name === 'AbortError') return;
        console.error('Stream parse error:', e);
        setStreamError('解析失败');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sourceUrl, src]);

  // 外部平台流(m3u8)走同源 /api/proxy 代理,注入平台 Referer 绕过防盗链+CORS;
  // 抖音 mp4 直链等可直连的不代理。
  const toPlayableUrl = (url: string) => {
    if (!url) return url;
    // 防盗链平台(mgtv/bilibili/qq/网易/虎牙)的 m3u8/ts 需走同源代理注入 Referer
    if (/(mgtv\.com|bilivideo\.com|hdslb\.com|bilibili\.com|gtimg\.com|v\.qq\.com|126\.net|huya\.com)/i.test(url)) {
      return `/api/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  };

  const playStream = (url: string, format?: string) => {
    if (!videoRef.current) return;
    const playUrl = toPlayableUrl(url);

    // 清理旧的 HLS 实例
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // mp4 直链走原生播放(抖音等),m3u8 走 hls.js
    const isMp4 = /\.mp4(\?|$)/i.test(playUrl) || playUrl.includes('mime_type=video_mp4') || playUrl.includes('mime_type=video');
    if (isMp4) {
      videoRef.current.src = playUrl;
      if (autoPlay) {
        videoRef.current.play().catch(() => {});
      }
      return;
    }

    // 动态导入 hls.js
    import('hls.js').then(({ default: Hls }) => {
      if (!videoRef.current) return;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
        });

        hlsRef.current = hls;

        hls.loadSource(playUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // 关键守卫:卸载后回调不应再触发
          if (!videoRef.current) return;
          if (autoPlay) {
            videoRef.current.play().catch(() => {});
          }
          setPlaying(!videoRef.current.paused);
        });

        hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
          if (!videoRef.current) return;
          if (data.fatal) {
            console.error('[VideoPlayer] HLS fatal error:', {
              type: data.type,
              details: data.details,
              err: data.error?.message || data.error,
              url: data.context?.url,
            });
            const msg = data.details === 'manifestLoadError'
              ? '清单加载失败（代理可能被防火墙拦截）'
              : data.details === 'manifestParsingError'
              ? '清单解析失败'
              : data.details === 'levelLoadError'
              ? '清晰度加载失败'
              : data.details === 'fragmentLoadError'
              ? `分片加载失败: ${data.context?.url || ''}`
              : '播放失败，请尝试切换清晰度';
            setStreamError(msg);
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari 原生支持 HLS
        videoRef.current.src = playUrl;
        if (autoPlay) {
          videoRef.current.play().catch(() => {});
        }
      } else {
        setStreamError('当前浏览器不支持 HLS 播放');
      }
    });
  };

  // 切换清晰度
  const switchStream = (index: number) => {
    if (!streams[index]) return;
    setCurrentStream(index);
    playStream(streams[index].url, streams[index].format);
  };

  // streams 拿到后,异步请求解析完成时 <video> 还没渲染(videoRef.current = null);
  // 等到 streams 变化触发重渲染后再启动播放。这里依赖 currentStream 保证清晰度切换也走这条路。
  useEffect(() => {
    const s = streams[currentStream];
    if (!s) return;
    // 等下一帧,确保 hasVideo=true 的分支已挂载 <video>
    const raf = requestAnimationFrame(() => {
      if (videoRef.current) {
        playStream(s.url, s.format);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [streams, currentStream]);

  // 清理
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  // 自动播放
  useEffect(() => {
    if (autoPlay && videoRef.current && src) {
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
      v.play().then(() => setPlaying(true)).catch((e) => {
        console.error('play() rejected:', e);
        setStreamError('播放被浏览器拦截，请再点一次');
        setPlaying(false);
      });
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

  const hasVideo = src || streams.length > 0;

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
      {/* 视频元素（HLS 或直接源） */}
      {hasVideo ? (
        <>
          <video
            ref={videoRef}
            // 不设 src —— hls.js 通过 attachMedia(MediaSource API) 完全控制 video。
            // 否则原生 src 会与 hls.js 冲突,hls.js 解析失败导致视频静止。
            src={undefined}
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

          {/* 清晰度选择器 */}
          {streams.length > 1 && (
            <Box
              className="quality-selector"
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 10,
              }}
            >
              <Box
                component="select"
                value={currentStream}
                onChange={(e: any) => switchStream(parseInt(e.target.value))}
                sx={{
                  bgcolor: 'rgba(0,0,0,0.7)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 1,
                  px: 1,
                  py: 0.5,
                  fontSize: 12,
                  cursor: 'pointer',
                  outline: 'none',
                  '& option': { bgcolor: '#333' },
                }}
              >
                {streams.map((s, i) => (
                  <option key={i} value={i}>
                    {s.quality} {s.needPay ? '🔒' : ''}
                  </option>
                ))}
              </Box>
            </Box>
          )}
        </>
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
          {loading ? (
            <CircularProgress sx={{ color: '#fff' }} />
          ) : streamError ? (
            <Box sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', p: 2 }}>
              <Box sx={{ fontSize: 14, mb: 1 }}>{streamError}</Box>
              {streams.length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {streams.map((s, i) => (
                    <Box
                      key={i}
                      component="button"
                      onClick={() => switchStream(i)}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: 1,
                        color: '#fff',
                        px: 2,
                        py: 0.5,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      {s.quality}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ) : platformName ? (
            <Box sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
              正在解析 {platformName} 视频流...
            </Box>
          ) : (
            !playing && (
              <IconButton
                onClick={togglePlay}
                sx={{
                  bgcolor: 'rgba(254, 44, 85, 0.9)',
                  color: '#fff',
                  '&:hover': { bgcolor: 'primary.main' },
                  width: 80,
                  height: 80,
                }}
              >
                <PlayArrowIcon sx={{ fontSize: 48 }} />
              </IconButton>
            )
          )}
        </Box>
      )}

      {/* AIGC 合规角标 */}
      {isAIGenerated && <AIGCBadge variant="overlay" top={10} left={10} label="AI 生成视频" />}

      {/* 中心播放按钮 */}
      {hasVideo && !playing && (
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
            <PlayArrowIcon sx={{ fontSize: 44, color: '#fff' }} />
          </Box>
        </Box>
      )}

      {/* 控制条 */}
      {hasVideo && (
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
            max={duration || 100}
            onChange={handleSeek}
            sx={{ color: '#FE2C55', mb: 1, py: 0.5 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}>
            <IconButton onClick={togglePlay} size="small" sx={{ color: '#fff' }}>
              {playing ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <IconButton onClick={() => seek(-10)} size="small" sx={{ color: '#fff' }}>
              <Replay10Icon fontSize="small" />
            </IconButton>
            <IconButton onClick={() => seek(10)} size="small" sx={{ color: '#fff' }}>
              <Forward10Icon fontSize="small" />
            </IconButton>
            <Box sx={{ fontSize: 12, minWidth: 80 }}>
              {fmt(currentTime)} / {fmt(duration)}
            </Box>
            <Box sx={{ flex: 1 }} />
            <IconButton onClick={() => setMuted((m) => !m)} size="small" sx={{ color: '#fff' }}>
              {muted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
            </IconButton>
            <Slider
              size="small"
              value={muted ? 0 : volume}
              onChange={handleVolume}
              sx={{ color: '#FE2C55', width: 80, mx: 1 }}
            />
            <IconButton onClick={goFullscreen} size="small" sx={{ color: '#fff' }}>
              <FullscreenIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}
    </Box>
  );
}
