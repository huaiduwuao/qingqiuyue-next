'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EventIcon from '@mui/icons-material/Event';
import type { DemandItem } from '@/beans/reward';

interface Props {
  open: boolean;
  demand: DemandItem | null;
  readonly?: boolean;
  onClose: () => void;
  onConfirm?: () => void | Promise<void>;
  loading?: boolean;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

function fmtYuan(v?: number | null) {
  return `¥${(v ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * 结账确认 / 结算单,数据来自后端 DemandView.settlement:
 * - 结账前是预估:标价任务按标价付,剩余赏金在未标价任务间均分;
 * - 结账后是钱包里真实到账的流水。
 * 结账从发布时托管的赏金里付款,未分配部分退回发布者,不可撤销。
 */
export function SettlementDialog({ open, demand, readonly, onClose, onConfirm, loading }: Props) {
  if (!demand) return null;
  const settlement = demand.settlement;
  const budget = Number(demand.pay ?? 0);
  const paid = settlement?.totalPay ?? 0;
  const refund = settlement?.refundPay ?? 0;
  const approved = settlement?.approvedCount ?? demand.completedCount ?? 0;
  const unfinished = Math.max(0, (demand.totalTaskCount ?? approved) - approved);
  const distribution = settlement?.distribution ?? [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        {readonly ? <ReceiptLongIcon sx={{ color: 'success.main' }} /> : <CheckCircleIcon sx={{ color: 'success.main' }} />}
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" component="div" sx={{ fontWeight: 600 }}>
            {readonly ? '结算单' : '确认结账'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {demand.title}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 2 }}>
          <Amount label="需求赏金" value={fmtYuan(budget)} color="text.primary" />
          <Amount label={readonly ? '已付给贡献者' : '将付给贡献者'} value={fmtYuan(paid)} color="warning.main" />
          <Amount label={readonly ? '已退回发布者' : '将退回你的钱包'} value={fmtYuan(refund)} color="text.secondary" />
        </Box>

        {!readonly && (
          <Alert severity="info" sx={{ mb: 2 }}>
            赏金从发布时托管的资金中支付,结账后不可撤销。
            {unfinished > 0 && ` 还有 ${unfinished} 个任务未验收通过,结账后这些任务将不能再提交。`}
          </Alert>
        )}

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          分账明细 · {approved} 个任务验收通过
        </Typography>
        {distribution.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {distribution.map((d) => (
              <Box
                key={d.assigneeId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Avatar sx={{ width: 32, height: 32, bgcolor: '#8B5CF6', fontSize: 13 }}>
                  {d.assigneeName?.[0] || '?'}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {d.assigneeName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    完成 {d.taskCount} 个任务
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main' }}>
                  {fmtYuan(d.amount)}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1, border: '1px dashed', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              {readonly ? '没有分账记录' : '还没有验收通过的任务'}
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>时间线</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <TimelineRow label="需求创建" value={fmtDate(demand.createTime as any)} />
          {demand.publishTime && <TimelineRow label="发布并托管" value={fmtDate(demand.publishTime)} />}
          {settlement?.completedAt && <TimelineRow label="最后验收通过" value={fmtDate(settlement.completedAt)} />}
          {settlement?.settledAt && <TimelineRow label="结账时间" value={fmtDate(settlement.settledAt)} highlight />}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {readonly ? '关闭' : '取消'}
        </Button>
        {!readonly && onConfirm && (
          <Button
            variant="contained"
            onClick={onConfirm}
            disabled={loading || distribution.length === 0}
            sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: '#4AC97F' } }}
          >
            {loading ? '结账中…' : '确认结账'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function Amount({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1.3, fontFamily: 'monospace' }}>{value}</Typography>
    </Box>
  );
}

function TimelineRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <EventIcon sx={{ fontSize: 14, color: highlight ? 'success.main' : '#9CA3AF' }} />
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: highlight ? 600 : 400, color: highlight ? 'success.main' : 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  );
}
