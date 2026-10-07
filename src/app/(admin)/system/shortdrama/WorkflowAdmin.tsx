'use client';

/**
 * ComfyUI 工作流模板(gen-api /api/ai/generate/admin/workflows)。短剧出图 / 出片按种类挑最便宜的已启用模板,
 * 模板的「费用(钻)」就是用户每出一张图 / 一段视频被扣的钻石。
 */

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { genAdminAPI, type GenWorkflowAdmin } from '@/apis/shortdrama';
import { qk } from '@/app/account/content/_views/shortdrama-gen/useProject';

export const KIND_LABEL: Record<string, string> = { t2i: '文生图', i2i: '图生图', t2v: '文生视频', i2v: '图生视频' };

export default function WorkflowAdmin() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['gen-admin-workflows'], queryFn: genAdminAPI.list });
  const [editing, setEditing] = useState<Partial<GenWorkflowAdmin> | null>(null);
  const [err, setErr] = useState('');
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['gen-admin-workflows'] });
    qc.invalidateQueries({ queryKey: qk.capabilities });
  };
  const upsert = useMutation({
    mutationFn: (w: Partial<GenWorkflowAdmin>) => (w.id ? genAdminAPI.update(w.id, w) : genAdminAPI.create(w)),
    onSuccess: () => {
      refresh();
      setEditing(null);
      setErr('');
    },
    onError: (e: Error) => setErr(e.message),
  });

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" sx={{ mb: 1, alignItems: 'center' }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          ComfyUI 工作流模板
        </Typography>
        <Button size="small" onClick={() => setEditing({ kind: 't2i', status: 'draft', costCredits: 20 })}>
          新建模板
        </Button>
      </Stack>
      {err && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setErr('')}>
          {err}
        </Alert>
      )}
      {list.isError && <Alert severity="error">{(list.error as Error).message}</Alert>}
      <Stack spacing={1}>
        {(list.data ?? []).map((w) => (
          <Box key={w.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
            <Chip size="small" label={KIND_LABEL[w.kind] ?? w.kind} />
            <Typography variant="body2" sx={{ flex: 1, minWidth: 160, fontWeight: 600 }}>
              {w.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {w.costCredits} 钻 · {w.placeholder ? '占位,需导入真实 JSON' : `参数:${(w.placeholders ?? []).join(' ') || '无'}`}
            </Typography>
            <FormControlLabel
              control={<Switch size="small" checked={w.status === 'active'} disabled={w.placeholder || upsert.isPending} onChange={(e) => upsert.mutate({ id: w.id, status: e.target.checked ? 'active' : 'draft' })} />}
              label={w.status === 'active' ? '已启用' : '未启用'}
            />
            <Button size="small" onClick={() => setEditing(w)}>
              编辑
            </Button>
          </Box>
        ))}
      </Stack>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="md">
        <DialogTitle>{editing?.id ? '编辑模板' : '新建模板'}</DialogTitle>
        <DialogContent>
          {editing && (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField size="small" fullWidth label="名称" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>种类</InputLabel>
                  <Select label="种类" value={editing.kind ?? 't2i'} onChange={(e) => setEditing({ ...editing, kind: e.target.value as GenWorkflowAdmin['kind'] })}>
                    {Object.entries(KIND_LABEL).map(([k, v]) => (
                      <MenuItem key={k} value={k}>
                        {v}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField size="small" label="费用(钻)" type="number" value={editing.costCredits ?? 0} onChange={(e) => setEditing({ ...editing, costCredits: Number(e.target.value) || 0 })} sx={{ width: 120 }} />
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>状态</InputLabel>
                  <Select label="状态" value={editing.status ?? 'draft'} onChange={(e) => setEditing({ ...editing, status: e.target.value as GenWorkflowAdmin['status'] })}>
                    <MenuItem value="draft">未启用</MenuItem>
                    <MenuItem value="active">启用</MenuItem>
                    <MenuItem value="disabled">停用</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <TextField size="small" label="说明" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              <TextField
                size="small"
                label="ComfyUI API 工作流 JSON(顶层可带 _defaults 默认参数)"
                multiline
                minRows={12}
                maxRows={24}
                value={editing.workflowJson ?? ''}
                onChange={(e) => setEditing({ ...editing, workflowJson: e.target.value })}
                slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: 12 } } }}
              />
              <Divider />
              <Typography variant="caption" color="text.secondary">
                启用前后端会校验 JSON 可解析且不是占位模板。checkpoint 文件名以 ComfyUI 的 models/checkpoints 目录为准。
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>取消</Button>
          <Button variant="contained" disabled={upsert.isPending || !editing?.name} onClick={() => editing && upsert.mutate(editing)}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
