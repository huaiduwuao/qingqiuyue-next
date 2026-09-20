'use client';

/**
 * 发布记录列表(创作者中心用)。
 *   - 默认每 5 秒自动轮询,直到所有任务到达终态(success/failed)
 *   - 失败任务显示「重发」按钮 → POST /share/retry/:id
 */

import React, { useEffect } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { listTasks, retryTask, TASK_STATUS_META, type ShareTask } from '@/apis/share';
import { PLATFORMS, platformLabel } from '@/apis/system-platform-account';

const LIST_KEY = ['share-tasks'];

export interface ShareTaskListProps {
  platform?: string;
  limit?: number;
}

export default function ShareTaskList({ platform, limit = 20 }: ShareTaskListProps) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: [...LIST_KEY, platform],
    queryFn: () => listTasks({ page: 1, pageSize: limit, platform }),
    refetchInterval: (query) => {
      const list: any[] = (query.state.data as any)?.list || [];
      const hasUnfinished = list.some(
        (t) => t.status === 'pending' || t.status === 'uploading' || t.status === 'publishing'
      );
      return hasUnfinished ? 5000 : false;
    },
  });

  const tasks: ShareTask[] = (data as any)?.list || [];

  const retryMut = useMutation({
    mutationFn: (id: number) => retryTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });

  useEffect(() => {
    // 当平台筛选变化时,失效缓存
    qc.invalidateQueries({ queryKey: LIST_KEY });
  }, [platform, qc]);

  if (isLoading) {
    return (
      <Typography sx={{ fontSize: 13, color: 'text.secondary', p: 2 }}>加载中…</Typography>
    );
  }

  if (tasks.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
          还没有发布记录。从专题/详情页点「分享到抖音/快手」开始第一次发布。
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          共 {tasks.length} 条记录 · 每 5 秒自动刷新直到全部完成
        </Typography>
        <IconButton size="small" onClick={() => refetch()}>
          <RefreshRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
      {tasks.map((t) => {
        const meta = TASK_STATUS_META[t.status] || TASK_STATUS_META.pending;
        const platformColor = PLATFORMS.find((p) => p.value === t.platform)?.color || 'primary.main';
        return (
          <Box
            key={t.id}
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ width: 4, alignSelf: 'stretch', bgcolor: platformColor, borderRadius: 1 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                  {platformLabel(t.platform)}
                </Typography>
                <Chip label={meta.label} color={meta.color} size="small" sx={{ height: 20, fontSize: 11 }} />
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {t.contentType} #{t.contentId}
                </Typography>
              </Box>
              {t.errorMsg && (
                <Typography sx={{ fontSize: 12, color: 'error.main', mt: 0.5 }}>
                  错误:{t.errorMsg}
                </Typography>
              )}
              {t.status === 'success' && t.remoteUrl && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Typography
                    sx={{
                      fontSize: 12,
                      color: 'text.secondary',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {t.remoteUrl}
                  </Typography>
                  <IconButton size="small" onClick={() => window.open(t.remoteUrl, '_blank')}>
                    <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              )}
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                {t.createTime}
                {t.retryCount > 0 && ` · 已重试 ${t.retryCount} 次`}
              </Typography>
            </Box>
            {t.status === 'failed' && (
              <Button
                size="small"
                variant="outlined"
                onClick={() => retryMut.mutate(t.id)}
                disabled={retryMut.isPending}
              >
                重发
              </Button>
            )}
          </Box>
        );
      })}
    </Box>
  );
}