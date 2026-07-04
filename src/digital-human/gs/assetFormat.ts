/**
 * assetFormat — 3D Gaussian Splatting 资产二进制格式定义
 *
 * 对齐 convert-exavatar.py / convert_avatar_export.py 的输出。
 * 一个完整资产包含 4 个文件:
 *   gaussians.bin  — Gaussian 属性(pos/scale/rot/opacity/SH)
 *   skinning.bin   — 蒙皮数据(top-4 关节 + 权重)
 *   smplx.json     — 骨骼定义(parents + restJoints + flameBasis)
 *   meta.json      — 元信息
 */

// ─── Binary Layout ─────────────────────────────────────────────────────────
//
// gaussians.bin: 每个 Gaussian 59 个 float32 (LE):
//   [0..2]   位置 (x, y, z)
//   [3..5]   缩放 (sx, sy, sz) — log-space, exp 后使用
//   [6..9]   旋转 (qx, qy, qz, qw) — 四元数
//   [10]     不透明度 (0..1, sigmoid 后使用)
//   [11..58] SH 系数 (48 个: 1_DC + 3*1 + 5*1 + 7*1 + 9*1 + 11*1? 实际是 1+3+5+7+9+11+12 = 48 for degree 3)
//   = 59 floats = 236 bytes per gaussian
//
// skinning.bin: 每个 Gaussian 24 字节:
//   [0..7]   top-4 关节索引 (4 个 uint16 LE)
//   [8..23]  top-4 蒙皮权重 (4 个 float32 LE, sum=1)

export const GAUSSIAN_STRIDE_FLOATS = 59;
export const GAUSSIAN_STRIDE_BYTES = GAUSSIAN_STRIDE_FLOATS * 4; // 236

export const POS_OFFSET = 0;
export const SCALE_OFFSET = 3;
export const ROT_OFFSET = 6;
export const OPACITY_OFFSET = 10;
export const SH_OFFSET = 11;
export const SH_DIM = 48;

export const SKINNING_STRIDE_BYTES = 4 * 2 + 4 * 4; // 24 (4×uint16 + 4×float32)

// ─── meta.json ─────────────────────────────────────────────────────────────

export interface MetaJSON {
  count: number;       // Gaussian 数量
  jointCount: number;  // 骨骼关节数
  hasFlame: boolean;   // 是否有 FLAME blendshape
  up: string;          // 坐标系 up 方向
  flameDim?: number;   // FLAME 表情维度
  shDegree?: number;   // SH 阶数
  version?: string;    // 格式版本
}

// ─── smplx.json ────────────────────────────────────────────────────────────

export interface SMPLXJSON {
  parents: number[];        // 关节父子关系 (root=-1)
  restJoints: number[];     // 休息姿态关节位置 (J*3, xyz 扁平)
  flameBasis?: number[];    // FLAME blendshape basis (J*3 * D, 扁平)
  flameDim?: number;        // FLAME 维度
  jointNames?: string[];    // 关节名称
}

// ─── Pose / Expression 运行时类型 ──────────────────────────────────────────

/** 单帧: 关节旋转(axis-angle, J*3) + 表情权重(D floats) */
export interface PoseFrame {
  pose: Float32Array;          // J*3 axis-angle
  expressions?: Float32Array;  // D FLAME weights
  timestamp?: number;
}

/** 蒙皮数据(从 skinning.bin 解析) */
export interface SkinningData {
  joints: Uint16Array;    // count * 4
  weights: Float32Array;  // count * 4
}

/** 完整 Gaussian 资产(从文件加载) */
export interface GaussianAsset {
  count: number;
  positions: Float32Array;   // count * 3
  scales: Float32Array;      // count * 3
  rotations: Float32Array;   // count * 4
  opacities: Float32Array;   // count * 1
  shCoeffs: Float32Array;    // count * 48
  skinning?: SkinningData;
  smplx?: SMPLXJSON;
  meta: MetaJSON;
}

/**
 * 把 gaussians.bin 的 ArrayBuffer 解析成 GaussianAsset。
 * 返回 null 说明数据不完整。
 */
export function parseGaussianBinary(
  buffer: ArrayBuffer,
  meta: MetaJSON,
): GaussianAsset | null {
  const count = meta.count;
  const expectedBytes = count * GAUSSIAN_STRIDE_BYTES;
  if (buffer.byteLength < expectedBytes) {
    console.error(
      `[assetFormat] gaussians.bin 大小不匹配: got ${buffer.byteLength}, expected >= ${expectedBytes} (count=${count})`,
    );
    return null;
  }

  const data = new Float32Array(buffer, 0, count * GAUSSIAN_STRIDE_FLOATS);

  // 按 stride 提取各属性
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);
  const opacities = new Float32Array(count);
  const shCoeffs = new Float32Array(count * SH_DIM);

  for (let i = 0; i < count; i++) {
    const base = i * GAUSSIAN_STRIDE_FLOATS;
    // position
    positions[i * 3] = data[base + POS_OFFSET];
    positions[i * 3 + 1] = data[base + POS_OFFSET + 1];
    positions[i * 3 + 2] = data[base + POS_OFFSET + 2];
    // scale
    scales[i * 3] = data[base + SCALE_OFFSET];
    scales[i * 3 + 1] = data[base + SCALE_OFFSET + 1];
    scales[i * 3 + 2] = data[base + SCALE_OFFSET + 2];
    // rotation
    rotations[i * 4] = data[base + ROT_OFFSET];
    rotations[i * 4 + 1] = data[base + ROT_OFFSET + 1];
    rotations[i * 4 + 2] = data[base + ROT_OFFSET + 2];
    rotations[i * 4 + 3] = data[base + ROT_OFFSET + 3];
    // opacity
    opacities[i] = data[base + OPACITY_OFFSET];
    // SH
    for (let j = 0; j < SH_DIM; j++) {
      shCoeffs[i * SH_DIM + j] = data[base + SH_OFFSET + j];
    }
  }

  return { count, positions, scales, rotations, opacities, shCoeffs, meta };
}

/**
 * 解析 skinning.bin。
 */
export function parseSkinningBinary(
  buffer: ArrayBuffer,
  count: number,
): SkinningData | null {
  const expectedBytes = count * SKINNING_STRIDE_BYTES;
  if (buffer.byteLength < expectedBytes) {
    console.error('[assetFormat] skinning.bin 大小不匹配');
    return null;
  }

  const joints = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);

  const raw = new Uint8Array(buffer);
  for (let i = 0; i < count; i++) {
    const base = i * SKINNING_STRIDE_BYTES;
    joints[i * 4] = raw[base] | (raw[base + 1] << 8);
    joints[i * 4 + 1] = raw[base + 2] | (raw[base + 3] << 8);
    joints[i * 4 + 2] = raw[base + 4] | (raw[base + 5] << 8);
    joints[i * 4 + 3] = raw[base + 6] | (raw[base + 7] << 8);

    const wOff = base + 8;
    weights[i * 4] = new DataView(buffer).getFloat32(wOff, true);
    weights[i * 4 + 1] = new DataView(buffer).getFloat32(wOff + 4, true);
    weights[i * 4 + 2] = new DataView(buffer).getFloat32(wOff + 8, true);
    weights[i * 4 + 3] = new DataView(buffer).getFloat32(wOff + 12, true);
  }

  return { joints, weights };
}
