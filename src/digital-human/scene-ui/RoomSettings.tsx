/**
 * scene-ui/RoomSettings.tsx — 创世:房间设置
 *
 * 名字 / 简介、外壳(四种模板或一份扫描的泼溅)、泼溅对齐(滑杆实时预览,「自动摆正」按包围盒算)、
 * 时辰天气、开不开放串门、复制串门链接。改外壳要保存后整间房重建;对齐只是挪泼溅,不重建。
 */

import React from 'react';
import { Box, Button, ButtonBase, CircularProgress, IconButton, MenuItem, Slider, Switch, TextField, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { browseAssets, listMyVisitors, type RoomVisitor, type RoomPatch, type RoomTemplate, type ShellAlign, type WorldAssetFull, type WorldRoom } from '@/apis/world';
import type { VrmStageHandle } from '../VrmStage';
import { ROOM_TEMPLATE_LABELS } from '../vrm/world/worldLayout';
import type { SplatStatus } from '../vrm/world/roomShell';
import { WorldUpload } from './WorldUpload';
import { RoomAISection } from './RoomAI';
import { RoomEventsSection } from './RoomSocial';
import { errMessage } from '@/lib/errMessage';

const glass = { bgcolor: 'rgba(10,12,24,0.82)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' } as const;
const TEMPLATES: { key: RoomTemplate; emoji: string; hint: string }[] = [
  { key: 'study', emoji: '📚', hint: '木地板、花窗、三面粉墙' },
  { key: 'loft', emoji: '🏠', hint: '人字梁、圆窗,暖一点' },
  { key: 'courtyard', emoji: '🏯', hint: '石板地、矮墙、月洞门' },
  { key: 'empty', emoji: '⬜', hint: '一块大平台,随便摆' },
  { key: 'splat', emoji: '📷', hint: '用手机扫描的真实房间' },
];
const TIMES = [['', '默认(白天)'], ['auto', '跟随现在'], ['dawn', '清晨'], ['day', '白天'], ['dusk', '黄昏'], ['night', '夜晚']] as const;
const WEATHERS = [['', '无'], ['petals', '落花'], ['leaves', '落叶'], ['rain', '雨'], ['snow', '雪'], ['fireflies', '萤火']] as const;
const DEFAULT_ALIGN: ShellAlign = { x: 0, y: 0, z: 0, scale: 1, rotX: 0, rotY: 0, rotZ: 0 };
const deg = (r: number) => Math.round((r * 180) / Math.PI);
const rad = (d: number) => (d * Math.PI) / 180;

export interface RoomSettingsProps {
  room: WorldRoom;
  handle: VrmStageHandle | null;
  save: (p: RoomPatch) => Promise<WorldRoom>;
  splat: { status: SplatStatus; splats?: number; error?: string } | null;
  onClose: () => void;
  toast: (icon: string, text: string) => void;
  narrow?: boolean;
}

export function RoomSettings({ room, handle, save, splat, onClose, toast, narrow }: RoomSettingsProps) {
  const [name, setName] = React.useState(room.name);
  const [intro, setIntro] = React.useState(room.intro);
  const [busy, setBusy] = React.useState(false);
  const [splats, setSplats] = React.useState<WorldAssetFull[] | null>(null);
  const [align, setAlign] = React.useState<ShellAlign>({ ...DEFAULT_ALIGN, ...room.shell });
  const alignDirty = JSON.stringify(align) !== JSON.stringify({ ...DEFAULT_ALIGN, ...room.shell });

  React.useEffect(() => { setAlign({ ...DEFAULT_ALIGN, ...room.shell }); }, [room.shell, room.splatKey]);
  const loadSplats = React.useCallback(async () => {
    try { setSplats((await browseAssets({ kind: 'splat', size: 60 })).list); } catch { setSplats([]); }
  }, []);
  React.useEffect(() => { void loadSplats(); }, [loadSplats]);
  const [visitors, setVisitors] = React.useState<RoomVisitor[] | null>(null);
  React.useEffect(() => { listMyVisitors().then(setVisitors).catch(() => setVisitors([])); }, []);

  const run = async (p: RoomPatch, ok?: string) => {
    setBusy(true);
    try {
      await save(p);
      if (ok) toast('🏠', ok);
      return true;
    } catch (e) {
      toast('⚠️', errMessage(e) || '没存上');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const preview = (a: ShellAlign) => { setAlign(a); handle?.setRoomAlign(a); };
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/digital-human?room=${room.ownerId}` : '';

  const panelSx = narrow
    ? { position: 'absolute' as const, zIndex: 6, left: 8, right: 8, top: 'calc(108px + var(--sat, 0px))', bottom: 'calc(min(46vh, 460px) + 64px)' }
    : { position: 'absolute' as const, zIndex: 6, right: 16, top: 'calc(64px + var(--sat, 0px))', width: 360, maxHeight: 'calc(100vh - min(40vh, 400px) - 96px)' };
  const label = (t: string) => <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', mt: 1.5, mb: 0.75 }}>{t}</Typography>;
  const field = { slotProps: { inputLabel: { sx: { color: 'rgba(255,255,255,0.6)' } }, htmlInput: { sx: { color: '#fff', fontSize: 13 } } }, sx: { '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } };

  return (
    <Box sx={{ ...panelSx, ...glass, borderRadius: 3, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, pt: 1.25, pb: 0.5 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 800, flex: 1 }}>🏠 房间设置</Typography>
        {busy && <CircularProgress size={16} sx={{ mr: 1 }} />}
        <IconButton size="small" aria-label="关闭" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)' }}><CloseRoundedIcon fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 1.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1 }}>
          <TextField size="small" label="房间名" value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} {...field} />
          <TextField size="small" label="一句话介绍(串门的人看得到)" value={intro} onChange={(e) => setIntro(e.target.value.slice(0, 140))} multiline maxRows={3} {...field} />
          {(name !== room.name || intro !== room.intro) && (
            <Button size="small" variant="contained" disabled={busy} onClick={() => void run({ name, intro }, '改好了')} sx={{ alignSelf: 'flex-end' }}>保存名字</Button>
          )}
        </Box>

        {label('开放串门')}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Switch checked={room.visibility === 'public'} disabled={busy} onChange={(e) => void run({ visibility: e.target.checked ? 'public' : 'private' }, e.target.checked ? '别人现在能来串门了' : '房间只有你自己能进')} />
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', flex: 1 }}>
            {room.visibility === 'public' ? `已开放 · 来过 ${room.visits} 次` : '只有自己能进'}
          </Typography>
          {room.visibility === 'public' && (
            <Button size="small" onClick={() => { void navigator.clipboard?.writeText(shareUrl).then(() => toast('🔗', '串门链接复制好了')).catch(() => toast('🔗', shareUrl)); }} sx={{ color: '#9be8ff' }}>复制链接</Button>
          )}
        </Box>

        {label('房间外壳')}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.75 }}>
          {TEMPLATES.map((t) => {
            const active = room.template === t.key;
            const needSplat = t.key === 'splat' && !room.splatKey;
            return (
              <ButtonBase
                key={t.key}
                disabled={busy}
                onClick={() => {
                  if (active) return;
                  if (needSplat) { toast('📷', '先在下面选或上传一份扫描(泼溅)'); return; }
                  void run({ template: t.key }, `换成了${ROOM_TEMPLATE_LABELS[t.key]}`);
                }}
                sx={{ display: 'block', textAlign: 'left', p: 1, borderRadius: 2, bgcolor: active ? 'rgba(37,244,238,0.16)' : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? '#25F4EE' : 'transparent'}`, opacity: needSplat ? 0.6 : 1 }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t.emoji} {ROOM_TEMPLATE_LABELS[t.key]}</Typography>
                <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>{t.hint}</Typography>
              </ButtonBase>
            );
          })}
        </Box>

        {label('扫描的真实空间(高斯泼溅)')}
        <WorldUpload kind="splat" label="上传扫描" toast={toast} compact={narrow} onUploaded={(a) => { setSplats((cur) => [a, ...(cur ?? [])]); void run({ splatKey: a.key, template: 'splat', shell: DEFAULT_ALIGN }, '换成你扫描的空间了,载入后点「自动摆正」'); }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.75 }}>
          {splats === null && <CircularProgress size={16} />}
          {splats?.map((s) => {
            const active = room.splatKey === s.key;
            return (
              <ButtonBase
                key={s.key}
                disabled={busy}
                onClick={() => { if (!active || room.template !== 'splat') void run({ splatKey: s.key, template: 'splat', shell: active ? undefined : DEFAULT_ALIGN }, `换成「${s.nameZh}」`); }}
                sx={{ justifyContent: 'flex-start', gap: 1, px: 1, py: 0.6, borderRadius: 1.5, bgcolor: active ? 'rgba(37,244,238,0.14)' : 'rgba(255,255,255,0.04)' }}
              >
                <Typography sx={{ fontSize: 12.5, fontWeight: 600, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📷 {s.nameZh}</Typography>
                <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)' }}>
                  {s.splats ? `${(s.splats / 10000).toFixed(0)} 万点` : ''} {s.ownerId === room.ownerId ? '· 我的' : ''}
                </Typography>
              </ButtonBase>
            );
          })}
          {splats?.length === 0 && <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>还没有扫描。用 Polycam / Scaniverse / Luma 这类 App 扫一遍房间,导出 .ply 或 .spz 传上来。</Typography>}
        </Box>

        {room.template === 'splat' && (
          <>
            {label('对齐(边拖边看)')}
            {splat?.status === 'loading' && <Typography sx={{ fontSize: 12, color: '#ffd27a' }}>载入中……大文件要一会儿</Typography>}
            {splat?.status === 'error' && <Typography sx={{ fontSize: 12, color: '#ff9b9b' }}>载入失败:{splat.error}</Typography>}
            {splat?.status === 'ready' && splat.splats ? <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>{splat.splats.toLocaleString()} 个高斯点</Typography> : null}
            <Box sx={{ display: 'flex', gap: 0.75, my: 0.75, flexWrap: 'wrap' }}>
              <Button size="small" variant="outlined" disabled={splat?.status !== 'ready'} onClick={() => { const a = handle?.autoFitRoom(); if (a) setAlign(a); }}>自动摆正</Button>
              <Button size="small" variant="outlined" onClick={() => preview({ ...align, rotX: align.rotX + Math.PI > Math.PI * 1.01 ? align.rotX - Math.PI : align.rotX + Math.PI })}>上下翻转</Button>
              <Button size="small" onClick={() => preview(DEFAULT_ALIGN)} sx={{ color: 'rgba(255,255,255,0.6)' }}>还原</Button>
            </Box>
            {([['x', '左右', -15, 15], ['z', '前后', -15, 15], ['y', '高低', -5, 5]] as const).map(([k, t, lo, hi]) => (
              <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{ fontSize: 12, width: 36, color: 'rgba(255,255,255,0.7)' }}>{t}</Typography>
                <Slider size="small" min={lo} max={hi} step={0.02} value={align[k]} onChange={(_, v) => preview({ ...align, [k]: v as number })} />
                <Typography sx={{ fontSize: 11, width: 40, textAlign: 'right', color: 'rgba(255,255,255,0.6)' }}>{align[k].toFixed(2)}</Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontSize: 12, width: 36, color: 'rgba(255,255,255,0.7)' }}>大小</Typography>
              <Slider size="small" min={-3} max={3} step={0.01} value={Math.log(align.scale)} onChange={(_, v) => preview({ ...align, scale: +Math.exp(v as number).toFixed(3) })} />
              <Typography sx={{ fontSize: 11, width: 40, textAlign: 'right', color: 'rgba(255,255,255,0.6)' }}>×{align.scale.toFixed(2)}</Typography>
            </Box>
            {([['rotY', '转向'], ['rotX', '前后倾'], ['rotZ', '左右倾']] as const).map(([k, t]) => (
              <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{ fontSize: 12, width: 36, color: 'rgba(255,255,255,0.7)' }}>{t}</Typography>
                <Slider size="small" min={-180} max={180} step={1} value={deg(align[k])} onChange={(_, v) => preview({ ...align, [k]: rad(v as number) })} />
                <Typography sx={{ fontSize: 11, width: 40, textAlign: 'right', color: 'rgba(255,255,255,0.6)' }}>{deg(align[k])}°</Typography>
              </Box>
            ))}
            {alignDirty && (
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 0.5 }}>
                <Button size="small" onClick={() => preview({ ...DEFAULT_ALIGN, ...room.shell })} sx={{ color: 'rgba(255,255,255,0.6)' }}>撤回</Button>
                <Button size="small" variant="contained" disabled={busy} onClick={() => void run({ shell: align }, '对齐存好了')}>保存对齐</Button>
              </Box>
            )}
          </>
        )}

        {label('房间语音')}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Switch checked={!room.voiceOff} disabled={busy} onChange={(e) => void run({ voiceOff: !e.target.checked }, e.target.checked ? '房间语音打开了' : '房间语音关了')} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{room.voiceOff ? '关着' : '开着'}</Typography>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>进来的人可以开麦说话,离得近听得清;在聊天面板点某人的名字可以禁言</Typography>
          </Box>
        </Box>

        {label('一起搭积木')}
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {([['owner', '只有我'], ['friends', '我关注的人'], ['anyone', '来串门的都可以']] as const).map(([v, t]) => (
            <Button key={v} size="small" disabled={busy} variant={(room.buildPolicy ?? 'owner') === v ? 'contained' : 'outlined'} onClick={() => void run({ buildPolicy: v }, v === 'owner' ? '只有你能在房间里搭积木' : v === 'friends' ? '你关注的人来串门时能一起搭' : '来串门的人都能一起搭(得房间开放)')} sx={{ fontSize: 12 }}>{t}</Button>
          ))}
        </Box>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', mt: 0.5 }}>放开以后别人进了你的房间能一起放 / 拆积木(家具摆放还是只有你能动)</Typography>

        {label('照着布置')}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Switch checked={!room.noCopy} disabled={busy} onChange={(e) => void run({ noCopy: !e.target.checked }, e.target.checked ? '来串门的人可以照着你的房间布置了' : '别人不能照着你的房间布置了')} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{room.noCopy ? '不让照着摆' : '可以照着摆'}</Typography>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>来串门的人能一键把自己的房间布置成你这样(只复制摆法,不动你的房间)</Typography>
          </Box>
        </Box>

        {label('活动')}
        <RoomEventsSection room={room} toast={toast} />

        {label('房间里的 AI')}
        <RoomAISection room={room} save={save} toast={toast} />

        {label('最近来过')}
        {visitors === null && <CircularProgress size={14} />}
        {visitors?.length === 0 && <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>{room.visibility === 'public' ? '还没人来过。把串门链接发给朋友吧。' : '房间没开放,别人进不来。'}</Typography>}
        {!!visitors?.length && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {visitors.slice(0, 20).map((v) => (
              <Box key={v.userId} title={`来过 ${v.times} 次`} sx={{ fontSize: 11.5, px: 0.75, py: 0.2, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.08)' }}>
                {v.user?.nickname || '访客'}{v.times > 1 ? ` ×${v.times}` : ''}
              </Box>
            ))}
          </Box>
        )}

        {label('时辰与天气')}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField select size="small" fullWidth label="时辰" value={room.palette?.time ?? ''} disabled={busy}
            onChange={(e) => void run({ palette: { ...room.palette, time: e.target.value } })}
            slotProps={{ inputLabel: { sx: { color: 'rgba(255,255,255,0.6)' } }, input: { sx: { color: '#fff', fontSize: 13 } } }}>
            {TIMES.map(([v, t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}
          </TextField>
          <TextField select size="small" fullWidth label="天气" value={room.palette?.weather ?? ''} disabled={busy}
            onChange={(e) => void run({ palette: { ...room.palette, weather: e.target.value } })}
            slotProps={{ inputLabel: { sx: { color: 'rgba(255,255,255,0.6)' } }, input: { sx: { color: '#fff', fontSize: 13 } } }}>
            {WEATHERS.map(([v, t]) => <MenuItem key={v} value={v}>{t}</MenuItem>)}
          </TextField>
        </Box>
      </Box>
    </Box>
  );
}
