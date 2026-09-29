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
import { WORLD_RADIUS, WORLD_ZONES, type Orb, type WorldZone, type ZoneId } from './worldLayout';

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

export interface WorldHandle {
  group: THREE.Group;
  /** 点击拾取用:地面 */
  ground: THREE.Mesh;
  /** 点击拾取用:每个地标的实体,userData.zoneId 标着是哪个 */
  pickables: THREE.Object3D[];
  setTheme: (preset: string) => void;
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

export function buildWorld(THREE_NS: typeof THREE, initialPreset: string): WorldHandle {
  const group = new THREE_NS.Group();
  group.name = 'dh-world';
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };
  let theme = worldTheme(initialPreset);

  // ── 托底光:舞台聚光照不到外圈,给一点点环境光让远处的地标有体积感
  const hemi = new THREE_NS.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemi);
  group.add(hemi);

  // ── 地面:实心大圆(接收阴影)+ 一层叠加着色器画小路、网格和地标光圈
  const groundMat = track(new THREE_NS.MeshStandardMaterial({ color: theme.ground, roughness: 0.92, metalness: 0.05 }));
  const ground = new THREE_NS.Mesh(track(new THREE_NS.CircleGeometry(WORLD_RADIUS + 10, 96)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  ground.receiveShadow = true;
  ground.name = 'dh-world-ground';
  group.add(ground);

  const zoneUniform = WORLD_ZONES.map((z) => new THREE_NS.Vector3(z.x, z.z, z.radius));
  const overlayMat = track(new THREE_NS.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE_NS.AdditiveBlending, fog: false,
    uniforms: {
      uTime: { value: 0 },
      uPath: { value: new THREE_NS.Color(theme.path) },
      uAccent: { value: new THREE_NS.Color(theme.accent) },
      uZones: { value: zoneUniform },
      uActive: { value: -1 },
      uR: { value: WORLD_RADIUS },
      uStrength: { value: 1 },
    },
    vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      varying vec2 vW; uniform float uTime; uniform vec3 uPath; uniform vec3 uAccent;
      uniform vec3 uZones[${WORLD_ZONES.length}]; uniform float uActive; uniform float uR; uniform float uStrength;
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
        for (int i = 0; i < ${WORLD_ZONES.length}; i++) {
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
  group.add(overlay);

  // ── 共用材质
  const darkMetal = track(new THREE_NS.MeshStandardMaterial({ color: 0x1b1f2e, roughness: 0.4, metalness: 0.75 }));
  const stone = track(new THREE_NS.MeshStandardMaterial({ color: 0x3a3f55, roughness: 0.85, metalness: 0.05 }));
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
    switch (zone.id) {
      case 'dance': {
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
    }
    // 名牌
    const label = makeTextSprite(THREE_NS, `${zone.emoji} ${zone.label}`, { color: '#fff', bg: 'rgba(8,10,20,0.72)', border: hex(zone.color), size: 40 });
    track(label.material); track(label.material.map!);
    const labelY = zone.id === 'dance' ? 3.9 : zone.id === 'wish' ? 2.7 : zone.id === 'stars' ? 2.7 : 3.1;
    label.position.set(zone.x, labelY, zone.z);
    group.add(label);
    zoneLabels.set(zone.id, label);
    bobbers.push({ o: label, base: labelY, amp: 0.06, speed: 1.1, phase: zone.x });

    g.traverse((o) => { o.userData.zoneId = zone.id; });
    return g;
  }

  for (const zone of WORLD_ZONES) group.add(landmark(zone));
  // 舞池整块地板也能点
  pickables.push(...danceTiles);

  // ── 外圈路灯 + 灌木
  const lampHead = glowMat(0xfff2c8);
  const lampGeo = G.cyl(0.04, 0.05, 2.6, 8);
  const headGeo = G.sphere(0.13, 12);
  const bushMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x1f4a33, roughness: 0.9 }));
  const bushGeo = G.sphere(0.5, 10);
  const lamps = 20;
  for (let i = 0; i < lamps; i++) {
    const a = (i / lamps) * Math.PI * 2 + 0.08;
    const r = WORLD_RADIUS + 0.4;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    const post = mesh(lampGeo, darkMetal, x, 1.3, z);
    const head = new THREE_NS.Mesh(headGeo, lampHead);
    head.position.set(x, 2.65, z);
    group.add(post, head);
    const b = mesh(bushGeo, bushMat, Math.sin(a + 0.16) * (r + 0.3), 0.3, Math.cos(a + 0.16) * (r + 0.3));
    b.scale.set(1.2, 0.7, 1);
    group.add(b);
  }

  // ── 星光
  const orbGroup = new THREE_NS.Group();
  group.add(orbGroup);
  const orbCore = G.sphere(0.13, 14);
  const orbCoreMat = glowMat(0xfff6c8);
  const orbGoldMat = glowMat(0xffc93d);
  const haloTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const cx = cv.getContext('2d')!;
    const grd = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,240,200,0.55)'); grd.addColorStop(1, 'rgba(255,220,150,0)');
    cx.fillStyle = grd; cx.fillRect(0, 0, 64, 64);
    const t = new THREE_NS.CanvasTexture(cv); return track(t);
  })();
  const haloMat = track(new THREE_NS.SpriteMaterial({ map: haloTex, color: 0xfff0c0, transparent: true, depthWrite: false, blending: THREE_NS.AdditiveBlending, fog: false }));
  const haloGoldMat = track(new THREE_NS.SpriteMaterial({ map: haloTex, color: 0xffb020, transparent: true, depthWrite: false, blending: THREE_NS.AdditiveBlending, fog: false }));
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
        if (orb.golden) core.scale.setScalar(1.35);
        const halo = new THREE_NS.Sprite(orb.golden ? haloGoldMat : haloMat);
        halo.scale.setScalar(orb.golden ? 1.0 : 0.7);
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
    overlayMat.uniforms.uActive.value = id ? WORLD_ZONES.findIndex((z) => z.id === id) : -1;
  }

  function setTheme(preset: string) {
    theme = worldTheme(preset);
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
        m.emissive.setHex(WORLD_ZONES[0].color);
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

  function showMarker(x: number, z: number) {
    marker.position.x = x;
    marker.position.z = z;
    marker.visible = true;
    markerT = 0;
  }

  function dispose() {
    for (const f of floats) { (f.s.material as THREE.SpriteMaterial).map?.dispose(); f.s.material.dispose(); }
    floats.length = 0;
    burstMats.forEach((m) => m.dispose());
    disposables.forEach((d) => d.dispose());
    group.clear();
  }

  return {
    group, ground, pickables,
    setTheme, setOrbs, collectOrb, showMarker, setActiveZone,
    setDanceFloorHot: (on) => { danceHot = on; },
    floatText, tick, dispose,
  };
}
