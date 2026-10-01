/**
 * vrm/world/peerAvatars.ts — 创世二期:房间里的其他人,画成他们自己捏的形象
 *
 * 每个同伴一份独立的 VRM(舞台上自己的那份有缓存,不能共用):同一个底模文件只下载一次,每人各解析一份,
 * 套上他的捏人参数(avatarCustomize)。离镜头最近的 MAX_FULL 个人加载完整模型,其余先是一个半透明的人形。
 *
 * 动起来靠插值 + 程序化步态:服务端 10Hz 发位置,这里按指数平滑追过去;按实际移动速度摆腿摆臂
 * (规范化骨骼:upperLeg / upperArm 的 X+ 是往后,lowerLeg 的 X+ 是屈膝),停下来轻轻呼吸。
 * 头顶一块名牌(房主带 🏠),说话时名牌上面冒气泡,5 秒后淡掉。
 * 四期语音:名牌前缀 🎙(开着麦)/ 🔇(被房主禁言);setVoiceLevels 给一个「谁此刻嘴张多大」的查询,
 * 说话时嘴跟着动(VRM 表情 aa / oh),名牌上方亮一个绿色的 🔊。
 * 十期:a = 'sit' 时画坐姿(interact.ts 的 applySitPose),人放在 y(座面高度)上,髋沉下去坐在那。
 */

import type * as THREE from 'three';
import * as THREE_VRM from '@pixiv/three-vrm';
import type { AvatarParams } from '@/apis/world';
import { applyAvatarParams } from '../avatarCustomize';
import { applySitPose, sitDrop } from './interact';

export interface RoomPeer {
  id: string;
  nickname: string;
  owner?: boolean;
  ai?: boolean;
  look: { base: string; params: Record<string, unknown>; version: number };
  x: number;
  y: number;
  z: number;
  yaw: number;
  m?: boolean;
  a?: string;
  /** 0 没开声音 / 1 在听 / 2 开着麦 */
  voice?: number;
  muted?: boolean;
  /** 七期:广场光环(颜色值),脚下一圈光 */
  aura?: string;
}

export interface PeerLayer {
  set: (list: RoomPeer[]) => void;
  say: (id: string, text: string) => void;
  /** 四期:谁此刻嘴张多大(0..1);null = 不说话 */
  setVoiceLevels: (fn: ((id: string) => number) | null) => void;
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
  speak: THREE.Sprite | null;
  talk: number; // 平滑后的嘴型 0..1
  aura: THREE.Mesh | null;
  auraColor: string;
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
  /** 十期:坐姿权重;髋静止时的高度(规范化骨骼局部)、站着时髋离脚底多高(米) */
  sitW: number;
  hipsRest: number | null;
  hipH: number;
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

  let voiceLevel: ((id: string) => number) | null = null;
  const labelText = (p: RoomPeer) => `${p.muted ? '🔇 ' : p.voice === 2 ? '🎙 ' : ''}${p.owner ? '🏠 ' : p.ai ? '🤖 ' : ''}${p.nickname || '访客'}`;
  const keyOf = (p: RoomPeer) => `${opts.resolveUrl(p.look?.base || '')}#${p.look?.version ?? 0}#${JSON.stringify(p.look?.params ?? {})}`;

  function makeLabel(e: Entry) {
    if (e.label) { e.g.remove(e.label); disposeSprite(e.label); }
    e.label = textSprite(THREE_NS, labelText(e.p), { bg: e.p.ai ? 'rgba(40,20,70,0.72)' : 'rgba(8,10,20,0.66)', border: e.p.owner ? '#25F4EE' : e.p.ai ? '#c7a6ff' : undefined, size: 34 });
    e.label.position.y = e.height + 0.18;
    e.g.add(e.label);
    if (e.speak) e.speak.position.y = e.height + 0.36;
  }

  // 「在说话」的绿色小喇叭:第一次说话时才建
  function speakIcon(e: Entry) {
    if (!e.speak) {
      e.speak = textSprite(THREE_NS, '🔊', { bg: 'rgba(30,190,110,0.9)', size: 30, worldScale: 0.07 });
      e.speak.position.y = e.height + 0.36;
      e.g.add(e.speak);
    }
    return e.speak;
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
        p, g, label: null as unknown as THREE.Sprite, bubble: null, bubbleUntil: 0, speak: null, talk: 0, aura: null, auraColor: '', ghost, vrm: null, loadingKey: '', loadedKey: '',
        footOffset: 0, height: 1.6, pos: new THREE_NS.Vector3(p.x, p.y, p.z), yaw: p.yaw, speed: 0, phase: Math.random() * 6, wantFull: true, fade: 0, removing: false, sitW: 0, hipsRest: null, hipH: 0.85,
      };
      entries.set(p.id, e);
      makeLabel(e);
    } else {
      const nameChanged = labelText(e.p) !== labelText(p) || !!e.p.ai !== !!p.ai;
      e.p = p;
      e.removing = false;
      if (nameChanged) makeLabel(e);
    }
    setAura(e);
    maybeLoad(e);
  }

  // 广场光环:脚下一圈半透明的光(颜色变了换材质颜色,摘了就拿掉)
  const auraGeo = new THREE_NS.RingGeometry(0.42, 0.62, 48);
  function setAura(e: Entry) {
    const c = e.p.aura || '';
    if (c === e.auraColor) return;
    e.auraColor = c;
    if (e.aura) { e.g.remove(e.aura); (e.aura.material as THREE.Material).dispose(); e.aura = null; }
    if (!c) return;
    let color: THREE.Color;
    try { color = new THREE_NS.Color(c); } catch { return; }
    const m = new THREE_NS.Mesh(auraGeo, new THREE_NS.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, side: THREE_NS.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.03;
    m.name = 'peer-aura';
    e.aura = m;
    e.g.add(m);
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
      // 十期:量一下髋多高(坐下时往下沉多少)
      const hips = vrm.humanoid?.getNormalizedBoneNode('hips');
      e.hipsRest = hips ? hips.position.y : null;
      const ul = vrm.humanoid?.getNormalizedBoneNode('leftUpperLeg'), ll = vrm.humanoid?.getNormalizedBoneNode('leftLowerLeg'), ft = vrm.humanoid?.getNormalizedBoneNode('leftFoot');
      if (ul && ll && ft) {
        vrm.scene.updateMatrixWorld(true);
        const a = ul.getWorldPosition(new THREE_NS.Vector3()), b = ll.getWorldPosition(new THREE_NS.Vector3()), c = ft.getWorldPosition(new THREE_NS.Vector3());
        const len = (a.distanceTo(b) + b.distanceTo(c)) / Math.max(1e-3, e.g.scale.y);
        if (len > 0.3 && len < 2) e.hipH = len + 0.07;
      }
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
    // 招手:右臂抬起左右摆;作揖:上身前倾、双臂收到胸前
    if (e.p.a === 'wave' && rUA && rLA) {
      rUA.rotation.z = -0.35;
      rUA.rotation.x = -0.2;
      rLA.rotation.y = 0.9 + Math.sin(t * 9) * 0.35;
    } else if (e.p.a === 'bow' && spine && lUA && rUA) {
      spine.rotation.x = 0.45;
      lUA.rotation.z = -0.9; lUA.rotation.x = -0.6;
      rUA.rotation.z = 0.9; rUA.rotation.x = -0.6;
    }
    vrm.scene.position.y = e.footOffset + Math.abs(Math.sin(e.phase)) * 0.035 * amt;
    // 十期:坐着
    e.sitW = Math.min(1, Math.max(0, e.sitW + (e.p.a === 'sit' ? dt * 2.5 : -dt * 3)));
    const hips = bone(vrm, 'hips');
    if (e.sitW > 0.001) {
      const sw = e.sitW * e.sitW * (3 - 2 * e.sitW);
      applySitPose(THREE_NS, (n) => bone(vrm, n as THREE_VRM.VRMHumanBoneName), sw);
      if (hips && e.hipsRest !== null) hips.position.y = e.hipsRest - (sitDrop(e.hipH, 0) * sw) / (vrm.scene.scale.y || 1);
      vrm.scene.position.y = e.footOffset;
    } else if (hips && e.hipsRest !== null) {
      hips.position.y = e.hipsRest;
    }
    // 说话的嘴型(没开声音 / 不说话时 talk = 0,不碰表情)
    const em = vrm.expressionManager;
    if (em && (e.talk > 0.01 || em.getValue('aa'))) {
      em.setValue('aa', Math.min(1, e.talk * 1.1));
      em.setValue('oh', Math.min(1, e.talk * 0.35 * (1 + Math.sin(t * 7))));
    }
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
        if (e.speak) disposeSprite(e.speak);
        if (e.aura) (e.aura.material as THREE.Material).dispose();
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
      const lv = voiceLevel ? voiceLevel(id) : 0;
      e.talk += (lv - e.talk) * Math.min(1, dt * (lv > e.talk ? 30 : 12));
      if (e.talk > 0.04 || e.speak) {
        const s = speakIcon(e);
        const mat = s.material as THREE.SpriteMaterial;
        mat.opacity += ((e.talk > 0.06 ? 1 : 0) - mat.opacity) * Math.min(1, dt * 10);
        s.visible = mat.opacity > 0.02;
      }
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
    setVoiceLevels: (fn) => { voiceLevel = fn; },
    tick,
    positions: () => Array.from(entries.values()).filter((e) => !e.removing).map((e) => ({ id: e.p.id, x: e.pos.x, z: e.pos.z })),
    dispose: () => {
      disposed = true;
      for (const e of entries.values()) {
        if (e.vrm) THREE_VRM.VRMUtils.deepDispose(e.vrm.scene);
        disposeSprite(e.label);
        if (e.bubble) disposeSprite(e.bubble);
        if (e.speak) disposeSprite(e.speak);
      }
      entries.clear();
      parent.remove(root);
      ghostGeo.dispose();
      auraGeo.dispose();
      ghostMat.dispose();
    },
  };
}
