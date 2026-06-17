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
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import CommentIcon from '@mui/icons-material/Comment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import AddIcon from '@mui/icons-material/Add';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-video';
import VideoPlayer from '@/components/detail/VideoPlayer';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';

interface Video {
  id: number;
  title: string;
  cover: string;
  uploader: string;
  uploaderAvatar: string;
  fans: number;
  description: string;
  duration: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishTime: string;
  tags: string[];
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
  const [followed, setFollowed] = React.useState(false);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '视频详情'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={() => setFavorited((f) => !f)} sx={{ color: favorited ? 'primary.main' : 'text.tertiary' }}>
              {favorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
            <IconButton sx={{ color: 'text.tertiary' }}>
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
                <VideoPlayer src="" poster={data.cover} initialDuration={data.duration} autoPlay={false} />
              </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mb: 1.5, lineHeight: 1.4 }}>
                {data.title}
              </Typography>

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
                  onClick={() => setFollowed((f) => !f)}
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
