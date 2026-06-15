/**
 * AholoStage —— 用 @manycore/aholo-viewer 渲染真实高斯场景/数字人。
 *
 * 现阶段加载静态高斯资产(默认官方示例),验证 WebGPU + aholo 在你项目里跑通;
 * 接入「可驱动 GS 数字人」后,在 applyFrame 里做 LBS 蒙皮/FLAME 形变。
 * 任意一步失败都置 available=false,交给 CanvasStage 兜底,绝不影响整站。
 */
import type { IAvatarStage, DrivingFrame } from './types';
import { loadAnimatableGS, type AnimatableGSAsset } from './gs/assetFormat';
import { computeSkinningMatrices } from './gs/smplx';
import { deformPositions, applyFlame } from './gs/deformer';

const SAMPLE_SCENE = 'https://holo-cos.aholo3d.cn/aholo-opensource/gs_file/bear/bear.3d71a266.sog';

export class AholoStage implements IAvatarStage {
  available = false;
  private viewer: any = null;
  private splat: any = null;
  private aholo: any = null;
  private raf: number | null = null;

  async mount(container: HTMLElement) {
    if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
      throw new Error('WebGPU 不可用(需要支持 WebGPU 的浏览器)');
    }
    this.aholo = await import('@manycore/aholo-viewer');
    const { createViewer, setViewerConfig } = this.aholo;
    this.viewer = createViewer('digital-human-viewer', container, {});
    try {
      setViewerConfig?.(this.viewer, { pipeline: { Splatting: { enabled: true } } });
    } catch {
      /* 不同版本配置可选 */
    }
    this.available = true;
    this.tick();
  }

  async loadScene(sceneUrl = SAMPLE_SCENE) {
    if (!this.viewer) return;
    const { SplatLoader, SplatUtils, Vector3 } = this.aholo;
    const buf = new Uint8Array(await (await fetch(sceneUrl)).arrayBuffer());
    const data = await SplatLoader.parseSplatData(
      SplatLoader.SplatFileType.SOG,
      buf,
      SplatLoader.SplatPackType.Compressed,
    );
    this.splat = await SplatUtils.createSplat(data);
    const scene = this.viewer.getScene?.() ?? this.viewer.scene;
    scene?.add?.(this.splat);
    const cam = this.viewer.getCamera?.();
    if (cam) {
      cam.up?.set?.(0, -1, 0);
      cam.position?.set?.(-1.5, -0.5, 0);
      cam.lookAt?.(new Vector3(0, 0, 0));
    }
  }

  // ─── 可驱动 GS 资产 ───
  private asset: AnimatableGSAsset | null = null;
  private deformed: Float32Array | null = null; // 当前帧形变后位置(count*3)
  private avatarSplat: any = null;              // 当前数字人的 splat 对象
  private rebuilding = false;                    // 重建是否在途(避免并发)
  private lastBuild = 0;                          // 上次重建时刻(节流)
  private rebuildIntervalMs = 60;                // 重建限频(~16fps 形变更新)

  // ─── 刚性骨骼分组模式(opt-in,免每帧重建)───
  // aholo 公开 API 不支持原地改 packed buffer 的 center(SplatOperator 只读),
  // 故"免重建"用刚性分组:身体按 dominant joint 分成 N 个 splat,每帧只改各 splat 的
  // Object3D 位姿(零重建);脸点(FLAME 影响)单独一个小 splat 每帧重建以保口型/表情。
  // 取舍:关节边界处无平滑混合(rigid skinning),换取大幅降帧成本。默认关闭。
  private rigidMode = false;
  private boneSplats: Map<number, any> = new Map(); // jointIndex → 身体骨骼 splat
  private faceSplat: any = null;                     // 脸部 splat(每帧重建)
  private faceIdx: number[] = [];                    // 脸点全局索引
  private faceBuf: Float32Array | null = null;       // 脸部世界位置 scratch(n*3)
  private rigidReady = false;

  /** 开启刚性模式(免每帧整体重建)。须在 loadAvatar 之前调用。 */
  enableRigidMode(on = true) {
    this.rigidMode = on;
  }

  async loadAvatar(avatarBaseUrl: string) {
    // 加载"可驱动高斯资产"(gaussians/skinning/smplx),用于 LBS+FLAME 形变
    this.asset = await loadAnimatableGS(avatarBaseUrl);
    if (this.rigidMode) {
      await this.buildRigid();
    } else {
      // 用静止姿态先建出 splat 灌进场景(此前缺失的一环:训练资产真正上身渲染)
      await this.rebuildAvatar(this.asset.position);
    }
  }

  applyFrame(frame: DrivingFrame) {
    const a = this.asset;
    if (!a) return;
    if (this.rigidMode) {
      if (this.rigidReady) this.applyFrameRigid(frame);
      return;
    }
    const hasPose = !!frame.pose;
    const hasFace = (frame.mouthOpen ?? 0) > 0.001 || (frame.blendshapes && Object.keys(frame.blendshapes).length > 0);
    if (!hasPose && !hasFace) return; // 没有任何驱动信号,跳过

    // 1) 身体:有 pose 走 LBS 蒙皮;纯脸帧(WS 口型)则从静止位置出发
    let pos: Float32Array;
    if (hasPose) {
      const skinMats = computeSkinningMatrices(frame.pose!, a.restJoints, a.parents);
      pos = deformPositions(a, skinMats);
    } else {
      pos = Float32Array.from(a.position);
    }
    // 2) 脸:FLAME 表情/口型位移。把 mouthOpen 折进表情(约定索引 0 = 张嘴/jaw open)
    if (a.meta.hasFlame && hasFace) {
      const dim = a.meta.flameDim || 0;
      const expr = exprVector(frame.blendshapes || {}, dim);
      if (dim > 0) expr[0] = Math.max(expr[0], frame.mouthOpen ?? 0);
      applyFlame(a, pos, expr);
    }
    this.deformed = pos;
    // 4) 写回渲染:默认 CPU 基线路径——限频重建整 splat 并热替换。
    //    免重建路径见 rigidMode(enableRigidMode):身体刚性分组只改位姿、脸单独重建。
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (!this.rebuilding && now - this.lastBuild >= this.rebuildIntervalMs) {
      this.rebuilding = true;
      this.lastBuild = now;
      this.rebuildAvatar(pos).finally(() => {
        this.rebuilding = false;
      });
    }
  }

  /** 用给定位置构建 RawSplatData。indices 为空则用全部点;否则只取这些全局索引(分组用)。
   *  shDegree=0:仅 DC 颜色。positions 按全局索引寻址(count*3)。
   *  注:scale/opacity 按"已激活(线性)"对待 —— 转换脚本须输出 render-ready 值。 */
  private buildRawSplat(positions: Float32Array, indices?: ArrayLike<number>) {
    const a = this.asset!;
    const { SplatLoader } = this.aholo;
    const m = indices ? indices.length : a.meta.count;
    const raw = new SplatLoader.RawSplatData();
    raw.init(m, 0);
    const C0 = 0.28209479177387814; // SH DC → 颜色 的常数
    const sh = a.sh;
    const shDim = a.shDim;
    for (let t = 0; t < m; t++) {
      const i = indices ? indices[t] : t;
      raw.setCenter(t, positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      raw.setScale(t, a.scale[i * 3], a.scale[i * 3 + 1], a.scale[i * 3 + 2]);
      raw.setQuat(t, a.rotation[i * 4], a.rotation[i * 4 + 1], a.rotation[i * 4 + 2], a.rotation[i * 4 + 3]);
      const o = i * shDim;
      raw.setColor(t, clamp01(0.5 + C0 * sh[o]), clamp01(0.5 + C0 * sh[o + 1]), clamp01(0.5 + C0 * sh[o + 2]));
      raw.setAlpha(t, a.opacity[i]);
    }
    return raw;
  }

  /** 构建并热替换数字人 splat(rest 或每帧形变后)。 */
  private async rebuildAvatar(positions: Float32Array) {
    if (!this.viewer || !this.asset) return;
    const { SplatUtils } = this.aholo;
    const raw = this.buildRawSplat(positions);
    const splat = await SplatUtils.createSplat(raw);
    const scene = this.viewer.getScene?.() ?? this.viewer.scene;
    const old = this.avatarSplat;
    scene?.add?.(splat);
    if (old) {
      try {
        scene?.remove?.(old);
        old.freeGPU?.();
        old.destroy?.();
      } catch {
        /* noop */
      }
    }
    this.avatarSplat = splat;
    this.splat = splat;
  }

  // ─── 刚性骨骼分组(免重建)实现 ───

  /** 构建刚性模式:身体按 dominant joint 分成多个 splat(静止位置),脸点单独成组。 */
  private async buildRigid() {
    const a = this.asset!;
    const { SplatUtils } = this.aholo;
    const scene = this.viewer.getScene?.() ?? this.viewer.scene;
    const n = a.meta.count;
    const dim = a.meta.flameDim || 0;

    // 脸点判定:flameBasis 非零的点;无 flameBasis 时退回"dominant joint ∈ 头/下巴/眼"
    const FACE_JOINTS = new Set([15, 22, 23, 24]); // SMPL-X: head/jaw/leye/reye
    const isFace = new Uint8Array(n);
    if (a.meta.hasFlame && a.flameBasis && dim > 0) {
      const fb = a.flameBasis;
      const blk = 3 * dim;
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < blk; k++) {
          if (fb[i * blk + k] !== 0) { isFace[i] = 1; break; }
        }
      }
    } else {
      for (let i = 0; i < n; i++) if (FACE_JOINTS.has(dominantJoint(a, i))) isFace[i] = 1;
    }

    // 身体按 dominant joint 分组
    const groups = new Map<number, number[]>();
    this.faceIdx = [];
    for (let i = 0; i < n; i++) {
      if (isFace[i]) { this.faceIdx.push(i); continue; }
      const j = dominantJoint(a, i);
      let g = groups.get(j);
      if (!g) { g = []; groups.set(j, g); }
      g.push(i);
    }

    // 每骨建一个 splat(点存"静止位置",由 Object3D 位姿驱动)
    this.boneSplats = new Map();
    for (const [j, idxs] of groups) {
      const raw = this.buildRawSplat(a.position, idxs);
      const sp = await SplatUtils.createSplat(raw);
      scene?.add?.(sp);
      this.boneSplats.set(j, sp);
    }
    // 脸 scratch + 初始脸 splat(静止)
    this.faceBuf = new Float32Array(n * 3);
    for (const i of this.faceIdx) {
      this.faceBuf[i * 3] = a.position[i * 3];
      this.faceBuf[i * 3 + 1] = a.position[i * 3 + 1];
      this.faceBuf[i * 3 + 2] = a.position[i * 3 + 2];
    }
    await this.rebuildFace();
    this.rigidReady = true;
  }

  /** 刚性模式每帧:身体只改各骨 splat 位姿(零重建),脸点全 LBS+FLAME 后重建小 splat。 */
  private applyFrameRigid(frame: DrivingFrame) {
    const a = this.asset!;
    const { Vector3, Quaternion } = this.aholo;
    const pose = frame.pose ?? new Float32Array(a.parents.length * 3);
    const skinMats = computeSkinningMatrices(pose, a.restJoints, a.parents);

    // 身体:每骨 splat 的世界位姿 = 该关节蒙皮矩阵 [R|t](posed = R·p + t)
    for (const [j, sp] of this.boneSplats) {
      const o = j * 12;
      const q = quatFromMat3(skinMats, o);
      try {
        sp.position = new Vector3(skinMats[o + 9], skinMats[o + 10], skinMats[o + 11]);
        sp.quaternion = new Quaternion(q[0], q[1], q[2], q[3]);
        sp.setMatrixDirty?.();
        sp.setMatrixUpdated?.();
      } catch {
        /* 某些版本位姿 setter 略异,忽略 */
      }
    }

    // 脸:对脸点做完整 LBS(多关节混合)+ FLAME,写入 faceBuf 后重建小 splat
    const buf = this.faceBuf!;
    const { skinJoints, skinWeights, position } = a;
    for (const i of this.faceIdx) {
      let ox = 0, oy = 0, oz = 0;
      const px = position[i * 3], py = position[i * 3 + 1], pz = position[i * 3 + 2];
      for (let k = 0; k < 4; k++) {
        const w = skinWeights[i * 4 + k];
        if (w === 0) continue;
        const o = skinJoints[i * 4 + k] * 12;
        ox += w * (skinMats[o] * px + skinMats[o + 1] * py + skinMats[o + 2] * pz + skinMats[o + 9]);
        oy += w * (skinMats[o + 3] * px + skinMats[o + 4] * py + skinMats[o + 5] * pz + skinMats[o + 10]);
        oz += w * (skinMats[o + 6] * px + skinMats[o + 7] * py + skinMats[o + 8] * pz + skinMats[o + 11]);
      }
      buf[i * 3] = ox; buf[i * 3 + 1] = oy; buf[i * 3 + 2] = oz;
    }
    // FLAME 口型/表情(applyFlame 只移动有 flameBasis 的点,即脸点)
    if (a.meta.hasFlame) {
      const dim = a.meta.flameDim || 0;
      const expr = exprVector(frame.blendshapes || {}, dim);
      if (dim > 0) expr[0] = Math.max(expr[0], frame.mouthOpen ?? 0);
      applyFlame(a, buf, expr);
    }
    // 脸点少,重建廉价;限频避免并发
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (!this.rebuilding && now - this.lastBuild >= this.rebuildIntervalMs) {
      this.rebuilding = true;
      this.lastBuild = now;
      this.rebuildFace().finally(() => { this.rebuilding = false; });
    }
  }

  /** 用 faceBuf 当前世界位置重建脸 splat(热替换)。 */
  private async rebuildFace() {
    if (!this.asset || !this.faceIdx.length || !this.faceBuf) return;
    const { SplatUtils } = this.aholo;
    const raw = this.buildRawSplat(this.faceBuf, this.faceIdx);
    const splat = await SplatUtils.createSplat(raw);
    const scene = this.viewer.getScene?.() ?? this.viewer.scene;
    const old = this.faceSplat;
    scene?.add?.(splat);
    if (old) {
      try { scene?.remove?.(old); old.freeGPU?.(); old.destroy?.(); } catch { /* noop */ }
    }
    this.faceSplat = splat;
  }

  /** 给外部(GPU 集成)取当前帧形变结果 */
  getDeformedPositions(): Float32Array | null {
    return this.deformed;
  }

  dispose() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    try {
      this.avatarSplat?.freeGPU?.();
      this.avatarSplat?.destroy?.();
      this.faceSplat?.freeGPU?.();
      this.faceSplat?.destroy?.();
      for (const sp of this.boneSplats.values()) { sp?.freeGPU?.(); sp?.destroy?.(); }
      this.boneSplats.clear();
      this.splat?.destroy?.();
      this.viewer?.dispose?.();
    } catch {
      /* noop */
    }
  }

  private tick = () => {
    try {
      this.viewer?.render?.();
    } catch {
      /* 某些版本自动渲染 */
    }
    this.raf = requestAnimationFrame(this.tick);
  };
}

/** 把 blendshapes(名称→值)转成 FLAME 表情系数向量。
 *  约定:键可为 "0".."D-1"(直接系数),或 audio2face 的 ARKit 名(需自行映射)。 */
function exprVector(blendshapes: Record<string, number>, dim: number): Float32Array {
  const v = new Float32Array(dim);
  for (const [k, val] of Object.entries(blendshapes)) {
    const idx = Number(k);
    if (Number.isInteger(idx) && idx >= 0 && idx < dim) v[idx] = val;
  }
  return v;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** 取第 i 个高斯权重最大的关节(dominant joint)。 */
function dominantJoint(a: AnimatableGSAsset, i: number): number {
  let best = 0, bw = -1;
  for (let k = 0; k < 4; k++) {
    const w = a.skinWeights[i * 4 + k];
    if (w > bw) { bw = w; best = a.skinJoints[i * 4 + k]; }
  }
  return best;
}

/** 行主序 3x3 旋转(skinMats[off..off+8])→ 四元数 [x,y,z,w]。 */
function quatFromMat3(m: Float32Array, off: number): [number, number, number, number] {
  const m00 = m[off], m01 = m[off + 1], m02 = m[off + 2];
  const m10 = m[off + 3], m11 = m[off + 4], m12 = m[off + 5];
  const m20 = m[off + 6], m21 = m[off + 7], m22 = m[off + 8];
  const tr = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1.0) * 2;
    w = 0.25 * s; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1.0 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1.0 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1.0 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
  }
  return [x, y, z, w];
}
