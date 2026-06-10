/**
 * DynamicAvatarStage —— 动态高斯数字人渲染器(方案 A)。
 * 用 @mkkellogg/gaussian-splats-3d(Three.js/WebGL)渲染 avatar 高斯,
 * 每帧用已验证的 deformPositions 形变 → 写回它的中心纹理 → 重排序。
 *
 * 分工:场景用 aholo(AholoStage),数字人(点数少)用本渲染器,叠加合成。
 *
 * 验证边界:
 *   - 渲染:mkkellogg 自带 .ply/.splat 加载器,给真人 GS 即显真人(WebGL,需 GPU 浏览器)。
 *   - 形变数学:smplx/deformer 已单测正确。
 *   - 每帧写回中心 + 重排序:用 mkkellogg 内部方法(无类型,版本相关),需实测调优。
 */
import type { IAvatarStage, DrivingFrame } from './types';
import { loadAnimatableGS, type AnimatableGSAsset } from './gs/assetFormat';
import { computeSkinningMatrices } from './gs/smplx';
import { deformPositions, applyFlame } from './gs/deformer';

export class DynamicAvatarStage implements IAvatarStage {
  available = false;
  private viewer: any = null;
  private GS: any = null;
  private asset: AnimatableGSAsset | null = null;
  private lastSwitch = 0;

  async mount(container: HTMLElement) {
    if (typeof navigator === 'undefined') throw new Error('no window');
    this.GS = await import('@mkkellogg/gaussian-splats-3d');
    this.viewer = new this.GS.Viewer({
      rootElement: container,
      selfDrivenMode: true,        // 自带渲染循环
      useBuiltInControls: true,
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort: true,
      dynamicScene: true,          // 关键:允许场景/高斯动态变化
    });
    this.available = true;
  }

  /** 渲染用:加载 .ply/.splat/.ksplat 高斯(真人扫描/训练导出的可视化版) */
  async loadScene(sceneUrl: string) {
    await this.viewer.addSplatScene(sceneUrl, { showLoadingUI: false });
  }

  /**
   * 动画用:同时加载"可驱动资产"(蒙皮/SMPL-X)与其可视化 .ply。
   * @param avatarBaseUrl 资产目录(含 meta/smplx/skinning + avatar.ply)
   */
  async loadAvatar(avatarBaseUrl: string) {
    const base = avatarBaseUrl.replace(/\/?$/, '/');
    this.asset = await loadAnimatableGS(avatarBaseUrl);
    await this.loadScene(base + 'avatar.ply'); // 可视化高斯(顺序需与 asset 一致)
  }

  applyFrame(frame: DrivingFrame) {
    const a = this.asset;
    if (!a || !frame.pose || !this.viewer) return;
    // 1) 姿态→蒙皮矩阵  2) LBS 形变  3) FLAME 口型
    const skinMats = computeSkinningMatrices(frame.pose, a.restJoints, a.parents);
    const pos = deformPositions(a, skinMats);
    if (frame.blendshapes && a.meta.hasFlame) applyFlame(a, pos, toExpr(frame.blendshapes, a.meta.flameDim || 0));
    this.writeCenters(pos);
  }

  /** 把形变后的中心写回 mkkellogg 的中心数据并触发重排序(seam) */
  private writeCenters(pos: Float32Array) {
    try {
      const mesh = this.viewer.getSplatMesh?.();
      if (!mesh) return;
      const n = Math.min(mesh.getSplatCount?.() ?? 0, pos.length / 3);
      // 写入每个 splat 的中心
      if (typeof mesh.setSplatCenter === 'function') {
        for (let i = 0; i < n; i++) mesh.setSplatCenter(i, pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      } else {
        // 退路:直接改中心纹理数据数组
        const tex = mesh.getSplatDataTextures?.();
        const centers: Float32Array | undefined = tex?.centerColors?.data || tex?.centers?.data;
        if (centers) {
          for (let i = 0; i < n; i++) {
            centers[i * 4] = pos[i * 3];
            centers[i * 4 + 1] = pos[i * 3 + 1];
            centers[i * 4 + 2] = pos[i * 3 + 2];
          }
          if (tex?.centerColors?.texture) tex.centerColors.texture.needsUpdate = true;
        }
      }
      // 让排序用上新中心
      mesh.updateGPUCentersBufferForDistancesComputation?.();
      mesh.updateBaseDataFromSplatBuffers?.();
      this.viewer.splatMesh && (this.viewer.splatMesh.needsUpdate = true);
    } catch {
      /* 渲染器内部 API 版本差异,实测调优 */
    }
  }

  dispose() {
    try {
      this.viewer?.dispose?.();
    } catch {
      /* noop */
    }
  }
}

function toExpr(bs: Record<string, number>, dim: number): Float32Array {
  const v = new Float32Array(dim);
  for (const [k, val] of Object.entries(bs)) {
    const i = Number(k);
    if (Number.isInteger(i) && i >= 0 && i < dim) v[i] = val;
  }
  return v;
}
