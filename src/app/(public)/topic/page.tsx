'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getHotTopics, listTopics, Topic } from '@/apis/topic';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Grid,
  Box,
  Skeleton,
  Button,
  Container,
} from '@mui/material';
import { Visibility, Article } from '@mui/icons-material';

export default function TopicPage() {
  const [hotTopics, setHotTopics] = useState<Topic[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadData();
  }, [page]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 加载热门专题
      const hotRes = await getHotTopics(6);
      if (hotRes.data) {
        setHotTopics(hotRes.data);
      }

      // 加载专题列表
      const listRes = await listTopics({ page, pageSize: 12 });
      if (listRes.data) {
        setTopics(listRes.data.list || []);
        setTotal(listRes.data.total || 0);
      }
    } catch (error) {
      console.error('加载专题失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const TopicCard = ({ topic }: { topic: Topic }) => (
    <Card
      component={Link}
      href={`/detail/topic-detail?id=${topic.id}`}
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
        height="160"
        image={topic.cover || '/placeholder.png'}
        alt={topic.title}
        sx={{ objectFit: 'cover' }}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" component="h3" noWrap gutterBottom>
          {topic.title}
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
            mb: 2,
          }}
        >
          {topic.subtitle || topic.description || '暂无描述'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, color: 'text.secondary' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Visibility fontSize="small" />
            <Typography variant="caption">{topic.viewCount}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Article fontSize="small" />
            <Typography variant="caption">{topic.contentCount} 内容</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const TopicSkeleton = () => (
    <Card>
      <Skeleton variant="rectangular" height={160} />
      <CardContent>
        <Skeleton variant="text" width="80%" height={28} />
        <Skeleton variant="text" width="100%" />
        <Skeleton variant="text" width="60%" />
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* 热门专题 */}
      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
          热门专题
        </Typography>
        <Grid container spacing={3}>
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                  <TopicSkeleton />
                </Grid>
              ))
            : hotTopics.map((topic) => (
                <Grid key={topic.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <TopicCard topic={topic} />
                </Grid>
              ))}
        </Grid>
      </Box>

      {/* 全部专题 */}
      <Box>
        <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
          全部专题
        </Typography>
        <Grid container spacing={3}>
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                  <TopicSkeleton />
                </Grid>
              ))
            : topics.map((topic) => (
                <Grid key={topic.id} size={{ xs: 12, sm: 6, md: 3 }}>
                  <TopicCard topic={topic} />
                </Grid>
              ))}
        </Grid>

        {/* 分页 */}
        {total > 12 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              上一页
            </Button>
            <Typography sx={{ alignSelf: 'center' }}>
              {page} / {Math.ceil(total / 12)}
            </Typography>
            <Button
              variant="outlined"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / 12)}
            >
              下一页
            </Button>
          </Box>
        )}
      </Box>
    </Container>
  );
}
