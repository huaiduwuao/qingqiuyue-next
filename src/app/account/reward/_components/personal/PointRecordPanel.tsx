'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { alpha } from '@mui/material/styles';
import { listMyPointRecords, type PointRecord } from '@/apis/dashboard';

// SourceType → 中文标签和颜色（与后端 handler/reward_extra.go sourceType 对齐）
const SOURCE_META: Record<string, { label: string; color: string; bg: string }> = {
  demand_settle:  { label: '需求结算', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)' },
  demand_complete:{ label: '需求完成', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  task_approve:   { label: '任务通过', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)' },
  task_reward:    { label: '任务奖励', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
  achievement:    { label: '成就奖励', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)' },
  signup_bonus:   { label: '注册奖励', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
  '':             { label: '系统',   color: 'text.secondary', bg: 'action.hover' },
};

function sourceMeta(t: string) {
  return SOURCE_META[t] || SOURCE_META[''];
}

interface Props {
  currentUserId: number;
}

/**
 * 个人工作台 — 积分流水面板
 *
 * 从 /reward/point-records 拉我的所有入账记录,每条包含 sourceType/sourceId/sourceTitle/sourceUrl,
 * 点击跳转到来源需求/任务(中类均为“需求管理“tab、任务看板详情弹窗)。
 * 分页: 8 条/页,上下页按钮。
 */
export default function PointRecordPanel({ currentUserId }: Props) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const query = useQuery({
    queryKey: ['personal', 'point-records', currentUserId, page],
    queryFn: () => listMyPointRecords({ page, pageSize }).then((r: any) => ({
      list: (r.list || r.records || []) as PointRecord[],
      total: Number(r.total ?? r.totalRow ?? 0),
    })),
    enabled: !!currentUserId,
    placeholderData: { list: [], total: 0 } as { list: PointRecord[]; total: number },
    refetchOnMount: 'always',
    staleTime: 15 * 1000,
  });

  const list = query.data?.list ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleOpen = (rec: PointRecord) => {
    if (!rec.sourceUrl) return;
    if (rec.sourceType === 'task_approve' || rec.sourceType === 'task_reward') {
      // 任务: 跳到需求管理 tab + 打开 taskboard 详情
      const m = rec.sourceUrl.match(/taskId=(\\d+)/);
      const taskId = m ? Number(m[1]) : null;
      if (taskId) {
        const w = window.open(`about:blank`, '_blank');
        // 同源 taskboard 详情会跳转以 window.opener 处理, 这里不重复处理
        w?.close();
      }
      router.push(rec.sourceUrl);
    } else {
      router.push(rec.sourceUrl);
    }
  };

  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        p: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <ReceiptLongIcon sx={{ fontSize: 16, color: '#FE2C55', mr: 1 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          积分流水
        </Typography>
        <Chip
          size="small"
          label={`共 ${total} 笔`}
          sx={{ height: 18, fontSize: 10, fontWeight: 600, bgcolor: 'action.hover' }}
        />
      </Box>

      {query.isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={52} />
          ))}
        </Box>
      ) : list.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
            暂无积分记录 — 等待需求结算后会出现首笔入账
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {list.map((rec) => {
            const meta = sourceMeta(rec.sourceType);
            const isIncome = rec.point > 0;
            return (
              <Box
                key={rec.id}
                onClick={() => handleOpen(rec)}
                sx={{
                  p: 1.25,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: rec.sourceUrl ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  '&:hover': rec.sourceUrl ? {
                    borderColor: meta.color,
                    bgcolor: alpha(meta.color, 0.04),
                  } : {},
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 36, height: 36, borderRadius: 1, bgcolor: meta.bg,
                      color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 13, fontFamily: 'monospace', flexShrink: 0,
                    }}
                  >
                    {isIncome ? '+' : ''}{rec.point}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                      <Chip
                        size="small"
                        label={meta.label}
                        sx={{ height: 16, fontSize: 9, fontWeight: 600, bgcolor: meta.bg, color: meta.color }}
                      />
                      <Typography
                        sx={{
                          fontSize: 12, fontWeight: 500, color: 'text.primary',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        title={rec.sourceTitle || rec.info}
                      >
                        {rec.sourceTitle || rec.info || '—'}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                      {rec.info} · {rec.createTime}
                    </Typography>
                  </Box>
                  {rec.sourceUrl && (
                    <OpenInNewIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
            第 {page} / {totalPages} 页
          </Typography>
          <Box>
            <IconButton size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <NavigateBeforeIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              <NavigateNextIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      )}
    </Box>
  );
}
