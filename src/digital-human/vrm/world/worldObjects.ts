/**
 * vrm/world/worldObjects.ts — 「言出法随」摆出来的东西
 *
 * 每件摆放(worldapp 的 world_placement)在场景里是一个组:位置 / 朝向 / 大小照记录来,
 * 模型是 qq-media/world/models/<key>.glb(Blender 流水线加工的 Poly Haven CC0 素材),同一种只下一次。
 *   - 素材还在现做(processing / available):先放一团缓缓脉动的光,外面每 8 秒问一次进度,做好了换成实物
 *   - 一个文件里并排放着好几件的(一组石头、一排草):只取第一件,挪回原点
 *   - 新摆的从小长大、脚下一圈光,删掉的缩回去再拿走
 * 画风无关:风格化场景里摆出来的也是这些实景模型。
 */

import type * as THREE from 'three';
import { createRealKit, type RealKit } from './realKit';

export interface PlacedObject {
  id: string;
  assetKey: string;
  label?: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  /** 素材状态:ready 才有模型可加载 */
  status: string;
  nameZh?: string;
  isSet?: boolean;
  height?: number;
}

export interface ObjectLayer {
  set: (list: PlacedObject[]) => void;
  upsert: (p: PlacedObject) => void;
  remove: (id: string) => void;
  list: () => PlacedObject[];
  tick: (t: number, dt: number) => void;
  dispose: () => void;
}

interface Entry {
  p: PlacedObject;
  g: THREE.Group;
  model: THREE.Object3D | null;
  glow: THREE.Mesh | null;
  grow: number; // 0 → 1 长出来;< 0 表示正在缩回去
  loadedKey: string;
}

export function createObjectLayer(THREE_NS: typeof THREE, parent: THREE.Object3D, opts: { base?: string; quality: 'high' | 'low' }): ObjectLayer {
  const kit: RealKit = createRealKit(THREE_NS, opts);
  const root = new THREE_NS.Group();
  root.name = 'dh-world-objects';
  parent.add(root);
  const entries = new Map<string, Entry>();
  let disposed = false;

  // 占位的光团:共用几何 / 材质
  const glowGeo = new THREE_NS.SphereGeometry(0.28, 20, 14);
  const glowMat = new THREE_NS.MeshBasicMaterial({ color: new THREE_NS.Color(1.6, 1.25, 0.7), transparent: true, opacity: 0.85, depthWrite: false });
  const ringGeo = new THREE_NS.RingGeometry(0.35, 0.5, 40);
  const ringMat = new THREE_NS.MeshBasicMaterial({ color: new THREE_NS.Color(1.4, 1.1, 0.6), transparent: true, opacity: 0, depthWrite: false, side: THREE_NS.DoubleSide });

  function place(e: Entry) {
    const { p } = e;
    e.g.position.set(p.x, p.y, p.z);
    e.g.rotation.y = p.rotY;
  }

  function loadModel(e: Entry) {
    const key = e.p.assetKey;
    if (e.p.status !== 'ready' || e.loadedKey === key) return;
    e.loadedKey = key;
    kit.model(key).then((m) => {
      if (disposed || !entries.has(e.p.id) || e.p.assetKey !== key) return;
      let obj = m;
      if (e.p.isSet && m.children.length > 1) {
        // 只取第一件,挪回原点
        const first = m.children.find((c) => { let has = false; c.traverse((o) => { if ((o as THREE.Mesh).isMesh) has = true; }); return has; }) ?? m.children[0];
        m.remove(first);
        first.position.x = 0;
        first.position.z = 0;
        obj = first;
      }
      if (e.model) e.g.remove(e.model);
      e.model = obj;
      e.g.add(obj);
      if (e.glow) { e.g.remove(e.glow); e.glow = null; }
      e.grow = Math.min(e.grow, 0.001); // 实物到了:从小长出来
    }).catch(() => { e.loadedKey = ''; /* 下次再试 */ });
  }

  function upsert(p: PlacedObject) {
    let e = entries.get(p.id);
    if (!e) {
      const g = new THREE_NS.Group();
      g.userData.placementId = p.id;
      const ring = new THREE_NS.Mesh(ringGeo, ringMat.clone());
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      ring.name = 'spawn-ring';
      g.add(ring);
      root.add(g);
      e = { p, g, model: null, glow: null, grow: 0.001, loadedKey: '' };
      entries.set(p.id, e);
    }
    const keyChanged = e.p.assetKey !== p.assetKey;
    e.p = p;
    place(e);
    if (keyChanged && e.model) { e.g.remove(e.model); e.model = null; e.loadedKey = ''; }
    if (p.status === 'ready') loadModel(e);
    else if (!e.glow && !e.model) {
      // 还在现做:一团光占位,高度按素材大约多高放
      e.glow = new THREE_NS.Mesh(glowGeo, glowMat);
      e.glow.position.y = Math.max(0.3, Math.min(1.2, (p.height ?? 0.6) * 0.5));
      e.g.add(e.glow);
    }
  }

  function remove(id: string) {
    const e = entries.get(id);
    if (e) e.grow = -1; // 缩回去,tick 里拿走
  }

  function set(list: PlacedObject[]) {
    const keep = new Set(list.map((p) => p.id));
    for (const [id, e] of entries) if (!keep.has(id)) { root.remove(e.g); entries.delete(id); }
    for (const p of list) upsert(p);
  }

  const ease = (x: number) => 1 - Math.pow(1 - x, 3);
  function tick(t: number, dt: number) {
    for (const [id, e] of entries) {
      const ring = e.g.getObjectByName('spawn-ring') as THREE.Mesh | undefined;
      if (e.grow < 0) {
        e.grow -= dt * 3;
        const k = Math.max(0, 1 + e.grow + 1);
        e.g.scale.setScalar(e.p.scale * Math.max(0.001, k));
        if (k <= 0) { root.remove(e.g); entries.delete(id); }
        continue;
      }
      if (e.grow < 1) {
        e.grow = Math.min(1, e.grow + dt * 1.6);
        const k = ease(e.grow);
        e.g.scale.setScalar(e.p.scale * Math.max(0.001, e.model ? k : 1));
        if (ring) {
          (ring.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - e.grow);
          ring.scale.setScalar(1 + e.grow * 2.5 * Math.max(1, e.p.scale));
        }
      } else {
        e.g.scale.setScalar(e.p.scale);
      }
      if (e.glow) {
        const pulse = 0.85 + 0.15 * Math.sin(t * 3 + e.g.position.x);
        e.glow.scale.setScalar(pulse);
        e.glow.position.y += Math.sin(t * 1.7) * 0.0015;
      }
    }
  }

  return {
    set,
    upsert,
    remove,
    list: () => Array.from(entries.values()).filter((e) => e.grow >= 0).map((e) => e.p),
    tick,
    dispose: () => {
      disposed = true;
      parent.remove(root);
      glowGeo.dispose(); glowMat.dispose(); ringGeo.dispose(); ringMat.dispose();
      entries.forEach((e) => e.g.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && o.name === 'spawn-ring') m.dispose(); }));
      entries.clear();
      kit.dispose();
    },
  };
}
