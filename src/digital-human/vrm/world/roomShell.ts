/**
 * vrm/world/roomShell.ts — 创世:每人一间房的「外壳」
 *
 * 房间立在湖心石台上,开口朝 +z(默认镜头那边)。四种程序化模板 + 一种高斯泼溅:
 *   study      书斋:木地板、三面粉墙(护墙板 + 后墙花窗)、顶上几根梁,不封顶(镜头从上往下也看得见)
 *   loft       阁楼:深色地板、人字梁、后墙圆窗
 *   courtyard  庭院:石板地、一圈矮粉墙黛瓦、后墙月洞门
 *   empty      空地:一块木平台
 *   splat      扫描的真实空间:Spark 画高斯泼溅(用户在「房间设置」里对齐),地面换成看不见的点击平面
 *
 * 墙挡在镜头和房间中间时自动变半透明(娃娃屋式),转镜头不会被墙糊脸。
 * 几何全是基础体 + 画布贴图,不下载任何模型;泼溅文件按需动态加载 Spark。
 */

import type * as THREE from 'three';
import { ROOM_SIZES, type RoomShellAlign, type WorldRoomInfo } from './worldLayout';

export type SplatStatus = 'none' | 'loading' | 'ready' | 'error';

export interface RoomShell {
  group: THREE.Group;
  /** 点击走路用的地面(模板的地板;泼溅是看不见的平面) */
  floor: THREE.Mesh;
  /** 石台地面要不要藏(泼溅自带地面) */
  hideIslandGround: boolean;
  tick: (t: number, camera: THREE.Camera) => void;
  /** 泼溅:实时改对齐(房间设置里拖滑杆) */
  setAlign: (a: RoomShellAlign) => void;
  /** 泼溅:按包围盒自动摆正(水平居中、底面落到地上),返回算出来的对齐;没加载好返回 null */
  autoFit: () => RoomShellAlign | null;
  splatStatus: () => SplatStatus;
  dispose: () => void;
}

export interface RoomShellOptions {
  renderer?: THREE.WebGLRenderer | null;
  quality?: 'high' | 'low';
  onSplatStatus?: (s: SplatStatus, info?: { error?: string; splats?: number }) => void;
}

/** 画一张木地板贴图(一排排错缝的木条,深浅不一) */
function plankTexture(THREE_NS: typeof THREE, base: [number, number, number], seed: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const cx = cv.getContext('2d')!;
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const rows = 8;
  const h = 512 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 200;
    while (x < 512) {
      const w = 140 + rnd() * 160;
      const k = 0.82 + rnd() * 0.3;
      cx.fillStyle = `rgb(${Math.round(base[0] * k)},${Math.round(base[1] * k)},${Math.round(base[2] * k)})`;
      cx.fillRect(x, r * h, w, h);
      // 木纹:几条浅浅的横线
      cx.globalAlpha = 0.12;
      for (let i = 0; i < 5; i++) {
        cx.fillStyle = rnd() > 0.5 ? '#000' : '#fff';
        cx.fillRect(x, r * h + rnd() * h, w, 1 + rnd() * 1.5);
      }
      cx.globalAlpha = 1;
      cx.fillStyle = 'rgba(0,0,0,0.45)';
      cx.fillRect(x + w - 2, r * h, 2, h);
      x += w;
    }
    cx.fillStyle = 'rgba(0,0,0,0.5)';
    cx.fillRect(0, r * h + h - 2, 512, 2);
  }
  const t = new THREE_NS.CanvasTexture(cv);
  t.colorSpace = THREE_NS.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE_NS.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** 石板地贴图 */
function stoneTexture(THREE_NS: typeof THREE): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  const cx = cv.getContext('2d')!;
  let s = 11;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  cx.fillStyle = '#6b6a66';
  cx.fillRect(0, 0, 512, 512);
  const n = 4;
  const c = 512 / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const k = 0.85 + rnd() * 0.25;
      const g = Math.round(150 * k);
      cx.fillStyle = `rgb(${g},${Math.round(g * 0.98)},${Math.round(g * 0.93)})`;
      cx.fillRect(i * c + 3, j * c + 3, c - 6, c - 6);
      cx.globalAlpha = 0.08;
      for (let q = 0; q < 30; q++) {
        cx.fillStyle = rnd() > 0.5 ? '#000' : '#fff';
        cx.beginPath();
        cx.arc(i * c + rnd() * c, j * c + rnd() * c, 2 + rnd() * 10, 0, Math.PI * 2);
        cx.fill();
      }
      cx.globalAlpha = 1;
    }
  }
  const t = new THREE_NS.CanvasTexture(cv);
  t.colorSpace = THREE_NS.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE_NS.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function buildRoomShell(THREE_NS: typeof THREE, room: WorldRoomInfo, opts: RoomShellOptions = {}): RoomShell {
  const group = new THREE_NS.Group();
  group.name = 'dh-room-shell';
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };
  const size = ROOM_SIZES[room.template] ?? ROOM_SIZES.study;
  const { hx, hz } = size;
  let disposed = false;

  /** 会在挡住镜头时变透明的墙:朝外的法线 + 墙面上一点 */
  const walls: { o: THREE.Object3D; mats: THREE.Material[]; n: THREE.Vector3; p: THREE.Vector3; fade: number }[] = [];
  const addWall = (o: THREE.Object3D, n: [number, number, number], p: [number, number, number]) => {
    const mats: THREE.Material[] = [];
    o.traverse((c) => {
      const m = (c as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m) return;
      for (const mm of Array.isArray(m) ? m : [m]) if (!mats.includes(mm)) mats.push(mm);
    });
    walls.push({ o, mats, n: new THREE_NS.Vector3(...n), p: new THREE_NS.Vector3(...p), fade: 1 });
    group.add(o);
  };
  const std = (color: number, rough = 0.85, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    track(new THREE_NS.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra }));
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const o = new THREE_NS.Mesh(track(new THREE_NS.BoxGeometry(w, h, d)), m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    return o;
  };

  // ── 地面
  let floorMat: THREE.Material;
  if (room.template === 'splat') {
    floorMat = track(new THREE_NS.MeshBasicMaterial({ visible: false }));
  } else if (room.template === 'courtyard') {
    const t = track(stoneTexture(THREE_NS));
    t.repeat.set(hx / 2, hz / 2);
    floorMat = std(0xffffff, 0.95, { map: t });
  } else {
    const t = track(plankTexture(THREE_NS, room.template === 'loft' ? [120, 84, 58] : room.template === 'empty' ? [168, 128, 88] : [178, 132, 90], room.template.length * 97));
    t.repeat.set(hx / 1.6, hz / 1.6);
    floorMat = std(0xffffff, 0.72, { map: t });
  }
  const floor = new THREE_NS.Mesh(track(new THREE_NS.PlaneGeometry(hx * 2, hz * 2)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  floor.receiveShadow = true;
  floor.name = 'dh-room-floor';
  group.add(floor);
  if (room.template !== 'splat') {
    // 地台的厚度:一圈比地板深一点的边
    // 顶面比地板低 3 厘米:和地板同高会 z-fighting(近处地板一片发暗)
    const skirt = box(hx * 2 + 0.24, 0.18, hz * 2 + 0.24, std(room.template === 'courtyard' ? 0x5c5a55 : 0x4a3424, 0.8), 0, -0.1, 0);
    skirt.castShadow = false;
    skirt.name = 'dh-room-skirt'; // 有地形时跟地板一起藏(挖下去的坑别被它挡住)
    group.add(skirt);
  }

  // ── 墙
  const H = room.template === 'courtyard' ? 1.7 : room.template === 'loft' ? 2.9 : 3.1;
  if (room.template === 'study' || room.template === 'loft' || room.template === 'courtyard') {
    const baseWallMat = std(room.template === 'loft' ? 0xd8c7ad : 0xece4d4, 0.92, { transparent: true });
    const baseTrimMat = std(room.template === 'courtyard' ? 0x2e3138 : 0x5b3a26, 0.6, { transparent: true });
    const T = 0.16;
    const makeWall = (len: number, withWindow: 'lattice' | 'round' | 'moon' | null) => {
      // 每面墙各用一份材质:挡镜头时只淡这一面
      const wallMat = track(baseWallMat.clone());
      const trimMat = track(baseTrimMat.clone());
      const g = new THREE_NS.Group();
      if (!withWindow) {
        g.add(box(len, H, T, wallMat, 0, H / 2, 0));
      } else {
        const shape = new THREE_NS.Shape();
        shape.moveTo(-len / 2, 0); shape.lineTo(len / 2, 0); shape.lineTo(len / 2, H); shape.lineTo(-len / 2, H); shape.lineTo(-len / 2, 0);
        const hole = new THREE_NS.Path();
        if (withWindow === 'lattice') {
          const w = Math.min(2.6, len * 0.3), y0 = 1.0, y1 = 2.3;
          hole.moveTo(-w / 2, y0); hole.lineTo(w / 2, y0); hole.lineTo(w / 2, y1); hole.lineTo(-w / 2, y1); hole.lineTo(-w / 2, y0);
        } else if (withWindow === 'round') {
          hole.absarc(0, H * 0.58, 0.7, 0, Math.PI * 2, false);
        } else {
          hole.absarc(0, 1.05, 0.95, 0, Math.PI * 2, false);
        }
        shape.holes.push(hole);
        const geo = track(new THREE_NS.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false }));
        const m = new THREE_NS.Mesh(geo, wallMat);
        m.position.z = -T / 2;
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
        if (withWindow === 'lattice') {
          // 花窗:外框 + 井字格 + 一层发光的窗纸
          const w = Math.min(2.6, len * 0.3), y0 = 1.0, y1 = 2.3, hh = y1 - y0;
          const bar = (bw: number, bh: number, x: number, y: number) => g.add(box(bw, bh, 0.06, trimMat, x, y, 0));
          bar(w + 0.12, 0.08, 0, y0); bar(w + 0.12, 0.08, 0, y1); bar(0.08, hh, -w / 2, y0 + hh / 2); bar(0.08, hh, w / 2, y0 + hh / 2);
          for (let i = 1; i < 4; i++) bar(0.04, hh, -w / 2 + (w * i) / 4, y0 + hh / 2);
          for (let i = 1; i < 3; i++) bar(w, 0.04, 0, y0 + (hh * i) / 3);
          const paper = new THREE_NS.Mesh(track(new THREE_NS.PlaneGeometry(w, hh)), track(new THREE_NS.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.55 })));
          paper.position.set(0, y0 + hh / 2, -0.04);
          g.add(paper);
        } else if (withWindow === 'round') {
          const ring = new THREE_NS.Mesh(track(new THREE_NS.TorusGeometry(0.7, 0.06, 10, 48)), trimMat);
          ring.position.set(0, H * 0.58, 0);
          g.add(ring);
          const cross = (w: number, h: number) => g.add(box(w, h, 0.05, trimMat, 0, H * 0.58, 0));
          cross(1.4, 0.05); cross(0.05, 1.4);
        } else {
          const ring = new THREE_NS.Mesh(track(new THREE_NS.TorusGeometry(0.95, 0.07, 10, 56)), trimMat);
          ring.position.set(0, 1.05, 0);
          g.add(ring);
        }
      }
      // 护墙板 / 瓦顶
      if (room.template === 'courtyard') {
        const cap = box(len + 0.3, 0.16, 0.5, trimMat, 0, H + 0.08, 0);
        g.add(cap);
      } else {
        g.add(box(len, 0.9, T + 0.03, trimMat, 0, 0.45, 0));
        g.add(box(len, 0.1, T + 0.05, trimMat, 0, H - 0.05, 0));
      }
      return g;
    };
    const back = makeWall(hx * 2, room.template === 'study' ? 'lattice' : room.template === 'loft' ? 'round' : 'moon');
    back.position.set(0, 0, -hz);
    addWall(back, [0, 0, -1], [0, 0, -hz]);
    const left = makeWall(hz * 2, room.template === 'study' ? 'lattice' : null);
    left.rotation.y = Math.PI / 2;
    left.position.set(-hx, 0, 0);
    addWall(left, [-1, 0, 0], [-hx, 0, 0]);
    const right = makeWall(hz * 2, room.template === 'study' ? 'lattice' : null);
    right.rotation.y = -Math.PI / 2;
    right.position.set(hx, 0, 0);
    addWall(right, [1, 0, 0], [hx, 0, 0]);
    // 墙角的柱子
    for (const [x, z] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]] as const) {
      group.add(box(0.26, H + (room.template === 'courtyard' ? 0.2 : 0.1), 0.26, baseTrimMat, x, (H + 0.1) / 2, z));
    }
    if (room.template === 'study') {
      // 顶上三根梁(不封顶)
      const beam = std(0x5b3a26, 0.6);
      // 梁不投影:太阳从上面照,平视时地板上会是几道很重的黑条
      for (const z of [-hz * 0.5, 0, hz * 0.5]) { const b = box(hx * 2 + 0.3, 0.18, 0.2, beam, 0, H + 0.05, z); b.castShadow = false; group.add(b); }
    } else if (room.template === 'loft') {
      // 人字梁:几榀三角屋架
      const beam = std(0x4a2e1c, 0.6);
      const rise = 1.6;
      const slope = Math.hypot(hx, rise);
      const ang = Math.atan2(rise, hx);
      for (const z of [-hz * 0.66, 0, hz * 0.66]) {
        const l = box(slope, 0.16, 0.18, beam, -hx / 2, H + rise / 2, z); l.rotation.z = ang;
        const r = box(slope, 0.16, 0.18, beam, hx / 2, H + rise / 2, z); r.rotation.z = -ang;
        const tie = box(hx * 2, 0.14, 0.16, beam, 0, H, z);
        const king = box(0.14, rise, 0.14, beam, 0, H + rise / 2, z);
        for (const o of [l, r, tie, king]) { o.castShadow = false; group.add(o); }
      }
      const ridge = box(0.2, 0.2, hz * 2, beam, 0, H + rise, 0);
      ridge.castShadow = false;
      group.add(ridge);
    }
    // 屋里一盏暖光(夜里看得出是有人住的屋子)
    const lamp = new THREE_NS.PointLight(0xffd9a0, room.template === 'courtyard' ? 0 : 6, Math.max(hx, hz) * 2.2, 1.6);
    lamp.position.set(0, H - 0.3, -hz * 0.2);
    group.add(lamp);
  } else if (room.template === 'empty') {
    // 空地:平台四角各一盏小地灯
    const glow = track(new THREE_NS.MeshBasicMaterial({ color: 0xffe3b0 }));
    for (const [x, z] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]] as const) {
      const post = box(0.12, 0.5, 0.12, std(0x3a2a1c, 0.7), x * 0.97, 0.25, z * 0.97);
      const head = new THREE_NS.Mesh(track(new THREE_NS.SphereGeometry(0.09, 12, 8)), glow);
      head.position.set(x * 0.97, 0.56, z * 0.97);
      group.add(post, head);
    }
  }

  // ── 泼溅
  let splatStatus: SplatStatus = room.template === 'splat' && room.splatUrl ? 'loading' : 'none';
  let splat: (THREE.Object3D & { getBoundingBox?: (c?: boolean) => THREE.Box3; dispose?: () => void }) | null = null;
  let spark: (THREE.Object3D & { dispose?: () => void }) | null = null;
  let align: RoomShellAlign = room.shell ?? { x: 0, y: 0, z: 0, scale: 1, rotX: 0, rotY: 0, rotZ: 0 };
  const applyAlign = () => {
    if (!splat) return;
    splat.position.set(align.x, align.y, align.z);
    splat.rotation.set(align.rotX, align.rotY, align.rotZ, 'XYZ');
    splat.scale.setScalar(align.scale > 0 ? align.scale : 1);
  };
  if (room.template === 'splat' && room.splatUrl) {
    // 流畅画质用精简档(≤ 40 万点,手机 / 安卓 WebView 也跑得动);没有精简档就用原文件
    const url = (opts.quality === 'low' && room.splatLiteUrl) || room.splatUrl;
    opts.onSplatStatus?.('loading');
    import('@sparkjsdev/spark').then(async ({ SparkRenderer, SplatMesh }) => {
      if (disposed) return;
      if (opts.renderer) {
        spark = new SparkRenderer({ renderer: opts.renderer }) as unknown as THREE.Object3D;
        group.add(spark);
      }
      // 文件名决定解析器(.spz / .ply / .splat / .ksplat)
      const fileName = url.split('?')[0].split('/').pop() || 'scene.spz';
      const mesh = new SplatMesh({
        url,
        fileName,
        maxSplats: opts.quality === 'low' ? 1_500_000 : undefined,
      }) as unknown as THREE.Object3D & { initialized: Promise<unknown>; getBoundingBox: (c?: boolean) => THREE.Box3; dispose: () => void };
      splat = mesh;
      applyAlign();
      group.add(mesh);
      try {
        await mesh.initialized;
        if (disposed) return;
        splatStatus = 'ready';
        opts.onSplatStatus?.('ready', { splats: (mesh as { splats?: { getNumSplats?: () => number } }).splats?.getNumSplats?.() });
      } catch (e) {
        splatStatus = 'error';
        opts.onSplatStatus?.('error', { error: String((e as Error)?.message || e) });
      }
    }).catch((e) => {
      splatStatus = 'error';
      opts.onSplatStatus?.('error', { error: String((e as Error)?.message || e) });
    });
  }

  /**
   * 自动摆正:在当前旋转下量高斯点中心的分位数(不用包围盒:扫描边上总有飞出去的噪点)。
   *   水平:2%~98% 分位的中点挪到原点;地面:高度 1% 分位(地板那一层)落到 y=0;
   *   单位:扫描软件导出的常是分米 / 厘米,按 10 的倍数换到「一间屋子」的尺度(最长边 1~30 米)。
   */
  function autoFit(): RoomShellAlign | null {
    const s = splat as (typeof splat & { forEachSplat?: (cb: (i: number, c: THREE.Vector3) => void) => void }) | null;
    if (!s?.forEachSplat || splatStatus !== 'ready') return null;
    const m = new THREE_NS.Matrix4().makeRotationFromEuler(new THREE_NS.Euler(align.rotX, align.rotY, align.rotZ, 'XYZ'));
    const xs: number[] = [], ys: number[] = [], zs: number[] = [];
    const v = new THREE_NS.Vector3();
    let n = 0;
    s.forEachSplat(() => { n++; });
    const step = Math.max(1, Math.floor(n / 150_000));
    s.forEachSplat((i, c) => {
      if (i % step) return;
      v.copy(c).applyMatrix4(m);
      xs.push(v.x); ys.push(v.y); zs.push(v.z);
    });
    if (!xs.length) return null;
    const pct = (arr: number[], p: number) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(p * (arr.length - 1))))];
    xs.sort((a, b) => a - b); ys.sort((a, b) => a - b); zs.sort((a, b) => a - b);
    const x0 = pct(xs, 0.02), x1 = pct(xs, 0.98), z0 = pct(zs, 0.02), z1 = pct(zs, 0.98);
    const longest = Math.max(x1 - x0, z1 - z0, 1e-4);
    let scale = align.scale > 0 ? align.scale : 1;
    for (let i = 0; i < 4 && longest * scale > 30; i++) scale *= 0.1;
    for (let i = 0; i < 4 && longest * scale < 1; i++) scale *= 10;
    const floorY = pct(ys, 0.01);
    align = { ...align, scale, x: -((x0 + x1) / 2) * scale, z: -((z0 + z1) / 2) * scale, y: -floorY * scale };
    applyAlign();
    return align;
  }

  const camLocal = new THREE_NS.Vector3();
  function tick(_t: number, camera: THREE.Camera) {
    // 墙在镜头和房间之间(镜头在墙外侧)就淡掉
    for (const w of walls) {
      camLocal.copy(camera.position).sub(w.p);
      const outside = camLocal.dot(w.n) > 0.05;
      const target = outside ? 0.12 : 1;
      if (Math.abs(w.fade - target) < 0.01) continue;
      w.fade += (target - w.fade) * 0.18;
      for (const m of w.mats) {
        const mm = m as THREE.MeshStandardMaterial;
        const baseOpacity = (mm.userData.baseOpacity ??= mm.opacity);
        mm.opacity = baseOpacity * w.fade;
        mm.transparent = true;
        mm.depthWrite = w.fade > 0.9;
      }
      w.o.traverse((c) => { (c as THREE.Mesh).castShadow = w.fade > 0.9; });
    }
  }

  return {
    group,
    floor,
    hideIslandGround: room.template === 'splat',
    tick,
    setAlign: (a) => { align = { ...a }; applyAlign(); },
    autoFit,
    splatStatus: () => splatStatus,
    dispose: () => {
      disposed = true;
      splat?.dispose?.();
      spark?.dispose?.();
      disposables.forEach((d) => d.dispose());
    },
  };
}
