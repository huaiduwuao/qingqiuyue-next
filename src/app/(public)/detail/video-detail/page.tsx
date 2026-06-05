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
import { withDefaults } from '@/utils/withDefaults';
import VideoPlayer from '@/components/detail/VideoPlayer';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { useContentNavigate } from '@/lib/contentRoute';

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

interface Comment {
  id: number;
  user: string;
  avatar: string;
  content: string;
  time: string;
  likes: number;
}

const MOCK_VIDEO: Video = {
  id: 1,
  title: '江南秋日 vlog · 古镇漫游与桂花糕手作',
  cover: 'https://picsum.photos/seed/v0/800/450',
  uploader: '秋月旅人',
  uploaderAvatar: 'https://picsum.photos/seed/u1/100/100',
  fans: 28600,
  description:
    '本期视频记录了我在江南古镇度过的两天一夜。清晨的烟雨廊桥,午后的老茶馆,傍晚的桂花糕手作,完整呈现江南秋日最温柔的样貌。视频拍摄使用 Sony A7M4 + 24-70 GM,搭配大疆 Pocket 3 拍摄运动镜头。',
  duration: 480,
  viewCount: 12_5000,
  likeCount: 8230,
  commentCount: 342,
  publishTime: '2026-06-01 18:30',
  tags: ['vlog', '江南', '古镇', '美食', '旅行'],
};

const MOCK_COMMENTS: Comment[] = [
  { id: 1, user: '杭州老饕', avatar: 'https://picsum.photos/seed/c1/60/60', content: '画面太美了,问下桂花糕的模具在哪买的?', time: '2 小时前', likes: 56 },
  { id: 2, user: '摄影小白', avatar: 'https://picsum.photos/seed/c2/60/60', content: 'BGM 名字是什么?求链接', time: '3 小时前', likes: 23 },
  { id: 3, user: '古镇控', avatar: 'https://picsum.photos/seed/c3/60/60', content: '这是哪个古镇?想去!', time: '5 小时前', likes: 18 },
  { id: 4, user: '美食家阿强', avatar: 'https://picsum.photos/seed/c4/60/60', content: '结尾的桂花糕看着就好吃,请问具体地址方便分享吗?', time: '昨天', likes: 42 },
];

const MOCK_RECOMMEND = [
  { id: 51, title: '苏州一日游', cover: 'https://picsum.photos/seed/vd1/300/400', uploader: '老苏州', views: '8.2万' },
  { id: 52, title: '徽州古村', cover: 'https://picsum.photos/seed/vd2/300/400', uploader: '行走的镜头', views: '5.1万' },
  { id: 53, title: '杭州茶山', cover: 'https://picsum.photos/seed/vd3/300/400', uploader: '茶农小赵', views: '3.6万' },
  { id: 54, title: '婺源晒秋', cover: 'https://picsum.photos/seed/vd4/300/400', uploader: '摄影老李', views: '12.1万' },
];

function VideoDetailContent() {
  const searchParams = useSearchParams();
  const navigate = useContentNavigate();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'video', id],
    queryFn: () => contentDetail('video', { id: Number(id) }).then((r) => r.data as Partial<Video>),
    enabled: !!id,
    placeholderData: MOCK_VIDEO,
    select: (data) => withDefaults(MOCK_VIDEO, data),
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
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{(data.viewCount / 10000).toFixed(1)}万</Typography>
                  <ThumbUpIcon sx={{ fontSize: 14, color: 'text.secondary', ml: 1 }} />
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.likeCount.toLocaleString()}</Typography>
                  <CommentIcon sx={{ fontSize: 14, color: 'text.secondary', ml: 1 }} />
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.commentCount}</Typography>
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
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{(data.fans / 10000).toFixed(1)}万 粉丝</Typography>
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
                {data.tags.map((t) => (
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
                热门评论 ({MOCK_COMMENTS.length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                {MOCK_COMMENTS.map((c) => (
                  <Box key={c.id} sx={{ display: 'flex', gap: 1.5 }}>
                    <Avatar src={c.avatar} sx={{ width: 36, height: 36 }} />
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.3 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>{c.user}</Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{c.time}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: 13, color: 'text.tertiary', mb: 0.5, lineHeight: 1.6 }}>
                        {c.content}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                        <ThumbUpIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{c.likes}</Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ borderColor: 'divider', my: 3 }} />
              <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, fontWeight: 700 }}>
                相关推荐
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
                {MOCK_RECOMMEND.map((r) => (
                  <Box
                    key={r.id}
                    onClick={() => navigate('VIDEO', r.id)}
                    sx={{ cursor: 'pointer', '&:hover': { transform: 'translateY(-2px)' }, transition: 'all 0.15s' }}
                  >
                    <Box
                      component="img"
                      src={r.cover}
                      alt={r.title}
                      sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 1.5 }}
                    />
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mt: 1 }} noWrap>
                      {r.title}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>
                      {r.uploader} · {r.views}
                    </Typography>
                  </Box>
                ))}
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
