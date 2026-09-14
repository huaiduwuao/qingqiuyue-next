'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import { getTopic, TopicWithContents } from '@/apis/topic';
import TopicCover, { formatCount } from '@/components/topic/TopicCover';
import { getDetailRoute } from '@/lib/contentRoute';
import { mediaUrl } from '@/lib/media';
import { TYPE_GRADIENT } from '@/constants/gradients';

/**
 * 专题详情 —— 沉浸式 hero + 内容网格(抖音合集风)。
 */
export default function TopicDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');
  const [topic, setTopic] = useState<TopicWithContents | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadTopic(parseInt(id));
  }, [id]);

  const loadTopic = async (topicId: number) => {
    setLoading(true);
    try {
      const res = await getTopic(topicId);
      if (res.data) setTopic(res.data);
    } catch (error) {
      console.error('加载专题失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh' }}>
        <Skeleton variant="rounded" sx={{ width: '100%', aspectRatio: '21/9' }} />
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Grid container spacing={2}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Grid key={i} size={{ xs: 6, sm: 4, md: 3 }}>
                <Skeleton variant="rounded" sx={{ aspectRatio: '16/9' }} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
    );
  }

  if (!topic) {
    return (
      <Container maxWidth="lg" sx={{ py: 10, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 20, fontWeight: 700, mb: 2 }}>专题不存在</Typography>
        <Button onClick={() => router.push('/topic')} variant="contained">
          返回专题广场
        </Button>
      </Container>
    );
  }

  const openContent = (content: any) => {
    const route = getDetailRoute(
      (content.contentType || '').toUpperCase(),
      content.id,
    );
    if (route) router.push(route);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg-page, transparent)' }}>
      {/* Hero */}
      <Box sx={{ position: 'relative' }}>
        <TopicCover
          id={topic.id}
          cover={topic.cover}
          title={topic.title}
          contentType={topic.contentType}
          aspectRatio="21/9"
          iconSize={72}
        />
        {/* 返回 */}
        <Button
          onClick={() => router.push('/topic')}
          startIcon={<ArrowBackRoundedIcon />}
          size="small"
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 2,
            color: '#fff',
            bgcolor: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(4px)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
          }}
        >
          专题广场
        </Button>

        {/* 标题区(压在 hero 底部) */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            p: { xs: 2, md: 4 },
          }}
        >
          <Container maxWidth="lg" disableGutters>
            <Typography
              sx={{
                fontSize: { xs: 24, md: 34 },
                fontWeight: 800,
                color: '#fff',
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                lineHeight: 1.2,
              }}
            >
              {topic.title}
            </Typography>
            {topic.subtitle && (
              <Typography
                sx={{
                  fontSize: { xs: 13, md: 15 },
                  color: 'rgba(255,255,255,0.9)',
                  mt: 0.75,
                  textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                }}
              >
                {topic.subtitle}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 3, mt: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'rgba(255,255,255,0.85)' }}>
                <VisibilityRoundedIcon sx={{ fontSize: 15 }} />
                <Typography sx={{ fontSize: 12, fontFamily: 'monospace' }}>
                  {formatCount(topic.viewCount)} 浏览
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'rgba(255,255,255,0.85)' }}>
                <CollectionsRoundedIcon sx={{ fontSize: 15 }} />
                <Typography sx={{ fontSize: 12, fontFamily: 'monospace' }}>
                  {topic.contentCount} 内容
                </Typography>
              </Box>
            </Box>
          </Container>
        </Box>
      </Box>

      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* 描述 */}
        {topic.description && (
          <Box
            sx={{
              p: 2,
              mb: 3,
              borderRadius: 2,
              bgcolor: 'var(--bg-surface, transparent)',
              border: '1px solid var(--border-color, transparent)',
            }}
          >
            <Typography
              sx={{
                fontSize: 13,
                color: 'var(--text-secondary, currentColor)',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}
            >
              {topic.description}
            </Typography>
          </Box>
        )}

        {/* 内容网格 */}
        <Typography
          sx={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--text-primary, currentColor)',
            mb: 2,
          }}
        >
          专题内容
        </Typography>

        {topic.contents && topic.contents.length > 0 ? (
          <Grid container spacing={2}>
            {topic.contents.map((content: any) => {
              const type = (content.contentType || '').toUpperCase();
              const gradient =
                TYPE_GRADIENT[type] || 'linear-gradient(135deg, #2D1B4E 0%, transparent 100%)';
              return (
                <Grid key={content.id} size={{ xs: 6, sm: 4, md: 3 }}>
                  <Box
                    onClick={() => openContent(content)}
                    sx={{
                      position: 'relative',
                      borderRadius: 2,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      bgcolor: 'var(--bg-surface, transparent)',
                      border: '1px solid var(--border-color, transparent)',
                      transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                      },
                    }}
                  >
                    {/* 封面 */}
                    <Box
                      sx={{
                        position: 'relative',
                        aspectRatio: '16/9',
                        background: gradient,
                        overflow: 'hidden',
                      }}
                    >
                      {(content.coverUrl || content.cover) && (
                        <Box
                          component="img"
                          src={mediaUrl(content.coverUrl || content.cover)}
                          alt={content.title}
                          loading="lazy"
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      )}
                      {/* 播放量角标 */}
                      {(content.readNum || content.viewCount) && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.3,
                            px: 0.6,
                            py: 0.2,
                            borderRadius: 0.75,
                            bgcolor: 'rgba(0,0,0,0.5)',
                            backdropFilter: 'blur(4px)',
                            color: '#fff',
                            fontSize: 9,
                            fontFamily: 'monospace',
                          }}
                        >
                          <PlayArrowRoundedIcon sx={{ fontSize: 10 }} />
                          {formatCount(content.readNum || content.viewCount)}
                        </Box>
                      )}
                      {/* 底部压暗 + 标题 */}
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          p: 1,
                          background:
                            'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)',
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#fff',
                            lineHeight: 1.3,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {content.title}
                        </Typography>
                      </Box>
                    </Box>
                    {/* meta */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 0.75 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                        <FavoriteBorderRoundedIcon
                          sx={{ fontSize: 11, color: 'var(--text-muted, currentColor)' }}
                        />
                        <Typography
                          sx={{
                            fontSize: 10,
                            color: 'var(--text-muted, currentColor)',
                            fontFamily: 'monospace',
                          }}
                        >
                          {formatCount(content.agreeNum || 0)}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 10,
                          color: 'var(--text-muted, currentColor)',
                          ml: 'auto',
                        }}
                      >
                        {type}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        ) : (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              color: 'var(--text-muted, currentColor)',
            }}
          >
            <CollectionsRoundedIcon sx={{ fontSize: 56, opacity: 0.4, mb: 1 }} />
            <Typography sx={{ fontSize: 13 }}>该专题暂无内容</Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}
