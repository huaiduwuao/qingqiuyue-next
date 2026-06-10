/**
 * SparkStage —— 基于 @sparkjsdev/spark 的可驱动 3DGS 真人数字人渲染器。
 *
 * 为什么用 Spark 而不是 mkkellogg:
 *   - Spark 内置 SplatSkinning(LINEAR_BLEND / DUAL_QUATERNION 两种 LBS),
 *     直接吃 skinJoints + skinWeights,无需自己写 GLSL/WGSL。
 *   - WebGL2 98%+ 设备覆盖(aholo 的 WebGPU 才 ~7%)。
 *   - 主线 2.1.0 仍在更新(World Labs 维护),支持 dyno shader graph 二次扩展。
 *
 * 数据流:
 *   assetFormat.ts 加载 gaussians.bin / skinning.bin / smplx.json / meta.json
 *   → avatar.ply(.ply) 给 SplatMesh 显形(Spark 原生 .ply 解析)
 *   → SplatSkinning 灌入 skinning + rest pose
 *   → applyFrame(pose) → computeSkinningMatrices(pose) → bone quat+pos 每帧
 *   → SparkRenderer 60fps 出图
 *
 * 当前未做(可后续接):
 *   - FLAME 50 维表情基(Spark 暂未提供 expression API,先跳过)
 *   - mouthOpen 音频驱动(下个迭代用 AudioContext RMS 接)
 */
import * as THREE from 'three';
import { SplatMesh, SplatSkinning, SplatSkinningMode, SparkRenderer, ExtSplats } from '@sparkjsdev/spark';

import type { IAvatarStage, DrivingFrame } from './types';
import { loadAnimatableGS, type AnimatableGSAsset } from './gs/assetFormat';
import { computeSkinningMatrices } from './gs/smplx';
import { applyFlame, blendshapesToExpr } from './gs/flame';

export class SparkStage implements IAvatarStage {
  available = false;

  private renderer: THREE.WebGLRenderer | null = null;
  private spark: SparkRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private mesh: SplatMesh | null = null;
  private skin: SplatSkinning | null = null;
  private asset: AnimatableGSAsset | null = null;

  private raf: number | null = null;
  private resizeObs: ResizeObserver | null = null;
  private container: HTMLElement | null = null;

  // 临时缓冲(避免每帧 new)
  private _boneIdx = new THREE.Vector4();
  private _boneW = new THREE.Vector4();
  private _boneQuat = new THREE.Quaternion();
  private _bonePos = new THREE.Vector3();
  private _restQuat = new THREE.Quaternion();
  private _restPos = new THREE.Vector3();
  private _m4 = new THREE.Matrix4();
  private _center = new THREE.Vector3();
  private _scales = new THREE.Vector3();
  private _quat = new THREE.Quaternion();
  private _color = new THREE.Color();

  // FLAME 缓存(无 flameBasis 时为 null)
  private _flameBasis: Float32Array | null = null;
  private _flameDim = 0;
  private _restCenters: Float32Array | null = null; // 与 .ply 顺序一致(若 extSplats 加载)
  private _exprCache: Float32Array | null = null;
  private _exprBuf: Float32Array | null = null;
  private _hasFlame = false;

  async mount(container: HTMLElement) {
    if (typeof navigator === 'undefined') throw new Error('no window');
    this.container = container;

    // 1) THREE renderer(Spark 强依赖一个外部 renderer)
    const r = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: false });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setClearColor(0x000000, 0);
    const canvas = r.domElement;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none'; // 让浮窗的 drag/click 透到下层
    container.appendChild(canvas);
    this.renderer = r;

    // 2) Scene + camera(头朝 +Y,看原点)
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 50);
    this.camera.position.set(0, 0.1, 2.6);
    this.camera.lookAt(0, 0, 0);

    // 3) Spark renderer(挂到 scene 上,Spark 接管 splat 排序/GPU 出图)
    this.spark = new SparkRenderer({ renderer: r });
    this.scene.add(this.spark);

    // 4) Resize + 主循环
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.loop();

    this.available = true;
  }

  async loadScene(sceneUrl: string) {
    // 暂不实现:SparkStage 只用 loadAvatar 路径(真人 3DGS 数字人)。
    // 这里留个空实现以满足 IAvatarStage 接口。
    void sceneUrl;
  }

  async loadAvatar(avatarBaseUrl: string) {
    if (!this.scene) throw new Error('SparkStage: not mounted');
    const base = avatarBaseUrl.replace(/\/?$/, '/');

    // 1) 资产(.bin / .json)
    this.asset = await loadAnimatableGS(avatarBaseUrl);

    // 2) 可视化 .ply → ExtSplats(可逐点 setSplat,供 FLAME 表情用)
    //    无 FLAME 时退化路径已支持,只是多一份内存(可后续优化)
    const ext = new ExtSplats({ url: base + 'avatar.ply' });
    await ext.initialized;
    this.mesh = new SplatMesh({ extSplats: ext });
    await this.mesh.initialized;
    this.scene.add(this.mesh);

    // 3) 灌入 SplatSkinning
    this.skin = new SplatSkinning({
      mesh: this.mesh,
      numSplats: this.asset.meta.count,
      numBones: this.asset.meta.jointCount,
      mode: SplatSkinningMode.LINEAR_BLEND,
    });
    const a = this.asset;
    for (let i = 0; i < a.meta.count; i++) {
      this._boneIdx.set(
        a.skinJoints[i * 4],
        a.skinJoints[i * 4 + 1],
        a.skinJoints[i * 4 + 2],
        a.skinJoints[i * 4 + 3],
      );
      this._boneW.set(
        a.skinWeights[i * 4],
        a.skinWeights[i * 4 + 1],
        a.skinWeights[i * 4 + 2],
        a.skinWeights[i * 4 + 3],
      );
      this.skin.setSplatBones(i, this._boneIdx, this._boneW);
    }
    // 4) 静止姿态
    for (let j = 0; j < a.meta.jointCount; j++) {
      this._restPos.set(a.restJoints[j * 3], a.restJoints[j * 3 + 1], a.restJoints[j * 3 + 2]);
      this._restQuat.set(0, 0, 0, 1);
      this.skin.setRestQuatPos(j, this._restQuat, this._restPos);
    }
    this.skin.updateBones();

    // 5) FLAME 缓存:有 flameBasis 时启用表情驱动
    this._flameBasis = a.flameBasis ?? null;
    this._flameDim = a.meta.flameDim ?? (a.flameBasis ? Math.floor(a.flameBasis.length / Math.max(1, a.meta.count * 3)) : 0);
    this._hasFlame = !!this._flameBasis && this._flameDim > 0;
    if (this._hasFlame) {
      // 从 .ply 读出初始中心(ExtSplats 加载完顺序与 gaussians.bin 的 position 一致,
      // 因为 .ply 是 convert-exavatar.py 用同一份 pos 写出来的)
      this._restCenters = new Float32Array(a.meta.count * 3);
      for (let i = 0; i < a.meta.count; i++) {
        const sp = ext.getSplat(i);
        this._restCenters[i * 3] = sp.center.x;
        this._restCenters[i * 3 + 1] = sp.center.y;
        this._restCenters[i * 3 + 2] = sp.center.z;
      }
      this._exprBuf = new Float32Array(this._flameDim);
    }

    // 6) 自适应相机
    this.frameCameraToAvatar();
  }

  applyFrame(frame: DrivingFrame) {
    if (!this.skin || !this.asset || !frame.pose) return;
    const a = this.asset;
    // computeSkinningMatrices 输出 [R(9), t(3)] per joint
    const skinMats = computeSkinningMatrices(
      new Float32Array(frame.pose),
      a.restJoints,
      a.parents,
    );
    for (let j = 0; j < a.meta.jointCount; j++) {
      const o = j * 12;
      this._m4.set(
        skinMats[o],     skinMats[o + 1], skinMats[o + 2],  skinMats[o + 9],
        skinMats[o + 3], skinMats[o + 4], skinMats[o + 5],  skinMats[o + 10],
        skinMats[o + 6], skinMats[o + 7], skinMats[o + 8],  skinMats[o + 11],
        0, 0, 0, 1,
      );
      this._m4.decompose(this._bonePos, this._boneQuat, new THREE.Vector3(1, 1, 1));
      this.skin.setBoneQuatPos(j, this._boneQuat, this._bonePos);
    }
    this.skin.updateBones();

    // FLAME 表情:在 rest 空间叠加位移,SparkSkinning 再蒙皮
    // (仅在 mesh 是 extSplats 且有 flameBasis 时生效)
    if (this._hasFlame && this._restCenters && this._flameBasis && this._exprBuf && this.mesh?.extSplats) {
      const expr = blendshapesToExpr(frame.blendshapes as any, this._flameDim);
      this._exprBuf = expr;
      const offset = applyFlame(this._restCenters, this._flameBasis, expr);
      const ext = this.mesh.extSplats;
      for (let i = 0; i < a.meta.count; i++) {
        // 表情基系数为 0 时跳过(优化:大多数点没绑表情)
        if (offset[i * 3] === 0 && offset[i * 3 + 1] === 0 && offset[i * 3 + 2] === 0) continue;
        const sp = ext.getSplat(i);
        this._center.set(
          this._restCenters[i * 3] + offset[i * 3],
          this._restCenters[i * 3 + 1] + offset[i * 3 + 1],
          this._restCenters[i * 3 + 2] + offset[i * 3 + 2],
        );
        // scales/quat/opacity/color 维持原样
        ext.setSplat(i, this._center, sp.scales, sp.quaternion, sp.opacity, sp.color);
      }
    }
  }

  dispose() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    try { this.skin = null; } catch { /* noop */ }
    try { this.mesh?.dispose(); } catch { /* noop */ }
    this.mesh = null;
    try { this.spark?.dispose(); } catch { /* noop */ }
    this.spark = null;
    try { this.renderer?.dispose(); } catch { /* noop */ }
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.container = null;
  }

  // ─── 私有 ───────────────────────────────────────────────────────────
  private resize() {
    if (!this.renderer || !this.camera || !this.container) return;
    const r = this.container.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private frameCameraToAvatar() {
    if (!this.mesh || !this.camera) return;
    const box = this.mesh.getBoundingBox?.(true);
    if (!box) return;
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const r = Math.max(size.x, size.y, size.z) * 0.6;
    const dist = r / Math.tan(((this.camera.fov * Math.PI) / 180) * 0.5);
    this.camera.position.set(center.x, center.y, center.z + dist);
    this.camera.lookAt(center);
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (!this.renderer || !this.scene || !this.camera) return;
    try {
      this.renderer.render(this.scene, this.camera);
    } catch (e) {
      // Spark 内部抛错不应让浮窗崩
      console.warn('[SparkStage] render error:', e);
    }
    this.raf = requestAnimationFrame(this.loop);
  };
}
