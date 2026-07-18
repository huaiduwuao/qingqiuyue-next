'use client';

/**
 * Worker 池状态
 * 从 account/content/_views/spider/workers/ 迁移
 */

import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { listWorkers, getWorkerStats } from '@/apis/spider';
import type { GridColDef } from '@mui/x-data-grid';
import type { WorkerStats } from '@/beans/spider';

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  idle: 'success',
  busy: 'info',
  offline: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  idle: '空闲',
  busy: '工作中',
  offline: '离线',
};

export default function SpiderWorkersPage() {
  const [stats, setStats] = useState<WorkerStats | null>(null);

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'Worker ID', width: 150 },
    { field: 'name', headerName: '名称', width: 150 },
    {
      field: 'status',
      headerName: '状态',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={STATUS_LABELS[params.value] || params.value}
          color={STATUS_COLORS[params.value] || 'default'}
          size="small"
        />
      ),
    },
    { field: 'currentUrl', headerName: '当前URL', width: 250 },
    { field: 'processedCount', headerName: '已处理数量', width: 120, type: 'number' },
    { field: 'lastActiveTime', headerName: '最后活跃时间', width: 180, valueFormatter: (value) => value ? new Date(value).toLocaleString() : '-' },
  ];

  const statCards = [
    { label: '总Worker数', value: stats?.totalWorkers ?? 0, color: 'primary' },
    { label: '空闲', value: stats?.idleWorkers ?? 0, color: 'success' },
    { label: '工作中', value: stats?.busyWorkers ?? 0, color: 'info' },
    { label: '离线', value: stats?.offlineWorkers ?? 0, color: 'default' },
  ];

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Worker 池状态</Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        {statCards.map((stat) => (
          <Box key={stat.label} sx={{ minWidth: 140 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color={`${stat.color}.main`}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.label}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>利用率</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={stats && stats.totalWorkers > 0 ? (stats.busyWorkers / stats.totalWorkers) * 100 : 0}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
          <Typography variant="body2">
            {stats && stats.totalWorkers > 0 ? `${((stats.busyWorkers / stats.totalWorkers) * 100).toFixed(1)}%` : '0%'}
          </Typography>
        </Box>
      </Paper>

      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          try {
            const res = await listWorkers({ page: params.pageNumber, pageSize: params.pageSize });
            const statsRes = await getWorkerStats();
            setStats(statsRes.data);
            return {
              data: { records: res.list || [], totalRow: res.total || 0 },
              success: true,
            };
          } catch (err: any) {
            return { data: { records: [], totalRow: 0 }, success: false };
          }
        }}
      />
    </Box>
  );
}
