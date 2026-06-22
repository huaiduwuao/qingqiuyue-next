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
import LinearProgress from '@mui/material/LinearProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EventIcon from '@mui/icons-material/Event';
import UndoIcon from '@mui/icons-material/Undo';
import type { DemandItem, DemandSettlement } from '@/beans/reward';

interface Props {
  open: boolean;
  demand: DemandItem | null;
  readonly?: boolean;
  onClose: () => void;
  onConfirm?: () => void | Promise<void>;
  onUnsettle?: () => void | Promise<void>;
  loading?: boolean;
}

function fmtDate(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

export function SettlementDialog({ open, demand, readonly, onClose, onConfirm, onUnsettle, loading }: Props) {
  if (!demand) return null;
  const settlement: DemandSettlement | null | undefined = demand.settlement;
  const pay = settlement?.totalPay ?? demand.pay ?? 0;
  const count = settlement?.approvedCount ?? demand.completedCount ?? 0;

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
        {/* 总金额 + 任务数 */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 3, mb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">总酬劳</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'warning.main', lineHeight: 1.1 }}>
              ¥{pay}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">已通过任务</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main', lineHeight: 1.1 }}>
              {count}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>贡献者</Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#8B5CF6', lineHeight: 1.1 }}>
              {settlement?.distribution?.length ?? '-'}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* 贡献者分账明细 */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>分账明细</Typography>
        {settlement?.distribution && settlement.distribution.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {settlement.distribution.map((d) => (
              <Box
                key={d.assigneeId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FAFAFA',
                  border: '1px solid',
                  borderColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB',
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
                    {d.taskCount} 张任务 × (¥{pay} / {count}) = ¥{d.amount}
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'warning.main' }}>
                  ¥{d.amount}
                </Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ p: 2, textAlign: 'center', bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FAFAFA', borderRadius: 1, border: '1px dashed', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              {readonly ? '无分账记录' : '确认结账后将自动按任务数等额分账给所有贡献者'}
            </Typography>
          </Box>
        )}

        {/* 进度条:100% since 全部 APPROVED */}
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">完成度</Typography>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'success.main' }}>
              {count}/{count} (100%)
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={100}
            sx={{ height: 6, borderRadius: 3, bgcolor: 'divider', '& .MuiLinearProgress-bar': { bgcolor: 'success.main', borderRadius: 3 } }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* 时间轴 */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>时间线</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <TimelineRow label="需求创建" value={fmtDate(demand.createTime as any)} />
          {settlement?.completedAt && <TimelineRow label="最后审批通过" value={fmtDate(settlement.completedAt)} />}
          {settlement?.settledAt && <TimelineRow label="结账时间" value={fmtDate(settlement.settledAt)} highlight />}
        </Box>
      </DialogContent>
      <DialogActions>
        {readonly && onUnsettle && (
          <Button
            startIcon={<UndoIcon />}
            onClick={onUnsettle}
            disabled={loading}
            sx={{ color: 'primary.main', mr: 'auto' }}
          >
            反结账
          </Button>
        )}
        <Button onClick={onClose} disabled={loading}>
          {readonly ? '关闭' : '取消'}
        </Button>
        {!readonly && onConfirm && (
          <Button
            variant="contained"
            onClick={onConfirm}
            disabled={loading}
            sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: '#4AC97F' } }}
          >
            {loading ? '结账中…' : '确认结账'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
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
