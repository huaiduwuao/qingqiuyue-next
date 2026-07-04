/**
 * lbsDeformer — Linear Blend Skinning 变形引擎
 *
 * 对 Gaussian 点云应用 SMPL-X 骨骼动画。
 * 输入: base positions + skinning data + joint transforms → 变形后的 positions
 *
 * 性能: 对于 <50k gaussians, 主线程计算 <8ms。
 *       对于 >50k gaussians, 建议用 Web Worker。
 */

export interface SkinningInput {
  joints: Uint16Array;       // count * 4 (top-4 joint indices)
  weights: Float32Array;     // count * 4 (top-4 weights, sum≈1)
}

export interface SkeletonInput {
  parents: Int32Array;        // J (joint parent indices, root=-1)
  restJoints: Float32Array;   // J * 3 (rest pose joint positions)
}

export interface DeformOutput {
  positions: Float32Array;    // count * 3 (deformed positions)
  rotations?: Float32Array;   // count * 4 (deformed gaussian rotations, 可选)
}

/**
 * axis-angle → 3x3 rotation matrix (Rodrigues formula)
 */
export function axisAngleToMat3(rx: number, ry: number, rz: number): Float32Array {
  const m = new Float32Array(9);
  const angle = Math.sqrt(rx * rx + ry * ry + rz * rz);

  if (angle < 0.0001) {
    m[0] = 1; m[4] = 1; m[8] = 1;
    return m;
  }

  const ax = rx / angle, ay = ry / angle, az = rz / angle;
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;

  m[0] = ax * ax * t + c;
  m[1] = ax * ay * t - az * s;
  m[2] = ax * az * t + ay * s;

  m[3] = ay * ax * t + az * s;
  m[4] = ay * ay * t + c;
  m[5] = ay * az * t - ax * s;

  m[6] = az * ax * t - ay * s;
  m[7] = az * ay * t + ax * s;
  m[8] = az * az * t + c;

  return m;
}

/**
 * 构建 4x4 关节变换矩阵 (3x3 rotation + translation)。
 */
export function buildJointTransform(
  rx: number, ry: number, rz: number,
  tx: number, ty: number, tz: number,
  out: Float32Array,  // [16]
): void {
  const R = axisAngleToMat3(rx, ry, rz);
  out.fill(0);
  out[0] = R[0]; out[1] = R[1]; out[2] = R[2];  out[3] = tx;
  out[4] = R[3]; out[5] = R[4]; out[6] = R[5];  out[7] = ty;
  out[8] = R[6]; out[9] = R[7]; out[10] = R[8]; out[11] = tz;
  out[15] = 1;
}

/**
 * 4x4 矩阵乘法: C = A * B (均以 16 float 数组, column-major)
 * out 可能与 A 或 B 相同 (in-place 安全)
 */
export function mulMat4(
  a: Float32Array, aOff: number,
  b: Float32Array, bOff: number,
  out: Float32Array, outOff: number,
): void {
  const tmp = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[aOff + k * 4 + i] * b[bOff + j * 4 + k];
      }
      tmp[j * 4 + i] = sum;
    }
  }
  out.set(tmp, outOff);
}

/**
 * 从 pose (J*3 axis-angle) 计算所有关节的全局变换矩阵。
 *
 * @param pose        — J*3 axis-angle rotations
 * @param restJoints  — J*3 rest pose positions
 * @param parents     — J parent indices
 * @param outMats     — J*16 输出 (4x4 matrices, column-major)
 */
export function computeJointTransforms(
  pose: Float32Array,
  restJoints: Float32Array,
  parents: Int32Array,
  outMats: Float32Array,   // J * 16
): void {
  const J = parents.length;

  // Step 1: 每关节的 local transform
  for (let j = 0; j < J; j++) {
    const rx = pose[j * 3] || 0;
    const ry = pose[j * 3 + 1] || 0;
    const rz = pose[j * 3 + 2] || 0;
    const tx = restJoints[j * 3] || 0;
    const ty = restJoints[j * 3 + 1] || 0;
    const tz = restJoints[j * 3 + 2] || 0;

    buildJointTransform(rx, ry, rz, tx, ty, tz, outMats.subarray(j * 16, j * 16 + 16));
  }

  // Step 2: 级联变换 (parent chain)
  for (let j = 1; j < J; j++) {
    const p = parents[j];
    if (p < 0 || p >= J) continue;
    mulMat4(outMats, p * 16, outMats, j * 16, outMats, j * 16);
  }
}

/**
 * 对 Gaussian 点云做 LBS 变形。
 *
 * @param positions    — count * 3 base positions
 * @param skinning     — skinning data (joints + weights)
 * @param jointMats    — J * 16 global joint transforms (from computeJointTransforms)
 * @param count        — number of gaussians
 * @param J            — number of joints
 */
export function deformGaussians(
  positions: Float32Array,
  skinning: SkinningInput,
  jointMats: Float32Array,
  count: number,
  J: number,
): DeformOutput {
  const outPos = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const px = positions[i * 3], py = positions[i * 3 + 1], pz = positions[i * 3 + 2];
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

  return { positions: outPos };
}

/**
 * 对 Gaussian 旋转做 LBS (可选 — 视觉差异小, 可省略以省性能)。
 */
export function deformGaussianRotations(
  rotations: Float32Array,     // count * 4 (quaternions)
  skinning: SkinningInput,
  jointMats: Float32Array,
  count: number,
  J: number,
): Float32Array {
  const outRot = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    // 提取 blended rotation 的 3x3 部分, 转回四元数
    let r00 = 0, r01 = 0, r02 = 0;
    let r10 = 0, r11 = 0, r12 = 0;
    let r20 = 0, r21 = 0, r22 = 0;

    for (let k = 0; k < 4; k++) {
      const j = skinning.joints[i * 4 + k];
      const w = skinning.weights[i * 4 + k];
      if (j >= J || w <= 0) continue;

      const m = j * 16;
      r00 += w * jointMats[m];     r01 += w * jointMats[m + 4];  r02 += w * jointMats[m + 8];
      r10 += w * jointMats[m + 1]; r11 += w * jointMats[m + 5];  r12 += w * jointMats[m + 9];
      r20 += w * jointMats[m + 2]; r21 += w * jointMats[m + 6];  r22 += w * jointMats[m + 10];
    }

    // 3x3 → quaternion (含 4.0 normalize)
    const trace = r00 + r11 + r22;
    let qx: number, qy: number, qz: number, qw: number;

    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1);
      qw = 0.25 / s;
      qx = (r21 - r12) * s;
      qy = (r02 - r20) * s;
      qz = (r10 - r01) * s;
    } else if (r00 > r11 && r00 > r22) {
      const s = 2 * Math.sqrt(1 + r00 - r11 - r22);
      qw = (r21 - r12) / s;
      qx = 0.25 * s;
      qy = (r01 + r10) / s;
      qz = (r02 + r20) / s;
    } else if (r11 > r22) {
      const s = 2 * Math.sqrt(1 + r11 - r00 - r22);
      qw = (r02 - r20) / s;
      qx = (r01 + r10) / s;
      qy = 0.25 * s;
      qz = (r12 + r21) / s;
    } else {
      const s = 2 * Math.sqrt(1 + r22 - r00 - r11);
      qw = (r10 - r01) / s;
      qx = (r02 + r20) / s;
      qy = (r12 + r21) / s;
      qz = 0.25 * s;
    }

    const orig = rotations.subarray(i * 4, i * 4 + 4);
    outRot[i * 4] = qx;  // 直接替换(不 blend with 原始 rotation)
    outRot[i * 4 + 1] = qy;
    outRot[i * 4 + 2] = qz;
    outRot[i * 4 + 3] = qw;
  }

  return outRot;
}
