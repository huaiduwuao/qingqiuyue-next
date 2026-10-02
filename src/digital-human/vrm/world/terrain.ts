/**
 * vrm/world/terrain.ts — 地形的数据(纯函数,不碰 three;服务端 go worldapp/terrain.go)
 *
 * 一间房一张高度场:0.5 米一个点,(w+1) × (h+1) 个点,左下角在 (x0, z0);每个点一个高度(厘米,−200…600,
 * 能往地板以下挖 2 米)和一个物质 id(颜色按物质)。服务端打包成 base64,每点 3 字节(高度 + offset 的 uint16 小端 + 物质)。
 * 改地形时服务端回 / 推改到的那一块(patch)。液面(go worldapp/water.go):每个点自己一个液面高度 + 一种液体,
 * 八邻相连的同种湿点是一片水、一个液面;不同的坑可以是不同的高度和液体。服务端按「体积不变、连通的地方找平」算好,
 * 前端只管读:每点 3 字节(液面厘米 + offset 的 uint16 小端,0xFFFF = 干;液体 id)。
 * 人走路:脚下取地形高度(双线性)和积木里高的那个;泡在水面下按那种液体的物理(减速、浮起)。
 */

/** 一格里的液面:米 + 液体 id */
export interface WaterSurface { level: number; mat: number }
/** 干的点 */
export const WATER_DRY = -32768;
export interface TerrainView { x0: number; z0: number; cell: number; w: number; h: number; data: string; offset?: number; water?: string | null }
export interface TerrainPatch { i0: number; j0: number; w: number; h: number; data: string; offset?: number }

export class TerrainData {
  /** 厘米 */
  readonly height: Int16Array;
  readonly mat: Uint8Array;
  /** 每点液面(厘米);null = 一滴水都没有 */
  waterLevel: Int16Array | null = null;
  waterMat: Uint8Array | null = null;
  constructor(readonly x0: number, readonly z0: number, readonly cell: number, readonly w: number, readonly h: number) {
    this.height = new Int16Array((w + 1) * (h + 1));
    this.mat = new Uint8Array((w + 1) * (h + 1));
  }

  idx(i: number, j: number) { return j * (this.w + 1) + i; }

  /** 服务端的整张(data 空 = 没有地形) */
  static decode(v: TerrainView): TerrainData | null {
    if (!v.data) return null;
    const t = new TerrainData(v.x0, v.z0, v.cell, v.w, v.h);
    const bin = atob(v.data);
    if (bin.length !== t.height.length * 3) return null;
    const off = v.offset ?? 0;
    for (let k = 0; k < t.height.length; k++) {
      t.height[k] = (bin.charCodeAt(k * 3) | (bin.charCodeAt(k * 3 + 1) << 8)) - off;
      t.mat[k] = bin.charCodeAt(k * 3 + 2);
    }
    t.setWater(v.water ?? null, off);
    return t;
  }

  /** 换一张液面(服务端打包的;空 = 没水) */
  setWater(b64: string | null, offset = 200) {
    this.waterLevel = null;
    this.waterMat = null;
    if (!b64) return;
    const bin = atob(b64);
    const n = this.height.length;
    if (bin.length !== n * 3) return;
    const lv = new Int16Array(n), mt = new Uint8Array(n);
    let any = false;
    for (let k = 0; k < n; k++) {
      const v = bin.charCodeAt(k * 3) | (bin.charCodeAt(k * 3 + 1) << 8);
      if (v === 0xffff) { lv[k] = WATER_DRY; continue; }
      lv[k] = v - offset;
      mt[k] = bin.charCodeAt(k * 3 + 2);
      any = true;
    }
    if (any) { this.waterLevel = lv; this.waterMat = mt; }
  }

  /** 有没有水 */
  get hasWater() { return this.waterLevel != null; }

  /** 改到的那一块盖上去 */
  applyPatch(p: TerrainPatch) {
    const bin = atob(p.data);
    const off = p.offset ?? 0;
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
      const o = (j * p.w + i) * 3;
      const gi = p.i0 + i, gj = p.j0 + j;
      if (gi < 0 || gj < 0 || gi > this.w || gj > this.h) continue;
      const k = this.idx(gi, gj);
      this.height[k] = (bin.charCodeAt(o) | (bin.charCodeAt(o + 1) << 8)) - off;
      this.mat[k] = bin.charCodeAt(o + 2);
    }
  }

  /** 网格范围里没有 */
  inside(x: number, z: number) {
    const fx = (x - this.x0) / this.cell, fz = (z - this.z0) / this.cell;
    return fx >= 0 && fz >= 0 && fx <= this.w && fz <= this.h;
  }

  /** (x, z) 处的高度(米,四个点双线性);出界 = 0(地板) */
  heightAt(x: number, z: number): number {
    if (!this.inside(x, z)) return 0;
    const fx = (x - this.x0) / this.cell, fz = (z - this.z0) / this.cell;
    const i = Math.min(Math.floor(fx), this.w - 1), j = Math.min(Math.floor(fz), this.h - 1);
    const u = fx - i, v = fz - j;
    const hh = (a: number, b: number) => this.height[this.idx(a, b)] / 100;
    return (hh(i, j) * (1 - u) + hh(i + 1, j) * u) * (1 - v) + (hh(i, j + 1) * (1 - u) + hh(i + 1, j + 1) * u) * v;
  }

  /** (x, z) 那一格的液面:四个角里湿的(同一片,一个液面);都干 = null */
  surfaceAt(x: number, z: number): WaterSurface | null {
    const lv = this.waterLevel, mt = this.waterMat;
    if (!lv || !mt || !this.inside(x, z)) return null;
    const fx = (x - this.x0) / this.cell, fz = (z - this.z0) / this.cell;
    const i = Math.min(Math.floor(fx), this.w - 1), j = Math.min(Math.floor(fz), this.h - 1);
    let best = WATER_DRY, mat = -1;
    for (const [a, b] of [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]]) {
      const k = this.idx(a, b);
      if (lv[k] !== WATER_DRY && lv[k] > best) { best = lv[k]; mat = mt[k]; }
    }
    return best === WATER_DRY ? null : { level: best / 100, mat };
  }

  /** (x, y, z) 泡在液面下的话是哪种液体;不在 = null */
  waterAt(x: number, y: number, z: number): number | null {
    const s = this.surfaceAt(x, z);
    if (!s || y >= s.level || this.heightAt(x, z) >= s.level) return null;
    return s.mat;
  }
}


/** 一笔(和服务端 TerrainOp 一样) */
export interface TerrainOp { tool: 'init' | 'raise' | 'lower' | 'flatten' | 'smooth' | 'paint' | 'water' | 'drain' | 'nowater'; x?: number; z?: number; r?: number; amount?: number; mat?: number }
