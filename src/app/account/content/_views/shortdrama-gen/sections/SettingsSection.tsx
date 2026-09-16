'use client';

/**
 * 设置:项目参数 / 出图参数;管理员可维护 gen-api 的 ComfyUI 工作流模板(导入 JSON、改 ckpt、启用)。
 */

import React, { useEffect, useState } from 'react';
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
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useAuthority } from '@/contexts/AuthContext';
import { dramaAPI, genAdminAPI, type GenWorkflowAdmin, type Project } from '@/apis/shortdrama';
import type { SectionProps } from '../Workbench';
import { qk, useCapabilities, useInvalidate, useOverview } from '../useProject';

const KIND_LABEL: Record<string, string> = { t2i: '文生图', i2i: '图生图', t2v: '文生视频', i2v: '图生视频' };

export default function SettingsSection({ projectId }: SectionProps) {
  const ov = useOverview(projectId);
  const invalidate = useInvalidate(projectId);
  const caps = useCapabilities();
  const { isAdmin } = useAuthority();
  const [form, setForm] = useState<Partial<Project>>({});
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ov.data) {
      const p = ov.data.project;
      setForm({ title: p.title, intent: p.intent, genre: p.genre, style: p.style, tone: p.tone, audience: p.audience, episodes: p.episodes, ep_seconds: p.ep_seconds, aspect: p.aspect, width: p.width, height: p.height });
      setSettings({ ...(p.settings ?? {}) });
    }
  }, [ov.data]);

  if (ov.isLoading || !ov.data) return <Skeleton variant="rounded" height={320} />;
  const set = (k: keyof Project, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const setS = (k: string, v: unknown) => setSettings((s) => ({ ...s, [k]: v }));
  const str = (k: string) => (settings[k] == null ? '' : String(settings[k]));
  const bool = (k: string, def: boolean) => (typeof settings[k] === 'boolean' ? (settings[k] as boolean) : def);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await dramaAPI.updateProject(projectId, { ...form, settings } as Partial<Project>);
      invalidate();
      setMsg({ ok: true, text: '已保存' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : '保存失败' });
    } finally {
      setSaving(false);
    }
  };
  const c = caps.data?.capabilities;

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          项目
        </Typography>
        <Stack spacing={1.5}>
          <TextField size="small" label="标题" value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} />
          <TextField size="small" label="故事意图" multiline minRows={2} value={form.intent ?? ''} onChange={(e) => set('intent', e.target.value)} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField size="small" fullWidth label="题材" value={form.genre ?? ''} onChange={(e) => set('genre', e.target.value)} />
            <TextField size="small" fullWidth label="视觉风格" value={form.style ?? ''} onChange={(e) => set('style', e.target.value)} />
            <TextField size="small" fullWidth label="基调" value={form.tone ?? ''} onChange={(e) => set('tone', e.target.value)} />
            <TextField size="small" fullWidth label="受众" value={form.audience ?? ''} onChange={(e) => set('audience', e.target.value)} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField size="small" fullWidth label="集数" type="number" value={form.episodes ?? 3} onChange={(e) => set('episodes', Number(e.target.value) || 1)} />
            <TextField size="small" fullWidth label="每集秒数" type="number" value={form.ep_seconds ?? 60} onChange={(e) => set('ep_seconds', Number(e.target.value) || 60)} />
            <FormControl fullWidth size="small">
              <InputLabel>画幅</InputLabel>
              <Select label="画幅" value={form.aspect ?? '9:16'} onChange={(e) => set('aspect', e.target.value)}>
                <MenuItem value="9:16">竖屏 9:16</MenuItem>
                <MenuItem value="16:9">横屏 16:9</MenuItem>
                <MenuItem value="1:1">方形 1:1</MenuItem>
              </Select>
            </FormControl>
            <TextField size="small" fullWidth label="宽" type="number" value={form.width ?? 768} onChange={(e) => set('width', Number(e.target.value) || 768)} />
            <TextField size="small" fullWidth label="高" type="number" value={form.height ?? 1344} onChange={(e) => set('height', Number(e.target.value) || 1344)} />
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          出图参数
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          风格前缀与负面词由「角色/美术设定」员工首次生成后写入,之后以这里为准;其余为透传给 ComfyUI 工作流的占位参数,留空用模板默认值。
        </Typography>
        <Stack spacing={1.5}>
          <TextField size="small" label="风格前缀(英文,注入每张图)" multiline value={str('style_prefix')} onChange={(e) => setS('style_prefix', e.target.value)} />
          <TextField size="small" label="全局负面词(英文)" multiline value={str('global_negative')} onChange={(e) => setS('global_negative', e.target.value)} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField size="small" fullWidth label="ckpt_name(覆盖模板)" value={str('ckpt_name')} onChange={(e) => setS('ckpt_name', e.target.value)} />
            <TextField size="small" fullWidth label="steps" value={str('steps')} onChange={(e) => setS('steps', e.target.value)} />
            <TextField size="small" fullWidth label="cfg" value={str('cfg')} onChange={(e) => setS('cfg', e.target.value)} />
            <TextField size="small" fullWidth label="图生图 denoise(0-1)" value={str('i2i_denoise')} onChange={(e) => setS('i2i_denoise', e.target.value)} />
          </Stack>
          <FormControlLabel control={<Switch checked={bool('use_reference', true)} onChange={(e) => setS('use_reference', e.target.checked)} />} label="镜头出图时用角色定妆照做图生图参考(需启用 i2i 模板)" />
          <FormControlLabel control={<Switch checked={bool('scene_images', true)} onChange={(e) => setS('scene_images', e.target.checked)} />} label="视觉设定时同时生成场景概念图" />
        </Stack>
      </Paper>

      <Stack sx={{ alignItems: 'center' }} direction="row" spacing={1}>
        <Button variant="contained" disabled={saving} onClick={save}>
          保存
        </Button>
        {msg && (
          <Typography variant="body2" color={msg.ok ? 'success.main' : 'error'}>
            {msg.text}
          </Typography>
        )}
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          生成能力
        </Typography>
        {caps.data?.error && <Alert severity="warning">{caps.data.error}</Alert>}
        <Stack sx={{ flexWrap: 'wrap' }} direction="row" spacing={1} useFlexGap>
          {(['t2i', 'i2i', 't2v', 'i2v'] as const).map((k) => (
            <Chip key={k} label={`${KIND_LABEL[k]}:${c?.[k]?.available ? `${c[k].workflows.join(' / ')}(${c[k].minCost} 钻)` : '未启用'}`} color={c?.[k]?.available ? 'success' : 'default'} variant="outlined" />
          ))}
          <Chip label={`LLM:${caps.data?.llm_ready ? '已配置' : '未配置'}`} color={caps.data?.llm_ready ? 'success' : 'error'} variant="outlined" />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          出图/出片在 gen-api 的 ComfyUI 上执行。模板由管理员维护:导出 ComfyUI 的 API 格式工作流 JSON,把提示词节点的 text 写成占位符 positive_prompt / negative_prompt,参考图节点写 input_image,其余可调参数写 seed / steps / cfg / width / height / denoise / frames / ckpt_name。
        </Typography>
      </Paper>

      {isAdmin && <WorkflowAdmin />}
    </Stack>
  );
}

function WorkflowAdmin() {
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
          ComfyUI 工作流模板(管理员)
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
              {w.costCredits} 钻 · {w.placeholder ? '占位,需导入真实 JSON' : `参数:${w.placeholders.join(' ')}`}
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
