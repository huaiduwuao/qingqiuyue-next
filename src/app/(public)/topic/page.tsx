'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import { getHotTopics, listTopics, Topic } from '@/apis/topic';
import TopicCard from '@/components/topic/TopicCard';
import PublicTopBar from '@/components/layout/PublicTopBar';

/**
 * 专题广场 —— 抖音/榜单风。
 *
 * 布局:
 *  - 顶部 hero 条:渐变标题 + 简介
 *  - 热门专题:大卡 3 列
 *  - 全部专题:4 列网格
 * 复用 TopicCard(封面渐变兜底 + 标题压图 + 内容数角标)。
 */
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
      const hotRes = await getHotTopics(6);
      if (hotRes.data) setHotTopics(hotRes.data);

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

  const SectionTitle = ({
    icon,
    title,
    extra,
  }: {
    icon: React.ReactNode;
    title: string;
    extra?: string;
  }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
      {icon}
      <Typography
        sx={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--text-primary, currentColor)',
          ml: 0.75,
          flex: 1,
        }}
      >
        {title}
      </Typography>
      {extra && (
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, currentColor)' }}>
          {extra}
        </Typography>
      )}
    </Box>
  );

  const CardSkeleton = () => (
    <Box>
      <Skeleton variant="rounded" sx={{ aspectRatio: '16/9', borderRadius: 2 }} />
      <Skeleton variant="text" width="70%" sx={{ mt: 1 }} />
      <Skeleton variant="text" width="40%" />
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--bg-page, transparent)' }}>
      {/* 顶部导航(返回 + 搜索 + 账号) */}
      <PublicTopBar title="专题广场" showBack={false} />

      {/* Hero 条 */}
      <Box
        sx={{
          background:
            'linear-gradient(135deg, rgba(254,44,85,0.12) 0%, rgba(139,92,246,0.10) 50%, rgba(37,244,238,0.08) 100%)',
          borderBottom: '1px solid var(--border-color, transparent)',
          py: { xs: 3, md: 4 },
          mb: 3,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 16px rgba(254,44,85,0.3)',
              }}
            >
              <CollectionsRoundedIcon sx={{ fontSize: 24, color: '#fff' }} />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontSize: { xs: 20, md: 24 },
                  fontWeight: 800,
                  color: 'var(--text-primary, currentColor)',
                  lineHeight: 1.2,
                }}
              >
                专题广场
              </Typography>
              <Typography
                sx={{
                  fontSize: 12,
                  color: 'var(--text-secondary, currentColor)',
                  mt: 0.25,
                }}
              >
                精选内容合集 · 沉浸式浏览 · 持续更新
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ pb: 6 }}>
        {/* 热门专题 */}
        <Box sx={{ mb: 5 }}>
          <SectionTitle
            icon={<WhatshotRoundedIcon sx={{ fontSize: 20, color: 'primary.main' }} />}
            title="热门专题"
            extra={`${hotTopics.length} 个`}
          />
          <Grid container spacing={2}>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                    <CardSkeleton />
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
          <SectionTitle
            icon={<CollectionsRoundedIcon sx={{ fontSize: 20, color: 'secondary.main' }} />}
            title="全部专题"
            extra={`共 ${total} 个`}
          />
          {topics.length === 0 && !loading ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 8,
                color: 'var(--text-muted, currentColor)',
              }}
            >
              <CollectionsRoundedIcon sx={{ fontSize: 56, opacity: 0.4, mb: 1 }} />
              <Typography sx={{ fontSize: 13 }}>暂无专题，敬请期待</Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                      <CardSkeleton />
                    </Grid>
                  ))
                : topics.map((topic) => (
                    <Grid key={topic.id} size={{ xs: 12, sm: 6, md: 3 }}>
                      <TopicCard topic={topic} />
                    </Grid>
                  ))}
            </Grid>
          )}

          {/* 分页 */}
          {total > 12 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, gap: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                上一页
              </Button>
              <Typography sx={{ alignSelf: 'center', fontSize: 13 }}>
                {page} / {Math.ceil(total / 12)}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / 12)}
              >
                下一页
              </Button>
            </Box>
          )}
        </Box>
      </Container>
    </Box>
  );
}
