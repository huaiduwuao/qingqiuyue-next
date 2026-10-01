/**
 * vrm/world/materials.ts — 物质(积木的材质)登记表
 *
 * 物质是数据(服务端 world_material,GET /world/materials;docs/WORLD-MODEL.md §3.4):
 *   - id 是积木里存的那个字节,key / name 给人看,color 默认颜色;
 *   - look:pattern 纹理样式(plain / speckle / wood / brick / brushed / tile / cloth —— 引擎认得的几种画法)、
 *     opacity、roughness、metalness、unlit(不受光,发光块);
 *   - props:solid 挡不挡人、walkable 顶上能不能站、liquid.slow 人在里面走得慢多少(0–0.9)。
 * 积木网格(blocks.ts)按这里判断走路,积木层(blockLayer.ts)按这里画,搭建面板按这里列。
 * 还没读到(或者读失败)时谁都当成能站、挡人的白色方块。
 */

export interface BlockMaterial {
  id: number;
  key: string;
  name: string;
  color: string;
  look?: { pattern?: string; opacity?: number; roughness?: number; metalness?: number; unlit?: boolean; n?: number; lo?: number; hi?: number; size?: number };
  props?: { solid?: boolean; walkable?: boolean; transparent?: number; emits?: { intensity?: number; radius?: number }; liquid?: { slow?: number } };
  hidden?: boolean;
}

export interface MatPhysics {
  solid: boolean;
  walkable: boolean;
  /** 人在里面走路的速度打几折(0 = 不减速) */
  slow: number;
}

const DEFAULT_PHYS: MatPhysics = { solid: true, walkable: true, slow: 0 };

let byId = new Map<number, BlockMaterial>();
let phys = new Map<number, MatPhysics>();
let version = 0;
const listeners = new Set<() => void>();

/** 换成服务端给的这份 */
export function setMaterials(list: readonly BlockMaterial[]) {
  byId = new Map(list.map((m) => [m.id, m]));
  phys = new Map(list.map((m) => {
    const solid = m.props?.solid !== false;
    return [m.id, { solid, walkable: solid && m.props?.walkable !== false, slow: Math.max(0, Math.min(0.9, m.props?.liquid?.slow ?? 0)) }];
  }));
  version++;
  listeners.forEach((f) => f());
}

export function materialOf(id: number): BlockMaterial | undefined { return byId.get(id); }

/** 面板里能选的(没藏起来的,按 id 排) */
export function pickableMaterials(): BlockMaterial[] {
  return Array.from(byId.values()).filter((m) => !m.hidden).sort((a, b) => a.id - b.id);
}

export function matPhysics(id: number): MatPhysics { return phys.get(id) ?? DEFAULT_PHYS; }

/** 默认颜色(0xRRGGBB) */
export function matColor(id: number): number {
  const c = byId.get(id)?.color;
  return c && /^#[0-9a-f]{6}$/i.test(c) ? parseInt(c.slice(1), 16) : 0xffffff;
}

/** 每换一次登记表加一(积木层看到变了就重建材质) */
export function materialsVersion() { return version; }

/** 登记表换了通知一声(返回取消订阅) */
export function onMaterials(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}
