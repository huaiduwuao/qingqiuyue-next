/**
 * vrm/world/peerAvatars.ts — 创世二期:房间里的其他人,画成他们自己捏的形象
 *
 * 每个同伴一份独立的 VRM(舞台上自己的那份有缓存,不能共用):同一个底模文件只下载一次,每人各解析一份,
 * 套上他的捏人参数(avatarCustomize)。离镜头最近的 MAX_FULL 个人加载完整模型,其余先是一个半透明的人形。
 *
 * 动起来靠插值 + 程序化步态:服务端 10Hz 发位置,这里按指数平滑追过去;按实际移动速度摆腿摆臂
 * (规范化骨骼:upperLeg / upperArm 的 X+ 是往后,lowerLeg 的 X+ 是屈膝),停下来轻轻呼吸。
 * 头顶一块名牌(房主带 🏠),说话时名牌上面冒气泡,5 秒后淡掉。
 */

import type * as THREE from 'three';
import * as THREE_VRM from '@pixiv/three-vrm';
import type { AvatarParams } from '@/apis/world';
import { applyAvatarParams } from '../avatarCustomize';

export interface RoomPeer {
  id: string;
  nickname: string;
  owner?: boolean;
  look: { base: string; params: Record<string, unknown>; version: number };
  x: number;
  y: number;
  z: number;
  yaw: number;
  m?: boolean;
  a?: string;
}

export interface PeerLayer {
  set: (list: RoomPeer[]) => void;
  say: (id: string, text: string) => void;
  tick: (t: number, dt: number, camera: THREE.Camera) => void;
  positions: () => { id: string; x: number; z: number }[];
  dispose: () => void;
}

const MAX_FULL = 10;
const BUBBLE_MS = 5000;

const bufCache = new Map<string, Promise<ArrayBuffer>>();
function fetchBuf(url: string): Promise<ArrayBuffer> {
  let p = bufCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.arrayBuffer(); });
    p.catch(() => bufCache.delete(url));
    bufCache.set(url, p);
  }
  return p;
}

async function loadVrm(url: string): Promise<THREE_VRM.VRM> {
  const [buf, { GLTFLoader }] = await Promise.all([fetchBuf(url), import('three/examples/jsm/loaders/GLTFLoader.js')]);
  const loader = new GLTFLoader();
  loader.register((parser) => new THREE_VRM.VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(buf.slice(0), '');
  const vrm = gltf.userData.vrm as THREE_VRM.VRM | undefined;
  if (!vrm) throw new Error('不是 VRM');
  // 和舞台上自己的形象一样处理:VRM 0.x 转过来面朝 +Z
  try { THREE_VRM.VRMUtils.rotateVRM0(vrm); } catch { /* 1.0 不用转 */ }
  vrm.scene.traverse((o) => { o.frustumCulled = false; (o as THREE.Mesh).castShadow = true; });
  return vrm;
}

function textSprite(THREE_NS: typeof THREE, text: string, opts: { bg: string; color?: string; size?: number; border?: string; worldScale?: number }) {
  const size = opts.size ?? 38;
  const font = `600 ${size}px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif`;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const maxW = size * 14;
  // 长句子折成两行
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (probe.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 3);
  if (lines.length > 3) shown[2] = shown[2].slice(0, -1) + '…';
  const w = Math.ceil(Math.max(...shown.map((l) => probe.measureText(l).width)) + size * 1.2);
  const lh = size * 1.35;
  const h = Math.ceil(lh * shown.length + size * 0.6);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d')!;
  const r = Math.min(h / 2, size * 0.8);
  cx.fillStyle = opts.bg;
  cx.beginPath();
  cx.moveTo(r, 0); cx.lineTo(w - r, 0); cx.quadraticCurveTo(w, 0, w, r); cx.lineTo(w, h - r); cx.quadraticCurveTo(w, h, w - r, h);
  cx.lineTo(r, h); cx.quadraticCurveTo(0, h, 0, h - r); cx.lineTo(0, r); cx.quadraticCurveTo(0, 0, r, 0); cx.closePath();
  cx.fill();
  if (opts.border) { cx.strokeStyle = opts.border; cx.lineWidth = 3; cx.stroke(); }
  cx.font = font;
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillStyle = opts.color ?? '#fff';
  shown.forEach((l, i) => cx.fillText(l, w / 2, size * 0.3 + lh * (i + 0.5)));
  const tex = new THREE_NS.CanvasTexture(cv);
  tex.colorSpace = THREE_NS.SRGBColorSpace;
  const mat = new THREE_NS.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
  const sp = new THREE_NS.Sprite(mat);
  // 舞台镜头视角窄(30°),名牌 / 气泡按一个字约 9 厘米高来画
  const worldH = (h / 38) * (opts.worldScale ?? 0.1);
  sp.scale.set(worldH * (w / h), worldH, 1);
  return sp;
}

function disposeSprite(s: THREE.Sprite) {
  (s.material as THREE.SpriteMaterial).map?.dispose();
  s.material.dispose();
}

interface Entry {
  p: RoomPeer;
  g: THREE.Group;
  label: THREE.Sprite;
  bubble: THREE.Sprite | null;
  bubbleUntil: number;
  ghost: THREE.Mesh;
  vrm: THREE_VRM.VRM | null;
  loadingKey: string;
  loadedKey: string;
  footOffset: number;
  height: number;
  pos: THREE.Vector3;
  yaw: number;
  speed: number;
  phase: number;
  wantFull: boolean;
  fade: number; // 1 在场;<1 正在淡出
  removing: boolean;
}

export function createPeerLayer(
  THREE_NS: typeof THREE,
  parent: THREE.Object3D,
  opts: { resolveUrl: (base: string) => string },
): PeerLayer {
  const root = new THREE_NS.Group();
  root.name = 'dh-room-peers';
  parent.add(root);
  const entries = new Map<string, Entry>();
  let disposed = false;
  const ghostGeo = new THREE_NS.CapsuleGeometry(0.22, 1.05, 6, 12);
  const ghostMat = new THREE_NS.MeshStandardMaterial({ color: 0x9be8ff, transparent: true, opacity: 0.35, emissive: 0x2a6a80, roughness: 0.6 });

  const keyOf = (p: RoomPeer) => `${opts.resolveUrl(p.look?.base || '')}#${p.look?.version ?? 0}#${JSON.stringify(p.look?.params ?? {})}`;

  function makeLabel(e: Entry) {
    if (e.label) { e.g.remove(e.label); disposeSprite(e.label); }
    e.label = textSprite(THREE_NS, `${e.p.owner ? '🏠 ' : ''}${e.p.nickname || '访客'}`, { bg: 'rgba(8,10,20,0.66)', border: e.p.owner ? '#25F4EE' : undefined, size: 34 });
    e.label.position.y = e.height + 0.18;
    e.g.add(e.label);
  }

  function upsert(p: RoomPeer) {
    let e = entries.get(p.id);
    if (!e) {
      const g = new THREE_NS.Group();
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = p.yaw;
      const ghost = new THREE_NS.Mesh(ghostGeo, ghostMat);
      ghost.position.y = 0.75;
      g.add(ghost);
      root.add(g);
      e = {
        p, g, label: null as unknown as THREE.Sprite, bubble: null, bubbleUntil: 0, ghost, vrm: null, loadingKey: '', loadedKey: '',
        footOffset: 0, height: 1.6, pos: new THREE_NS.Vector3(p.x, p.y, p.z), yaw: p.yaw, speed: 0, phase: Math.random() * 6, wantFull: true, fade: 0, removing: false,
      };
      entries.set(p.id, e);
      makeLabel(e);
    } else {
      const nameChanged = e.p.nickname !== p.nickname || !!e.p.owner !== !!p.owner;
      e.p = p;
      e.removing = false;
      if (nameChanged) makeLabel(e);
    }
    maybeLoad(e);
  }

  function maybeLoad(e: Entry) {
    if (!e.wantFull) return;
    const key = keyOf(e.p);
    if (key === e.loadedKey || key === e.loadingKey) return;
    e.loadingKey = key;
    const url = opts.resolveUrl(e.p.look?.base || '');
    loadVrm(url).then((vrm) => {
      if (disposed || entries.get(e.p.id) !== e || e.loadingKey !== key) {
        THREE_VRM.VRMUtils.deepDispose(vrm.scene);
        return;
      }
      if (e.vrm) { e.g.remove(e.vrm.scene); THREE_VRM.VRMUtils.deepDispose(e.vrm.scene); }
      e.vrm = vrm;
      const r = applyAvatarParams(THREE_NS, vrm, (e.p.look?.params ?? {}) as AvatarParams);
      e.footOffset = r.footOffset;
      e.height = r.height;
      vrm.scene.position.y = r.footOffset;
      e.g.add(vrm.scene);
      e.ghost.visible = false;
      e.loadedKey = key;
      e.loadingKey = '';
      makeLabel(e);
    }).catch(() => { e.loadingKey = ''; /* 下载失败:保留人形,下次 set 再试 */ });
  }

  function unloadFull(e: Entry) {
    if (!e.vrm) return;
    e.g.remove(e.vrm.scene);
    THREE_VRM.VRMUtils.deepDispose(e.vrm.scene);
    e.vrm = null;
    e.loadedKey = '';
    e.ghost.visible = true;
  }

  function set(list: RoomPeer[]) {
    const keep = new Set(list.map((p) => p.id));
    for (const [id, e] of entries) if (!keep.has(id)) e.removing = true;
    for (const p of list) upsert(p);
  }

  function say(id: string, text: string) {
    const e = entries.get(id);
    if (!e) return;
    if (e.bubble) { e.g.remove(e.bubble); disposeSprite(e.bubble); }
    e.bubble = textSprite(THREE_NS, text, { bg: 'rgba(255,255,255,0.94)', color: '#16181f', size: 36, worldScale: 0.11 });
    e.bubble.position.y = e.height + 0.34 + e.bubble.scale.y / 2;
    e.g.add(e.bubble);
    e.bubbleUntil = performance.now() + BUBBLE_MS;
  }

  const bone = (vrm: THREE_VRM.VRM, name: THREE_VRM.VRMHumanBoneName) => vrm.humanoid?.getNormalizedBoneNode(name) ?? null;
  const tmp = new THREE_NS.Vector3();
  let lodTimer = 0;

  function animate(e: Entry, t: number, dt: number) {
    const vrm = e.vrm;
    if (!vrm) return;
    const amt = Math.min(1, e.speed / 1.2);
    const running = e.speed > 3;
    e.phase += dt * (running ? 11 : 4 + e.speed * 2.2) * (amt > 0.05 ? 1 : 0);
    const swing = Math.sin(e.phase) * (running ? 0.8 : 0.5) * amt;
    const lUL = bone(vrm, 'leftUpperLeg'), rUL = bone(vrm, 'rightUpperLeg');
    const lLL = bone(vrm, 'leftLowerLeg'), rLL = bone(vrm, 'rightLowerLeg');
    const lUA = bone(vrm, 'leftUpperArm'), rUA = bone(vrm, 'rightUpperArm');
    const lLA = bone(vrm, 'leftLowerArm'), rLA = bone(vrm, 'rightLowerArm');
    const spine = bone(vrm, 'spine');
    if (lUL) lUL.rotation.x = -swing;
    if (rUL) rUL.rotation.x = swing;
    if (lLL) lLL.rotation.x = Math.max(0, Math.sin(e.phase + 1.3)) * 0.9 * amt;
    if (rLL) rLL.rotation.x = Math.max(0, Math.sin(e.phase + 1.3 + Math.PI)) * 0.9 * amt;
    // 手臂垂下来(VRM 静止是 T / A 字),走路时前后摆,和同侧的腿反着
    if (lUA) { lUA.rotation.z = -1.25; lUA.rotation.x = swing * 0.6; }
    if (rUA) { rUA.rotation.z = 1.25; rUA.rotation.x = -swing * 0.6; }
    if (lLA) lLA.rotation.y = -0.15 - amt * 0.25;
    if (rLA) rLA.rotation.y = 0.15 + amt * 0.25;
    if (spine) spine.rotation.x = (running ? 0.12 : 0.03 * amt) + Math.sin(t * 1.6 + e.phase) * 0.015 * (1 - amt);
    vrm.scene.position.y = e.footOffset + Math.abs(Math.sin(e.phase)) * 0.035 * amt;
    vrm.update(dt);
  }

  function tick(t: number, dt: number, camera: THREE.Camera) {
    const now = performance.now();
    // 每秒挑一次离镜头最近的 MAX_FULL 个加载完整形象,其余卸掉换成人形
    lodTimer -= dt;
    if (lodTimer <= 0) {
      lodTimer = 1;
      const list = Array.from(entries.values()).filter((e) => !e.removing)
        .sort((a, b) => a.pos.distanceToSquared(camera.position) - b.pos.distanceToSquared(camera.position));
      list.forEach((e, i) => {
        const want = i < MAX_FULL;
        if (want !== e.wantFull) {
          e.wantFull = want;
          if (want) maybeLoad(e); else unloadFull(e);
        }
      });
    }
    const k = 1 - Math.exp(-dt * 10);
    for (const [id, e] of entries) {
      // 进场淡入 / 离场淡出
      e.fade = e.removing ? Math.max(0, e.fade - dt * 2.5) : Math.min(1, e.fade + dt * 2.5);
      if (e.removing && e.fade <= 0) {
        root.remove(e.g);
        if (e.vrm) THREE_VRM.VRMUtils.deepDispose(e.vrm.scene);
        disposeSprite(e.label);
        if (e.bubble) disposeSprite(e.bubble);
        entries.delete(id);
        continue;
      }
      e.g.scale.setScalar(0.001 + 0.999 * e.fade);
      // 追位置(隔得太远 = 换场景 / 断线重连,直接跳过去)
      tmp.set(e.p.x, e.p.y, e.p.z);
      const gap = tmp.distanceTo(e.pos);
      const before = e.pos.clone();
      if (gap > 6) e.pos.copy(tmp); else e.pos.lerp(tmp, k);
      const moved = e.pos.distanceTo(before) / Math.max(dt, 1e-3);
      e.speed += ((gap > 6 ? 0 : moved) - e.speed) * Math.min(1, dt * 8);
      if (e.p.m && e.speed < 0.3 && gap > 0.05) e.speed = Math.max(e.speed, 0.6);
      e.g.position.copy(e.pos);
      let dy = e.p.yaw - e.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      e.yaw += dy * Math.min(1, dt * 8);
      e.g.rotation.y = e.yaw;
      animate(e, t, dt);
      if (e.bubble) {
        const left = e.bubbleUntil - now;
        (e.bubble.material as THREE.SpriteMaterial).opacity = Math.max(0, Math.min(1, left / 600));
        if (left <= 0) { e.g.remove(e.bubble); disposeSprite(e.bubble); e.bubble = null; }
      }
    }
  }

  return {
    set,
    say,
    tick,
    positions: () => Array.from(entries.values()).filter((e) => !e.removing).map((e) => ({ id: e.p.id, x: e.pos.x, z: e.pos.z })),
    dispose: () => {
      disposed = true;
      for (const e of entries.values()) {
        if (e.vrm) THREE_VRM.VRMUtils.deepDispose(e.vrm.scene);
        disposeSprite(e.label);
        if (e.bubble) disposeSprite(e.bubble);
      }
      entries.clear();
      parent.remove(root);
      ghostGeo.dispose();
      ghostMat.dispose();
    },
  };
}
