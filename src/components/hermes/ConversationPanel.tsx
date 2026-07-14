'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { DataGridTable } from '@/components/tables/DataGridTable';
import {
  hermesApi,
  HermesConversationAdminItem,
  HermesConversationMessage,
} from '@/apis/hermes';
import type { GridColDef } from '@mui/x-data-grid';
import ChatIcon from '@mui/icons-material/Chat';

const roleLabel: Record<string, { text: string; color: 'primary' | 'secondary' }> = {
  user: { text: '用户', color: 'primary' },
  assistant: { text: '助手', color: 'secondary' },
  system: { text: '系统', color: 'default' as any },
  tool: { text: '工具', color: 'default' as any },
};

const conversationColumns: GridColDef<HermesConversationAdminItem>[] = [
  {
    field: 'id',
    headerName: '会话ID',
    width: 280,
    renderCell: (p) => (
      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
        {(p.value as string).substring(0, 8)}...
      </Typography>
    ),
  },
  { field: 'userId', headerName: '用户ID', width: 100 },
  { field: 'agentId', headerName: 'Agent', width: 130 },
  { field: 'title', headerName: '标题', flex: 1, minWidth: 150 },
  {
    field: 'lastMessageAt',
    headerName: '最后消息',
    width: 170,
    valueFormatter: (value) => (value ? new Date(value as string).toLocaleString() : '-'),
  },
  {
    field: 'createdAt',
    headerName: '创建时间',
    width: 170,
    valueFormatter: (value) => (value ? new Date(value as string).toLocaleString() : '-'),
  },
];

export default function ConversationPanel() {
  const qc = useQueryClient();
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // 会话详情 Dialog 状态
  const [detailDialog, setDetailDialog] = useState<{
    open: boolean;
    conversationId: string;
    title: string;
  }>({ open: false, conversationId: '', title: '' });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hermesApi.conversationAdminDelete(id),
    onSuccess: () => {
      showMessage('删除成功');
      qc.invalidateQueries({ queryKey: ['system', 'hermes', 'conversation'] });
    },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  // 消息查询
  const messagesQuery = useQuery({
    queryKey: ['system', 'hermes', 'conversation', detailDialog.conversationId, 'messages'],
    queryFn: () => hermesApi.conversationAdminMessages(detailDialog.conversationId),
    enabled: detailDialog.open && detailDialog.conversationId !== '',
  });

  const handleViewMessages = (row: HermesConversationAdminItem) => {
    setDetailDialog({ open: true, conversationId: row.id, title: row.title || '未命名会话' });
  };

  const handleDelete = (row: HermesConversationAdminItem) => {
    if (!confirm(`确定删除该会话 (ID: ${row.id})?`)) return;
    deleteMutation.mutate(row.id);
  };

  return (
    <Box>
      <DataGridTable
        title="会话管理"
        columns={conversationColumns}
        fetchData={async (params) => {
          const res = await hermesApi.conversationAdminPage({
            page: params.pageNumber,
            pageSize: params.pageSize,
            ...filterValues,
          });
          return {
            data: {
              records: res.data?.records || [],
              totalRow: res.data?.totalRow || 0,
            },
            success: res.success ?? true,
          };
        }}
        onDelete={handleDelete}
        filters={{
          fields: [
            { key: 'userId', label: '用户ID', type: 'text' },
            { key: 'agentId', label: 'Agent', type: 'text' },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
        customActions={[
          {
            label: '查看消息',
            icon: <ChatIcon fontSize="small" />,
            onClick: handleViewMessages,
          },
        ]}
      />

      {/* 会话详情 Dialog */}
      <Dialog
        open={detailDialog.open}
        onClose={() => setDetailDialog((d) => ({ ...d, open: false }))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          会话详情: {detailDialog.title}
        </DialogTitle>
        <DialogContent dividers>
          {messagesQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : messagesQuery.data?.messages && messagesQuery.data.messages.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 1 }}>
              {messagesQuery.data.messages.map((msg: HermesConversationMessage) => {
                const role = roleLabel[msg.role] || { text: msg.role, color: 'default' as any };
                return (
                  <Paper
                    key={msg.id}
                    sx={{
                      p: 2,
                      bgcolor: msg.role === 'user' ? 'primary.50' : 'background.paper',
                      borderLeft: msg.role === 'user' ? '3px solid' : '3px solid transparent',
                      borderColor: msg.role === 'user' ? 'primary.main' : 'divider',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Chip label={role.text} size="small" color={role.color} variant="outlined" />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(msg.createTime).toLocaleString()}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {msg.content}
                    </Typography>
                    {msg.emotion && (
                      <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {Object.entries(msg.emotion).map(([k, v]) => (
                          <Chip key={k} label={`${k}: ${typeof v === 'number' ? v.toFixed(2) : v}`} size="small" />
                        ))}
                      </Box>
                    )}
                    {msg.action && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        动作: {msg.action}
                      </Typography>
                    )}
                  </Paper>
                );
              })}
            </Box>
          ) : (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              暂无消息
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog((d) => ({ ...d, open: false }))}>
            关闭
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
