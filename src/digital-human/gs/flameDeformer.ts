/**
 * flameDeformer — FLAME blendshape 变形
 *
 * 对 Gaussian 点云应用 FLAME 表情 blendshapes。
 * 公式: jointDeltas = sum(e_d * flameBasis[d]), d ∈ [0, D)
 *        gaussianDeltas = LBS(jointDeltas)
 *
 * FLAME 是 SMPL-X 的面部子模型 (50 维表情空间)。
 */

import type { SkinningInput } from './lbsDeformer';

/**
 * FLAME blendshape 变形输入。
 */
export interface FlameInput {
  /** FLAME basis: J*3 * D (扁平数组, D 个 blendshape, 每个 J*3 个 float) */
  flameBasis: Float32Array;
  /** 表情权重 (D floats, 通常 -2..2) */
  expressionWeights: Float32Array;
  /** 关节数量 */
  jointCount: number;
  /** FLAME 维度 */
  flameDim: number;
}

/**
 * 应用 FLAME blendshape 到关节位置。
 *
 * 输出: 新的 joint 位置 (J*3), 可直接作为 LBS restJoints 使用。
 *
 * @param flame        — FLAME basis + expression weights
 * @param baseJoints   — 原始的 restJoints (J*3)
 */
export function applyFlameToJoints(
  flame: FlameInput,
  baseJoints: Float32Array,
): Float32Array {
  const { flameBasis, expressionWeights, jointCount, flameDim } = flame;
  const D = Math.min(flameDim, expressionWeights.length);

  const result = new Float32Array(jointCount * 3);
  result.set(baseJoints); // copy base

  // flameBasis 布局: [D][J*3] → 每个 dimension 有 J*3 个偏移量
  for (let d = 0; d < D; d++) {
    const weight = expressionWeights[d];
    if (Math.abs(weight) < 0.0001) continue;

    const dimOffset = d * jointCount * 3;
    for (let j = 0; j < jointCount; j++) {
      result[j * 3] += weight * flameBasis[dimOffset + j * 3];
      result[j * 3 + 1] += weight * flameBasis[dimOffset + j * 3 + 1];
      result[j * 3 + 2] += weight * flameBasis[dimOffset + j * 3 + 2];
    }
  }

  return result;
}

/**
 * 完整的 FLAME 驱动变形:
 *   1) 表情权重 → 关节位置偏移
 *   2) 原始 pose → joint transforms
 *   3) LBS 变形 gaussians
 *
 * @returns 变形后的 gaussian 位置 (count * 3)
 */
export function flameDeformGaussians(
  flame: FlameInput,
  baseJoints: Float32Array,
  pose: Float32Array,
  parents: Int32Array,
  basePositions: Float32Array,
  skinning: SkinningInput,
  count: number,
): Float32Array {
  // 1) 表情 → 关节位移
  const deformedJoints = applyFlameToJoints(flame, baseJoints);
  const J = parents.length;

  // 2) pose → joint transforms
  const jointMats = new Float32Array(J * 16);
  // 使用 deformedJoints 作为 restJoints
  computeJointTransformsInPlace(pose, deformedJoints, parents, jointMats);

  // 3) LBS
  const outPos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const px = basePositions[i * 3], py = basePositions[i * 3 + 1], pz = basePositions[i * 3 + 2];
    let tx = 0, ty = 0, tz = 0;

    for (let k = 0; k < 4; k++) {
      const j = skinning.joints[i * 4 + k];
      const w = skinning.weights[i * 4 + k];
      if (j >= J || w <= 0) continue;

      const m = j * 16;
      tx += w * (jointMats[m] * px + jointMats[m + 4] * py + jointMats[m + 8] * pz + jointMats[m + 12]);
      ty += w * (jointMats[m + 1] * px + jointMats[m + 5] * py + jointMats[m + 9] * pz + jointMats[m + 13]);
      tz += w * (jointMats[m + 2] * px + jointMats[m + 6] * py + jointMats[m + 10] * pz + jointMats[m + 14]);
    }

    outPos[i * 3] = tx;
    outPos[i * 3 + 1] = ty;
    outPos[i * 3 + 2] = tz;
  }

  return outPos;
}

// ─── Inline replica (避免循环依赖 lbsDeformer) ───

function computeJointTransformsInPlace(
  pose: Float32Array,
  restJoints: Float32Array,
  parents: Int32Array,
  outMats: Float32Array,
): void {
  const J = parents.length;
  for (let j = 0; j < J; j++) {
    const rx = pose[j * 3] || 0, ry = pose[j * 3 + 1] || 0, rz = pose[j * 3 + 2] || 0;
    const tx = restJoints[j * 3] || 0, ty = restJoints[j * 3 + 1] || 0, tz = restJoints[j * 3 + 2] || 0;

    const angle = Math.sqrt(rx * rx + ry * ry + rz * rz);
    let R00 = 1, R01 = 0, R02 = 0, R10 = 0, R11 = 1, R12 = 0, R20 = 0, R21 = 0, R22 = 1;

    if (angle > 0.0001) {
      const ax = rx / angle, ay = ry / angle, az = rz / angle;
      const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
      R00 = ax * ax * t + c;       R01 = ax * ay * t - az * s;  R02 = ax * az * t + ay * s;
      R10 = ay * ax * t + az * s;  R11 = ay * ay * t + c;       R12 = ay * az * t - ax * s;
      R20 = az * ax * t - ay * s;  R21 = az * ay * t + ax * s;  R22 = az * az * t + c;
    }

    const m = j * 16;
    outMats[m] = R00;  outMats[m + 4] = R01;  outMats[m + 8]  = R02;  outMats[m + 12] = tx;
    outMats[m + 1] = R10; outMats[m + 5] = R11; outMats[m + 9]  = R12; outMats[m + 13] = ty;
    outMats[m + 2] = R20; outMats[m + 6] = R21; outMats[m + 10] = R22; outMats[m + 14] = tz;
    outMats[m + 15] = 1;
  }

  for (let j = 1; j < J; j++) {
    const p = parents[j];
    if (p < 0 || p >= J) continue;
    const tmp = new Float32Array(16);
    const a = p * 16, b = j * 16;
    for (let i = 0; i < 4; i++) {
      for (let jj = 0; jj < 4; jj++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += outMats[a + k * 4 + i] * outMats[b + jj * 4 + k];
        tmp[jj * 4 + i] = sum;
      }
    }
    outMats.set(tmp, b);
  }
}
