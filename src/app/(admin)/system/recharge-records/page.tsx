'use client';

/**
 * 充值记录管理页面
 * 后台管理员查看用户充值记录
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Pagination from '@mui/material/Pagination';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import { getRechargeRecords, formatMoney, statusLabels, channelLabels, type RechargeRecord } from '@/apis/admin-recharge';

// 状态 Chip 组件
function StatusChip({ status }: { status: string }) {
  const config = statusLabels[status];
  if (!config) return <Chip label={status} size="small" />;
  return <Chip label={config.label} color={config.color as any} size="small" />;
}

// 渠道 Chip 组件
function ChannelChip({ channel }: { channel: string }) {
  const config = channelLabels[channel];
  if (!config) return <Chip label={channel} size="small" variant="outlined" />;
  return <Chip label={config.label} color={config.color as any} size="small" variant="outlined" />;
}

// 来源 Chip 组件
function SourceChip({ source }: { source: string }) {
  const config = {
    wallet: { label: '钱包充值', color: 'primary' as const },
    payment: { label: '支付订单', color: 'secondary' as const },
  };
  const c = config[source as keyof typeof config];
  return <Chip label={c?.label || source} color={c?.color} size="small" variant="outlined" />;
}

// 格式化日期
function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RechargeRecordsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const pageSize = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['recharge-records', page, statusFilter, channelFilter, userIdFilter, startDateFilter, endDateFilter],
    queryFn: () => getRechargeRecords({
      page,
      pageSize,
      status: statusFilter || undefined,
      channel: channelFilter || undefined,
      userId: userIdFilter || undefined,
      startDate: startDateFilter || undefined,
      endDate: endDateFilter || undefined,
    }),
  });

  const list: RechargeRecord[] = data?.list ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // 统计今日收入
  const todayRevenue = list
    .filter(r => r.status === 'paid')
    .reduce((sum, r) => sum + r.amount, 0);

  const handleFilterChange = () => {
    setPage(1);
  };

  const handleReset = () => {
    setStatusFilter('');
    setChannelFilter('');
    setUserIdFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setPage(1);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 标题和统计 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">充值记录</Typography>
        <Typography variant="body2" color="text.secondary">
          当前页合计: <strong style={{ color: '#FE2C55' }}>¥{formatMoney(todayRevenue)}</strong>
        </Typography>
      </Box>

      {/* 筛选栏 */}
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>状态</InputLabel>
            <Select
              value={statusFilter}
              label="状态"
              onChange={(e) => { setStatusFilter(e.target.value); handleFilterChange(); }}
            >
              <MenuItem value="">全部</MenuItem>
              <MenuItem value="paid">已支付</MenuItem>
              <MenuItem value="pending">待支付</MenuItem>
              <MenuItem value="failed">失败</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>渠道</InputLabel>
            <Select
              value={channelFilter}
              label="渠道"
              onChange={(e) => { setChannelFilter(e.target.value); handleFilterChange(); }}
            >
              <MenuItem value="">全部</MenuItem>
              <MenuItem value="wechat">微信</MenuItem>
              <MenuItem value="alipay">支付宝</MenuItem>
              <MenuItem value="mock">模拟</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="用户ID"
            value={userIdFilter}
            onChange={(e) => { setUserIdFilter(e.target.value); }}
            onBlur={handleFilterChange}
            sx={{ minWidth: 120 }}
          />

          <TextField
            size="small"
            type="date"
            label="开始日期"
            value={startDateFilter}
            onChange={(e) => { setStartDateFilter(e.target.value); }}
            onBlur={handleFilterChange}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          />

          <TextField
            size="small"
            type="date"
            label="结束日期"
            value={endDateFilter}
            onChange={(e) => { setEndDateFilter(e.target.value); }}
            onBlur={handleFilterChange}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              共 {total} 条记录
            </Typography>
            {(statusFilter || channelFilter || userIdFilter || startDateFilter || endDateFilter) && (
              <Chip
                label="重置"
                size="small"
                onClick={handleReset}
                onDelete={handleReset}
                sx={{ cursor: 'pointer' }}
              />
            )}
          </Box>
        </Stack>
      </Paper>

      {error && <Alert severity="error">加载失败</Alert>}

      {/* 表格 */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>订单号</TableCell>
              <TableCell>用户</TableCell>
              <TableCell align="right">金额</TableCell>
              <TableCell align="right">钻石</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>渠道</TableCell>
              <TableCell>来源</TableCell>
              <TableCell>创建时间</TableCell>
              <TableCell>支付时间</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} sx={{ textAlign: 'center' }}>加载中...</TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} sx={{ textAlign: 'center' }}>暂无数据</TableCell>
              </TableRow>
            ) : (
              list.map((item) => (
                <TableRow key={`${item.source}-${item.id}`} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {item.orderNo}
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2">{item.userNickname || '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">ID: {item.userId}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#FE2C55' }}>
                    ¥{formatMoney(item.amount)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace' }}>
                    {item.diamondAmount > 0 ? item.diamondAmount : '-'}
                  </TableCell>
                  <TableCell><StatusChip status={item.status} /></TableCell>
                  <TableCell><ChannelChip channel={item.channel} /></TableCell>
                  <TableCell><SourceChip source={item.source} /></TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {formatDate(item.createdAt)}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {formatDate(item.paidAt || '')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 分页 */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
}
