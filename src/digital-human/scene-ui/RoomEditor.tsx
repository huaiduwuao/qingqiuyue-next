/**
 * scene-ui/RoomEditor.tsx — 创世:布置自己的房间
 *
 *   - 素材抽屉:平台目录 + 自己传的 + 别人公开的,按大类筛、按名字搜;点一下摆在面前并选中;
 *     还没加工的(Poly Haven 目录里的)点了先排队现做,场景里先放一团光,做好了自动换成实物;
 *   - 选中一件(在场景里点它):脚下一圈高亮 + gizmo(移动:只在地面上拖;旋转:只绕竖轴),
 *     松手就存;工具条上有转 ±15°、大小、贴地、复制、删除;
 *   - 撤销 / 重做(Ctrl+Z / Ctrl+Y),Delete 删、Esc 取消选中;
 *   - 数字人「言出法随」摆的东西和手摆的是同一张表,这里一样能挪能删。
 *   - 八期:抽屉卡片带缩略图;拖动默认吸附(0.25 米格、15°),工具条上能关;「设为封面」按当前画面截一张传上去。
 */

import React from 'react';
import { Box, Button, ButtonBase, Chip, CircularProgress, IconButton, Slider, TextField, Tooltip, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import RedoRoundedIcon from '@mui/icons-material/RedoRounded';
import { assetBytes, browseAssets, deleteMyAsset, fetchWorldAsset, uploadRoomCover, worldFileUrl, type WorldAssetFull, type WorldPlacement } from '@/apis/world';
import type { VrmStageHandle } from '../VrmStage';
import { roomBounds, type WorldDef } from '../vrm/world/worldLayout';
import { WorldUpload } from './WorldUpload';
import { RoomLayouts } from './RoomLayouts';
import { EntityPanel, KindsDrawer } from './RoomEntities';

type Objects = {
  items: WorldPlacement[];
  placeAsset: (a: WorldAssetFull, at?: { x: number; z: number; rotY?: number }) => Promise<WorldPlacement | null>;
  patchItem: (id: string, patch: { x?: number; y?: number; z?: number; rotY?: number; scale?: number; label?: string }) => Promise<boolean>;
  removeItem: (id: string) => Promise<WorldPlacement | null>;
  restoreItem: (p: WorldPlacement) => Promise<WorldPlacement | null>;
  /** 世界模型:按原型放、改实体 */
  placeKind?: (kind: string, name: string, at?: { x: number; z: number; rotY?: number }) => Promise<WorldPlacement | null>;
  patchEntity?: (id: string, patch: { state?: Record<string, unknown>; rules?: WorldPlacement['rules']; tags?: string[] }) => Promise<void>;
};

type Pose = { x: number; y: number; z: number; rotY: number; scale: number };
type Op =
  | { t: 'pose'; id: string; before: Pose; after: Pose }
  | { t: 'add'; id: string; snap: WorldPlacement }
  | { t: 'remove'; id: string; snap: WorldPlacement };

const GROUPS: { label: string; cats: string }[] = [
  { label: '全部', cats: '' },
  { label: '家具', cats: 'furniture,seating,table,shelves' },
  { label: '装饰', cats: 'decorative,vases,wall decoration,containers' },
  { label: '灯', cats: 'lighting' },
  { label: '植物', cats: 'plants,nature,grass' },
  { label: '石头', cats: 'rocks' },
  { label: '器物', cats: 'props,tools,food,appliances,electronics' },
  { label: '建筑', cats: 'structures,building,industrial' },
];

const glass = { bgcolor: 'rgba(10,12,24,0.78)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' } as const;

/** 八期:拖动吸附 —— 移动按 0.25 米的格,转向按 15° */
export const SNAP_MOVE = 0.25;
export const SNAP_TURN = Math.PI / 12;

/** data URL → Blob(截的封面图) */
function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',', 2);
  const mime = /data:([^;]+)/.exec(head)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

const poseOf = (p: WorldPlacement): Pose => ({ x: p.x, y: p.y, z: p.z, rotY: p.rotY, scale: p.scale || 1 });
const fmtSize = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)}MB` : b > 0 ? `${Math.round(b / 1024)}KB` : '');

function statusBadge(a: WorldAssetFull): { text: string; color: string } | null {
  if (a.status === 'ready') return null;
  if (a.status === 'processing') return { text: '加工中', color: '#ffd27a' };
  if (a.status === 'available') return { text: '现做', color: '#9be8ff' };
  return { text: a.status, color: '#ff9b9b' };
}

export interface RoomEditorProps {
  handle: VrmStageHandle | null;
  def: WorldDef;
  objects: Objects & { reload?: () => void };
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  toast: (icon: string, text: string) => void;
  narrow?: boolean;
  /** 八期:封面换好了 */
  onCover?: (cover: string) => void;
  /** 十一期:套了样板间 / 撤销以后(重读房间外壳) */
  onLayoutApplied?: () => void;
}

/** 房间预算:件数 / 要下载多大(同一件素材只算一次,和服务端 maxRoomBytes 一致) */
export const ROOM_MAX_ITEMS = 200;
export const ROOM_MAX_MB = 30;
export function roomUsage(items: WorldPlacement[]): { n: number; mb: number } {
  const seen = new Map<string, number>();
  for (const p of items) if (!seen.has(p.assetKey)) seen.set(p.assetKey, assetBytes(p.asset));
  let bytes = 0;
  seen.forEach((b) => { bytes += b; });
  return { n: items.length, mb: bytes / (1 << 20) };
}

function RoomBudget({ items }: { items: WorldPlacement[] }) {
  const { n, mb } = roomUsage(items);
  const tight = n >= ROOM_MAX_ITEMS * 0.9 || mb >= ROOM_MAX_MB * 0.9;
  return (
    <Typography title="一间房最多 200 件、加起来 30 MB(同一件摆几份只算一次);超了摆不进去" sx={{ fontSize: 11, color: tight ? '#ffb07a' : 'rgba(255,255,255,0.4)', ml: 'auto', alignSelf: 'center', whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {n} / {ROOM_MAX_ITEMS} 件 · {mb.toFixed(1)} / {ROOM_MAX_MB} MB
    </Typography>
  );
}

export function RoomEditor({ handle, def, objects, selectedId, onSelect, onClose, toast, narrow, onCover, onLayoutApplied }: RoomEditorProps) {
  // 十一期:空房间默认打开样板间
  const [tab, setTab] = React.useState<'lib' | 'mine' | 'tpl' | 'kind'>(() => (objects.items.length === 0 ? 'tpl' : 'lib'));
  const [group, setGroup] = React.useState(0);
  const [q, setQ] = React.useState('');
  const [qLive, setQLive] = React.useState('');
  const [list, setList] = React.useState<WorldAssetFull[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [mode, setMode] = React.useState<'translate' | 'rotate'>('translate');
  const [placing, setPlacing] = React.useState<string | null>(null);
  const [snap, setSnap] = React.useState(true);
  const [covering, setCovering] = React.useState(false);
  const undoRef = React.useRef<Op[]>([]);
  const redoRef = React.useRef<Op[]>([]);
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  const objectsRef = React.useRef(objects);
  objectsRef.current = objects;
  const bounds = roomBounds(def) ?? { hx: 8, hz: 8 };
  const boundsRef = React.useRef(bounds);
  boundsRef.current = bounds;

  const selected = selectedId ? objects.items.find((p) => p.id === selectedId) ?? null : null;

  // 搜索框防抖
  React.useEffect(() => { const t = window.setTimeout(() => setQ(qLive.trim()), 300); return () => window.clearTimeout(t); }, [qLive]);
  React.useEffect(() => { setPage(1); }, [tab, group, q]);
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await browseAssets({ kind: 'model', category: tab === 'lib' ? GROUPS[group].cats : undefined, q: q || undefined, mine: tab === 'mine', page, size: 30 });
      setList((cur) => (page === 1 ? r.list : [...cur, ...r.list]));
      setTotal(r.total);
    } catch {
      if (page === 1) setList([]);
    } finally {
      setLoading(false);
    }
  }, [tab, group, q, page]);
  React.useEffect(() => { void load(); }, [load]);

  const push = (op: Op) => { undoRef.current.push(op); if (undoRef.current.length > 60) undoRef.current.shift(); redoRef.current = []; bump(); };
  /** 删了又恢复的会换 id:旧 id → 新 id,撤销栈里的记录按它找 */
  const remapRef = React.useRef(new Map<string, string>());
  const live = (id: string) => { let x = id; for (let i = 0; i < 10 && remapRef.current.has(x); i++) x = remapRef.current.get(x)!; return x; };

  const clampPose = (x: number, z: number) => {
    const b = boundsRef.current;
    return { x: Math.max(-b.hx + 0.2, Math.min(b.hx - 0.2, x)), z: Math.max(-b.hz + 0.2, Math.min(b.hz - 0.2, z)) };
  };

  const setPose = React.useCallback(async (id: string, before: Pose, after: Pose, record = true) => {
    const ok = await objectsRef.current.patchItem(id, { x: after.x, y: after.y, z: after.z, rotY: after.rotY, scale: after.scale });
    if (ok && record) push({ t: 'pose', id, before, after });
    return ok;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── gizmo:选中的那件挂一个 TransformControls
  React.useEffect(() => {
    if (!handle || !selectedId) { handle?.selectPlacement(null); return; }
    handle.selectPlacement(selectedId);
    const three = handle.getThree();
    const g = handle.getPlacementGroup(selectedId);
    if (!three || !g) return;
    let alive = true;
    let tc: any = null;
    let helper: any = null;
    let before: Pose | null = null;
    const canvas = three.canvas;
    import('three/examples/jsm/controls/TransformControls.js').then(({ TransformControls }) => {
      if (!alive) return;
      tc = new TransformControls(three.camera, canvas);
      tc.setMode(mode);
      tc.setSize(narrow ? 1.2 : 0.9);
      tc.setTranslationSnap(snap ? SNAP_MOVE : null);
      tc.setRotationSnap(snap ? SNAP_TURN : null);
      if (mode === 'translate') { tc.showY = false; } else { tc.showX = false; tc.showZ = false; }
      tc.attach(g);
      helper = tc.getHelper();
      helper.userData.noCapture = true;
      three.scene.add(helper);
      tc.addEventListener('mouseDown', () => {
        canvas.dataset.gizmo = '1';
        const p = objectsRef.current.items.find((x) => x.id === selectedId);
        before = p ? poseOf(p) : null;
      });
      tc.addEventListener('dragging-changed', (e: { value: boolean }) => { if (three.controls) three.controls.enabled = !e.value; });
      tc.addEventListener('objectChange', () => {
        // 拖出房间之外就收回来
        const c = clampPose(g.position.x, g.position.z);
        g.position.x = c.x; g.position.z = c.z;
      });
      tc.addEventListener('mouseUp', () => {
        window.setTimeout(() => { delete canvas.dataset.gizmo; }, 0);
        if (!before) return;
        const after: Pose = { ...before, x: +g.position.x.toFixed(3), z: +g.position.z.toFixed(3), rotY: +g.rotation.y.toFixed(4) };
        if (Math.abs(after.x - before.x) + Math.abs(after.z - before.z) + Math.abs(after.rotY - before.rotY) < 1e-3) return;
        void setPose(selectedId, before, after);
        before = null;
      });
    });
    return () => {
      alive = false;
      if (tc) { tc.detach(); tc.dispose(); }
      if (helper) three.scene.remove(helper);
      if (three.controls) three.controls.enabled = true;
      delete canvas.dataset.gizmo;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, selectedId, mode, narrow, snap]);
  // 关掉编辑器:取消选中
  React.useEffect(() => () => { handle?.selectPlacement(null); }, [handle]);

  const place = async (a: WorldAssetFull) => {
    if (placing) return;
    setPlacing(a.key);
    try {
      let asset = a;
      if (a.status === 'available') {
        try {
          const f = await fetchWorldAsset(a.key);
          asset = { ...a, status: f.status };
          toast('🛠️', `「${a.nameZh}」开始现做,先放一团光占位`);
        } catch (e: any) {
          toast('⚠️', e?.message || '现做排不上队');
          return;
        }
      }
      const p = await objects.placeAsset(asset);
      if (p) { push({ t: 'add', id: p.id, snap: p }); onSelect(p.id); }
    } finally {
      setPlacing(null);
    }
  };

  const remove = async (id: string) => {
    const p = await objects.removeItem(id);
    if (p) { push({ t: 'remove', id, snap: p }); if (selectedId === id) onSelect(null); }
  };

  const duplicate = async (p: WorldPlacement) => {
    if (!p.asset) return;
    const c = clampPose(p.x + 0.6, p.z + 0.3);
    const n = await objects.placeAsset(p.asset as WorldAssetFull, { x: c.x, z: c.z, rotY: p.rotY });
    if (n) {
      if ((p.scale || 1) !== 1) await objects.patchItem(n.id, { scale: p.scale });
      push({ t: 'add', id: n.id, snap: { ...n, scale: p.scale } });
      onSelect(n.id);
    }
  };

  const undo = async () => {
    const op = undoRef.current.pop();
    if (!op) return;
    if (op.t === 'pose') await setPose(live(op.id), op.after, op.before, false);
    else if (op.t === 'add') { await objects.removeItem(live(op.id)); onSelect(null); }
    else { const n = await objects.restoreItem(op.snap); if (n) remapRef.current.set(live(op.id), n.id); }
    redoRef.current.push(op);
    bump();
  };
  const redo = async () => {
    const op = redoRef.current.pop();
    if (!op) return;
    if (op.t === 'pose') await setPose(live(op.id), op.before, op.after, false);
    else if (op.t === 'add') { const n = await objects.restoreItem(op.snap); if (n) remapRef.current.set(live(op.id), n.id); }
    else await objects.removeItem(live(op.id));
    undoRef.current.push(op);
    bump();
  };

  // 快捷键:Delete 删、Esc 取消选中、Ctrl+Z / Ctrl+Y(Ctrl+Shift+Z)撤销重做、R 切换移动 / 旋转
  const keyRef = React.useRef({ undo, redo, remove, selectedId, onSelect, onClose });
  keyRef.current = { undo, redo, remove, selectedId, onSelect, onClose };
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = keyRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); void (e.shiftKey ? k.redo() : k.undo()); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); void k.redo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (k.selectedId) { e.preventDefault(); void k.remove(k.selectedId); } return; }
      if (e.key === 'Escape') { if (k.selectedId) k.onSelect(null); else k.onClose(); return; }
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey && k.selectedId) setMode((m) => (m === 'translate' ? 'rotate' : 'translate'));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 八期:当前画面截一张当房间封面(选中圈和 gizmo 不进画面)
  const takeCover = async () => {
    if (!handle || covering) return;
    const url = handle.captureFrame(640);
    if (!url) { toast('⚠️', '这台设备截不了画面'); return; }
    setCovering(true);
    try {
      const r = await uploadRoomCover(dataUrlToBlob(url));
      onCover?.(r.cover);
      toast('📷', '封面换好了,串门列表里大家看到的就是这一幕');
    } catch (e: any) {
      toast('⚠️', e?.message || '封面没传上去');
    } finally {
      setCovering(false);
    }
  };

  const rotateBy = (deg: number) => {
    if (!selected) return;
    const before = poseOf(selected);
    void setPose(selected.id, before, { ...before, rotY: +(before.rotY + (deg * Math.PI) / 180).toFixed(4) });
  };
  const [scaleDraft, setScaleDraft] = React.useState<number | null>(null);
  React.useEffect(() => { setScaleDraft(null); }, [selectedId]);

  const panelSx = narrow
    ? { position: 'absolute' as const, zIndex: 5, left: 8, right: 8, bottom: 'calc(min(46vh, 460px) + 64px)', maxHeight: '38vh' }
    : { position: 'absolute' as const, zIndex: 5, right: 16, top: 'calc(64px + var(--sat, 0px))', width: 330, maxHeight: 'calc(100vh - min(40vh, 400px) - 96px)' };

  return (
    <Box sx={{ ...panelSx, ...glass, borderRadius: 3, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, pt: 1.25, pb: 0.75 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 800, flex: 1 }}>🛠️ 布置房间</Typography>
        <Tooltip title="把现在看到的画面设为房间封面(先转好镜头)">
          <span><Button size="small" disabled={covering || !handle} onClick={() => void takeCover()} sx={{ minWidth: 0, px: 1, color: '#9be8ff', fontSize: 12 }}>{covering ? <CircularProgress size={14} /> : '📷 封面'}</Button></span>
        </Tooltip>
        <Tooltip title="撤销(Ctrl+Z)"><span><IconButton size="small" disabled={!undoRef.current.length} onClick={() => void undo()} sx={{ color: '#fff' }}><UndoRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="重做(Ctrl+Y)"><span><IconButton size="small" disabled={!redoRef.current.length} onClick={() => void redo()} sx={{ color: '#fff' }}><RedoRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
        <Button size="small" variant="contained" onClick={onClose} sx={{ ml: 0.5, minWidth: 0, px: 1.5 }}>完成</Button>
      </Box>

      {selected ? (
        <Box sx={{ mx: 1.5, mb: 1, p: 1.25, borderRadius: 2, bgcolor: 'rgba(37,244,238,0.08)', border: '1px solid rgba(37,244,238,0.35)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selected.label || selected.asset?.nameZh || selected.assetKey}
            </Typography>
            <IconButton size="small" aria-label="取消选中" onClick={() => onSelect(null)} sx={{ color: 'rgba(255,255,255,0.6)' }}><CloseRoundedIcon fontSize="small" /></IconButton>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
            <Chip size="small" label="移动" color={mode === 'translate' ? 'primary' : 'default'} onClick={() => setMode('translate')} sx={{ color: '#fff' }} />
            <Chip size="small" label="旋转" color={mode === 'rotate' ? 'primary' : 'default'} onClick={() => setMode('rotate')} sx={{ color: '#fff' }} />
            <Chip size="small" label={snap ? '吸附 开' : '吸附 关'} variant={snap ? 'filled' : 'outlined'} onClick={() => setSnap((v) => !v)} sx={{ color: '#fff' }} />
            <Chip size="small" label="↺ 15°" onClick={() => rotateBy(15)} sx={{ color: '#fff' }} />
            <Chip size="small" label="↻ 15°" onClick={() => rotateBy(-15)} sx={{ color: '#fff' }} />
            <Chip size="small" label="贴地" onClick={() => { const b = poseOf(selected); if (b.y !== 0) void setPose(selected.id, b, { ...b, y: 0 }); }} sx={{ color: '#fff' }} />
            <Chip size="small" label="复制" onClick={() => void duplicate(selected)} sx={{ color: '#fff' }} />
            <Chip size="small" label="删除" onClick={() => void remove(selected.id)} sx={{ color: '#ffb0b0' }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>大小</Typography>
            <Slider
              size="small" min={-1.3} max={1.3} step={0.01}
              value={Math.log(scaleDraft ?? (selected.scale || 1))}
              onChange={(_, v) => {
                const s = +Math.exp(v as number).toFixed(3);
                setScaleDraft(s);
                handle?.upsertPlacement({ id: selected.id, assetKey: selected.assetKey, label: selected.label, x: selected.x, y: selected.y, z: selected.z, rotY: selected.rotY, scale: s, status: selected.asset?.status ?? 'ready', nameZh: selected.asset?.nameZh, isSet: selected.asset?.isSet, height: selected.asset?.height, file: selected.asset?.file || undefined, normalize: selected.asset?.source === 'upload' });
              }}
              onChangeCommitted={(_, v) => {
                const s = +Math.max(0.1, Math.min(10, Math.exp(v as number))).toFixed(3);
                const b = poseOf(selected);
                void setPose(selected.id, b, { ...b, scale: s }).then(() => setScaleDraft(null));
              }}
            />
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', width: 36, textAlign: 'right' }}>×{(scaleDraft ?? (selected.scale || 1)).toFixed(2)}</Typography>
          </Box>
          {(selected.kind || (selected.rules?.length ?? 0) > 0) && objects.patchEntity && (
            <EntityPanel item={selected} onSave={(patch) => objects.patchEntity!(selected.id, patch)} />
          )}
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mt: 0.5 }}>拖箭头挪动 / 拖圆环转向{snap ? '(按 0.25 米、15° 吸附)' : ''} · R 切换 · Delete 删除 · Esc 取消</Typography>
        </Box>
      ) : (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', px: 1.5, mb: 1 }}>
          点下面的东西摆到面前;在房间里点一件东西可以挪、转、缩放。也可以直接对她说「窗边放个书架」。
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1, px: 1.5, mb: 0.75 }}>
        {(['lib', 'kind', 'tpl', 'mine'] as const).map((t) => (
          <ButtonBase key={t} onClick={() => setTab(t)} sx={{ px: 1, py: 0.4, whiteSpace: 'nowrap', flexShrink: 0, borderRadius: 999, fontSize: 12, fontWeight: 700, bgcolor: tab === t ? 'rgba(37,244,238,0.18)' : 'rgba(255,255,255,0.06)', color: tab === t ? '#25F4EE' : 'rgba(255,255,255,0.75)' }}>
            {t === 'lib' ? '素材库' : t === 'kind' ? '机关' : t === 'tpl' ? '样板间' : '我的上传'}
          </ButtonBase>
        ))}
        <RoomBudget items={objects.items} />
      </Box>

      {tab === 'lib' && objects.items.length === 0 && (
        <ButtonBase onClick={() => setTab('tpl')} sx={{ mx: 1.5, mb: 0.75, px: 1, py: 0.6, borderRadius: 2, bgcolor: 'rgba(255,210,122,0.1)', color: '#ffd27a', fontSize: 12, textAlign: 'left', display: 'block' }}>
          🏡 房间还空着 —— 先从样板间挑一套,再慢慢改?
        </ButtonBase>
      )}
      {tab === 'tpl' || tab === 'kind' ? null : tab === 'lib' ? (
        <>
          <Box sx={{ px: 1.5, mb: 0.75 }}>
            <TextField size="small" fullWidth placeholder="搜:椅子、灯笼、lamp…" value={qLive} onChange={(e) => setQLive(e.target.value)}
              slotProps={{ htmlInput: { sx: { color: '#fff', fontSize: 13, py: 0.75 } } }} sx={{ '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, px: 1.5, mb: 0.75, overflowX: 'auto', flexShrink: 0, '&::-webkit-scrollbar': { display: 'none' } }}>
            {GROUPS.map((g, i) => (
              <Chip key={g.label} size="small" label={g.label} onClick={() => setGroup(i)} color={group === i ? 'primary' : 'default'} sx={{ color: '#fff', flexShrink: 0 }} />
            ))}
          </Box>
        </>
      ) : (
        <Box sx={{ px: 1.5, mb: 0.75 }}>
          <WorldUpload kind="model" label="上传模型" compact={narrow} toast={toast} onUploaded={(a) => { setList((cur) => [a, ...cur]); void place(a); }} />
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 80, overflowY: 'auto', overflowX: 'hidden', px: 1.5, pb: 1.25 }}>
        {tab === 'tpl' && <RoomLayouts toast={toast} narrow={narrow} onApplied={() => { onSelect(null); objects.reload?.(); onLayoutApplied?.(); }} />}
        {tab === 'kind' && (
          <KindsDrawer toast={toast} onPlace={(k) => {
            if (!objects.placeKind) return;
            void objects.placeKind(k.key, k.name || k.key).then((p) => { if (p) { push({ t: 'add', id: p.id, snap: p }); onSelect(p.id); } });
          }} />
        )}
        <Box sx={{ display: tab === 'tpl' || tab === 'kind' ? 'none' : 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.75 }}>
          {list.map((a) => {
            const badge = statusBadge(a);
            return (
              <ButtonBase
                key={a.key}
                onClick={() => void place(a)}
                disabled={!!placing}
                sx={{ display: 'block', textAlign: 'left', p: 1, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)', '&:hover': { bgcolor: 'rgba(37,244,238,0.1)' }, position: 'relative' }}
              >
                <Box sx={{ height: narrow ? 64 : 84, mb: 0.5, borderRadius: 1.5, display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'radial-gradient(circle at 50% 60%, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 70%)' }}>
                  {a.thumb
                    ? <Box component="img" src={worldFileUrl(a.thumb)} alt="" loading="lazy" draggable={false} sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', opacity: a.status === 'ready' ? 1 : 0.75 }} />
                    : <Typography sx={{ fontSize: 26, opacity: 0.35 }}>📦</Typography>}
                </Box>
                <Typography sx={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nameZh}</Typography>
                <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[a.source === 'upload' ? (tab === 'mine' ? (a.visibility === 'public' ? '已公开' : '仅自己') : '用户上传') : null, a.height ? `高 ${a.height.toFixed(1)}m` : null, fmtSize(a.bytes)].filter(Boolean).join(' · ')}
                </Typography>
                {badge && <Box sx={{ position: 'absolute', top: 6, right: 6, fontSize: 10, color: badge.color, border: `1px solid ${badge.color}88`, borderRadius: 1, px: 0.4 }}>{badge.text}</Box>}
                {placing === a.key && <CircularProgress size={14} sx={{ position: 'absolute', bottom: 6, right: 6 }} />}
                {tab === 'mine' && (
                  <Box
                    component="span"
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!window.confirm(`删掉「${a.nameZh}」?房间里摆着的也会一起收掉`)) return;
                      deleteMyAsset(a.key).then(() => { setList((cur) => cur.filter((x) => x.key !== a.key)); toast('🗑️', '删掉了'); }).catch((err) => toast('⚠️', err?.message || '删不掉'));
                    }}
                    sx={{ position: 'absolute', bottom: 4, right: 6, fontSize: 11, color: 'rgba(255,160,160,0.8)' }}
                  >删除</Box>
                )}
              </ButtonBase>
            );
          })}
        </Box>
        {tab !== 'tpl' && tab !== 'kind' && loading && <Box sx={{ display: 'grid', placeItems: 'center', py: 1.5 }}><CircularProgress size={18} /></Box>}
        {tab !== 'tpl' && tab !== 'kind' && !loading && list.length === 0 && (
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'center', py: 2 }}>
            {tab === 'mine' ? '还没传过模型' : '没找到,换个说法试试'}
          </Typography>
        )}
        {tab !== 'tpl' && tab !== 'kind' && !loading && list.length < total && (
          <Button fullWidth size="small" onClick={() => setPage((p) => p + 1)} sx={{ mt: 1, color: '#9be8ff' }}>再看 {Math.min(30, total - list.length)} 件</Button>
        )}
      </Box>
    </Box>
  );
}
