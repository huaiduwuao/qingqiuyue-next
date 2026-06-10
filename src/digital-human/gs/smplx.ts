/**
 * SMPL-X 前向运动学 + LBS 蒙皮矩阵。
 * 输入:逐关节 axis-angle 姿态 + 静止关节位置 + 父关节表
 * 输出:每关节的蒙皮矩阵 B_j(3x4,把"静止空间点"变换到"当前姿态"),供 deformer 用。
 *
 * 公式(标准 SMPL):posed = Σ w_j · (G_j · G_j^rest⁻¹) · p_rest
 *   G_j^rest = translate(J_j),逆 = translate(-J_j)
 *   → B_j 作用于 p:  R_Gj·p + (t_Gj − R_Gj·J_j)
 */

// 3x3 行主序
function rodrigues(ax: number, ay: number, az: number): number[] {
  const theta = Math.hypot(ax, ay, az);
  if (theta < 1e-8) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const x = ax / theta, y = ay / theta, z = az / theta;
  const c = Math.cos(theta), s = Math.sin(theta), C = 1 - c;
  return [
    c + x * x * C, x * y * C - z * s, x * z * C + y * s,
    y * x * C + z * s, c + y * y * C, y * z * C - x * s,
    z * x * C - y * s, z * y * C + x * s, c + z * z * C,
  ];
}

function mat3mul(a: number[], b: number[]): number[] {
  const o = new Array(9);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}
function mat3vec(m: number[], x: number, y: number, z: number): [number, number, number] {
  return [
    m[0] * x + m[1] * y + m[2] * z,
    m[3] * x + m[4] * y + m[5] * z,
    m[6] * x + m[7] * y + m[8] * z,
  ];
}

/**
 * @param pose       jointCount*3 axis-angle(根关节也在内,索引 0)
 * @param restJoints jointCount*3 静止全局关节位置
 * @param parents    jointCount 父索引(根为 -1;要求父索引 < 子索引,SMPL 满足)
 * @returns          jointCount*12 蒙皮矩阵 [R(9), t(3)] per joint
 */
export function computeSkinningMatrices(
  pose: Float32Array | number[],
  restJoints: Float32Array,
  parents: Int32Array,
): Float32Array {
  const J = parents.length;
  const Gr: number[][] = new Array(J); // 全局旋转 3x3
  const Gt: number[][] = new Array(J); // 全局平移 3
  const out = new Float32Array(J * 12);

  for (let j = 0; j < J; j++) {
    const R = rodrigues(pose[j * 3] || 0, pose[j * 3 + 1] || 0, pose[j * 3 + 2] || 0);
    const Jj: [number, number, number] = [restJoints[j * 3], restJoints[j * 3 + 1], restJoints[j * 3 + 2]];
    const p = parents[j];
    if (p < 0) {
      Gr[j] = R;
      Gt[j] = [Jj[0], Jj[1], Jj[2]];
    } else {
      // 局部平移 = J_j - J_parent
      const Jp: [number, number, number] = [restJoints[p * 3], restJoints[p * 3 + 1], restJoints[p * 3 + 2]];
      const localT: [number, number, number] = [Jj[0] - Jp[0], Jj[1] - Jp[1], Jj[2] - Jp[2]];
      Gr[j] = mat3mul(Gr[p], R);
      const rotT = mat3vec(Gr[p], localT[0], localT[1], localT[2]);
      Gt[j] = [Gt[p][0] + rotT[0], Gt[p][1] + rotT[1], Gt[p][2] + rotT[2]];
    }
    // B_j: t = Gt - Gr·J_j
    const rj = mat3vec(Gr[j], Jj[0], Jj[1], Jj[2]);
    const o = j * 12;
    for (let k = 0; k < 9; k++) out[o + k] = Gr[j][k];
    out[o + 9] = Gt[j][0] - rj[0];
    out[o + 10] = Gt[j][1] - rj[1];
    out[o + 11] = Gt[j][2] - rj[2];
  }
  return out;
}
