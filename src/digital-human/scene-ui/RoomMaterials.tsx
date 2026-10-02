/**
 * scene-ui/RoomMaterials.tsx — 这间房自己的物质(id 200–255,最多 56 种;go worldapp/laws.go)
 *
 * 搭积木面板里「＋ 我的材质」:房主给自己的房间定义新物质 —— 外观(颜色、纹理样式、透明、自己发光)、
 * 物理(挡不挡人、顶上能不能站、在里面走得慢、深了浮起来)、还有人踩上去 / 走进去时的规则(熔岩把人送回出口、金砖加分……)。
 * 存了整间房的人重新读积木;蓝图会带着这些物质走。平台的物质(0–199)在后台「造物」里管。
 */

import React from 'react';
import { Box, Button, ButtonBase, Checkbox, CircularProgress, TextField, Typography } from '@mui/material';
import { saveRoomMaterials, type WorldMaterial, type WorldRule } from '@/apis/world';
import { ROOM_MAT_MAX, ROOM_MAT_MIN, roomMaterials } from '../vrm/world/materials';
import { AiCompose, RulesEditor } from './RuleForm';

const field = { '& .MuiInputBase-root': { color: '#fff', fontSize: 12 }, '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } as const;
const selectStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, fontSize: 12, padding: '4px 6px' };
const PATTERNS = [['plain', '纯色'], ['speckle', '石点'], ['wood', '木纹'], ['brick', '砖'], ['brushed', '拉丝'], ['tile', '地砖'], ['cloth', '布']] as const;

function nextId(list: readonly WorldMaterial[]): number | null {
  for (let id = ROOM_MAT_MIN; id <= ROOM_MAT_MAX; id++) if (!list.some((m) => m.id === id)) return id;
  return null;
}

function MaterialForm({ m, onChange }: { m: WorldMaterial; onChange: (m: WorldMaterial) => void }) {
  const look = m.look ?? {};
  const props = m.props ?? {};
  const setLook = (k: string, v: unknown) => onChange({ ...m, look: { ...look, [k]: v } });
  const setProps = (k: string, v: unknown) => { const next: Record<string, unknown> = { ...props, [k]: v }; if (v === undefined) delete next[k]; onChange({ ...m, props: next as WorldMaterial['props'] }); };
  const check = (label: string, on: boolean, set: (v: boolean) => void) => (
    <Box component="label" sx={{ display: 'flex', alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
      <Checkbox size="small" checked={on} onChange={(e) => set(e.target.checked)} sx={{ p: 0.25, color: 'rgba(255,255,255,0.5)' }} />{label}
    </Box>
  );
  const liquid = props.liquid ?? {};
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <TextField size="small" label="名字" value={m.name} onChange={(e) => onChange({ ...m, name: e.target.value })} sx={{ ...field, flex: 1 }} />
        <TextField size="small" label="key" value={m.key} onChange={(e) => onChange({ ...m, key: e.target.value.toLowerCase() })} sx={{ ...field, width: 100 }} />
        <Box component="input" type="color" aria-label="颜色" value={m.color} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...m, color: e.target.value })} sx={{ width: 30, height: 26, p: 0, border: 0, bgcolor: 'transparent' }} />
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
        <select aria-label="纹理" style={selectStyle} value={look.pattern ?? 'plain'} onChange={(e) => setLook('pattern', e.target.value)}>
          {PATTERNS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>不透明</Typography>
        <Box component="input" type="range" min={0.1} max={1} step={0.05} aria-label="不透明度" value={look.opacity ?? 1} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLook('opacity', Number(e.target.value))} sx={{ width: 80 }} />
        {check('自己发光', !!look.unlit, (v) => setLook('unlit', v || undefined))}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {check('挡人', props.solid !== false, (v) => setProps('solid', v))}
        {check('顶上能站', props.walkable !== false, (v) => setProps('walkable', v))}
        {check('是液体(走得慢)', !!liquid.slow, (v) => setProps('liquid', v ? { slow: 0.5, float: liquid.float } : undefined))}
        {!!liquid.slow && check('深了浮起来', !!liquid.float, (v) => setProps('liquid', { ...liquid, float: v }))}
      </Box>
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>有人踩上去 / 走进去时(比如熔岩把人送回出口、金砖加分)</Typography>
      <AiCompose target="space" current={{ rules: m.rules ?? [] }} onDraft={(d) => { if (d.rules) onChange({ ...m, rules: d.rules.filter((r) => ['enter', 'leave', 'touch'].includes(r.on)) }); }} />
      <RulesEditor rules={(m.rules ?? []) as WorldRule[]} onChange={(r) => onChange({ ...m, rules: r })} scope="material" />
    </Box>
  );
}

export function RoomMaterials({ onSaved, toast }: { onSaved: () => void; toast: (icon: string, text: string) => void }) {
  const [list, setList] = React.useState<WorldMaterial[]>(() => roomMaterials().map((m) => ({ ...m })) as WorldMaterial[]);
  const [editing, setEditing] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const add = () => {
    const id = nextId(list);
    if (id === null) { toast('⚠️', '一间房最多 56 种自己的材质'); return; }
    setList([...list, { id, key: `mat${id}`, name: '新材质', color: '#ff7a3d', look: { pattern: 'plain' }, props: { solid: true, walkable: true } }]);
    setEditing(id);
  };
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await saveRoomMaterials(list);
      setList(r.list);
      toast('🧱', '材质存好了');
      onSaved();
    } catch (e) {
      setErr((e as Error)?.message || '没存上');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {list.length === 0 && <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>还没有自己的材质。可以做水、冰、熔岩、金砖……外观、物理、踩上去会怎样都是自己定。</Typography>}
      {list.map((m) => (
        <Box key={m.id} sx={{ p: 0.75, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.05)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: m.color, opacity: m.look?.opacity ?? 1, boxShadow: m.look?.unlit ? `0 0 6px ${m.color}` : 'none' }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>{m.name} <span style={{ opacity: 0.5, fontWeight: 400 }}>#{m.id}{m.rules?.length ? ` · ${m.rules.length} 条规则` : ''}</span></Typography>
            <ButtonBase onClick={() => setEditing(editing === m.id ? null : m.id)} sx={{ fontSize: 11.5, color: '#9be8ff', px: 0.5 }}>{editing === m.id ? '收起' : '改'}</ButtonBase>
            <ButtonBase onClick={() => { if (window.confirm(`删掉「${m.name}」?已经搭了的这种积木会放不了新的`)) setList(list.filter((x) => x.id !== m.id)); }} sx={{ fontSize: 11.5, color: '#ffb0b0', px: 0.5 }}>删</ButtonBase>
          </Box>
          {editing === m.id && <Box sx={{ mt: 0.75 }}><MaterialForm m={m} onChange={(next) => setList(list.map((x) => (x.id === m.id ? next : x)))} /></Box>}
        </Box>
      ))}
      <Button size="small" variant="outlined" onClick={add} sx={{ color: '#9be8ff', borderColor: 'rgba(155,232,255,0.4)' }}>＋ 新材质</Button>
      {err && <Typography sx={{ fontSize: 11.5, color: '#ff9b9b', whiteSpace: 'pre-wrap' }}>{err}</Typography>}
      <Button size="small" variant="contained" disabled={busy} onClick={() => void save()}>{busy ? <CircularProgress size={14} /> : '存(整间房的人重新读积木)'}</Button>
    </Box>
  );
}
