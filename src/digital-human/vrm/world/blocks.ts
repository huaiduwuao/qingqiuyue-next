/**
 * vrm/world/blocks.ts — 创世十二期:积木的数据(纯函数,不碰 three)
 *
 * 房间按 0.5 米一格:格子 (x, y, z) 占 [x·S, (x+1)·S) × [y·S, (y+1)·S) × [z·S, (z+1)·S),y 从地面 0 往上(最高 32 格)。
 * 形状:0 方块 / 1 半砖(下半格)/ 2 斜坡(朝 rot 那边往上)/ 3 薄墙(rot 0、2 沿 x,1、3 沿 z)/ 4 柱子。
 * 材质 = 物质的 id(数据,见 materials.ts:灰墙、木、石……水、冰、沙);颜色 0xRRGGBB 乘在材质纹理上。
 *
 * 走路:方块、半砖、斜坡的顶面能站;一步能迈上 0.55 米(正好一格),再高就挡路;薄墙、柱子只挡路不能站。
 * 物质的属性也算数:solid = false(水)穿得过去、不挡也站不上;walkable = false 站不上去(和墙一样挡);
 * liquid.slow 人泡在里面走得慢(slowAt);liquid.float 深的液体里人浮在液面下 FLOAT_DEPTH 米(脚),
 * 泡在液体里时一步能迈 SWIM_STEP 米 —— 游到岸边能爬上去;liquid.flow 泡在里面会被冲着走(flowAt,方向 = 那块的朝向)。
 * 发光的物质(emits)照亮周围:相邻的发光积木按 2 米一簇合成一个候选光源(glowLights),和灯一起抢光源池。
 * 潜水:浮着的时候往下潜 dive 米(surfaceAt 的 dive,最多潜到底),头没进去就开始憋气(服务端按头的位置算)。
 * 攀爬:climbable 的物质(梯子、藤)在自己这格或前后左右一格、身子高度上 —— 能升到那一摞能爬的顶上(climbTop),
 * 到顶接着往旁边的平台上走;离开梯子就照常往下掉。
 * 服务端 worldapp/blocks.go 按同样的格子存,一次最多改 512 格。
 */

import type { Obstacle } from './worldLayout';
import { matPhysics } from './materials';

export const BLOCK_SIZE = 0.5;
export const BLOCK_MAX_Y = 32;
export const BLOCK_MAX_OPS = 512;
export const BLOCK_MAX_ROOM = 20000;
/** 一步能迈多高(米) */
export const STEP_UP = 0.55;
/** 浮起来时脚在液面下多深(头露在外面) */
export const FLOAT_DEPTH = 1.0;
/** 泡在液体里一步能迈多高(从水里爬上岸) */
export const SWIM_STEP = 1.15;

export const SHAPES = [
  { id: 0, name: '方块', icon: '◼' },
  { id: 1, name: '半砖', icon: '▬' },
  { id: 2, name: '斜坡', icon: '◢' },
  { id: 3, name: '薄墙', icon: '▮' },
  { id: 4, name: '柱子', icon: '●' },
] as const;

export interface BlockData { x: number; y: number; z: number; s: number; m: number; c: number; r: number }

/** 一条改动:[1, x, y, z, shape, mat, color, rot] 放 / [0, x, y, z] 拆 */
export type BlockOp = number[];

export const blockKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

/** 世界坐标 → 格子 */
export const cellOf = (v: number) => Math.floor(v / BLOCK_SIZE);

/** 服务端打包的 base64(每块 12 字节)→ 方块列表 */
export function decodeBlocks(b64: string): BlockData[] {
  if (!b64) return [];
  const bin = atob(b64);
  const out: BlockData[] = [];
  const i16 = (o: number) => { const v = bin.charCodeAt(o) | (bin.charCodeAt(o + 1) << 8); return v >= 0x8000 ? v - 0x10000 : v; };
  for (let o = 0; o + 12 <= bin.length; o += 12) {
    out.push({ x: i16(o), y: i16(o + 2), z: i16(o + 4), s: bin.charCodeAt(o + 6), m: bin.charCodeAt(o + 7), c: (bin.charCodeAt(o + 8) << 16) | (bin.charCodeAt(o + 9) << 8) | bin.charCodeAt(o + 10), r: bin.charCodeAt(o + 11) & 3 });
  }
  return out;
}

/** 斜坡往上的方向(rot 0 往 -z,也就是背向镜头;1 往 -x;2 往 +z;3 往 +x) */
export function rampDir(rot: number): { dx: number; dz: number } {
  return [{ dx: 0, dz: -1 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 1, dz: 0 }][rot & 3];
}

/** 一块在格子里 (fx, fz)(0..1)处的顶面高度(米);不能站的形状返回 null */
export function topAt(b: BlockData, fx: number, fz: number): number | null {
  const base = b.y * BLOCK_SIZE;
  if (b.s === 0) return base + BLOCK_SIZE;
  if (b.s === 1) return base + BLOCK_SIZE / 2;
  if (b.s === 2) {
    const d = rampDir(b.r);
    const u = d.dx !== 0 ? (d.dx > 0 ? fx : 1 - fx) : (d.dz > 0 ? fz : 1 - fz);
    return base + Math.max(0, Math.min(1, u)) * BLOCK_SIZE;
  }
  return null;
}

/** 一块真正占的高度上沿(挡路判断用) */
export function blockTop(b: BlockData): number {
  return b.y * BLOCK_SIZE + (b.s === 1 ? BLOCK_SIZE / 2 : BLOCK_SIZE);
}

export class BlockGrid {
  readonly map = new Map<string, BlockData>();
  /** 每一列(x,z)里有哪些 y:站高判断只看一列 */
  private cols = new Map<string, Set<number>>();

  get size() { return this.map.size; }
  get(x: number, y: number, z: number) { return this.map.get(blockKey(x, y, z)); }
  all() { return this.map.values(); }

  clear() { this.map.clear(); this.cols.clear(); }

  set(b: BlockData) {
    this.map.set(blockKey(b.x, b.y, b.z), b);
    const ck = `${b.x},${b.z}`;
    let col = this.cols.get(ck);
    if (!col) { col = new Set(); this.cols.set(ck, col); }
    col.add(b.y);
  }

  del(x: number, y: number, z: number): BlockData | undefined {
    const k = blockKey(x, y, z);
    const old = this.map.get(k);
    if (!old) return undefined;
    this.map.delete(k);
    this.cols.get(`${x},${z}`)?.delete(y);
    return old;
  }

  load(list: BlockData[]) { this.clear(); for (const b of list) this.set(b); }

  /** 套用一串改动,返回它们的反操作(撤销用,顺序已经倒过来) */
  apply(ops: readonly BlockOp[]): BlockOp[] {
    const inverse: BlockOp[] = [];
    for (const op of ops) {
      const [kind, x, y, z] = op;
      const old = this.get(x, y, z);
      inverse.push(old ? [1, old.x, old.y, old.z, old.s, old.m, old.c, old.r] : [0, x, y, z]);
      if (kind === 0) this.del(x, y, z);
      else this.set({ x, y, z, s: op[4] ?? 0, m: op[5] ?? 0, c: op[6] ?? 0xffffff, r: (op[7] ?? 0) & 3 });
    }
    return inverse.reverse();
  }

  /**
   * (x, z) 处脚能踩的高度:这一列里顶面不高于 curY + STEP_UP 的方块 / 半砖 / 斜坡,取最高;没有就是地面 0。
   */
  surfaceAt(x: number, z: number, curY: number, dive = 0): number {
    const cx = cellOf(x), cz = cellOf(z);
    const climb = this.climbTop(x, z, curY);
    const col = this.cols.get(`${cx},${cz}`);
    if (!col || !col.size) return climb ?? 0;
    const fx = x / BLOCK_SIZE - cx, fz = z / BLOCK_SIZE - cz;
    const step = climb !== null ? Math.max(SWIM_STEP, climb - curY + STEP_UP) : this.inLiquid(x, z, curY) ? SWIM_STEP : STEP_UP;
    let best = 0;
    for (const y of col) {
      const b = this.get(cx, y, cz)!;
      if (!matPhysics(b.m).walkable) continue;
      const t = topAt(b, fx, fz);
      if (t === null || t > curY + step) continue;
      if (t > best) best = t;
    }
    // 浮起:脚下往上连着的会浮的液体够深,就浮在液面下 FLOAT_DEPTH 米
    let y = Math.floor(best / BLOCK_SIZE + 1e-6);
    let top = -1;
    while (this.get(cx, y, cz) && matPhysics(this.get(cx, y, cz)!.m).float) { top = (y + 1) * BLOCK_SIZE; y++; }
    if (top > 0 && top - FLOAT_DEPTH - dive > best) best = top - FLOAT_DEPTH - dive;
    return climb !== null && climb > best ? climb : best;
  }

  /**
   * 站在 (x, curY, z) 能爬到多高:自己这格和前后左右一格里,身子高度上有能爬的积木,就是那一摞能爬的积木的顶;没有 = null。
   */
  climbTop(x: number, z: number, curY: number): number | null {
    const cx = cellOf(x), cz = cellOf(z);
    let best: number | null = null;
    for (const [i, k] of [[cx, cz], [cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]]) {
      if (!this.cols.get(`${i},${k}`)?.size) continue;
      for (let y = Math.floor((curY - 0.25) / BLOCK_SIZE); y <= Math.floor((curY + 1.2) / BLOCK_SIZE); y++) {
        const b = this.get(i, y, k);
        if (!b || !matPhysics(b.m).climbable) continue;
        let top = y;
        while (this.get(i, top + 1, k) && matPhysics(this.get(i, top + 1, k)!.m).climbable) top++;
        const h = (top + 1) * BLOCK_SIZE;
        if (best === null || h > best) best = h;
        break;
      }
    }
    return best;
  }

  /** 站在 (x, curY, z) 的人身边(自己这列和四周一圈)有没有液体 —— 泡在水里能迈得更高,好爬上岸 */
  inLiquid(x: number, z: number, curY: number): boolean {
    const cx = cellOf(x), cz = cellOf(z);
    const y0 = Math.floor(curY / BLOCK_SIZE), y1 = Math.floor((curY + 1.2) / BLOCK_SIZE);
    for (let i = cx - 1; i <= cx + 1; i++) for (let k = cz - 1; k <= cz + 1; k++) {
      if (!this.cols.get(`${i},${k}`)?.size) continue;
      for (let y = y0; y <= y1; y++) {
        const b = this.get(i, y, k);
        if (b && matPhysics(b.m).slow > 0 && !matPhysics(b.m).solid) return true;
      }
    }
    return false;
  }

  /**
   * 站在 curY 高度、(x, z) 附近 range 米内挡路的格子:底在头顶以下、顶高过一步能迈的;斜坡不挡(顺着坡走上去)。
   * 返回八期 pushOutOfBoxes 用的矩形。
   */
  obstaclesNear(x: number, z: number, curY: number, range = 2): Obstacle[] {
    const out: Obstacle[] = [];
    const r = Math.ceil(range / BLOCK_SIZE);
    const cx = cellOf(x), cz = cellOf(z);
    const climb = this.climbTop(x, z, curY);
    const step = climb !== null ? Math.max(SWIM_STEP, climb - curY + STEP_UP) : this.inLiquid(x, z, curY) ? SWIM_STEP : STEP_UP;
    for (let i = cx - r; i <= cx + r; i++) {
      for (let k = cz - r; k <= cz + r; k++) {
        const col = this.cols.get(`${i},${k}`);
        if (!col || !col.size) continue;
        let blocking: BlockData | null = null;
        for (const y of col) {
          const b = this.get(i, y, k)!;
          const ph = matPhysics(b.m);
          if (!ph.solid || (b.s === 2 && ph.walkable)) continue;
          const bottom = b.y * BLOCK_SIZE;
          // 方块、半砖:迈得上去就不挡;薄墙、柱子、站不上去的物质:和身子有重叠就挡
          const standable = (b.s === 0 || b.s === 1) && ph.walkable;
          if (bottom >= curY + 1.4 || blockTop(b) <= curY + (standable ? step : 0.05)) continue;
          blocking = b;
          break;
        }
        if (!blocking) continue;
        const ox = (i + 0.5) * BLOCK_SIZE, oz = (k + 0.5) * BLOCK_SIZE;
        if (blocking.s === 3) {
          const alongX = (blocking.r & 1) === 0;
          out.push({ x: ox, z: oz, hx: alongX ? BLOCK_SIZE / 2 : 0.05, hz: alongX ? 0.05 : BLOCK_SIZE / 2, rot: 0 });
        } else if (blocking.s === 4) {
          out.push({ x: ox, z: oz, hx: 0.2, hz: 0.2, rot: 0 });
        } else {
          out.push({ x: ox, z: oz, hx: BLOCK_SIZE / 2, hz: BLOCK_SIZE / 2, rot: 0 });
        }
      }
    }
    return out;
  }
}

/**
 * 站在 (x, curY, z) 的人泡在液体里的话走路打几折(0 = 不减速):这一格里和身子(脚底往上 1.2 米)有重叠的格子,
 * 取物质 liquid.slow 最大的。
 */
export function slowAt(grid: BlockGrid, x: number, z: number, curY: number): number {
  const cx = cellOf(x), cz = cellOf(z);
  let slow = 0;
  for (let y = Math.floor(curY / BLOCK_SIZE); y <= Math.floor((curY + 1.2) / BLOCK_SIZE); y++) {
    const b = grid.get(cx, y, cz);
    if (b) slow = Math.max(slow, matPhysics(b.m).slow);
  }
  return slow;
}

/**
 * 站在 (x, curY, z) 的人被水流推着走的速度(米/秒):身子泡着的液体格子里流速最大的那块,方向是它的朝向(rampDir)。
 */
export function flowAt(grid: BlockGrid, x: number, z: number, curY: number): { x: number; z: number } | null {
  const cx = cellOf(x), cz = cellOf(z);
  let best: { x: number; z: number } | null = null;
  let speed = 0;
  for (let y = Math.floor(curY / BLOCK_SIZE); y <= Math.floor((curY + 1.2) / BLOCK_SIZE); y++) {
    const b = grid.get(cx, y, cz);
    if (!b) continue;
    const f = matPhysics(b.m).flow;
    if (f > speed) { speed = f; const d = rampDir(b.r); best = { x: d.dx * f, z: d.dz * f }; }
  }
  return best;
}

export interface GlowLight { x: number; y: number; z: number; color: number; intensity: number; radius: number; count: number }

/**
 * 发光积木 → 候选光源:按 2 米(4 格)一簇,位置取平均、颜色取平均,块越多越亮、照得越远(有上限);块多的在前,最多 max 个。
 */
export function glowLights(grid: BlockGrid, max = 48): GlowLight[] {
  const acc = new Map<string, { x: number; y: number; z: number; r: number; g: number; b: number; n: number; i: number; rad: number }>();
  for (const b of grid.all()) {
    const glow = matPhysics(b.m).glow;
    if (!glow) continue;
    const k = `${Math.floor(b.x / 4)},${Math.floor(b.y / 4)},${Math.floor(b.z / 4)}`;
    let a = acc.get(k);
    if (!a) { a = { x: 0, y: 0, z: 0, r: 0, g: 0, b: 0, n: 0, i: 0, rad: 0 }; acc.set(k, a); }
    a.x += (b.x + 0.5) * BLOCK_SIZE; a.y += (b.y + 0.5) * BLOCK_SIZE; a.z += (b.z + 0.5) * BLOCK_SIZE;
    a.r += (b.c >> 16) & 255; a.g += (b.c >> 8) & 255; a.b += b.c & 255;
    a.n++; a.i = Math.max(a.i, glow.intensity); a.rad = Math.max(a.rad, glow.radius);
  }
  const out: GlowLight[] = [];
  for (const a of acc.values()) {
    const color = (Math.round(a.r / a.n) << 16) | (Math.round(a.g / a.n) << 8) | Math.round(a.b / a.n);
    out.push({ x: a.x / a.n, y: a.y / a.n, z: a.z / a.n, color: color || 0xffd98a, intensity: Math.min(12, a.i * (1 + Math.log2(a.n) * 0.5)), radius: Math.min(20, a.rad + Math.sqrt(a.n) * 0.5), count: a.n });
  }
  return out.sort((p, q) => q.count - p.count).slice(0, max);
}

/** 两个角之间铺满的改动(放:同一种积木;拆:把里面有的都拆掉);超过 limit 格返回 null */
export function fillOps(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, put: { s: number; m: number; c: number; r: number } | null, grid: BlockGrid, limit = BLOCK_MAX_OPS): BlockOp[] | null {
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const [z0, z1] = [Math.min(a.z, b.z), Math.max(a.z, b.z)];
  if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > limit) return null;
  const ops: BlockOp[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    if (put) ops.push([1, x, y, z, put.s, put.m, put.c, put.r]);
    else if (grid.get(x, y, z)) ops.push([0, x, y, z]);
  }
  return ops;
}
