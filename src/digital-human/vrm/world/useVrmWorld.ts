/**
 * vrm/world/useVrmWorld.ts — 广场在舞台里的每帧逻辑
 *
 * - 建/拆 3D 广场(buildWorld),跟着场景预设换配色;
 * - 每帧:判断角色进出哪个地标、碰没碰到星光(捡起 + 过一会儿在别处补一颗);
 * - 画布上的「点击」(不是拖拽转镜头):点到角色 = 戳一戳,点到地标 = 走过去,点到地面 = 走到那里。
 *
 * 玩法状态(经验、任务)不在这里:这里只往外报事件,由页面层记账。
 */

import { useCallback, useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { buildWorld, type WorldHandle, type WorldPeer } from './buildWorld';
import {
  ORB_POINTS, ORB_RESPAWN_MS, WORLD_ZONES, ZONE_BY_ID, orbsInReach, pickOrbSpot, spawnOrbs, zoneApproachPoint, zoneAt,
  type Orb, type ZoneId,
} from './worldLayout';

export type WorldEvent =
  | { type: 'orb'; golden: boolean; points: number }
  | { type: 'zone'; zone: ZoneId | null }
  | { type: 'poke' }
  | { type: 'interact' };

export interface UseVrmWorldOptions {
  enabled: boolean;
  THREE_NS: typeof THREE | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  canvas: HTMLCanvasElement | null;
  preset: string;
  /** 角色根节点(点击命中检测用) */
  getAvatar: () => THREE.Object3D | null;
  /** 让角色走到某点(已经过 clampToWorld) */
  walkTo: (x: number, z: number) => void;
  onEvent?: (e: WorldEvent) => void;
}

export interface WorldSnapshot {
  orbs: Orb[];
  zone: ZoneId | null;
  peers: { id: string; x: number; z: number; aura?: string }[];
}

export function useVrmWorld(opts: UseVrmWorldOptions) {
  const { enabled, THREE_NS, scene, camera, canvas, preset } = opts;
  const worldRef = useRef<WorldHandle | null>(null);
  const orbsRef = useRef<Orb[]>([]);
  const respawnRef = useRef<number[]>([]);
  const nextOrbIdRef = useRef(1000);
  const zoneRef = useRef<ZoneId | null>(null);
  const cbRef = useRef(opts);
  cbRef.current = opts;

  // 建 / 拆
  useEffect(() => {
    if (!enabled || !THREE_NS || !scene) return;
    const w = buildWorld(THREE_NS, cbRef.current.preset);
    scene.add(w.group);
    worldRef.current = w;
    orbsRef.current = spawnOrbs((Date.now() / 1000) | 0);
    respawnRef.current = [];
    w.setOrbs(orbsRef.current);
    if (auraRef.current) w.setAura(auraRef.current);
    return () => {
      scene.remove(w.group);
      w.dispose();
      worldRef.current = null;
      zoneRef.current = null;
    };
  }, [enabled, THREE_NS, scene]);

  useEffect(() => { worldRef.current?.setTheme(preset); }, [preset]);

  // 画布点击:按下到抬起位移很小、时间很短才算「点」,否则是在拖镜头
  useEffect(() => {
    if (!enabled || !THREE_NS || !canvas || !camera) return;
    const raycaster = new THREE_NS.Raycaster();
    const ndc = new THREE_NS.Vector2();
    let down: { x: number; y: number; t: number; id: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    };
    const onUp = (e: PointerEvent) => {
      const d = down;
      down = null;
      if (!d || d.id !== e.pointerId) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 450) return;
      const w = worldRef.current;
      if (!w) return;
      const rect = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const cb = cbRef.current;
      // 1. 角色
      const avatar = cb.getAvatar();
      if (avatar && raycaster.intersectObject(avatar, true).length > 0) {
        cb.onEvent?.({ type: 'poke' });
        return;
      }
      // 2. 地标 → 走到它跟前
      const hitZone = raycaster.intersectObjects(w.pickables, true)[0];
      const zid = hitZone?.object.userData.zoneId as ZoneId | undefined;
      if (zid && ZONE_BY_ID[zid]) {
        const p = zoneApproachPoint(ZONE_BY_ID[zid]);
        w.showMarker(p.x, p.z);
        cb.walkTo(p.x, p.z);
        return;
      }
      // 3. 地面
      const hitGround = raycaster.intersectObject(w.ground, false)[0];
      if (hitGround) {
        w.showMarker(hitGround.point.x, hitGround.point.z);
        cb.walkTo(hitGround.point.x, hitGround.point.z);
      }
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
    };
  }, [enabled, THREE_NS, canvas, camera]);

  /** 每帧:pos 是角色脚下位置,dancing 让舞池地砖跟着闪 */
  const tick = useCallback((t: number, dt: number, pos: { x: number; z: number }, dancing: boolean) => {
    const w = worldRef.current;
    if (!w || !camera) return;
    const cb = cbRef.current;
    w.setDanceFloorHot(dancing);
    w.setSelfPos(pos.x, pos.z);

    const zone = zoneAt(pos.x, pos.z)?.id ?? null;
    if (zone !== zoneRef.current) {
      zoneRef.current = zone;
      w.setActiveZone(zone);
      cb.onEvent?.({ type: 'zone', zone });
    }

    const hits = orbsInReach(pos.x, pos.z, orbsRef.current);
    if (hits.length) {
      const hitIds = new Set(hits.map((o) => o.id));
      orbsRef.current = orbsRef.current.filter((o) => !hitIds.has(o.id));
      for (const o of hits) {
        w.collectOrb(o.id);
        const points = o.golden ? ORB_POINTS.golden : ORB_POINTS.normal;
        w.floatText(`+${points}`, o.x, 1.4, o.z, o.golden ? '#ffc93d' : '#fff6c8');
        respawnRef.current.push(performance.now() + ORB_RESPAWN_MS);
        cb.onEvent?.({ type: 'orb', golden: o.golden, points });
      }
    }
    // 补刷:避开角色当前位置,免得刚刷出来就被捡走
    const now = performance.now();
    if (respawnRef.current.length && respawnRef.current[0] <= now) {
      respawnRef.current.shift();
      let spot = pickOrbSpot(Math.random, orbsRef.current);
      for (let i = 0; i < 5 && Math.hypot(spot.x - pos.x, spot.z - pos.z) < 3; i++) spot = pickOrbSpot(Math.random, orbsRef.current);
      orbsRef.current = [...orbsRef.current, { id: nextOrbIdRef.current++, x: spot.x, z: spot.z, golden: Math.random() < 0.12 }];
      w.setOrbs(orbsRef.current);
    }

    w.tick(t, dt, camera);
  }, [camera]);

  const floatText = useCallback((text: string, x: number, y: number, z: number, color?: string) => {
    worldRef.current?.floatText(text, x, y, z, color);
  }, []);

  const showMarker = useCallback((x: number, z: number) => { worldRef.current?.showMarker(x, z); }, []);

  const snapshot = useCallback((): WorldSnapshot => ({ orbs: orbsRef.current, zone: zoneRef.current, peers: worldRef.current?.peerPositions() ?? [] }), []);

  // 广场重建(关掉又打开)后要把上次的光环补回去
  const auraRef = useRef<string | null>(null);
  const setPeers = useCallback((peers: WorldPeer[]) => { worldRef.current?.setPeers(peers); }, []);
  const setAura = useCallback((v: string | null) => { auraRef.current = v; worldRef.current?.setAura(v); }, []);

  return { tick, floatText, showMarker, snapshot, setPeers, setAura, zones: WORLD_ZONES };
}
