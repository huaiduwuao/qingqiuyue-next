'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ShareIcon from '@mui/icons-material/Share';
import CommentIcon from '@mui/icons-material/Comment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import AddIcon from '@mui/icons-material/Add';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-video';
import { homeClient, formatApiError } from '@/lib/api/client';
import { moduleContentAction } from '@/apis/home';
import VideoPlayer from '@/components/detail/VideoPlayer';
import DetailHeader from '@/components/detail/DetailHeader';
import { DetailComments } from '@/components/detail/DetailComments';
import { CollectButton } from '@/components/detail/CollectButton';
import { AsyncState } from '@/components/common/AsyncState';
import { track, recordHistory } from '@/lib/track';
import AIGCBadge from '@/components/AIGCBadge';

interface Video {
  id: number;
  title: string;
  cover: string;
  uploader: string;
  uploaderId?: number;
  uploaderAvatar: string;
  fans: number;
  description: string;
  duration: number;
  videoUrl?: string;
  source?: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishTime: string;
  tags: string[];
  /** 国家网信办 AIGC 合规:后端标记 true 时,前端展示「AI 生成」角标 */
  isAIGenerated?: boolean;
}

function VideoDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'video', id],
    queryFn: () => contentDetail('video', { id: id! }).then((r) => r.data as Partial<Video>),
    enabled: !!id,
  });

  // 进入详情:行为埋点(供榜单/推荐)+ 写观看历史。itemType 大写以匹配 Doris content_type。
  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'VIDEO');
      recordHistory(id);
    }
  }, [id]);

  const [favorited, setFavorited] = React.useState(false);
  const [liked, setLiked] = React.useState(false);
  const [likeBusy, setLikeBusy] = React.useState(false);
  const [optimisticLikes, setOptimisticLikes] = React.useState(0);
  const [followOverride, setFollowOverride] = React.useState<boolean | null>(null);
  const followed = followOverride ?? !!(query.data as any)?.isFollowing;
  const [followBusy, setFollowBusy] = React.useState(false);
  const [snack, setSnack] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const notify = React.useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  const handleLike = async () => {
    if (!id) {
      notify('内容 ID 缺失', 'error');
      return;
    }
    const next = !liked;
    setLiked(next);
    setOptimisticLikes((prev) => Math.max(0, prev + (next ? 1 : -1)));
    try {
      await moduleContentAction({ contentId: id, action: next ? 'agree' : 'cancel_agree' });
    } catch (err) {
      setLiked(!next);
      setOptimisticLikes((prev) => Math.max(0, prev + (next ? -1 : 1)));
      notify(formatApiError(err), 'error');
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = query.data?.title || '视频详情';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
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

  const handleFollow = async () => {
    const userId = query.data?.uploaderId;
    if (!userId) {
      notify('无法获取 UP 主信息', 'error');
      return;
    }
    if (followBusy) return;
    setFollowBusy(true);
    const wasFollowing = followed;
    setFollowOverride(!wasFollowing);
    try {
      if (wasFollowing) {
        await homeClient.delete(`/follow/${userId}`);
        notify('已取消关注');
      } else {
        await homeClient.post(`/follow/${userId}`);
        notify('关注成功');
      }
    } catch (err) {
      setFollowOverride(wasFollowing);
      notify(formatApiError(err), 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '视频详情'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <CollectButton contentId={id!} contentType="video" />
            <IconButton onClick={handleShare} sx={{ color: 'text.tertiary' }}>
              <ShareIcon />
            </IconButton>
          </Box>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => (
          <>
            <Box sx={{ bgcolor: '#000' }}>
              <Container maxWidth="lg" sx={{ py: 0 }}>
                <VideoPlayer
                  src={data.videoUrl || ''}
                  mgtvUrl={data.source || ''}
                  poster={data.cover}
                  initialDuration={data.duration}
                  autoPlay={false}
                  isAIGenerated={data.isAIGenerated === true}
                />
              </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.4 }}>
                  {data.title}
                </Typography>
                {data.isAIGenerated && <AIGCBadge variant="inline" />}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <VisibilityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{((data.viewCount || 0) / 10000).toFixed(1)}万</Typography>
                  <ThumbUpIcon sx={{ fontSize: 14, color: liked ? 'primary.main' : 'text.secondary', ml: 1 }} />
                  <Typography sx={{ fontSize: 12, color: liked ? 'primary.main' : 'text.secondary' }}>
                    {Math.max(0, (data.likeCount || 0) + optimisticLikes).toLocaleString()}
                  </Typography>
                  <CommentIcon sx={{ fontSize: 14, color: 'text.secondary', ml: 1 }} />
                  <Typography
                    component="button"
                    onClick={() => document.getElementById('video-comments')?.scrollIntoView({ behavior: 'smooth' })}
                    sx={{
                      fontSize: 12,
                      color: 'text.secondary',
                      cursor: 'pointer',
                      border: 'none',
                      bgcolor: 'transparent',
                      p: 0,
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    {data.commentCount || 0}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{data.publishTime}</Typography>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  mb: 2,
                }}
              >
                <Avatar src={data.uploaderAvatar} sx={{ width: 40, height: 40 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>{data.uploader}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{((data.fans || 0) / 10000).toFixed(1)}万 粉丝</Typography>
                </Box>
                <Chip
                  icon={<AddIcon sx={{ fontSize: 14 }} />}
                  label={followed ? '已关注' : '关注'}
                  onClick={handleFollow}
                  disabled={followBusy || !query.data?.uploaderId}
                  sx={{
                    bgcolor: followed ? 'transparent' : 'primary.main',
                    color: followed ? 'text.secondary' : 'text.primary',
                    border: followed ? '1px solid' : 'none',
                    borderColor: 'divider',
                    fontWeight: 600,
                    '&:hover': { bgcolor: followed ? 'transparent' : '#E0264B' },
                  }}
                />
              </Box>

              <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5, fontWeight: 700 }}>
                视频简介
              </Typography>
              <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, mb: 2, whiteSpace: 'pre-wrap' }}>
                {data.description}
              </Typography>

              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 3 }}>
                {(data.tags || []).map((t) => (
                  <Chip
                    key={t}
                    label={`#${t}`}
                    size="small"
                    sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 500 }}
                  />
                ))}
              </Box>

              <DetailComments contentId={id!} initialCount={data.commentCount || 0} />
            </Container>
          </>
        )}
      </AsyncState>

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
    </Box>
  );
}


export default function VideoDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <VideoDetailContent />
    </React.Suspense>
  );
}
