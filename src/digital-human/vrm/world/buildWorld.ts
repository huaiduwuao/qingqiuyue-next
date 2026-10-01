/**
 * vrm/world/buildWorld.ts — 数字人广场的 3D 构建
 *
 * 场景预设(演唱会/花园/霓虹……)只管中央舞台那一圈;这里在它外面铺一整座广场:
 * 大地面 + 发光小路、6 个地标、一圈路灯、能捡的星光、点地面时的落点波纹、头顶飘字。
 *
 * 性能:不额外加实时灯(只加一盏很弱的半球光托底),远处的东西靠自发光材质;
 * 几何都是基础体,总共两百来个 mesh。
 */

import type * as THREE from 'three';
import { createNpcRig, type NpcRig } from './npcRig';
import { createRealKit, type RealKit, type Spot } from './realKit';
import { createRealNpc, realNpcModel } from './realNpc';
import { createObjectLayer, type ObjectLayer } from './worldObjects';
import { buildRoomShell, type RoomShell, type SplatStatus } from './roomShell';
import { DEFAULT_WORLD, WORLD_RADIUS, zoneProp, type Orb, type WorldCharacter, type WorldDef, type WorldZone, type ZoneId, worldEnv } from './worldLayout';

/** 各场景预设下广场的配色:地面要跟舞台地板接得上,不然白天草坪外面一圈黑地很突兀 */
export interface WorldTheme { ground: number; path: number; accent: number; hemiSky: number; hemiGround: number; hemi: number }
const THEMES: Record<string, WorldTheme> = {
  concert: { ground: 0x10122a, path: 0x25f4ee, accent: 0xff4fd8, hemiSky: 0x6070ff, hemiGround: 0x100818, hemi: 0.35 },
  idol: { ground: 0x1a1622, path: 0xffc0e8, accent: 0xff7ac8, hemiSky: 0xffe0f0, hemiGround: 0x201820, hemi: 0.45 },
  garden: { ground: 0x0b1712, path: 0x9fffd0, accent: 0xfff0a0, hemiSky: 0x8090ff, hemiGround: 0x0a1a10, hemi: 0.35 },
  neon: { ground: 0x07060f, path: 0xff2bd6, accent: 0x25f4ee, hemiSky: 0x6040ff, hemiGround: 0x080010, hemi: 0.3 },
  studio: { ground: 0xd9d6d0, path: 0x3a8bff, accent: 0xff6a3d, hemiSky: 0xffffff, hemiGround: 0xbbbbbb, hemi: 0.6 },
  lawn: { ground: 0x4f7d33, path: 0xf3e2b0, accent: 0xffffff, hemiSky: 0xcfe8ff, hemiGround: 0x3d5a22, hemi: 0.6 },
};
export function worldTheme(preset: string): WorldTheme { return THEMES[preset] ?? THEMES.concert; }

/** 广场里的另一个人 */
export interface WorldPeer {
  id: string;
  nickname: string;
  x: number;
  z: number;
  yaw: number;
  aura?: string;
  moving?: boolean;
}

export interface WorldHandle {
  group: THREE.Group;
  /** 点击拾取用:地面 */
  ground: THREE.Mesh;
  /** 点击拾取用:每个地标的实体,userData.zoneId 标着是哪个 */
  pickables: THREE.Object3D[];
  setTheme: (preset: string) => void;
  /** 夜里路灯更亮(环境层按天光给倍数) */
  setLampBoost: (k: number) => void;
  setOrbs: (orbs: Orb[]) => void;
  /** 捡起动画:放大、上飘、淡出 */
  collectOrb: (id: number) => void;
  showMarker: (x: number, z: number) => void;
  setActiveZone: (id: ZoneId | null) => void;
  /** 舞池地砖跟着节拍闪(dancing=true 时更亮更快) */
  setDanceFloorHot: (on: boolean) => void;
  /** 在世界坐标上方冒一句飘字 */
  floatText: (text: string, x: number, y: number, z: number, color?: string) => void;
  tick: (t: number, dt: number, camera: THREE.Camera) => void;
  /** 广场里的其他人(服务端心跳拿回来的);不在列表里的会淡出移除 */
  setPeers: (peers: WorldPeer[]) => void;
  /** 自己脚下的光环:颜色值 / 'rainbow' / null 摘掉 */
  setAura: (value: string | null) => void;
  /** 每帧告诉世界角色在哪(光环跟着走) */
  setSelfPos: (x: number, z: number) => void;
  /** 场景里的人物(后台配置的诗人 / 引路人) */
  setCharacters: (list: WorldCharacter[]) => void;
  /** 人物头顶冒一句话(停留得比飘字久) */
  characterSay: (id: string, text: string) => void;
  /** 人物的位置(小地图、靠近检测用) */
  characterPositions: () => { id: string; x: number; z: number }[];
  /** 当前画着的其他人(小地图用) */
  peerPositions: () => { id: string; x: number; z: number; aura?: string }[];
  /** 言出法随摆出来的东西 */
  objects: ObjectLayer;
  /** 创世:房间外壳(不是房间 = null) */
  room: RoomShell | null;
  dispose: () => void;
}

/** 画一张文字贴图(emoji + 字),用作地标名牌和飘字 */
function makeTextSprite(THREE_NS: typeof THREE, text: string, opts: { color?: string; bg?: string; size?: number; border?: string } = {}) {
  const size = opts.size ?? 44;
  const font = `600 ${size}px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif`;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = font;
  const padX = opts.bg ? size * 0.6 : size * 0.15;
  const w = Math.ceil(probe.measureText(text).width + padX * 2);
  const h = Math.ceil(size * 1.7);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (opts.bg) {
    const r = h / 2;
    ctx.fillStyle = opts.bg;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.arc(w - r, r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(r, h); ctx.arc(r, r, r, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
    ctx.fill();
    if (opts.border) { ctx.strokeStyle = opts.border; ctx.lineWidth = 3; ctx.stroke(); }
  }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (!opts.bg) { ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = size * 0.25; }
  ctx.fillStyle = opts.color ?? '#fff';
  ctx.fillText(text, w / 2, h / 2 + size * 0.04);
  const tex = new THREE_NS.CanvasTexture(canvas);
  tex.colorSpace = THREE_NS.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE_NS.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
  const sprite = new THREE_NS.Sprite(mat);
  // 世界高度按字号换算:44px ≈ 0.42m 高
  const worldH = (h / 44) * 0.26;
  sprite.scale.set(worldH * (w / h), worldH, 1);
  sprite.userData.baseScale = sprite.scale.clone();
  return sprite;
}

function hex(c: number) { return `#${c.toString(16).padStart(6, '0')}`; }

export interface BuildWorldOptions {
  /** 外面接了环境层(湖、山、昼夜):地面收成湖心石台,半球光交给环境层 */
  island?: boolean;
  /** 写实画风:石台、台边、路灯、灌木、亭子 / 石碑 / 月洞门换成 Poly Haven 实景素材,四周点缀石头、蕨、野花 */
  realistic?: { base?: string; quality: 'high' | 'low' };
  /** 房间的泼溅外壳要用(Spark 需要渲染器) */
  renderer?: THREE.WebGLRenderer | null;
  quality?: 'high' | 'low';
  onSplatStatus?: (s: SplatStatus, info?: { error?: string; splats?: number }) => void;
}

export function buildWorld(THREE_NS: typeof THREE, initialPreset: string, def: WorldDef = DEFAULT_WORLD, bopts: BuildWorldOptions = {}): WorldHandle {
  const island = !!bopts.island;
  // 房间:没有地标、小路、星光,换成房间外壳(roomShell.ts)
  const roomInfo = def.kind === 'room' ? def.room ?? null : null;
  const ZONES = roomInfo ? [] : def.zones.length > 0 ? def.zones : DEFAULT_WORLD.zones;
  const group = new THREE_NS.Group();
  group.name = 'dh-world';
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };
  let theme = worldTheme(initialPreset);
  const kit: RealKit | null = bopts.realistic ? createRealKit(THREE_NS, bopts.realistic) : null;
  // 言出法随摆出来的东西:画风无关,风格化场景里摆的也是实景模型
  const objects = createObjectLayer(THREE_NS, group, { base: bopts.realistic?.base, quality: bopts.realistic?.quality ?? 'high', lodQuality: bopts.quality ?? 'high', renderer: bopts.renderer ?? null });

  // ── 托底光:舞台聚光照不到外圈,给一点点环境光让远处的地标有体积感
  const hemi = new THREE_NS.HemisphereLight(theme.hemiSky, theme.hemiGround, island ? 0 : theme.hemi);
  group.add(hemi);

  // ── 地面:实心大圆(接收阴影)+ 一层叠加着色器画小路、网格和地标光圈
  const groundMat = track(new THREE_NS.MeshStandardMaterial({ color: theme.ground, roughness: 0.92, metalness: 0.05 }));
  if (kit) {
    // CircleGeometry 的 uv 横跨整个直径:按 1.6 米一块铺
    kit.texSet(groundMat, def.kind === 'insight' ? 'mossy_cobblestone' : 'stone_tiles_02', ((WORLD_RADIUS + 1.3) * 2) / 1.6, { normalScale: 0.9 });
  } else if (island) {
    // 地面细节:大块的深浅斑驳 + (星光广场)石板铺装的缝;感悟庭院只在舞台一圈铺石板,外面是土和苔
    const paved = def.kind !== 'insight' ? 1 : 0;
    groundMat.onBeforeCompile = (shader) => {
      shader.uniforms.uPaved = { value: paved };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vGW; uniform float uPaved;
          float gh(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
          float gn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(gh(i), gh(i + vec2(1,0)), u.x), mix(gh(i + vec2(0,1)), gh(i + vec2(1,1)), u.x), u.y); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          {
            vec2 p = vGW.xz;
            float r = length(p);
            float n = gn(p * 0.35) * 0.6 + gn(p * 1.7) * 0.3 + gn(p * 6.0) * 0.1;
            diffuseColor.rgb *= 0.78 + n * 0.42;
            // 石板:极坐标上一圈圈错缝的砖,越往外越大
            float pave = max(uPaved, 1.0 - smoothstep(4.8, 5.6, r));
            if (pave > 0.0) {
              float ring = r / 1.1;
              float ri = floor(ring);
              float ang = atan(p.y, p.x) / 6.2831853 * floor(6.0 + ri * 5.5) + ri * 0.37;
              vec2 cell = vec2(fract(ang), fract(ring));
              float seam = min(min(cell.x, 1.0 - cell.x) * (ri + 1.0) * 1.1, min(cell.y, 1.0 - cell.y) * 1.1);
              float groove = smoothstep(0.0, 0.04, seam);
              float tile = 0.88 + gh(vec2(floor(ang), ri)) * 0.2;
              diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * tile * mix(0.55, 1.0, groove), pave);
            }
          }`);
    };
  }
  const ground = new THREE_NS.Mesh(track(new THREE_NS.CircleGeometry(island ? WORLD_RADIUS + 1.3 : WORLD_RADIUS + 10, 128)), groundMat);
  if (island) {
    // 湖心石台:一圈石砌的台边(外侧往下没进水里)+ 台面边缘一道浅色压边石
    const rimMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x6f6a62, roughness: 0.92 }));
    const wall = new THREE_NS.Mesh(track(new THREE_NS.CylinderGeometry(WORLD_RADIUS + 1.3, WORLD_RADIUS + 1.6, 1.4, 128, 1, true)), rimMat);
    wall.position.y = -0.72;
    wall.receiveShadow = true;
    const capMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.85 }));
    const cap = new THREE_NS.Mesh(track(new THREE_NS.RingGeometry(WORLD_RADIUS + 0.8, WORLD_RADIUS + 1.35, 128)), capMat);
    if (kit) {
      // 台边一圈周长约 110 米、高 1.4 米:横向铺 60 块,竖向 1 块
      kit.texSet(rimMat, 'japanese_stone_wall', [60, 1]);
      kit.texSet(capMat, 'rock_wall_08', 40);
    }
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = 0.035;
    cap.receiveShadow = true;
    group.add(wall, cap);
  }
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  ground.receiveShadow = true;
  ground.name = 'dh-world-ground';
  group.add(ground);

  const roomShell: RoomShell | null = roomInfo ? buildRoomShell(THREE_NS, roomInfo, { renderer: bopts.renderer, quality: bopts.quality, onSplatStatus: bopts.onSplatStatus }) : null;
  if (roomShell) {
    group.add(roomShell.group);
    // 泼溅自带地面:石台面藏起来(台边还在,看得出是湖心)
    if (roomShell.hideIslandGround) ground.visible = false;
  }

  // 房间没有地标:着色器数组不能是 0 长,塞一个远处的假地标,整层也不显示
  const zoneUniform = (ZONES.length ? ZONES : [{ x: 1e4, z: 1e4, radius: 0 }]).map((z) => new THREE_NS.Vector3(z.x, z.z, z.radius));
  const overlayMat = track(new THREE_NS.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE_NS.AdditiveBlending, fog: false,
    uniforms: {
      uTime: { value: 0 },
      uPath: { value: new THREE_NS.Color(theme.path) },
      uAccent: { value: new THREE_NS.Color(theme.accent) },
      uZones: { value: zoneUniform },
      uActive: { value: -1 },
      uR: { value: WORLD_RADIUS },
      uStrength: { value: kit ? 0.28 : 1 },
    },
    vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      varying vec2 vW; uniform float uTime; uniform vec3 uPath; uniform vec3 uAccent;
      uniform vec3 uZones[${zoneUniform.length}]; uniform float uActive; uniform float uR; uniform float uStrength;
      float line(float d, float w){ return 1.0 - smoothstep(0.0, w, abs(d)); }
      float segDist(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0); return length(pa - ba*h); }
      void main(){
        float r = length(vW);
        if (r > uR + 1.5) discard;
        float a = 0.0;
        // 内外两条环路
        a += line(r - 5.2, 0.07) * 0.9;
        a += line(r - (uR - 0.4), 0.09) * 0.8;
        // 环路上流动的光点
        float ang = atan(vW.y, vW.x);
        float dash = smoothstep(0.55, 1.0, sin(ang * 28.0 - uTime * 1.6));
        a += line(r - 5.2, 0.16) * dash * 0.6;
        // 舞台 → 各地标的小路 + 地标光圈
        vec3 col = uPath * a;
        for (int i = 0; i < ${zoneUniform.length}; i++) {
          vec2 zc = uZones[i].xy; float zr = uZones[i].z;
          vec2 dir = normalize(zc);
          float pd = segDist(vW, dir * 5.2, zc - dir * zr);
          float p = line(pd, 0.05) * 0.7;
          float flow = smoothstep(0.7, 1.0, sin(dot(vW, dir) * 3.0 - uTime * 2.2));
          p += line(pd, 0.14) * flow * 0.5;
          float dz = length(vW - zc);
          float ring = line(dz - zr, 0.06);
          float isActive = step(abs(float(i) - uActive), 0.1);
          ring *= 0.6 + isActive * (0.9 + 0.5 * sin(uTime * 5.0));
          float fill = isActive * (1.0 - smoothstep(0.0, zr, dz)) * 0.18;
          col += uPath * p + uAccent * (ring + fill);
        }
        // 淡淡的网格:舞台上不画,越远越淡
        vec2 g = abs(fract(vW * 0.5) - 0.5);
        float grid = (1.0 - smoothstep(0.0, 0.02, min(g.x, g.y))) * 0.07 * smoothstep(5.4, 6.6, r) * (1.0 - 0.6 * smoothstep(9.0, uR, r));
        col += uPath * grid;
        float edge = 1.0 - smoothstep(uR - 0.2, uR + 1.5, r);
        gl_FragColor = vec4(col * edge * uStrength, 1.0);
      }`,
  }));
  const overlay = new THREE_NS.Mesh(track(new THREE_NS.CircleGeometry(WORLD_RADIUS + 1.6, 128)), overlayMat);
  overlay.rotation.x = -Math.PI / 2;
  overlay.position.y = 0.012;
  overlay.renderOrder = 1;
  overlay.visible = !roomInfo;
  group.add(overlay);

  // ── 共用材质
  const darkMetal = track(new THREE_NS.MeshStandardMaterial({ color: 0x1b1f2e, roughness: 0.4, metalness: 0.75 }));
  const stone = track(new THREE_NS.MeshStandardMaterial({ color: 0x3a3f55, roughness: 0.85, metalness: 0.05 }));
  if (kit) kit.texSet(stone, 'rock_wall_08', 1.5, { tint: 0xb8b4ac });
  /** 写实地标:模型异步到,点击靠一个看不见的盒子 */
  const pickBox = (g: THREE.Group, w: number, h: number, d: number, rotY = 0) => {
    const pick = new THREE_NS.Mesh(G.box(w, h, d), track(new THREE_NS.MeshBasicMaterial({ visible: false })));
    pick.position.y = h / 2;
    pick.rotation.y = rotY;
    g.add(pick);
    pickables.push(pick);
  };
  /** 写实时在某个地标组里摆一件实景道具(本地坐标) */
  const place = (parent: THREE.Object3D, id: string, x: number, z: number, rot = 0, scale = 1, y = 0) => {
    kit?.model(id).then((o) => { o.position.set(x, y, z); o.rotation.y = rot; o.scale.setScalar(scale); parent.add(o); }).catch(() => { /* 没到就不摆 */ });
  };
  const glowMat = (c: number, opacity = 1) => track(new THREE_NS.MeshBasicMaterial({ color: c, transparent: opacity < 1, opacity, fog: false }));
  const emissive = (c: number, k = 1.2) => track(new THREE_NS.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: k, roughness: 0.5 }));
  const G = {
    box: (w: number, h: number, d: number) => track(new THREE_NS.BoxGeometry(w, h, d)),
    cyl: (rt: number, rb: number, h: number, s = 24, open = false) => track(new THREE_NS.CylinderGeometry(rt, rb, h, s, 1, open)),
    sphere: (r: number, s = 16) => track(new THREE_NS.SphereGeometry(r, s, Math.max(8, s * 0.75))),
    torus: (r: number, t: number) => track(new THREE_NS.TorusGeometry(r, t, 12, 64)),
  };
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE_NS.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    return o;
  };

  // 每帧要动的东西
  const spinners: { o: THREE.Object3D; speed: number }[] = [];
  const bobbers: { o: THREE.Object3D; base: number; amp: number; speed: number; phase: number }[] = [];
  const pickables: THREE.Object3D[] = [];
  const zoneLabels = new Map<ZoneId, THREE.Sprite>();
  let danceTiles: THREE.Mesh[] = [];
  let danceColor = 0xff4fd8;
  let danceHot = false;
  let fountainWater: THREE.ShaderMaterial | null = null;
  let cinemaScreen: THREE.ShaderMaterial | null = null;
  const spray: { o: THREE.Mesh; v: THREE.Vector3; life: number }[] = [];

  function landmark(zone: WorldZone): THREE.Group {
    const g = new THREE_NS.Group();
    g.position.set(zone.x, 0, zone.z);
    // 让地标正面朝舞台
    g.rotation.y = Math.atan2(-zone.x, -zone.z);
    const c = zone.color;
    switch (zoneProp(zone)) {
      case 'dance': {
        danceColor = c;
        const n = 6, s = 0.62;
        danceTiles = [];
        const tileGeo = G.box(s * 0.94, 0.05, s * 0.94);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const m = track(new THREE_NS.MeshStandardMaterial({ color: 0x0a0a12, emissive: c, emissiveIntensity: 0.2, roughness: 0.3, metalness: 0.4 }));
          const tile = new THREE_NS.Mesh(tileGeo, m);
          tile.position.set((i - (n - 1) / 2) * s, 0.025, (j - (n - 1) / 2) * s);
          tile.receiveShadow = true;
          tile.userData.ij = [i, j];
          g.add(tile);
          danceTiles.push(tile);
        }
        // 头顶的迪斯科球
        const pole = mesh(G.cyl(0.03, 0.03, 3.4, 8), darkMetal, -2.1, 1.7, -2.1);
        const arm = mesh(G.cyl(0.025, 0.025, 2.9, 8), darkMetal, -1.05, 3.4, -1.05);
        arm.rotation.z = Math.PI / 2; arm.rotation.y = -Math.PI / 4;
        const ball = mesh(G.sphere(0.32, 20), track(new THREE_NS.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.15, emissive: c, emissiveIntensity: 0.35, flatShading: true })), 0, 3.2, 0);
        spinners.push({ o: ball, speed: 0.8 });
        g.add(pole, arm, ball);
        break;
      }
      case 'jukebox': {
        const shell = track(new THREE_NS.MeshStandardMaterial({ color: 0x5a2a12, roughness: 0.35, metalness: 0.4, emissive: c, emissiveIntensity: 0.18 }));
        const body = mesh(G.box(1.0, 1.5, 0.6), shell, 0, 0.75, 0);
        const arch = mesh(G.cyl(0.5, 0.5, 0.6, 32, false), shell, 0, 1.5, 0);
        arch.rotation.x = Math.PI / 2;
        const glass = mesh(G.box(0.7, 0.55, 0.02), glowMat(c, 0.85), 0, 1.05, 0.31);
        const stripeL = mesh(G.box(0.06, 1.3, 0.04), emissive(0xff4fd8, 2), -0.44, 0.8, 0.3);
        const stripeR = mesh(G.box(0.06, 1.3, 0.04), emissive(0x25f4ee, 2), 0.44, 0.8, 0.3);
        g.add(body, arch, glass, stripeL, stripeR);
        pickables.push(body, arch);
        // 飘着的音符
        ['♪', '♫', '♪'].forEach((ch, i) => {
          const sp = makeTextSprite(THREE_NS, ch, { color: hex(c), size: 64 });
          sp.position.set(-0.5 + i * 0.5, 2.3, 0);
          track(sp.material); track(sp.material.map!);
          g.add(sp);
          bobbers.push({ o: sp, base: 2.2 + i * 0.12, amp: 0.18, speed: 1.4 + i * 0.3, phase: i * 1.7 });
        });
        break;
      }
      case 'wish': {
        const basin = mesh(G.cyl(1.7, 1.85, 0.45, 48), stone, 0, 0.225, 0);
        const rim = mesh(G.torus(1.72, 0.08), stone, 0, 0.45, 0);
        rim.rotation.x = Math.PI / 2;
        fountainWater = track(new THREE_NS.ShaderMaterial({
          transparent: true, fog: false,
          uniforms: { uTime: { value: 0 }, uCol: { value: new THREE_NS.Color(c) } },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
          fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uCol;
            void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0;
              float w = sin(r * 22.0 - uTime * 3.0) * 0.5 + 0.5;
              vec3 col = mix(uCol * 0.35, uCol * 1.2, w * (1.0 - r * 0.6));
              gl_FragColor = vec4(col, 0.85); }`,
        }));
        const water = new THREE_NS.Mesh(track(new THREE_NS.CircleGeometry(1.62, 48)), fountainWater);
        water.rotation.x = -Math.PI / 2; water.position.y = 0.4;
        const column = mesh(G.cyl(0.14, 0.22, 1.3, 16), stone, 0, 1.0, 0);
        const bowl = mesh(G.cyl(0.55, 0.2, 0.18, 24), stone, 0, 1.62, 0);
        const orb = mesh(G.sphere(0.2), glowMat(c), 0, 1.95, 0);
        bobbers.push({ o: orb, base: 1.95, amp: 0.08, speed: 1.2, phase: 0 });
        g.add(basin, rim, water, column, bowl, orb);
        pickables.push(basin, column);
        // 水花粒子(循环复用)
        const dropGeo = G.sphere(0.035, 6);
        const dropMat = glowMat(c, 0.8);
        for (let i = 0; i < 24; i++) {
          const d = new THREE_NS.Mesh(dropGeo, dropMat);
          d.position.set(0, 1.7, 0);
          g.add(d);
          spray.push({ o: d, v: new THREE_NS.Vector3(), life: -Math.random() * 1.5 });
        }
        break;
      }
      case 'cinema': {
        const booth = mesh(G.box(2.0, 1.9, 1.3), darkMetal, 0, 0.95, -0.2);
        const roof = mesh(G.box(2.3, 0.12, 1.6), emissive(c, 0.8), 0, 1.96, -0.2);
        cinemaScreen = track(new THREE_NS.ShaderMaterial({
          fog: false,
          uniforms: { uTime: { value: 0 }, uCol: { value: new THREE_NS.Color(c) } },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
          fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uCol;
            void main(){ vec2 p = vUv; float t = uTime * 0.4;
              vec3 a = vec3(0.5 + 0.5*sin(t + p.x*3.0), 0.5 + 0.5*sin(t*1.3 + p.y*4.0 + 2.0), 0.6 + 0.4*sin(t*0.7 + 4.0));
              float scan = 0.85 + 0.15 * sin(p.y * 180.0);
              float vig = smoothstep(0.75, 0.2, length(p - 0.5));
              gl_FragColor = vec4(mix(uCol, a, 0.6) * scan * (0.4 + 0.8 * vig), 1.0); }`,
        }));
        const screen = new THREE_NS.Mesh(track(new THREE_NS.PlaneGeometry(1.6, 0.9)), cinemaScreen);
        screen.position.set(0, 1.15, 0.46);
        const sign = makeTextSprite(THREE_NS, 'NOW SHOWING', { color: '#fff', bg: hex(c), size: 30 });
        track(sign.material); track(sign.material.map!);
        sign.position.set(0, 2.35, 0.2);
        // 两侧的爆米花灯柱
        const l = mesh(G.cyl(0.08, 0.08, 1.6, 12), emissive(0xffb74f, 1.5), -1.2, 0.8, 0.5);
        const r = mesh(G.cyl(0.08, 0.08, 1.6, 12), emissive(0xffb74f, 1.5), 1.2, 0.8, 0.5);
        g.add(booth, roof, screen, sign, l, r);
        pickables.push(booth, screen);
        break;
      }
      case 'books': {
        const kiosk = mesh(G.cyl(0.95, 1.0, 1.9, 8), darkMetal, 0, 0.95, 0);
        const roof = mesh(G.cyl(0.05, 1.3, 0.7, 8), emissive(c, 0.6), 0, 2.25, 0);
        g.add(kiosk, roof);
        pickables.push(kiosk);
        const bookColors = [0xff6b6b, 0xffd93d, 0x6bcBff, 0x6bff9b, 0xc38bff, 0xff9f5a];
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          const b = mesh(G.box(0.12, 0.34 + (i % 3) * 0.05, 0.26), track(new THREE_NS.MeshStandardMaterial({ color: bookColors[i % bookColors.length], roughness: 0.6, emissive: bookColors[i % bookColors.length], emissiveIntensity: 0.25 })), Math.sin(a) * 1.0, 1.25 + (i % 2) * 0.42, Math.cos(a) * 1.0);
          b.rotation.y = a;
          g.add(b);
        }
        // 飘着的书页
        for (let i = 0; i < 3; i++) {
          const page = mesh(G.box(0.3, 0.02, 0.22), glowMat(0xffffff, 0.9), 0, 2.9 + i * 0.25, 0);
          g.add(page);
          bobbers.push({ o: page, base: 2.9 + i * 0.25, amp: 0.12, speed: 0.9 + i * 0.4, phase: i });
          spinners.push({ o: page, speed: 0.6 + i * 0.3 });
        }
        break;
      }
      case 'stars': {
        const deck = mesh(G.cyl(1.9, 2.0, 0.3, 40), stone, 0, 0.15, 0);
        deck.receiveShadow = true;
        const rail = mesh(G.torus(1.85, 0.03), emissive(c, 1.4), 0, 1.0, 0);
        rail.rotation.x = Math.PI / 2;
        const scope = new THREE_NS.Group();
        scope.position.set(0, 0.3, 0);
        for (let i = 0; i < 3; i++) {
          const leg = mesh(G.cyl(0.025, 0.03, 1.3, 8), darkMetal);
          const a = (i / 3) * Math.PI * 2;
          leg.position.set(Math.sin(a) * 0.3, 0.6, Math.cos(a) * 0.3);
          leg.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25);
          scope.add(leg);
        }
        const tube = mesh(G.cyl(0.11, 0.16, 1.4, 20), track(new THREE_NS.MeshStandardMaterial({ color: 0xd8dcf0, metalness: 0.8, roughness: 0.25 })), 0, 1.45, 0);
        tube.rotation.x = -0.9;
        scope.add(tube);
        g.add(deck, rail, scope);
        pickables.push(deck, tube);
        spinners.push({ o: scope, speed: 0.12 });
        break;
      }
      // ── 感悟庭院的中式造型 ──
      case 'pavilion': {
        if (kit) {
          // 写实:Blender 建的四角攒尖亭(scripts/blender/make_pavilion.py:石台基、朱漆柱、额枋挂落、美人靠、
          // 起翘的曲面瓦顶和垂脊宝顶),正面朝广场中心;台基面 0.38 米高,亭心摆茶几凳子、檐下挂吊灯
          const face = Math.atan2(-zone.x, -zone.z);
          place(g, 'pavilion_square', 0, 0, face);
          place(g, 'chinese_tea_table', 0, 0, face + 0.3, 1, 0.38);
          place(g, 'chinese_stool', Math.cos(face) * -0.6, -Math.sin(face) * -0.6, face + 1.2, 1, 0.38);
          place(g, 'chinese_stool', Math.cos(face) * 0.6, -Math.sin(face) * 0.6, face - 1.9, 1, 0.38);
          place(g, 'chinese_chandelier', 0, 0, 0, 1, 2.8);
          const lamp = mesh(G.sphere(0.07), glowMat(0xfff0c8, 0.9), 0, 2.2, 0);
          // 拾取:看不见的盒子(模型是异步到的,点击要一直能点中)
          const pick = new THREE_NS.Mesh(G.box(3.0, 3.2, 3.0), track(new THREE_NS.MeshBasicMaterial({ visible: false })));
          pick.position.y = 1.6;
          g.add(lamp, pick);
          pickables.push(pick);
          break;
        }
        // 风格化:四根朱柱 + 两层攒尖顶 + 顶上一颗宝珠,亭心一盏灯
        const pillar = track(new THREE_NS.MeshStandardMaterial({ color: 0x7a1f1f, roughness: 0.6 }));
        for (const [px, pz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) g.add(mesh(G.cyl(0.08, 0.09, 2.2, 10), pillar, px, 1.1, pz));
        const base = mesh(G.box(2.4, 0.2, 2.4), stone, 0, 0.1, 0);
        base.receiveShadow = true;
        const roofMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x1d2433, roughness: 0.5, metalness: 0.3, emissive: c, emissiveIntensity: 0.12 }));
        const roof1 = mesh(G.cyl(0.2, 1.9, 0.7, 4), roofMat, 0, 2.55, 0);
        roof1.rotation.y = Math.PI / 4;
        const roof2 = mesh(G.cyl(0.05, 0.6, 0.45, 4), roofMat, 0, 3.05, 0);
        roof2.rotation.y = Math.PI / 4;
        const pearl = mesh(G.sphere(0.12), glowMat(c), 0, 3.35, 0);
        const lamp = mesh(G.sphere(0.2), glowMat(0xfff0c8, 0.9), 0, 1.6, 0);
        bobbers.push({ o: lamp, base: 1.6, amp: 0.05, speed: 1.3, phase: zone.x });
        g.add(base, roof1, roof2, pearl, lamp);
        pickables.push(base, roof1);
        break;
      }
      case 'stele': {
        // 石碑:碑座 + 碑身,碑面一道发光的竖线(像刻着的字)
        const seat = mesh(G.box(1.3, 0.35, 0.8), stone, 0, 0.175, 0);
        const steleMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x2a2d38, roughness: 0.8 }));
        if (kit) {
          kit.texSet(steleMat, 'dry_riverbed_rock', 1, { tint: 0x77746f });
          place(g, 'moss_01', 0.7, 0.35, 0.4);
          place(g, 'fern_02', -0.8, 0.3, 2.1, 0.8);
        }
        const body = mesh(G.box(0.95, 2.1, 0.28), steleMat, 0, 1.4, 0);
        const cap = mesh(G.box(1.1, 0.18, 0.36), stone, 0, 2.5, 0);
        for (let i = 0; i < 3; i++) g.add(mesh(G.box(0.05, 1.5, 0.01), glowMat(c, 0.85), -0.25 + i * 0.25, 1.45, 0.145));
        g.add(seat, body, cap);
        pickables.push(body, seat);
        break;
      }
      case 'lantern': {
        // 灯亭:一根木杆挑着三盏红灯笼,微微晃
        const poleMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x4a2f1b, roughness: 0.8 }));
        if (kit) kit.texSet(poleMat, 'japanese_cedar_planks', [0.5, 3]);
        const pole = mesh(G.cyl(0.06, 0.08, 3.2, 10), poleMat, 0, 1.6, 0);
        const arm = mesh(G.cyl(0.04, 0.04, 2.0, 8), darkMetal, 0, 3.1, 0);
        arm.rotation.z = Math.PI / 2;
        g.add(pole, arm);
        pickables.push(pole);
        const lanternMat = track(new THREE_NS.MeshStandardMaterial({ color: 0xc81e1e, emissive: 0xff5a2a, emissiveIntensity: 0.9, roughness: 0.6 }));
        for (const lx of [-0.9, 0, 0.9]) {
          const l = new THREE_NS.Group();
          l.position.set(lx, 2.55, 0);
          const shell = mesh(G.sphere(0.26, 14), lanternMat);
          shell.scale.set(1, 1.25, 1);
          const tassel = mesh(G.cyl(0.02, 0.05, 0.3, 6), glowMat(0xffc93d), 0, -0.45, 0);
          l.add(shell, tassel);
          g.add(l);
          pickables.push(shell);
          bobbers.push({ o: l, base: 2.55, amp: 0.04, speed: 1.1 + lx, phase: lx * 2 });
        }
        break;
      }
      case 'willow': {
        if (kit) {
          // 写实:Poly Haven 阔叶树(bake_tree.py 减面),柳树没有现成的 CC0 模型
          place(g, 'tree_broad', 0, 0, zone.x * 0.7, 0.95);
          pickBox(g, 2.4, 4.6, 2.4);
          break;
        }
        // 柳树:树干 + 一圈垂下来的柳条(细长的半透明片)
        const trunk = mesh(G.cyl(0.18, 0.28, 2.6, 10), track(new THREE_NS.MeshStandardMaterial({ color: 0x3b2a1a, roughness: 0.9 })), 0, 1.3, 0);
        const crown = mesh(G.sphere(1.1, 14), track(new THREE_NS.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.8, emissive: c, emissiveIntensity: 0.08 })), 0, 3.0, 0);
        crown.scale.set(1.2, 0.7, 1.2);
        g.add(trunk, crown);
        pickables.push(trunk, crown);
        const stripMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x6fae5a, transparent: true, opacity: 0.85, side: THREE_NS.DoubleSide, emissive: c, emissiveIntensity: 0.1 }));
        const stripGeo = track(new THREE_NS.PlaneGeometry(0.08, 1.6));
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          const st = new THREE_NS.Mesh(stripGeo, stripMat);
          st.position.set(Math.sin(a) * 1.15, 2.2, Math.cos(a) * 1.15);
          st.rotation.y = a;
          g.add(st);
          bobbers.push({ o: st, base: 2.2, amp: 0.05, speed: 0.8 + (i % 3) * 0.2, phase: i });
        }
        break;
      }
      case 'moongate': {
        if (kit) {
          // 写实:Blender 建的粉墙黛瓦月洞门(scripts/blender/make_moongate.py),墙面朝广场中心
          const face = Math.atan2(-zone.x, -zone.z);
          place(g, 'moongate', 0, 0, face);
          pickBox(g, 4.4, 3.4, 0.5, face);
          break;
        }
        // 月洞门:一面墙中间开一个圆洞,洞沿发光
        const wallMat = track(new THREE_NS.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.9 }));
        const shape = new THREE_NS.Shape();
        shape.moveTo(-1.8, 0); shape.lineTo(1.8, 0); shape.lineTo(1.8, 3.0); shape.lineTo(-1.8, 3.0); shape.lineTo(-1.8, 0);
        const hole = new THREE_NS.Path();
        hole.absarc(0, 1.45, 1.1, 0, Math.PI * 2, false);
        shape.holes.push(hole);
        const wall = mesh(track(new THREE_NS.ExtrudeGeometry(shape, { depth: 0.25, bevelEnabled: false })), wallMat, 0, 0, -0.12);
        const tileMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x2b2f3a, roughness: 0.6 }));
        const tile = mesh(G.box(3.9, 0.16, 0.5), tileMat, 0, 3.08, 0);
        const ring = mesh(G.torus(1.1, 0.04), emissive(c, 1.6), 0, 1.45, 0.14);
        g.add(wall, tile, ring);
        pickables.push(wall);
        break;
      }
    }
    // 名牌
    const label = makeTextSprite(THREE_NS, `${zone.emoji} ${zone.label}`, { color: '#fff', bg: 'rgba(8,10,20,0.72)', border: hex(zone.color), size: 40 });
    track(label.material); track(label.material.map!);
    const prop = zoneProp(zone);
    const labelY = prop === 'dance' ? 3.9 : prop === 'wish' || prop === 'stars' ? 2.7 : prop === 'pavilion' ? (kit ? 5.0 : 3.6) : prop === 'moongate' ? (kit ? 4.1 : 3.6) : prop === 'willow' ? (kit ? 5.4 : 3.9) : 3.1;
    label.position.set(zone.x, labelY, zone.z);
    group.add(label);
    zoneLabels.set(zone.id, label);
    bobbers.push({ o: label, base: labelY, amp: 0.06, speed: 1.1, phase: zone.x });

    g.traverse((o) => { o.userData.zoneId = zone.id; });
    return g;
  }

  for (const zone of ZONES) group.add(landmark(zone));
  // 舞池整块地板也能点
  pickables.push(...danceTiles);

  // ── 外圈路灯 + 灌木
  const lampHead = glowMat(0xfff2c8);
  // 几盏真的点光源(隔几根路灯放一盏),夜里把石台照出暖色的光斑;白天几乎关掉
  const lampLights: THREE.PointLight[] = [];
  function setLampBoost(k: number) {
    lampHead.color.setRGB(1.0 * k, 0.95 * k, 0.78 * k);
    for (const l of lampLights) l.intensity = Math.max(0, k - 1.3) * 14;
  }
  const lampGeo = kit ? G.cyl(0.05, 0.06, 2.3, 8) : G.cyl(0.04, 0.05, 2.6, 8);
  const headGeo = G.sphere(kit ? 0.06 : 0.13, 12);
  const postMat = kit ? track(new THREE_NS.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.8 })) : darkMetal;
  if (kit) kit.texSet(postMat, 'japanese_cedar_planks', [0.4, 3]);
  const lanternSpots: Spot[] = [];
  const bushSpots: Spot[][] = [[], [], [], []];
  const bushMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x1f4a33, roughness: 0.9 }));
  const bushGeo = G.sphere(0.5, 10);
  const lamps = 20;
  for (let i = 0; i < lamps; i++) {
    const a = (i / lamps) * Math.PI * 2 + 0.08;
    const r = WORLD_RADIUS + 0.4;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const post = mesh(lampGeo, postMat, x, kit ? 1.15 : 1.3, z);
    const head = new THREE_NS.Mesh(headGeo, lampHead);
    head.position.set(x, kit ? 2.55 : 2.65, z);
    group.add(post, head);
    if (kit) lanternSpots.push({ x, y: 2.3, z, rot: a, scale: 1.25 });
    if (island && i % 3 === 0) {
      const pl = new THREE_NS.PointLight(0xffc98a, 0, 9, 1.6);
      pl.position.set(x * 0.97, 2.5, z * 0.97);
      group.add(pl);
      lampLights.push(pl);
    }
    if (kit) {
      bushSpots[i % 4].push({ x: Math.sin(a + 0.16) * (r + 0.3), z: Math.cos(a + 0.16) * (r + 0.3), rot: i * 1.7, scale: 0.7 + (i % 3) * 0.15 });
      continue;
    }
    const b = mesh(bushGeo, bushMat, Math.sin(a + 0.16) * (r + 0.3), 0.3, Math.cos(a + 0.16) * (r + 0.3));
    b.scale.set(1.2, 0.7, 1);
    group.add(b);
  }
  if (kit) {
    kit.scatter(group, 'wooden_lantern_01', lanternSpots);
    ['shrub_01', 'shrub_02', 'shrub_03', 'shrub_04'].forEach((id, k) => kit.scatter(group, id, bushSpots[k]));
    scatterNature(kit);
  }

  /** 写实:台面外圈和地标旁边点缀石头、蕨、树桩、野花(避开地标实心区和小路) */
  function scatterNature(k: RealKit) {
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const blocked = (x: number, z: number) => ZONES.some((zn) => Math.hypot(x - zn.x, z - zn.z) < zn.solidRadius + 0.8)
      || ZONES.some((zn) => {
        const L = Math.hypot(zn.x, zn.z) || 1, ux = zn.x / L, uz = zn.z / L;
        const t = x * ux + z * uz;
        return t > 4.5 && t < L && Math.abs(x * uz - z * ux) < 1.0;
      });
    const ring = (n: number, r0: number, r1: number, scale: [number, number]) => {
      const out: Spot[] = [];
      for (let tries = 0; out.length < n && tries < n * 20; tries++) {
        const a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0);
        const x = Math.sin(a) * r, z = Math.cos(a) * r;
        if (blocked(x, z)) continue;
        out.push({ x, z, rot: rnd() * 6.28, scale: scale[0] + rnd() * (scale[1] - scale[0]) });
      }
      return out;
    };
    const R = WORLD_RADIUS;
    k.scatter(group, 'rock_moss_set_01', ring(8, R - 2.4, R - 0.9, [0.7, 1.1]));
    k.scatter(group, 'rock_moss_set_02', ring(8, R - 2.4, R - 0.9, [0.7, 1.1]));
    k.scatter(group, 'boulder_01', ring(3, R - 2.6, R - 1.4, [0.8, 1.1]));
    k.scatter(group, 'stone_01', ring(14, 6.5, R - 1, [0.6, 1.2]), { castShadow: false });
    k.scatter(group, 'fern_02', ring(18, 7, R - 0.8, [0.6, 1.0]));
    k.scatter(group, 'tree_stump_01', ring(3, R - 3, R - 1.5, [0.8, 1.0]));
    k.scatter(group, 'dandelion_01', ring(24, 7, R - 1, [0.8, 1.2]), { castShadow: false });
    k.scatter(group, 'celandine_01', ring(24, 7, R - 1, [0.8, 1.2]), { castShadow: false });
    k.scatter(group, 'moss_01', ring(10, 6, R - 1, [0.8, 1.3]), { castShadow: false });
    // 庭院的草:真实的草丛代替风格化的草叶(环境层在写实时不再种那一种)
    if (worldEnv(def).grass) {
      const n = bopts.realistic?.quality === 'high' ? 420 : 160;
      k.scatter(group, 'grass_medium_01', ring(n, 7.2, R - 0.6, [0.8, 1.3]), { castShadow: false });
      k.scatter(group, 'grass_medium_02', ring(n, 7.2, R - 0.6, [0.8, 1.3]), { castShadow: false });
    }
  }

  // ── 星光
  const orbGroup = new THREE_NS.Group();
  group.add(orbGroup);
  const orbCore = G.sphere(0.13, 14);
  const orbCoreMat = glowMat(island ? 0xcfc088 : 0xfff6c8);
  const orbGoldMat = glowMat(island ? 0xd9a030 : 0xffc93d);
  const haloTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const cx = cv.getContext('2d')!;
    const grd = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,240,200,0.55)'); grd.addColorStop(1, 'rgba(255,220,150,0)');
    cx.fillStyle = grd; cx.fillRect(0, 0, 64, 64);
    const t = new THREE_NS.CanvasTexture(cv); return track(t);
  })();
  // 有泛光时光晕会被放大,颜色压暗一点
  const haloMat = track(new THREE_NS.SpriteMaterial({ map: haloTex, color: island ? 0x8a7a50 : 0xfff0c0, transparent: true, depthWrite: false, blending: THREE_NS.AdditiveBlending, fog: false }));
  const haloGoldMat = track(new THREE_NS.SpriteMaterial({ map: haloTex, color: island ? 0x8a5a10 : 0xffb020, transparent: true, depthWrite: false, blending: THREE_NS.AdditiveBlending, fog: false }));
  const orbObjs = new Map<number, { g: THREE.Group; collecting: number; golden: boolean }>();
  // 捡起时用的一次性材质,各自淡出互不影响
  const burstMats: THREE.Material[] = [];

  function setOrbs(orbs: Orb[]) {
    const keep = new Set(orbs.map((o) => o.id));
    for (const [id, o] of orbObjs) {
      if (!keep.has(id) && o.collecting < 0) { orbGroup.remove(o.g); orbObjs.delete(id); }
    }
    for (const orb of orbs) {
      let o = orbObjs.get(orb.id);
      if (o && o.collecting >= 0) { orbGroup.remove(o.g); orbObjs.delete(orb.id); o = undefined; }
      if (!o) {
        const g = new THREE_NS.Group();
        const core = new THREE_NS.Mesh(orbCore, orb.golden ? orbGoldMat : orbCoreMat);
        // 写实画风:星光缩成萤火大小的暖光点,不要一个个大圆盘
        const k = kit ? 0.4 : 1;
        core.scale.setScalar((orb.golden ? 1.35 : 1) * k);
        const halo = new THREE_NS.Sprite(orb.golden ? haloGoldMat : haloMat);
        halo.scale.setScalar((orb.golden ? 1.0 : 0.7) * k);
        g.add(core, halo);
        g.userData.phase = Math.random() * Math.PI * 2;
        orbGroup.add(g);
        o = { g, collecting: -1, golden: orb.golden };
        orbObjs.set(orb.id, o);
      }
      o.g.position.set(orb.x, 0.75, orb.z);
    }
  }

  function collectOrb(id: number) {
    const o = orbObjs.get(id);
    if (!o || o.collecting >= 0) return;
    o.collecting = 0;
    // 换成独立材质再淡出,不影响其它星光
    o.g.children.forEach((c) => {
      const m = (c as THREE.Mesh).material as THREE.Material;
      const mm = m.clone();
      burstMats.push(mm);
      (c as THREE.Mesh).material = mm;
    });
  }

  // ── 点地面的落点波纹
  const markerMat = track(new THREE_NS.MeshBasicMaterial({ color: theme.path, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE_NS.DoubleSide }));
  const marker = new THREE_NS.Mesh(track(new THREE_NS.RingGeometry(0.22, 0.3, 40)), markerMat);
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.03;
  marker.visible = false;
  group.add(marker);
  let markerT = -1;

  // ── 飘字
  const floats: { s: THREE.Sprite; t: number; y0: number }[] = [];
  function floatText(text: string, x: number, y: number, z: number, color = '#fff') {
    const s = makeTextSprite(THREE_NS, text, { color, size: 48 });
    // 跟随镜头离角色只有四五米,字要小一点,不然一冒出来就顶出画面
    s.scale.multiplyScalar(0.6);
    (s.userData.baseScale as THREE.Vector3).multiplyScalar(0.6);
    s.position.set(x, y, z);
    s.renderOrder = 10;
    (s.material as THREE.SpriteMaterial).depthTest = false;
    group.add(s);
    floats.push({ s, t: 0, y0: y });
  }

  let activeZone: ZoneId | null = null;
  function setActiveZone(id: ZoneId | null) {
    activeZone = id;
    overlayMat.uniforms.uActive.value = id ? ZONES.findIndex((z) => z.id === id) : -1;
  }

  function setTheme(preset: string) {
    theme = { ...worldTheme(preset), ...(def.palette?.ground !== undefined ? { ground: def.palette.ground } : {}), ...(def.palette?.path !== undefined ? { path: def.palette.path } : {}), ...(def.palette?.accent !== undefined ? { accent: def.palette.accent } : {}) };
    groundMat.color.setHex(theme.ground);
    (overlayMat.uniforms.uPath.value as THREE.Color).setHex(theme.path);
    (overlayMat.uniforms.uAccent.value as THREE.Color).setHex(theme.accent);
    // 浅色地面上加色叠加几乎看不见,也不该发亮 —— 降一点强度
    overlayMat.uniforms.uStrength.value = preset === 'studio' || preset === 'lawn' ? 0.55 : 1;
    markerMat.color.setHex(theme.path);
    hemi.color.setHex(theme.hemiSky);
    hemi.groundColor.setHex(theme.hemiGround);
    hemi.intensity = theme.hemi;
  }
  setTheme(initialPreset);

  const tmpColor = new THREE_NS.Color();
  function tick(t: number, dt: number, camera: THREE.Camera) {
    overlayMat.uniforms.uTime.value = t;
    if (fountainWater) fountainWater.uniforms.uTime.value = t;
    if (cinemaScreen) cinemaScreen.uniforms.uTime.value = t;
    for (const s of spinners) s.o.rotation.y += dt * s.speed;
    for (const b of bobbers) b.o.position.y = b.base + Math.sin(t * b.speed + b.phase) * b.amp;

    // 舞池地砖:平时慢慢流光,跳舞时按拍子跳色
    const beat = Math.floor(t * 2.2);
    for (const tile of danceTiles) {
      const [i, j] = tile.userData.ij as [number, number];
      const m = tile.material as THREE.MeshStandardMaterial;
      if (danceHot) {
        const h = ((i * 7 + j * 13 + beat * 5) % 12) / 12;
        m.emissive.copy(tmpColor.setHSL(h, 0.95, 0.5));
        m.emissiveIntensity = ((i + j + beat) % 3 === 0) ? 1.2 : 0.35;
      } else {
        m.emissive.setHex(danceColor);
        m.emissiveIntensity = 0.15 + 0.25 * Math.max(0, Math.sin(t * 1.3 - (i + j) * 0.5));
      }
    }

    // 水花
    for (const d of spray) {
      d.life -= dt;
      if (d.life <= 0) {
        d.life = 1.1 + Math.random() * 0.4;
        const a = Math.random() * Math.PI * 2;
        d.v.set(Math.cos(a) * 0.45, 1.9 + Math.random() * 0.5, Math.sin(a) * 0.45);
        d.o.position.set(0, 1.72, 0);
      } else {
        d.v.y -= 4.2 * dt;
        d.o.position.addScaledVector(d.v, dt);
        if (d.o.position.y < 0.42) d.o.position.y = 0.42;
      }
    }

    // 星光:浮动 + 自转;捡起的放大上飘淡出
    for (const [id, o] of orbObjs) {
      const ph = o.g.userData.phase as number;
      if (o.collecting < 0) {
        o.g.children[0].position.y = Math.sin(t * 2 + ph) * 0.12;
        o.g.children[0].rotation.y += dt * 2;
        const pulse = 1 + Math.sin(t * 3 + ph) * 0.12;
        (o.g.children[1] as THREE.Sprite).scale.setScalar((o.golden ? 1.0 : 0.7) * pulse);
      } else {
        o.collecting += dt;
        const k = Math.min(1, o.collecting / 0.55);
        o.g.scale.setScalar(1 + k * 1.8);
        o.g.position.y = 0.75 + k * 1.4;
        o.g.children.forEach((c) => {
          const m = (c as THREE.Mesh).material as THREE.Material & { opacity: number; transparent: boolean };
          m.transparent = true;
          m.opacity = 1 - k;
        });
        if (k >= 1) {
          orbGroup.remove(o.g);
          o.g.children.forEach((c) => ((c as THREE.Mesh).material as THREE.Material).dispose());
          orbObjs.delete(id);
        }
      }
    }

    // 落点波纹
    if (markerT >= 0) {
      markerT += dt;
      const k = Math.min(1, markerT / 0.9);
      marker.scale.setScalar(1 + k * 2.5);
      markerMat.opacity = 0.9 * (1 - k);
      if (k >= 1) { markerT = -1; marker.visible = false; }
    }

    // 飘字:上飘 + 放大弹一下 + 淡出
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.t += dt;
      const k = f.t / 1.6;
      const base = f.s.userData.baseScale as THREE.Vector3;
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - Math.min(0.15, (k - 0.12) * 0.6);
      f.s.scale.set(base.x * pop, base.y * pop, 1);
      f.s.position.y = f.y0 + k * 0.4;
      (f.s.material as THREE.SpriteMaterial).opacity = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      if (k >= 1) {
        group.remove(f.s);
        (f.s.material as THREE.SpriteMaterial).map?.dispose();
        f.s.material.dispose();
        floats.splice(i, 1);
      }
    }

    // 名牌:当前所在地标的放大一点;太远的淡一点,免得满屏字
    const cp = camera.position;
    for (const [id, s] of zoneLabels) {
      const base = s.userData.baseScale as THREE.Vector3;
      const k = id === activeZone ? 1.25 : 1;
      s.scale.set(base.x * k, base.y * k, 1);
      const d = Math.hypot(s.position.x - cp.x, s.position.z - cp.z);
      (s.material as THREE.SpriteMaterial).opacity = id === activeZone ? 1 : Math.max(0.35, Math.min(1, 1.4 - d / 30));
    }
  }

  // ── 光环:一圈加色混合的光,颜色可换,rainbow 走色相循环
  function makeAura(value: string) {
    const mat = new THREE_NS.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE_NS.AdditiveBlending, fog: false, side: THREE_NS.DoubleSide,
      uniforms: { uTime: { value: 0 }, uCol: { value: new THREE_NS.Color(value === 'rainbow' ? 0xff4fd8 : value) }, uRainbow: { value: value === 'rainbow' ? 1 : 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uCol; uniform float uRainbow;
        vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
        void main(){
          vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
          float ring = smoothstep(0.62, 0.8, r) * (1.0 - smoothstep(0.8, 1.0, r));
          float inner = (1.0 - smoothstep(0.0, 0.8, r)) * 0.22;
          float spark = pow(max(0.0, sin(a * 6.0 + uTime * 2.4)), 6.0) * ring;
          vec3 c = mix(uCol, hue(fract(a / 6.2832 + uTime * 0.15)), uRainbow);
          gl_FragColor = vec4(c * (ring * (0.8 + 0.2 * sin(uTime * 3.0)) + inner + spark * 1.2), 1.0);
        }`,
    });
    const m = new THREE_NS.Mesh(new THREE_NS.PlaneGeometry(1.5, 1.5), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.025;
    m.renderOrder = 2;
    return m;
  }
  function disposeMesh(m: THREE.Mesh) {
    m.geometry.dispose();
    (m.material as THREE.Material).dispose();
  }

  let selfAura: THREE.Mesh | null = null;
  let selfAuraValue: string | null = null;
  function setAura(value: string | null) {
    if (value === selfAuraValue) return;
    selfAuraValue = value;
    if (selfAura) { group.remove(selfAura); disposeMesh(selfAura); selfAura = null; }
    if (value) { selfAura = makeAura(value); group.add(selfAura); }
  }
  function setSelfPos(x: number, z: number) {
    selfX = x; selfZ = z;
    if (selfAura) { selfAura.position.x = x; selfAura.position.z = z; }
  }

  // ── 其他人:一个发光的小人影(身子 + 头)+ 名牌 + 可选光环,位置平滑插值
  const peerBodyGeo = G.cyl(0.16, 0.22, 1.0, 14);
  const peerHeadGeo = G.sphere(0.17, 16);
  interface PeerObj { g: THREE.Group; target: THREE.Vector3; yaw: number; aura?: string; auraMesh?: THREE.Mesh; label: THREE.Sprite; mat: THREE.MeshStandardMaterial; fade: number; alive: boolean; bob: number }
  const peers = new Map<string, PeerObj>();
  function peerColor(id: string) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return new THREE_NS.Color().setHSL((h % 360) / 360, 0.8, 0.5);
  }
  function setPeers(list: WorldPeer[]) {
    const seen = new Set<string>();
    for (const p of list) {
      seen.add(p.id);
      let o = peers.get(p.id);
      if (!o) {
        const g = new THREE_NS.Group();
        const col = peerColor(p.id);
        const mat = new THREE_NS.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3, transparent: true, opacity: 0, roughness: 0.35, metalness: 0.2 });
        const body = new THREE_NS.Mesh(peerBodyGeo, mat);
        body.position.y = 0.5;
        const head = new THREE_NS.Mesh(peerHeadGeo, mat);
        head.position.y = 1.2;
        body.castShadow = head.castShadow = true;
        const label = makeTextSprite(THREE_NS, p.nickname.slice(0, 12), { color: '#fff', bg: 'rgba(8,10,20,0.6)', size: 30 });
        label.scale.multiplyScalar(0.7);
        label.position.y = 1.62;
        g.add(body, head, label);
        g.position.set(p.x, 0, p.z);
        group.add(g);
        o = { g, target: new THREE_NS.Vector3(p.x, 0, p.z), yaw: p.yaw, label, mat, fade: 0, alive: true, bob: Math.random() * 6 };
        peers.set(p.id, o);
      }
      o.alive = true;
      o.target.set(p.x, 0, p.z);
      o.yaw = p.yaw;
      if ((p.aura || undefined) !== o.aura) {
        if (o.auraMesh) { o.g.remove(o.auraMesh); disposeMesh(o.auraMesh); o.auraMesh = undefined; }
        o.aura = p.aura || undefined;
        if (o.aura) { o.auraMesh = makeAura(o.aura); o.auraMesh.position.set(0, 0.025, 0); o.g.add(o.auraMesh); }
      }
    }
    for (const [id, o] of peers) if (!seen.has(id)) o.alive = false;
  }
  function tickPeers(t: number, dt: number) {
    if (selfAura) (selfAura.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    for (const [id, o] of peers) {
      o.fade = Math.max(0, Math.min(1, o.fade + (o.alive ? dt * 2 : -dt * 2)));
      o.mat.opacity = 0.85 * o.fade;
      (o.label.material as THREE.SpriteMaterial).opacity = o.fade;
      const k = Math.min(1, dt * 4);
      o.g.position.lerp(o.target, k);
      let d = o.yaw - o.g.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      o.g.rotation.y += d * k;
      o.g.children[1].position.y = 1.2 + Math.sin(t * 2 + o.bob) * 0.03;
      if (o.auraMesh) (o.auraMesh.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      if (!o.alive && o.fade <= 0) {
        group.remove(o.g);
        o.mat.dispose();
        (o.label.material as THREE.SpriteMaterial).map?.dispose();
        o.label.material.dispose();
        if (o.auraMesh) disposeMesh(o.auraMesh);
        peers.delete(id);
      }
    }
  }
  function peerPositions() {
    const out: { id: string; x: number; z: number; aura?: string }[] = [];
    for (const [id, o] of peers) if (o.alive) out.push({ id, x: o.target.x, z: o.target.z, aura: o.aura });
    return out;
  }

  // ── 人物:长衫(圆锥)+ 头 + 发髻 / 幞头,名牌写「头衔 · 名字」
  interface NpcObj { g: THREE.Group; rig: NpcRig; label: THREE.Sprite; bubble: THREE.Sprite | null; bubbleT: number; c: WorldCharacter }
  const npcs = new Map<string, NpcObj>();
  let selfX = 0, selfZ = 0;
  function npcLabelText(c: WorldCharacter) {
    return [c.title, c.name || '…'].filter(Boolean).join(' · ');
  }
  function removeNpc(id: string) {
    const o = npcs.get(id);
    if (!o) return;
    group.remove(o.g);
    (o.label.material as THREE.SpriteMaterial).map?.dispose();
    o.label.material.dispose();
    if (o.bubble) { (o.bubble.material as THREE.SpriteMaterial).map?.dispose(); o.bubble.material.dispose(); }
    o.rig.dispose();
    // 点击拾取列表里也去掉
    for (let i = pickables.length - 1; i >= 0; i--) if (pickables[i].userData.characterId === id) pickables.splice(i, 1);
    npcs.delete(id);
  }
  function setCharacters(list: WorldCharacter[]) {
    const keep = new Set(list.map((c) => c.id));
    for (const id of Array.from(npcs.keys())) if (!keep.has(id)) removeNpc(id);
    for (const c of list) {
      const old = npcs.get(c.id);
      if (old && npcLabelText(old.c) === npcLabelText(c) && old.c.x === c.x && old.c.z === c.z) { old.c = c; continue; }
      if (old) removeNpc(c.id);
      const g = new THREE_NS.Group();
      g.position.set(c.x, 0, c.z);
      const col = c.color ?? (c.kind === 'poet' ? 0xb9a6ff : 0x25f4ee);
      // 长衫颜色:取人物色,压暗一点、降点饱和,像染过的布
      const robe = new THREE_NS.Color(col).lerp(new THREE_NS.Color(0x55555f), 0.15);
      let seed = 0;
      for (let i = 0; i < c.id.length; i++) seed = (seed * 31 + c.id.charCodeAt(i)) % 9973;
      // 写实画风:Blender 流水线生成的真人 + 汉服(avatars/*.vrm);风格化:程序拼的小人
      const faceYaw = Math.atan2(-c.x, -c.z);
      const rig = kit
        ? createRealNpc(THREE_NS, kit, { model: realNpcModel(c.kind === 'poet' ? 'poet' : 'guide', seed), seed, faceYaw })
        : createNpcRig(THREE_NS, { style: c.kind === 'poet' ? 'poet' : 'guide', robe: robe.getHex(), seed, faceYaw });
      for (const m of rig.pickables) m.userData.characterId = c.id;
      g.add(rig.root);
      const label = makeTextSprite(THREE_NS, npcLabelText(c), { color: '#fff', bg: 'rgba(20,14,30,0.72)', border: hex(col), size: 30 });
      label.scale.multiplyScalar(0.75);
      (label.userData.baseScale as THREE.Vector3).multiplyScalar(0.75);
      label.position.y = 2.12;
      g.add(label);
      group.add(g);
      pickables.push(...rig.pickables);
      npcs.set(c.id, { g, rig, label, bubble: null, bubbleT: 0, c });
    }
  }
  function characterSay(id: string, text: string) {
    const o = npcs.get(id);
    if (!o) return;
    if (o.bubble) { o.g.remove(o.bubble); (o.bubble.material as THREE.SpriteMaterial).map?.dispose(); o.bubble.material.dispose(); }
    const b = makeTextSprite(THREE_NS, text.length > 22 ? text.slice(0, 22) + '…' : text, { color: '#2a1d10', bg: 'rgba(255,248,232,0.94)', size: 34 });
    b.scale.multiplyScalar(0.7);
    b.position.y = 2.55;
    (b.material as THREE.SpriteMaterial).depthTest = false;
    b.renderOrder = 9;
    o.g.add(b);
    o.bubble = b;
    o.bubbleT = 0;
    // 说话时抬手吟诵;句子越长念得越久
    o.rig.speak(Math.min(6, 2.2 + text.length * 0.12));
  }
  function tickNpcs(t: number, dt: number) {
    for (const [, o] of npcs) {
      o.rig.tick(t, dt, { x: selfX - o.c.x, z: selfZ - o.c.z });
      if (o.bubble) {
        o.bubbleT += dt;
        const mat = o.bubble.material as THREE.SpriteMaterial;
        mat.opacity = o.bubbleT < 5 ? 1 : Math.max(0, 1 - (o.bubbleT - 5) / 0.8);
        if (o.bubbleT > 5.8) { o.g.remove(o.bubble); mat.map?.dispose(); mat.dispose(); o.bubble = null; }
      }
    }
  }
  const characterPositions = () => Array.from(npcs.values()).map((o) => ({ id: o.c.id, x: o.c.x, z: o.c.z }));

  function showMarker(x: number, z: number) {
    marker.position.x = x;
    marker.position.z = z;
    marker.visible = true;
    markerT = 0;
  }

  function dispose() {
    kit?.dispose();
    objects.dispose();
    roomShell?.dispose();
    for (const id of Array.from(npcs.keys())) removeNpc(id);
    setAura(null);
    setPeers([]);
    for (const [, o] of peers) {
      o.mat.dispose();
      (o.label.material as THREE.SpriteMaterial).map?.dispose();
      o.label.material.dispose();
      if (o.auraMesh) disposeMesh(o.auraMesh);
    }
    peers.clear();
    for (const f of floats) { (f.s.material as THREE.SpriteMaterial).map?.dispose(); f.s.material.dispose(); }
    floats.length = 0;
    burstMats.forEach((m) => m.dispose());
    disposables.forEach((d) => d.dispose());
    group.clear();
  }

  return {
    group, ground: roomShell?.floor ?? ground, pickables, room: roomShell,
    setTheme, setOrbs, collectOrb, showMarker, setActiveZone,
    setDanceFloorHot: (on) => { danceHot = on; },
    floatText, dispose,
    tick: (t, dt, camera) => { tick(t, dt, camera); tickPeers(t, dt); tickNpcs(t, dt); objects.tick(t, dt, camera); roomShell?.tick(t, camera); },
    objects,
    setPeers, setAura, setSelfPos, peerPositions, setCharacters, characterSay, characterPositions, setLampBoost,
  };
}
