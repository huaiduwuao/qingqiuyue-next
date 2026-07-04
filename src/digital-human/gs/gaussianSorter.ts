/**
 * gaussianSorter — 深度排序引擎
 *
 * 3DGS 需要严格 front-to-back 渲染 (alpha blending 依赖顺序)。
 * 对于 ≤200k gaussians, CPU 基数排序足够快 (<5ms)。
 */

/**
 * 用 view-projection 矩阵对 gaussians 按深度排序。
 * 返回排序后的索引数组 (由远到近, front-to-back)。
 */
export function sortGaussiansByDepth(
  positions: Float32Array,
  count: number,
  viewMatrix: Float32Array,    // 4x4 column-major (Three.js 格式)
): Uint32Array {
  // 计算每个 gaussian 的视图空间 z (越小越近 → Three.js camera view space: -z = forward)
  const depths = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];
    // View space z
    depths[i] = -(viewMatrix[2] * px + viewMatrix[6] * py + viewMatrix[10] * pz + viewMatrix[14]);
  }

  // 创建索引 + 基数排序 (16-bit radix sort, 4 passes)
  const indices = new Uint32Array(count);
  for (let i = 0; i < count; i++) indices[i] = i;

  // 把深度范围映射到 16-bit
  let dMin = Infinity, dMax = -Infinity;
  for (let i = 0; i < count; i++) {
    if (depths[i] < dMin) dMin = depths[i];
    if (depths[i] > dMax) dMax = depths[i];
  }
  const dRange = dMax - dMin || 1;

  // 量化到 0..65535
  const quantized = new Uint16Array(count);
  for (let i = 0; i < count; i++) {
    quantized[i] = Math.floor(((depths[i] - dMin) / dRange) * 65535);
  }

  // 基数排序 (LSD, 16-bit → 2 pass 8-bit)
  radixSortU16(indices, quantized, count);

  return indices;
}

/**
 * 对 Uint16 keys 做 LSD 基数排序 (原地)。
 */
function radixSortU16(
  indices: Uint32Array,
  keys: Uint16Array,
  count: number,
): void {
  const temp = new Uint32Array(count);
  const bucket = new Uint32Array(256);

  // Pass 1: low byte
  bucket.fill(0);
  for (let i = 0; i < count; i++) {
    bucket[keys[i] & 0xFF]++;
  }
  for (let i = 1; i < 256; i++) {
    bucket[i] += bucket[i - 1];
  }
  for (let i = count - 1; i >= 0; i--) {
    const b = keys[indices[i]] & 0xFF;
    temp[--bucket[b]] = indices[i];
  }

  // Pass 2: high byte
  bucket.fill(0);
  for (let i = 0; i < count; i++) {
    bucket[(keys[temp[i]] >> 8) & 0xFF]++;
  }
  for (let i = 1; i < 256; i++) {
    bucket[i] += bucket[i - 1];
  }
  for (let i = count - 1; i >= 0; i--) {
    const b = (keys[temp[i]] >> 8) & 0xFF;
    indices[--bucket[b]] = temp[i];
  }
}

/**
 * 快速近似排序 (对于 >500k gaussians)。
 * 使用分桶策略: 把空间分成 16 个深度桶, 桶内不排序。
 */
export function sortGaussiansFast(
  positions: Float32Array,
  count: number,
  viewMatrix: Float32Array,
): Uint32Array {
  const buckets: number[][] = Array.from({ length: 16 }, () => []);

  // 计算深度范围
  let dMin = Infinity, dMax = -Infinity;
  for (let i = 0; i < Math.min(count, 50000); i++) {  // 采样估算
    const z = -(viewMatrix[2] * positions[i * 3] + viewMatrix[6] * positions[i * 3 + 1] + viewMatrix[10] * positions[i * 3 + 2] + viewMatrix[14]);
    if (z < dMin) dMin = z;
    if (z > dMax) dMax = z;
  }
  const dRange = dMax - dMin || 1;

  // 分桶
  for (let i = 0; i < count; i++) {
    const z = -(viewMatrix[2] * positions[i * 3] + viewMatrix[6] * positions[i * 3 + 1] + viewMatrix[10] * positions[i * 3 + 2] + viewMatrix[14]);
    const b = Math.min(15, Math.floor(((z - dMin) / dRange) * 16));
    buckets[b].push(i);
  }

  // 合并 (远处先 → front-to-back = 远处先渲染, 近处覆盖)
  const result = new Uint32Array(count);
  let offset = 0;
  for (let b = 15; b >= 0; b--) {
    for (const idx of buckets[b]) {
      result[offset++] = idx;
    }
  }
  return result;
}
