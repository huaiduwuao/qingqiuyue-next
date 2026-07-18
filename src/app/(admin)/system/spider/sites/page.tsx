'use client';

/**
 * 站点调度管理
 * 从 account/content/_views/spider/sites/ 迁移
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { listSiteSlots, getSiteSlotStats, pauseSite, resumeSite } from '@/apis/spider';
import type { SiteSlot, SiteSlotStats } from '@/beans/spider';
import type { GridColDef } from '@mui/x-data-grid';

const LIST_KEY = ['spider', 'sites'];

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  active: 'success',
  scheduling: 'info',
  inactive: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  active: '调度中',
  scheduling: '排队',
  inactive: '暂停',
};

export default function SpiderSitesPage() {
  const qc = useQueryClient();
  const [stats, setStats] = useState<SiteSlotStats | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const showMessage = (message: string, severity: 'success' | 'error') => setSnackbar({ open: true, message, severity });
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  const toggleMutation = useMutation({
    mutationFn: async (row: SiteSlot) => {
      if (row.status === 'inactive') {
        await resumeSite(row.id);
        return '已恢复调度';
      }
      await pauseSite(row.id);
      return '已暂停调度';
    },
    onSuccess: (msg) => { showMessage(msg, 'success'); invalidate(); setRefreshKey((k) => k + 1); },
    onError: (e: any) => showMessage(e?.message || '操作失败', 'error'),
  });

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'siteName', headerName: '站点', flex: 1, minWidth: 140 },
    { field: 'domain', headerName: '域名', flex: 1, minWidth: 160 },
    {
      field: 'status',
      headerName: '状态',
      width: 110,
      renderCell: (p) => <Chip size="small" label={STATUS_LABELS[p.value] || p.value} color={STATUS_COLORS[p.value] || 'default'} />,
    },
    {
      field: 'slots',
      headerName: '槽位',
      width: 160,
      renderCell: (p) => {
        const used = p.row.activeSlots;
        const max = p.row.maxSlots;
        const pct = max > 0 ? (used / max) * 100 : 0;
        return (
          <Box sx={{ width: '100%' }}>
            <Typography variant="caption">{used}/{max}</Typography>
            <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 1 }} />
          </Box>
        );
      },
    },
    {
      field: 'progress',
      headerName: '当前进度',
      width: 140,
      renderCell: (p) => {
        const v = p.value ?? 0;
        return (
          <Box sx={{ width: '100%' }}>
            <Typography variant="caption">{v}%</Typography>
            <LinearProgress variant="determinate" value={v} sx={{ height: 6, borderRadius: 1 }} color="info" />
          </Box>
        );
      },
    },
    { field: 'currentUrl', headerName: '当前 URL', flex: 1.4, minWidth: 200 },
    {
      field: 'actions',
      headerName: '操作',
      width: 90,
      sortable: false,
      filterable: false,
      renderCell: (p) => (
        <Tooltip title={p.row.status === 'inactive' ? '恢复' : '暂停'}>
          <IconButton size="small" onClick={() => toggleMutation.mutate(p.row)}>
            {p.row.status === 'inactive' ? <PlayArrowIcon fontSize="small" /> : <PauseIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>站点调度</Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        {[
          { label: '站点总数', value: stats?.totalSites ?? '—' },
          { label: '活跃站点', value: stats?.activeSites ?? '—' },
          { label: '已用槽位', value: stats?.usedSlots ?? '—' },
          { label: '可用槽位', value: stats?.availableSlots ?? '—' },
        ].map((s) => (
          <Card key={s.label} variant="outlined">
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>{s.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>槽位利用率</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="text.secondary">总槽位使用率</Typography>
            <LinearProgress
              variant="determinate"
              value={stats && stats.totalSlots > 0 ? (stats.usedSlots / stats.totalSlots) * 100 : 0}
              sx={{ height: 10, borderRadius: 1, mt: 0.5 }}
            />
            <Typography variant="caption" color="text.secondary">
              {stats ? `${stats.usedSlots} / ${stats.totalSlots}` : '加载中…'}
            </Typography>
          </Box>
        </Box>
      </Paper>

      <DataGridTable
        key={refreshKey}
        columns={columns}
        fetchData={async () => {
          try {
            const [listRes, statsRes] = await Promise.all([listSiteSlots(), getSiteSlotStats()]);
            setStats(statsRes.data);
            const rows = listRes.list || [];
            return { data: { records: rows, totalRow: rows.length }, success: true };
          } catch (err: any) {
            showMessage(err.message || '获取数据失败', 'error');
            return { data: { records: [], totalRow: 0 }, success: false };
          }
        }}
      />

      <Snackbar open={snackbar.open} autoHideDuration={2500} onClose={() => setSnackbar((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
