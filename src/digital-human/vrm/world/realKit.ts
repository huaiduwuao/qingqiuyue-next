/**
 * vrm/world/realKit.ts — 写实素材的加载工具(环境层和广场搭建共用)
 *
 * 素材是 Blender 流水线(qingqiuyue-go/scripts/blender)加工过的 Poly Haven CC0 素材,在 MinIO qq-media/world:
 *   textures/<id>_{diff,nor,arm}.jpg   平铺 PBR 贴图(ARM = R 环境光遮蔽 / G 粗糙 / B 金属)
 *   models/<id>{,_lod1}.glb            Draco + WebP 的模型
 *
 * - texSet(id, repeat):把一套平铺贴图挂到材质上(异步,到了再换;没到时材质保持原来的纯色)
 * - model(id):加载一次、之后克隆;scatter(id, spots):同一个模型种很多份(每个子网格一组 InstancedMesh)
 * 都是「尽力而为」:任何一个素材加载失败,场景照样能用,只是那一样保持风格化的样子。
 */

import type * as THREE from 'three';
import { mediaUrl } from '@/lib/media';

export const WORLD_ASSET_BASE = '/qq-media/world';

export interface Spot { x: number; y?: number; z: number; scale?: number; rot?: number }

export interface RealKit {
  base: string;
  texSet: (m: THREE.MeshStandardMaterial, id: string, repeat?: number | [number, number], opts?: { normalScale?: number; tint?: number }) => void;
  model: (id: string) => Promise<THREE.Object3D>;
  scatter: (parent: THREE.Object3D, id: string, spots: Spot[], opts?: { castShadow?: boolean; whole?: boolean }) => void;
  dispose: () => void;
}

export function createRealKit(THREE_NS: typeof THREE, opts: { base?: string; quality: 'high' | 'low'; anisotropy?: number }): RealKit {
  const base = mediaUrl(opts.base ?? WORLD_ASSET_BASE);
  const high = opts.quality === 'high';
  const disposables = new Set<{ dispose: () => void }>();
  const track = <T extends { dispose: () => void }>(x: T) => { disposables.add(x); return x; };
  let disposed = false;
  const texLoader = new THREE_NS.TextureLoader();

  // 同一张图只下一次;不同的 repeat 用 clone 共享底层图像
  const imgCache = new Map<string, Promise<THREE.Texture>>();
  const loadTex = (file: string, srgb: boolean, repeat: number | [number, number]) => {
    let p = imgCache.get(file);
    if (!p) {
      p = texLoader.loadAsync(`${base}/textures/${file}`);
      imgCache.set(file, p);
    }
    return p.then((t0) => {
      const t = track(t0.clone());
      t.wrapS = t.wrapT = THREE_NS.RepeatWrapping;
      if (Array.isArray(repeat)) t.repeat.set(repeat[0], repeat[1]); else t.repeat.set(repeat, repeat);
      t.colorSpace = srgb ? THREE_NS.SRGBColorSpace : THREE_NS.NoColorSpace;
      t.anisotropy = opts.anisotropy ?? (high ? 8 : 2);
      t.needsUpdate = true;
      return t;
    });
  };

  function texSet(m: THREE.MeshStandardMaterial, id: string, repeat: number | [number, number] = 1, o: { normalScale?: number; tint?: number } = {}) {
    Promise.all([loadTex(`${id}_diff.jpg`, true, repeat), loadTex(`${id}_nor.jpg`, false, repeat), loadTex(`${id}_arm.jpg`, false, repeat).catch(() => null)])
      .then(([diff, nor, arm]) => {
        if (disposed) return;
        m.map = diff;
        m.normalMap = nor;
        m.normalScale.set(o.normalScale ?? 1, o.normalScale ?? 1);
        if (arm) { m.roughnessMap = arm; m.aoMap = arm; m.roughness = 1; }
        m.color.set(o.tint ?? 0xffffff);
        m.emissive?.set(0x000000);
        m.metalness = 0;
        m.needsUpdate = true;
      })
      .catch(() => { /* 贴图没到:保持纯色 */ });
  }

  const modelCache = new Map<string, Promise<THREE.Object3D>>();
  async function loadModel(id: string): Promise<THREE.Object3D> {
    const [{ GLTFLoader }, { DRACOLoader }] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/DRACOLoader.js'),
    ]);
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/'); // 解码器随前端发(public/draco)
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    try {
      const gltf = await loader.loadAsync(`${base}/models/${id}.glb`);
      const root = gltf.scene as THREE.Object3D;
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        track(mesh.geometry);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mt of mats) {
          const sm = mt as THREE.MeshStandardMaterial;
          // 叶片 / 草片:用 alphaTest 裁,不做半透明排序
          if (sm.transparent || sm.alphaTest > 0) { sm.transparent = false; sm.alphaTest = Math.max(sm.alphaTest, 0.5); sm.side = THREE_NS.DoubleSide; }
          track(sm);
          for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'] as const) if (sm[k]) track(sm[k]!);
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      });
      return root;
    } finally {
      draco.dispose();
    }
  }
  function model(id: string) {
    let p = modelCache.get(id);
    if (!p) { p = loadModel(id); modelCache.set(id, p); }
    return p.then((root) => root.clone(true));
  }

  /**
   * Poly Haven 的一个文件里常常并排放着好几个变体(一排蒲公英、一组石头、三丛草)。
   * 默认把每个顶层节点当一个变体、挪回原点,点位轮流分给各个变体;whole = 整份当一个东西种。
   */
  function scatter(parent: THREE.Object3D, id: string, spots: Spot[], so: { castShadow?: boolean; whole?: boolean } = {}) {
    if (!spots.length) return;
    let p = modelCache.get(id);
    if (!p) { p = loadModel(id); modelCache.set(id, p); }
    p.then((root) => {
      if (disposed) return;
      root.updateMatrixWorld(true);
      const hasMesh = (o: THREE.Object3D) => { let y = false; o.traverse((c) => { if ((c as THREE.Mesh).isMesh) y = true; }); return y; };
      const variants = so.whole ? [root] : root.children.filter(hasMesh);
      if (!variants.length) variants.push(root);
      const pm = new THREE_NS.Matrix4();
      const m = new THREE_NS.Matrix4();
      const recenter = new THREE_NS.Matrix4();
      const wp = new THREE_NS.Vector3();
      const up = new THREE_NS.Vector3(0, 1, 0);
      variants.forEach((v, vi) => {
        const mine = spots.filter((_, i) => i % variants.length === vi);
        if (!mine.length) return;
        v.getWorldPosition(wp);
        recenter.makeTranslation(v === root ? 0 : -wp.x, 0, v === root ? 0 : -wp.z);
        v.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const inst = new THREE_NS.InstancedMesh(mesh.geometry, mesh.material, mine.length);
          mine.forEach((s, i) => {
            const k = s.scale ?? 1;
            pm.compose(new THREE_NS.Vector3(s.x, s.y ?? 0, s.z), new THREE_NS.Quaternion().setFromAxisAngle(up, s.rot ?? 0), new THREE_NS.Vector3(k, k, k));
            m.multiplyMatrices(pm, recenter).multiply(mesh.matrixWorld);
            inst.setMatrixAt(i, m);
          });
          inst.instanceMatrix.needsUpdate = true;
          inst.computeBoundingSphere();
          inst.castShadow = so.castShadow ?? true;
          inst.receiveShadow = true;
          parent.add(inst);
          disposables.add({ dispose: () => { parent.remove(inst); inst.dispose(); } });
        });
      });
    }).catch(() => { /* 模型没到:这一样就不种了 */ });
  }

  return {
    base,
    texSet,
    model,
    scatter,
    dispose: () => { disposed = true; disposables.forEach((d) => d.dispose()); disposables.clear(); },
  };
}
