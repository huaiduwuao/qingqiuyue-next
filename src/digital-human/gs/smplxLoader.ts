/**
 * smplxLoader — SMPL-X / FLAME 参数化模型加载器
 *
 * 从 smplx.json 加载骨骼定义, 支持:
 *   - parents: 关节父子关系
 *   - restJoints: 休息姿态关节位置
 *   - flameBasis: FLAME blendshape basis (可选)
 */

export interface SMPLXData {
  /** 关节父子关系 (root=-1) */
  parents: Int32Array;
  /** 休息姿态关节位置 (J * 3, xyz 扁平) */
  restJoints: Float32Array;
  /** 关节数量 */
  jointCount: number;
  /** FLAME blendshape basis (J*3 * D, 扁平), 可选 */
  flameBasis?: Float32Array;
  /** FLAME 表情维度 */
  flameDim: number;
  /** 关节名称 (可选) */
  jointNames?: string[];
}

export interface SMPLXLoadResult {
  data: SMPLXData;
  /** 警告信息 (如 license 提示) */
  warnings: string[];
}

/**
 * 从 smplx.json URL 加载参数化模型数据。
 */
export async function loadSMPLX(url: string): Promise<SMPLXLoadResult> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`smplx.json fetch failed: ${resp.status}`);

  const raw = await resp.json();
  const warnings: string[] = [];

  // 检查必要字段
  if (!Array.isArray(raw.parents)) {
    throw new Error('smplx.json 缺少 parents 字段');
  }
  if (!Array.isArray(raw.restJoints)) {
    throw new Error('smplx.json 缺少 restJoints 字段');
  }

  const jointCount = raw.parents.length;
  const expectedRestLen = jointCount * 3;
  if (raw.restJoints.length < expectedRestLen) {
    throw new Error(
      `restJoints 长度不匹配: got ${raw.restJoints.length}, expected ${expectedRestLen} (${jointCount} joints * 3)`,
    );
  }

  // License 提示
  warnings.push(
    '注意: SMPL-X/FLAME 模型需遵守 MPI Tübingen 的学术许可, 商用请自行确认合规',
  );

  const data: SMPLXData = {
    parents: new Int32Array(raw.parents),
    restJoints: new Float32Array(raw.restJoints),
    jointCount,
    flameDim: raw.flameDim || 0,
  };

  // FLAME basis (可选)
  if (Array.isArray(raw.flameBasis) && raw.flameBasis.length > 0) {
    const dim = raw.flameDim || 50;
    const expectedLen = jointCount * 3 * dim;
    if (raw.flameBasis.length >= expectedLen) {
      data.flameBasis = new Float32Array(raw.flameBasis);
      data.flameDim = dim;
    } else {
      warnings.push(
        `flameBasis 长度不匹配: got ${raw.flameBasis.length}, expected >= ${expectedLen} (joints*3*flameDim)`,
      );
    }
  }

  if (Array.isArray(raw.jointNames)) {
    data.jointNames = raw.jointNames;
  }

  return { data, warnings };
}

/**
 * 从 per-frame JSON 加载关键帧序列。
 * 格式: [{joints, pose, expression, camera}, ...]
 */
export interface KeyFrame {
  joints: Float32Array;      // J*3 关节位置
  pose: Float32Array;        // J*3 axis-angle
  expression?: Float32Array; // D FLAME weights
  camera?: Float32Array;     // [s, tx, ty]
}

export async function loadKeyFrames(url: string): Promise<KeyFrame[]> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Keyframe fetch failed: ${resp.status}`);
  const raw = await resp.json();
  if (!Array.isArray(raw)) throw new Error('Keyframe JSON 应为数组');

  return raw.map((f: any) => ({
    joints: f.joints ? new Float32Array(f.joints) : new Float32Array(0),
    pose: f.pose ? new Float32Array(f.pose) : new Float32Array(0),
    expression: f.expression ? new Float32Array(f.expression) : undefined,
    camera: f.camera ? new Float32Array(f.camera) : undefined,
  }));
}
