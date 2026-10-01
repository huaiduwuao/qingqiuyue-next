/**
 * vrm/world/worldObjects.ts — 「言出法随」摆出来的东西
 *
 * 每件摆放(worldapp 的 world_placement)在场景里是一个组:位置 / 朝向 / 大小照记录来,
 * 模型是 qq-media/world/models/<key>.glb(Blender 流水线加工的 Poly Haven CC0 素材),同一种只下一次。
 *   - 素材还在现做(processing / available):先放一团缓缓脉动的光,外面每 8 秒问一次进度,做好了换成实物
 *   - 一个文件里并排放着好几件的(一组石头、一排草):只取第一件,挪回原点
 *   - 新摆的从小长大、脚下一圈光,删掉的缩回去再拿走
 * 画风无关:风格化场景里摆出来的也是这些实景模型。
 *
 * 创世:用户上传的模型按 file 加载(加工完之前是原文件 uploads/<key>/src.glb),加载后归一化
 * (脚底中心到原点、厘米单位缩回米);房间布置时可以点选(pick)、高亮选中的那件,gizmo 直接拖它的组。
 *
 * 创世五期:素材有三档(lods:近 / 中 / 远,meshopt + KTX2)时按离镜头多远挑一档 —— 8 米内近档、20 米内中档、
 * 再远远档,东西越大换档越晚;流畅画质整体降一档。每半秒看一次,离边界不到 10% 不换(免得来回闪);
 * 新的一档下好之前一直显示旧的。没有分档、没有 renderer(解不了 KTX2)或者分档文件加载失败,就用老格式 file。
 *
 * 八期:obstacles() 给出每件摆设在地上占的那块(模型在自己组里的包围盒,带上转向 / 缩放),人走路绕开它们;
 * 地毯、吊灯、灯杆、栈桥这类不挡(blocksWalking)。
 */

import type * as THREE from 'three';
import { createRealKit, type RealKit } from './realKit';
import type { Obstacle } from './worldLayout';

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
  /** qq-media/world 下的文件;不是 models/<key>.glb 时按它加载(用户上传) */
  file?: string;
  /** 用户上传的:加载后归一化 */
  normalize?: boolean;
  /** 布置方案的预览件:半透明、点不中 */
  ghost?: boolean;
  /** 创世五期:三档文件(近 → 远) */
  lods?: { file: string; bytes?: number }[];
  /** 占地最长边(米):越大的东西越晚换粗的一档 */
  footprint?: number;
}

/** 离镜头 dist 米、大小 size 米的东西该用第几档(0 近 / 1 中 / 2 远)。prev = 上次的结果,离边界不到 10% 不换 */
export function lodByDistance(dist: number, size: number, prev = -1): number {
  const k = Math.max(1, (size || 1) / 1.5);
  const edges = [8 * k, 20 * k];
  let lv = edges.filter((e) => dist >= e).length;
  if (prev >= 0 && Math.abs(lv - prev) === 1) {
    const edge = edges[Math.min(lv, prev)];
    if (Math.abs(dist - edge) < edge * 0.1) lv = prev;
  }
  return lv;
}

/** 按距离档位 + 画质挑实际加载哪一个文件(n = 这件素材有几档);-1 = 没有分档 */
export function lodIndex(distLevel: number, n: number, quality: 'high' | 'low'): number {
  if (n <= 0) return -1;
  const lv = Math.max(0, distLevel) + (quality === 'low' ? 1 : 0);
  return Math.min(n - 1, lv);
}

export interface ObjectLayer {
  set: (list: PlacedObject[]) => void;
  upsert: (p: PlacedObject) => void;
  remove: (id: string) => void;
  list: () => PlacedObject[];
  tick: (t: number, dt: number, camera?: THREE.Camera) => void;
  /** 射线点中了哪一件(返回摆放 id) */
  pick: (raycaster: THREE.Raycaster) => string | null;
  /** 某一件的组(gizmo 挂在它上面) */
  groupOf: (id: string) => THREE.Group | null;
  /** 选中的那件脚下画一圈高亮;null = 取消 */
  setSelected: (id: string | null) => void;
  /** 八期:人走路要绕开的摆设(地上占的那块);缓存 200ms */
  obstacles: () => Obstacle[];
  dispose: () => void;
}

interface Entry {
  p: PlacedObject;
  g: THREE.Group;
  model: THREE.Object3D | null;
  glow: THREE.Mesh | null;
  grow: number; // 0 → 1 长出来;< 0 表示正在缩回去
  loadedKey: string;
  /** 正在下的那一份(下好之前继续显示 loadedKey 那份) */
  loadingKey: string;
  /** 选中高亮圈的半径(按模型大小量一次,0 = 还没量) */
  radius: number;
  /** 五期分档:按距离算出的档位(-1 = 还没算)、分档文件加载失败过(以后只用老格式) */
  distLevel: number;
  lodBroken: boolean;
  /** 八期:模型在组里的包围盒(没缩放;undefined = 还没量,null = 量不出) */
  obox?: LocalBox | null;
}

/** 模型在自己组里的包围盒:地面上的中心 / 半宽,和上下沿 */
interface LocalBox { cx: number; cz: number; hx: number; hz: number; y0: number; y1: number }

/**
 * 一件摆设算不算挡路(s = 缩放后的盒子):太矮的(地毯、草)跨得过去,
 * 挂得高的(吊灯)从底下走,太细的(灯杆、花枝)不挡,特别大的(栈桥、亭子)人要走上去 / 走进去,也不挡。
 */
export function blocksWalking(b: { hx: number; hz: number; bottom: number; top: number }): boolean {
  if (b.top - Math.max(0, b.bottom) < 0.3) return false;
  if (b.bottom > 1.4) return false;
  if (b.hx < 0.08 && b.hz < 0.08) return false;
  if (Math.max(b.hx, b.hz) > 2) return false;
  return true;
}

export function createObjectLayer(
  THREE_NS: typeof THREE,
  parent: THREE.Object3D,
  opts: { base?: string; quality: 'high' | 'low'; lodQuality?: 'high' | 'low'; renderer?: THREE.WebGLRenderer | null },
): ObjectLayer {
  const kit: RealKit = createRealKit(THREE_NS, { base: opts.base, quality: opts.quality, renderer: opts.renderer });
  const lodQuality = opts.lodQuality ?? opts.quality;
  // 最近一次的镜头位置:新摆的东西一出现就按它挑档,不用先下一份再换
  let camKnown = false;
  const camPos = new THREE_NS.Vector3();
  const wp = new THREE_NS.Vector3();
  let lodTimer = 0;
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

  /** 用户上传的模型:脚底中心挪到原点;最长边 > 100 多半是厘米,缩 0.01;太大 / 太小的缩放到能看的尺寸 */
  function normalizeObject(o: THREE.Object3D): THREE.Object3D {
    o.updateMatrixWorld(true);
    const box = new THREE_NS.Box3().setFromObject(o);
    if (box.isEmpty()) return o;
    const size = box.getSize(new THREE_NS.Vector3());
    const longest = Math.max(size.x, size.y, size.z);
    let s = 1;
    if (longest > 100) s = 0.01;
    else if (longest > 30) s = 10 / longest;
    else if (longest < 0.02) s = 0.5 / Math.max(longest, 1e-6);
    const c = box.getCenter(new THREE_NS.Vector3());
    o.position.x -= c.x;
    o.position.y -= box.min.y;
    o.position.z -= c.z;
    const wrap = new THREE_NS.Group();
    wrap.add(o);
    wrap.scale.setScalar(s);
    return wrap;
  }

  /** 这件现在该加载哪一份 */
  function target(e: Entry): { file: string; loadKey: string; lod: boolean } {
    const key = e.p.assetKey;
    const lods = e.p.lods ?? [];
    if (lods.length && kit.canKtx2 && !e.lodBroken) {
      if (e.distLevel < 0 && camKnown) {
        e.g.getWorldPosition(wp);
        e.distLevel = lodByDistance(wp.distanceTo(camPos), sizeOf(e));
      }
      const i = lodIndex(e.distLevel < 0 ? 1 : e.distLevel, lods.length, lodQuality);
      return { file: lods[i].file, loadKey: `lod:${lods[i].file}`, lod: true };
    }
    const file = e.p.file && e.p.file !== `models/${key}.glb` ? e.p.file : '';
    return { file, loadKey: file || key, lod: false };
  }

  const sizeOf = (e: Entry) => Math.max(e.p.footprint ?? 0, e.p.height ?? 0, 0.5) * (e.p.scale || 1);

  function loadModel(e: Entry) {
    const key = e.p.assetKey;
    const t = target(e);
    const { file, loadKey } = t;
    if (e.p.status !== 'ready' || e.loadedKey === loadKey || e.loadingKey === loadKey) return;
    e.loadingKey = loadKey;
    (file ? kit.modelFile(file) : kit.model(key)).then((m) => {
      if (disposed || !entries.has(e.p.id) || e.loadingKey !== loadKey) return;
      e.loadingKey = '';
      e.loadedKey = loadKey;
      let obj = m;
      if (e.p.isSet && m.children.length > 1) {
        // 只取第一件,挪回原点
        const first = m.children.find((c) => { let has = false; c.traverse((o) => { if ((o as THREE.Mesh).isMesh) has = true; }); return has; }) ?? m.children[0];
        m.remove(first);
        first.position.x = 0;
        first.position.z = 0;
        obj = first;
      }
      // 分档文件在流水线里已经归一过;只有用户上传的原文件要在这里归一
      if (e.p.normalize && !t.lod) obj = normalizeObject(obj);
      if (e.p.ghost) {
        // 预览:材质各自拷一份再调透明,不影响同一模型的正式摆放
        obj.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
            const c = (m as THREE.Material).clone() as THREE.MeshStandardMaterial;
            c.transparent = true; c.opacity = 0.45; c.depthWrite = false; c.alphaTest = 0;
            if (c.emissive) c.emissive.setRGB(0.08, 0.35, 0.4);
            return c;
          });
          mesh.material = Array.isArray(mesh.material) ? mats : mats[0];
          mesh.castShadow = false;
        });
      }
      const first = !e.model;
      if (e.model) e.g.remove(e.model);
      e.model = obj;
      e.radius = 0;
      e.obox = undefined;
      e.g.add(obj);
      if (e.glow) { e.g.remove(e.glow); e.glow = null; }
      if (first) e.grow = Math.min(e.grow, 0.001); // 实物到了:从小长出来(换档不用)
    }).catch(() => {
      if (e.loadingKey !== loadKey) return;
      e.loadingKey = '';
      if (t.lod) {
        // 分档文件不行(浏览器解不了 KTX2 之类):以后这件只用老格式
        e.lodBroken = true;
        loadModel(e);
      }
      /* 老格式也失败:下次 upsert 再试 */
    });
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
      e = { p, g, model: null, glow: null, grow: 0.001, loadedKey: '', loadingKey: '', radius: 0, distLevel: -1, lodBroken: false };
      entries.set(p.id, e);
    }
    const keyChanged = e.p.assetKey !== p.assetKey;
    e.p = p;
    place(e);
    if (keyChanged) { if (e.model) e.g.remove(e.model); e.model = null; e.obox = undefined; e.loadedKey = ''; e.loadingKey = ''; e.distLevel = -1; e.lodBroken = false; }
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

  // 选中高亮:地上一圈青色的环,跟着那件东西走(gizmo 拖动时也跟)
  const selRing = new THREE_NS.Mesh(new THREE_NS.RingGeometry(0.92, 1, 56), new THREE_NS.MeshBasicMaterial({ color: 0x25f4ee, transparent: true, opacity: 0.85, depthWrite: false, side: THREE_NS.DoubleSide }));
  selRing.rotation.x = -Math.PI / 2;
  selRing.visible = false;
  selRing.renderOrder = 2;
  selRing.userData.noCapture = true; // 截封面时不画
  root.add(selRing);
  let selected: string | null = null;
  const tmpBox = new THREE_NS.Box3();
  const tmpV = new THREE_NS.Vector3();

  function pick(raycaster: THREE.Raycaster): string | null {
    const hits = raycaster.intersectObjects(Array.from(entries.values()).filter((e) => e.grow >= 0 && !e.p.ghost).map((e) => e.g), true);
    for (const h of hits) {
      if (h.object.name === 'spawn-ring') continue;
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.placementId === undefined) o = o.parent;
      if (o) return o.userData.placementId as string;
    }
    return null;
  }

  /** 量模型在组里的包围盒:每个网格的几何包围盒乘上「组 → 网格」的矩阵(组自己的位置 / 转向 / 缩放不算) */
  const invG = new THREE_NS.Matrix4();
  const relM = new THREE_NS.Matrix4();
  const meshBox = new THREE_NS.Box3();
  function measure(e: Entry): LocalBox | null {
    if (!e.model) return null;
    e.g.updateMatrixWorld(true);
    invG.copy(e.g.matrixWorld).invert();
    tmpBox.makeEmpty();
    e.model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (!mesh.geometry.boundingBox) return;
      relM.multiplyMatrices(invG, mesh.matrixWorld);
      meshBox.copy(mesh.geometry.boundingBox).applyMatrix4(relM);
      tmpBox.union(meshBox);
    });
    if (tmpBox.isEmpty()) return null;
    return {
      cx: (tmpBox.min.x + tmpBox.max.x) / 2, cz: (tmpBox.min.z + tmpBox.max.z) / 2,
      hx: (tmpBox.max.x - tmpBox.min.x) / 2, hz: (tmpBox.max.z - tmpBox.min.z) / 2,
      y0: tmpBox.min.y, y1: tmpBox.max.y,
    };
  }
  let obsCache: Obstacle[] = [];
  let obsAt = -1;
  function obstacles(): Obstacle[] {
    const now = performance.now();
    if (obsAt >= 0 && now - obsAt < 200) return obsCache;
    const out: Obstacle[] = [];
    for (const e of entries.values()) {
      // 长出来一半之前组的缩放接近 0,量不准;预览件(半透明)不挡
      if (e.grow < 1 || e.p.ghost || !e.model) continue;
      if (e.obox === undefined) e.obox = measure(e);
      const b = e.obox;
      if (!b) continue;
      const s = e.p.scale || 1;
      const hx = b.hx * s, hz = b.hz * s;
      if (!blocksWalking({ hx, hz, bottom: e.g.position.y + b.y0 * s, top: e.g.position.y + b.y1 * s })) continue;
      const rot = e.g.rotation.y;
      const c = Math.cos(rot), sn = Math.sin(rot);
      out.push({ x: e.g.position.x + (b.cx * c + b.cz * sn) * s, z: e.g.position.z + (-b.cx * sn + b.cz * c) * s, hx, hz, rot });
    }
    obsCache = out;
    obsAt = now;
    return out;
  }

  const ease = (x: number) => 1 - Math.pow(1 - x, 3);
  /** 每半秒按离镜头的距离换档 */
  function tickLod(dt: number, camera?: THREE.Camera) {
    if (!camera) return;
    camera.getWorldPosition(camPos);
    camKnown = true;
    lodTimer -= dt;
    if (lodTimer > 0) return;
    lodTimer = 0.5;
    for (const e of entries.values()) {
      if (e.grow < 0 || !e.p.lods?.length || e.lodBroken || e.p.status !== 'ready') continue;
      e.g.getWorldPosition(wp);
      const lv = lodByDistance(wp.distanceTo(camPos), sizeOf(e), e.distLevel);
      if (lv !== e.distLevel) {
        e.distLevel = lv;
        loadModel(e);
      }
    }
  }

  function tick(t: number, dt: number, camera?: THREE.Camera) {
    tickLod(dt, camera);
    const sel = selected ? entries.get(selected) : undefined;
    if (sel && sel.grow >= 0) {
      if (!sel.radius && (sel.model || sel.glow)) {
        sel.g.updateMatrixWorld(true);
        tmpBox.setFromObject(sel.model ?? sel.glow!);
        const s = tmpBox.getSize(tmpV);
        sel.radius = Math.max(0.35, Math.hypot(s.x, s.z) / 2 + 0.12);
      }
      selRing.visible = true;
      selRing.position.set(sel.g.position.x, sel.g.position.y + 0.03, sel.g.position.z);
      const r = (sel.radius || 0.6) * (0.97 + 0.03 * Math.sin(t * 4));
      selRing.scale.setScalar(r);
    } else {
      selRing.visible = false;
    }
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
    pick,
    groupOf: (id) => entries.get(id)?.g ?? null,
    setSelected: (id) => { selected = id; const e = id ? entries.get(id) : undefined; if (e) e.radius = 0; },
    obstacles,
    dispose: () => {
      disposed = true;
      parent.remove(root);
      glowGeo.dispose(); glowMat.dispose(); ringGeo.dispose(); ringMat.dispose();
      selRing.geometry.dispose(); (selRing.material as THREE.Material).dispose();
      entries.forEach((e) => e.g.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && o.name === 'spawn-ring') m.dispose(); }));
      entries.clear();
      kit.dispose();
    },
  };
}
