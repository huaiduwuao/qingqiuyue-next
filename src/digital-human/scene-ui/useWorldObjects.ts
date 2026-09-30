/**
 * scene-ui/useWorldObjects.ts — 「言出法随」的前端:把数字人的 world_place / world_edit / scene_go 变成场景里的东西
 *
 * - 进场景就读这个场景的摆放(公共的 + 自己的),交给舞台画;有还在现做的,每 8 秒问一次进度
 * - world_place:服务端已经挑好素材(结果 JSON),这里按用户此刻的位置 / 朝向算摆放点,存库、画出来
 *     front = 面前(一米多,按东西大小往外让),beside = 右手边,here = 脚边,zone:<id> = 那个地标旁边;
 *     多件排成一小排;东西默认面朝用户
 * - world_edit:按叫法找(「凳子」),找不到就用最近摆的那件;挪 / 转 / 缩放 / 删 / 清空
 * - scene_go:按场景 key 或名字找,切过去(外面放过场)
 * 个人空间随便摆;public=true 走后台接口(没有 system:plaza:manage 会失败,提示一句)。
 *
 * 创世:房间(场景 key = "room:<uid>")里只有房主能摆;布置编辑器(RoomEditor)用这里的
 * placeAsset / patchItem / removeItem / restoreItem 做手动摆放和撤销。
 */

import * as React from 'react';
import {
  createPlacement, deletePlacement, getAsset, listPlacements, updatePlacement,
  type WorldAsset, type WorldPlacement,
} from '@/apis/world';
import type { VrmStageHandle } from '../VrmStage';
import type { PlacedObject } from '../vrm/world/worldObjects';
import type { WorldDef } from '../vrm/world/worldLayout';

export type WorldToolEvent = { name: 'world_place' | 'world_edit' | 'scene_go' | 'room_design'; args: Record<string, any>; result?: any };

/** 布置助手的一件(服务端 room_design 的结果) */
export interface DesignItem { item: string; x: number; z: number; rot_deg?: number; scale?: number; why?: string; asset: WorldAsset }
export interface DesignPlan { theme: string; clearFirst: boolean; items: DesignItem[]; missing: string[] }

interface Options {
  handle: VrmStageHandle | null;
  enabled: boolean;
  def: WorldDef;
  defs: WorldDef[];
  switchTo: (key: string) => void;
  toast: (icon: string, text: string) => void;
  /** 换场景前放过场(名字),过场淡入后再真正切 */
  onTravel?: (name: string) => void;
}

export const toPlaced = (p: WorldPlacement): PlacedObject => ({
  id: p.id, assetKey: p.assetKey, label: p.label, x: p.x, y: p.y, z: p.z, rotY: p.rotY, scale: p.scale || 1,
  status: p.asset?.status ?? 'ready', nameZh: p.asset?.nameZh, isSet: p.asset?.isSet, height: p.asset?.height,
  file: p.asset?.file || undefined, normalize: p.asset?.source === 'upload',
});

export function useWorldObjects(opts: Options) {
  const { handle, enabled, def } = opts;
  const [items, setItems] = React.useState<WorldPlacement[]>([]);
  const itemsRef = React.useRef<WorldPlacement[]>([]);
  itemsRef.current = items;
  const lastRef = React.useRef<string | null>(null);
  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  // 进场景读摆放
  React.useEffect(() => {
    if (!enabled || !handle) return;
    let alive = true;
    listPlacements(def.key).then((list) => {
      if (!alive) return;
      setItems(list);
      handle.setPlacements(list.map(toPlaced));
    }).catch(() => { /* 没登录 / 接口没上线:就是空的 */ });
    return () => { alive = false; };
  }, [enabled, handle, def.key]);

  // 现做进度:每 8 秒问一次还没好的素材
  React.useEffect(() => {
    if (!enabled || !handle) return;
    const timer = window.setInterval(() => {
      const pending = Array.from(new Set(itemsRef.current.filter((p) => p.asset && p.asset.status !== 'ready').map((p) => p.assetKey)));
      pending.forEach((key) => {
        getAsset(key).then((a) => {
          if (!a || a.status === 'processing' || a.status === 'available') return;
          setItems((cur) => {
            const next = cur.map((p) => (p.assetKey === key ? { ...p, asset: a } : p));
            next.filter((p) => p.assetKey === key).forEach((p) => handle.upsertPlacement(toPlaced(p)));
            return next;
          });
          if (a.status === 'ready') optsRef.current.toast('✨', `${a.nameZh} 打造好了`);
          else optsRef.current.toast('⚠️', `${a.nameZh} 没做成,换一件试试`);
        }).catch(() => { /* 下一轮再问 */ });
      });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [enabled, handle]);

  /** 按「放哪」算落点:返回 [x, z, 朝向] */
  const spotFor = React.useCallback((where: string, footprint: number, i: number, n: number): [number, number, number] | null => {
    const snap = handle?.getWorldSnapshot();
    if (!snap) return null;
    const { x, z, yaw } = snap;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const rx = fz, rz = -fx; // 右手边
    const gap = Math.max(0.5, footprint) + 0.3;
    const spread = (i - (n - 1) / 2) * gap; // 多件排一排,横着展开
    let cx: number, cz: number;
    const w = (where || 'front').trim();
    // 房间里的精确位置:at:<x>,<z>(房间坐标)/ near:<摆放 id>(挨着那件,朝向和它一样)
    if (w.startsWith('at:')) {
      const [ax, az] = w.slice(3).split(',').map((v) => Number(v));
      if (Number.isFinite(ax) && Number.isFinite(az)) {
        const face = Math.atan2(x - ax, z - az); // 正面朝着用户
        return [ax + Math.cos(face) * spread, az - Math.sin(face) * spread, face];
      }
    }
    if (w.startsWith('near:')) {
      const other = itemsRef.current.find((p) => p.id === w.slice(5));
      if (other) {
        const ofp = (other.asset?.footprint || 0.6) * (other.scale || 1);
        const d = ofp / 2 + footprint / 2 + 0.15;
        const rx2 = Math.cos(other.rotY), rz2 = -Math.sin(other.rotY); // 那件东西的右手边
        const k = d + Math.abs(spread);
        return [other.x + rx2 * k * (i % 2 ? -1 : 1), other.z + rz2 * k * (i % 2 ? -1 : 1), other.rotY];
      }
    }
    if (w.startsWith('zone:')) {
      const zone = def.zones.find((zn) => zn.id === w.slice(5));
      if (zone) {
        // 地标朝广场中心那一侧,让出地标实心的部分
        const L = Math.hypot(zone.x, zone.z) || 1;
        const k = (zone.solidRadius + 0.6 + footprint / 2) / L;
        cx = zone.x - zone.x * k;
        cz = zone.z - zone.z * k;
        const face = Math.atan2(-zone.x, -zone.z);
        return [cx + Math.cos(face) * spread, cz - Math.sin(face) * spread, face + Math.PI];
      }
    }
    if (w === 'beside') {
      const d = 0.6 + footprint / 2;
      cx = x + rx * d + fx * spread;
      cz = z + rz * d + fz * spread;
    } else if (w === 'here') {
      cx = x + fx * (0.35 + footprint / 2) + rx * spread;
      cz = z + fz * (0.35 + footprint / 2) + rz * spread;
    } else {
      const d = 1.1 + footprint / 2;
      cx = x + fx * d + rx * spread;
      cz = z + fz * d + rz * spread;
    }
    // 东西的正面朝着用户
    return [cx, cz, yaw + Math.PI];
  }, [handle, def.zones]);

  const findTarget = React.useCallback((target?: string, id?: string): WorldPlacement | null => {
    const list = itemsRef.current;
    if (id) {
      const byId = list.find((p) => p.id === String(id));
      if (byId) return byId;
    }
    const t = (target || '').trim();
    if (t) {
      const hit = [...list].reverse().find((p) => (p.label && (p.label.includes(t) || t.includes(p.label))) || (p.asset?.nameZh && (t.includes(p.asset.nameZh) || p.asset.nameZh.includes(t))));
      if (hit) return hit;
    }
    return list.find((p) => p.id === lastRef.current) ?? list[list.length - 1] ?? null;
  }, []);

  const place = React.useCallback(async (args: Record<string, any>, result: any) => {
    const h = optsRef.current.handle;
    if (!h || !result?.ok || !result.asset) return;
    const asset = result.asset as WorldAsset;
    const n = Math.max(1, Math.min(8, Number(result.count) || 1));
    const scale = Number(result.scale) > 0 ? Number(result.scale) : 1;
    const isPublic = !!result.public;
    const label = String(args.item || asset.nameZh).slice(0, 32);
    for (let i = 0; i < n; i++) {
      const spot = spotFor(String(result.where || 'front'), (asset.footprint || 0.6) * scale, i, n);
      if (!spot) return;
      const [x, z, rotY] = spot;
      try {
        const saved = await createPlacement({ scene: optsRef.current.def.key, asset: asset.key, label, x, z, rotY: rotY + (n > 1 ? (i % 2) * 0.3 : 0), scale }, isPublic);
        const withAsset: WorldPlacement = { ...saved, public: isPublic, asset: saved.asset ?? asset };
        setItems((cur) => [...cur, withAsset]);
        h.upsertPlacement(toPlaced(withAsset));
        lastRef.current = withAsset.id;
      } catch (e: any) {
        optsRef.current.toast('⚠️', isPublic ? '公共场景只有管理员能摆' : `没摆成:${e?.message || e}`);
        return;
      }
    }
  }, [spotFor]);

  const edit = React.useCallback(async (args: Record<string, any>) => {
    const h = optsRef.current.handle;
    if (!h) return;
    const action = String(args.action || '');
    if (action === 'clear') {
      const mine = itemsRef.current.filter((p) => !p.public);
      await Promise.allSettled(mine.map((p) => deletePlacement(p.id)));
      mine.forEach((p) => h.removePlacement(p.id));
      setItems((cur) => cur.filter((p) => p.public));
      return;
    }
    const p = findTarget(args.target, args.id);
    if (!p) { optsRef.current.toast('🤔', '这里还没有摆过东西'); return; }
    try {
      if (action === 'remove') {
        await deletePlacement(p.id, p.public);
        h.removePlacement(p.id);
        setItems((cur) => cur.filter((x) => x.id !== p.id));
        return;
      }
      const patch: { x?: number; z?: number; rotY?: number; scale?: number } = {};
      if (action === 'move') {
        const spot = spotFor(String(args.where || 'front'), (p.asset?.footprint || 0.6) * (p.scale || 1), 0, 1);
        if (!spot) return;
        [patch.x, patch.z, patch.rotY] = spot;
      } else if (action === 'rotate') {
        patch.rotY = Number.isFinite(Number(args.to_deg)) && args.to_deg !== undefined && args.to_deg !== null
          ? (Number(args.to_deg) * Math.PI) / 180
          : p.rotY + ((Number(args.amount) || 90) * Math.PI) / 180;
      } else if (action === 'scale') {
        patch.scale = Math.max(0.1, Math.min(10, (p.scale || 1) * (Number(args.amount) || 1.5)));
      } else return;
      const saved = await updatePlacement(p.id, patch, p.public);
      const next: WorldPlacement = { ...p, ...saved, public: p.public, asset: p.asset };
      setItems((cur) => cur.map((x) => (x.id === p.id ? next : x)));
      h.upsertPlacement(toPlaced(next));
      lastRef.current = p.id;
    } catch (e: any) {
      optsRef.current.toast('⚠️', `没改成:${e?.message || e}`);
    }
  }, [findTarget, spotFor]);

  const go = React.useCallback((args: Record<string, any>) => {
    const want = String(args.scene || '').trim();
    if (!want) return;
    const { defs } = optsRef.current;
    // 「回我的房间 / 回家」:自己的房间
    const home = /我的房间|我的小屋|回家|我家|房间/.test(want) ? defs.find((d) => d.kind === 'room' && d.room?.mine) : undefined;
    const hit = home ?? defs.find((d) => d.key === want) ?? defs.find((d) => d.name === want) ?? defs.find((d) => d.name.includes(want) || want.includes(d.name))
      ?? defs.find((d) => d.zones.some((z) => want.includes(z.label)));
    if (!hit) { optsRef.current.toast('🤔', `没找到「${want}」这个地方`); return; }
    if (hit.key === optsRef.current.def.key) return;
    optsRef.current.onTravel?.(hit.name);
    // 过场淡入后再切(约 0.6 秒)
    window.setTimeout(() => optsRef.current.switchTo(hit.key), 600);
  }, []);

  // ── 布置助手:先半透明预览(ghost:<i>),用户确认才真的摆
  const [design, setDesign] = React.useState<DesignPlan | null>(null);
  const designRef = React.useRef<DesignPlan | null>(null);
  designRef.current = design;
  const clearGhosts = React.useCallback((plan: DesignPlan | null) => {
    const h = optsRef.current.handle;
    if (!h || !plan) return;
    plan.items.forEach((_, i) => h.removePlacement(`ghost:${i}`));
  }, []);
  const previewDesign = React.useCallback((result: any) => {
    const h = optsRef.current.handle;
    if (!h || !result?.ok || !Array.isArray(result.items)) return;
    const def = optsRef.current.def;
    if (def.kind !== 'room' || !def.room?.mine) {
      optsRef.current.toast('🏠', '布置方案只能用在自己的房间里');
      return;
    }
    clearGhosts(designRef.current);
    const plan: DesignPlan = { theme: String(result.theme || ''), clearFirst: !!result.clearFirst, items: result.items as DesignItem[], missing: Array.isArray(result.missing) ? result.missing : [] };
    plan.items.forEach((it, i) => {
      h.upsertPlacement({
        id: `ghost:${i}`, assetKey: it.asset.key, label: it.item, x: it.x, y: 0, z: it.z, rotY: ((it.rot_deg ?? 0) * Math.PI) / 180, scale: it.scale || 1,
        status: it.asset.status, nameZh: it.asset.nameZh, isSet: it.asset.isSet, height: it.asset.height,
        file: it.asset.file || undefined, normalize: it.asset.source === 'upload', ghost: true,
      });
    });
    setDesign(plan);
  }, [clearGhosts]);
  const cancelDesign = React.useCallback(() => { clearGhosts(designRef.current); setDesign(null); }, [clearGhosts]);
  const [applying, setApplying] = React.useState(false);
  const applyDesign = React.useCallback(async () => {
    const plan = designRef.current;
    const h = optsRef.current.handle;
    if (!plan || !h) return;
    setApplying(true);
    try {
      if (plan.clearFirst) {
        const mine = itemsRef.current.filter((p) => !p.public);
        await Promise.allSettled(mine.map((p) => deletePlacement(p.id)));
        mine.forEach((p) => h.removePlacement(p.id));
        setItems((cur) => cur.filter((p) => p.public));
      }
      let ok = 0;
      for (const it of plan.items) {
        try {
          const saved = await createPlacement({ scene: optsRef.current.def.key, asset: it.asset.key, label: it.item.slice(0, 32), x: it.x, z: it.z, rotY: ((it.rot_deg ?? 0) * Math.PI) / 180, scale: it.scale || 1 });
          const withAsset: WorldPlacement = { ...saved, public: false, asset: saved.asset ?? it.asset };
          setItems((cur) => (cur.some((x) => x.id === withAsset.id) ? cur : [...cur, withAsset]));
          h.upsertPlacement(toPlaced(withAsset));
          ok++;
        } catch { /* 一件失败不影响别的 */ }
      }
      clearGhosts(plan);
      setDesign(null);
      optsRef.current.toast('🏠', ok === plan.items.length ? `按「${plan.theme}」布置好了,共 ${ok} 件` : `摆好了 ${ok} / ${plan.items.length} 件`);
    } finally {
      setApplying(false);
    }
  }, [clearGhosts]);
  // 离开这间房:预览作废
  React.useEffect(() => { cancelDesign(); }, [def.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTool = React.useCallback((e: WorldToolEvent) => {
    if (e.name === 'room_design') { previewDesign(e.result); return; }
    if (e.name === 'world_place') void place(e.args, e.result);
    else if (e.name === 'world_edit') void edit(e.args);
    else if (e.name === 'scene_go') go(e.args);
  }, [place, edit, go, previewDesign]);

  // ── 布置编辑器用 ──

  /** 手动摆一件(素材抽屉里点的):默认放在面前;返回存好的摆放 */
  const placeAsset = React.useCallback(async (asset: WorldAsset, at?: { x: number; z: number; rotY?: number }): Promise<WorldPlacement | null> => {
    const h = optsRef.current.handle;
    if (!h) return null;
    const spot = at ? [at.x, at.z, at.rotY ?? 0] as const : spotFor('front', asset.footprint || 0.6, 0, 1);
    if (!spot) return null;
    try {
      const saved = await createPlacement({ scene: optsRef.current.def.key, asset: asset.key, label: asset.nameZh.slice(0, 32), x: spot[0], z: spot[1], rotY: spot[2] });
      const withAsset: WorldPlacement = { ...saved, public: false, asset: saved.asset ?? asset };
      setItems((cur) => [...cur, withAsset]);
      h.upsertPlacement(toPlaced(withAsset));
      lastRef.current = withAsset.id;
      return withAsset;
    } catch (e: any) {
      optsRef.current.toast('⚠️', `没摆成:${e?.message || e}`);
      return null;
    }
  }, [spotFor]);

  /** 改一件(挪 / 转 / 缩放 / 改名):先画出来再存,存失败就退回去 */
  const patchItem = React.useCallback(async (id: string, patch: { x?: number; y?: number; z?: number; rotY?: number; scale?: number; label?: string }): Promise<boolean> => {
    const h = optsRef.current.handle;
    const p = itemsRef.current.find((x) => x.id === id);
    if (!h || !p) return false;
    const next: WorldPlacement = { ...p, ...patch };
    setItems((cur) => cur.map((x) => (x.id === id ? next : x)));
    h.upsertPlacement(toPlaced(next));
    try {
      await updatePlacement(id, patch, p.public);
      return true;
    } catch (e: any) {
      setItems((cur) => cur.map((x) => (x.id === id ? p : x)));
      h.upsertPlacement(toPlaced(p));
      optsRef.current.toast('⚠️', `没改成:${e?.message || e}`);
      return false;
    }
  }, []);

  const removeItem = React.useCallback(async (id: string): Promise<WorldPlacement | null> => {
    const h = optsRef.current.handle;
    const p = itemsRef.current.find((x) => x.id === id);
    if (!h || !p) return null;
    try {
      await deletePlacement(id, p.public);
      h.removePlacement(id);
      setItems((cur) => cur.filter((x) => x.id !== id));
      return p;
    } catch (e: any) {
      optsRef.current.toast('⚠️', `没删掉:${e?.message || e}`);
      return null;
    }
  }, []);

  /** 撤销删除:照原样再摆一件(会拿到新 id) */
  const restoreItem = React.useCallback(async (p: WorldPlacement): Promise<WorldPlacement | null> => {
    const h = optsRef.current.handle;
    if (!h) return null;
    try {
      const saved = await createPlacement({ scene: p.sceneKey, asset: p.assetKey, label: p.label, x: p.x, y: p.y, z: p.z, rotY: p.rotY, scale: p.scale });
      const withAsset: WorldPlacement = { ...saved, public: false, asset: saved.asset ?? p.asset };
      setItems((cur) => [...cur, withAsset]);
      h.upsertPlacement(toPlaced(withAsset));
      return withAsset;
    } catch (e: any) {
      optsRef.current.toast('⚠️', `没恢复:${e?.message || e}`);
      return null;
    }
  }, []);

  /** 创世二期:房间里别人(或自己另一个标签页)改了摆放,服务端推过来的 */
  const applyRemote = React.useCallback((op: 'upsert' | 'remove', data: unknown) => {
    const h = optsRef.current.handle;
    if (!h) return;
    if (op === 'remove') {
      const id = String(data);
      if (!itemsRef.current.some((x) => x.id === id)) return;
      setItems((cur) => cur.filter((x) => x.id !== id));
      h.removePlacement(id);
      return;
    }
    const p = data as WorldPlacement | null;
    if (!p?.id || p.sceneKey !== optsRef.current.def.key) return;
    const old = itemsRef.current.find((x) => x.id === p.id);
    const next: WorldPlacement = { ...old, ...p, public: false, asset: p.asset ?? old?.asset };
    setItems((cur) => (cur.some((x) => x.id === p.id) ? cur.map((x) => (x.id === p.id ? next : x)) : [...cur, next]));
    h.upsertPlacement(toPlaced(next));
  }, []);

  /** 给模型的场景状态:摆了什么(id:叫法) */
  const placedSummary = React.useMemo(() => items.slice(-30).map((p) => `${p.id}:${p.label || p.asset?.nameZh || p.assetKey}${p.public ? '(公共)' : ''}`), [items]);

  return { handleTool, placedSummary, count: items.length, items, placeAsset, patchItem, removeItem, restoreItem, applyRemote, design, applyDesign, cancelDesign, applying };
}
