'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import { homeClient } from '@/lib/api/client';
import { sendComment } from '@/apis/home';
import { reportContent } from '@/apis/global';

interface WerewolfVideo {
  id: number;
  brand: string;
  centerTitle: string;
  centerSubtitle: string;
  episode: number;
  durationSec: number;
  cover: string;
  user: { id: number; name: string; handle: string; verified: boolean; avatar: string };
  caption: string;
  views: number;
  likes: number;
  comments: number;
  collects: number;
  shares: number;
  prevEpisode: number;
  nextEpisode: number;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toString();
}

export function WerewolfPlayer() {
  const queryClient = useQueryClient();
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
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
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ─── 视频流 + 上下切换 ───
  const { data: feed } = useQuery({
    queryKey: ['home', 'werewolf', 'feed'],
    queryFn: () => homeClient.get<{ list: WerewolfVideo[] }>('/werewolf/feed').then((r) => r.data.list),
  });
  const [index, setIndex] = useState(0);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  // 导航锁:切换动画期间(以及滚轮惯性持续期间)禁止再次切换,避免一次操作连翻多页
  const navLock = useRef(false);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videos = feed ?? [];
  const video = videos[index];
  const indexRef = useRef(0);
  indexRef.current = index;

  const lockNav = useCallback((ms = 380) => {
    navLock.current = true;
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = setTimeout(() => { navLock.current = false; }, ms);
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (navLock.current) return;
      const next = indexRef.current + dir;
      if (next < 0 || next >= videos.length) return;
      setSlideDir(dir);
      setIndex(next);
      lockNav();
    },
    [videos.length, lockNav],
  );

  // 切换视频时重置单条播放状态
  useEffect(() => {
    setCurrentTime(0);
    setPlaying(true);
    setLiked(false);
    setCollected(false);
    if (video) {
      setLikedCount(video.likes);
      setCollectedCount(video.collects);
    }
  }, [index, video]);

  // 滚轮上下切换:锁定期间(含惯性滚动)持续刷新锁,滚动停止后才解锁,避免一次滑动连翻多页
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (Math.abs(e.deltaY) < 8) return;
      if (navLock.current) {
        lockNav(220); // 惯性持续,延长锁直到滚动停止
        return;
      }
      go(e.deltaY > 0 ? 1 : -1); // go 内部会 lockNav
    },
    [go, lockNav],
  );

  const likeMutation = useMutation({
    mutationFn: (nextLiked: boolean) =>
      homeClient.post<{ liked: boolean; likes: number }>('/werewolf/like', { liked: nextLiked }),
    onSuccess: (res) => {
      const data = (res as any).data;
      if (data?.likes != null) setLikedCount(data.likes);
    },
  });

  const collectMutation = useMutation({
    mutationFn: (nextCollected: boolean) =>
      homeClient.post<{ collected: boolean; collects: number }>('/werewolf/collect', { collected: nextCollected }),
    onSuccess: (res) => {
      const data = (res as any).data;
      if (data?.collects != null) setCollectedCount(data.collects);
    },
  });

  const handleLike = async () => {
    if (likeMutation.isPending) return;
    const nextLiked = !liked;
    // 乐观更新
    const prevLiked = liked;
    const prevCount = likedCount;
    setLiked(nextLiked);
    setLikedCount((c) => c + (nextLiked ? 1 : -1));
    try {
      await likeMutation.mutateAsync(nextLiked);
    } catch {
      // 回滚
      setLiked(prevLiked);
      setLikedCount(prevCount);
      notify('操作失败,请稍后再试', 'error');
    }
  };

  const handleCollect = async () => {
    if (collectMutation.isPending) return;
    const nextCollected = !collected;
    // 乐观更新
    const prevCollected = collected;
    const prevCount = collectedCount;
    setCollected(nextCollected);
    setCollectedCount((c) => c + (nextCollected ? 1 : -1));
    try {
      await collectMutation.mutateAsync(nextCollected);
    } catch {
      // 回滚
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
    if (!video?.user?.id || followBusy) return;
    setFollowBusy(true);
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    try {
      if (wasFollowing) {
        await homeClient.delete(`/follow/${video.user.id}`);
        notify('已取消关注');
      } else {
        await homeClient.post(`/follow/${video.user.id}`);
        notify('关注成功');
      }
    } catch {
      setFollowing(wasFollowing);
      notify('操作失败，请稍后再试', 'error');
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
        await navigator.share({
          title: video?.caption || 'AI 狼人杀',
          url: typeof window !== 'undefined' ? window.location.href : '',
        });
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
      } else if (e.key === 'm') {
        setMuted((m) => !m);
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

  // ─── 跟手拖拽切换 ───
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [vh, setVh] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef({ active: false, startY: 0, moved: 0 });

  // 回调 ref:viewport 挂载(视频加载后)即测高度并监听尺寸变化,依赖恒定
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
    // 到顶/到底加阻尼
    if ((d > 0 && index === 0) || (d < 0 && index === videos.length - 1)) d *= 0.32;
    setDragY(d);
  };
  const endDrag = () => {
    const s = dragState.current;
    if (!s.active) return;
    s.active = false;
    setDragging(false);
    const d = dragY;
    if (s.moved < 6) {
      // 视为点击:播放/暂停
      setDragY(0);
      setPlaying((p) => !p);
      return;
    }
    const threshold = (vh || 600) * 0.2;
    if (!navLock.current && d <= -threshold && index < videos.length - 1) {
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
      // 未过阈值 / 动画进行中 → 回弹
      setDragY(0);
    }
  };

  if (!video) return null;

  const progress = (currentTime / video.durationSec) * 100;

  const navBtnSx = {
    width: 40,
    height: 40,
    bgcolor: 'rgba(0,0,0,0.45)',
    color: '#fff',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.12)',
    transition: 'background 0.15s, transform 0.15s',
    '&:hover': { bgcolor: 'rgba(0,0,0,0.65)', transform: 'scale(1.06)' },
    '&.Mui-disabled': { opacity: 0.3, color: 'rgba(255,255,255,0.5)' },
  } as const;

  return (
    <Box
      ref={containerRef}
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
      {/* 视频区(viewport + 纵向 track,跟手拖拽切换) */}
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
            height: vh ? vh * videos.length : '100%',
            transform: `translateY(${-index * (vh || 0) + dragY}px)`,
            transition: dragging ? 'none' : 'transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1)',
            willChange: 'transform',
          }}
        >
          {videos.map((v, i) => (
            <Box
              key={v.id}
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
                background: `url(${v.cover}) center/cover`,
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.85) 100%)',
                  pointerEvents: 'none',
                },
              }}
            >
              {i === index && (
                <>
        {/* 上下切换按钮(右侧中部) */}
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
          <Tooltip title="上一个 (↑)" placement="left">
            <span>
              <IconButton
                onClick={(e) => { e.stopPropagation(); go(-1); }}
                disabled={index <= 0}
                sx={navBtnSx}
              >
                <KeyboardArrowUpRoundedIcon sx={{ fontSize: 26 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="下一个 (↓)" placement="left">
            <span>
              <IconButton
                onClick={(e) => { e.stopPropagation(); go(1); }}
                disabled={index >= videos.length - 1}
                sx={navBtnSx}
              >
                <KeyboardArrowDownRoundedIcon sx={{ fontSize: 26 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* 进度指示(右侧竖条) */}
        <Box
          sx={{
            position: 'absolute',
            right: 4,
            top: '50%',
            transform: 'translateY(-50%)',
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            gap: 0.5,
            zIndex: 3,
          }}
        >
          {videos.map((_, i) => (
            <Box
              key={i}
              sx={{
                width: 3,
                height: i === index ? 18 : 8,
                borderRadius: 2,
                bgcolor: i === index ? 'var(--brand-color, #FE2C55)' : 'rgba(255,255,255,0.3)',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </Box>

        {/* 顶部:品牌徽标 */}
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
              background: 'linear-gradient(135deg, var(--brand-color, #FE2C55) 0%, #8B5CF6 100%)',
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

        {/* 中心:大标题 + 副标题 */}
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
              fontSize: { xs: 48, md: 72 },
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: 2,
              mb: 1.5,
            }}
          >
            {video.centerTitle}
          </Typography>
          <Typography sx={{ fontSize: { xs: 14, md: 18 }, fontWeight: 500, color: 'rgba(255,255,255,0.92)' }}>
            {video.centerSubtitle}
          </Typography>
        </Box>

        {/* 暂停遮罩 */}
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

        {/* 右侧操作按钮栈 */}
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
          {/* 用户头像 + 关注按钮 */}
          <Box sx={{ position: 'relative', mb: 0.5 }}>
            <Avatar
              src={video.user.avatar}
              sx={{
                width: 48,
                height: 48,
                border: '2px solid #FFFFFF',
                background: 'linear-gradient(135deg, var(--brand-color, #FE2C55) 0%, #8B5CF6 100%)',
              }}
            >
              {video.user.name[0]}
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
            onClick={(e) => {
              e.stopPropagation();
              handleLike();
            }}
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
            onClick={(e) => {
              e.stopPropagation();
              handleCollect();
            }}
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

        {/* 左下角:用户 + 描述 */}
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
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>@{video.user.handle}</Typography>
            {video.user.verified && (
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
            <Typography sx={{ fontSize: 11 }}>原声 - {video.brand}</Typography>
          </Box>
        </Box>
                </>
              )}
            </Box>
          ))}
        </Box>
      </Box>

      {/* 底部播放控制条 */}
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
