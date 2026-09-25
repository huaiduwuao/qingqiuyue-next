'use client';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import PictureInPictureAltIcon from '@mui/icons-material/PictureInPictureAlt';
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineRounded';
import CloudOffIcon from '@mui/icons-material/CloudOffRounded';
import CircularProgress from '@mui/material/CircularProgress';
import AIGCBadge from '@/components/AIGCBadge';
import { parseStream, checkStreamAccess, BANDWIDTH_NOTICE } from '@/apis/stream';
import { mediaUrl, isExternalStreamUrl } from '@/lib/media';
import { originOnlyPlatform, ORIGIN_ONLY_NOTICE } from '@/lib/sourcePage';
import { isDesktopClient, openExternalUrl } from '@/lib/clientAuth';
import { canResolveLocally, resolveStream } from '@/lib/localStream/engine';
import { loadRules, matchProvider } from '@/lib/localStream/rules';
import { attachLocalStream } from '@/lib/localStream/dash';
import { reportDiag } from '@/lib/clientDiag';
import { videoDock, destroyVideo, pipSupported, togglePip, inPip, claimMediaSession, mediaSessionPaused, type StreamInfo } from '@/lib/player/videoDock';

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
  /**
   * 传了就开启「边浏览边看」:播放中滚出视口 → 右下角小窗接着放;离开页面 → 小窗接管,
   * 回到本页再接回来。值是小窗上显示的标题。推荐流这类一屏一条的场景不要传。
   */
  dockTitle?: string;
  /**
   * 客户端本地解析(见 lib/localStream):传源站页面地址,由本机按服务器下发的规则解析、本站播放器播放。
   * 由 VideoPlayer 外壳按「客户端 + 有匹配规则」自动设置,调用方不用传。
   */
  localSource?: string;
  /** 本地解析 / 播放失败:外壳据此显示重试界面 */
  onLocalFail?: (err: Error) => void;
  /** 重试:绕过本地解析缓存重新解析 */
  localRefresh?: boolean;
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

/** 生命周期 effect 里挂到 <video> 上的事件 */
const VIDEO_EVENTS = ['timeupdate', 'loadedmetadata', 'play', 'pause', 'ended', 'error', 'volumechange', 'enterpictureinpicture', 'leavepictureinpicture', 'webkitpresentationmodechanged'];

function fmt(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const NativeVideoPlayer = forwardRef<VideoPlayerHandle, Props>(function NativeVideoPlayer(
  { src, sourceUrl, refreshSource, poster, initialDuration = 600, onEnded, autoPlay = false, isAIGenerated = false, fill = false, onPlaybackError, dockTitle, localSource, onLocalFail, localRefresh },
  ref,
) {
  // 封面同样经网关:调用方传进来的可能是 MinIO 内网直链或外站防盗链图。
  const posterUrl = mediaUrl(poster);
  // <video> 由下面的生命周期 effect 自己 createElement,不交给 React 渲染(见 lib/player/videoDock)
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** 从小窗接回来的那条内容(src || sourceUrl):同一条内容不重新解析/加载 */
  const reclaimedKey = useRef('');
  const restoredStreams = useRef<StreamInfo[] | null>(null);
  const dockKey = src || sourceUrl || '';
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
  /** 视频不经本站带宽:这条流浏览器直连不了(源站校验 Referer),本站不中转 —— 显示的带宽提示 */
  const [bandwidthLimited, setBandwidthLimited] = useState<string | null>(null);
  /** 直连判定是异步的;切换内容/清晰度后忽略上一条的结论 */
  const accessSeq = useRef(0);

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
    if (reclaimedKey.current && reclaimedKey.current === dockKey) return;

    // React StrictMode 下 effect 会跑两次,且 unmount 可能晚于异步回调;
    // 用 AbortController 真正取消未完成的请求 + cancelled 标志避免 setState 写已 unmount 组件。
    // 正版长视频平台的页面:解析的结局毫无悬念(流校验 Referer 或带 DRM),不白等、不报故障,
    // 直接给去原站的入口。
    if (originOnlyPlatform(sourceUrl)) {
      setLoading(false);
      setStreamError(null);
      setStreams([]);
      setBandwidthLimited(ORIGIN_ONLY_NOTICE);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setStreamError(null);
    setBandwidthLimited(null);
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

  // loadStream 真正把地址喂给 <video>/hls.js。外面的 playStream 先做直连判定。
  const loadStream = (url: string, format?: string) => {
    if (!videoRef.current) return;
    // 原地址直接播:视频不经本站带宽,不再包成 /api/proxy?url=(见 playStream)。
    const playUrl = url;
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

  /**
   * 视频不经本站带宽(后端 internal/streamaccess):
   *   - 本站存的地址(MinIO / 同源)直接播;
   *   - 外站流先看后端 stream/resolve 给的 access,没有就问一次 /api/proxy/check:
   *     能直连(源站不校验 Referer)→ 原地址直接喂给播放器,本站一个字节都不经手;
   *     不能直连(源站校验 Referer)→ 本站不再中转,显示"因带宽成本暂不支持站内播放"
   *     并给出去原站的入口。
   * 以前这里把防盗链域名包成 /api/proxy?url= 让后端注入 Referer 整条转发 ——
   * 那是本站替源站付视频带宽,产品方向明确不做。带宽受限不是故障,不触发
   * onPlaybackError,不进举报队列。
   */
  const playStream = (url: string, format?: string, access?: string) => {
    if (!videoRef.current || !url) return;
    setBandwidthLimited(null);
    const seq = ++accessSeq.current;
    if (!isExternalStreamUrl(url)) {
      loadStream(url, format);
      return;
    }
    if (access) {
      if (access === 'direct') loadStream(url, format);
      else setBandwidthLimited(BANDWIDTH_NOTICE);
      return;
    }
    checkStreamAccess(url).then((res) => {
      // 探测期间切了内容/清晰度:这份结论已经不是当前流的,丢掉
      if (seq !== accessSeq.current || !videoRef.current) return;
      if (res.direct) loadStream(url, format);
      else setBandwidthLimited(res.notice || BANDWIDTH_NOTICE);
    });
  };

  // 切换清晰度
  const switchStream = (index: number) => {
    if (!streams[index]) return;
    setStreamError(null);
    setCurrentStream(index);
    playStream(streams[index].url, streams[index].format, streams[index].access);
  };

  // streams 变化(解析完成 / 换链)后启动播放。这里依赖 currentStream 保证清晰度切换也走这条路。
  useEffect(() => {
    const s = streams[currentStream];
    if (!s) return;
    // 从小窗接回来的流已经在放,别重新加载
    if (streams === restoredStreams.current) return;
    // <video> 在生命周期 layout effect 里就已创建(不用再等下一帧挂载);
    // 以前的 requestAnimationFrame 在后台标签页里不会触发,视频就一直不加载。
    if (videoRef.current) playStream(s.url, s.format, s.access);
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
    if (reclaimedKey.current && reclaimedKey.current === src) return;
    recoverAttempts.current = 0;
    if (videoRef.current) playStream(src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // 规则解析:客户端本机按规则拿到播放地址(失败退服务端),网页端由服务端解析;MediaSource / hls.js 喂给 <video>(见 lib/localStream)
  useEffect(() => {
    const v = videoRef.current;
    if (!localSource || !v) return;
    let detach: (() => void) | null = null;
    let cancelled = false;
    const ctrl = new AbortController();
    setLoading(true);
    setStreamError(null);
    resolveStream(localSource, { signal: ctrl.signal, refresh: localRefresh })
      .then((stream) => {
        if (cancelled) return;
        if (stream.duration > 0) setDuration(stream.duration);
        detach = attachLocalStream(v, stream, (err) => {
          if (!cancelled) onLocalFail?.(err);
        });
        if (autoPlay) v.play().catch(() => {});
      })
      .catch((err: Error) => {
        if (!cancelled) onLocalFail?.(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
      detach?.();
      v.removeAttribute('src');
      v.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSource]);

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
    const el = containerRef.current;
    if (el && document.fullscreenElement) {
      document.exitFullscreen();
    } else if (el?.requestFullscreen) {
      el.requestFullscreen();
    }
  };

  // ---------------------------------------------------------------------------
  // <video> 元素生命周期 + 小窗 / 画中画
  // ---------------------------------------------------------------------------
  const [owner] = useState(() => ({}));
  const hostRef = useRef<HTMLDivElement | null>(null);
  const pageHref = useRef('');
  const [pip, setPip] = useState(false);
  const [pipOk, setPipOk] = useState(false);
  const [floating, setFloating] = useState(false);
  /** 用户在页面内小窗上点了关闭:回到视口之前不再自动浮出 */
  const dismissed = useRef(false);

  // 卸载时要交给小窗的最新状态 + 元素事件的最新回调
  const live = useRef({ dockKey, dockTitle, posterUrl, streams, currentStream, platformName, expiresAt, streamError });
  const handlers = useRef<Record<string, () => void>>({});
  useEffect(() => {
    // 刚从小窗接回来、streams state 还没更新到这一帧时,保留接回来的流信息
    const keepRestored = streams.length === 0 && !!restoredStreams.current;
    live.current = keepRestored
      ? { ...live.current, dockKey, dockTitle, posterUrl, streamError }
      : { dockKey, dockTitle, posterUrl, streams, currentStream, platformName, expiresAt, streamError };
    handlers.current = {
      timeupdate: handleTimeUpdate,
      loadedmetadata: handleLoaded,
      play: () => {
        setPlaying(true);
        if (dockTitle && videoRef.current) claimMediaSession(videoRef.current, dockTitle, posterUrl);
      },
      pause: () => {
        setPlaying(false);
        if (videoRef.current) mediaSessionPaused(videoRef.current);
      },
      ended: () => {
        setPlaying(false);
        onEnded?.();
      },
      error: () => {
        // 规则解析模式:交给外壳(静默重解析一次 → 重试界面),不走下面「重新解析直链」那套。
        // 整段 mp4 / 原生 HLS 的地址出错由 lib/localStream/dash 自己换备用地址(selfRecover),这里不插手
        if (localSource) {
          if (videoRef.current?.dataset.selfRecover) return;
          onLocalFail?.(new Error(`video error ${videoRef.current?.error?.code ?? ''}`));
          return;
        }
        // mp4 直链签名过期 / 被回收时浏览器原生 <video> 只会停在黑屏(error.code=4,
        // 经代理的 403 也是这个)。原生 error 事件是唯一能捕捉到的地方(hls.js 那条
        // 路径有自己的 Hls.Events.ERROR)。先重新解析换链,救不回来再报错。
        const code = videoRef.current?.error?.code;
        recoverRef.current(code === 4 ? '视频地址已失效' : '视频加载失败');
      },
      // 静音可能来自外部(音乐播放器让推荐流静音开播),按钮图标跟着元素走
      volumechange: () => {
        if (videoRef.current) setMuted(videoRef.current.muted);
      },
      enterpictureinpicture: () => setPip(true),
      leavepictureinpicture: () => setPip(false),
      webkitpresentationmodechanged: () => setPip(inPip(videoRef.current)),
    };
  });

  /** 把元素放回页面里的占位(在小窗里时不动) */
  const attach = useCallback(() => {
    const v = videoRef.current;
    const host = hostRef.current;
    if (v && host && v.parentNode !== host && !videoDock.isFloating(owner)) host.appendChild(v);
  }, [owner]);

  const hostCallback = useCallback(
    (node: HTMLDivElement | null) => {
      hostRef.current = node;
      attach();
    },
    [attach],
  );

  useLayoutEffect(() => {
    pageHref.current = location.pathname + location.search;
    const key = live.current.dockKey;
    const back = key ? videoDock.take(key) : null;
    let v: HTMLVideoElement;
    if (back) {
      // 从小窗接回来:同一个元素、同一个 hls 实例,接着放
      v = back.el;
      hlsRef.current = back.hls ?? null;
      reclaimedKey.current = key;
      if (back.streams?.length) {
        restoredStreams.current = back.streams;
        // live 要到 passive effect 才会刷新;这之前若再卸载(StrictMode 的模拟卸载),
        // 交回小窗的快照得带着这份流信息,否则下次接回来会当成新内容重新加载
        live.current = {
          ...live.current,
          streams: back.streams,
          currentStream: back.currentStream ?? 0,
          platformName: back.platformName ?? '',
          expiresAt: back.expiresAt ?? 0,
        };
        setStreams(back.streams);
        setCurrentStream(back.currentStream ?? 0);
        setPlatformName(back.platformName ?? '');
        setExpiresAt(back.expiresAt ?? 0);
      }
      setLoading(false);
      setPlaying(!v.paused);
      setCurrentTime(v.currentTime);
      if (isFinite(v.duration)) setDuration(v.duration);
      setPip(inPip(v));
      setMuted(v.muted);
    } else {
      v = document.createElement('video');
      v.playsInline = true;
      v.setAttribute('webkit-playsinline', '');
      v.preload = 'metadata';
      // 直连外站流时不带本站 Referer:后端判"能直连"用的就是不带 Referer 的探测,
      // 而不少 CDN 是"有 Referer 且不在白名单才拒",带上本站地址反而会被拒。
      v.setAttribute('referrerpolicy', 'no-referrer');
    }
    v.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;display:block;';
    // 推荐流(fill)自动连播:音乐在放时静音开播(见 lib/player/musicPlayer 的协调器)
    if (fill) v.dataset.autoMute = '1';
    else delete v.dataset.autoMute;
    videoRef.current = v;
    setPipOk(pipSupported(v));

    const listeners = VIDEO_EVENTS.map((name) => {
      const fn = () => handlers.current[name]?.();
      v.addEventListener(name, fn);
      return [name, fn] as const;
    });
    videoDock.register(owner);
    attach();

    return () => {
      listeners.forEach(([name, fn]) => v.removeEventListener(name, fn));
      videoDock.unregister(owner);
      const st = live.current;
      // 离开页面时还在放(或在画中画里) → 交给小窗接着放
      const keep = !!st.dockTitle && !!st.dockKey && !st.streamError && (inPip(v) || (!v.paused && !v.ended));
      if (keep) {
        videoDock.orphan(owner, {
          el: v,
          hls: hlsRef.current,
          key: st.dockKey,
          title: st.dockTitle!,
          href: pageHref.current,
          poster: st.posterUrl,
          streams: st.streams,
          currentStream: st.currentStream,
          platformName: st.platformName,
          expiresAt: st.expiresAt,
        });
      } else {
        videoDock.unfloat(owner);
        destroyVideo(v, hlsRef.current);
      }
      hlsRef.current = null;
      videoRef.current = null;
      reclaimedKey.current = '';
      restoredStreams.current = null;
    };
  }, [owner, attach]);

  // 封面(以前是 JSX 上的 poster 属性)
  useEffect(() => {
    if (videoRef.current) videoRef.current.poster = posterUrl || '';
  }, [posterUrl]);

  // 静音按钮以前只换了图标,从没作用到 <video> 上
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const returnToPage = () => {
    videoDock.unfloat(owner);
    attach();
    setFloating(false);
  };

  // 播放中滚出视口 → 浮到小窗;滚回来 → 放回原位
  useEffect(() => {
    const box = containerRef.current;
    if (!dockTitle || fill || !box || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([e]) => {
        const v = videoRef.current;
        if (!v) return;
        const visible = e.isIntersecting && e.intersectionRatio >= 0.3;
        if (visible) {
          dismissed.current = false;
          if (videoDock.isFloating(owner)) {
            videoDock.unfloat(owner);
            attach();
          }
          setFloating(false);
          return;
        }
        if (dismissed.current || v.paused || inPip(v) || videoDock.isFloating(owner)) return;
        videoDock.float({
          el: v,
          owner,
          title: dockTitle,
          href: pageHref.current,
          poster: posterUrl,
          onReturn: () => box.scrollIntoView({ behavior: 'smooth', block: 'center' }),
          onClose: () => {
            dismissed.current = true;
            v.pause();
            attach();
            setFloating(false);
          },
        });
        setFloating(true);
      },
      { threshold: [0, 0.3] },
    );
    io.observe(box);
    return () => io.disconnect();
  }, [dockTitle, fill, owner, attach, posterUrl]);

  // 供外层(如 RecommendVideoFeed 的沉浸式竖滑手势)在不知道内部实现的情况下
  // 直接控制真实播放状态——之前 feed 侧维护了一份完全独立、只做界面模拟的
  // playing/currentTime,点击画面切换的是那份假状态,和这里真正的 <video>
  // 播放/暂停毫无关联。
  useImperativeHandle(ref, () => ({
    togglePlay,
    seek,
    isPlaying: () => playing,
  }));

  // 带宽受限时不算"有视频":走下面的封面 + 提示分支,而不是一块黑屏。
  // 规则解析模式(localSource)不设 src / streams,地址直接挂到 <video> 上 —— 必须算"有视频",
  // 否则这里渲染的是封面图,<video> 从没挂进页面,只听得到声音(2026-09-26 用户报的「只有声音」)。
  const hasVideo = (src || streams.length > 0 || !!localSource) && !bandwidthLimited;
  // 实在播不了时给出原站链接(番剧 / 直播间等解析不出流、或需要源站会员的内容)
  const originLink = /^https?:\/\//.test(reparseUrl) ? reparseUrl : '';
  const originPlatform = originOnlyPlatform(originLink);
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
      {originPlatform ? `去${originPlatform}观看` : '去原站观看'}
    </Box>
  ) : null;

  return (
    <Box
      ref={containerRef}
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
          <Box ref={hostCallback} sx={{ width: '100%', height: '100%' }} />
          {(floating || pip) && (
            <Box
              data-no-drag
              sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'rgba(255,255,255,0.7)', fontSize: 13, bgcolor: '#0b0b0f', zIndex: 4 }}
            >
              <PictureInPictureAltIcon sx={{ fontSize: 36, opacity: 0.6 }} />
              {pip ? '正在画中画中播放' : '正在小窗中播放'}
              <Box
                component="button"
                onClick={() => (pip ? togglePip(videoRef.current) : returnToPage())}
                sx={{ mt: 0.5, px: 2, py: 0.5, borderRadius: 1, fontSize: 12, color: '#fff', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.35)', bgcolor: 'rgba(255,255,255,0.08)', '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' } }}
              >
                在这里播放
              </Box>
            </Box>
          )}

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
          ) : bandwidthLimited ? (
            // 不是故障:内容没坏,本站只是不替源站付视频带宽。中性图标、说清原因、给去原站的路。
            // 卡片自带深色磨砂底:它压在封面上,亮色封面上的白字否则看不清。
            <Box data-no-drag sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', px: 3, py: 2, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)', maxWidth: 'min(92%, 420px)' }}>
              <CloudOffIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.55)', mb: 0.5 }} />
              <Box sx={{ fontSize: 14, fontWeight: 600, color: '#fff', mb: 0.5 }}>{originPlatform ? `请前往${originPlatform}观看` : '暂不支持站内播放'}</Box>
              <Box sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', mb: 1 }}>{bandwidthLimited}</Box>
              {originButton}
            </Box>
          ) : streamError ? (
            <Box sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', px: 3, py: 2, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(6px)', maxWidth: 'min(92%, 420px)' }}>
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
            <IconButton onClick={() => setMuted((m) => !m)} size="small" aria-label={muted ? '打开声音' : '静音'} sx={{ color: '#fff' }}>
              {muted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
            </IconButton>
            <Slider
              size="small"
              value={muted ? 0 : volume}
              onChange={handleVolume}
              sx={{ color: '#FE2C55', width: 80, mx: 1 }}
            />
            {pipOk && (
              <IconButton onClick={() => togglePip(videoRef.current)} size="small" aria-label={pip ? '退出画中画' : '画中画'} title={pip ? '退出画中画' : '画中画'} sx={{ color: pip ? '#FE2C55' : '#fff' }}>
                <PictureInPictureAltIcon fontSize="small" />
              </IconButton>
            )}
            <IconButton onClick={goFullscreen} size="small" aria-label="全屏" sx={{ color: '#fff' }}>
              <FullscreenIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}
    </Box>
  );
});

/**
 * 规则解析失败时的界面(本地和服务端都没解出来,或流放不出来)。没有外链 iframe 可退
 * (2026-09-26 起全站不再嵌 iframe:吞手势、没进度、没小窗):就地给「重试」和「用 XX 打开」,
 * 客户端里把失败现场报给服务器(lib/clientDiag)。
 */
function LocalPlayError({ pageUrl, message, fill, onRetry }: { pageUrl: string; message: string; fill?: boolean; onRetry: () => void }) {
  const label = matchProvider(pageUrl)?.rule.label ?? '原站';
  const btn = { px: 2, py: 0.75, borderRadius: 999, fontSize: 14, border: '1px solid rgba(255,255,255,0.4)', color: '#fff', bgcolor: 'rgba(255,255,255,0.08)', cursor: 'pointer' } as const;
  return (
    <Box
      sx={{
        position: fill ? 'absolute' : 'relative',
        inset: fill ? 0 : undefined,
        width: '100%',
        aspectRatio: fill ? undefined : '16/9',
        bgcolor: fill ? 'transparent' : '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
        px: 3,
      }}
    >
      <Box sx={{ fontSize: 15 }}>这条视频暂时没能加载出来</Box>
      <Box sx={{ fontSize: 12, opacity: 0.6, maxWidth: 320 }}>{message}</Box>
      <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
        <Box component="button" type="button" data-no-drag onClick={onRetry} sx={btn}>
          重试
        </Box>
        <Box
          component="button"
          type="button"
          data-no-drag
          onClick={() => {
            void openExternalUrl(pageUrl).then((ok) => {
              if (!ok) window.open(pageUrl, '_blank', 'noopener');
            });
          }}
          sx={btn}
        >
          用{label}打开
        </Box>
      </Box>
    </Box>
  );
}

const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(props, ref) {
  const pageUrl = props.sourceUrl || props.refreshSource || '';
  // 对外的播放器入口。有解析规则的源站(B 站投稿、AcFun)一律走本站播放器,两级回退:
  // 客户端本机解析 → 服务端解析;网页端直接服务端解析(lib/localStream/engine)。取媒体也是两级:
  // 浏览器直连 → 原生请求带源站要的头(lib/localStream/dash)。全程没有跨域 iframe,
  // 推荐流的点按/滑动直接作用在播放器上。都失败就地给重试 + 去原站(LocalPlayError)。
  // 没有规则的地址(站内直链、旧的通用解析)走原来的 NativeVideoPlayer 路径。
  // 播放器只在浏览器里挂载,惰性初始化里读 window 是安全的。
  const [local, setLocal] = useState(() => typeof window !== 'undefined' && canResolveLocally(pageUrl));
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setLocal(canResolveLocally(pageUrl));
    setFailure(null);
    setAttempt(0);
    // 服务器可能下发了内置默认里没有的站点:规则到手后再判一次
    void loadRules().then(() => {
      if (alive) setLocal(canResolveLocally(pageUrl));
    });
    return () => {
      alive = false;
    };
  }, [pageUrl]);
  if (local && pageUrl) {
    if (failure) {
      return (
        <LocalPlayError
          pageUrl={pageUrl}
          message={failure}
          fill={props.fill}
          onRetry={() => {
            setFailure(null);
            setAttempt((n) => n + 1);
          }}
        />
      );
    }
    return (
      <NativeVideoPlayer
        ref={ref}
        {...props}
        key={`${pageUrl}#${attempt}`}
        src={undefined}
        sourceUrl={undefined}
        refreshSource={undefined}
        localSource={pageUrl}
        localRefresh={attempt > 0}
        onLocalFail={(err) => {
          console.warn('[VideoPlayer] 本站播放器加载失败', pageUrl, err);
          reportDiag('local_play_failed', `${pageUrl}#${attempt}`, { url: pageUrl, attempt, error: String(err?.message || err).slice(0, 300) });
          // 第一次失败先静默强制重新解析一次(缓存里的地址过期 / 这次分到的节点不通),
          // 还不行才给重试界面
          if (attempt === 0) setAttempt(1);
          else setFailure(err?.message || '加载失败');
        }}
      />
    );
  }
  return <NativeVideoPlayer ref={ref} {...props} />;
});

export default VideoPlayer;
