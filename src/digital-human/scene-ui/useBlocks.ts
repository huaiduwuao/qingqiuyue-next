/**
 * scene-ui/useBlocks.ts — 创世十二期:房间里的积木(数据 + 同步 + 撤销)
 *
 *   - 进房间读一遍(GET /world/rooms/:uid/blocks,打包的二进制);换房间 / 收到 reload 重读;
 *   - 本地改:网格立刻改、画面立刻变,改动攒 120 毫秒一批发给服务端(一批最多 512 格);
 *     服务端拒了(权限、超额、太快)就提示并整个重读,以服务端为准;
 *   - 别人改的:edit {op: blocks, ops, by} 推过来,照着改;自己发的那份跳过(本地早改过了,再改一遍顺序可能乱);
 *   - 撤销 / 重做:每次本地改记下反操作,撤销 = 把反操作当一次新的改动发出去。
 */

import React from 'react';
import { editBlocks, getBlocks, listMaterials } from '@/apis/world';
import type { VrmStageHandle } from '../VrmStage';
import type { WorldDef } from '../vrm/world/worldLayout';
import { BLOCK_MAX_OPS, BlockGrid, decodeBlocks, type BlockOp } from '../vrm/world/blocks';
import { setMaterials } from '../vrm/world/materials';

let matsLoad: Promise<void> | null = null;
/** 物质(积木材质)登记表读一次;读失败下次再试 */
export function ensureMaterials(): Promise<void> {
  if (!matsLoad) matsLoad = listMaterials().then(setMaterials).catch(() => { matsLoad = null; });
  return matsLoad;
}

export interface UseBlocksOptions {
  handle: VrmStageHandle | null;
  def: WorldDef;
  enabled: boolean;
  /** 我的 uid(跳过自己发出去又推回来的那份) */
  me: string | null;
  toast: (icon: string, text: string) => void;
}

const FLUSH_MS = 120;
const UNDO_MAX = 100;

export function useBlocks(opts: UseBlocksOptions) {
  const { handle, def, enabled } = opts;
  const optsRef = React.useRef(opts);
  optsRef.current = opts;
  const owner = enabled && def.kind === 'room' ? def.room?.ownerId ?? null : null;
  const gridRef = React.useRef(new BlockGrid());
  const [count, setCount] = React.useState(0);
  const [canBuild, setCanBuild] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const undoRef = React.useRef<{ ops: BlockOp[]; inverse: BlockOp[] }[]>([]);
  const redoRef = React.useRef<{ ops: BlockOp[]; inverse: BlockOp[] }[]>([]);
  const [, bump] = React.useReducer((x: number) => x + 1, 0);
  const pendingRef = React.useRef<BlockOp[]>([]);
  const timerRef = React.useRef<number | null>(null);
  const ownerRef = React.useRef(owner);
  ownerRef.current = owner;

  const reload = React.useCallback(() => setTick((n) => n + 1), []);

  // 进房间 / 重读
  React.useEffect(() => {
    const grid = gridRef.current;
    if (!owner || !handle) {
      grid.clear();
      setCount(0);
      setCanBuild(false);
      setReady(false);
      handle?.setBlockGrid(null);
      return;
    }
    // 先清掉上一间房的,读回来之前不显示别人家的积木
    grid.clear();
    handle.setBlockGrid(grid);
    setCount(0);
    let alive = true;
    // 先有物质登记表再画(材质、能不能站都按它)
    Promise.all([getBlocks(owner), ensureMaterials()]).then(([r]) => {
      if (!alive) return;
      grid.load(decodeBlocks(r.blocks));
      handle.setBlockGrid(grid);
      setCount(grid.size);
      setCanBuild(!!r.canBuild);
      setReady(true);
    }).catch(() => {
      if (!alive) return;
      grid.clear();
      handle.setBlockGrid(grid);
      setReady(true);
    });
    return () => { alive = false; };
  }, [owner, handle, tick]);
  // 换房间:撤销记录作废
  React.useEffect(() => { undoRef.current = []; redoRef.current = []; pendingRef.current = []; bump(); }, [owner]);

  const flush = React.useCallback(() => {
    timerRef.current = null;
    const room = ownerRef.current;
    const ops = pendingRef.current;
    pendingRef.current = [];
    if (!room || !ops.length) return;
    for (let i = 0; i < ops.length; i += BLOCK_MAX_OPS) {
      editBlocks(room, ops.slice(i, i + BLOCK_MAX_OPS)).catch((e: unknown) => {
        optsRef.current.toast('🧱', (e as Error)?.message || '没存上');
        reload();
      });
    }
  }, [reload]);

  /** 本地改一批(记撤销) */
  const commit = React.useCallback((ops: BlockOp[], record = true) => {
    if (!ops.length || !ownerRef.current) return;
    const grid = gridRef.current;
    const inverse = grid.apply(ops);
    optsRef.current.handle?.applyBlockOps(ops);
    setCount(grid.size);
    if (record) {
      undoRef.current.push({ ops, inverse });
      if (undoRef.current.length > UNDO_MAX) undoRef.current.shift();
      redoRef.current = [];
      bump();
    }
    pendingRef.current.push(...ops);
    if (timerRef.current === null) timerRef.current = window.setTimeout(flush, FLUSH_MS);
  }, [flush]);

  const undo = React.useCallback(() => {
    const e = undoRef.current.pop();
    if (!e) return;
    commit(e.inverse, false);
    redoRef.current.push(e);
    bump();
  }, [commit]);
  const redo = React.useCallback(() => {
    const e = redoRef.current.pop();
    if (!e) return;
    commit(e.ops, false);
    undoRef.current.push(e);
    bump();
  }, [commit]);

  /** 别人改的(房间连接推过来) */
  const applyRemote = React.useCallback((data: unknown) => {
    const d = data as { ops?: BlockOp[]; by?: string } | null;
    if (!d?.ops?.length) return;
    if (d.by && d.by === optsRef.current.me) return;
    gridRef.current.apply(d.ops);
    optsRef.current.handle?.applyBlockOps(d.ops);
    setCount(gridRef.current.size);
  }, []);

  React.useEffect(() => () => { if (timerRef.current !== null) { window.clearTimeout(timerRef.current); flush(); } }, [flush]);

  return {
    owner, ready, count, canBuild, grid: gridRef.current,
    commit, undo, redo, canUndo: undoRef.current.length > 0, canRedo: redoRef.current.length > 0,
    applyRemote, reload,
  };
}

export type BlocksState = ReturnType<typeof useBlocks>;
