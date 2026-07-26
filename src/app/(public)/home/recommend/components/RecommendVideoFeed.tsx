'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import ModeCommentOutlinedIcon from '@mui/icons-material/ModeCommentOutlined';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import HighQualityOutlinedIcon from '@mui/icons-material/HighQualityOutlined';
import MicNoneRoundedIcon from '@mui/icons-material/MicNoneRounded';
import QueueMusicRoundedIcon from '@mui/icons-material/QueueMusicRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { fetchRecommend } from '@/apis/home-discover';
import { sendComment, moduleContentAction } from '@/apis/home';
import { reportContent, collectContent } from '@/apis/global';
import { homeClient } from '@/lib/api/client';
import { getDetailRoute } from '@/lib/contentRoute';
import { TYPE_LABEL } from '@/lib/contentRoute';
import { TYPE_GRADIENT } from '@/constants/gradients';
import { track } from '@/lib/track';
import VideoPlayer from '@/components/detail/VideoPlayer';

interface VideoItem {
  id: number;
  idString?: string; // 字符串形 id,避免 JS 2^53 精度损失,后端 home/recommend 返回)
  title: string;
  contentType: string;
  cover: string;
  author: string;
  authorAvatar: string;
  durationSec: number;
  views: number;
  likes: number;
  comments: number;
  collects: number;
  shares: number;
  caption: string;
  verified?: boolean;
  brand?: string;
  authorId?: number;
  sourceUrl?: string; // 源页面 URL,供播放器解析真实视频流
}

function formatTime(sec?: number): string {
  if (sec == null || isNaN(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatCount(n?: number): string {
  if (n == null || isNaN(n)) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toString();
}


function hashId(s: string): number {
	let h = 0x811c9dc5 >>> 0; // FNV-1a 32-bit basis
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h | 0;
}

function getContentTypeColor(type: string) {
  return TYPE_GRADIENT[type] || TYPE_GRADIENT.NOVEL;
}

export function RecommendVideoFeed() {
  const router = useRouter();
  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [liked, setLiked] = useState(false);
  const [collected, setCollected] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [likedCount, setLikedCount] = useState(0);
  const [collectedCount, setCollectedCount] = useState(0);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSending, setCommentSending] = useState(false);
  const [moreDialogOpen, setMoreDialogOpen] = useState(false);
  // 短视频播放状态:sourceUrl 解析出的视频地址
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [streamLoading, setStreamLoading] = useState(false);
  const [streamError, setStreamError] = useState<string>('');

  // 分页状态
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);
  const [allItems, setAllItems] = useState<VideoItem[]>([]);
  const [hasMore, setHasMore] = useState(true);

  // 追踪正在请求的页码（使用 ref 避免 React 状态延迟问题）
  const requestingPageRef = useRef(0);
  // 锁：是否正在等待下一页数据
  const loadingLockRef = useRef(false);
  const { data: feed, isLoading, isFetching } = useQuery({
    queryKey: ['home-recommend', 'recommend-feed', page],
    queryFn: async () => {
      const resp = await fetchRecommend({
        types: 'VIDEO',
        size: PAGE_SIZE,
        page: page,
      }) as any;
      const list = (resp?.data?.list ?? []) as any[];
      const items = list.map((it): VideoItem => ({
        id: Number(it.id) || 0,
        idString: typeof it.idString === 'string' && it.idString ? it.idString : String(it.id ?? ''),
        title: it.title || '',
        contentType: (it.category || 'NOVEL').toUpperCase(),
        cover: it.cover || '',
        author: it.author || '未知作者',
        authorAvatar: it.authorAvatar || '',
        authorId: Number(it.authorId) || 0,
        durationSec: 30 + (hashId(it.idString ?? String(it.id)) % 60),
        views: Number(it.views) || 0,
        likes: Number(it.likes) || 0,
        comments: Number(it.comments) || 0,
        collects: Number(it.collects) || 0,
        shares: Number(it.shares) || 0,
        caption: it.title || '',
        verified: false,
        brand: TYPE_LABEL[(it.category || 'NOVEL').toUpperCase()] || '推荐',
        sourceUrl: it.sourceUrl || '',
      }));
      const hasMore = resp?.data?.hasMore ?? false;
      return { items, hasMore };
    },
    placeholderData: (prev) => prev, // 避免闪烁
  });

  // 合并数据到 allItems（使用 isFetching 来判断是否真正收到新数据）
  useEffect(() => {
    console.log('[DEBUG] merge effect:', { isFetching, page, requestingPageRef: requestingPageRef.current, feedItems: feed?.items?.length, hasMore: feed?.hasMore });
    // 当 isFetching 变为 false 时，说明请求完成
    if (isFetching) return;
    if (!feed) return;
    // 检查页码匹配：确保合并的是当前请求的页
    if (requestingPageRef.current > 0 && requestingPageRef.current !== page) {
      console.log('[DEBUG] 页码不匹配，拒绝合并:', { waiting: requestingPageRef.current, current: page });
      return;
    }

    console.log('[DEBUG] 开始合并数据, page:', page, 'items:', feed.items.length);
    setAllItems(prev => {
      if (page === 1) {
        console.log('[DEBUG] 第一页，替换数据');
        return feed.items;
      }
      // 去重追加
      const existingIds = new Set(prev.map(v => v.idString || String(v.id)));
      const newItems = feed.items.filter(v => !existingIds.has(v.idString || String(v.id)));
      console.log('[DEBUG] 追加模式，prev:', prev.length, 'newItems:', newItems.length);
      return [...prev, ...newItems];
    });
    setHasMore(feed.hasMore);

    // 释放锁：只有在数据成功合并后才释放
    requestingPageRef.current = 0;
    loadingLockRef.current = false;
  }, [isFetching, feed, page]);

  // 追踪已加载的页码
  const uniqueVideos = allItems;

  // 视频导航状态
  const [index, setIndex] = useState(0);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const navLock = useRef(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indexRef = useRef(0);
  const allItemsRef = useRef<VideoItem[]>([]);
  indexRef.current = index;
  allItemsRef.current = allItems;
  const video = uniqueVideos[index];

  // 滑动时预加载下一页：只在刚好滑到倒数第三条时触发
  useEffect(() => {
    const remaining = allItemsRef.current.length - indexRef.current;
    console.log('[DEBUG] preload effect:', { index: indexRef.current, allItems: allItemsRef.current.length, remaining, hasMore, locked: loadingLockRef.current });
    // 有锁时不触发
    if (loadingLockRef.current) return;
    // 只在刚好倒数第3条时请求（remaining === 3）
    if (remaining === 3 && hasMore) {
      console.log('[DEBUG] 触发预加载下一页，current page:', page);
      loadingLockRef.current = true;
      const nextPage = page + 1;
      requestingPageRef.current = nextPage;
      setPage(nextPage);
    }
  }, [index, page, hasMore]);

  const lockNav = useCallback((ms = 380) => {
    navLock.current = true;
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = setTimeout(() => { navLock.current = false; }, ms);
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (navLock.current) return;
      const next = indexRef.current + dir;
      if (next < 0 || next >= uniqueVideos.length) return;
      setSlideDir(dir);
      setIndex(next);
      lockNav();
    },
    [uniqueVideos.length, lockNav],
  );

  useEffect(() => {
    setCurrentTime(0);
    setPlaying(true);
    setLiked(false);
    setCollected(false);
    setVideoSrc('');
    setStreamError('');
    if (video) {
      setLikedCount(video.likes);
      setCollectedCount(video.collects);
      // 有 sourceUrl 时解析真实视频流
      if (video.sourceUrl) {
        setStreamLoading(true);
        fetch(`/api/stream?url=${encodeURIComponent(video.sourceUrl)}`)
          .then(r => r.json())
          .then(data => {
            if (data.code === 0 && data.data?.streams?.length > 0) {
              setVideoSrc(data.data.streams[0].url || '');
            } else {
              setStreamError(data.msg || '解析失败');
            }
          })
          .catch(() => setStreamError('解析失败'))
          .finally(() => setStreamLoading(false));
      }
    }
  }, [index, video]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (Math.abs(e.deltaY) < 8) return;
      if (navLock.current) {
        lockNav(220);
        return;
      }
      go(e.deltaY > 0 ? 1 : -1);
    },
    [go, lockNav],
  );

  const likeMutation = useMutation({
    // 字段对齐后端 moduleContentAction:{contentId, action:'agree'|'cancel_agree'}
    // (旧 {type:'AGREE',value} 与后端 req.Action 不匹配→Action 空→每次 +1)。
    mutationFn: (nextLiked: boolean) =>
      moduleContentAction({ contentId: video?.id, action: nextLiked ? 'agree' : 'cancel_agree' }),
  });

  const collectMutation = useMutation({
    // 后端 CollectToggle 不读 action、纯 toggle;onSuccess 用响应 collected 校正,避免无初始态时方向反。
    mutationFn: (_nextCollected: boolean) => collectContent({ contentId: video?.id }),
    onSuccess: (res: any) => {
      const server = res?.data?.collected;
      if (typeof server === 'boolean') setCollected(server);
    },
  });

  const handleLike = async () => {
    if (likeMutation.isPending) return;
    const nextLiked = !liked;
    const prevLiked = liked;
    const prevCount = likedCount;
    setLiked(nextLiked);
    setLikedCount((c) => c + (nextLiked ? 1 : -1));
    try {
      await likeMutation.mutateAsync(nextLiked);
    } catch {
      setLiked(prevLiked);
      setLikedCount(prevCount);
      notify('操作失败,请稍后再试', 'error');
    }
  };

  const handleCollect = async () => {
    if (collectMutation.isPending) return;
    const nextCollected = !collected;
    const prevCollected = collected;
    const prevCount = collectedCount;
    setCollected(nextCollected);
    setCollectedCount((c) => c + (nextCollected ? 1 : -1));
    try {
      await collectMutation.mutateAsync(nextCollected);
    } catch {
      setCollected(prevCollected);
      setCollectedCount(prevCount);
      notify('操作失败,请稍后再试', 'error');
    }
  };

  const notify = (message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!video?.authorId || followBusy) {
      if (!video?.authorId) notify('暂无法关注该作者', 'info');
      return;
    }
    setFollowBusy(true);
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    try {
      if (wasFollowing) {
        await homeClient.delete(`/follow/${video.authorId}`);
        notify('已取消关注');
      } else {
        await homeClient.post(`/follow/${video.authorId}`);
        notify('关注成功');
      }
    } catch {
      setFollowing(wasFollowing);
      notify('操作失败,请稍后再试', 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCommentDialogOpen(true);
  };

  const handleSendComment = async () => {
    if (!commentText.trim() || !video?.id) return;
    setCommentSending(true);
    try {
      await sendComment({ contentId: video.id, content: commentText.trim() });
      notify('评论已发送');
      setCommentText('');
      setCommentDialogOpen(false);
    } catch {
      notify('评论发送失败,请重试', 'error');
    } finally {
      setCommentSending(false);
    }
  };

  const handleReport = async () => {
    if (!video?.id) return;
    try {
      await reportContent({ targetId: video.id, targetType: 'VIDEO', reason: '违规/低俗内容' });
      notify('举报已提交,我们会尽快处理');
      setMoreDialogOpen(false);
    } catch {
      notify('举报提交失败,请重试', 'error');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '');
      notify('链接已复制到剪贴板');
      setMoreDialogOpen(false);
    } catch {
      notify('复制失败', 'error');
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.share) {
        await navigator.share({ title: video?.title || '推荐', url: typeof window !== 'undefined' ? window.location.href : '' });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(typeof window !== 'undefined' ? window.location.href : '');
        notify('链接已复制到剪贴板');
      } else {
        notify('当前环境不支持分享', 'info');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        notify('分享失败', 'error');
      }
    }
  };

  const handleMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMoreDialogOpen(true);
  };

  const handleCardClick = (item: VideoItem) => {
    track(item.id, 'click', item.contentType || 'novel');
    const route = getDetailRoute(item.contentType, item.id);
    if (route) router.push(route);
  };

  useEffect(() => {
    if (!playing || !video) return;
    const t = setInterval(() => {
      setCurrentTime((s) => {
        const next = s + 1;
        return next >= video.durationSec ? 0 : next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [playing, video]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'ArrowRight') {
        setCurrentTime((t) => Math.min(video?.durationSec || 0, t + 5));
      } else if (e.key === 'ArrowLeft') {
        setCurrentTime((t) => Math.max(0, t - 5));
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'f') {
        setIsFullscreen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [video, go]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [vh, setVh] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef({ active: false, startY: 0, moved: 0 });

  const setViewportRef = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    roRef.current?.disconnect();
    if (node) {
      setVh(node.clientHeight);
      const ro = new ResizeObserver(() => setVh(node.clientHeight));
      ro.observe(node);
      roRef.current = ro;
    }
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    dragState.current = { active: true, startY: e.clientY, moved: 0 };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s.active) return;
    let d = e.clientY - s.startY;
    s.moved = Math.max(s.moved, Math.abs(d));
    if ((d > 0 && index === 0) || (d < 0 && index === uniqueVideos.length - 1)) d *= 0.32;
    setDragY(d);
  };
  const endDrag = () => {
    const s = dragState.current;
    if (!s.active) return;
    s.active = false;
    setDragging(false);
    const d = dragY;
    if (s.moved < 6) {
      setDragY(0);
      setPlaying((p) => !p);
      return;
    }
    const threshold = (vh || 600) * 0.2;
    if (!navLock.current && d <= -threshold && index < uniqueVideos.length - 1) {
      setSlideDir(1);
      setIndex((i) => i + 1);
      setDragY(0);
      lockNav();
    } else if (!navLock.current && d >= threshold && index > 0) {
      setSlideDir(-1);
      setIndex((i) => i - 1);
      setDragY(0);
      lockNav();
    } else {
      setDragY(0);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ width: '100%', height: '100%', bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>加载推荐中…</Typography>
      </Box>
    );
  }

  if (!video) {
    return (
      <Box sx={{ width: '100%', height: '100%', bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>暂无推荐内容</Typography>
      </Box>
    );
  }

  return (
    <Box
      onWheel={handleWheel}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        bgcolor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        ref={setViewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          bgcolor: '#000',
          touchAction: 'none',
          cursor: dragging ? 'grabbing' : 'grab',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: vh ? vh * uniqueVideos.length : '100%',
            transform: `translateY(${-index * (vh || 0) + dragY}px)`,
            transition: dragging ? 'none' : 'transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1)',
            willChange: 'transform',
          }}
        >
          {uniqueVideos.map((v, i) => (
            <Box
              // Use the lossless string id (idString) for stable identity on reorder.
              // Falls back to composite `${i}-${v.id}` if the backend omits it.
              key={`video-${v.idString ? `s-${v.idString}` : `${i}-${v.id}`}`}
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: vh ? i * vh : 0,
                height: vh || '100%',
                opacity: vh > 0 || i === index ? 1 : 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background: getContentTypeColor(v.contentType),
                  opacity: 0.35,
                  pointerEvents: 'none',
                },
              }}
            >
              {/* 视频播放器或封面 */}
              {i === index && videoSrc ? (
                <Box sx={{ position: 'absolute', inset: 0, zIndex: 1 }}>
                  <VideoPlayer
                    src={videoSrc}
                    poster={v.cover}
                    initialDuration={video?.durationSec || 60}
                    autoPlay={playing}
                    onEnded={() => setCurrentTime(0)}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `url(${v.cover}) center/cover`,
                  }}
                />
              )}

              {i === index && (
                <>
                  <Box
                    data-no-drag
                    sx={{
                      position: 'absolute',
                      right: { xs: 8, sm: 16, md: 20 },
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.25,
                      zIndex: 4,
                    }}
                  >
                  </Box>


                  <Box
                    sx={{
                      position: 'absolute',
                      top: 16,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 999,
                      bgcolor: 'rgba(0, 0, 0, 0.4)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      zIndex: 3,
                    }}
                  >
                    <Box
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: getContentTypeColor(video.contentType),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                      }}
                    >
                      <StarRoundedIcon sx={{ fontSize: 12, color: '#fff' }} />
                    </Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary' }}>{video.brand}</Typography>
                  </Box>

                  <Box
                    sx={{
                      position: 'relative',
                      zIndex: 2,
                      textAlign: 'center',
                      color: 'text.primary',
                      textShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
                      px: 4,
                      pointerEvents: 'none',
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: { xs: 32, md: 48 },
                        fontWeight: 800,
                        lineHeight: 1.2,
                        letterSpacing: 1,
                        mb: 1,
                      }}
                    >
                      {video.title}
                    </Typography>
                    <Typography sx={{ fontSize: { xs: 14, md: 18 }, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>
                      {TYPE_LABEL[video.contentType] || '推荐'}
                    </Typography>
                  </Box>

                  {!playing && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(0, 0, 0, 0.3)',
                        pointerEvents: 'none',
                      }}
                    >
                      <Box
                        sx={{
                          width: 88,
                          height: 88,
                          borderRadius: '50%',
                          bgcolor: 'rgba(0, 0, 0, 0.55)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backdropFilter: 'blur(8px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <PlayArrowRoundedIcon sx={{ fontSize: 56, color: 'text.primary', ml: 1 }} />
                      </Box>
                    </Box>
                  )}

                  <Box
                    data-no-drag
                    sx={{
                      position: 'absolute',
                      right: { xs: 8, sm: 16, md: 20 },
                      bottom: 96,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1.5,
                      alignItems: 'center',
                      zIndex: 3,
                    }}
                  >
                    <Box sx={{ position: 'relative', mb: 0.5 }}>
                      <Avatar
                        src={video.authorAvatar}
                        sx={{
                          width: 48,
                          height: 48,
                          border: '2px solid #FFFFFF',
                          background: getContentTypeColor(video.contentType),
                        }}
                      >
                        {video.author?.[0]}
                      </Avatar>
                      {!following && (
                        <Box
                          onClick={handleFollow}
                          sx={{
                            position: 'absolute',
                            bottom: -6,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px solid #000000',
                            cursor: 'pointer',
                            opacity: followBusy ? 0.6 : 1,
                          }}
                        >
                          <AddRoundedIcon sx={{ fontSize: 14, color: 'text.primary' }} />
                        </Box>
                      )}
                    </Box>

                    <SideAction
                      active={liked}
                      onClick={(e) => { e.stopPropagation(); handleLike(); }}
                      icon={liked ? <FavoriteRoundedIcon sx={{ fontSize: 28 }} /> : <FavoriteBorderRoundedIcon sx={{ fontSize: 28 }} />}
                      value={formatCount(likedCount)}
                      activeColor="primary.main"
                    />
                    <SideAction
                      icon={<ModeCommentOutlinedIcon sx={{ fontSize: 26 }} />}
                      value={formatCount(video.comments)}
                      onClick={handleCommentClick}
                    />
                    <SideAction
                      active={collected}
                      onClick={(e) => { e.stopPropagation(); handleCollect(); }}
                      icon={collected ? <BookmarkRoundedIcon sx={{ fontSize: 26 }} /> : <BookmarkBorderRoundedIcon sx={{ fontSize: 26 }} />}
                      value={formatCount(collectedCount)}
                      activeColor="warning.main"
                    />
                    <SideAction
                      icon={<ReplyRoundedIcon sx={{ fontSize: 26, transform: 'scaleX(-1)' }} />}
                      value={formatCount(video.shares)}
                      onClick={handleShare}
                    />
                    <SideAction icon={<MoreHorizRoundedIcon sx={{ fontSize: 26 }} />} value="" onClick={handleMore} />
                  </Box>

                  <Box
                    sx={{
                      position: 'absolute',
                      left: 20,
                      right: 88,
                      bottom: 92,
                      zIndex: 3,
                      color: 'text.primary',
                      textShadow: '0 1px 3px rgba(0, 0, 0, 0.6)',
                      pointerEvents: 'auto',
                    }}
                    onClick={() => handleCardClick(video)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <Typography sx={{ fontSize: 15, fontWeight: 700 }}>@{video.author}</Typography>
                      {video.verified && (
                        <VerifiedRoundedIcon sx={{ fontSize: 14, color: 'secondary.main' }} />
                      )}
                      <Box
                        sx={{
                          ml: 0.5,
                          px: 0.75,
                          py: 0.05,
                          borderRadius: 0.5,
                          bgcolor: 'rgba(255, 255, 255, 0.15)',
                          fontSize: 10,
                          fontWeight: 600,
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        {video.brand}
                      </Box>
                    </Box>
                    <Typography
                      sx={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: 'rgba(255, 255, 255, 0.95)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        maxWidth: 540,
                      }}
                    >
                      {video.caption}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75, color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>
                      <QueueMusicRoundedIcon sx={{ fontSize: 12 }} />
                      <Typography sx={{ fontSize: 11 }}>{formatCount(video.views)} 次浏览</Typography>
                    </Box>
                  </Box>
                </>
              )}
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          position: 'relative',
          zIndex: 5,
          bgcolor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          px: 2.5,
          py: 1,
        }}
      >
        <Slider
          value={currentTime}
          min={0}
          max={video.durationSec}
          step={1}
          onChange={(_, v) => setCurrentTime(v as number)}
          sx={{
            color: 'primary.main',
            height: 3,
            padding: '6px 0 !important',
            '& .MuiSlider-thumb': { width: 10, height: 10, boxShadow: '0 0 0 4px rgba(254, 44, 85, 0.18)' },
            '& .MuiSlider-rail': { color: 'rgba(255, 255, 255, 0.18)' },
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 0.25 }}>
          <IconButton
            size="small"
            onClick={() => setPlaying((p) => !p)}
            sx={{ color: 'text.primary' }}
          >
            {playing ? <PauseRoundedIcon sx={{ fontSize: 22 }} /> : <PlayArrowRoundedIcon sx={{ fontSize: 22 }} />}
          </IconButton>

          <Typography sx={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.85)', fontVariantNumeric: 'tabular-nums', minWidth: 90 }}>
            {formatTime(currentTime)} / {formatTime(video.durationSec)}
          </Typography>

          <Box sx={{ flex: 1 }} />

          <ControlChip icon={<SpeedRoundedIcon sx={{ fontSize: 14 }} />} label="倍速" />
          <ControlChip icon={<HighQualityOutlinedIcon sx={{ fontSize: 14 }} />} label="画质" />
          <ControlChip icon={<MicNoneRoundedIcon sx={{ fontSize: 14 }} />} label="智能" />
          <ControlChip icon={<QueueMusicRoundedIcon sx={{ fontSize: 14 }} />} label="跟唱" />
          <Tooltip title="设置">
            <IconButton size="small" sx={{ color: 'rgba(255, 255, 255, 0.85)' }}>
              <SettingsRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="全屏 (F)">
            <IconButton
              size="small"
              onClick={() => setIsFullscreen((v) => !v)}
              sx={{ color: 'rgba(255, 255, 255, 0.85)' }}
            >
              {isFullscreen ? <FullscreenExitRoundedIcon sx={{ fontSize: 18 }} /> : <FullscreenRoundedIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>

      <Dialog open={commentDialogOpen} onClose={() => setCommentDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 600 }}>评论</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder="写下你的想法..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCommentDialogOpen(false)} size="small" sx={{ textTransform: 'none' }}>取消</Button>
          <Button
            variant="contained"
            size="small"
            disabled={!commentText.trim() || commentSending}
            onClick={handleSendComment}
            sx={{ textTransform: 'none' }}
          >
            {commentSending ? '发送中…' : '发送'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={moreDialogOpen} onClose={() => setMoreDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 600 }}>更多</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={handleReport}
              sx={{ textTransform: 'none', justifyContent: 'flex-start', borderColor: 'rgba(255,255,255,0.12)', color: 'text.primary' }}
            >
              举报内容
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={() => { notify('已减少此类推荐', 'info'); setMoreDialogOpen(false); }}
              sx={{ textTransform: 'none', justifyContent: 'flex-start', borderColor: 'rgba(255,255,255,0.12)', color: 'text.primary' }}
            >
              不感兴趣
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={handleCopyLink}
              sx={{ textTransform: 'none', justifyContent: 'flex-start', borderColor: 'rgba(255,255,255,0.12)', color: 'text.primary' }}
            >
              复制链接
            </Button>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMoreDialogOpen(false)} size="small" sx={{ textTransform: 'none' }}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function SideAction({
  icon,
  value,
  active,
  activeColor,
  onClick,
}: {
  icon: React.ReactNode;
  value: string;
  active?: boolean;
  activeColor?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.25,
        cursor: 'pointer',
        color: active && activeColor ? activeColor : 'text.primary',
        transition: 'transform 0.15s',
        '&:hover': { transform: 'scale(1.08)' },
        '&:active': { transform: 'scale(0.95)' },
      }}
    >
      {icon}
      {value !== '' && (
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 600,
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
            color: 'text.primary',
          }}
        >
          {value}
        </Typography>
      )}
    </Box>
  );
}

function ControlChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.4,
        borderRadius: 1,
        bgcolor: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.12)' },
      }}
    >
      {icon}
      <span>{label}</span>
    </Box>
  );
}
