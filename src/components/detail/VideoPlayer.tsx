'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineRounded';
import CircularProgress from '@mui/material/CircularProgress';
import AIGCBadge from '@/components/AIGCBadge';
import { parseStream } from '@/apis/stream';
import { mediaUrl, proxyMediaUrl } from '@/lib/media';

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
  /**
   * 直链失效时用来重新解析的源站页面(不传则用 sourceUrl)。传 src(后端回填的直链、或
   * 上层自己解析好的地址)时也应带上:签名过期 / 被源站回收后,播放器会用它强制重新解析,
   * 从断点接着播;实在播不了时也用它给出「去原站观看」。
   */
  refreshSource?: string;
  poster?: string;
  initialDuration?: number;
  onEnded?: () => void;
  autoPlay?: boolean;
  /** 国家网信办 AIGC 合规:当视频内容由 AI 生成时,显示「AI 生成」角标 */
  isAIGenerated?: boolean;
  /**
   * 沉浸式短视频流模式(RecommendVideoFeed 等):撑满父容器高度、纯黑背景居中,
   * 而不是详情页那种固定 16:9 卡片。
   */
  fill?: boolean;
  /**
   * sourceUrl 解析失败时回调(拿到 streamError 那一刻触发)。VideoPlayer 本身不知道
   * 调用方的 contentId/contentType 是什么,不在这里直接调举报接口——由调用方决定
   * 要不要、以及怎么把"这条播不出来"这件事记下来(比如自动提交举报,让"暂时无法
   * 播放"不只是前端一句提示,而是后台真能看到、能处理的信号)。
   * 直链失效后自动重新解析成功的情况不会触发。
   */
  onPlaybackError?: (message: string) => void;
}

export interface VideoPlayerHandle {
  togglePlay: () => void;
  seek: (deltaSeconds: number) => void;
  isPlaying: () => boolean;
}

/** 同一段播放里,直链失效后最多自动重新解析几次(防止解析出来的地址本身就坏,来回打转) */
const MAX_RECOVER_ATTEMPTS = 2;
/** 恢复后正常播放超过这么久,重置重试计数(长视频两小时后签名再次过期时还能再救) */
const RECOVER_RESET_MS = 30_000;
/** 签名到期前多久主动换一条新直链 */
const PREEMPT_EXPIRY_MS = 60_000;

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { src, sourceUrl, refreshSource, poster, initialDuration = 600, onEnded, autoPlay = false, isAIGenerated = false, fill = false, onPlaybackError },
  ref,
) {
  // 封面同样经网关:调用方传进来的可能是 MinIO 内网直链或外站防盗链图。
  const posterUrl = mediaUrl(poster);
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
  /** 当前流签名最早的过期时间(unix 秒,0 = 未知),由后端 stream/resolve 给出 */
  const [expiresAt, setExpiresAt] = useState(0);
  /** 正在为失效直链重新解析 */
  const [refreshing, setRefreshing] = useState(false);

  // 直链失效恢复:重新解析后从断点、按原播放状态接着播
  const reparseUrl = sourceUrl || refreshSource || '';
  const recoverAttempts = useRef(0);
  const lastRecoverAt = useRef(0);
  const resumeAt = useRef(0);
  const resumePlaying = useRef(false);
  const refreshingRef = useRef(false);

  const fail = (msg: string) => {
    setStreamError(msg);
    onPlaybackError?.(msg);
  };

  /**
   * 直链失效(签名过期、源站 403、分片加载失败)时带 refresh=1 重新解析,换上新地址
   * 并从断点继续。以前这里直接显示「视频地址已失效」—— 缓存里的签名直链过期后,
   * 同一条内容在缓存失效前谁点都放不了。proactive = 签名到期前主动换链,不计入重试次数。
   */
  const recover = (reason: string, proactive = false) => {
    if (!reparseUrl || refreshingRef.current) {
      if (!proactive && !refreshingRef.current) fail(reason);
      return;
    }
    if (!proactive) {
      if (recoverAttempts.current >= MAX_RECOVER_ATTEMPTS) {
        fail(reason);
        return;
      }
      recoverAttempts.current += 1;
    }
    const v = videoRef.current;
    resumeAt.current = v?.currentTime || 0;
    resumePlaying.current = v ? !v.paused || !proactive : autoPlay;
    lastRecoverAt.current = Date.now();
    refreshingRef.current = true;
    setRefreshing(true);
    if (!proactive) setStreamError(null);

    parseStream(reparseUrl, { refresh: true })
      .then((data) => {
        const list: StreamInfo[] | undefined = data?.data?.streams;
        if (list?.length) {
          setExpiresAt(Number(data.data.expiresAt) || 0);
          setPlatformName(data.data.platformName || data.data.platform || '');
          setCurrentStream((i) => (i < list.length ? i : 0));
          setStreams(list); // 新数组 → 下面的 streams effect 重新 playStream
        } else if (!proactive) {
          fail(data?.msg || reason);
        }
      })
      .catch(() => {
        if (!proactive) fail(reason);
      })
      .finally(() => {
        refreshingRef.current = false;
        setRefreshing(false);
      });
  };
  // 播放器事件回调(hls.js / 定时器)里拿到的永远是最新的 recover
  const recoverRef = useRef(recover);
  useEffect(() => {
    recoverRef.current = recover;
  });

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
    setExpiresAt(0);
    recoverAttempts.current = 0;

    parseStream(sourceUrl)
      .then(data => {
        if (cancelled) return;
        // 后端 stream/resolve 成功返回 code=200,本地降级解析器成功返回 code=0——
        // 两套约定不一致(同类问题也出现在 RecommendVideoFeed 里,已一并修正)。
        // 有没有可播放流看 streams 数组即可,不用关心具体是哪个 code。
        if (data.data?.streams?.length > 0) {
          setStreams(data.data.streams);
          setPlatformName(data.data.platformName || data.data.platform || '');
          setExpiresAt(Number(data.data.expiresAt) || 0);
          setCurrentStream(0);
        } else {
          fail(data.msg || '无法解析视频流');
        }
      })
      .catch(e => {
        if (cancelled || e?.name === 'AbortError') return;
        console.error('Stream parse error:', e);
        fail('解析失败');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // fail / onPlaybackError 是回调,不作为重新解析的触发条件
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl, src]);

  // 签名到期前一分钟主动换链:正在播放的长视频不会播到一半断掉。
  // 暂停着的不换 —— 恢复播放时若已过期,走下面的出错恢复。
  useEffect(() => {
    if (!expiresAt || !reparseUrl) return;
    const ms = expiresAt * 1000 - Date.now() - PREEMPT_EXPIRY_MS;
    if (ms <= 0) return;
    const t = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) recoverRef.current('播放地址即将过期', true);
    }, Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [expiresAt, reparseUrl]);

  // 外部平台流(m3u8)走同源 /api/proxy 代理,注入平台 Referer 绕过防盗链+CORS;
  // 抖音 mp4 直链等可直连的不代理。
  const toPlayableUrl = (url: string) => {
    if (!url) return url;
    // 防盗链平台(mgtv/bilibili/qq/网易/虎牙)的 m3u8/ts 需走同源代理注入 Referer。
    // ⚠️ B 站不止 bilivideo.com:playurl 下发的还有 PCDN/MCDN 节点
    // (*.edge.mountaintoys.cn:4483、*.mcdn.bilivideo.cn:4483)和 Akamai 镜像
    // (upos-*.akamaized.net)。这几个域名以前漏在名单外 → 直连播放,而它们
    // 同样校验 Referer,浏览器里就是一片 403(推荐流里这类地址还占多数)。
    if (/(mgtv\.com|bilivideo\.com|bilivideo\.cn|mountaintoys\.cn|akamaized\.net|hdslb\.com|bilibili\.com|gtimg\.com|v\.qq\.com|126\.net|huya\.com)/i.test(url)) {
      // 经 proxyMediaUrl 带上网关前缀:Web 下是相对 /api/proxy,Tauri 打包下是
      // https://qingqiuyue.com/api/proxy 绝对地址,否则相对路径会请求应用自身 → 404 黑屏。
      return proxyMediaUrl(url);
    }
    return url;
  };

  const playStream = (url: string, format?: string) => {
    if (!videoRef.current) return;
    const playUrl = toPlayableUrl(url);
    // 换链恢复时按原播放状态继续,否则按 autoPlay
    const shouldPlay = resumeAt.current > 0 ? resumePlaying.current : autoPlay;

    // 清理旧的 HLS 实例
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // mp4 直链走原生播放(抖音等),m3u8 走 hls.js。
    // ⚠️ 必须用原始 url 判断,不能用 playUrl——B 站等防盗链域名会被 toPlayableUrl()
    // 包成 /api/proxy?url=encodeURIComponent(原始url),encodeURIComponent 会把
    // ".mp4?e=..." 里的 "?" 转义成 "%3F",导致 /\.mp4(\?|$)/ 永远匹配不上 playUrl。
    // 结果是所有经代理的 B 站 mp4 直链都被误判成"不是 mp4",走进 hls.js 分支——
    // 拿一个真正的 mp4 二进制文件当 m3u8 清单解析,播放器卡在 readyState=0 不动,
    // 界面上却显示"正在播放"(进度条是独立于视频本身的模拟状态)。
    const isMp4 = format === 'mp4' || /\.mp4(\?|$)/i.test(url) || url.includes('mime_type=video_mp4') || url.includes('mime_type=video');
    if (isMp4) {
      videoRef.current.src = playUrl;
      if (shouldPlay) {
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
          if (shouldPlay) {
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
            // 清单 / 分片拉不下来多半是签名过期:先重新解析换链,救不回来才报错
            recoverRef.current(msg);
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari 原生支持 HLS
        videoRef.current.src = playUrl;
        if (shouldPlay) {
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
    setStreamError(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streams, currentStream]);

  // 调用方直接传入已解析好的 src(如推荐流:上层自己调 parseStream 拿到播放地址
  // 再传下来)时,上面那个 effect 不会跑——它只在走 sourceUrl 内部解析、
  // streams 被填充时才触发。之前这种用法下 hasVideo 判定为 true、<video> 标签
  // 确实挂载了,但从没有任何代码把 src 真正喂给 playStream()/videoRef,导致
  // 播放器界面看着在播(进度条、暂停图标都是独立于视频本身的模拟状态),实际
  // 视频从未加载。这里补上:src prop 变化时直接播放它。
  useEffect(() => {
    if (!src) return;
    recoverAttempts.current = 0;
    const raf = requestAnimationFrame(() => {
      if (videoRef.current) {
        playStream(src);
      }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

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
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
    if (recoverAttempts.current > 0 && Date.now() - lastRecoverAt.current > RECOVER_RESET_MS) {
      recoverAttempts.current = 0;
    }
  };

  const handleLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration || initialDuration);
    // 换链后回到原来的进度
    if (resumeAt.current > 0) {
      v.currentTime = resumeAt.current;
      resumeAt.current = 0;
      if (resumePlaying.current) v.play().catch(() => {});
    }
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

  // 供外层(如 RecommendVideoFeed 的沉浸式竖滑手势)在不知道内部实现的情况下
  // 直接控制真实播放状态——之前 feed 侧维护了一份完全独立、只做界面模拟的
  // playing/currentTime,点击画面切换的是那份假状态,和这里真正的 <video>
  // 播放/暂停毫无关联。
  useImperativeHandle(ref, () => ({
    togglePlay,
    seek,
    isPlaying: () => playing,
  }));

  const hasVideo = src || streams.length > 0;
  // 实在播不了时给出原站链接(番剧 / 直播间等解析不出流、或需要源站会员的内容)
  const originLink = /^https?:\/\//.test(reparseUrl) ? reparseUrl : '';
  const originButton = originLink ? (
    <Box
      component="a"
      href={originLink}
      target="_blank"
      rel="noopener noreferrer"
      data-no-drag
      sx={{
        mt: 1,
        display: 'inline-block',
        px: 2,
        py: 0.5,
        borderRadius: 1,
        fontSize: 12,
        color: '#fff',
        textDecoration: 'none',
        border: '1px solid rgba(255,255,255,0.35)',
        bgcolor: 'rgba(255,255,255,0.08)',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
      }}
    >
      去原站观看
    </Box>
  ) : null;

  return (
    <Box
      onMouseMove={() => setControlsVisible(true)}
      sx={fill ? {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        bgcolor: '#000',
        overflow: 'hidden',
        '&:hover .controls': { opacity: 1 },
      } : {
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
            poster={posterUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoaded}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              onEnded?.();
            }}
            onError={() => {
              // mp4 直链签名过期 / 被回收时浏览器原生 <video> 只会停在黑屏(error.code=4,
              // 经代理的 403 也是这个)。原生 error 事件是唯一能捕捉到的地方(hls.js 那条
              // 路径有自己的 Hls.Events.ERROR)。先重新解析换链,救不回来再报错。
              const code = videoRef.current?.error?.code;
              recoverRef.current(code === 4 ? '视频地址已失效' : '视频加载失败');
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
            backgroundImage: posterUrl ? `url(${posterUrl})` : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
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
              <ErrorOutlineIcon sx={{ fontSize: 32, color: 'warning.main', mb: 0.5 }} />
              <Box sx={{ fontSize: 14, fontWeight: 600, color: '#fff', mb: 0.5 }}>该内容暂时无法播放</Box>
              <Box sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', mb: 1 }}>{streamError} · 已记录,尽快修复</Box>
              {originButton}
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
                data-no-drag
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

      {/* 直链失效,正在重新解析 */}
      {hasVideo && refreshing && !streamError && (
        <Box
          data-no-drag
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: 'rgba(0, 0, 0, 0.6)',
            color: '#fff',
            fontSize: 13,
            zIndex: 5,
          }}
        >
          <CircularProgress size={16} sx={{ color: '#fff' }} />
          正在刷新播放地址…
        </Box>
      )}

      {/* hasVideo 为 true 时播放失败(重新解析也救不回来)——
          之前 streamError 的文字提示只在 !hasVideo 分支里渲染,这种情况下
          <video> 元素明明已经挂载、彻底放不出来,却没有任何反馈,用户看到的
          就是一块卡死的黑屏,分不清是加载慢还是这条内容根本坏了。 */}
      {hasVideo && streamError && (
        <Box
          data-no-drag
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.5,
            px: 3,
            py: 2,
            borderRadius: 2,
            bgcolor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            textAlign: 'center',
            maxWidth: 280,
            zIndex: 5,
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 32, color: 'warning.main' }} />
          <Box sx={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>该内容暂时无法播放</Box>
          <Box sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{streamError} · 已记录,尽快修复</Box>
          {originButton}
        </Box>
      )}

      {/* 中心播放按钮 */}
      {hasVideo && !playing && !streamError && !refreshing && (
        <Box
          data-no-drag
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
          data-no-drag
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
});

export default VideoPlayer;
