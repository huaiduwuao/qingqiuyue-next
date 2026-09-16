'use client';

/**
 * 角色 / 场景 / 道具 三个分区共用:卡片 + 参考图 + 视觉提示词编辑。
 * 视觉身份由「角色/美术设定」员工生成(visual_design),也可手改;参考图可生成或上传。
 */

import React, { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { dramaAPI, type Character, type Prop, type Scene } from '@/apis/shortdrama';
import type { SectionProps } from '../Workbench';
import { Empty, EntityStatusChip, MediaThumb, UploadImageButton } from '../common';
import { useCapabilities, useInvalidate, useOverview, useStartTask } from '../useProject';

type Kind = 'character' | 'scene' | 'prop';
type Entity = Character | Scene | Prop;

interface FieldDef {
  key: string;
  label: string;
  multiline?: boolean;
  hint?: string;
}

const FIELDS: Record<Kind, FieldDef[]> = {
  character: [
    { key: 'name', label: '名字' },
    { key: 'role', label: '定位(protagonist / antagonist / support)' },
    { key: 'gender', label: '性别' },
    { key: 'age', label: '年龄' },
    { key: 'bio', label: '人物小传', multiline: true },
    { key: 'personality', label: '性格', multiline: true },
    { key: 'arc', label: '人物弧光', multiline: true },
    { key: 'appearance', label: '外貌(中文)', multiline: true },
    { key: 'outfit', label: '标志性服装', multiline: true },
    { key: 'visual_prompt', label: '视觉身份提示词(英文,所有镜头复用)', multiline: true, hint: '固定这段就是跨集一致性的关键;改了要重出相关镜头' },
    { key: 'negative_prompt', label: '负面词(英文)', multiline: true },
    { key: 'voice_style', label: '声线' },
    { key: 'seed', label: '种子(数字,固定则更稳定)' },
  ],
  scene: [
    { key: 'name', label: '名字' },
    { key: 'description', label: '描述', multiline: true },
    { key: 'time_of_day', label: '时间' },
    { key: 'mood', label: '氛围' },
    { key: 'visual_prompt', label: '视觉提示词(英文)', multiline: true },
    { key: 'negative_prompt', label: '负面词(英文)', multiline: true },
    { key: 'seed', label: '种子' },
  ],
  prop: [
    { key: 'name', label: '名字' },
    { key: 'description', label: '描述', multiline: true },
    { key: 'significance', label: '剧情作用', multiline: true },
    { key: 'visual_prompt', label: '视觉提示词(英文)', multiline: true },
  ],
};

const TITLES: Record<Kind, { title: string; empty: string; ref: string }> = {
  character: { title: '角色', empty: '还没有角色。运行「剧本框架」让编剧创建,或手动添加。', ref: '定妆照' },
  scene: { title: '场景', empty: '还没有场景。', ref: '概念图' },
  prop: { title: '道具', empty: '还没有道具。', ref: '参考图' },
};

export default function EntitySection({ projectId, kind, setFeedbackTarget }: SectionProps & { kind: Kind }) {
  const ov = useOverview(projectId);
  const caps = useCapabilities();
  const start = useStartTask(projectId);
  const invalidate = useInvalidate(projectId);
  const [editing, setEditing] = useState<Entity | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState('');

  if (ov.isLoading || !ov.data) return <Skeleton variant="rounded" height={320} />;
  const list: Entity[] = kind === 'character' ? ov.data.characters : kind === 'scene' ? ov.data.scenes : ov.data.props;
  const running = !!ov.data.running;
  const t2i = caps.data?.capabilities?.t2i.available ?? false;
  const meta = TITLES[kind];

  const api = {
    update: (id: number, f: Record<string, unknown>) =>
      kind === 'character' ? dramaAPI.updateCharacter(id, f) : kind === 'scene' ? dramaAPI.updateScene(id, f) : dramaAPI.updateProp(id, f),
    remove: (id: number) => (kind === 'character' ? dramaAPI.deleteCharacter(id) : kind === 'scene' ? dramaAPI.deleteScene(id) : dramaAPI.deleteProp(id)),
    create: (f: Record<string, unknown>) =>
      kind === 'character' ? dramaAPI.createCharacter(projectId, f) : kind === 'scene' ? dramaAPI.createScene(projectId, f) : dramaAPI.createProp(projectId, f),
  };
  const guard = async (fn: () => Promise<unknown>) => {
    setErr('');
    try {
      await fn();
      invalidate();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : '操作失败');
    }
  };

  return (
    <Stack spacing={2}>
      <Stack sx={{ alignItems: 'center', flexWrap: 'wrap' }} direction="row" spacing={1} useFlexGap>
        <Typography variant="h6" sx={{ flex: 1 }}>
          {meta.title}({list.length})
        </Typography>
        <Button size="small" variant="outlined" disabled={running || list.length === 0} onClick={() => start.mutate({ step: 'visual_design', input: { generate_images: false } })}>
          补全视觉设定
        </Button>
        <Button size="small" variant="outlined" disabled={running || list.length === 0 || !t2i} onClick={() => start.mutate({ step: 'visual_design', input: { generate_images: true } })}>
          生成{meta.ref}
        </Button>
        <Button size="small" variant="outlined" color="warning" disabled={running || list.length === 0} onClick={() => start.mutate({ step: 'visual_design', input: { force: true, generate_images: t2i } })}>
          全部重做
        </Button>
        <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setCreating(true)}>
          手动添加
        </Button>
      </Stack>
      {!t2i && list.length > 0 && <Alert severity="info">没有启用文生图工作流,{meta.ref}只能上传;视觉提示词仍会生成。</Alert>}
      {err && (
        <Alert severity="error" onClose={() => setErr('')}>
          {err}
        </Alert>
      )}

      {list.length === 0 ? (
        <Empty title={meta.empty} action={kind === 'character' ? <Button variant="contained" disabled={running} onClick={() => start.mutate({ step: 'screenwriter' })}>运行剧本框架</Button> : undefined} />
      ) : (
        <Grid container spacing={1.5}>
          {list.map((it) => (
            <Grid key={it.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <Box sx={{ display: 'flex', gap: 1.5, p: 1.5 }}>
                  <MediaThumb src={it.ref_image_url} height={kind === 'character' ? 170 : 110} ratio={kind === 'character' ? '9 / 16' : '16 / 10'} />
                  <CardContent sx={{ p: 0, flex: 1, minWidth: 0 }}>
                    <Stack sx={{ alignItems: 'center' }} direction="row" spacing={0.5}>
                      <Typography variant="subtitle1" noWrap sx={{ flex: 1, fontWeight: 600 }}>
                        {it.name}
                      </Typography>
                      <EntityStatusChip status={it.status} />
                    </Stack>
                    {'role' in it && (
                      <Typography variant="caption" color="text.secondary">
                        {it.role} · {it.gender} {it.age}
                      </Typography>
                    )}
                    {'time_of_day' in it && (it.time_of_day || it.mood) && (
                      <Typography variant="caption" color="text.secondary">
                        {it.time_of_day} · {it.mood}
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', mt: 0.5 }}>
                      {'bio' in it ? it.bio : it.description}
                    </Typography>
                    <Typography variant="caption" color={it.visual_prompt ? 'text.secondary' : 'warning.main'} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mt: 0.5, fontFamily: 'monospace' }}>
                      {it.visual_prompt || '尚无视觉提示词'}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 1, alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
                      <IconButton size="small" onClick={() => setEditing(it)} aria-label="编辑">
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                      <UploadImageButton label={`上传${meta.ref}`} onUploaded={(url) => guard(() => api.update(it.id, { ref_image_url: url, status: 'locked' }))} />
                      <Button size="small" onClick={() => setFeedbackTarget({ type: kind, id: it.id, label: `${meta.title}「${it.name}」` })}>
                        提意见
                      </Button>
                      <IconButton size="small" color="error" onClick={() => window.confirm(`删除「${it.name}」?`) && guard(() => api.remove(it.id))} aria-label="删除">
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </CardContent>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <EntityDialog
        kind={kind}
        open={!!editing || creating}
        entity={editing}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
        onSave={async (fields) => {
          if (editing) await guard(() => api.update(editing.id, fields));
          else await guard(() => api.create(fields));
        }}
      />
    </Stack>
  );
}

function EntityDialog({ kind, open, entity, onClose, onSave }: { kind: Kind; open: boolean; entity: Entity | null; onClose: () => void; onSave: (f: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  React.useEffect(() => {
    setForm(entity ? { ...(entity as unknown as Record<string, unknown>) } : {});
  }, [entity, open]);
  const fields = FIELDS[kind];
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{entity ? `编辑${TITLES[kind].title}` : `新建${TITLES[kind].title}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {fields.map((f) => (
            <TextField
              key={f.key}
              label={f.label}
              helperText={f.hint}
              multiline={f.multiline}
              minRows={f.multiline ? 2 : undefined}
              value={form[f.key] ?? ''}
              onChange={(e) => setForm((x) => ({ ...x, [f.key]: f.key === 'seed' ? Number(e.target.value) || 0 : e.target.value }))}
              fullWidth
              size="small"
            />
          ))}
          {entity?.ref_image_url && (
            <Stack sx={{ alignItems: 'center' }} direction="row" spacing={1}>
              <Chip size="small" label="已有参考图" />
              <Button size="small" color="warning" onClick={() => setForm((x) => ({ ...x, ref_image_url: '' }))}>
                清除参考图
              </Button>
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          variant="contained"
          disabled={saving || !String(form.name ?? '').trim()}
          onClick={async () => {
            setSaving(true);
            try {
              const allowed: Record<string, unknown> = {};
              fields.forEach((f) => {
                allowed[f.key] = form[f.key] ?? '';
              });
              if ('ref_image_url' in form) allowed.ref_image_url = form.ref_image_url;
              await onSave(allowed);
              onClose();
            } finally {
              setSaving(false);
            }
          }}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
}
