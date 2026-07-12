'use client';

/**
 * 个人工作台 — 我的需求面板
 *
 * 不带 groupId 拉取,后端按登录用户过滤;
 * 顶部 4 个状态计数卡(Tab 形式),点击切换;
 * 列表显示当前选中状态的最近 8 条;点击「管理 →」跳到对应需求管理 tab。
 *
 * 跳转时把 demand 自己的 groupId 同步到父组件的 selectedGroupId,
 * 这样需求管理 tab 打开后能直接看到上下文一致的团队。
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { alpha } from '@mui/material/styles';
import { listDemands } from '@/apis/reward-demand';
import type { DemandItem, DemandStatus } from '@/beans/reward';
import type { GroupInfo } from '@/apis/reward-group';

interface Props {
  groups: GroupInfo[];
  currentUserId: number;
  onOpenTab?: (groupId: number) => void;
  onOpenDetail?: (groupId: number, demandId: number) => void;
}

const STATUS_META: Record<DemandStatus, { label: string; color: string; bg: string }> = {
  PENDING:   { label: '待发布', color: 'text.secondary',  bg: 'rgba(139, 143, 163, 0.12)' },
  PUBLISHED: { label: '进行中', color: '#06B6D4',          bg: 'rgba(6, 182, 212, 0.12)' },
  COMPLETED: { label: '待结账', color: '#8B5CF6',          bg: 'rgba(139, 92, 246, 0.12)' },
  SETTLED:   { label: '已结算', color: 'success.main',    bg: 'rgba(93, 219, 150, 0.12)' },
  CLOSED:    { label: '已关闭', color: 'text.disabled',   bg: 'rgba(90, 94, 114, 0.12)' },
};

const STATUS_ORDER: DemandStatus[] = ['PENDING', 'PUBLISHED', 'COMPLETED', 'SETTLED', 'CLOSED'];

function statusMeta(s?: string) {
  return STATUS_META[(s as DemandStatus) || 'PENDING'] || STATUS_META.PENDING;
}

function timeAgo(s?: string) {
  if (!s) return '';
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

export default function PersonalDemandPanel({ groups, currentUserId, onOpenTab, onOpenDetail }: Props) {
  const [tab, setTab] = useState<DemandStatus | ''>('');

  // 拉足够多条用于做 4 个状态计数 + 列表显示
  const query = useQuery({
    queryKey: ['personal', 'demands', 'all', currentUserId],
    queryFn: () =>
      listDemands({ pageSize: 200 } as any).then((r: any) => {
        const records = r?.data?.records || r?.data?.list || [];
        return records as DemandItem[];
      }),
    enabled: !!currentUserId,
    placeholderData: [],
  });

  const records = query.data || [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: records.length };
    STATUS_ORDER.forEach((s) => (c[s] = 0));
    records.forEach((d) => {
      const s = (d.status || 'PENDING') as DemandStatus;
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [records]);

  const filtered = useMemo(() => {
    if (!tab) return records;
    return records.filter((d) => (d.status || 'PENDING') === tab);
  }, [records, tab]);

  const top = filtered.slice(0, 8);

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
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <AssignmentIcon sx={{ fontSize: 16, color: 'warning.main', mr: 1 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          我的需求
        </Typography>
        {onOpenTab && records.length > 0 && groups[0] && (
          <Button
            size="small"
            endIcon={<ArrowForwardIosIcon sx={{ fontSize: 10 }} />}
            onClick={() => onOpenTab(groups[0].id)}
            sx={{ minWidth: 0, color: 'text.secondary', fontSize: 11, textTransform: 'none' }}
          >
            管理
          </Button>
        )}
      </Box>

      {/* 状态计数 Tab */}
      <Tabs
        value={tab || 'all'}
        onChange={(_, v) => setTab(v === 'all' ? '' : (v as DemandStatus))}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          minHeight: 32,
          mb: 1,
          '& .MuiTab-root': {
            minHeight: 32,
            py: 0.25,
            px: 1.25,
            fontSize: 11,
            textTransform: 'none',
            minWidth: 0,
          },
          '& .MuiTabs-indicator': { height: 2 },
        }}
      >
        <Tab
          value="all"
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              全部
              <Chip label={counts.all || 0} size="small" sx={{ height: 16, fontSize: 9, '& .MuiChip-label': { px: 0.75 } }} />
            </Box>
          }
        />
        {STATUS_ORDER.map((s) => (
          <Tab
            key={s}
            value={s}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {STATUS_META[s].label}
                <Chip
                  label={counts[s] || 0}
                  size="small"
                  sx={{ height: 16, fontSize: 9, '& .MuiChip-label': { px: 0.75 } }}
                />
              </Box>
            }
          />
        ))}
      </Tabs>

      {/* 列表 */}
      {query.isLoading ? (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', py: 4, textAlign: 'center' }}>
          加载中…
        </Typography>
      ) : top.length === 0 ? (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', py: 4, textAlign: 'center' }}>
          {tab ? '该状态下暂无需求' : '还没有发布过需求'}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {top.map((d) => {
            const meta = statusMeta(d.status);
            const gid = ((d as any).groupId as number) || groups[0]?.id || 0;
            return (
              <Box
                key={d.id}
                onClick={() => onOpenDetail && gid && d.id && onOpenDetail(gid, d.id as number)}
                sx={{
                  p: 1.25,
                  borderRadius: 1.25,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (theme) => alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.05 : 0.02),
                  cursor: onOpenDetail ? 'pointer' : 'default',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                  transition: 'border-color .15s',
                  '&:hover': onOpenDetail ? { borderColor: 'warning.main' } : undefined,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', flex: 1, minWidth: 0 }} noWrap>
                    {d.title || '(无标题)'}
                  </Typography>
                  <Chip
                    label={meta.label}
                    size="small"
                    sx={{ height: 18, fontSize: 10, bgcolor: meta.bg, color: meta.color, fontWeight: 600 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {d.pay != null && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <AttachMoneyIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                      <Typography sx={{ fontSize: 10, color: 'warning.main', fontFamily: 'monospace' }}>
                        {d.pay}
                      </Typography>
                    </Box>
                  )}
                  <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                    {timeAgo(d.createTime as any)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
          {filtered.length > 8 && (
            <Typography sx={{ fontSize: 10, color: 'text.disabled', textAlign: 'center', mt: 0.5 }}>
              还有 {filtered.length - 8} 条,点击右上角「管理」查看全部
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}