'use client';

/**
 * /system/digital-human-config
 *
 * 数字人配置可视化维护（Phase 5.1）
 *   - Models（角色模型 URL + 物理胶囊尺寸 + 名字映射）
 *   - Actions（27 个动作 + formula）
 *   - Dance Styles（groove / idol / walk / run + formula）
 *   - Scenes（6 个场景 + lights + decorations + cameraPresets + particles）
 */

import React from 'react';
import {
  Box, Typography, Stack, Card, CardContent, Button, Chip, IconButton,
  TextField, Tabs, Tab, MenuItem, Select, FormControl, InputLabel,
  Switch, FormControlLabel,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listModels, createModel, updateModel, deleteModel,
  listActions, createAction, updateAction, deleteAction,
  listDanceStyles,
  listScenes, createScene, updateScene, deleteScene,
} from '@/digital-human/api/digitalHumanConfig';

type Tab = 'models' | 'actions' | 'dances' | 'scenes';

const tabs: { key: Tab; label: string }[] = [
  { key: 'models', label: '模型 (Models)' },
  { key: 'actions', label: '动作 (Actions)' },
  { key: 'dances', label: '舞蹈风格 (Dance Styles)' },
  { key: 'scenes', label: '场景 (Scenes)' },
];

export default function DigitalHumanConfigPage() {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<Tab>('models');

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 600, letterSpacing: '.12em' }}>数字人配置</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
        管理 VRM 模型、动作、舞蹈风格、场景。后端 qingqiuyue-go Postgres，编辑后自动同步到 /api/realtime/digital-human/*。
      </Typography>

      <Card variant="outlined">
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          {tabs.map((t) => (
            <Tab key={t.key} value={t.key} label={t.label} />
          ))}
        </Tabs>
        <CardContent>
          {tab === 'models' && <ModelsTab qc={qc} />}
          {tab === 'actions' && <ActionsTab qc={qc} />}
          {tab === 'dances' && <DancesTab qc={qc} />}
          {tab === 'scenes' && <ScenesTab qc={qc} />}
        </CardContent>
      </Card>
    </Box>
  );
}

// ============================================================================
// Models
// ============================================================================
function ModelsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const list = useQuery({ queryKey: ['dhc', 'models'], queryFn: () => listModels(), refetchInterval: 60_000 });
  const [editing, setEditing] = React.useState<any | null>(null);

  const save = useMutation({
    mutationFn: (e: any) => editing?.id ? updateModel(editing.id, e) : createModel(e),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dhc', 'models'] }); setEditing(null); },
  });
  const del = useMutation({
    mutationFn: (id: number) => deleteModel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dhc', 'models'] }),
  });

  if (editing) return <ModelEditor value={editing} onChange={setEditing} onSave={save.mutate} onCancel={() => setEditing(null)} />;

  return (
    <Stack spacing={1}>
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button startIcon={<AddRoundedIcon />} variant="contained"
          onClick={() => setEditing({
            id: 0, name: '', url: '', scale: 1, footOffsetY: 0,
            capsule: { height: 1.6, radius: 0.3 },
            expressionMap: {}, visemeMap: {}, boneMap: {}, isDefault: false,
          })}>
          新建模型
        </Button>
      </Stack>
      <Stack spacing={1}>
        {list.data?.map((m: any) => (
          <Card key={m.id} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction="row" sx={{ alignItems: 'center' }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600, fontSize: 14 }}>
                  {m.name}{m.isDefault && <Chip label="default" size="small" sx={{ ml: 1 }} />}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{m.url}</Typography>
              </Box>
              <Chip label={`scale ${m.scale}`} size="small" />
              <Chip label={`cap ${m.capsule?.height ?? '-'}/${m.capsule?.radius ?? '-'}`} size="small" />
              <IconButton size="small" onClick={() => setEditing(m)}><EditRoundedIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => { if (confirm(`删除 ${m.name}?`)) del.mutate(m.id); }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Stack>
  );
}

function ModelEditor({ value, onChange, onSave, onCancel }: any) {
  const update = (patch: any) => onChange({ ...value, ...patch });
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">{value.id ? '编辑模型' : '新建模型'}</Typography>
      <Stack direction="row" spacing={2}>
        <TextField label="名称" value={value.name} onChange={(e) => update({ name: e.target.value })} size="small" fullWidth />
        <TextField label="URL" value={value.url} onChange={(e) => update({ url: e.target.value })} size="small" fullWidth />
        <TextField label="Scale" type="number" value={value.scale} onChange={(e) => update({ scale: parseFloat(e.target.value) })} size="small" />
      </Stack>
      <Stack direction="row" spacing={2}>
        <TextField label="footOffsetY" type="number" value={value.footOffsetY} onChange={(e) => update({ footOffsetY: parseFloat(e.target.value) })} size="small" />
        <TextField label="capsule.height" type="number" value={value.capsule?.height ?? 1.6}
          onChange={(e) => update({ capsule: { ...value.capsule, height: parseFloat(e.target.value) } })} size="small" />
        <TextField label="capsule.radius" type="number" value={value.capsule?.radius ?? 0.3}
          onChange={(e) => update({ capsule: { ...value.capsule, radius: parseFloat(e.target.value) } })} size="small" />
        <FormControlLabel control={<Switch checked={!!value.isDefault} onChange={(_, v) => update({ isDefault: v })} />} label="default" />
      </Stack>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
        Expression / Viseme / Bone Map 是 JSON 字段，Phase 5.2 加可视化编辑。
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={() => onSave(value)}>保存</Button>
        <Button onClick={onCancel}>取消</Button>
      </Stack>
    </Stack>
  );
}

// ============================================================================
// Actions
// ============================================================================
function ActionsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const list = useQuery({ queryKey: ['dhc', 'actions'], queryFn: () => listActions('character'), refetchInterval: 60_000 });
  const [editing, setEditing] = React.useState<any | null>(null);
  const [filter, setFilter] = React.useState('');

  const save = useMutation({
    mutationFn: (e: any) => editing?.id ? updateAction(editing.id, e) : createAction(e),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dhc', 'actions'] }); setEditing(null); },
  });
  const del = useMutation({
    mutationFn: (id: number) => deleteAction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dhc', 'actions'] }),
  });

  if (editing) return <ActionEditor value={editing} onChange={setEditing} onSave={save.mutate} onCancel={() => setEditing(null)} />;

  const filtered = (list.data ?? []).filter((a: any) => !filter || a.name.includes(filter) || a.label?.includes(filter));

  return (
    <Stack spacing={1}>
      <Stack direction="row" sx={{ alignItems: 'center' }} spacing={1}>
        <TextField size="small" placeholder="搜索 name / label" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ flex: 1 }} />
        <Button startIcon={<AddRoundedIcon />} variant="contained"
          onClick={() => setEditing({
            id: 0, modelId: '00000000-0000-0000-0000-000000000001', name: '', label: '',
            category: 'emote', description: '', triggers: [], boneRotations: {},
            durationMs: 0, loopable: false, formula: '',
          })}>新建动作</Button>
      </Stack>
      <Box sx={{ maxHeight: 480, overflow: 'auto' }}>
        <Stack spacing={0.5}>
          {filtered.map((a: any) => (
            <Card key={a.id} variant="outlined" sx={{ p: 1 }}>
              <Stack direction="row" sx={{ alignItems: 'center' }} spacing={1}>
                <Chip label={a.category} size="small" />
                <Typography sx={{ fontWeight: 600, fontSize: 13, minWidth: 80 }}>{a.name}</Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', flex: 1 }}>{a.label}</Typography>
                <Chip label={a.loopable ? 'loop' : `${a.durationMs}ms`} size="small" />
                <IconButton size="small" onClick={() => setEditing(a)}><EditRoundedIcon fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => { if (confirm(`删除 ${a.name}?`)) del.mutate(a.id); }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
              </Stack>
            </Card>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}

function ActionEditor({ value, onChange, onSave, onCancel }: any) {
  const update = (patch: any) => onChange({ ...value, ...patch });
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">{value.id ? '编辑动作' : '新建动作'}</Typography>
      <Stack direction="row" spacing={2}>
        <TextField label="name (en)" value={value.name} onChange={(e) => update({ name: e.target.value })} size="small" fullWidth />
        <TextField label="label (zh)" value={value.label} onChange={(e) => update({ label: e.target.value })} size="small" fullWidth />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>category</InputLabel>
          <Select value={value.category} label="category" onChange={(e) => update({ category: e.target.value })}>
            {['greeting', 'emote', 'performance', 'thought', 'rest', 'neutral', 'locomotion'].map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
      <TextField label="description" value={value.description} onChange={(e) => update({ description: e.target.value })} size="small" fullWidth />
      <Stack direction="row" spacing={2}>
        <TextField label="durationMs" type="number" value={value.durationMs} onChange={(e) => update({ durationMs: parseInt(e.target.value) || 0 })} size="small" />
        <FormControlLabel control={<Switch checked={!!value.loopable} onChange={(_, v) => update({ loopable: v })} />} label="loopable" />
      </Stack>
      <TextField
        label="formula (JS 表达式, 参数 t/blend/A/bass/phase, 返回 { bones, scenePosY?, scenePosX? })"
        value={value.formula || ''}
        onChange={(e) => update({ formula: e.target.value })}
        size="small"
        fullWidth
        multiline
        minRows={4}
        maxRows={12}
        sx={{ '& textarea': { fontFamily: 'ui-monospace, monospace', fontSize: 12 } }}
      />
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
        提示：t=秒, A=振幅, bass=低频能量, phase=相位(行走)。bones 返回 {'{ hips: [x,y,z], leftUpperArm: [...] }'}。
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={() => onSave(value)}>保存</Button>
        <Button onClick={onCancel}>取消</Button>
      </Stack>
    </Stack>
  );
}

// ============================================================================
// Dances (只读展示)
// ============================================================================
function DancesTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const list = useQuery({ queryKey: ['dhc', 'dances'], queryFn: () => listDanceStyles('character'), refetchInterval: 60_000 });
  return (
    <Stack spacing={1}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
        舞蹈风格走 formula。编辑通过 /api/realtime/digital-human/dance-styles（Phase 5.2 加可视化）。当前展示 metadata。
      </Typography>
      {list.data?.map((d: any) => (
        <Card key={d.id} variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" sx={{ alignItems: 'center' }} spacing={2}>
            <Chip label={d.category || 'idle_bounce'} size="small" />
            <Typography sx={{ fontWeight: 600, fontSize: 14, minWidth: 80 }}>{d.name}</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', flex: 1 }}>{d.label}</Typography>
            <Chip label={`BPM ${d.bpm}`} size="small" />
            {d.params && Object.keys(d.params).length > 0 && (
              <Chip label={`params: ${Object.keys(d.params).join(', ')}`} size="small" variant="outlined" />
            )}
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

// ============================================================================
// Scenes
// ============================================================================
function ScenesTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const list = useQuery({ queryKey: ['dhc', 'scenes'], queryFn: () => listScenes(), refetchInterval: 60_000 });
  const [editing, setEditing] = React.useState<any | null>(null);

  const save = useMutation({
    mutationFn: (e: any) => editing?.id ? updateScene(editing.id, e) : createScene(e),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dhc', 'scenes'] }); setEditing(null); },
  });
  const del = useMutation({
    mutationFn: (id: number) => deleteScene(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dhc', 'scenes'] }),
  });

  if (editing) return <SceneEditor value={editing} onChange={setEditing} onSave={save.mutate} onCancel={() => setEditing(null)} />;

  return (
    <Stack spacing={1}>
      <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
        <Button startIcon={<AddRoundedIcon />} variant="contained"
          onClick={() => setEditing({
            id: 0, name: '', label: '', description: '',
            background: { type: 'color', color: 0x000000 },
            floor: { type: 'plane', width: 10, depth: 10, color: 0x222222, roughness: 0.9, metalness: 0, receiveShadow: true, collider: 'plane' },
            lights: [], decorations: [], cameraPresets: [],
            physics: { gravity: -9.81, bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } },
            isDefault: false,
          })}>新建场景</Button>
      </Stack>
      {list.data?.map((s: any) => (
        <Card key={s.id} variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" sx={{ alignItems: 'center' }} spacing={2}>
            <Typography sx={{ fontWeight: 600, fontSize: 14, minWidth: 90 }}>{s.name}</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', flex: 1 }}>{s.label}</Typography>
            {s.isDefault && <Chip label="default" size="small" />}
            <Chip label={`${s.lights?.length ?? 0} lights`} size="small" />
            <Chip label={`${s.decorations?.length ?? 0} decos`} size="small" />
            <IconButton size="small" onClick={() => setEditing(s)}><EditRoundedIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => { if (confirm(`删除 ${s.name}?`)) del.mutate(s.id); }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}

function SceneEditor({ value, onChange, onCancel, onSave }: any) {
  const [jsonView, setJsonView] = React.useState(JSON.stringify(value, null, 2));
  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonView);
      onSave(parsed);
    } catch (e: any) {
      alert('JSON 解析失败: ' + e.message);
    }
  };
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">{value.id ? '编辑场景' : '新建场景'}</Typography>
      <Stack direction="row" spacing={2}>
        <TextField label="name" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} size="small" />
        <TextField label="label" value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} size="small" />
        <FormControlLabel control={<Switch checked={!!value.isDefault} onChange={(_, v) => onChange({ ...value, isDefault: v })} />} label="default" />
      </Stack>
      <TextField label="config JSON (SceneConfig 整树)" value={jsonView}
        onChange={(e) => setJsonView(e.target.value)}
        multiline minRows={20} maxRows={30}
        sx={{ '& textarea': { fontFamily: 'ui-monospace, monospace', fontSize: 12 } }}
        fullWidth />
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={handleSave}>保存</Button>
        <Button onClick={onCancel}>取消</Button>
      </Stack>
    </Stack>
  );
}
