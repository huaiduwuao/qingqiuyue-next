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
 *
 * 十期:灯(interact = 'lamp')亮着时灯头上一团暖光(加色精灵)、灯罩 / 玻璃材质自发光;离镜头最近的几盏
 * 分到一个点光源池(高画质 4 个、流畅 1 个,第一盏灯出现时才建,之后数量不变 —— 灯数一变 three 要重编所有着色器)。
 * 能坐的(interact = 'seat')按模型量座位:从上往下打射线找座面,四个方向里最高的一边是靠背,对面是正面;
 * 两边一样高(凳子、长椅)就面朝走过来的人;宽的沙发 / 长椅按 0.55 米一个座位排开。
 *
 * 世界模型(docs/WORLD-MODEL.md):实体按服务端算好的属性画 —— look.shape 没有模型时画简单形状(盒子、圆柱、球、圆盘),
 * props.visible 隐藏、props.emits 发光(颜色 / 强度 / 半径,和老的灯共用光源池)、props.label 头顶文字、
 * props.solid = false 或带 zone 的(区域)不挡路;规则改了位置 / 朝向(anim 毫秒)就平滑地挪过去。
 */

import type * as THREE from 'three';
import { createRealKit, type RealKit } from './realKit';
import type { Obstacle } from './worldLayout';
import { guessSeatHeight, seatCount, type Interact, type SeatSpot } from './interact';

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
  /** 十期:能坐 / 是灯 */
  interact?: Interact | null;
  /** 十期:灯关着 */
  off?: boolean;
  /** 世界模型:原型、外观、算好的属性、动画毫秒数 */
  kind?: string;
  look?: { model?: string; shape?: string; color?: string; size?: number[] };
  props?: { solid?: boolean; visible?: boolean; emits?: { color?: string; intensity?: number; radius?: number }; label?: unknown; zone?: unknown; sense?: boolean; [k: string]: unknown };
  anim?: number;
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
  /** 十期:射线点中的摆放和点中的位置 */
  pickHit: (raycaster: THREE.Raycaster) => { id: string; point: { x: number; y: number; z: number } } | null;
  /** 十期:这件能坐的摆设上有哪些座位(世界坐标);from = 人现在在哪(两边一样高时面朝他) */
  seatSpots: (id: string, from: { x: number; z: number }) => SeatSpot[];
  /** 十期:某件摆放现在的记录 */
  get: (id: string) => PlacedObject | null;
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
  /** 十期:灯头那团光;灯罩材质(各自拷过一份) */
  lampGlow?: THREE.Sprite | null;
  lampMats?: THREE.MeshStandardMaterial[];
  /** 世界模型:画成简单形状的(没有模型)、头顶文字、规则动画、上次的属性(变了才重画灯) */
  primitive?: boolean;
  labelSprite?: THREE.Sprite | null;
  labelText?: string;
  tween?: { from: THREE.Vector3; to: THREE.Vector3; r0: number; r1: number; t0: number; ms: number } | null;
  propsKey?: string;
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
    // 规则让它动(anim 毫秒):从现在的位置平滑过去
    if (p.anim && p.anim > 0 && e.model) {
      let d = p.rotY - e.g.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      e.tween = { from: e.g.position.clone(), to: new THREE_NS.Vector3(p.x, p.y, p.z), r0: e.g.rotation.y, r1: e.g.rotation.y + d, t0: performance.now(), ms: p.anim };
      return;
    }
    e.tween = null;
    e.g.position.set(p.x, p.y, p.z);
    e.g.rotation.y = p.rotY;
  }

  // ── 世界模型:简单形状、头顶文字 ──
  /** 没有模型的实体画成简单形状;size 是半宽 / 半高 / 半深,脚底在 0 */
  function buildPrimitive(e: Entry) {
    const look = e.p.look ?? {};
    const [hx = 0.25, hy = 0.25, hz = hx] = look.size ?? [];
    let geo: THREE.BufferGeometry;
    let y = hy;
    switch (look.shape) {
      case 'cylinder': geo = new THREE_NS.CylinderGeometry(hx, hx, hy * 2, 20); break;
      case 'disc': geo = new THREE_NS.CylinderGeometry(hx, hx, Math.max(0.01, hy * 2), 28); break;
      case 'sphere': geo = new THREE_NS.SphereGeometry(hx, 20, 14); y = Math.max(hx, 0.6); break;
      default: geo = new THREE_NS.BoxGeometry(hx * 2, hy * 2, hz * 2);
    }
    const mat = new THREE_NS.MeshStandardMaterial({ color: new THREE_NS.Color(look.color || '#cccccc'), roughness: 0.6, transparent: look.shape === 'disc', opacity: look.shape === 'disc' ? 0.55 : 1, name: 'emiss' });
    const mesh = new THREE_NS.Mesh(geo, mat);
    mesh.position.y = y;
    mesh.castShadow = look.shape !== 'disc';
    const wrap = new THREE_NS.Group();
    wrap.add(mesh);
    e.model = wrap;
    e.primitive = true;
    e.obox = undefined;
    e.g.add(wrap);
    if (e.glow) { e.g.remove(e.glow); e.glow = null; }
    e.grow = Math.min(e.grow, 0.001);
    if (isLightSource(e)) setupLamp(e);
  }

  function labelTextOf(p: PlacedObject): string {
    const l = p.props?.label;
    if (typeof l === 'string') return l;
    if (l && typeof l === 'object' && typeof (l as { text?: unknown }).text === 'string') return (l as { text: string }).text;
    return '';
  }
  function updateLabel(e: Entry) {
    const text = labelTextOf(e.p).slice(0, 40);
    if (text === (e.labelText ?? '')) return;
    e.labelText = text;
    if (e.labelSprite) { e.g.remove(e.labelSprite); e.labelSprite.material.map?.dispose(); e.labelSprite.material.dispose(); e.labelSprite = null; }
    if (!text) return;
    const c = document.createElement('canvas');
    const g2 = c.getContext('2d');
    if (!g2) return;
    g2.font = 'bold 30px sans-serif';
    const w = Math.ceil(g2.measureText(text).width) + 28;
    c.width = w; c.height = 46;
    g2.font = 'bold 30px sans-serif';
    g2.fillStyle = 'rgba(16,18,28,0.82)';
    g2.fillRect(0, 0, w, 46);
    g2.fillStyle = '#fff';
    g2.textBaseline = 'middle';
    g2.fillText(text, 14, 24);
    const tex = new THREE_NS.CanvasTexture(c);
    const s = new THREE_NS.Sprite(new THREE_NS.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    s.scale.set(w / 46 * 0.22, 0.22, 1);
    s.renderOrder = 6;
    const b = e.obox === undefined ? (e.obox = measure(e)) : e.obox;
    s.position.y = (b ? b.y1 : 0.8) + 0.3;
    e.labelSprite = s;
    e.g.add(s);
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
      e.lampMats = undefined;
      e.g.add(obj);
      if (e.glow) { e.g.remove(e.glow); e.glow = null; }
      if (isLightSource(e) && !e.p.ghost) setupLamp(e);
      // 模型换了(高度变了):头顶文字按新高度重放
      if (e.labelText) { e.labelText = ''; updateLabel(e); }
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
    const keyChanged = e.p.assetKey !== p.assetKey || (!p.assetKey && JSON.stringify(e.p.look) !== JSON.stringify(p.look));
    const offChanged = !!e.p.off !== !!p.off;
    const propsKey = JSON.stringify(p.props ?? null);
    const propsChanged = propsKey !== e.propsKey;
    e.propsKey = propsKey;
    e.p = p;
    if ((offChanged || propsChanged) && e.model && isLightSource(e)) {
      if (!e.lampMats) setupLamp(e); else applyLamp(e);
    }
    place(e);
    e.g.visible = p.props?.visible !== false;
    if (keyChanged) { if (e.model) e.g.remove(e.model); e.model = null; e.obox = undefined; e.loadedKey = ''; e.loadingKey = ''; e.distLevel = -1; e.lodBroken = false; e.lampMats = undefined; e.primitive = false; }
    if (propsChanged) updateLabel(e);
    if (!p.assetKey) {
      // 世界模型:没有模型的实体(按钮、告示牌、区域……)画成简单形状
      if (!e.model) { buildPrimitive(e); updateLabel(e); }
    } else if (p.status === 'ready') loadModel(e);
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
      // 世界模型:不挡人的(solid = false)、区域、藏起来的,都不算障碍
      if (e.p.props && (e.p.props.solid === false || e.p.props.sense || e.p.props.zone || e.p.props.visible === false)) continue;
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

  // ── 十期:灯 ──
  let glowTex: THREE.Texture | null = null;
  const glowTexture = (): THREE.Texture | null => {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g2 = c.getContext('2d');
    if (!g2) return null; // 没有 2D 画布(测试环境):光团只用颜色
    const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,240,210,1)');
    grad.addColorStop(0.25, 'rgba(255,200,130,0.65)');
    grad.addColorStop(1, 'rgba(255,170,90,0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 64, 64);
    glowTex = new THREE_NS.CanvasTexture(c);
    return glowTex;
  };
  const LAMP_MAT_RE = /(glass|bulb|shade|light|lamp|emiss|candle|flame|paper|wick|lantern|fabric)/i;
  const warm = new THREE_NS.Color(1, 0.72, 0.42);
  /** 灯模型到了:材质各拷一份(同一种灯的别的摆放不受影响),认得出的灯罩 / 玻璃 / 灯泡发光,灯头挂一团光 */
  function setupLamp(e: Entry) {
    if (!e.model) return;
    const shades: THREE.MeshStandardMaterial[] = [];
    const all: THREE.MeshStandardMaterial[] = [];
    e.model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const next = list.map((m) => {
        const sm = m as THREE.MeshStandardMaterial;
        if (!sm || !('emissive' in sm)) return m;
        const c = sm.clone();
        c.userData.lampBase = { e: c.emissive.clone(), i: c.emissiveIntensity };
        all.push(c);
        if (LAMP_MAT_RE.test(sm.name || '') || LAMP_MAT_RE.test(sm.map?.name || '') || !!sm.emissiveMap || sm.transparent) shades.push(c);
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? next : next[0];
    });
    // 认不出灯罩(材质名没规律)就整盏灯微微发光
    e.lampMats = shades.length ? shades : all;
    for (const m of e.lampMats) m.userData.lampWeak = !shades.length;
    if (!e.lampGlow) {
      e.lampGlow = new THREE_NS.Sprite(new THREE_NS.SpriteMaterial({ map: glowTexture(), color: 0xffd9a8, blending: THREE_NS.AdditiveBlending, depthWrite: false, transparent: true }));
      e.g.add(e.lampGlow);
    }
    if (e.obox === undefined) e.obox = measure(e);
    const b = e.obox;
    if (b) {
      e.lampGlow.position.set(b.cx, b.y0 + (b.y1 - b.y0) * 0.78, b.cz);
      const size = Math.max(0.25, Math.min(1.2, Math.max(b.hx, b.hz) * 1.1));
      e.lampGlow.scale.set(size, size, size);
    }
    applyLamp(e);
  }
  /** 会发光的:老的灯(interact = lamp)或者世界模型里带 emits 属性的 */
  function isLightSource(e: Entry) { return e.p.interact === 'lamp' || !!e.p.props?.emits; }
  /** 此刻亮着:emits 的强度 > 0(且没藏起来);老的灯看 off */
  function isLit(e: Entry) {
    const em = e.p.props?.emits;
    if (em) return (em.intensity ?? 0) > 0 && e.p.props?.visible !== false;
    return !e.p.off;
  }
  function applyLamp(e: Entry) {
    const on = isLit(e);
    const em = e.p.props?.emits;
    const tint = em?.color ? new THREE_NS.Color(em.color) : warm;
    if (e.lampGlow) (e.lampGlow.material as THREE.SpriteMaterial).color.copy(tint);
    if (e.lampGlow) e.lampGlow.visible = on;
    for (const m of e.lampMats ?? []) {
      const base = m.userData.lampBase as { e: THREE.Color; i: number };
      if (on) {
        m.emissive.copy(tint);
        m.emissiveIntensity = m.userData.lampWeak ? 0.25 : 1.4;
      } else {
        m.emissive.copy(base.e);
        m.emissiveIntensity = base.i;
      }
    }
    lightsDirty = true;
  }
  // 点光源池:第一盏灯出现时建,数量之后不变
  let lights: THREE.PointLight[] | null = null;
  let lightsDirty = false;
  const lp = new THREE_NS.Vector3();
  function assignLights() {
    lightsDirty = false;
    const lit = Array.from(entries.values()).filter((e) => isLightSource(e) && isLit(e) && e.lampGlow && e.grow >= 0);
    if (!lit.length && !lights) return;
    if (!lights) {
      const n = opts.quality === 'high' ? 4 : 1;
      lights = Array.from({ length: n }, () => {
        const l = new THREE_NS.PointLight(0xffc98a, 0, 7, 2);
        root.add(l);
        return l;
      });
    }
    lit.sort((a, b) => a.g.position.distanceToSquared(camPos) - b.g.position.distanceToSquared(camPos));
    lights.forEach((l, i) => {
      const e = lit[i];
      if (!e) { l.intensity = 0; return; }
      e.lampGlow!.getWorldPosition(lp);
      root.worldToLocal(lp);
      l.position.copy(lp);
      const em = e.p.props?.emits;
      if (em) {
        l.color.set(em.color || '#ffc98a');
        l.distance = Math.max(1, Math.min(20, em.radius ?? 7));
        l.intensity = Math.max(0, Math.min(20, em.intensity ?? 6));
      } else {
        l.color.set(0xffc98a);
        l.distance = 7;
        l.intensity = 6 * Math.max(0.6, Math.min(2, e.p.scale || 1));
      }
    });
  }

  // ── 十期:座位 ──
  const ray = new THREE_NS.Raycaster();
  const down = new THREE_NS.Vector3(0, -1, 0);
  const rv = new THREE_NS.Vector3();
  /** 在组里的 (lx, lz) 处从 fromY 往下打一条射线,返回打到的世界高度(打不到 = null) */
  function topAt(e: Entry, lx: number, lz: number, fromY: number): number | null {
    if (!e.model) return null;
    rv.set(lx, fromY, lz);
    e.g.localToWorld(rv);
    ray.set(rv, down);
    ray.far = 10;
    const hit = ray.intersectObject(e.model, true)[0];
    return hit ? hit.point.y : null;
  }
  function seatSpots(id: string, from: { x: number; z: number }): SeatSpot[] {
    const e = entries.get(id);
    if (!e || !e.model || e.p.interact !== 'seat') return [];
    e.g.updateMatrixWorld(true);
    if (e.obox === undefined) e.obox = measure(e);
    const b = e.obox;
    if (!b) return [];
    const s = e.p.scale || 1;
    const top = b.y1 + 0.05;
    // 四条边上量一下多高:最高的那边是靠背
    // 每条边从里到外量三处取最高(靠背常常是最外沿薄薄一片)
    const edge = (dx: number, dz: number) => {
      let h: number | null = null;
      for (const k of [0.7, 0.85, 0.97]) {
        const y = topAt(e, b.cx + dx * b.hx * k, b.cz + dz * b.hz * k, top);
        if (y !== null && (h === null || y > h)) h = y;
      }
      return h;
    };
    const sides = [
      { dx: 0, dz: 1, h: edge(0, 1) },
      { dx: 0, dz: -1, h: edge(0, -1) },
      { dx: 1, dz: 0, h: edge(1, 0) },
      { dx: -1, dz: 0, h: edge(-1, 0) },
    ];
    const hs = sides.map((x) => x.h ?? -Infinity);
    const hiI = hs.indexOf(Math.max(...hs));
    const finite = hs.filter((h) => h > -Infinity);
    const lo = finite.length ? Math.min(...finite) : 0;
    const height = (b.y1 - b.y0) * s;
    let front: { dx: number; dz: number };
    if (hs[hiI] > -Infinity && hs[hiI] - lo > Math.max(0.12, height * 0.15)) {
      front = { dx: -sides[hiI].dx, dz: -sides[hiI].dz };
    } else {
      // 没有靠背:沿短边那个方向,朝着走过来的人
      rv.set(from.x, e.g.position.y, from.z);
      e.g.worldToLocal(rv);
      if (b.hx >= b.hz) front = { dx: 0, dz: rv.z - b.cz >= 0 ? 1 : -1 };
      else front = { dx: rv.x - b.cx >= 0 ? 1 : -1, dz: 0 };
    }
    const depth = front.dz !== 0 ? b.hz : b.hx; // 前后方向的半深(组里的单位)
    const width = (front.dz !== 0 ? b.hx : b.hz) * 2 * s;
    const n = seatCount(width);
    const lat = { dx: front.dz, dz: -front.dx }; // 横向
    const floorY = e.g.position.y - e.p.y; // 摆放的 y 是离地高度
    const out: SeatSpot[] = [];
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : ((i + 0.5) / n - 0.5) * (width / s) * 0.9;
      // 座位中心往前挪一点(后半边是靠背)
      const lx = b.cx + front.dx * depth * 0.1 + lat.dx * off;
      const lz = b.cz + front.dz * depth * 0.1 + lat.dz * off;
      const hit = topAt(e, lx, lz, top);
      const bottom = e.p.y + b.y0 * s;
      let seatY = hit !== null ? hit - floorY : NaN;
      if (!(seatY > bottom + 0.12 && seatY < bottom + 1.1)) seatY = bottom + guessSeatHeight(height);
      const p = e.g.localToWorld(new THREE_NS.Vector3(lx, 0, lz));
      const a = e.g.localToWorld(new THREE_NS.Vector3(lx + front.dx * (depth + 0.45 / s), 0, lz + front.dz * (depth + 0.45 / s)));
      const f = new THREE_NS.Vector3(front.dx, 0, front.dz).applyQuaternion(e.g.quaternion);
      out.push({ x: p.x, z: p.z, y: Math.max(0.1, seatY), yaw: Math.atan2(f.x, f.z), approach: { x: a.x, z: a.z } });
    }
    return out;
  }

  function pickHit(raycaster: THREE.Raycaster) {
    const hits = raycaster.intersectObjects(Array.from(entries.values()).filter((e) => e.grow >= 0 && !e.p.ghost).map((e) => e.g), true);
    for (const h of hits) {
      if (h.object.name === 'spawn-ring' || (h.object as THREE.Sprite).isSprite) continue;
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.placementId === undefined) o = o.parent;
      if (o) return { id: o.userData.placementId as string, point: { x: h.point.x, y: h.point.y, z: h.point.z } };
    }
    return null;
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
    assignLights();
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
    // 世界模型:规则动画(门转开、平台升起……)
    const nowMs = performance.now();
    for (const e of entries.values()) {
      const tw = e.tween;
      if (!tw) continue;
      const k = Math.min(1, (nowMs - tw.t0) / tw.ms);
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      e.g.position.lerpVectors(tw.from, tw.to, ease);
      e.g.rotation.y = tw.r0 + (tw.r1 - tw.r0) * ease;
      if (k >= 1) { e.tween = null; lightsDirty = true; }
    }
    if (lightsDirty) assignLights();
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
    pickHit,
    seatSpots,
    get: (id) => entries.get(id)?.p ?? null,
    dispose: () => {
      disposed = true;
      parent.remove(root);
      glowGeo.dispose(); glowMat.dispose(); ringGeo.dispose(); ringMat.dispose();
      glowTex?.dispose();
      entries.forEach((e) => { e.lampMats?.forEach((m) => m.dispose()); (e.lampGlow?.material as THREE.Material | undefined)?.dispose(); });
      selRing.geometry.dispose(); (selRing.material as THREE.Material).dispose();
      entries.forEach((e) => e.g.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && o.name === 'spawn-ring') m.dispose(); }));
      entries.clear();
      kit.dispose();
    },
  };
}
