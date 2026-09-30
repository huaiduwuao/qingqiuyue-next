/**
 * vrm/world/env/environment.ts — 广场外面的世界:天空、群山、湖、船、天气、草、光和雾
 *
 * 广场是湖心的一座石台;四周是湖,湖外是一圈山谷(近处缓坡松林,远处高山带雪)。
 * 天空是自己写的着色器(渐变 + 日晕 + 流云 + 星空 + 月亮),和雾、水面倒影用同一套配色(timeOfDay.ts),
 * 所以地平线、雾、倒影是一个色调;昼夜变化就是改太阳位置和这套颜色。
 *
 * 画质两档:high = 后期(泛光 / 调色)+ 草 + 2048 阴影 + 满量粒子;low = 都减掉(手机)。
 */

import type * as THREE from 'three';
import { NOISE_GLSL, SKY_COLOR_GLSL } from './shaders';
import { keyLightDir, modeHour, skyAt, type SkyState, type TimeMode, type Weather } from './timeOfDay';
import { createPost, type PostPipeline } from './post';
import { WORLD_RADIUS, type WorldZone } from '../worldLayout';
import { createRealistic, type RealisticLayer, type TreeSpot } from './realistic';
import { createRealKit } from '../realKit';

export type Quality = 'high' | 'low';

export interface EnvOptions {
  quality: Quality;
  timeMode: TimeMode;
  weather: Weather;
  /** 草地(感悟庭院有,星光广场是石板地没有) */
  grass: boolean;
  /** 地标:草不长在地标里和小路上 */
  zones: WorldZone[];
  /** 画风:stylized = 自绘天空 + 程序化松林;realistic = HDRI 天空 / 环境光 + 真实松树 + 地面贴图(见 realistic.ts) */
  style?: 'stylized' | 'realistic';
  /** 写实素材根路径(默认 /qq-media/world) */
  assetBase?: string;
}

export interface Environment {
  group: THREE.Group;
  tick: (t: number, dt: number, camera: THREE.PerspectiveCamera, focus: { x: number; z: number }) => void;
  /** 有后期时用它代替 renderer.render */
  render: ((renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, t: number) => void) | null;
  setTimeMode: (m: TimeMode) => void;
  setWeather: (w: Weather) => void;
  /** 当前天光(给地标灯、路灯调亮度) */
  sky: () => SkyState;
  dispose: () => void;
}

/** 湖岸开始的半径(比广场石台大一圈) */
const SHORE = WORLD_RADIUS + 6;
const WATER_Y = -0.28;

// ── JS 版噪声(地形生成用,和着色器里的不必一致) ──────────────────────
function hash2(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, oct = 5) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
const sstep = (a: number, b: number, x: number) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };

/** 山谷地形高度:岸边入水、近处缓坡、远处高山(舞台后方 -z 方向更高,像一面山屏) */
export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const shore = sstep(SHORE - 2, SHORE + 8, r);
  const hills = 1.5 + fbm(x * 0.045 + 7, z * 0.045 - 3, 4) * 9;
  const back = z < 0 ? 1 + (-z / r) * 0.6 : 1;
  const ridge = Math.pow(fbm(x * 0.012 - 11, z * 0.012 + 5, 5), 1.6) * 95 * back;
  const far = sstep(40, 115, r);
  return -1.6 + shore * (hills + 1.6) + far * ridge;
}

export function createEnvironment(THREE_NS: typeof THREE, renderer: THREE.WebGLRenderer, scene: THREE.Scene, opts: EnvOptions): Environment {
  const group = new THREE_NS.Group();
  group.name = 'dh-env';
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };
  const high = opts.quality === 'high';
  const realistic = opts.style === 'realistic';
  let real: RealisticLayer | null = null;
  let terrainMat: THREE.MeshStandardMaterial | null = null;
  const treeSpots: TreeSpot[] = [];
  let timeMode = opts.timeMode;
  let hour = modeHour(timeMode);
  let hourTarget = hour;
  // 换时辰:不管隔了几个钟头,都在约 3 秒里转过去(沿时间往前走,会经过中间的天色)
  let hourSpeed = 4;
  const retarget = (h: number) => {
    hourTarget = h;
    let d = hourTarget - hour;
    if (d < 0) d += 24;
    hourSpeed = Math.max(0.5, d / 3);
  };
  let sky = skyAt(hour);

  const col = (c: [number, number, number]) => new THREE_NS.Color(c[0], c[1], c[2]);
  const skyUniforms = {
    uZenith: { value: col(sky.zenith) }, uHorizon: { value: col(sky.horizon) }, uGround: { value: col(sky.ground) },
    uSunColor: { value: col(sky.sunColor) }, uSunDir: { value: new THREE_NS.Vector3(...sky.sunDir) }, uNight: { value: sky.night },
    uTime: { value: 0 },
  };

  // ── 天空 ──────────────────────────────────────────────────────────
  const skyMat = track(new THREE_NS.ShaderMaterial({
    side: THREE_NS.BackSide, depthWrite: false, fog: false,
    uniforms: {
      ...skyUniforms,
      uCloud: { value: 0.45 },
      uMoonDir: { value: new THREE_NS.Vector3(0, 1, 0) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // 永远画在远平面上
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform float uTime; uniform float uCloud; uniform vec3 uMoonDir;
      ${NOISE_GLSL}
      ${SKY_COLOR_GLSL}
      float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
      void main(){
        vec3 dir = normalize(vDir);
        vec3 c = skyColor(dir);
        float up = smoothstep(-0.05, 0.03, uSunDir.y);
        // 日轮(HDR,交给泛光)
        c += uSunColor * smoothstep(0.99935, 0.9997, dot(dir, uSunDir)) * 22.0 * up;
        // 星星:方向上划格子,少数格子里有一颗,慢慢眨
        if (uNight > 0.01 && dir.y > 0.0) {
          vec3 p = dir * 220.0;
          vec3 cell = floor(p);
          float r = hash13(cell);
          vec3 f = fract(p) - 0.5;
          float star = step(0.985, r) * smoothstep(0.12, 0.0, length(f)) * (0.6 + 0.4 * sin(uTime * (1.0 + r * 3.0) + r * 40.0));
          c += vec3(0.85, 0.9, 1.0) * star * 2.4 * uNight * smoothstep(0.0, 0.25, dir.y);
          // 银河:一条淡淡的带
          float band = exp(-pow(dot(dir, normalize(vec3(0.3, 0.5, 0.8))) * 5.0, 2.0));
          c += vec3(0.18, 0.2, 0.3) * band * fbm(dir.xz * 12.0) * uNight * 0.5;
        }
        // 月亮
        float md = dot(dir, uMoonDir);
        c += vec3(1.0, 0.96, 0.88) * (smoothstep(0.9990, 0.99935, md) * 5.0 + pow(max(md, 0.0), 300.0) * 0.5) * uNight;
        // 流云:把方向投到一张天幕上取 fbm
        if (dir.y > 0.0) {
          vec2 uv = dir.xz / (dir.y + 0.18) * 0.8 + vec2(uTime * 0.004, uTime * 0.0015);
          float n = fbm(uv * 1.4);
          float cl = smoothstep(1.0 - uCloud, 1.3 - uCloud, n) * smoothstep(0.0, 0.18, dir.y);
          float lit = clamp(fbm(uv * 1.4 + uSunDir.xz * 0.12) * 1.4 - 0.2, 0.0, 1.0);
          vec3 cloudLit = mix(uHorizon * 1.15, vec3(1.0), 0.55 * (1.0 - uNight)) + uSunColor * pow(max(dot(dir, uSunDir), 0.0), 5.0) * 0.8 * up;
          vec3 cloudDark = mix(uZenith, uHorizon, 0.5) * 0.7;
          c = mix(c, mix(cloudDark, cloudLit, lit), cl * (0.85 - uNight * 0.35));
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const skyMesh = new THREE_NS.Mesh(track(new THREE_NS.SphereGeometry(900, 48, 24)), skyMat);
  skyMesh.renderOrder = -100;
  skyMesh.frustumCulled = false;
  group.add(skyMesh);

  // ── 光:太阳 / 月亮平行光(带阴影,跟着角色走)+ 半球光 ────────────────
  const sun = new THREE_NS.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  group.add(sun, sun.target);
  const hemi = new THREE_NS.HemisphereLight(0xffffff, 0x333333, 0.5);
  group.add(hemi);

  // ── 地形:一圈山谷(极坐标网格,越远越稀) ─────────────────────────────
  {
    const rings = high ? 90 : 50, segs = high ? 220 : 120;
    const pos: number[] = [], colors: number[] = [], uvs: number[] = [], idx: number[] = [];
    const cSand = new THREE_NS.Color(0x6b6250), cGrass = new THREE_NS.Color(0x3d5a34), cForest = new THREE_NS.Color(0x24392a);
    const cRock = new THREE_NS.Color(0x5d6068), cSnow = new THREE_NS.Color(0xe6ecf2);
    const tmp = new THREE_NS.Color();
    const r0 = SHORE - 3, r1 = 420;
    for (let i = 0; i <= rings; i++) {
      const k = i / rings;
      const r = r0 + (r1 - r0) * Math.pow(k, 1.9);
      for (let j = 0; j < segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        const x = Math.sin(a) * r, z = Math.cos(a) * r;
        const y = terrainHeight(x, z);
        pos.push(x, y, z);
        uvs.push(x / 5, z / 5); // 写实画风的地面贴图按世界坐标平铺,5 米一块
        // 坡度近似:和外侧一点的高度差
        const slope = Math.abs(terrainHeight(x * 1.02, z * 1.02) - y) / (r * 0.02 + 0.01);
        if (y < WATER_Y + 0.25) tmp.copy(cSand);
        else if (y > 58) tmp.copy(cRock).lerp(cSnow, sstep(58, 72, y));
        else if (slope > 0.9 || y > 34) tmp.copy(cRock).lerp(cForest, 0.25);
        else tmp.copy(cGrass).lerp(cForest, sstep(3, 16, y) * 0.8 + fbm(x * 0.2, z * 0.2, 2) * 0.2);
        tmp.multiplyScalar(0.85 + fbm(x * 0.35, z * 0.35, 2) * 0.3);
        colors.push(tmp.r, tmp.g, tmp.b);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segs; j++) {
        const a = i * segs + j, b = i * segs + ((j + 1) % segs), c = (i + 1) * segs + j, d = (i + 1) * segs + ((j + 1) % segs);
        idx.push(a, c, b, b, c, d);
      }
    }
    const g = track(new THREE_NS.BufferGeometry());
    g.setAttribute('position', new THREE_NS.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE_NS.Float32BufferAttribute(colors, 3));
    g.setAttribute('uv', new THREE_NS.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = track(new THREE_NS.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    terrainMat = m;
    const terrain = new THREE_NS.Mesh(g, m);
    terrain.receiveShadow = true;
    group.add(terrain);
  }

  // ── 松林:近处山坡上的一片片松树(实例化) ────────────────────────────
  {
    // 写实松树一棵上万面,种少一点(远处靠低模档撑密度)
    const n = realistic ? (high ? 320 : 140) : high ? 900 : 350;
    const trunk = track(new THREE_NS.CylinderGeometry(0.12, 0.18, 1.6, 6));
    trunk.translate(0, 0.8, 0);
    const crown = track(new THREE_NS.ConeGeometry(1.1, 3.6, 7));
    crown.translate(0, 3.1, 0);
    const tm = track(new THREE_NS.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 1 }));
    const cm = track(new THREE_NS.MeshStandardMaterial({ color: 0x2b4a2e, roughness: 0.9 }));
    const trunks = new THREE_NS.InstancedMesh(trunk, tm, n);
    const crowns = new THREE_NS.InstancedMesh(crown, cm, n);
    const mtx = new THREE_NS.Matrix4(), q = new THREE_NS.Quaternion(), s = new THREE_NS.Vector3(), p = new THREE_NS.Vector3();
    const tint = new THREE_NS.Color();
    let placed = 0;
    for (let tries = 0; placed < n && tries < n * 6; tries++) {
      const a = hash2(tries, 7) * Math.PI * 2;
      const r = SHORE + 7 + Math.pow(hash2(tries, 13), 1.2) * 75;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      const y = terrainHeight(x, z);
      if (y < 0.4 || y > 32) continue;
      // 成片:只在「林子」噪声高的地方种
      if (fbm(x * 0.06, z * 0.06, 3) < 0.42 + Math.max(0, 1 - (r - SHORE - 7) / 20) * 0.15) continue;
      const k = 0.7 + hash2(tries, 3) * 0.9;
      p.set(x, y - 0.1, z);
      q.setFromAxisAngle(new THREE_NS.Vector3(0, 1, 0), hash2(tries, 5) * 6.28);
      s.set(k, k * (0.85 + hash2(tries, 9) * 0.5), k);
      mtx.compose(p, q, s);
      if (realistic) {
        // Poly Haven 的松树是真实尺寸(十几米),这里的 k 是给 4.7 米的卡通松树用的,缩一下
        treeSpots.push({ x, y: y - 0.1, z, scale: 0.55 + (k - 0.7) * 0.35, rot: hash2(tries, 5) * 6.28 });
        placed++;
        continue;
      }
      trunks.setMatrixAt(placed, mtx);
      crowns.setMatrixAt(placed, mtx);
      crowns.setColorAt(placed, tint.setHSL(0.3 + hash2(tries, 11) * 0.06, 0.35, 0.16 + hash2(tries, 17) * 0.08));
      placed++;
    }
    trunks.count = crowns.count = placed;
    crowns.castShadow = true;
    if (!realistic) group.add(trunks, crowns);
  }

  // ── 写实画风:天空球换 HDRI、地面贴图、真实松树 ─────────────────────
  if (realistic) {
    real = createRealistic(THREE_NS, renderer, scene, group, { quality: opts.quality, base: opts.assetBase, trees: treeSpots });
    skyMesh.material = real.skyMaterial;
    if (terrainMat) real.applyGround(terrainMat);
    real.setHour(hour);
  }

  // ── 湖面 ───────────────────────────────────────────────────────────
  const fogUniforms = { uFogColor: { value: col(sky.fog) }, uFogDensity: { value: sky.fogDensity } };
  const waterMat = track(new THREE_NS.ShaderMaterial({
    uniforms: { ...skyUniforms, ...fogUniforms, uLamp: { value: 1 }, uShore: { value: SHORE }, uPlaza: { value: WORLD_RADIUS + 1.3 } },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld;
      uniform float uTime; uniform vec3 uFogColor; uniform float uFogDensity; uniform float uLamp; uniform float uShore; uniform float uPlaza;
      ${NOISE_GLSL}
      ${SKY_COLOR_GLSL}
      // 几组方向不同的波叠起来,解析求导得法线;再叠两层滚动噪声做细碎波纹
      vec2 waveGrad(vec2 p, float t){
        vec2 g = vec2(0.0);
        vec2 dirs[4]; dirs[0] = normalize(vec2(1.0, 0.3)); dirs[1] = normalize(vec2(-0.6, 1.0)); dirs[2] = normalize(vec2(0.2, -1.0)); dirs[3] = normalize(vec2(-1.0, -0.4));
        float amp[4]; amp[0] = 0.035; amp[1] = 0.025; amp[2] = 0.018; amp[3] = 0.012;
        float fr[4]; fr[0] = 0.55; fr[1] = 0.9; fr[2] = 1.6; fr[3] = 2.7;
        for (int i = 0; i < 4; i++){
          float ph = dot(dirs[i], p) * fr[i] + t * (1.2 + fr[i] * 0.6);
          g += dirs[i] * cos(ph) * amp[i] * fr[i];
        }
        float e = 0.05;
        vec2 q = p * 1.7 + vec2(t * 0.25, -t * 0.18);
        float n0 = fbm(q), nx = fbm(q + vec2(e, 0.0)), nz = fbm(q + vec2(0.0, e));
        g += vec2(nx - n0, nz - n0) / e * 0.035;
        return g;
      }
      void main(){
        vec2 g = waveGrad(vWorld.xz, uTime);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 toCam = cameraPosition - vWorld;
        float dist = length(toCam);
        vec3 v = toCam / dist;
        float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 r = reflect(-v, n);
        r.y = abs(r.y);
        vec3 refl = skyColor(r);
        // 日光 / 月光在波尖上的碎光
        float up = smoothstep(-0.05, 0.05, uSunDir.y);
        vec3 moonDir = normalize(vec3(-uSunDir.x, max(0.45, -uSunDir.y), -uSunDir.z));
        vec3 L = mix(moonDir, uSunDir, up);
        float spec = pow(max(dot(r, L), 0.0), 380.0) * mix(3.0, 26.0, up);
        vec3 specC = mix(vec3(0.75, 0.82, 1.0), uSunColor, up) * spec;
        // 水体本色:近岸浅、远处深
        float rr = length(vWorld.xz);
        float shallow = smoothstep(uShore + 2.0, uShore - 4.0, rr) + smoothstep(uPlaza + 3.0, uPlaza, rr);
        vec3 deep = mix(vec3(0.004, 0.02, 0.035), uZenith * 0.25, 0.5);
        vec3 body = mix(deep, vec3(0.02, 0.07, 0.07), clamp(shallow, 0.0, 1.0));
        vec3 c = mix(body, refl, fres) + specC;
        // 石台和岸边一圈泡沫
        float foam = (smoothstep(uPlaza + 0.9, uPlaza, rr) + smoothstep(uShore - 1.5, uShore + 1.2, rr) * 0.6)
                   * smoothstep(0.45, 0.75, fbm(vWorld.xz * 2.2 + uTime * 0.3));
        c += foam * mix(vec3(0.35), uHorizon, 0.5) * 0.6;
        // 夜里石台一圈路灯的倒影(暖色,沿着台边一带)
        float lampBand = smoothstep(uPlaza + 3.5, uPlaza + 0.2, rr) * smoothstep(uPlaza - 0.2, uPlaza + 0.4, rr);
        c += vec3(1.0, 0.72, 0.4) * lampBand * (0.5 + 0.5 * fbm(vWorld.xz * 4.0 + uTime)) * 0.12 * uLamp * uNight;
        float fogK = 1.0 - exp(-pow(uFogDensity * dist, 2.0));
        c = mix(c, uFogColor, fogK);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const water = new THREE_NS.Mesh(track(new THREE_NS.CircleGeometry(460, 96)), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  group.add(water);

  // ── 船:几条挂灯笼的小船在湖上慢慢绕 ─────────────────────────────────
  interface Boat { g: THREE.Group; r: number; a: number; speed: number; lamp: THREE.Mesh }
  const boats: Boat[] = [];
  {
    const hullMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x4a3322, roughness: 0.75 }));
    const roofMat = track(new THREE_NS.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.9, side: THREE_NS.DoubleSide }));
    const lampMat = track(new THREE_NS.MeshBasicMaterial({ color: new THREE_NS.Color(3.2, 1.6, 0.6) }));
    if (realistic) {
      // 写实:船身桧木板、乌篷深色木篷;船头灯笼照旧发暖光
      const rk = track(createRealKit(THREE_NS, { base: opts.assetBase, quality: opts.quality }));
      rk.texSet(hullMat, 'hinoki_planks', [2, 0.6], { tint: 0x7a5a42 });
      rk.texSet(roofMat, 'japanese_cedar_planks', [1.5, 1], { tint: 0x3a3028 });
    }
    // 船身:一个两头翘起的长条(把盒子的两端顶点抬高、收窄)
    const hullGeo = track(new THREE_NS.BoxGeometry(3.2, 0.45, 1.0, 12, 1, 2));
    {
      const p = hullGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const e = Math.abs(x) / 1.6;
        p.setY(i, y + Math.pow(e, 3) * 0.45 + (y < 0 ? 0.12 * e : 0));
        p.setZ(i, z * (1 - Math.pow(e, 2.5) * 0.85) * (y < 0 ? 0.8 : 1));
      }
      hullGeo.computeVertexNormals();
    }
    const roofGeo = track(new THREE_NS.CylinderGeometry(0.62, 0.62, 1.3, 16, 1, true, 0, Math.PI));
    roofGeo.rotateZ(Math.PI / 2);
    roofGeo.rotateY(Math.PI / 2);
    const lampGeo = track(new THREE_NS.SphereGeometry(0.12, 12, 8));
    const specs = [{ r: SHORE - 3.2, a: 0.4, s: 0.018 }, { r: SHORE - 2.2, a: 2.6, s: -0.012 }, { r: SHORE - 3.8, a: 4.4, s: 0.014 }];
    for (const sp of specs) {
      const g = new THREE_NS.Group();
      const hull = new THREE_NS.Mesh(hullGeo, hullMat);
      hull.castShadow = true;
      const roof = new THREE_NS.Mesh(roofGeo, roofMat);
      roof.position.set(-0.2, 0.3, 0);
      roof.rotation.y = Math.PI / 2;
      const lamp = new THREE_NS.Mesh(lampGeo, lampMat);
      lamp.position.set(1.55, 0.95, 0);
      const pole = new THREE_NS.Mesh(track(new THREE_NS.CylinderGeometry(0.015, 0.015, 0.7, 6)), hullMat);
      pole.position.set(1.45, 0.62, 0);
      g.add(hull, roof, pole, lamp);
      group.add(g);
      boats.push({ g, r: sp.r, a: sp.a, speed: sp.s, lamp });
    }
  }

  // ── 天气粒子:围着镜头的一个盒子里无限循环(着色器里取模,CPU 不逐个更新) ─────
  let weatherPoints: THREE.Points | null = null;
  function buildWeather(w: Weather) {
    if (weatherPoints) {
      group.remove(weatherPoints);
      weatherPoints.geometry.dispose();
      (weatherPoints.material as THREE.Material).dispose();
      weatherPoints = null;
    }
    if (w === 'none') return;
    const count = Math.round((w === 'rain' ? 2600 : w === 'fireflies' ? 260 : 1100) * (high ? 1 : 0.4));
    const g = new THREE_NS.BufferGeometry();
    const base = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      base[i * 3] = Math.random(); base[i * 3 + 1] = Math.random(); base[i * 3 + 2] = Math.random();
      seed[i] = Math.random();
    }
    g.setAttribute('position', new THREE_NS.BufferAttribute(base, 3));
    g.setAttribute('aSeed', new THREE_NS.BufferAttribute(seed, 1));
    const P: Record<Exclude<Weather, 'none'>, { box: [number, number, number]; fall: number; size: number; color: [number, number, number]; kind: number }> = {
      petals: { box: [36, 14, 36], fall: 0.55, size: 0.16, color: [1.0, 0.62, 0.72], kind: 0 },
      leaves: { box: [36, 14, 36], fall: 0.7, size: 0.2, color: [0.95, 0.5, 0.18], kind: 0 },
      rain: { box: [30, 16, 30], fall: 11, size: 0.5, color: [0.7, 0.78, 0.9], kind: 1 },
      snow: { box: [36, 14, 36], fall: 0.9, size: 0.09, color: [0.95, 0.97, 1.0], kind: 2 },
      fireflies: { box: [34, 3.2, 34], fall: 0, size: 0.1, color: [2.6, 3.0, 1.0], kind: 3 },
    };
    const p = P[w];
    const m = new THREE_NS.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      blending: p.kind === 3 ? THREE_NS.AdditiveBlending : THREE_NS.NormalBlending,
      uniforms: {
        uTime: { value: 0 }, uBox: { value: new THREE_NS.Vector3(...p.box) }, uFall: { value: p.fall },
        uSize: { value: p.size }, uColor: { value: new THREE_NS.Color(...p.color) }, uKind: { value: p.kind },
        uCenter: { value: new THREE_NS.Vector3() }, uScale: { value: 600 }, uLight: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime; uniform vec3 uBox; uniform float uFall; uniform float uSize; uniform vec3 uCenter; uniform float uScale; uniform float uKind;
        varying float vSeed; varying float vAngle; varying float vBlink;
        void main(){
          vSeed = aSeed;
          vec3 p = position * uBox;
          if (uKind > 2.5) {
            // 萤火:在广场附近低空游荡(不跟镜头走)
            float t = uTime * (0.25 + aSeed * 0.3);
            p = vec3((position.x - 0.5) * uBox.x, 0.25 + position.y * uBox.y, (position.z - 0.5) * uBox.z);
            p += vec3(sin(t + aSeed * 40.0) * 1.4, sin(t * 1.7 + aSeed * 13.0) * 0.4, cos(t * 0.8 + aSeed * 23.0) * 1.4);
            vBlink = pow(0.5 + 0.5 * sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 60.0), 3.0);
          } else {
            p.y -= uTime * uFall * (0.7 + aSeed * 0.6);
            // 飘:花瓣、雪左右晃
            p.x += sin(uTime * 0.7 + aSeed * 30.0) * (uKind > 0.5 && uKind < 1.5 ? 0.0 : 0.9) + uTime * 0.35;
            p.z += cos(uTime * 0.5 + aSeed * 17.0) * (uKind > 0.5 && uKind < 1.5 ? 0.0 : 0.7);
            // 围着镜头取模:盒子跟着镜头走,粒子无限循环
            vec3 rel = mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
            p = uCenter + rel;
            vBlink = 1.0;
          }
          vAngle = uTime * (1.0 + aSeed * 2.0) + aSeed * 6.28;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = uSize * uScale / max(0.5, -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uKind; uniform float uLight;
        varying float vSeed; varying float vAngle; varying float vBlink;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float a;
          if (uKind < 0.5) {
            // 花瓣 / 叶子:旋转的椭圆,翻动时变窄
            float s = sin(vAngle), co = cos(vAngle);
            vec2 q = vec2(c.x * co - c.y * s, c.x * s + c.y * co);
            float flip = 0.35 + 0.65 * abs(sin(vAngle * 0.7));
            a = smoothstep(0.5, 0.35, length(q / vec2(0.5 * flip, 0.28)));
          } else if (uKind < 1.5) {
            // 雨:细长竖线
            a = smoothstep(0.06, 0.0, abs(c.x)) * smoothstep(0.5, 0.2, abs(c.y)) * 0.45;
          } else if (uKind < 2.5) {
            a = smoothstep(0.5, 0.1, length(c));
          } else {
            a = smoothstep(0.5, 0.0, length(c)) * vBlink;
          }
          if (a < 0.01) discard;
          vec3 col = uColor * (uKind > 2.5 ? 1.0 : uLight) * (0.85 + vSeed * 0.3);
          gl_FragColor = vec4(col, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    weatherPoints = new THREE_NS.Points(g, m);
    weatherPoints.frustumCulled = false;
    weatherPoints.renderOrder = 5;
    group.add(weatherPoints);
  }
  buildWeather(opts.weather);

  // ── 草:庭院里一丛丛的草,随风摆(实例化 + 顶点着色器里摆) ─────────────────
  const grassUniforms = { uTime: { value: 0 } };
  // 写实画风的草是广场层种的真实草丛(buildWorld 的 scatterNature)
  if (opts.grass && high && !realistic) {
    const blade = track(new THREE_NS.PlaneGeometry(0.045, 0.34, 1, 4));
    blade.translate(0, 0.17, 0);
    {
      // 草叶从根到尖收窄成一根刺,不是一条长方块
      const bp = blade.attributes.position;
      for (let i = 0; i < bp.count; i++) bp.setX(i, bp.getX(i) * (1 - (bp.getY(i) / 0.34) * 0.9));
    }
    // 一丛 = 三片交叉的草叶
    const tuft = track(new THREE_NS.BufferGeometry());
    {
      const parts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 3; i++) {
        const b = blade.clone();
        b.rotateY((i / 3) * Math.PI + 0.3);
        b.rotateX(0.18);
        b.translate(Math.cos(i * 2.1) * 0.05, 0, Math.sin(i * 2.1) * 0.05);
        parts.push(b);
      }
      const pos: number[] = [], uv: number[] = [], nrm: number[] = [], idx: number[] = [];
      let off = 0;
      for (const b of parts) {
        pos.push(...(b.attributes.position.array as Float32Array));
        uv.push(...(b.attributes.uv.array as Float32Array));
        nrm.push(...(b.attributes.normal.array as Float32Array));
        idx.push(...Array.from(b.index!.array as Uint16Array).map((v) => v + off));
        off += b.attributes.position.count;
        b.dispose();
      }
      tuft.setAttribute('position', new THREE_NS.Float32BufferAttribute(pos, 3));
      tuft.setAttribute('uv', new THREE_NS.Float32BufferAttribute(uv, 2));
      tuft.setAttribute('normal', new THREE_NS.Float32BufferAttribute(nrm, 3));
      tuft.setIndex(idx);
    }
    const gm = track(new THREE_NS.MeshStandardMaterial({ color: 0x5f8a3e, roughness: 0.8, side: THREE_NS.DoubleSide }));
    gm.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = grassUniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vH;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vH = uv.y;
          vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float wind = sin(uTime * 1.6 + ip.x * 0.35 + ip.z * 0.25) * 0.6 + sin(uTime * 3.1 + ip.x * 1.3) * 0.25;
          transformed.x += wind * 0.1 * uv.y * uv.y;
          transformed.z += wind * 0.08 * uv.y * uv.y;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(0.35, 1.25, vH);');
    };
    const n = 7000;
    const inst = new THREE_NS.InstancedMesh(tuft, gm, n);
    const mtx = new THREE_NS.Matrix4(), q = new THREE_NS.Quaternion(), s = new THREE_NS.Vector3(), p = new THREE_NS.Vector3();
    const tint = new THREE_NS.Color();
    let placed = 0;
    const onPath = (x: number, z: number) => opts.zones.some((zn) => {
      // 舞台到地标的小路两侧不长草
      const L = Math.hypot(zn.x, zn.z) || 1, ux = zn.x / L, uz = zn.z / L;
      const t = x * ux + z * uz;
      if (t < 5 || t > L) return false;
      return Math.abs(x * uz - z * ux) < 0.7;
    });
    for (let tries = 0; placed < n && tries < n * 4; tries++) {
      const a = Math.random() * Math.PI * 2;
      const r = 7.2 + Math.sqrt(Math.random()) * (WORLD_RADIUS - 7.8);
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (opts.zones.some((zn) => Math.hypot(x - zn.x, z - zn.z) < zn.solidRadius + 0.9)) continue;
      if (onPath(x, z)) continue;
      if (fbm(x * 0.25, z * 0.25, 3) < 0.38) continue; // 成片,不是均匀撒
      const k = 0.7 + Math.random() * 0.8;
      p.set(x, 0, z);
      q.setFromAxisAngle(new THREE_NS.Vector3(0, 1, 0), Math.random() * 6.28);
      s.set(k, k * (0.7 + Math.random() * 0.8), k);
      mtx.compose(p, q, s);
      inst.setMatrixAt(placed, mtx);
      inst.setColorAt(placed, tint.setHSL(0.24 + Math.random() * 0.07, 0.45, 0.3 + Math.random() * 0.12));
      placed++;
    }
    inst.count = placed;
    inst.receiveShadow = true;
    group.add(inst);
  }

  // ── 后期 ───────────────────────────────────────────────────────────
  // 写实画风再加环境光遮蔽(屋檐下、墙角、东西落地处的暗部)
  const post: PostPipeline | null = high ? createPost(THREE_NS, renderer, { ao: realistic }) : null;
  const bufSize = new THREE_NS.Vector2();
  let lastW = 0, lastH = 0;

  // ── 雾 ─────────────────────────────────────────────────────────────
  const fog = new THREE_NS.FogExp2(0x000000, 0.01);
  const prevFog = scene.fog;
  const prevBg = scene.background;

  function applySky(s: SkyState) {
    skyUniforms.uZenith.value.setRGB(...s.zenith);
    skyUniforms.uHorizon.value.setRGB(...s.horizon);
    skyUniforms.uGround.value.setRGB(...s.ground);
    skyUniforms.uSunColor.value.setRGB(...s.sunColor);
    skyUniforms.uSunDir.value.set(...s.sunDir);
    skyUniforms.uNight.value = s.night;
    (skyMat.uniforms.uMoonDir.value as THREE.Vector3).set(-s.sunDir[0], Math.max(0.35, -s.sunDir[1]), -s.sunDir[2]).normalize();
    fog.color.setRGB(...s.fog);
    fog.density = s.fogDensity;
    fogUniforms.uFogColor.value.setRGB(...s.fog);
    fogUniforms.uFogDensity.value = s.fogDensity;
    sun.color.setRGB(...s.lightColor);
    sun.intensity = s.lightIntensity;
    hemi.color.setRGB(...s.hemiSky);
    hemi.groundColor.setRGB(...s.hemiGround);
    // 写实画风有 HDRI 环境光,半球光只留一点补色
    hemi.intensity = s.hemiIntensity * (realistic ? 0.3 : 1);
    real?.setHour(hour);
    waterMat.uniforms.uLamp.value = s.lampBoost;
    for (const b of boats) (b.lamp.material as THREE.MeshBasicMaterial).color.setRGB(3.2 * s.lampBoost, 1.6 * s.lampBoost, 0.6 * s.lampBoost);
    post?.set({ warmth: s.warmth, bloom: 0.35 + s.night * 0.45, threshold: 1.6 - s.night * 0.85 });
  }
  applySky(sky);

  // 场景预设(演唱会、花园……)是给小舞台做的:天空球、舞台后面的大背景墙、舞台圈外的树和桁架、彩色粒子,
  // 会把湖和山挡住,也和这里的天光打架。广场开着时只保留预设的舞台地板和舞台灯,其余藏起来,关掉广场再露出来。
  // 只动预设自己那个 group(useVrmScene 里命名为 dh-preset),角色、显示器、彩屑都不在里面。
  const hiddenDomes = new Set<THREE.Object3D>();
  const wp = new THREE_NS.Vector3();
  const nz = new THREE_NS.Vector3();
  const wq = new THREE_NS.Quaternion();
  function hidePresetDomes() {
    const preset = scene.getObjectByName('dh-preset');
    if (!preset) return;
    preset.traverse((o) => {
      if (o === preset || !o.visible) return;
      // 预设自带的灯:和太阳 / 月光、半球光叠在一起会把角色照成一片白
      if ((o as THREE.Light).isLight || (o as THREE.Points).isPoints) { o.visible = false; hiddenDomes.add(o); return; }
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const geo = m.geometry as THREE.BufferGeometry & { parameters?: { radius?: number; width?: number; height?: number } };
      const mat = m.material as THREE.Material;
      const dome = geo?.type === 'SphereGeometry' && (geo.parameters?.radius ?? 0) >= 30 && mat?.side === THREE_NS.BackSide;
      m.getWorldPosition(wp);
      const r = Math.hypot(wp.x, wp.z);
      // 立着的、在舞台后面的大板子(背景墙 / 镜墙 / 无缝纸)
      const backdrop = geo?.type === 'PlaneGeometry' && (geo.parameters?.width ?? 0) >= 8 && wp.z < -2 && wp.y > 0.5;
      // 舞台圈外的装饰;地板是以原点为心的圆 / 平面,中心在圈内,不会被这条误伤
      const outside = r > 3.4;
      // 圈内也只留躺平的地板和 LED 环:光柱(加色混合的锥)、树、柱子都藏
      // 只留舞台大小的圆形地板和 LED 环;草坪那种铺满 20 米的大平面也藏(广场有自己的地面)
      const bigFloor = (geo?.parameters?.width ?? 0) > 12 || (geo?.parameters?.radius ?? 0) > 8;
      // 「躺平」按法线判断(平面 / 圆的法线是本地 +Z):草坪预设里那些立着的小草叶片也在地面高度,但不是地板
      m.getWorldQuaternion(wq);
      const up = Math.abs(nz.set(0, 0, 1).applyQuaternion(wq).y) > 0.9;
      const flat = (geo?.type === 'CircleGeometry' || geo?.type === 'RingGeometry' || geo?.type === 'PlaneGeometry') && wp.y < 0.15 && up && !bigFloor;
      const beam = mat?.blending === THREE_NS.AdditiveBlending;
      // 写实画风:舞台的地板和 LED 环也是霓虹风,一并藏起来,只露出石台
      if (realistic || dome || backdrop || outside || beam || !flat) {
        m.visible = false;
        hiddenDomes.add(m);
      }
    });
  }
  hidePresetDomes();

  let frame = 0;
  const lightDir = new THREE_NS.Vector3();
  function tick(t: number, dt: number, camera: THREE.PerspectiveCamera, focus: { x: number; z: number }) {
    frame++;
    // 昼夜:目标时刻变了就在几秒内平滑转过去(沿时间往前走,不倒转)
    if (timeMode === 'auto' && frame % 120 === 0) retarget(modeHour('auto'));
    if (Math.abs(hour - hourTarget) > 0.001) {
      let d = hourTarget - hour;
      if (d < 0) d += 24;
      const step = Math.min(d, dt * hourSpeed);
      hour = (hour + step) % 24;
      if (d - step < 0.001) hour = hourTarget;
      sky = skyAt(hour);
      applySky(sky);
    }
    skyUniforms.uTime.value = t;
    skyMesh.position.copy(camera.position);
    real?.tick(dt, camera);
    grassUniforms.uTime.value = t;

    // 平行光:从太阳 / 月亮方向照向角色,阴影框跟着角色
    lightDir.set(...keyLightDir(sky));
    sun.target.position.set(focus.x, 0, focus.z);
    sun.position.set(focus.x + lightDir.x * 60, lightDir.y * 60, focus.z + lightDir.z * 60);

    // 船
    for (const b of boats) {
      b.a += b.speed * dt;
      const x = Math.sin(b.a) * b.r, z = Math.cos(b.a) * b.r;
      b.g.position.set(x, WATER_Y + 0.12 + Math.sin(t * 1.3 + b.r) * 0.05, z);
      b.g.rotation.set(Math.sin(t * 0.9 + b.r) * 0.03, Math.atan2(Math.cos(b.a), -Math.sin(b.a)) * Math.sign(b.speed) + (b.speed < 0 ? Math.PI : 0), Math.sin(t * 1.1 + b.r * 2) * 0.04);
    }

    // 天气
    if (weatherPoints) {
      const u = (weatherPoints.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = t;
      u.uCenter.value.copy(camera.position);
      renderer.getDrawingBufferSize(bufSize);
      u.uScale.value = bufSize.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
      u.uLight.value = 0.35 + (1 - sky.night) * 0.75;
    }

    // 场景雾 / 背景:预设切换时会被改回去,每帧压一下
    scene.fog = fog;
    scene.background = null;
    if (frame % 45 === 0) hidePresetDomes();
    if (camera.far < 1200) { camera.far = 1200; camera.updateProjectionMatrix(); }
  }

  const render = post
    ? (r: THREE.WebGLRenderer, s: THREE.Scene, c: THREE.Camera, t: number) => {
      r.getDrawingBufferSize(bufSize);
      if (bufSize.x !== lastW || bufSize.y !== lastH) { post.setSize(bufSize.x, bufSize.y); lastW = bufSize.x; lastH = bufSize.y; }
      post.render(r, s, c, t);
    }
    : null;

  function dispose() {
    buildWeather('none');
    real?.dispose();
    post?.dispose();
    disposables.forEach((d) => d.dispose());
    group.clear();
    hiddenDomes.forEach((m) => { m.visible = true; });
    scene.fog = prevFog;
    scene.background = prevBg;
  }

  return {
    group,
    tick,
    render,
    setTimeMode: (m) => { timeMode = m; retarget(modeHour(m)); },
    setWeather: (w) => buildWeather(w),
    sky: () => sky,
    dispose,
  };
}
