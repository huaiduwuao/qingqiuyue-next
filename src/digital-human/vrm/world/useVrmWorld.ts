/**
 * vrm/world/useVrmWorld.ts — 广场在舞台里的每帧逻辑
 *
 * - 建/拆 3D 广场(buildWorld),换场景(WorldDef.key 变了)时整座重建;跟着场景预设换配色;
 * - 每帧:判断角色进出哪个地标、走近了哪位人物、碰没碰到星光(捡起 + 过一会儿在别处补一颗);
 * - 画布上的「点击」(不是拖拽转镜头):点到角色 = 戳一戳,点到人物 = 和他说话,
 *   点到地标 = 走过去,点到地面 = 走到那里。
 *
 * 玩法状态(经验、任务)不在这里:这里只往外报事件,由页面层记账。
 */

import { useCallback, useEffect, useRef } from 'react';
import type * as THREE from 'three';
import { buildWorld, type WorldHandle, type WorldPeer } from './buildWorld';
import { createEnvironment, type Environment, type Quality } from './env/environment';
import type { PlacedObject } from './worldObjects';
import type { SplatStatus } from './roomShell';
import { createPeerLayer, type PeerLayer, type RoomPeer } from './peerAvatars';
import { WORLD_ASSET_BASE } from './realKit';
import { mediaUrl } from '@/lib/media';

/** 形象底模地址:站内 /avatars/… 原样;qq-media/world 下的补前缀;空 = 默认形象 */
function avatarUrl(base: string): string {
  if (!base) return '/avatars/character.vrm';
  if (base.startsWith('/')) return base;
  return mediaUrl(`${WORLD_ASSET_BASE}/${base}`);
}
import type { RoomShellAlign } from './worldLayout';
import type { TimeMode, Weather } from './env/timeOfDay';
import {
  DEFAULT_WORLD, worldEnv, ORB_POINTS, ORB_RESPAWN_MS, WORLD_ZONES, findZone, orbsInReach, pickOrbSpot, spawnOrbs, zoneApproachPoint, zoneAt,
  type Orb, type WorldCharacter, type WorldDef, type ZoneId,
} from './worldLayout';

export type WorldEvent =
  | { type: 'orb'; golden: boolean; points: number }
  | { type: 'zone'; zone: ZoneId | null }
  | { type: 'poke' }
  | { type: 'interact' }
  /** 点了某位人物 */
  | { type: 'character'; id: string }
  /** 走到某位人物跟前(null = 走开了) */
  | { type: 'nearCharacter'; id: string | null }
  /** 布置房间时点中了一件摆放(null = 点在空地上,取消选中) */
  | { type: 'object'; id: string | null }
  /** 房间的泼溅外壳加载状态 */
  | { type: 'splat'; status: SplatStatus; splats?: number; error?: string };

export interface UseVrmWorldOptions {
  enabled: boolean;
  THREE_NS: typeof THREE | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  canvas: HTMLCanvasElement | null;
  preset: string;
  /** 当前场景;换了 key 整座广场重建 */
  def?: WorldDef;
  /** 当前场景里的人物 */
  characters?: WorldCharacter[];
  /** 画质:high = 湖山天光 + 后期 + 草;low = 湖山天光但不做后期和草;off = 不要环境层 */
  quality?: Quality | 'off';
  /** 用户手动选的时辰(覆盖场景默认) */
  timeMode?: TimeMode | null;
  /** 渲染器(环境层的后期要用) */
  renderer?: THREE.WebGLRenderer | null;
  /** 角色根节点(点击命中检测用) */
  getAvatar: () => THREE.Object3D | null;
  /** 让角色走到某点(已经过 clampToWorld) */
  walkTo: (x: number, z: number) => void;
  /** 布置房间中:点东西是「选中」,不是走过去 */
  editing?: boolean;
  onEvent?: (e: WorldEvent) => void;
}

export interface WorldSnapshot {
  orbs: Orb[];
  zone: ZoneId | null;
  peers: { id: string; x: number; z: number; aura?: string }[];
  characters: { id: string; x: number; z: number }[];
}

/** 走到人物多近算「到跟前」 */
const NEAR_CHARACTER = 1.8;

export function useVrmWorld(opts: UseVrmWorldOptions) {
  const { enabled, THREE_NS, scene, camera, canvas, preset } = opts;
  const def = opts.def ?? DEFAULT_WORLD;
  const defRef = useRef(def);
  defRef.current = def;
  const worldRef = useRef<WorldHandle | null>(null);
  const envRef = useRef<Environment | null>(null);
  const placementsRef = useRef<PlacedObject[]>([]);
  // 创世二期:房间里的其他人(真形象);场景重建后放回去
  const roomPeersRef = useRef<RoomPeer[]>([]);
  const peerLayerRef = useRef<PeerLayer | null>(null);
  const voiceLevelsRef = useRef<((id: string) => number) | null>(null);
  const quality = opts.quality ?? 'high';
  const orbsRef = useRef<Orb[]>([]);
  const respawnRef = useRef<number[]>([]);
  const nextOrbIdRef = useRef(1000);
  const zoneRef = useRef<ZoneId | null>(null);
  const nearRef = useRef<string | null>(null);
  const auraRef = useRef<string | null>(null);
  const charactersRef = useRef<WorldCharacter[]>(opts.characters ?? []);
  const cbRef = useRef(opts);
  cbRef.current = opts;

  // 建 / 拆(换场景也走这里)
  useEffect(() => {
    if (!enabled || !THREE_NS || !scene) return;
    const d = defRef.current;
    const renderer = cbRef.current.renderer;
    const withEnv = quality !== 'off' && !!renderer;
    const style = worldEnv(d);
    const w = buildWorld(THREE_NS, cbRef.current.preset, d, {
      island: withEnv,
      realistic: withEnv && style.style === 'realistic' ? { base: style.assets, quality: quality as Quality } : undefined,
      renderer: renderer ?? null,
      quality: quality === 'low' ? 'low' : 'high',
      onSplatStatus: (status, info) => cbRef.current.onEvent?.({ type: 'splat', status, splats: info?.splats, error: info?.error }),
    });
    scene.add(w.group);
    worldRef.current = w;
    // 场景重建(换场景 / 换画质)后把摆放放回去
    w.objects.set(placementsRef.current);
    let env: Environment | null = null;
    if (withEnv && renderer) {
      const e = worldEnv(d);
      env = createEnvironment(THREE_NS, renderer, scene, {
        quality: quality as Quality,
        timeMode: (cbRef.current.timeMode ?? e.time) as TimeMode,
        weather: e.weather as Weather,
        grass: e.grass,
        zones: d.zones,
        style: e.style,
        assetBase: e.assets,
        hideStage: d.kind === 'room',
      });
      scene.add(env.group);
      envRef.current = env;
    }
    // 房间:给一份室内环境光照贴图(RoomEnvironment)。写实底模、摆的家具都是 PBR 材质,
    // 风格化场景里只有几盏灯,没有环境反射时皮肤和木头都发黑;离开房间还原
    let roomEnv: THREE.Texture | null = null;
    const prevEnv = scene.environment;
    const prevEnvIntensity = (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity ?? 1;
    let envCancelled = false;
    if (d.kind === 'room' && renderer && style.style !== 'realistic') {
      import('three/examples/jsm/environments/RoomEnvironment.js').then(({ RoomEnvironment }) => {
        if (envCancelled) return;
        const pmrem = new THREE_NS.PMREMGenerator(renderer);
        const room = new RoomEnvironment();
        roomEnv = pmrem.fromScene(room, 0.04).texture;
        room.dispose();
        pmrem.dispose();
        scene.environment = roomEnv;
        (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = 0.6;
      }).catch(() => { /* 没有环境光也能看,只是暗一点 */ });
    }
    orbsRef.current = spawnOrbs((Date.now() / 1000) | 0, undefined, d);
    respawnRef.current = [];
    w.setOrbs(orbsRef.current);
    w.setCharacters(charactersRef.current);
    // 七期:广场等公共场景也走房间集线器,同伴一样画真形象
    const peers = createPeerLayer(THREE_NS, w.group, { resolveUrl: avatarUrl });
    peerLayerRef.current = peers;
    peers?.setVoiceLevels(voiceLevelsRef.current);
    peers?.set(roomPeersRef.current);
    if (auraRef.current) w.setAura(auraRef.current);
    return () => {
      envCancelled = true;
      peers?.dispose();
      if (peerLayerRef.current === peers) peerLayerRef.current = null;
      if (roomEnv) {
        if (scene.environment === roomEnv) scene.environment = prevEnv;
        (scene as THREE.Scene & { environmentIntensity?: number }).environmentIntensity = prevEnvIntensity;
        roomEnv.dispose();
      }
      scene.remove(w.group);
      w.dispose();
      worldRef.current = null;
      if (env) { scene.remove(env.group); env.dispose(); envRef.current = null; }
      if (zoneRef.current) { zoneRef.current = null; cbRef.current.onEvent?.({ type: 'zone', zone: null }); }
      if (nearRef.current) { nearRef.current = null; cbRef.current.onEvent?.({ type: 'nearCharacter', id: null }); }
    };
  // 地标内容的改动(后台改了坐标)也要重建:key + 地标签名
  // 房间:换模板 / 换泼溅文件才重建(对齐走 setRoomAlign,不重建)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, THREE_NS, scene, def.key, quality, JSON.stringify(def.zones.map((z) => [z.id, z.x, z.z, z.prop, z.color])), JSON.stringify(def.env ?? {}), def.room ? `${def.room.template}|${def.room.splatUrl ?? ''}` : '']);

  // 用户手动换时辰:只动环境层,不重建
  useEffect(() => {
    const env = envRef.current;
    if (!env) return;
    env.setTimeMode((opts.timeMode ?? worldEnv(defRef.current).time) as TimeMode);
  }, [opts.timeMode]);

  useEffect(() => { worldRef.current?.setTheme(preset); }, [preset]);

  // 人物列表变了只重摆人物,不重建整座广场
  useEffect(() => {
    charactersRef.current = opts.characters ?? [];
    worldRef.current?.setCharacters(charactersRef.current);
  }, [opts.characters]);

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
      // 布置房间时点在 gizmo 的轴上:那是在拖东西,不是点地面
      if (canvas.dataset.gizmo) return;
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
      // 布置房间:点中摆放 = 选中它;点空地 = 取消选中(照样走过去)
      if (cb.editing) {
        const id = w.objects.pick(raycaster);
        if (id) { cb.onEvent?.({ type: 'object', id }); return; }
        cb.onEvent?.({ type: 'object', id: null });
      }
      const hit = raycaster.intersectObjects(w.pickables, true)[0];
      // 2. 人物 → 走到他跟前,并开口
      const cid = hit?.object.userData.characterId as string | undefined;
      if (cid) {
        const c = charactersRef.current.find((x) => x.id === cid);
        if (c) {
          const r = Math.hypot(c.x, c.z) || 1;
          const tx = c.x - (c.x / r) * 1.1, tz = c.z - (c.z / r) * 1.1;
          w.showMarker(tx, tz);
          cb.walkTo(tx, tz);
        }
        cb.onEvent?.({ type: 'character', id: cid });
        return;
      }
      // 3. 地标 → 走到它跟前
      const zone = findZone(defRef.current, hit?.object.userData.zoneId as string | undefined);
      if (zone) {
        const p = zoneApproachPoint(zone, defRef.current);
        w.showMarker(p.x, p.z);
        cb.walkTo(p.x, p.z);
        return;
      }
      // 4. 地面
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
    const d = defRef.current;
    w.setDanceFloorHot(dancing);
    w.setSelfPos(pos.x, pos.z);

    const zone = zoneAt(pos.x, pos.z, d)?.id ?? null;
    if (zone !== zoneRef.current) {
      zoneRef.current = zone;
      w.setActiveZone(zone);
      cb.onEvent?.({ type: 'zone', zone });
    }

    // 走近人物
    let near: string | null = null;
    let nearD = NEAR_CHARACTER;
    for (const c of charactersRef.current) {
      const dd = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (dd < nearD) { near = c.id; nearD = dd; }
    }
    if (near !== nearRef.current) {
      nearRef.current = near;
      cb.onEvent?.({ type: 'nearCharacter', id: near });
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
      let spot = pickOrbSpot(Math.random, orbsRef.current, d);
      for (let i = 0; i < 5 && Math.hypot(spot.x - pos.x, spot.z - pos.z) < 3; i++) spot = pickOrbSpot(Math.random, orbsRef.current, d);
      orbsRef.current = [...orbsRef.current, { id: nextOrbIdRef.current++, x: spot.x, z: spot.z, golden: Math.random() < 0.12 }];
      w.setOrbs(orbsRef.current);
    }

    w.tick(t, dt, camera);
    peerLayerRef.current?.tick(t, dt, camera);
    const env = envRef.current;
    if (env) {
      env.tick(t, dt, camera, pos);
      w.setLampBoost(1 + env.sky().lampBoost * 1.6);
    }
  }, [camera]);

  /** 有后期时由它画这一帧;返回 false = 让渲染器照常画 */
  const render = useCallback((r: THREE.WebGLRenderer, s: THREE.Scene, c: THREE.Camera, t: number) => {
    const env = envRef.current;
    if (!env?.render) return false;
    env.render(r, s, c, t);
    return true;
  }, []);

  const floatText = useCallback((text: string, x: number, y: number, z: number, color?: string) => {
    worldRef.current?.floatText(text, x, y, z, color);
  }, []);

  const showMarker = useCallback((x: number, z: number) => { worldRef.current?.showMarker(x, z); }, []);

  const snapshot = useCallback((): WorldSnapshot => ({
    orbs: orbsRef.current,
    zone: zoneRef.current,
    peers: [...(worldRef.current?.peerPositions() ?? []), ...(peerLayerRef.current?.positions() ?? [])],
    characters: worldRef.current?.characterPositions() ?? [],
  }), []);

  const setPeers = useCallback((peers: WorldPeer[]) => { worldRef.current?.setPeers(peers); }, []);
  // 言出法随:摆放记一份,场景重建时放回去
  const setPlacements = useCallback((list: PlacedObject[]) => { placementsRef.current = list; worldRef.current?.objects.set(list); }, []);
  const upsertPlacement = useCallback((p: PlacedObject) => {
    placementsRef.current = [...placementsRef.current.filter((x) => x.id !== p.id), p];
    worldRef.current?.objects.upsert(p);
  }, []);
  const removePlacement = useCallback((id: string) => {
    placementsRef.current = placementsRef.current.filter((x) => x.id !== id);
    worldRef.current?.objects.remove(id);
  }, []);
  const setAura = useCallback((v: string | null) => { auraRef.current = v; worldRef.current?.setAura(v); }, []);
  const characterSay = useCallback((id: string, text: string) => { worldRef.current?.characterSay(id, text); }, []);

  // 创世:布置房间要的几样
  const selectPlacement = useCallback((id: string | null) => { worldRef.current?.objects.setSelected(id); }, []);
  const placementGroup = useCallback((id: string) => worldRef.current?.objects.groupOf(id) ?? null, []);
  const setRoomAlign = useCallback((a: RoomShellAlign) => { worldRef.current?.room?.setAlign(a); }, []);
  const autoFitRoom = useCallback(() => worldRef.current?.room?.autoFit() ?? null, []);
  const setRoomPeers = useCallback((list: RoomPeer[]) => { roomPeersRef.current = list; peerLayerRef.current?.set(list); }, []);
  const setPeerVoiceLevels = useCallback((fn: ((id: string) => number) | null) => { voiceLevelsRef.current = fn; peerLayerRef.current?.setVoiceLevels(fn); }, []);
  const peerSay = useCallback((id: string, text: string) => { peerLayerRef.current?.say(id, text); }, []);

  return { tick, render, floatText, showMarker, snapshot, setPeers, setAura, characterSay, setPlacements, upsertPlacement, removePlacement, selectPlacement, placementGroup, setRoomAlign, autoFitRoom, setRoomPeers, peerSay, setPeerVoiceLevels, zones: WORLD_ZONES };
}
