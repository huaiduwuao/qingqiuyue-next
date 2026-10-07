'use client';

/**
 * 短剧风格库:用户建项目时看到的画风卡片。名称 / 说明 / 示例图给用户看;
 * 风格前缀、负面词和出图参数(按种类的 ckpt_name / steps / cfg)只在这里出现,
 * 建项目时由后端拷进项目 settings(之后改风格不影响已建的项目)。
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
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { styleAdminAPI, type DramaStyleAdmin } from '@/apis/shortdrama';
import { coverBackgroundImage } from '@/lib/media';
import { KIND_LABEL } from './WorkflowAdmin';

const QK = ['drama', 'admin-styles'] as const;
const PARAM_KINDS = ['t2i', 'i2i', 'i2v'] as const;

export default function StyleAdmin() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: QK, queryFn: styleAdminAPI.list });
  const [editing, setEditing] = useState<Partial<DramaStyleAdmin> | null>(null);
  const [err, setErr] = useState('');
  const done = () => {
    qc.invalidateQueries({ queryKey: QK });
    qc.invalidateQueries({ queryKey: ['drama', 'styles'] });
  };
  const save = useMutation({
    mutationFn: (s: Partial<DramaStyleAdmin>) => styleAdminAPI.save(s),
    onSuccess: () => {
      done();
      setEditing(null);
      setErr('');
    },
    onError: (e: Error) => setErr(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: number) => styleAdminAPI.remove(id),
    onSuccess: () => {
      done();
      setEditing(null);
    },
    onError: (e: Error) => setErr(e.message),
  });

  const sv = (k: string) => (editing?.settings?.[k] == null ? '' : String(editing.settings[k]));
  const setSv = (k: string, v: string) =>
    setEditing((e) => {
      const settings = { ...(e?.settings ?? {}) };
      if (v.trim() === '') delete settings[k];
      else settings[k] = v.trim();
      return { ...e, settings };
    });

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" sx={{ mb: 1, alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">风格库</Typography>
          <Typography variant="caption" color="text.secondary">
            用户建短剧时按卡片挑画风。提示词和模型参数只在这里可见,建项目时拷进项目。
          </Typography>
        </Box>
        <Button size="small" variant="contained" onClick={() => setEditing({ status: 'active', settings: {}, sort_order: ((list.data?.length ?? 0) + 1) * 10 })}>
          新建风格
        </Button>
      </Stack>
      {err && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setErr('')}>
          {err}
        </Alert>
      )}
      {list.isError && <Alert severity="error">{(list.error as Error).message}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5, mt: 1 }}>
        {(list.data ?? []).map((s) => (
          <Box
            key={s.id}
            onClick={() => setEditing({ ...s, settings: { ...(s.settings ?? {}) } })}
            sx={{ cursor: 'pointer', borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider', opacity: s.status === 'active' ? 1 : 0.5 }}
          >
            <Box sx={{ aspectRatio: '3 / 4', bgcolor: 'action.hover', backgroundImage: coverBackgroundImage(s.cover_url), backgroundSize: 'cover', backgroundPosition: 'center' }} />
            <Box sx={{ p: 1 }}>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }} noWrap>
                  {s.name}
                </Typography>
                {s.status !== 'active' && <Chip size="small" label="已下架" />}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {s.description || '—'}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="md">
        <DialogTitle>{editing?.id ? `编辑风格:${editing.name}` : '新建风格'}</DialogTitle>
        <DialogContent>
          {editing && (
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField size="small" fullWidth label="名称(用户看到的)" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <TextField size="small" label="排序" type="number" sx={{ width: 110 }} value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })} />
                <FormControlLabel
                  control={<Switch checked={editing.status !== 'disabled'} onChange={(e) => setEditing({ ...editing, status: e.target.checked ? 'active' : 'disabled' })} />}
                  label={editing.status !== 'disabled' ? '上架' : '下架'}
                />
              </Stack>
              <TextField size="small" label="一句话说明(用户看到的)" placeholder="例:真人质感,电影级光影,适合都市、悬疑" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <TextField size="small" fullWidth label="示例图 URL" value={editing.cover_url ?? ''} onChange={(e) => setEditing({ ...editing, cover_url: e.target.value })} helperText="建议 3:4 竖图;可先用这个风格出一张图,把地址贴过来" />
                <Box sx={{ width: 60, flexShrink: 0, aspectRatio: '3 / 4', borderRadius: 1, bgcolor: 'action.hover', backgroundImage: coverBackgroundImage(editing.cover_url), backgroundSize: 'cover' }} />
              </Stack>
              <TextField
                size="small"
                label="风格前缀(英文,拼在每张图提示词最前面)"
                multiline
                minRows={2}
                value={editing.prompt ?? ''}
                onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
              />
              <TextField size="small" label="负面词(英文)" multiline value={editing.negative ?? ''} onChange={(e) => setEditing({ ...editing, negative: e.target.value })} />
              <Typography variant="subtitle2" sx={{ pt: 1 }}>
                出图参数(留空 = 用工作流模板的默认值;模型名必须是 ComfyUI 上已安装的)
              </Typography>
              {PARAM_KINDS.map((k) => (
                <Stack key={k} direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <TextField size="small" fullWidth label={`${KIND_LABEL[k]} 模型 ckpt_name`} value={sv(`ckpt_name_${k}`)} onChange={(e) => setSv(`ckpt_name_${k}`, e.target.value)} />
                  <TextField size="small" sx={{ minWidth: 110 }} label="steps" value={sv(`steps_${k}`)} onChange={(e) => setSv(`steps_${k}`, e.target.value)} />
                  <TextField size="small" sx={{ minWidth: 110 }} label="cfg" value={sv(`cfg_${k}`)} onChange={(e) => setSv(`cfg_${k}`, e.target.value)} />
                </Stack>
              ))}
              <TextField size="small" sx={{ maxWidth: 240 }} label="图生图 denoise(0-1)" value={sv('i2i_denoise')} onChange={(e) => setSv('i2i_denoise', e.target.value)} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {editing?.id ? (
            <Button color="error" disabled={remove.isPending} onClick={() => editing.id && window.confirm(`删除风格「${editing.name}」?已建的项目不受影响。`) && remove.mutate(editing.id)} sx={{ mr: 'auto' }}>
              删除
            </Button>
          ) : null}
          <Button onClick={() => setEditing(null)}>取消</Button>
          <Button variant="contained" disabled={save.isPending || !editing?.name?.trim()} onClick={() => editing && save.mutate(editing)}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
