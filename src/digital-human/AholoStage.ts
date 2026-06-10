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

  async loadAvatar(avatarBaseUrl: string) {
    // 加载"可驱动高斯资产"(gaussians/skinning/smplx),用于 LBS+FLAME 形变
    this.asset = await loadAnimatableGS(avatarBaseUrl);
    // TODO(aholo 集成):把 asset 的高斯属性灌进 aholo splat buffer,
    // 后续每帧把 this.deformed 写回该 buffer 的 position 通道。
  }

  applyFrame(frame: DrivingFrame) {
    const a = this.asset;
    if (!a || !frame.pose) return;
    // 1) 姿态 → 每关节蒙皮矩阵
    const skinMats = computeSkinningMatrices(frame.pose, a.restJoints, a.parents);
    // 2) LBS 蒙皮形变(身体/手)
    const pos = deformPositions(a, skinMats);
    // 3) FLAME 表情/口型位移(脸)
    if (frame.blendshapes && a.meta.hasFlame) {
      const expr = exprVector(frame.blendshapes, a.meta.flameDim || 0);
      applyFlame(a, pos, expr);
    }
    this.deformed = pos;
    // TODO(aholo 集成):this.viewer 把 this.deformed 写入高斯位置 buffer → 重排序 → 重绘。
    // 也可改用 GPU 路径(deformer.WGSL_LBS)在 compute pass 里直接算,免 CPU↔GPU 拷贝。
  }

  /** 给外部(GPU 集成)取当前帧形变结果 */
  getDeformedPositions(): Float32Array | null {
    return this.deformed;
  }

  dispose() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    try {
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
