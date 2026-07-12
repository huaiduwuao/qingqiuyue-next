'use client';

/**
 * 个人工作台 — 我的实现面板
 *
 * 显式传 userId = currentUser.id 拉取"我提交的所有实现";
 * 4 个状态计数 tab + 最近 8 条;
 * 点击跳到实现管理 tab。
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import HandshakeIcon from '@mui/icons-material/Handshake';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { alpha } from '@mui/material/styles';
import { listRealizations } from '@/apis/reward-realization';
import { listDemands } from '@/apis/reward-demand';
import type { RealizationItem } from '@/beans/reward';
import type { GroupInfo } from '@/apis/reward-group';

interface Props {
  groups: GroupInfo[];
  currentUserId: number;
  onOpenTab?: (groupId: number) => void;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:   { label: '草稿',   color: 'text.secondary', bg: 'rgba(139, 143, 163, 0.12)' },
  WAITING: { label: '待审核', color: 'warning.main',   bg: 'rgba(255, 180, 0, 0.12)' },
  SUCCESS: { label: '已通过', color: 'success.main',   bg: 'rgba(93, 219, 150, 0.12)' },
  FAIL:    { label: '已驳回', color: 'primary.main',   bg: 'rgba(254, 44, 85, 0.12)' },
};

const STATUS_ORDER = ['DRAFT', 'WAITING', 'SUCCESS', 'FAIL'];

function statusMeta(s?: string) {
  return STATUS_META[s || ''] || STATUS_META.DRAFT;
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

export default function PersonalRealizationPanel({ groups, currentUserId, onOpenTab }: Props) {
  const [tab, setTab] = useState<string>('');

  // 显式传 userId = currentUser.id,确保拿的是「我的」实现
  const query = useQuery({
    queryKey: ['personal', 'realizations', 'mine', currentUserId],
    queryFn: () =>
      listRealizations({ userId: currentUserId, pageSize: 200 } as any).then((r: any) => {
        const records = r?.data?.records || r?.data?.list || [];
        return records as RealizationItem[];
      }),
    enabled: !!currentUserId,
    placeholderData: [],
  });

  // 拉需求映射(demandId -> title),用于显示"对哪个需求的实现"
  const demandsQuery = useQuery({
    queryKey: ['personal', 'demands', 'title-map'],
    queryFn: () => listDemands({ pageSize: 200 } as any).then((r: any) => {
      const list = r?.data?.records || r?.data?.list || [];
      const m: Record<number, string> = {};
      list.forEach((d: any) => { if (d.id != null) m[d.id] = d.title || `需求 ${d.id}`; });
      return m;
    }),
    enabled: !!currentUserId,
    placeholderData: {},
    staleTime: 60_000,
  });
  const demandTitleMap = demandsQuery.data || {};

  const records = query.data || [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: records.length };
    STATUS_ORDER.forEach((s) => (c[s] = 0));
    records.forEach((r) => {
      const s = r.status || 'DRAFT';
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [records]);

  const filtered = useMemo(() => {
    if (!tab) return records;
    return records.filter((r) => (r.status || 'DRAFT') === tab);
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
        <HandshakeIcon sx={{ fontSize: 16, color: 'secondary.main', mr: 1 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          我的实现
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

      <Tabs
        value={tab || 'all'}
        onChange={(_, v) => setTab(v === 'all' ? '' : v)}
        variant="scrollable"
        scrollButtons={false}
        sx={{
          minHeight: 32,
          mb: 1,
          '& .MuiTab-root': { minHeight: 32, py: 0.25, px: 1.25, fontSize: 11, textTransform: 'none', minWidth: 0 },
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
                <Chip label={counts[s] || 0} size="small" sx={{ height: 16, fontSize: 9, '& .MuiChip-label': { px: 0.75 } }} />
              </Box>
            }
          />
        ))}
      </Tabs>

      {query.isLoading ? (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', py: 4, textAlign: 'center' }}>
          加载中…
        </Typography>
      ) : top.length === 0 ? (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', py: 4, textAlign: 'center' }}>
          {tab ? '该状态下暂无实现' : '还没有提交过实现'}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {top.map((r) => {
            const meta = statusMeta(r.status);
            const demandTitle = r.demandId ? demandTitleMap[r.demandId] : null;
            return (
              <Box
                key={r.id}
                sx={{
                  p: 1.25,
                  borderRadius: 1.25,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (theme) => alpha(theme.palette.secondary.main, theme.palette.mode === 'dark' ? 0.05 : 0.02),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', flex: 1, minWidth: 0 }} noWrap>
                    {r.title || '(无标题)'}
                  </Typography>
                  <Chip
                    label={meta.label}
                    size="small"
                    sx={{ height: 18, fontSize: 10, bgcolor: meta.bg, color: meta.color, fontWeight: 600 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {demandTitle && (
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }} noWrap>
                      对应需求: {demandTitle}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                    {timeAgo(r.createTime as any)}
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