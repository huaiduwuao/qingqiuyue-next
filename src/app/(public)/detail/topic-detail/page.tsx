'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getTopic, TopicWithContents } from '@/apis/topic';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Grid,
  Box,
  Skeleton,
  Container,
  Button,
  Paper,
} from '@mui/material';
import { Visibility, Article, ArrowBack } from '@mui/icons-material';

export default function TopicDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [topic, setTopic] = useState<TopicWithContents | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadTopic(parseInt(id));
    }
  }, [id]);

  const loadTopic = async (topicId: number) => {
    setLoading(true);
    try {
      const res = await getTopic(topicId);
      if (res.data) {
        setTopic(res.data);
      }
    } catch (error) {
      console.error('加载专题失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton variant="rectangular" height={300} sx={{ my: 2 }} />
        <Grid container spacing={3}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
              <Skeleton variant="rectangular" height={200} />
            </Grid>
          ))}
        </Grid>
      </Container>
    );
  }

  if (!topic) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          专题不存在
        </Typography>
        <Button component={Link} href="/topic" variant="contained">
          返回专题列表
        </Button>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* 返回按钮 */}
      <Container maxWidth="lg" sx={{ py: 2 }}>
        <Button
          component={Link}
          href="/topic"
          startIcon={<ArrowBack />}
          sx={{ color: 'text.secondary' }}
        >
          返回专题列表
        </Button>
      </Container>

      {/* 专题头部 */}
      <Box
        sx={{
          position: 'relative',
          minHeight: 300,
          display: 'flex',
          alignItems: 'center',
          bgcolor: 'grey.900',
          color: 'white',
        }}
      >
        {topic.cover && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(0,0,0,0.5)',
              },
            }}
          >
            <Box
              component="img"
              src={topic.cover}
              alt={topic.title}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </Box>
        )}
        <Container maxWidth="lg" sx={{ position: 'relative', py: 8 }}>
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
            {topic.title}
          </Typography>
          {topic.subtitle && (
            <Typography variant="h6" sx={{ opacity: 0.9, mb: 2 }}>
              {topic.subtitle}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 4, opacity: 0.8 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Visibility />
              <Typography>{topic.viewCount} 浏览</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Article />
              <Typography>{topic.contentCount} 内容</Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* 专题描述 */}
      {topic.description && (
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              专题介绍
            </Typography>
            <Typography color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {topic.description}
            </Typography>
          </Paper>
        </Container>
      )}

      {/* 专题内容 */}
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
          专题内容
        </Typography>
        {topic.contents && topic.contents.length > 0 ? (
          <Grid container spacing={3}>
            {topic.contents.map((content: any) => (
              <Grid key={content.id} size={{ xs: 12, sm: 6, md: 3 }}>
                <Card
                  component={Link}
                  href={`/detail/${content.contentType?.toLowerCase() || 'video'}-detail?id=${content.id}`}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    textDecoration: 'none',
                    transition: 'box-shadow 0.3s',
                    '&:hover': { boxShadow: 6 },
                  }}
                >
                  <CardMedia
                    component="img"
                    height="140"
                    image={content.coverUrl || '/placeholder.png'}
                    alt={content.title}
                    sx={{ objectFit: 'cover' }}
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" component="h3" noWrap gutterBottom>
                      {content.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        mb: 1,
                      }}
                    >
                      {content.subtitle}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, color: 'text.secondary' }}>
                      <Typography variant="caption">
                        {content.readNum || 0} 阅读
                      </Typography>
                      <Typography variant="caption">
                        {content.agreeNum || 0} 点赞
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <Article sx={{ fontSize: 64, opacity: 0.5, mb: 2 }} />
            <Typography>该专题暂无内容</Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}
