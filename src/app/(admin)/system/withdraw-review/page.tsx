'use client';

/**
 * 提现审核管理页面
 * 后台管理员查看和审核用户提现申请
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Pagination from '@mui/material/Pagination';
import Alert from '@mui/material/Alert';
import { accountClient } from '@/lib/api/client';

// 提现申请类型
interface WithdrawRequest {
  id: number;
  userId: number;
  amount: number; // 分
  status: 'pending' | 'approved' | 'rejected';
  bankInfo: string;
  rejectNote?: string;
  createTime: string;
  updateTime: string;
}

// 获取提现列表
async function fetchWithdrawList(params: { page?: number; size?: number; status?: string }) {
  const resp = await accountClient('/wallet/withdraw/list', { params });
  return resp?.data ?? resp ?? { list: [], total: 0 };
}

// 审核提现
async function reviewWithdraw(data: { id: number; approved: boolean; rejectNote?: string }) {
  return accountClient('/wallet/withdraw/review', { method: 'POST', data });
}

// 金额格式化(分 -> 元)
function formatAmount(fen: number): string {
  return (fen / 100).toFixed(2) + ' 元';
}

// 状态标签
function StatusChip({ status }: { status: string }) {
  const config: Record<string, { label: string; color: 'warning' | 'success' | 'error' }> = {
    pending: { label: '待处理', color: 'warning' },
    approved: { label: '已通过', color: 'success' },
    rejected: { label: '已拒绝', color: 'error' },
  };
  const c = config[status] || { label: status, color: 'warning' as const };
  return <Chip label={c.label} color={c.color} size="small" />;
}

export default function WithdrawReviewPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewTarget, setReviewTarget] = useState<WithdrawRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const size = 20;

  const { data, isLoading, error } = useQuery({
    queryKey: ['withdraw-list', page, statusFilter],
    queryFn: () => fetchWithdrawList({ page, size, status: statusFilter }),
  });

  const reviewMutation = useMutation({
    mutationFn: reviewWithdraw,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdraw-list'] });
      setReviewTarget(null);
      setRejectNote('');
    },
  });

  const list: WithdrawRequest[] = data?.list ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / size);

  const handleReview = (approved: boolean) => {
    if (!reviewTarget) return;
    reviewMutation.mutate({
      id: reviewTarget.id,
      approved,
      rejectNote: approved ? undefined : rejectNote,
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">提现审核</Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>状态筛选</InputLabel>
          <Select
            value={statusFilter}
            label="状态筛选"
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="pending">待处理</MenuItem>
            <MenuItem value="approved">已通过</MenuItem>
            <MenuItem value="rejected">已拒绝</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error">加载失败</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>用户ID</TableCell>
              <TableCell>申请金额</TableCell>
              <TableCell>收款信息</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>申请时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center' }}>加载中...</TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center' }}>暂无数据</TableCell>
              </TableRow>
            ) : (
              list.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.userId}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {formatAmount(item.amount)}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.bankInfo || '-'}
                  </TableCell>
                  <TableCell><StatusChip status={item.status} /></TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {new Date(item.createTime).toLocaleString('zh-CN')}
                  </TableCell>
                  <TableCell>
                    {item.status === 'pending' && (
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        onClick={() => setReviewTarget(item)}
                      >
                        审核
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

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

      {/* 审核弹窗 */}
      <Dialog open={!!reviewTarget} onClose={() => setReviewTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>审核提现申请</DialogTitle>
        <DialogContent>
          {reviewTarget && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <DialogContentText>
                用户 <strong>{reviewTarget.userId}</strong> 申请提现{' '}
                <strong style={{ color: '#FE2C55' }}>{formatAmount(reviewTarget.amount)}</strong>
              </DialogContentText>
              <DialogContentText>
                收款信息: {reviewTarget.bankInfo || '未填写'}
              </DialogContentText>
              <TextField
                label="拒绝原因"
                multiline
                rows={2}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="请输入拒绝原因(仅拒绝时填写)"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewTarget(null)}>取消</Button>
          <Button
            onClick={() => handleReview(false)}
            color="error"
            variant="contained"
            disabled={reviewMutation.isPending}
          >
            拒绝
          </Button>
          <Button
            onClick={() => handleReview(true)}
            color="success"
            variant="contained"
            disabled={reviewMutation.isPending}
          >
            通过
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
