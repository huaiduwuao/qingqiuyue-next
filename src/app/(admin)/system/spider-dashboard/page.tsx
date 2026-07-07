'use client';

/**
 * SpiderDashboardPage — 爬虫监控大盘
 */

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import * as spiderApi from '@/apis/spider';

function useSpiderDashboard() {
  const health = useQuery({
    queryKey: ['spider', 'health'],
    queryFn: () => spiderApi.getHealth().then((r: any) => r.data),
    refetchInterval: 10_000,
  });
  const stats = useQuery({
    queryKey: ['spider', 'stats'],
    queryFn: () => spiderApi.getCrawlStats().then((r: any) => r.data),
    refetchInterval: 10_000,
  });
  const timeseries = useQuery({
    queryKey: ['spider', 'timeseries'],
    queryFn: () => spiderApi.getCrawlTimeseries().then((r: any) => r.data),
    refetchInterval: 30_000,
  });
  const activity = useQuery({
    queryKey: ['spider', 'activity'],
    queryFn: () => spiderApi.getRecentActivity().then((r: any) => r.data),
    refetchInterval: 10_000,
  });
  const tasks = useQuery({
    queryKey: ['spider', 'tasks'],
    queryFn: () => spiderApi.listTasks({ pageNumber: 1, pageSize: 10 }).then((r: any) => r.data?.records || r.data?.list || []),
    refetchInterval: 10_000,
  });

  return { health, stats, timeseries, activity, tasks };
}

export default function SpiderDashboardPage() {
  const { health, stats, timeseries, activity, tasks } = useSpiderDashboard();

  const s = stats.data || {};
  const successRate = s.total_tasks > 0 ? Math.round((s.completed_tasks / s.total_tasks) * 100) : 0;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        爬虫监控大盘
      </Typography>

      {(health.isError || stats.isError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          无法连接爬虫服务,请确认 spider-api 已启动
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="overline">健康状态</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <Chip
                  label={health.data?.status || 'unknown'}
                  color={health.data?.status === 'healthy' ? 'success' : 'default'}
                  size="small"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="overline">总任务数</Typography>
              <Typography variant="h4">{s.total_tasks || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="overline">成功率</Typography>
              <Typography variant="h4">{successRate}%</Typography>
              <LinearProgress variant="determinate" value={successRate} sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="overline">运行中</Typography>
              <Typography variant="h4">{s.running_tasks || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>任务状态分布</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[
                  { label: '运行中', value: s.running_tasks || 0, color: 'primary' },
                  { label: '已完成', value: s.completed_tasks || 0, color: 'success' },
                  { label: '失败', value: s.failed_tasks || 0, color: 'error' },
                  { label: '待执行', value: s.pending_tasks || 0, color: 'warning' },
                ].map((item) => (
                  <Box key={item.label}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{item.label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.value}</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(100, (item.value / Math.max(1, s.total_tasks || 1)) * 100)}
                      color={item.color as any}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>最近活动</Typography>
              <List dense sx={{ maxHeight: 260, overflow: 'auto' }}>
                {(activity.data?.events || []).slice(0, 20).map((a: any, i: number) => (
                  <React.Fragment key={a.id || i}>
                    <ListItem>
                      <ListItemText
                        primary={a.title || a.message || a.event || 'activity'}
                        secondary={a.detail || (a.time ? new Date(a.time).toLocaleString() : '')}
                      />
                      {a.severity && <Chip label={a.severity} size="small" color={a.severity === 'error' ? 'error' : a.severity === 'success' ? 'success' : 'default'} />}
                    </ListItem>
                    {i < (activity.data?.events || []).length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))}
                {(activity.data?.events || []).length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>暂无活动</Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>最近任务</Typography>
              <List dense>
                {(tasks.data || []).map((t: any, i: number) => (
                  <React.Fragment key={t.id || i}>
                    <ListItem>
                      <ListItemText
                        primary={t.start_url || t.url || 'unknown'}
                        secondary={`${t.status} | pages=${t.pages_crawled || 0} | items=${t.items_found || 0}`}
                      />
                      <Chip
                        label={t.status}
                        color={
                          t.status === 'running' ? 'primary'
                          : t.status === 'completed' ? 'success'
                          : t.status === 'error' ? 'error'
                          : 'default'
                        }
                        size="small"
                      />
                    </ListItem>
                    {i < (tasks.data || []).length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
