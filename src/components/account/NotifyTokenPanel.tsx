'use client';

// 个人通知令牌:用户自己的脚本 / CI / 定时任务拿它往站内给自己发系统通知(铃铛「系统」页签 + 实时推送)。
// 后端 internal/notifyhook;明文只在生成那一刻返回一次。

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountClient, formatApiError } from '@/lib/api/client';

interface NotifyToken {
  id: number;
  name: string;
  hint: string;
  useCount: number;
  lastUsedAt?: string | null;
  createdAt: string;
}

const SITE_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://qingqiuyue.com';
const QK = ['notify-tokens'];

function fmt(t?: string | null) {
  if (!t) return '从未使用';
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? t : d.toLocaleString('zh-CN', { hour12: false });
}

export default function NotifyTokenPanel({
  onSaved,
}: {
  onSaved: (msg: string, severity?: 'success' | 'error') => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [plain, setPlain] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: QK,
    queryFn: () => accountClient.get<{ list: NotifyToken[]; max: number }>('/notify/tokens'),
  });
  const list = data?.list ?? [];
  const max = data?.max ?? 5;

  const create = useMutation({
    mutationFn: () => accountClient.post<{ token: string }>('/notify/tokens', { name: name.trim() }),
    onSuccess: (r) => {
      setPlain(r.token);
      setName('');
      qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e) => onSaved(formatApiError(e) || '生成失败', 'error'),
  });

  const revoke = useMutation({
    mutationFn: (id: number) => accountClient.post('/notify/tokens/revoke', { id }),
    onSuccess: () => {
      onSaved('令牌已作废');
      qc.invalidateQueries({ queryKey: QK });
    },
    onError: (e) => onSaved(formatApiError(e) || '作废失败', 'error'),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plain);
      onSaved('已复制');
    } catch {
      onSaved('复制失败,请手动选中复制', 'error');
    }
  };

  const example = `curl -X POST ${SITE_ORIGIN}/api/core/notify/hook \\
  -H "X-Notify-Token: <你的令牌>" -H "Content-Type: application/json" \\
  -d '{"title":"任务完成","content":"构建通过"}'`;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>通知令牌</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        给你自己的脚本、CI、定时任务用:带上令牌调用接口,就会在站内给你发一条系统通知。令牌只能给你本人发,
        每个每分钟最多 10 条;最多同时保留 {max} 个。
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="用途(如:Claude 完成提醒)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          slotProps={{ htmlInput: { maxLength: 30 } }}
          sx={{ flex: 1, maxWidth: { sm: 360 } }}
        />
        <Button
          variant="contained"
          disabled={create.isPending || list.length >= max}
          onClick={() => create.mutate()}
        >
          生成令牌
        </Button>
      </Stack>

      {isLoading ? (
        <Typography variant="body2" color="text.secondary">加载中…</Typography>
      ) : list.length === 0 ? (
        <Typography variant="body2" color="text.secondary">还没有令牌。</Typography>
      ) : (
        <Stack spacing={1} sx={{ mb: 2 }}>
          {list.map((t) => (
            <Box
              key={t.id}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, p: 1.5,
                border: 1, borderColor: 'divider', borderRadius: 1, flexWrap: 'wrap',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {t.name} <Box component="span" sx={{ fontFamily: 'monospace', color: 'text.secondary', fontWeight: 400 }}>{t.hint}…</Box>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  创建于 {fmt(t.createdAt)} · 最近使用 {fmt(t.lastUsedAt)} · 共 {t.useCount} 次
                </Typography>
              </Box>
              <Button
                size="small"
                color="error"
                disabled={revoke.isPending}
                onClick={() => {
                  if (window.confirm(`作废「${t.name}」?用它的脚本将无法再发通知。`)) revoke.mutate(t.id);
                }}
              >
                作废
              </Button>
            </Box>
          ))}
        </Stack>
      )}

      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>调用示例</Typography>
      <Box
        component="pre"
        sx={{
          m: 0, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontSize: 12,
          overflowX: 'auto', whiteSpace: 'pre', fontFamily: 'monospace',
        }}
      >
        {example}
      </Box>

      <Dialog open={!!plain} onClose={() => setPlain('')} fullWidth maxWidth="sm">
        <DialogTitle>令牌已生成</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>只显示这一次,关闭后无法再查看。请立刻复制保存。</Alert>
          <TextField
            fullWidth
            value={plain}
            slotProps={{ input: { readOnly: true, sx: { fontFamily: 'monospace', fontSize: 13 } } }}
            onFocus={(e) => e.target.select()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={copy}>复制</Button>
          <Button variant="contained" onClick={() => setPlain('')}>我已保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
