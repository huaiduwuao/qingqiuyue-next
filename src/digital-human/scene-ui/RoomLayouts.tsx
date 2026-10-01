/**
 * scene-ui/RoomLayouts.tsx — 创世十一期:样板间
 *
 * 布置抽屉里的「样板间」一栏:内置的几套布置(书斋茶席、阁楼会客、庭院小景……),
 * 「换成这样」= 原来的摆设和外壳先存一份、整个换掉(能撤销一次);「加进来」= 只往里加,外壳不动。
 * 还没做好的素材(目录里有、没加工)跳过,回来的结果里说跳过了几件。
 * 串门时 RoomPlate 上的「照着布置」走同一个接口(from = 房主)。
 */

import React from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { applyLayout, listLayouts, undoLayout, worldFileUrl, type ApplyLayoutResult, type WorldLayout } from '@/apis/world';

/** 套用结果说成一句话 */
export function layoutResultText(r: ApplyLayoutResult): string {
  if (!r.placed) return r.skipped ? `这一套里的东西还没做好,先跳过了 ${r.skipped} 件` : '没有能摆的东西';
  return `摆好了 ${r.placed} 件${r.skipped ? `,${r.skipped} 件还没做好先跳过` : ''}`;
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
  React.useEffect(() => {
    let alive = true;
    listLayouts().then((l) => { if (alive) setList(l); }).catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, []);

  const apply = async (l: WorldLayout, mode: 'replace' | 'add') => {
    if (busy) return;
    if (mode === 'replace' && !window.confirm(`把房间换成「${l.name}」?原来的摆设会先存一份,可以撤销。`)) return;
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

  if (!list) return <Box sx={{ display: 'grid', placeItems: 'center', py: 2 }}><CircularProgress size={18} /></Box>;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {canUndo && (
        <Button size="small" variant="outlined" disabled={!!busy} onClick={() => void undo()} sx={{ color: '#ffd27a', borderColor: 'rgba(255,210,122,0.5)' }}>
          {busy === 'undo' ? <CircularProgress size={14} /> : '↩ 撤销刚才的套用'}
        </Button>
      )}
      {list.map((l) => (
        <Box key={l.key} sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)' }}>
          <Box sx={{ display: 'flex', gap: 0.5, mb: 0.75, height: narrow ? 44 : 56 }}>
            {l.thumbs.map((t) => (
              <Box key={t} sx={{ flex: 1, minWidth: 0, borderRadius: 1, display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 50% 60%, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 70%)' }}>
                <Box component="img" src={worldFileUrl(t)} alt="" loading="lazy" draggable={false} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{l.name}</Typography>
          <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>{l.intro}</Typography>
          <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', mt: 0.25 }}>
            {l.items} 件{l.ready < l.items ? ` · 现在能摆 ${l.ready} 件` : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75 }}>
            <Button size="small" variant="contained" disabled={!!busy || !l.ready} onClick={() => void apply(l, 'replace')} sx={{ flex: 1, minWidth: 0 }}>
              {busy === l.key + 'replace' ? <CircularProgress size={14} /> : '换成这样'}
            </Button>
            <Button size="small" disabled={!!busy || !l.ready} onClick={() => void apply(l, 'add')} sx={{ flex: 1, minWidth: 0, color: '#9be8ff' }}>
              {busy === l.key + 'add' ? <CircularProgress size={14} /> : '加进来'}
            </Button>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
