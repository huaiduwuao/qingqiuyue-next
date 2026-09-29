/**
 * vrm/world/env/realistic.ts — 写实画风的那一层:真实的天空、环境光、地面贴图、松树
 *
 * 素材全是 node-1 上 Blender 流水线(qingqiuyue-go/scripts/blender)加工过的 Poly Haven CC0 素材,
 * 放在 MinIO `qq-media/world/…`:
 *   sky/<hdri>_env.hdr     1k HDR → PMREM,给所有 PBR 材质当环境光 / 反射
 *   sky/<hdri>_bg.jpg      4k(手机 2k)色调映射过的天空,贴在天空球上(不用 scene.background:
 *                          画布要保持透明,场景里的 CSS3D 屏幕是从画布下面透上来的)
 *   textures/<id>_{diff,nor,arm}.jpg   平铺地面
 *   models/<id>{,_lod1,_lod2}.glb      Draco 压缩 + WebP 贴图;松树是 bake_tree.py 出的 pine_b(近景减面 / 中景减面 / 远景 impostor)
 *
 * 时辰对应四张天:晨雾 / 白天 / 黄昏 / 夜里,换时辰时两张天在着色器里交叉淡入淡出,环境光直接换。
 * 松树按离镜头远近分三档 LOD,每隔一小段时间重新分桶(实例化,一档一组 InstancedMesh)。
 */

import type * as THREE from 'three';
import { mediaUrl } from '@/lib/media';

export const WORLD_ASSET_BASE = '/qq-media/world';

/** 时辰 → 天空 HDRI(Poly Haven,CC0) */
export const SKIES = {
  morning: 'kloofendal_misty_morning_puresky',
  day: 'kloofendal_48d_partly_cloudy_puresky',
  dusk: 'qwantani_dusk_2_puresky',
  night: 'qwantani_night_puresky',
} as const;
export type SkyKey = keyof typeof SKIES;

export function skyForHour(h: number): SkyKey {
  if (h >= 5 && h < 8) return 'morning';
  if (h >= 8 && h < 17) return 'day';
  if (h >= 17 && h < 19.5) return 'dusk';
  return 'night';
}

/** 天空亮度(夜里的 HDRI 本身就暗,不再压) */
const SKY_EXPOSURE: Record<SkyKey, number> = { morning: 1, day: 1, dusk: 1, night: 1.15 };
const ENV_INTENSITY: Record<SkyKey, number> = { morning: 0.9, day: 1, dusk: 0.85, night: 0.6 };

export interface TreeSpot { x: number; y: number; z: number; scale: number; rot: number }

export interface RealisticOptions {
  quality: 'high' | 'low';
  /** 素材根路径,默认 /qq-media/world(经 mediaUrl 补网关) */
  base?: string;
  /** 松树种在哪 */
  trees: TreeSpot[];
  /** 地面用哪套平铺贴图 */
  ground?: string;
}

export interface RealisticLayer {
  /** 贴到天空球上的材质 */
  skyMaterial: THREE.ShaderMaterial;
  /** 地形材质换成平铺贴图(地形几何要有世界坐标 uv) */
  applyGround: (m: THREE.MeshStandardMaterial) => void;
  setHour: (h: number) => void;
  tick: (dt: number, camera: THREE.Camera) => void;
  dispose: () => void;
}

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // 永远画在最远处
}`;

const SKY_FRAG = /* glsl */`
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uMix;
uniform float uExpA;
uniform float uExpB;
uniform float uReady;
varying vec3 vDir;
vec2 equirect(vec3 d) {
  return vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
}
void main() {
  vec3 d = normalize(vDir);
  vec2 uv = equirect(d);
  vec3 a = texture2D(uA, uv).rgb * uExpA;
  vec3 b = texture2D(uB, uv).rgb * uExpB;
  vec3 c = mix(a, b, uMix);
  // 贴图没到之前给一层中性的天色,不至于一片黑
  c = mix(vec3(0.55, 0.62, 0.7) * (0.35 + 0.65 * smoothstep(-0.2, 0.4, d.y)), c, uReady);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export function createRealistic(THREE_NS: typeof THREE, renderer: THREE.WebGLRenderer, scene: THREE.Scene, group: THREE.Group, opts: RealisticOptions): RealisticLayer {
  const base = mediaUrl(opts.base ?? WORLD_ASSET_BASE);
  const high = opts.quality === 'high';
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };
  let disposed = false;

  // ── 天空 ─────────────────────────────────────────────────────────
  const skyMaterial = track(new THREE_NS.ShaderMaterial({
    uniforms: {
      uA: { value: null }, uB: { value: null }, uMix: { value: 0 }, uExpA: { value: 1 }, uExpB: { value: 1 }, uReady: { value: 0 },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE_NS.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false, // 背景图在 Blender 里已经按 AgX 映射过了
  }));
  const texLoader = new THREE_NS.TextureLoader();
  const bgCache = new Map<SkyKey, Promise<THREE.Texture>>();
  const loadBg = (k: SkyKey) => {
    let p = bgCache.get(k);
    if (!p) {
      p = texLoader.loadAsync(`${base}/sky/${SKIES[k]}_${high ? 'bg' : 'bg_2k'}.jpg`).then((t) => {
        t.colorSpace = THREE_NS.SRGBColorSpace;
        t.wrapS = THREE_NS.RepeatWrapping;
        t.generateMipmaps = false;
        t.minFilter = THREE_NS.LinearFilter;
        return track(t);
      });
      bgCache.set(k, p);
    }
    return p;
  };

  // ── 环境光:HDR → PMREM ─────────────────────────────────────────
  const pmrem = track(new THREE_NS.PMREMGenerator(renderer));
  const envCache = new Map<SkyKey, Promise<THREE.Texture>>();
  const prevEnv = scene.environment;
  const prevEnvIntensity = scene.environmentIntensity;
  const loadEnv = (k: SkyKey) => {
    let p = envCache.get(k);
    if (!p) {
      p = import('three/examples/jsm/loaders/HDRLoader.js').then(({ HDRLoader }) => new HDRLoader().loadAsync(`${base}/sky/${SKIES[k]}_env.hdr`)).then((hdr: THREE.DataTexture) => {
        hdr.mapping = THREE_NS.EquirectangularReflectionMapping;
        const rt = pmrem.fromEquirectangular(hdr);
        hdr.dispose();
        track(rt);
        return rt.texture;
      });
      envCache.set(k, p);
    }
    return p;
  };

  let current: SkyKey | null = null;
  let fade = 1; // 0 → 1:从 uA 过渡到 uB
  function setHour(h: number) {
    const k = skyForHour(h);
    if (k === current) return;
    const first = current === null;
    current = k;
    loadBg(k).then((tex) => {
      if (disposed || current !== k) return;
      const u = skyMaterial.uniforms;
      if (first || !u.uB.value) {
        u.uA.value = tex; u.uB.value = tex; u.uExpA.value = u.uExpB.value = SKY_EXPOSURE[k];
        u.uMix.value = 1; fade = 1;
      } else {
        u.uA.value = u.uB.value; u.uExpA.value = u.uExpB.value;
        u.uB.value = tex; u.uExpB.value = SKY_EXPOSURE[k];
        u.uMix.value = 0; fade = 0;
      }
      u.uReady.value = 1;
    }).catch(() => { /* 天空图没加载到:保持中性天色 */ });
    loadEnv(k).then((env) => {
      if (disposed || current !== k) return;
      scene.environment = env;
      scene.environmentIntensity = ENV_INTENSITY[k];
    }).catch(() => { /* 没有环境光就靠太阳 + 半球光 */ });
  }

  // ── 地面 ─────────────────────────────────────────────────────────
  const groundId = opts.ground ?? 'leafy_grass';
  function applyGround(m: THREE.MeshStandardMaterial) {
    const load = (kind: string, srgb: boolean) => texLoader.loadAsync(`${base}/textures/${groundId}_${kind}.jpg`).then((t) => {
      t.wrapS = t.wrapT = THREE_NS.RepeatWrapping;
      t.colorSpace = srgb ? THREE_NS.SRGBColorSpace : THREE_NS.NoColorSpace;
      t.anisotropy = high ? 8 : 2;
      return track(t);
    });
    Promise.all([load('diff', true), load('nor', false), load('arm', false)]).then(([diff, nor, arm]) => {
      if (disposed) return;
      m.map = diff;
      m.normalMap = nor;
      m.normalScale.set(0.8, 0.8);
      m.roughnessMap = arm;
      m.aoMap = arm;
      m.roughness = 1;
      // 顶点色保留(远山的岩石 / 雪 / 林子的色差),贴图只管近处的质感,整体抬亮一点别压黑
      m.color.setScalar(1.6);
      // 平铺贴图远看会一格一格地重复:近处两种尺度混着采,远处渐渐退回纯顶点色
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', /* glsl */`
          #ifdef USE_MAP
            vec4 qqA = texture2D(map, vMapUv);
            vec4 qqB = texture2D(map, vMapUv * 0.23 + 0.37);
            vec4 qqTex = mix(qqA, qqB, 0.45);
            float qqFar = smoothstep(18.0, 70.0, length(vViewPosition));
            diffuseColor *= mix(qqTex, vec4(0.42, 0.44, 0.36, 1.0), qqFar);
          #endif`);
      };
      m.customProgramCacheKey = () => 'qq-terrain';
      m.needsUpdate = true;
    }).catch(() => { /* 贴图没到:保持顶点色 */ });
  }

  // ── 松树:GLB 实例化 + 三档 LOD ────────────────────────────────────
  interface Level { parts: THREE.InstancedMesh[]; offsets: THREE.Matrix4[] }
  const levels: (Level | null)[] = [null, null, null];
  const spots = opts.trees;
  const spotMatrix = spots.map((s) => new THREE_NS.Matrix4().compose(
    new THREE_NS.Vector3(s.x, s.y, s.z),
    new THREE_NS.Quaternion().setFromAxisAngle(new THREE_NS.Vector3(0, 1, 0), s.rot),
    new THREE_NS.Vector3(s.scale, s.scale, s.scale),
  ));
  const loadGltf = async (url: string) => {
    const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/DRACOLoader.js'),
    ]);
    const draco = new DRACOLoader();
    // Draco 解码器随前端一起发(public/draco),客户端离线也能用
    draco.setDecoderPath('/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    try {
      return await loader.loadAsync(url);
    } finally {
      draco.dispose();
    }
  };
  const treeFiles = high ? ['pine_b.glb', 'pine_b_lod1.glb', 'pine_b_lod2.glb'] : [null, 'pine_b_lod1.glb', 'pine_b_lod2.glb'];
  treeFiles.forEach((file, li) => {
    if (!file || !spots.length) return;
    loadGltf(`${base}/models/${file}`).then((gltf) => {
      if (disposed) return;
      const root = gltf.scene as THREE.Object3D;
      root.updateMatrixWorld(true);
      const parts: THREE.InstancedMesh[] = [];
      const offsets: THREE.Matrix4[] = [];
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const inst = new THREE_NS.InstancedMesh(mesh.geometry, mesh.material, spots.length);
        track(mesh.geometry);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mt) => {
          const sm = mt as THREE.MeshStandardMaterial;
          // 叶片是带透明的面片:用 alphaTest 裁,不做半透明排序
          if (sm.transparent || sm.alphaMap || (sm.map && sm.alphaTest === 0 && /twig|leaf|needle/i.test(sm.name))) {
            sm.transparent = false;
            sm.alphaTest = 0.5;
            sm.side = THREE_NS.DoubleSide;
          }
          track(sm);
        });
        inst.castShadow = li < 2;
        inst.receiveShadow = true;
        inst.count = 0;
        inst.frustumCulled = false;
        group.add(inst);
        parts.push(inst);
        offsets.push(mesh.matrixWorld.clone());
      });
      levels[li] = { parts, offsets };
      rebucket(lastCam);
    }).catch(() => { /* 某一档没加载到:别的档照常 */ });
  });

  const tmpM = new THREE_NS.Matrix4();
  const camPos = new THREE_NS.Vector3();
  let lastCam: THREE.Camera | null = null;
  // 三维距离(俯视时镜头在高处,水平距离会把整片林子都算成近处)
  const NEAR = high ? 26 : 0, MID = high ? 60 : 40;
  function rebucket(camera: THREE.Camera | null) {
    if (camera) camera.getWorldPosition(camPos);
    const counts = [0, 0, 0];
    spots.forEach((s, i) => {
      const d = Math.hypot(s.x - camPos.x, s.y - camPos.y, s.z - camPos.z);
      // 想要的档没加载好就往粗的档退
      let li = d < NEAR ? 0 : d < MID ? 1 : 2;
      while (li < 2 && !levels[li]) li++;
      if (!levels[li]) { li = 1; if (!levels[li]) li = 0; }
      const lv = levels[li];
      if (!lv) return;
      const n = counts[li]++;
      lv.parts.forEach((p, k) => {
        tmpM.multiplyMatrices(spotMatrix[i], lv.offsets[k]);
        p.setMatrixAt(n, tmpM);
      });
    });
    levels.forEach((lv, li) => lv?.parts.forEach((p) => { p.count = counts[li]; p.instanceMatrix.needsUpdate = true; }));
  }

  let acc = 0;
  function tick(dt: number, camera: THREE.Camera) {
    lastCam = camera;
    acc += dt;
    if (acc > 0.5) { acc = 0; rebucket(camera); }
    if (fade < 1) {
      fade = Math.min(1, fade + dt / 2.5);
      skyMaterial.uniforms.uMix.value = fade * fade * (3 - 2 * fade);
    }
  }

  function dispose() {
    disposed = true;
    levels.forEach((lv) => lv?.parts.forEach((p) => { group.remove(p); p.dispose(); }));
    disposables.forEach((d) => d.dispose());
    scene.environment = prevEnv;
    scene.environmentIntensity = prevEnvIntensity;
  }

  return { skyMaterial, applyGround, setHour, tick, dispose };
}
