'use client';

/**
 * 主体(角色 / 场景 / 道具)共用的字段定义和完整编辑弹窗。
 * 主体页(SubjectsSection)和右栏主体面板(SubjectPanel)都用它。
 */

import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { dramaAPI, type Character, type Prop, type Scene } from '@/apis/shortdrama';
import MenuItem from '@mui/material/MenuItem';
import { useOverview } from '../useProject';
import { UploadImageButton } from '../common';
import { VoicePicker } from './VoicePicker';

export type Kind = 'character' | 'scene' | 'prop';
export type Entity = Character | Scene | Prop;

interface FieldDef {
  key: string;
  label: string;
  multiline?: boolean;
  hint?: string;
}

export const FIELDS: Record<Kind, FieldDef[]> = {
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
    { key: 'voice', label: '配音音色' }, // 用 VoicePicker 渲染(下拉 + 试听)
    { key: 'based_on_id', label: '同一张脸' }, // 下拉选另一个角色(分身、镜中人、不同年龄的自己)
    { key: 'voice_ref_url', label: '配音参考音' }, // 试听 / 上传真人录音 / 清空后按音色自动重做
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

export const ROLE_LABEL: Record<string, string> = { protagonist: '主角', antagonist: '反派', support: '配角' };

export const TITLES: Record<Kind, { title: string; empty: string; ref: string }> = {
  character: { title: '角色', empty: '还没有角色。运行「剧本框架」让编剧创建,或手动添加。', ref: '定妆照' },
  scene: { title: '场景', empty: '还没有场景。', ref: '概念图' },
  prop: { title: '道具', empty: '还没有道具。', ref: '参考图' },
};

/** 按主体种类挑增删改接口 */
export function entityAPI(kind: Kind, projectId: number) {
  return {
    update: (id: number, f: Record<string, unknown>) =>
      kind === 'character' ? dramaAPI.updateCharacter(id, f) : kind === 'scene' ? dramaAPI.updateScene(id, f) : dramaAPI.updateProp(id, f),
    remove: (id: number) => (kind === 'character' ? dramaAPI.deleteCharacter(id) : kind === 'scene' ? dramaAPI.deleteScene(id) : dramaAPI.deleteProp(id)),
    create: (f: Record<string, unknown>) =>
      kind === 'character' ? dramaAPI.createCharacter(projectId, f) : kind === 'scene' ? dramaAPI.createScene(projectId, f) : dramaAPI.createProp(projectId, f),
  };
}

export function EntityDialog({ kind, projectId, open, entity, onClose, onSave }: { kind: Kind; projectId: number; open: boolean; entity: Entity | null; onClose: () => void; onSave: (f: Record<string, unknown>) => Promise<void> }) {
  const ov = useOverview(kind === 'character' ? projectId : 0);
  const others = (ov.data?.characters ?? []).filter((c) => c.id !== entity?.id);
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
          {fields.map((f) => kind === 'character' && f.key === 'voice' ? (
            <VoicePicker key={f.key} value={String(form.voice ?? '')} gender={form.gender} name={String(form.name ?? '')}
              // 换了音色,按旧音色自动生成的参考音作废(上传的真人录音保留)
              onChange={(v) => setForm((x) => ({ ...x, voice: v, ...(String(x.voice_ref_url ?? '').includes('/voice-ref/') ? { voice_ref_url: '' } : {}) }))} />
          ) : kind === 'character' && f.key === 'voice_ref_url' ? (
            <Stack key={f.key} spacing={0.5}>
              <Typography variant="body2" color="text.secondary">{f.label}</Typography>
              {form.voice_ref_url ? (
                <audio controls preload="none" src={String(form.voice_ref_url)} style={{ width: '100%', height: 36 }} />
              ) : (
                <Typography variant="caption" color="text.secondary">还没有。第一次配音时会用上面的音色自动念一段(年长角色压低、放慢)</Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <UploadImageButton label="上传真人录音" accept="audio/*" onUploaded={(url) => setForm((x) => ({ ...x, voice_ref_url: url }))} />
                {!!form.voice_ref_url && (
                  <Button size="small" color="warning" onClick={() => setForm((x) => ({ ...x, voice_ref_url: '' }))}>清空,按音色重做</Button>
                )}
              </Stack>
              <Typography variant="caption" color="text.secondary">5~15 秒这个角色的干净人声。有情绪的配音会照它的音色念每句台词</Typography>
            </Stack>
          ) : kind === 'character' && f.key === 'based_on_id' ? (
            <TextField
              key={f.key}
              select
              size="small"
              fullWidth
              label={f.label}
              value={Number(form.based_on_id ?? 0)}
              onChange={(e) => setForm((x) => ({ ...x, based_on_id: Number(e.target.value) || 0 }))}
              helperText="分身、镜中的自己、双胞胎、不同年龄的同一个人:选原角色,定妆照会用原角色的脸改出来"
            >
              <MenuItem value={0}>无(独立长相)</MenuItem>
              {others.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          ) : (
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
              if (kind === 'character') allowed.based_on_id = Number(form.based_on_id ?? 0) || 0;
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
