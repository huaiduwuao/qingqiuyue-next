/**
 * 可驱动高斯资产格式(训练导出 → 前端加载)。
 * 见 AVATAR-TRAINING.md 第 4 节。
 */

export interface AnimatableGSMeta {
  count: number;        // 高斯点数
  jointCount: number;   // SMPL-X 关节数(含手/脸,通常 55)
  hasFlame: boolean;    // 是否带 FLAME 表情基(驱动口型/表情)
  up: 'y' | '-y';       // 坐标系朝上
  flameDim?: number;    // 表情系数维度(如 50/100)
}

export interface AnimatableGSAsset {
  meta: AnimatableGSMeta;
  // 高斯属性(静止姿态 / rest space)
  position: Float32Array;   // count*3
  scale: Float32Array;      // count*3
  rotation: Float32Array;   // count*4 (quaternion xyzw)
  opacity: Float32Array;    // count
  sh: Float32Array;         // count*shDim (球谐颜色)
  shDim: number;
  // LBS 蒙皮:每点最多 4 个关节
  skinJoints: Uint16Array;  // count*4 关节索引
  skinWeights: Float32Array;// count*4 权重(和为1)
  // SMPL-X 模板
  parents: Int32Array;          // jointCount,父关节索引(根为 -1)
  restJoints: Float32Array;     // jointCount*3,静止关节全局位置
  // 可选:FLAME 表情基(对脸部点的位移),expr 系数 × 基 = 位移
  flameBasis?: Float32Array;    // count*3*flameDim(稀疏存储更好,这里简化)
}

async function fetchBin(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`load ${url}: ${r.status}`);
  return r.arrayBuffer();
}

/** 从 assetUrl 目录加载(gaussians.bin / skinning.bin / smplx.json / meta.json) */
export async function loadAnimatableGS(baseUrl: string): Promise<AnimatableGSAsset> {
  const base = baseUrl.replace(/\/?$/, '/');
  const meta: AnimatableGSMeta = await (await fetch(base + 'meta.json')).json();
  const smplx = await (await fetch(base + 'smplx.json')).json();
  const gBuf = await fetchBin(base + 'gaussians.bin');
  const sBuf = await fetchBin(base + 'skinning.bin');

  const n = meta.count;
  const shDim = 48; // SH degree 3: 3*16
  // gaussians.bin 布局: [pos3, scale3, rot4, opacity1, sh48] * n
  const stride = 3 + 3 + 4 + 1 + shDim;
  const g = new Float32Array(gBuf);
  const position = new Float32Array(n * 3);
  const scale = new Float32Array(n * 3);
  const rotation = new Float32Array(n * 4);
  const opacity = new Float32Array(n);
  const sh = new Float32Array(n * shDim);
  for (let i = 0; i < n; i++) {
    const o = i * stride;
    position.set(g.subarray(o, o + 3), i * 3);
    scale.set(g.subarray(o + 3, o + 6), i * 3);
    rotation.set(g.subarray(o + 6, o + 10), i * 4);
    opacity[i] = g[o + 10];
    sh.set(g.subarray(o + 11, o + 11 + shDim), i * shDim);
  }

  // skinning.bin 布局: [j0,j1,j2,j3 (uint16), w0,w1,w2,w3 (float32)] * n
  const skinJoints = new Uint16Array(n * 4);
  const skinWeights = new Float32Array(n * 4);
  const dv = new DataView(sBuf);
  const sStride = 4 * 2 + 4 * 4; // 8 + 16 bytes
  for (let i = 0; i < n; i++) {
    const o = i * sStride;
    for (let k = 0; k < 4; k++) skinJoints[i * 4 + k] = dv.getUint16(o + k * 2, true);
    for (let k = 0; k < 4; k++) skinWeights[i * 4 + k] = dv.getFloat32(o + 8 + k * 4, true);
  }

  return {
    meta,
    position, scale, rotation, opacity, sh, shDim,
    skinJoints, skinWeights,
    parents: Int32Array.from(smplx.parents),
    restJoints: Float32Array.from(smplx.restJoints),
    flameBasis: smplx.flameBasis ? Float32Array.from(smplx.flameBasis) : undefined,
  };
}
