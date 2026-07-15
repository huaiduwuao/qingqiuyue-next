'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import type { HermesAgentItem } from '@/beans/system';
import { hermesApi, type HermesInstanceItem } from '@/apis/hermes';

// 类型定义
interface HermesFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
  record: HermesAgentItem | null;
  isSubmitting?: boolean;
}

type HermesFormValues = {
  agentId: string;
  name: string;
  role: string;
  avatarUrl: string;
  description: string;
  systemPrompt: string;
  greeting: string;
  status: string;
  published: boolean;
  sortOrder: number;
  instanceId: number;
};

type InstancePageResp = {
  list?: HermesInstanceItem[];
  data?: { records?: HermesInstanceItem[] };
};

const STATUS_OPTIONS = ['active', 'paused', 'draft'];
const UNASSIGNED = 0;

// 纯函数:从 record 计算初始表单值
function buildInitialValues(record: HermesAgentItem | null): HermesFormValues {
  if (record) {
    return {
      agentId: record.agentId || '',
      name: record.name || '',
      role: record.role || '',
      avatarUrl: record.avatarUrl || '',
      description: record.description || '',
      systemPrompt: record.systemPrompt || '',
      greeting: record.greeting || '',
      status: record.status || 'active',
      published: !!record.published,
      sortOrder: record.sortOrder ?? 0,
      instanceId: record.instanceId ?? UNASSIGNED,
    };
  }
  return {
    agentId: '',
    name: '',
    role: '',
    avatarUrl: '',
    description: '',
    systemPrompt: '',
    greeting: '',
    status: 'active',
    published: false,
    sortOrder: 0,
    instanceId: UNASSIGNED,
  };
}

// 纯函数:从 record 计算初始 tagsRaw
function buildInitialTagsRaw(record: HermesAgentItem | null): string {
  if (!record) return '';
  const recordTags = record.tags as string[] | string;
  const tags = Array.isArray(recordTags)
    ? recordTags
    : typeof recordTags === 'string'
    ? recordTags.split(',').filter(Boolean)
    : [];
  return tags.join(', ');
}

export default function HermesFormDialog({ open, onClose, onSubmit, record, isSubmitting }: HermesFormDialogProps) {
  const isEdit = !!record?.id;

  // 初始化标记:每次 dialog open 或 record 变化时触发一次初始化
  const initKeyRef = useRef(`init-${open}-${isEdit ? (record?.id ?? 'new') : 'new'}`);
  const [values, setValues] = useState<HermesFormValues>(() => buildInitialValues(record));
  const [tagsRaw, setTagsRaw] = useState<string>(() => buildInitialTagsRaw(record));
  const [error, setError] = useState('');

  // 拉取实例列表(供下拉框),只取前 100 条
  const instancesQuery = useQuery<InstancePageResp>({
    queryKey: ['system', 'hermes', 'instances', 'for-select'],
    queryFn: () => hermesApi.instancePage({ pageSize: 100, pageNumber: 1, current: 1 }) as Promise<InstancePageResp>,
    enabled: open,
    staleTime: 30_000,
  });
  const instances = instancesQuery.data?.list || instancesQuery.data?.data?.records || [];
  const instancesLoaded = !instancesQuery.isLoading;

  // 初始化:仅在 open/record 变化导致 initKeyRef 变化时同步 state
  // 用 ref 比较而非 setState 避免级联渲染
  useEffect(() => {
    const newKey = `init-${open}-${isEdit ? (record?.id ?? 'new') : 'new'}`;
    if (newKey === initKeyRef.current) return;
    initKeyRef.current = newKey;
    setValues(buildInitialValues(record));
    setTagsRaw(buildInitialTagsRaw(record));
    setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record?.id, isEdit]);

  const set = (k: keyof HermesFormValues, v: string | number | boolean) => setValues((s) => ({ ...s, [k]: v }));

  const handleSubmit = () => {
    if (!values.agentId || !String(values.agentId).trim()) {
      setError('agentId 不能为空');
      return;
    }
    if (!values.name || !String(values.name).trim()) {
      setError('名称不能为空');
      return;
    }
    setError('');

    const tags = tagsRaw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const instanceId = Number(values.instanceId);
    const payload = {
      agentId: String(values.agentId).trim(),
      name: String(values.name).trim(),
      role: values.role || '',
      tags,
      avatarUrl: values.avatarUrl || '',
      description: values.description || '',
      systemPrompt: values.systemPrompt || '',
      greeting: values.greeting || '',
      sortOrder: Number(values.sortOrder) || 0,
      // 0 表示未分配 — 后端可以接收 0 或忽略
      instanceId: Number.isFinite(instanceId) ? instanceId : UNASSIGNED,
      ...(isEdit ? { status: values.status || 'active', published: !!values.published } : {}),
    };
    onSubmit(payload);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? `编辑 Hermes #${record?.id}` : '新建 Hermes 智能体'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="agentId(容器内 id)"
            value={values.agentId || ''}
            onChange={(e) => set('agentId', e.target.value)}
            disabled={isEdit}
            helperText={isEdit ? 'agentId 不可修改' : '容器内 agent id,如 frontend-dev'}
            fullWidth
            required
          />
          <TextField
            label="显示名"
            value={values.name || ''}
            onChange={(e) => set('name', e.target.value)}
            fullWidth
            required
          />

          <TextField
            select
            label="所属实例"
            value={values.instanceId ?? UNASSIGNED}
            onChange={(e) => set('instanceId', Number(e.target.value))}
            fullWidth
            helperText="选择此 agent 所属的 hermes 容器实例,新建时默认「未分配」"
          >
            <MenuItem value={UNASSIGNED}>未分配</MenuItem>
            {!instancesLoaded ? (
              <MenuItem value={UNASSIGNED} disabled>
                <CircularProgress size={12} sx={{ mr: 1 }} /> 加载中…
              </MenuItem>
            ) : (
              instances.map((ins: HermesInstanceItem) => (
                <MenuItem key={ins.id} value={ins.id}>
                  {ins.name} ({ins.baseUrl})
                </MenuItem>
              ))
            )}
          </TextField>

          <TextField
            label="角色(自由文本)"
            value={values.role || ''}
            onChange={(e) => set('role', e.target.value)}
            placeholder="前端开发工程师"
            fullWidth
          />
          <TextField
            label="标签(逗号分隔)"
            value={tagsRaw}
            onChange={(e) => {
              setTagsRaw(e.target.value);
              if (error) setError('');
            }}
            fullWidth
            placeholder="前端,代码,React"
            helperText="多个标签用英文逗号分隔"
          />
          <TextField
            label="头像 URL"
            value={values.avatarUrl || ''}
            onChange={(e) => set('avatarUrl', e.target.value)}
            fullWidth
          />
          <TextField
            label="简介"
            value={values.description || ''}
            onChange={(e) => set('description', e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
          <TextField
            label="System Prompt(附加)"
            value={values.systemPrompt || ''}
            onChange={(e) => set('systemPrompt', e.target.value)}
            fullWidth
            multiline
            rows={8}
            placeholder="附加到容器内 system prompt 之后"
          />
          <TextField
            label="开场白"
            value={values.greeting || ''}
            onChange={(e) => set('greeting', e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="用户进入聊天时展示的开场白"
          />
          <TextField
            label="排序权重"
            type="number"
            value={values.sortOrder ?? 0}
            onChange={(e) => set('sortOrder', Number(e.target.value))}
            fullWidth
            slotProps={{ htmlInput: { min: 0 } }}
            helperText="数值大的靠前,默认 0"
          />

          {isEdit ? (
            <>
              <TextField
                select
                label="状态"
                value={values.status || 'active'}
                onChange={(e) => set('status', e.target.value)}
                fullWidth
              >
                {STATUS_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={
                  <Switch
                    checked={!!values.published}
                    onChange={(e) => set('published', e.target.checked)}
                  />
                }
                label="已发布(对 C 端可见)"
              />
            </>
          ) : (
            <Typography variant="caption" color="text.secondary">
              新建后默认 status=active、published=false,可在编辑时调整。
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={isSubmitting}>
          {isEdit ? '保存' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
