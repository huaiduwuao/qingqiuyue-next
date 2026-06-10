/**
 * GaussianDeformer —— 把静止高斯按"姿态(SMPL-X)+ 表情(FLAME)"形变到当前帧。
 *
 * - deformPositions: CPU 精确实现(LBS 蒙皮),正确、可单测,适合中小点数/校验;
 * - applyFlame:      叠加表情位移(口型/表情);
 * - WGSL_LBS:        GPU 计算着色器(大点数实时),与 aholo splat buffer 集成是 seam。
 *
 * 渲染主循环:每帧 computeSkinningMatrices(pose) → deform → 把新 position/rotation
 * 写回渲染器的高斯 buffer → 重排序 → 光栅化。
 */
import type { AnimatableGSAsset } from './assetFormat';

/** CPU:对所有高斯做 LBS 蒙皮,返回当前帧 position(count*3)。 */
export function deformPositions(asset: AnimatableGSAsset, skinMats: Float32Array): Float32Array {
  const n = asset.meta.count;
  const { position, skinJoints, skinWeights } = asset;
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const px = position[i * 3], py = position[i * 3 + 1], pz = position[i * 3 + 2];
    let ox = 0, oy = 0, oz = 0;
    for (let k = 0; k < 4; k++) {
      const w = skinWeights[i * 4 + k];
      if (w === 0) continue;
      const o = skinJoints[i * 4 + k] * 12;
      // B·p = R·p + t
      ox += w * (skinMats[o] * px + skinMats[o + 1] * py + skinMats[o + 2] * pz + skinMats[o + 9]);
      oy += w * (skinMats[o + 3] * px + skinMats[o + 4] * py + skinMats[o + 5] * pz + skinMats[o + 10]);
      oz += w * (skinMats[o + 6] * px + skinMats[o + 7] * py + skinMats[o + 8] * pz + skinMats[o + 11]);
    }
    out[i * 3] = ox; out[i * 3 + 1] = oy; out[i * 3 + 2] = oz;
  }
  return out;
}

/** 叠加 FLAME 表情位移(原地修改 positions)。expr: 表情系数。 */
export function applyFlame(asset: AnimatableGSAsset, positions: Float32Array, expr: number[] | Float32Array) {
  if (!asset.meta.hasFlame || !asset.flameBasis || !asset.meta.flameDim) return;
  const n = asset.meta.count, D = asset.meta.flameDim, basis = asset.flameBasis;
  for (let i = 0; i < n; i++) {
    let dx = 0, dy = 0, dz = 0;
    const bo = i * 3 * D;
    for (let d = 0; d < D; d++) {
      const e = expr[d] || 0;
      if (e === 0) continue;
      dx += e * basis[bo + d];
      dy += e * basis[bo + D + d];
      dz += e * basis[bo + 2 * D + d];
    }
    positions[i * 3] += dx; positions[i * 3 + 1] += dy; positions[i * 3 + 2] += dz;
  }
}

/**
 * GPU 路径:LBS 计算着色器(WGSL)。
 * 绑定:0 restPos(count*3) | 1 skinJoints(count*4 u32) | 2 skinWeights(count*4 f32)
 *       3 skinMats(joint*12 f32) | 4 outPos(count*3) | 5 uniforms{count}
 * 集成点:把渲染器(aholo)的高斯位置 buffer 设为 outPos,每帧 dispatch 后重排序+绘制。
 */
export const WGSL_LBS = /* wgsl */ `
struct U { count: u32 };
@group(0) @binding(0) var<storage, read> restPos: array<f32>;
@group(0) @binding(1) var<storage, read> skinJoints: array<u32>;
@group(0) @binding(2) var<storage, read> skinWeights: array<f32>;
@group(0) @binding(3) var<storage, read> skinMats: array<f32>; // joint*12
@group(0) @binding(4) var<storage, read_write> outPos: array<f32>;
@group(0) @binding(5) var<uniform> u: U;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= u.count) { return; }
  let px = restPos[i*3u]; let py = restPos[i*3u+1u]; let pz = restPos[i*3u+2u];
  var o = vec3<f32>(0.0, 0.0, 0.0);
  for (var k: u32 = 0u; k < 4u; k = k + 1u) {
    let w = skinWeights[i*4u + k];
    if (w == 0.0) { continue; }
    let b = skinJoints[i*4u + k] * 12u;
    o.x = o.x + w * (skinMats[b]*px    + skinMats[b+1u]*py  + skinMats[b+2u]*pz  + skinMats[b+9u]);
    o.y = o.y + w * (skinMats[b+3u]*px + skinMats[b+4u]*py  + skinMats[b+5u]*pz  + skinMats[b+10u]);
    o.z = o.z + w * (skinMats[b+6u]*px + skinMats[b+7u]*py  + skinMats[b+8u]*pz  + skinMats[b+11u]);
  }
  outPos[i*3u] = o.x; outPos[i*3u+1u] = o.y; outPos[i*3u+2u] = o.z;
}
`;
