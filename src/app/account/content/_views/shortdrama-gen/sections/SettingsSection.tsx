'use client';

/**
 * 设置(仅管理员可见,见 Workbench):项目参数 / 本项目的出图参数。
 * 全站的风格库和 ComfyUI 工作流模板在 /system/shortdrama。
 */

import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
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
import Link from 'next/link';
import { dramaAPI, type Project } from '@/apis/shortdrama';
import type { SectionProps } from '../Workbench';
import { useCapabilities, useInvalidate, useOverview } from '../useProject';

/** 设置页能改的项目字段(回填表单 / 判断服务端是否真的改了它们) */
function projectForm(p: Project): Partial<Project> {
  return { title: p.title, intent: p.intent, genre: p.genre, style: p.style, tone: p.tone, audience: p.audience, episodes: p.episodes, ep_seconds: p.ep_seconds, aspect: p.aspect, width: p.width, height: p.height };
}

const KIND_LABEL: Record<string, string> = { t2i: '文生图', i2i: '图生图', t2v: '文生视频', i2v: '图生视频' };

export default function SettingsSection({ projectId }: SectionProps) {
  const ov = useOverview(projectId);
  const invalidate = useInvalidate(projectId);
  const caps = useCapabilities();
  const [form, setForm] = useState<Partial<Project>>({});
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // 只在服务端的「这几个可编辑字段」变了时才回填表单。以前跟着整个 ov.data 走:
  // 任务运行中 overview 每 5 秒、每个实体事件都会刷新,正在填的表单隔几秒就被冲回服务端的值。
  const p = ov.data?.project;
  const serverForm = p ? projectForm(p) : null;
  const serverKey = p ? JSON.stringify([serverForm, p.settings ?? {}]) : '';
  const [syncedKey, setSyncedKey] = useState('');
  if (p && serverKey !== syncedKey) {
    setSyncedKey(serverKey);
    setForm(serverForm!);
    setSettings({ ...(p.settings ?? {}) });
  }

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
          {/* 模型/步数/cfg 按种类分开:出图用 SD 类模型,图生视频用 SVD,混用一个 ckpt 会让视频环节直接报错。
              旧的通用 ckpt_name / steps / cfg 只作出图(文生图/图生图)的后备。模型名必须是 ComfyUI 上已安装的。 */}
          {(['t2i', 'i2i', 'i2v'] as const).map((k) => (
            <Stack key={k} direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField size="small" fullWidth label={`${KIND_LABEL[k]} 模型 ckpt_name`} placeholder="留空用模板默认" value={str(`ckpt_name_${k}`)} onChange={(e) => setS(`ckpt_name_${k}`, e.target.value)} />
              <TextField size="small" sx={{ minWidth: 110 }} label={`${KIND_LABEL[k]} steps`} value={str(`steps_${k}`)} onChange={(e) => setS(`steps_${k}`, e.target.value)} />
              <TextField size="small" sx={{ minWidth: 110 }} label={`${KIND_LABEL[k]} cfg`} value={str(`cfg_${k}`)} onChange={(e) => setS(`cfg_${k}`, e.target.value)} />
            </Stack>
          ))}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField size="small" fullWidth label="出图通用 ckpt_name(旧,后备)" value={str('ckpt_name')} onChange={(e) => setS('ckpt_name', e.target.value)} />
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
            <Tooltip key={k} title={c?.[k]?.available ? '' : c?.[k]?.reason || ''}>
              <Chip label={`${KIND_LABEL[k]}:${c?.[k]?.available ? `${c[k].workflows.join(' / ')}(${c[k].minCost} 钻)` : '不可用'}`} color={c?.[k]?.available ? 'success' : 'default'} variant="outlined" />
            </Tooltip>
          ))}
          <Chip label={`LLM:${caps.data?.llm_ready ? '已配置' : '未配置'}`} color={caps.data?.llm_ready ? 'success' : 'error'} variant="outlined" />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          出图/出片在 gen-api 的 ComfyUI 上执行。模板由管理员维护:导出 ComfyUI 的 API 格式工作流 JSON,把提示词节点的 text 写成占位符 positive_prompt / negative_prompt,参考图节点写 input_image,其余可调参数写 seed / steps / cfg / width / height / denoise / frames / ckpt_name。
        </Typography>
      </Paper>

      <Alert severity="info">
        ComfyUI 工作流模板和风格库在管理后台「能力 → <Link href="/system/shortdrama">AI 短剧生成</Link>」维护。这里改的出图参数只影响当前项目。
      </Alert>
    </Stack>
  );
}
