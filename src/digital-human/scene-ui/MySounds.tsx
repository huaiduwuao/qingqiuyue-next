/**
 * scene-ui/MySounds.tsx — 「机关」栏里的「我的声音」:自己传声音(go worldapp/sounds.go POST /world/sounds)
 *
 * ogg / mp3 / wav / m4a,一个最多 2MB、一人最多 50 个;默认只有自己在列表里看得到,公开了别人也能选
 * (我房间的规则用了我私有的声音,来串门的人照样听得到)。不先审,出了问题后台藏起来。
 * 传好的声音在规则的「放声音」、原型的「持续出声」里都能选。
 */

import React from 'react';
import { Box, Button, ButtonBase, Chip, CircularProgress, Typography } from '@mui/material';
import { deleteMySound, listMySounds, updateMySound, uploadMySound, worldFileUrl, type WorldSoundRow } from '@/apis/world';
import { refreshSounds } from './soundLib';

export function MySounds({ toast }: { toast: (icon: string, text: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [list, setList] = React.useState<WorldSoundRow[] | null>(null);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const load = React.useCallback(() => { listMySounds().then(setList).catch(() => setList([])); }, []);
  React.useEffect(() => { if (open && !list) load(); }, [open, list, load]);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); refreshSounds(); load(); if (ok) toast('🔊', ok); } catch (e) { toast('⚠️', (e as Error)?.message || '没成功'); }
  };
  const upload = async (f: File) => {
    if (f.size > 2 << 20) { toast('⚠️', '声音文件最多 2MB'); return; }
    const name = window.prompt('给这个声音起个名字', f.name.replace(/\.[^.]+$/, '').slice(0, 32));
    if (!name) return;
    const ambient = window.confirm('是持续的环境声吗?(流水、风、背景音乐选「确定」;一下子的音效选「取消」)');
    setBusy(true);
    await act(() => uploadMySound(f, { name, category: ambient ? 'ambient' : 'sfx', loop: ambient, visibility: 'private' }), '传好了,规则和原型里都能选');
    setBusy(false);
  };

  return (
    <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(181,140,255,0.06)', border: '1px solid rgba(181,140,255,0.2)' }}>
      <ButtonBase onClick={() => setOpen((v) => !v)} sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700 }}>
        <span>🔊 我的声音{list ? `(${list.length})` : ''}</span>
        <span style={{ color: '#d7b8ff', fontWeight: 400 }}>{open ? '收起' : '传自己的声音'}</span>
      </ButtonBase>
      {open && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.75 }}>
          <input ref={fileRef} type="file" hidden accept="audio/ogg,audio/mpeg,audio/wav,audio/mp4,.ogg,.mp3,.wav,.m4a"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
          <Button size="small" variant="outlined" disabled={busy} onClick={() => fileRef.current?.click()} sx={{ color: '#d7b8ff', borderColor: 'rgba(215,184,255,0.4)' }}>
            {busy ? <CircularProgress size={14} /> : '＋ 传一个(ogg / mp3 / wav,≤ 2MB)'}
          </Button>
          {!list ? <Box sx={{ display: 'grid', placeItems: 'center', py: 1 }}><CircularProgress size={16} /></Box>
            : list.length === 0 ? <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)' }}>还没传过。传好的声音在「放声音」「持续出声」里都能选。</Typography>
              : list.map((s) => (
                <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 12 }}>
                  <ButtonBase onClick={() => { void new Audio(worldFileUrl(s.file)).play(); }} aria-label="试听" sx={{ px: 0.5 }}>▶</ButtonBase>
                  <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</Box>
                  {s.hidden && <Chip size="small" label="被下架" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(255,120,120,0.3)', color: '#fff' }} />}
                  <ButtonBase onClick={() => void act(() => updateMySound(s.key, { visibility: s.visibility === 'public' ? 'private' : 'public' }))} sx={{ fontSize: 11, color: s.visibility === 'public' ? '#7dffb0' : 'rgba(255,255,255,0.55)' }}>
                    {s.visibility === 'public' ? '公开' : '私有'}
                  </ButtonBase>
                  <ButtonBase onClick={() => { const name = window.prompt('名字', s.name); if (name) void act(() => updateMySound(s.key, { name })); }} sx={{ fontSize: 11, color: '#9be8ff' }}>改名</ButtonBase>
                  <ButtonBase onClick={() => { if (window.confirm(`删掉「${s.name}」?用到它的规则会变成默认的提示音`)) void act(() => deleteMySound(s.key), '删掉了'); }} sx={{ fontSize: 11, color: '#ffb0b0' }}>删</ButtonBase>
                </Box>
              ))}
        </Box>
      )}
    </Box>
  );
}
