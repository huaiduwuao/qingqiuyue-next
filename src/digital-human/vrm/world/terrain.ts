/**
 * vrm/world/terrain.ts — 地形的数据(纯函数,不碰 three;服务端 go worldapp/terrain.go)
 *
 * 一间房一张高度场:0.5 米一个点,(w+1) × (h+1) 个点,左下角在 (x0, z0);每个点一个高度(厘米,0–800)和一个物质 id
 * (颜色按物质)。服务端打包成 base64,每点 3 字节(高度 uint16 小端 + 物质)。改地形时服务端回 / 推改到的那一块(patch)。
 * 人走路:脚下取地形高度(双线性)和积木里高的那个。
 */

export interface TerrainView { x0: number; z0: number; cell: number; w: number; h: number; data: string }
export interface TerrainPatch { i0: number; j0: number; w: number; h: number; data: string }

export class TerrainData {
  readonly height: Uint16Array;
  readonly mat: Uint8Array;
  constructor(readonly x0: number, readonly z0: number, readonly cell: number, readonly w: number, readonly h: number) {
    this.height = new Uint16Array((w + 1) * (h + 1));
    this.mat = new Uint8Array((w + 1) * (h + 1));
  }

  idx(i: number, j: number) { return j * (this.w + 1) + i; }

  /** 服务端的整张(data 空 = 没有地形) */
  static decode(v: TerrainView): TerrainData | null {
    if (!v.data) return null;
    const t = new TerrainData(v.x0, v.z0, v.cell, v.w, v.h);
    const bin = atob(v.data);
    if (bin.length !== t.height.length * 3) return null;
    for (let k = 0; k < t.height.length; k++) {
      t.height[k] = bin.charCodeAt(k * 3) | (bin.charCodeAt(k * 3 + 1) << 8);
      t.mat[k] = bin.charCodeAt(k * 3 + 2);
    }
    return t;
  }

  /** 改到的那一块盖上去 */
  applyPatch(p: TerrainPatch) {
    const bin = atob(p.data);
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
      const o = (j * p.w + i) * 3;
      const gi = p.i0 + i, gj = p.j0 + j;
      if (gi < 0 || gj < 0 || gi > this.w || gj > this.h) continue;
      const k = this.idx(gi, gj);
      this.height[k] = bin.charCodeAt(o) | (bin.charCodeAt(o + 1) << 8);
      this.mat[k] = bin.charCodeAt(o + 2);
    }
  }

  /** (x, z) 处的高度(米,四个点双线性);出界 = 0 */
  heightAt(x: number, z: number): number {
    const fx = (x - this.x0) / this.cell, fz = (z - this.z0) / this.cell;
    if (fx < 0 || fz < 0 || fx > this.w || fz > this.h) return 0;
    const i = Math.min(Math.floor(fx), this.w - 1), j = Math.min(Math.floor(fz), this.h - 1);
    const u = fx - i, v = fz - j;
    const hh = (a: number, b: number) => this.height[this.idx(a, b)] / 100;
    return (hh(i, j) * (1 - u) + hh(i + 1, j) * u) * (1 - v) + (hh(i, j + 1) * (1 - u) + hh(i + 1, j + 1) * u) * v;
  }
}

/** 一笔(和服务端 TerrainOp 一样) */
export interface TerrainOp { tool: 'init' | 'raise' | 'lower' | 'flatten' | 'smooth' | 'paint'; x?: number; z?: number; r?: number; amount?: number; mat?: number }
