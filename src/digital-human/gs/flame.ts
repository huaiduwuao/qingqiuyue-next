/**
 * FLAME 表情基的 CPU 端数学。
 *
 * 资产约定(smplx.json.flameBasis):
 *   length = count * 3 * flameDim
 *   布局 [i, j*3+k, f] 描述第 i 个高斯点、第 f 个表情系数下、k∈{x,y,z} 的位移
 *   即 offset_i = Σ_f  expr[f] * flameBasis[i*flameDim*3 + f*3 + k]
 *
 * 用法:
 *   const offset = applyFlame(restCenter, flameBasis, expr);
 *   newCenter = restCenter + offset
 *
 * 没有 flameBasis 时返回零向量(等价于无表情)。
 */

export function applyFlame(
  restCenter: Float32Array,
  flameBasis: Float32Array,
  expr: Float32Array,
  out?: Float32Array,
): Float32Array {
  const n = restCenter.length / 3;
  const f = expr.length;
  const o = out ?? new Float32Array(n * 3);
  o.fill(0);
  if (!flameBasis || flameBasis.length < n * 3 * f) return o;
  for (let i = 0; i < n; i++) {
    let dx = 0, dy = 0, dz = 0;
    const base = i * 3 * f;
    for (let k = 0; k < f; k++) {
      const e = expr[k] || 0;
      const o2 = base + k * 3;
      dx += e * flameBasis[o2];
      dy += e * flameBasis[o2 + 1];
      dz += e * flameBasis[o2 + 2];
    }
    o[i * 3] = dx;
    o[i * 3 + 1] = dy;
    o[i * 3 + 2] = dz;
  }
  return o;
}

/**
 * 把 blendshapes 字典 / 数组 归一化成长度 flameDim 的表情向量。
 *   数字:直接当 expr 值(无对应字典时)
 *   字典:查找键名 → expr 索引(约定键名 = "f0"..."f49")
 *   越界:夹到 [0,1]
 */
export function blendshapesToExpr(
  blendshapes: Record<string, number> | number[] | undefined,
  flameDim: number,
): Float32Array {
  const out = new Float32Array(flameDim);
  if (!blendshapes) return out;
  if (Array.isArray(blendshapes)) {
    for (let i = 0; i < Math.min(flameDim, blendshapes.length); i++) {
      out[i] = Math.max(-1, Math.min(1, blendshapes[i] || 0));
    }
    return out;
  }
  for (const [k, v] of Object.entries(blendshapes)) {
    const m = k.match(/^f?(\d+)$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10);
    if (idx >= 0 && idx < flameDim) out[idx] = Math.max(-1, Math.min(1, v || 0));
  }
  return out;
}
