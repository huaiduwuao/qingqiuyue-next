'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import * as hermesApi from '@/apis/hermes';
import type { HermesAgentItem } from '@/beans/system';
import { AsyncState } from '@/components/common/AsyncState';
import { LoginGate } from '@/components/auth/LoginGate';

// 类型定义
interface PageResponse {
  records: HermesAgentItem[];
  totalRow: number;
}

interface PageParams {
  page: number;
  pageSize: number;
  tag?: string;
}

type HermesCardItem = HermesAgentItem & { coverUrl?: string };

export default function HomeHermesPage() {
  const router = useRouter();
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const allQuery = useQuery<HermesAgentItem[]>({
    queryKey: ['hermes', 'all'],
    queryFn: () => hermesApi.clientPage({ page: 1, pageSize: 100 }).then((r: any) => r.data?.records || []),
  });

  const tags = useMemo(() => {
    const set = new Set<string>();
    (allQuery.data || []).forEach((it) => {
      (it.tags || []).forEach((t) => t && set.add(t));
    });
    return Array.from(set);
  }, [allQuery.data]);

  const listQuery = useQuery<PageResponse>({
    queryKey: ['hermes', 'list', selectedTag, page],
    queryFn: () =>
      hermesApi
        .clientPage({ page, pageSize, tag: selectedTag || undefined } as PageParams)
        .then((r) => {
          const resp = r as { list?: HermesAgentItem[]; total?: number };
          return {
            records: resp.list || [],
            totalRow: resp.total || 0,
            page,
          };
        }),
  });

  const handleTagClick = (tag: string) => {
    setSelectedTag((cur) => (cur === tag ? '' : tag));
    setPage(1);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h4" sx={{ mb: 1 }}>Hermes 智能体</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          挑选一个 AI 角色开始对话 — 前端开发 / 运维 / 客服 …
        </Typography>

        {tags.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            <Chip
              label="全部"
              size="small"
              color={selectedTag === '' ? 'primary' : 'default'}
              variant={selectedTag === '' ? 'filled' : 'outlined'}
              onClick={() => handleTagClick('')}
            />
            {tags.map((t) => (
              <Chip
                key={t}
                label={t}
                size="small"
                color={selectedTag === t ? 'primary' : 'default'}
                variant={selectedTag === t ? 'filled' : 'outlined'}
                onClick={() => handleTagClick(t)}
              />
            ))}
          </Box>
        )}

        <AsyncState<PageResponse>
          query={listQuery}
          isEmpty={(d) => !d.records || d.records.length === 0}
          emptyText={selectedTag ? `标签「${selectedTag}」下暂无智能体` : '暂无可用智能体'}
          emptyHint="试试切换其他标签,或稍后再来"
        >
          {(data) => {
            const list = (data as { records: HermesAgentItem[]; totalRow: number }).records || [];
            return (
            <Grid container spacing={2}>
              {list.map((raw) => {
                const item = raw as HermesCardItem;
                return (
                  <Grid key={item.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <CardActionArea
                        sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                        onClick={() => router.push(`/hermes/${item.id}`)}
                      >
                        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar
                              src={item.avatarUrl}
                              sx={{
                                width: 48,
                                height: 48,
                                bgcolor: 'primary.main',
                                fontSize: 18,
                                fontWeight: 700,
                              }}
                            >
                              {(item.name || item.agentId || '?')[0]?.toUpperCase()}
                            </Avatar>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography variant="subtitle1" noWrap sx={{ fontWeight: 600 }}>
                                {item.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {item.role || item.agentId}
                              </Typography>
                            </Box>
                          </Box>

                          {item.description && (
                            <Typography variant="body2" color="text.secondary" sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}>
                              {item.description}
                            </Typography>
                          )}

                          <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 0.5 }}>
                            {(item.tags || []).map((t, i) => (
                              <Chip key={i} label={t} size="small" variant="outlined" />
                            ))}
                          </Box>

                          <Box sx={{ flex: 1 }} />

                          <LoginGate mode="overlay" message="登录后对话">
                            <Button
                              variant="contained"
                              startIcon={<ChatBubbleOutlineIcon />}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/hermes/${item.id}`);
                              }}
                              fullWidth
                            >
                              开始对话
                            </Button>
                          </LoginGate>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
            );
          }}
        </AsyncState>

        {listQuery.data && listQuery.data.totalRow > pageSize && (
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <Typography variant="body2" sx={{ alignSelf: 'center' }}>
              第 {page} 页 / 共 {Math.ceil(listQuery.data.totalRow / pageSize)} 页
            </Typography>
            <Button
              size="small"
              variant="outlined"
              disabled={page * pageSize >= listQuery.data.totalRow}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </Box>
        )}
      </Box>
    </Container>
  );
}