'use client';

/**
 * 提现审核管理页面
 * 后台管理员查看和审核用户提现申请
 */

import React, { useState } from 'react';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { useAuthority } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/lib/permissions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import type { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { adminClient, formatApiError } from '@/lib/api/client';
import { FEN_PER_DIAMOND } from '@/apis/wallet';

interface WithdrawRequest {
  id: number;
  userId: number;
  amount: number;       // 申请提现的钻石数
  payoutCents?: number; // 应打款金额(分),申请时按 1 钻 = 10 分定下
  status: 'pending' | 'approved' | 'rejected';
  bankInfo: string;
  rejectNote?: string;
  createTime: string;
  updateTime: string;
}

interface WithdrawListResp {
  list: WithdrawRequest[];
  total: number;
  page: number;
}

const formatFen = (fen: number) => ((fen / 100).toFixed(2) + ' 元');
// 打款以 payoutCents 为准;老数据没有这个字段时按 1 钻 = 10 分折算
const payoutOf = (r: WithdrawRequest) => r.payoutCents ?? r.amount * FEN_PER_DIAMOND;

const statusConfig: Record<string, { label: string; color: 'warning' | 'success' | 'error' }> = {
  pending: { label: '待处理', color: 'warning' },
  approved: { label: '已通过', color: 'success' },
  rejected: { label: '已拒绝', color: 'error' },
};

async function fetchWithdrawList(params: { pageNumber: number; pageSize: number; status?: string }): Promise<WithdrawListResp> {
  return adminClient<WithdrawListResp>('/wallet/withdraw/list', {
    params: { page: params.pageNumber, size: params.pageSize, status: params.status || undefined },
  });
}

async function reviewWithdraw(data: { id: number; approved: boolean; rejectNote?: string }) {
  return adminClient('/wallet/withdraw/review', { method: 'POST', data });
}

export default function WithdrawReviewPage() {
  return (
    <PermissionGuard
      need={PERMISSIONS.SYSTEM_WITHDRAW_REVIEW.VIEW}
      fallback={
        <Alert severity="warning" sx={{ m: 2 }}>
          你没有「提现审核」权限。请联系管理员在 /system/role 里授予 system:withdraw-review:view。
        </Alert>
      }
    >
      <WithdrawReviewPageInner />
    </PermissionGuard>
  );
}

function WithdrawReviewPageInner() {
  const { can } = useAuthority();
  const canReview = can(PERMISSIONS.SYSTEM_WITHDRAW_REVIEW.REVIEW);
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [reviewTarget, setReviewTarget] = useState<WithdrawRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);

  const showMsg = (text: string, severity: 'success' | 'error' = 'success') =>
    setMsg({ text, severity });

  const columns: GridColDef[] = [
    { field: 'id', headerName: 'ID', type: 'number', width: 80 },
    { field: 'userId', headerName: '用户ID', type: 'number', width: 110 },
    { field: 'amount', headerName: '申请钻石', type: 'number', width: 110,
      renderCell: (p) => <Box sx={{ fontFamily: 'monospace' }}>💎 {p.value as number}</Box> },
    { field: 'payoutCents', headerName: '应打款', type: 'number', width: 120,
      valueGetter: (_v, row) => payoutOf(row as WithdrawRequest),
      renderCell: (p) => <Box sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatFen(p.value as number)}</Box> },
    { field: 'bankInfo', headerName: '收款信息', flex: 1.5, minWidth: 200,
      renderCell: (p) => <Box sx={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.value || '-'}</Box> },
    { field: 'status', headerName: '状态', width: 100,
      renderCell: (p) => {
        const c = statusConfig[p.value as string] || { label: p.value as string, color: 'warning' as const };
        return <Chip label={c.label} color={c.color} size="small" />;
      } },
    { field: 'createTime', headerName: '申请时间', width: 170,
      valueFormatter: (v) => v ? new Date(v as string).toLocaleString('zh-CN') : '-' },
  ];

  const handleReview = async (approved: boolean) => {
    if (!reviewTarget) return;
    setSubmitting(true);
    try {
      await reviewWithdraw({ id: reviewTarget.id, approved, rejectNote: approved ? undefined : rejectNote });
      showMsg(approved ? '已通过' : '已拒绝', 'success');
      setReviewTarget(null);
      setRejectNote('');
      // 触发 DataGridTable 重拉:它对 filters.values 的引用变化敏感,这里克隆一个新对象。
      setFilterValues({ ...filterValues });
    } catch (e) {
      showMsg(formatApiError(e), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6">提现审核</Typography>
      {msg && <Alert severity={msg.severity} onClose={() => setMsg(null)} sx={{ mb: 1 }}>{msg.text}</Alert>}
      <DataGridTable
        columns={columns}
        fetchData={fetchWithdrawList}
        filters={{
          fields: [
            { key: 'status', label: '状态', type: 'select',
              options: [
                { label: '待处理', value: 'pending' },
                { label: '已通过', value: 'approved' },
                { label: '已拒绝', value: 'rejected' },
              ] },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        customActions={[{
          label: '审核',
          color: 'primary',
          hidden: (row) => !canReview || (row as WithdrawRequest).status !== 'pending',
          onClick: (row) => { setReviewTarget(row as WithdrawRequest); setRejectNote(''); },
        }]}
      />

      {/* 审核对话框:已通过 / 已拒绝 */}
      <Dialog open={!!reviewTarget} onClose={() => setReviewTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>审核提现</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            申请 💎 {reviewTarget?.amount} · 应打款 <strong>{reviewTarget && formatFen(payoutOf(reviewTarget))}</strong> · 用户 #{reviewTarget?.userId}
          </DialogContentText>
          <TextField
            label="拒绝理由"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            placeholder="拒绝时填写,管理员可见"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewTarget(null)} disabled={submitting}>取消</Button>
          <Button onClick={() => handleReview(false)} color="error" disabled={!canReview || submitting || !rejectNote.trim()}>
            拒绝
          </Button>
          <Button onClick={() => handleReview(true)} variant="contained" color="success" disabled={!canReview || submitting}>
            通过
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!msg} autoHideDuration={3000} onClose={() => setMsg(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} />
    </Box>
  );
}