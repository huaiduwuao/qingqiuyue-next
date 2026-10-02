/**
 * scene-ui/BuildPanel.tsx — 创世十二期:搭积木
 *
 * 打开后点击画面不再走路,交给这里:
 *   - 放:点哪块积木的哪一面,就在那一面外面放一块;点地面就放在地上那一格;
 *   - 拆:点哪块拆哪块;吸色:点一块,把它的形状 / 材质 / 颜色 / 朝向拿来接着用;
 *   - 框铺 / 框拆:点第一下定一个角,再点第二下定对角,中间整块铺满(最多 512 格)或者拆光;
 * 鼠标移动时预览框跟着(青色 = 放,红色 = 拆)。R 转向,Ctrl+Z / Ctrl+Y 撤销重做,Esc 收起。
 * 拖动还是转镜头;只有「按下抬起没怎么动」才算点。手机上同样点一下放一块。
 *
 * 「地形」那一页:先铺一张地形(高度场,默认草),再用笔刷点:抬高 / 压低 / 铲平 / 抹平 / 涂物质(用下面选的材质);
 * 半径、力度可调,鼠标下面有个圈预览笔刷。改地形走服务端(go worldapp/terrain.go),房里的人一起看到。
 */

import React from 'react';
import { Box, Button, ButtonBase, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import RedoRoundedIcon from '@mui/icons-material/RedoRounded';
import type { VrmStageHandle } from '../VrmStage';
import { BLOCK_MAX_ROOM, BLOCK_MAX_Y, SHAPES, fillOps, type BlockOp } from '../vrm/world/blocks';
import type { BlockHit } from '../vrm/world/blockLayer';
import { matColor, onMaterials, pickableMaterials } from '../vrm/world/materials';
import { ensureMaterials, type BlocksState } from './useBlocks';
import { RoomMaterials } from './RoomMaterials';

type Tool = 'place' | 'erase' | 'pick' | 'fill' | 'clear';
const TOOLS: { id: Tool; label: string; tip: string }[] = [
  { id: 'place', label: '放', tip: '点积木的一面接着放,点地面放在地上' },
  { id: 'erase', label: '拆', tip: '点哪块拆哪块' },
  { id: 'pick', label: '吸色', tip: '点一块,拿它的形状、材质和颜色接着用' },
  { id: 'fill', label: '框铺', tip: '点两下定两个角,中间铺满(最多 512 格)' },
  { id: 'clear', label: '框拆', tip: '点两下定两个角,中间的都拆掉' },
];
const COLORS = [0xffffff, 0xe8e2d6, 0xd8cbb0, 0x9a9a96, 0x3a3a3e, 0xa0703c, 0x6b4423, 0xa84a32, 0xd9534f, 0xf0ad4e, 0xffd98a, 0x6aa84f, 0x2e7d5b, 0x5bc0de, 0x3b6fb6, 0x8a5a9a];
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const glass = { bgcolor: 'rgba(10,12,24,0.8)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' } as const;

type Cell = { x: number; y: number; z: number };

/** water / drain:点哪儿往哪儿的坑里倒水 / 把那一片抽掉(在液面那一栏里选) */
type TTool = 'raise' | 'lower' | 'flatten' | 'smooth' | 'paint' | 'water' | 'drain';
const TTOOLS: { id: TTool; label: string; tip: string; color: number }[] = [
  { id: 'raise', label: '抬高', tip: '点哪儿哪儿鼓起来', color: 0x7dffb0 },
  { id: 'lower', label: '压低', tip: '点哪儿哪儿往下压(最低到地板)', color: 0xffb27d },
  { id: 'flatten', label: '铲平', tip: '拉平到点的那一点的高度', color: 0x9be8ff },
  { id: 'smooth', label: '抹平', tip: '把坑坑洼洼抹圆', color: 0xd7b8ff },
  { id: 'paint', label: '涂', tip: '涂成下面选的材质', color: 0xffe27a },
];

/** 鼠标停在材质上时说一句它的物理属性 */
function matHint(p: { solid?: boolean; walkable?: boolean; liquid?: { slow?: number; float?: boolean } } | undefined): string {
  const out: string[] = [];
  if (p?.solid === false) out.push('能穿过去');
  else if (p?.walkable === false) out.push('站不上去');
  if (p?.liquid?.slow) out.push(`在里面走得慢`);
  if (p?.liquid?.float) out.push('深了浮起来');
  return out.join(',');
}

export function BuildPanel({ handle, blocks, onClose, narrow, toast }: {
  handle: VrmStageHandle | null;
  blocks: BlocksState;
  onClose: () => void;
  narrow?: boolean;
  toast: (icon: string, text: string) => void;
}) {
  const [tool, setTool] = React.useState<Tool>('place');
  const [shape, setShape] = React.useState(0);
  const [mat, setMat] = React.useState(1);
  const [color, setColor] = React.useState<number>(() => matColor(1));
  // 材质是数据(物质登记表):读到 / 换了跟着刷新
  const [mats, setMats] = React.useState(pickableMaterials);
  const [matsOpen, setMatsOpen] = React.useState(false);
  React.useEffect(() => {
    const off = onMaterials(() => setMats(pickableMaterials()));
    void ensureMaterials().then(() => setMats(pickableMaterials()));
    return off;
  }, []);
  const [rot, setRot] = React.useState(0);
  const [corner, setCorner] = React.useState<Cell | null>(null);
  // 地形
  const [mode, setMode] = React.useState<'blocks' | 'terrain'>('blocks');
  const [ttool, setTtool] = React.useState<TTool>('raise');
  const [radius, setRadius] = React.useState(1.5);
  const [strength, setStrength] = React.useState(0.3);
  const [waterLevel, setWaterLevel] = React.useState(-0.3);
  const [waterMat, setWaterMat] = React.useState(10);
  const stateRef = React.useRef({ tool, shape, mat, color, rot, corner, mode, ttool, radius, strength, waterLevel, waterMat });
  stateRef.current = { tool, shape, mat, color, rot, corner, mode, ttool, radius, strength, waterLevel, waterMat };
  const blocksRef = React.useRef(blocks);
  blocksRef.current = blocks;

  React.useEffect(() => { setCorner(null); }, [tool]);

  // 点到哪一格:放 / 框铺 → 打中那一面外面那格;拆 / 吸色 / 框拆 → 打中的那块
  const targetOf = (hit: BlockHit | null, t: Tool): Cell | null => {
    if (!hit) return null;
    if (t === 'place' || t === 'fill') return hit.place.y >= 0 && hit.place.y < BLOCK_MAX_Y ? hit.place : null;
    return hit.block ? { x: hit.block.x, y: hit.block.y, z: hit.block.z } : null;
  };

  React.useEffect(() => {
    if (!handle) return;
    const three = handle.getThree();
    if (!three) return;
    const canvas = three.canvas;
    handle.setBuilding(true);
    let down: { x: number; y: number; t: number; id: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const s = stateRef.current;
      if (s.mode === 'terrain') {
        handle.setBlockGhost(null);
        const p = blocksRef.current.hasTerrain ? handle.terrainPick(e.clientX, e.clientY) : null;
        const wet = s.ttool === 'water' || s.ttool === 'drain';
        handle.setTerrainBrush(p ? { x: p.x, z: p.z, r: wet ? 0.35 : s.radius, color: wet ? (s.ttool === 'water' ? 0x5ab8ff : 0xffb0b0) : TTOOLS.find((t) => t.id === s.ttool)?.color } : null);
        return;
      }
      handle.setTerrainBrush(null);
      const cell = targetOf(handle.blockPick(e.clientX, e.clientY), s.tool);
      const removing = s.tool === 'erase' || s.tool === 'clear';
      if ((s.tool === 'fill' || s.tool === 'clear') && s.corner) handle.setBlockGhost(s.corner, cell ?? s.corner, removing);
      else handle.setBlockGhost(cell, undefined, removing);
    };
    const onDown = (e: PointerEvent) => { if (e.button === 0) down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (!d || d.id !== e.pointerId || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 450) return;
      const s = stateRef.current;
      const b = blocksRef.current;
      if (s.mode === 'terrain') {
        if (!b.hasTerrain) { toast('⛰️', '先点「铺一张地形」'); return; }
        const p = handle.terrainPick(e.clientX, e.clientY);
        if (!p) return;
        if (s.ttool === 'water') void b.commitTerrain([{ tool: 'water', x: p.x, z: p.z, amount: s.waterLevel, mat: s.waterMat }]);
        else if (s.ttool === 'drain') void b.commitTerrain([{ tool: 'drain', x: p.x, z: p.z }]);
        else void b.commitTerrain([{ tool: s.ttool, x: p.x, z: p.z, r: s.radius, amount: s.strength, mat: s.ttool === 'paint' ? s.mat : undefined }]);
        return;
      }
      const hit = handle.blockPick(e.clientX, e.clientY);
      const cell = targetOf(hit, s.tool);
      if (!cell) return;
      const put = { s: s.shape, m: s.mat, c: s.color, r: s.rot };
      if (s.tool === 'place') {
        if (b.count >= BLOCK_MAX_ROOM) { toast('🧱', `这间房的积木满了(最多 ${BLOCK_MAX_ROOM} 块)`); return; }
        b.commit([[1, cell.x, cell.y, cell.z, put.s, put.m, put.c, put.r]]);
      } else if (s.tool === 'erase') {
        b.commit([[0, cell.x, cell.y, cell.z]]);
      } else if (s.tool === 'pick') {
        const blk = b.grid.get(cell.x, cell.y, cell.z);
        if (blk) { setShape(blk.s); setMat(blk.m); setColor(blk.c); setRot(blk.r); setTool('place'); }
      } else if (!s.corner) {
        setCorner(cell);
      } else {
        const ops = fillOps(s.corner, cell, s.tool === 'fill' ? put : null, b.grid);
        setCorner(null);
        handle.setBlockGhost(null);
        if (!ops) { toast('🧱', '框得太大了,一次最多 512 格'); return; }
        if (ops.length) b.commit(ops as BlockOp[]);
      }
      onMove(e);
    };
    const onLeave = () => { handle.setBlockGhost(null); handle.setTerrainBrush(null); };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    return () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      handle.setBuilding(false);
      handle.setBlockGhost(null);
      handle.setTerrainBrush(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  // 快捷键
  const keyRef = React.useRef({ undo: blocks.undo, redo: blocks.redo, onClose });
  keyRef.current = { undo: blocks.undo, redo: blocks.redo, onClose };
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = keyRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) k.redo(); else k.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); k.redo(); return; }
      if (e.key === 'Escape') { if (stateRef.current.corner) setCorner(null); else k.onClose(); return; }
      if (e.key.toLowerCase() === 'r' && !e.ctrlKey) setRot((r) => (r + 1) % 4);
      const n = Number(e.key);
      if (!e.ctrlKey && n >= 1 && n <= SHAPES.length) setShape(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const panelSx = narrow
    ? { position: 'absolute' as const, zIndex: 5, left: 8, right: 8, bottom: 'calc(min(46vh, 460px) + 64px)', maxHeight: '34vh' }
    : { position: 'absolute' as const, zIndex: 5, right: 16, top: 'calc(64px + var(--sat, 0px))', width: 320 };
  const cornerHint = corner ? `第一个角在 (${corner.x}, ${corner.y}, ${corner.z}),再点对角(Esc 取消)` : null;

  return (
    <Box sx={{ ...panelSx, ...glass, borderRadius: 3, p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.9, overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ display: 'flex', gap: 0.25, flex: 1 }}>
          {(['blocks', 'terrain'] as const).map((m) => (
            <ButtonBase key={m} onClick={() => setMode(m)} sx={{ fontSize: 14, fontWeight: 800, px: 1, py: 0.25, borderRadius: 2, bgcolor: mode === m ? 'rgba(37,244,238,0.2)' : 'transparent', color: mode === m ? '#fff' : 'rgba(255,255,255,0.55)' }}>
              {m === 'blocks' ? '🧱 积木' : '⛰️ 地形'}
            </ButtonBase>
          ))}
        </Box>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{blocks.count} / {BLOCK_MAX_ROOM}</Typography>
        <Tooltip title="撤销(Ctrl+Z)"><span><IconButton size="small" disabled={!blocks.canUndo} onClick={blocks.undo} sx={{ color: '#fff' }}><UndoRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="重做(Ctrl+Y)"><span><IconButton size="small" disabled={!blocks.canRedo} onClick={blocks.redo} sx={{ color: '#fff' }}><RedoRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
        <Button size="small" variant="contained" onClick={onClose} sx={{ minWidth: 0, px: 1.5 }}>完成</Button>
      </Box>

      {mode === 'terrain' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {!blocks.hasTerrain ? (
            <Button size="small" variant="contained" onClick={() => void blocks.commitTerrain([{ tool: 'init', mat }])}>⛰️ 铺一张地形(用下面选的材质)</Button>
          ) : (
            <>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {TTOOLS.map((t) => (
                  <Tooltip key={t.id} title={t.tip}>
                    <Chip size="small" label={t.label} color={ttool === t.id ? 'primary' : 'default'} onClick={() => setTtool(t.id)} sx={{ color: '#fff' }} />
                  </Tooltip>
                ))}
              </Box>
              {([['半径', radius, setRadius, 0.5, 4, 0.25, '米'], ['力度', strength, setStrength, 0.05, 1, 0.05, '米']] as const).map(([label, v, set, lo, hi, step, unit]) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12 }}>
                  <span style={{ width: 30, opacity: 0.6 }}>{label}</span>
                  <Box component="input" type="range" min={lo} max={hi} step={step} value={v} aria-label={label}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => set(Number(e.target.value))} sx={{ flex: 1 }} />
                  <span style={{ width: 44, textAlign: 'right' }}>{v.toFixed(2)} {unit}</span>
                </Box>
              ))}
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>点地形用笔刷;拖动还是转镜头。涂的时候用下面选的材质。压低最深挖到地板下 2 米。</Typography>
              <Box sx={{ p: 0.75, borderRadius: 1.5, bgcolor: 'rgba(58,143,208,0.12)', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 12 }}>
                  <span style={{ opacity: 0.75 }}>💧 液面</span>
                  <Box component="input" type="range" min={-2} max={3} step={0.1} aria-label="水面高度" value={waterLevel}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setWaterLevel(Number(e.target.value))} sx={{ flex: 1 }} />
                  <span style={{ width: 48, textAlign: 'right' }}>{waterLevel.toFixed(1)} 米</span>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                  <select aria-label="水面用的液体" value={waterMat} onChange={(e) => setWaterMat(Number(e.target.value))}
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 6, fontSize: 12, padding: '3px 6px' }}>
                    {mats.filter((m) => m.props?.liquid?.slow).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  {([['water', '倒水'], ['drain', '抽水']] as const).map(([id, label]) => (
                    <Chip key={id} size="small" label={label} color={ttool === id ? 'primary' : 'default'} onClick={() => setTtool(id)} sx={{ color: '#fff' }} />
                  ))}
                  {blocks.hasWater && <ButtonBase onClick={() => { if (window.confirm('把所有的水都抽干?')) void blocks.commitTerrain([{ tool: 'nowater' }]); }} sx={{ fontSize: 11.5, color: '#ffb0b0' }}>全抽干</ButtonBase>}
                </Box>
                <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)' }}>选「倒水」点一个坑,就把那个坑灌到这个高度;每个坑各是各的高度和液体(池塘、熔岩湖)。水会往低处流:挖开岸边它就流过去,往水里垫土它就涨。</Typography>
              </Box>
              <ButtonBase onClick={() => { if (window.confirm('铲掉整张地形,回到原来的地板?')) void blocks.removeTerrain(); }} sx={{ alignSelf: 'flex-start', fontSize: 11.5, color: '#ffb0b0' }}>铲掉整张地形</ButtonBase>
            </>
          )}
        </Box>
      )}

      {mode === 'blocks' && <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {TOOLS.map((t) => (
          <Tooltip key={t.id} title={t.tip}>
            <Chip size="small" label={t.label} color={tool === t.id ? 'primary' : 'default'} onClick={() => setTool(t.id)} sx={{ color: '#fff' }} />
          </Tooltip>
        ))}
      </Box>}

      {mode === 'blocks' && <Box>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', mb: 0.4 }}>形状(数字键 1–5) · 朝向 {rot * 90}°</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {SHAPES.map((s) => (
            <Tooltip key={s.id} title={s.name}>
              <ButtonBase onClick={() => setShape(s.id)} sx={{ width: 34, height: 34, borderRadius: 1.5, fontSize: 18, bgcolor: shape === s.id ? 'rgba(37,244,238,0.22)' : 'rgba(255,255,255,0.07)', border: shape === s.id ? '1px solid #25F4EE' : '1px solid transparent' }}>{s.icon}</ButtonBase>
            </Tooltip>
          ))}
          <Tooltip title="转 90°(R)"><ButtonBase onClick={() => setRot((r) => (r + 1) % 4)} sx={{ ml: 'auto', px: 1, height: 34, borderRadius: 1.5, fontSize: 12, bgcolor: 'rgba(255,255,255,0.07)' }}>↻ 转向</ButtonBase></Tooltip>
        </Box>
      </Box>}

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.4 }}>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', flex: 1 }}>材质</Typography>
          {blocks.mine && <ButtonBase onClick={() => setMatsOpen((v) => !v)} sx={{ fontSize: 11, color: '#9be8ff' }}>{matsOpen ? '收起' : '＋ 我的材质'}</ButtonBase>}
        </Box>
        <Box sx={narrow ? { display: 'flex', gap: 0.5, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } } : { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5 }}>
          {mats.map((m) => (
            <ButtonBase key={m.id} title={matHint(m.props)} onClick={() => { setMat(m.id); setColor(matColor(m.id)); }} sx={{ py: 0.5, flexShrink: 0, minWidth: narrow ? 48 : 0, borderRadius: 1.5, fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 0.25, bgcolor: mat === m.id ? 'rgba(37,244,238,0.18)' : 'rgba(255,255,255,0.05)', border: mat === m.id ? '1px solid #25F4EE' : '1px solid transparent' }}>
              <Box sx={{ width: 18, height: 18, borderRadius: 0.75, bgcolor: hex(matColor(m.id)), opacity: Math.max(0.3, m.look?.opacity ?? 1), boxShadow: m.look?.unlit ? `0 0 8px ${hex(matColor(m.id))}` : 'none' }} />
              {m.name}
            </ButtonBase>
          ))}
        </Box>
        {matsOpen && blocks.mine && (
          <Box sx={{ mt: 0.75, p: 0.75, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <RoomMaterials toast={toast} onSaved={() => { setMatsOpen(false); blocks.reload(); }} />
          </Box>
        )}
      </Box>

      <Box>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', mb: 0.4 }}>颜色</Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: narrow ? 'nowrap' : 'wrap', overflowX: narrow ? 'auto' : 'visible', alignItems: 'center', '&::-webkit-scrollbar': { display: 'none' } }}>
          {COLORS.map((c) => (
            <ButtonBase key={c} aria-label={hex(c)} onClick={() => setColor(c)} sx={{ width: 22, height: 22, flexShrink: 0, borderRadius: '50%', bgcolor: hex(c), border: color === c ? '2px solid #25F4EE' : '1px solid rgba(255,255,255,0.25)' }} />
          ))}
          <Box component="input" type="color" value={hex(color)} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(parseInt(e.target.value.slice(1), 16))} sx={{ width: 30, height: 24, p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer' }} />
        </Box>
      </Box>

      <Typography sx={{ fontSize: 11, color: cornerHint ? '#ffd27a' : 'rgba(255,255,255,0.45)' }}>
        {cornerHint ?? (narrow ? '点一下放一块;拖动转镜头' : '点击放 / 拆,拖动转镜头 · R 转向 · Ctrl+Z 撤销 · 能走上自己搭的台阶')}
      </Typography>
    </Box>
  );
}
