'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import { DataGridTable } from '@/components/tables/DataGridTable';
import { listReports, reviewReport } from '@/apis/system-moderation';
import { useAuthority } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/lib/permissions';
import type { GridColDef } from '@mui/x-data-grid';

const LIST_KEY = ['system', 'moderation', 'reports'];

interface ReportItem {
  id: number;
  reporterId: number;
  targetType: string;
  targetId: number;
  reason: string;
  status: 'pending' | 'resolved' | 'rejected';
  reviewerId?: number;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}

const statusColor: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  pending: 'warning',
  resolved: 'success',
  rejected: 'error',
};

const statusLabel: Record<string, string> = {
  pending: '待审核',
  resolved: '已通过',
  rejected: '已驳回',
};

const columns: GridColDef<ReportItem>[] = [
  { field: 'id', headerName: 'ID', width: 80 },
  { field: 'targetType', headerName: '目标类型', width: 100 },
  { field: 'targetId', headerName: '目标ID', width: 100 },
  { field: 'reason', headerName: '举报原因', width: 260 },
  {
    field: 'status',
    headerName: '状态',
    width: 100,
    renderCell: (params) => (
      <Chip
        label={statusLabel[params.value as string] || params.value}
        color={statusColor[params.value as string] || 'default'}
        size="small"
      />
    ),
  },
  { field: 'reviewNote', headerName: '审核备注', width: 200 },
  {
    field: 'createdAt',
    headerName: '举报时间',
    width: 180,
    valueFormatter: (value) => (value ? new Date(value).toLocaleString() : '-'),
  },
];

export default function ModerationReportsPage() {
  const qc = useQueryClient();
  const { can } = useAuthority();
  const [reviewModal, setReviewModal] = useState<{ open: boolean; record: ReportItem | null }>({
    open: false,
    record: null,
  });
  const [reviewNote, setReviewNote] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string | undefined>>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const canReview = can(PERMISSIONS.SYSTEM_MODERATION.REPORT_REVIEW);

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'resolved' | 'rejected' }) =>
      reviewReport(id, { status, reviewNote }),
    onSuccess: () => {
      showMessage('审核完成');
      setReviewModal({ open: false, record: null });
      setReviewNote('');
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (err: any) => showMessage(err.message || '审核失败', 'error'),
  });

  const handleReview = (status: 'resolved' | 'rejected') => {
    if (!reviewModal.record) return;
    if (status === 'rejected' && !reviewNote.trim()) {
      showMessage('驳回时请填写审核备注', 'error');
      return;
    }
    reviewMutation.mutate({ id: reviewModal.record.id, status });
  };

  const customActions = [
    {
      label: '通过',
      icon: <CheckCircleRoundedIcon fontSize="small" />,
      color: 'success' as const,
      onClick: (row: ReportItem) => {
        setReviewNote('');
        setReviewModal({ open: true, record: row });
      },
      hidden: (row: ReportItem) => row.status !== 'pending' || !canReview,
    },
    {
      label: '驳回',
      icon: <CancelRoundedIcon fontSize="small" />,
      color: 'error' as const,
      onClick: (row: ReportItem) => {
        setReviewNote('');
        setReviewModal({ open: true, record: row });
      },
      hidden: (row: ReportItem) => row.status !== 'pending' || !canReview,
    },
  ];

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <DataGridTable
        title="举报审核"
        columns={columns}
        fetchData={async (params) => {
          const res = await listReports({
            status: params.status,
            page: params.pageNumber,
            pageSize: params.pageSize,
          });
          return {
            data: {
              records: res.data?.records || [],
              totalRow: res.data?.totalRow || 0,
            },
            success: res.status >= 200 && res.status < 300,
          };
        }}
        filters={{
          fields: [
            {
              key: 'status',
              label: '状态',
              type: 'select',
              options: [
                { label: '待审核', value: 'pending' },
                { label: '已通过', value: 'resolved' },
                { label: '已驳回', value: 'rejected' },
              ],
            },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        customActions={customActions}
      />

      <Dialog
        open={reviewModal.open}
        onClose={() => setReviewModal({ open: false, record: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>审核举报 #{reviewModal.record?.id}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box>
              <strong>目标类型:</strong> {reviewModal.record?.targetType}
            </Box>
            <Box>
              <strong>目标ID:</strong> {reviewModal.record?.targetId}
            </Box>
            <Box>
              <strong>举报原因:</strong> {reviewModal.record?.reason}
            </Box>
            <TextField
              label="审核备注"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              fullWidth
              multiline
              rows={3}
              placeholder="请填写审核备注（驳回时必填）"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewModal({ open: false, record: null })}>取消</Button>
          <Button
            color="error"
            variant="outlined"
            onClick={() => handleReview('rejected')}
            disabled={reviewMutation.isPending}
          >
            驳回
          </Button>
          <Button
            color="success"
            variant="contained"
            onClick={() => handleReview('resolved')}
            disabled={reviewMutation.isPending}
          >
            通过
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
