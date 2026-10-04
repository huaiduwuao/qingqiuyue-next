'use client';

import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { listTasks, retryTask, TASK_STATUS_META, type ShareTask } from '@/apis/share';
import { PLATFORMS, platformLabel } from '@/apis/share-account';
import { openExternal } from '@/lib/safeUrl';
import { MobileSection, MobileListRow } from '@/components/mobile/MobileSection';

/** 与 components/share/ShareTaskList 同一个 queryKey,缓存与轮询行为一致。 */
const LIST_KEY = ['share-tasks'];

/**
 * 手机版发布记录:一张卡片里的列表行(平台色块 + 平台/状态 + 一行时间或错误),
 * 失败的行尾「重发」,成功的行尾打开远端链接。未完成时同样 5 秒轮询。
 */
export default function ShareTaskListMobile({ platform, limit = 50 }: { platform?: string; limit?: number }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: [...LIST_KEY, platform],
    queryFn: () => listTasks({ page: 1, pageSize: limit, platform }),
    refetchInterval: (query) => {
      const list: ShareTask[] = (query.state.data as { list?: ShareTask[] } | undefined)?.list || [];
      return list.some((t) => t.status === 'pending' || t.status === 'uploading' || t.status === 'publishing') ? 5000 : false;
    },
  });
  const tasks: ShareTask[] = (data as { list?: ShareTask[] } | undefined)?.list || [];

  const retryMut = useMutation({
    mutationFn: (id: number) => retryTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });

  if (isLoading) return <Skeleton variant="rounded" height={160} sx={{ borderRadius: 3 }} />;

  if (tasks.length === 0) {
    return (
      <MobileSection>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', textAlign: 'center', pt: 2.5, pb: 0.75 }}>
          还没有发布记录。在专题/详情页点「分享到抖音/快手」开始第一次发布。
        </Typography>
      </MobileSection>
    );
  }

  return (
    <MobileSection flush title="发布记录" extra={`${tasks.length} 条`}>
      {tasks.map((t, i) => {
        const meta = TASK_STATUS_META[t.status] || TASK_STATUS_META.pending;
        const color = PLATFORMS.find((p) => p.value === t.platform)?.color || 'primary.main';
        const statusColor = meta.color === 'default' ? 'text.secondary' : `${meta.color}.main`;
        return (
          <MobileListRow
            key={t.id}
            divider={i > 0}
            leading={<Box sx={{ width: 4, height: 36, flexShrink: 0, borderRadius: 1, bgcolor: color }} />}
            title={
              <>
                {platformLabel(t.platform)}
                <Box component="span" sx={{ ml: 1, fontSize: 12, fontWeight: 600, color: statusColor }}>
                  {meta.label}
                </Box>
              </>
            }
            subtitle={
              t.errorMsg ? (
                <Box component="span" sx={{ color: 'error.main' }}>
                  {t.errorMsg}
                </Box>
              ) : (
                `${t.contentType} #${t.contentId} · ${t.createTime}${t.retryCount > 0 ? ` · 重试 ${t.retryCount} 次` : ''}`
              )
            }
            trailing={
              t.status === 'failed' ? (
                <Button
                  size="small"
                  variant="text"
                  disabled={retryMut.isPending}
                  onClick={() => retryMut.mutate(t.id)}
                  sx={{ minWidth: 0, flexShrink: 0 }}
                >
                  重发
                </Button>
              ) : t.status === 'success' && t.remoteUrl ? (
                <IconButton size="small" aria-label="打开" onClick={() => openExternal(t.remoteUrl)}>
                  <OpenInNewRoundedIcon fontSize="small" />
                </IconButton>
              ) : null
            }
          />
        );
      })}
    </MobileSection>
  );
}
