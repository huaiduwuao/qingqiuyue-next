'use client';

/**
 * 退款审批页面
 * 用户申请退款后订单停在 refunding,管理员在这里通过 / 驳回。
 * 后端:qingqiuyue-go/internal/paymentapp/refund.go
 *   通过:充值单扣回钻石(已花掉则失败,只能驳回)、会员单回收一个周期,最后原路退款
 *   驳回:订单回到 paid,备注写入 refundNote
 */

import React, { useState } from 'react';
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
import type { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { formatApiError } from '@/lib/api/client';
import { adminApproveRefund, adminListRefunds, adminRejectRefund, type PaymentOrder } from '@/apis/payment';

const formatFen = (fen: number) => `¥${(fen / 100).toFixed(2)}`;

const statusConfig: Record<string, { label: string; color: 'warning' | 'success' | 'error' | 'default' }> = {
  refunding: { label: '待审批', color: 'warning' },
  refunded: { label: '已退款', color: 'success' },
  abnormal: { label: '异常', color: 'error' },
  paid: { label: '已驳回', color: 'default' },
};

const ORDER_TYPE_LABEL: Record<string, string> = { diamond: '钻石充值', membership: '会员' };

const fetchRefunds = (params: { pageNumber: number; pageSize: number; status?: string }) =>
  adminListRefunds({ page: params.pageNumber, pageSize: params.pageSize, status: params.status });

export default function RefundReviewPage() {
  const [filterValues, setFilterValues] = useState<Record<string, any>>({ status: 'refunding' });
  const [target, setTarget] = useState<PaymentOrder | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);

  const columns: GridColDef[] = [
    { field: 'orderNo', headerName: '订单号', width: 200,
      renderCell: (p) => <Box sx={{ fontFamily: 'monospace', fontSize: 12 }}>{p.value}</Box> },
    { field: 'userId', headerName: '用户ID', type: 'number', width: 100 },
    { field: 'orderType', headerName: '类型', width: 100, valueFormatter: (v) => ORDER_TYPE_LABEL[v as string] || (v as string) },
    { field: 'productName', headerName: '商品', flex: 1, minWidth: 140 },
    { field: 'amountCents', headerName: '金额', type: 'number', width: 100,
      renderCell: (p) => <Box sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatFen(p.value as number)}</Box> },
    { field: 'refundReason', headerName: '退款理由', flex: 1.2, minWidth: 160,
      renderCell: (p) => <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.value || '-'}</Box> },
    { field: 'status', headerName: '状态', width: 90,
      renderCell: (p) => {
        const c = statusConfig[p.value as string] || { label: p.value as string, color: 'default' as const };
        return <Chip label={c.label} color={c.color} size="small" />;
      } },
    { field: 'refundNote', headerName: '审批备注', flex: 1, minWidth: 120,
      renderCell: (p) => <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.value || '-'}</Box> },
    { field: 'updatedAt', headerName: '更新时间', width: 170,
      valueFormatter: (v) => (v ? new Date(v as string).toLocaleString('zh-CN') : '-') },
  ];

  const handleReview = async (approve: boolean) => {
    if (!target) return;
    setSubmitting(true);
    try {
      if (approve) await adminApproveRefund(target.orderNo, note.trim() || undefined);
      else await adminRejectRefund(target.orderNo, note.trim());
      setMsg({ text: approve ? '已退款' : '已驳回', severity: 'success' });
      setTarget(null);
      setNote('');
      // DataGridTable 对 filters.values 的引用变化敏感,克隆一份触发重拉
      setFilterValues({ ...filterValues });
    } catch (e) {
      // 例如「这笔充值的钻石已被消费,不能退款」—— 只能驳回
      setMsg({ text: formatApiError(e), severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6">退款审批</Typography>
      {msg && <Alert severity={msg.severity} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <DataGridTable
        columns={columns}
        fetchData={fetchRefunds}
        filters={{
          fields: [
            { key: 'status', label: '状态', type: 'select',
              options: [
                { label: '待审批', value: 'refunding' },
                { label: '已退款', value: 'refunded' },
                { label: '异常订单', value: 'abnormal' },
              ] },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({ status: 'refunding' }),
        }}
        customActions={[{
          label: '审批',
          color: 'primary',
          hidden: (row) => (row as PaymentOrder).status !== 'refunding',
          onClick: (row) => { setTarget(row as PaymentOrder); setNote(''); },
        }]}
      />

      <Dialog open={!!target} onClose={() => !submitting && setTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>退款审批</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            {ORDER_TYPE_LABEL[target?.orderType ?? ''] || target?.orderType} · {target?.productName} ·{' '}
            <strong>{target && formatFen(target.amountCents)}</strong> · 用户 #{target?.userId}
          </DialogContentText>
          <DialogContentText sx={{ mb: 2, fontSize: 13 }}>
            理由:{target?.refundReason || '(未填写)'}
          </DialogContentText>
          <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
            通过后:充值单从钱包扣回对应钻石(已花掉则失败)、会员单回收一个周期,然后原路退款。
          </Alert>
          <TextField
            label="审批备注"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 500))}
            fullWidth
            multiline
            minRows={2}
            placeholder="驳回时必填,用户可见"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTarget(null)} disabled={submitting}>取消</Button>
          <Button onClick={() => handleReview(false)} color="error" disabled={submitting || !note.trim()}>
            驳回
          </Button>
          <Button onClick={() => handleReview(true)} variant="contained" color="success" disabled={submitting}>
            通过并退款
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
