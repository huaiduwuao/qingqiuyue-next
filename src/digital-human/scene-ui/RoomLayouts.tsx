/**
 * scene-ui/RoomLayouts.tsx — 蓝图(世界模型的 Prefab;原来十一期的样板间)
 *
 * 布置抽屉里的「蓝图」一栏:
 *   - 平台的几份(书斋茶席、阁楼会客、庭院小景……)、我存的、别人公开的;
 *   - 「换成这样」= 原来的摆设、积木和外壳先存一份、整个换掉(能撤销一次);「加进来」= 只往里加(积木只填空格),外壳不动;
 *   - 「把我的房间存成蓝图」:摆设、机关(原型 / 状态 / 规则)、积木、外壳整份存下来,公开了别人也能套;
 *     我的蓝图能改成公开 / 私有、删掉。
 * 还没做好的素材(目录里有、没加工)跳过,回来的结果里说跳过了几件。
 * 串门时 RoomPlate 上的「照着布置」走同一个接口(from = 房主)。
 */

import React from 'react';
import { Box, Button, Chip, CircularProgress, Switch, TextField, Typography } from '@mui/material';
import { applyLayout, deletePrefab, listLayouts, savePrefab, undoLayout, updatePrefab, worldFileUrl, type ApplyLayoutResult, type WorldLayout } from '@/apis/world';

/** 套用结果说成一句话 */
export function layoutResultText(r: ApplyLayoutResult): string {
  const blocks = r.blocks ? `、${r.blocks} 块积木` : '';
  if (!r.placed) {
    if (r.blocks) return `搭好了 ${r.blocks} 块积木${r.skipped ? `,${r.skipped} 件还没做好先跳过` : ''}`;
    return r.skipped ? `这一份里的东西还没做好,先跳过了 ${r.skipped} 件` : '没有能摆的东西';
  }
  return `摆好了 ${r.placed} 件${blocks}${r.skipped ? `,${r.skipped} 件还没做好先跳过` : ''}`;
}

const field = { '& .MuiInputBase-root': { color: '#fff', fontSize: 13 }, '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } } as const;

function SaveMine({ busy, onSaved, toast }: { busy: boolean; onSaved: (l: WorldLayout) => void; toast: (icon: string, text: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [intro, setIntro] = React.useState('');
  const [pub, setPub] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const l = await savePrefab({ name, intro, visibility: pub ? 'public' : 'private' });
      toast('📐', `存好了「${l.name}」${pub ? ',别人也能套用' : ''}`);
      setOpen(false);
      setName('');
      setIntro('');
      onSaved(l);
    } catch (e) {
      toast('⚠️', (e as Error)?.message || '没存上');
    } finally {
      setSaving(false);
    }
  };
  if (!open) {
    return (
      <Button size="small" variant="outlined" disabled={busy} onClick={() => setOpen(true)} sx={{ color: '#9be8ff', borderColor: 'rgba(155,232,255,0.4)' }}>
        📐 把我的房间存成蓝图
      </Button>
    );
  }
  return (
    <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(37,244,238,0.08)', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)' }}>摆设、机关、积木、外壳和时辰天气整份存下来</Typography>
      <TextField size="small" placeholder="名字(比如:江南小院)" value={name} onChange={(e) => setName(e.target.value)} slotProps={{ htmlInput: { maxLength: 24 } }} sx={field} />
      <TextField size="small" placeholder="一句话介绍(可以不写)" value={intro} onChange={(e) => setIntro(e.target.value)} slotProps={{ htmlInput: { maxLength: 80 } }} sx={field} />
      <Box sx={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
        <Switch size="small" checked={pub} onChange={(e) => setPub(e.target.checked)} />
        {pub ? '公开:别人也能套用' : '只有我自己用'}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        <Button size="small" variant="contained" disabled={saving || !name.trim()} onClick={() => void save()} sx={{ flex: 1 }}>
          {saving ? <CircularProgress size={14} /> : '存'}
        </Button>
        <Button size="small" onClick={() => setOpen(false)} sx={{ color: '#9be8ff' }}>取消</Button>
      </Box>
    </Box>
  );
}

export function RoomLayouts({ toast, onApplied, narrow }: {
  toast: (icon: string, text: string) => void;
  /** 套用 / 撤销以后:重读摆放和房间外壳 */
  onApplied: () => void;
  narrow?: boolean;
}) {
  const [list, setList] = React.useState<WorldLayout[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [canUndo, setCanUndo] = React.useState(false);
  const load = React.useCallback(() => {
    listLayouts().then(setList).catch(() => setList((cur) => cur ?? []));
  }, []);
  React.useEffect(load, [load]);

  const apply = async (l: WorldLayout, mode: 'replace' | 'add') => {
    if (busy) return;
    if (mode === 'replace' && !window.confirm(`把房间换成「${l.name}」?原来的摆设和积木会先存一份,可以撤销。`)) return;
    setBusy(l.key + mode);
    try {
      const r = await applyLayout({ template: l.key, mode });
      if (mode === 'replace') setCanUndo(r.canUndo);
      toast('🏡', layoutResultText(r));
      onApplied();
    } catch (e) {
      toast('⚠️', (e as Error)?.message || '没套上');
    } finally {
      setBusy(null);
    }
  };
  const undo = async () => {
    setBusy('undo');
    try {
      await undoLayout();
      setCanUndo(false);
      toast('↩️', '换回原来的布置了');
      onApplied();
    } catch (e) {
      toast('⚠️', (e as Error)?.message || '撤销不了');
    } finally {
      setBusy(null);
    }
  };
  const togglePublic = async (l: WorldLayout) => {
    const visibility = l.visibility === 'public' ? 'private' : 'public';
    try {
      await updatePrefab(l.key, { visibility });
      setList((cur) => cur?.map((x) => (x.key === l.key ? { ...x, visibility } : x)) ?? cur);
    } catch (e) {
      toast('⚠️', (e as Error)?.message || '改不了');
    }
  };
  const remove = async (l: WorldLayout) => {
    if (!window.confirm(`删掉蓝图「${l.name}」?`)) return;
    try {
      await deletePrefab(l.key);
      setList((cur) => cur?.filter((x) => x.key !== l.key) ?? cur);
    } catch (e) {
      toast('⚠️', (e as Error)?.message || '删不了');
    }
  };

  if (!list) return <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}><CircularProgress size={18} /></Box>;
  const usable = (l: WorldLayout) => l.ready > 0 || !!l.blocks;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {canUndo && (
        <Button size="small" variant="outlined" disabled={!!busy} onClick={() => void undo()} sx={{ color: '#ffd27a', borderColor: 'rgba(255,210,122,0.5)' }}>
          {busy === 'undo' ? <CircularProgress size={14} /> : '↩ 撤销刚才的套用'}
        </Button>
      )}
      <SaveMine busy={!!busy} toast={toast} onSaved={() => load()} />
      {list.map((l) => (
        <Box key={l.key} sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
          {l.thumbs.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, mb: 0.75, height: narrow ? 44 : 56 }}>
              {l.thumbs.map((t) => (
                <Box key={t} sx={{ flex: 1, minWidth: 0, borderRadius: 1, display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 50% 60%, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 70%)' }}>
                  <Box component="img" src={worldFileUrl(t)} alt="" loading="lazy" draggable={false} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </Box>
              ))}
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 800, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</Typography>
            <Chip size="small" label={l.ownerId === '0' ? '平台' : l.mine ? (l.visibility === 'public' ? '我的 · 公开' : '我的') : '别人公开的'} sx={{ height: 18, fontSize: 10, color: '#fff', bgcolor: l.mine ? 'rgba(37,244,238,0.2)' : 'rgba(255,255,255,0.1)' }} />
          </Box>
          {l.intro && <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>{l.intro}</Typography>}
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', mt: 0.25 }}>
            {l.items} 件{l.blocks ? ` · ${l.blocks} 块积木` : ''}{l.ready < l.items ? ` · 现在能摆 ${l.ready} 件` : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75 }}>
            <Button size="small" variant="contained" disabled={!!busy || !usable(l)} onClick={() => void apply(l, 'replace')} sx={{ flex: 1, minWidth: 0 }}>
              {busy === l.key + 'replace' ? <CircularProgress size={14} /> : '换成这样'}
            </Button>
            <Button size="small" disabled={!!busy || !usable(l)} onClick={() => void apply(l, 'add')} sx={{ flex: 1, minWidth: 0, color: '#9be8ff' }}>
              {busy === l.key + 'add' ? <CircularProgress size={14} /> : '加进来'}
            </Button>
          </Box>
          {l.mine && (
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
              <Button size="small" onClick={() => void togglePublic(l)} sx={{ minWidth: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>{l.visibility === 'public' ? '改成只有我用' : '公开给别人'}</Button>
              <Button size="small" onClick={() => void remove(l)} sx={{ minWidth: 0, fontSize: 11.5, color: '#ffb0b0' }}>删</Button>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}
