'use client';

/**
 * 充值记录管理页面
 * 后台管理员查看用户充值记录
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import type { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { getRechargeRecords, formatMoney, statusLabels, channelLabels, type RechargeRecord } from '@/apis/admin-recharge';

function StatusChip({ status }: { status: string }) {
  const config = statusLabels[status];
  if (!config) return <Chip label={status} size="small" />;
  return <Chip label={config.label} color={config.color as any} size="small" />;
}

function ChannelChip({ channel }: { channel: string }) {
  const config = channelLabels[channel];
  if (!config) return <Chip label={channel} size="small" variant="outlined" />;
  return <Chip label={config.label} color={config.color as any} size="small" variant="outlined" />;
}

function SourceChip({ source }: { source: string }) {
  const config: Record<string, { label: string; color: 'primary' | 'secondary' }> = {
    wallet: { label: '钱包充值', color: 'primary' },
    payment: { label: '支付订单', color: 'secondary' },
  };
  const c = config[source as keyof typeof config];
  return <Chip label={c?.label || source} color={c?.color} size="small" variant="outlined" />;
}

const columns: GridColDef[] = [
  { field: 'orderNo', headerName: '订单号', width: 200,
    renderCell: (p) => <Box sx={{ fontFamily: 'monospace', fontSize: 12 }}>{p.value}</Box> },
  { field: 'user', headerName: '用户', flex: 1.2, minWidth: 160, sortable: false,
    renderCell: (p) => {
      const r = p.row as RechargeRecord;
      return (
        <Box>
          <Typography variant="body2">{r.userNickname || '-'}</Typography>
          <Typography variant="caption" color="text.secondary">ID: {r.userId}</Typography>
        </Box>
      );
    } },
  { field: 'amount', headerName: '金额', type: 'number', width: 110, align: 'right', headerAlign: 'right',
    renderCell: (p) => <Box sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#FE2C55' }}>¥{formatMoney(p.value as number)}</Box> },
  { field: 'diamondAmount', headerName: '钻石', type: 'number', width: 80, align: 'right', headerAlign: 'right',
    renderCell: (p) => (p.value > 0 ? p.value : '-') },
  { field: 'status', headerName: '状态', width: 90, renderCell: (p) => <StatusChip status={p.value as string} /> },
  { field: 'channel', headerName: '渠道', width: 90, renderCell: (p) => <ChannelChip channel={p.value as string} /> },
  { field: 'source', headerName: '来源', width: 100, renderCell: (p) => <SourceChip source={p.value as string} /> },
  { field: 'createdAt', headerName: '创建时间', width: 170,
    valueFormatter: (v) => v ? new Date(v as string).toLocaleString('zh-CN') : '-' },
  { field: 'paidAt', headerName: '支付时间', width: 170,
    valueFormatter: (v) => v ? new Date(v as string).toLocaleString('zh-CN') : '-' },
];

export default function RechargeRecordsPage() {
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6">充值记录</Typography>
      <DataGridTable
        columns={columns}
        fetchData={getRechargeRecords}
        // 筛选字段直接对应后端 query: status / channel / userId / startDate / endDate
        filters={{
          fields: [
            { key: 'status', label: '状态', type: 'select',
              options: [
                { label: '已支付', value: 'paid' },
                { label: '待支付', value: 'pending' },
                { label: '失败', value: 'failed' },
              ] },
            { key: 'channel', label: '渠道', type: 'select',
              options: [
                { label: '微信', value: 'wechat' },
                { label: '支付宝', value: 'alipay' },
                { label: '模拟', value: 'mock' },
              ] },
            { key: 'userId', label: '用户ID', type: 'text' },
            { key: 'startDate', label: '开始日期(YYYY-MM-DD)', type: 'text' },
            { key: 'endDate', label: '结束日期(YYYY-MM-DD)', type: 'text' },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
      />
    </Box>
  );
}