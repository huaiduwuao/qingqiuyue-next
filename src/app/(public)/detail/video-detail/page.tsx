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
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import CommentIcon from '@mui/icons-material/Comment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import AddIcon from '@mui/icons-material/Add';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-video';
import { collectContent } from '@/apis/global';
import { homeClient, formatApiError } from '@/lib/api/client';
import VideoPlayer from '@/components/detail/VideoPlayer';
import DetailHeader from '@/components/detail/DetailHeader';
import HotRankingBar from '@/components/home/HotRankingBar';
import { AsyncState } from '@/components/common/AsyncState';
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
    queryFn: () => contentDetail('video', { id: Number(id) }).then((r) => r.data as Partial<Video>),
    enabled: !!id,
  });

  const [favorited, setFavorited] = React.useState(false);
  const [collectBusy, setCollectBusy] = React.useState(false);
  const [followed, setFollowed] = React.useState(false);
  const [followBusy, setFollowBusy] = React.useState(false);
  const [snack, setSnack] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const notify = React.useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  const handleCollect = async () => {
    if (!id) {
      notify('内容 ID 缺失', 'error');
      return;
    }
    if (collectBusy) return;
    setCollectBusy(true);
    const next = !favorited;
    setFavorited(next);
    try {
      await collectContent({ contentId: Number(id), action: next ? 'collect' : 'cancel_collect' });
    } catch (err) {
      setFavorited(!next);
      notify(formatApiError(err), 'error');
    } finally {
      setCollectBusy(false);
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
    setFollowed(!wasFollowing);
    try {
      if (wasFollowing) {
        await homeClient.delete(`/follow/${userId}`);
        notify('已取消关注');
      } else {
        await homeClient.post(`/follow/${userId}`);
        notify('关注成功');
      }
    } catch (err) {
      setFollowed(wasFollowing);
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
            <IconButton disabled={collectBusy} onClick={handleCollect} sx={{ color: favorited ? 'primary.main' : 'text.tertiary' }}>
              {favorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
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
                  src=""
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
                  <ThumbUpIcon sx={{ fontSize: 14, color: 'text.secondary', ml: 1 }} />
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{(data.likeCount || 0).toLocaleString()}</Typography>
                  <CommentIcon sx={{ fontSize: 14, color: 'text.secondary', ml: 1 }} />
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.commentCount || 0}</Typography>
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
                  border: '1px solid #252836',
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
                    border: followed ? '1px solid #252836' : 'none',
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

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

              <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CommentIcon sx={{ color: 'primary.main' }} />
                热门评论 (0)
              </Typography>
              <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13, mb: 3 }}>
                暂无评论
              </Box>
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


      <Container maxWidth="md" sx={{ pb: 6 }}>
        <HotRankingBar contentType="VIDEO" title="全网视频热门" maxItems={10} expandable />
      </Container>
export default function VideoDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <VideoDetailContent />
    </React.Suspense>
  );
}
