/**
 * gaussianLoader — 从 URL/文件加载 3DGS 资产
 */

import type { MetaJSON, SMPLXJSON, GaussianAsset, SkinningData } from './assetFormat';
import { parseGaussianBinary, parseSkinningBinary } from './assetFormat';

export interface LoadOptions {
  /** gaussians.bin 或 .ply URL */
  assetUrl: string;
  /** skinning.bin URL (可选) */
  skinningUrl?: string;
  /** smplx.json URL (可选) */
  smplxUrl?: string;
  /** meta.json URL (可选, 不传则从 assetUrl 推断) */
  metaUrl?: string;
  /** 加载进度回调 */
  onProgress?: (loaded: number, total: number) => void;
}

/**
 * 从 URL 加载完整 Gaussian 资产。
 */
export async function loadGaussianAsset(opts: LoadOptions): Promise<GaussianAsset> {
  const { assetUrl, skinningUrl, smplxUrl, metaUrl, onProgress } = opts;

  // 推断 meta.json URL
  const base = assetUrl.replace(/\/[^/]+$/, '');
  const metaURL = metaUrl || `${base}/meta.json`;

  let completed = 0;
  const total = 1 + (skinningUrl ? 1 : 0) + (smplxUrl ? 1 : 0);
  const tick = () => {
    completed++;
    onProgress?.(completed, total);
  };

  // 1) meta.json
  const metaResp = await fetch(metaURL);
  if (!metaResp.ok) throw new Error(`meta.json fetch failed: ${metaResp.status}`);
  const meta: MetaJSON = await metaResp.json();
  tick();

  // 2) gaussians.bin
  const gaResp = await fetch(assetUrl);
  if (!gaResp.ok) throw new Error(`gaussians.bin fetch failed: ${gaResp.status}`);
  const gaBuffer = await gaResp.arrayBuffer();
  const asset = parseGaussianBinary(gaBuffer, meta);
  if (!asset) throw new Error('gaussians.bin 解析失败');
  tick();

  // 3) skinning.bin (可选)
  if (skinningUrl) {
    try {
      const skResp = await fetch(skinningUrl);
      if (skResp.ok) {
        const skBuffer = await skResp.arrayBuffer();
        const skinning = parseSkinningBinary(skBuffer, meta.count);
        if (skinning) asset.skinning = skinning;
      }
    } catch {
      console.warn('[gaussianLoader] skinning.bin 加载失败, 继续无蒙皮');
    }
    tick();
  }

  // 4) smplx.json (可选)
  if (smplxUrl) {
    try {
      const smplxResp = await fetch(smplxUrl);
      if (smplxResp.ok) {
        const smplx: SMPLXJSON = await smplxResp.json();
        asset.smplx = smplx;
        // 更新 jointCount (meta 可能没填)
        asset.meta.jointCount = smplx.parents.length;
        asset.meta.hasFlame = !!(smplx.flameBasis && smplx.flameBasis.length > 0);
        asset.meta.flameDim = smplx.flameDim || 0;
      }
    } catch {
      console.warn('[gaussianLoader] smplx.json 加载失败, 无参数化模型');
    }
    tick();
  }

  return asset;
}

/**
 * 从 .ply 文件加载 Gaussian (简单解析, 仅支持 gsplat 兼容格式)。
 * 作为备选, 当没有 .bin 时使用。
 */
export async function loadPLY(url: string): Promise<GaussianAsset> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`ply fetch failed: ${resp.status}`);
  const text = await resp.text();

  // 解析 PLY header
  const lines = text.split('\n');
  let vertexCount = 0;
  let headerEnd = 0;
  const props: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('element vertex ')) {
      vertexCount = parseInt(line.split(' ')[2], 10);
    } else if (line.startsWith('property float ')) {
      props.push(line.split(' ')[2]);
    } else if (line === 'end_header') {
      headerEnd = i + 1;
      break;
    }
  }

  if (!vertexCount || props.length < 3) {
    throw new Error(`Invalid PLY: vertices=${vertexCount}, props=${props.length}`);
  }

  // 找 x/y/z 索引
  const xIdx = props.indexOf('x');
  const yIdx = props.indexOf('y');
  const zIdx = props.indexOf('z');
  const opacityIdx = props.indexOf('opacity');
  const scale0Idx = props.indexOf('scale_0');
  const rot0Idx = props.indexOf('rot_0');
  const fDc0Idx = props.indexOf('f_dc_0');

  const count = vertexCount;
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);
  const opacities = new Float32Array(count);
  const shCoeffs = new Float32Array(count * 48);

  for (let i = 0; i < count; i++) {
    const vals = lines[headerEnd + i].trim().split(/\s+/).map(Number);

    positions[i * 3] = vals[xIdx] || 0;
    positions[i * 3 + 1] = vals[yIdx] || 0;
    positions[i * 3 + 2] = vals[zIdx] || 0;

    opacities[i] = opacityIdx >= 0 ? vals[opacityIdx] : 0.9;

    if (scale0Idx >= 0) {
      scales[i * 3] = vals[scale0Idx] || -5;
      scales[i * 3 + 1] = vals[scale0Idx + 1] || -5;
      scales[i * 3 + 2] = vals[scale0Idx + 2] || -5;
    }

    if (rot0Idx >= 0) {
      rotations[i * 4] = vals[rot0Idx] || 0;
      rotations[i * 4 + 1] = vals[rot0Idx + 1] || 0;
      rotations[i * 4 + 2] = vals[rot0Idx + 2] || 0;
      rotations[i * 4 + 3] = vals[rot0Idx + 3] || 1;
    }

    if (fDc0Idx >= 0) {
      for (let j = 0; j < Math.min(48, props.length - fDc0Idx); j++) {
        shCoeffs[i * 48 + j] = vals[fDc0Idx + j] || 0;
      }
    }
  }

  return {
    count,
    positions,
    scales,
    rotations,
    opacities,
    shCoeffs,
    meta: { count, jointCount: 0, hasFlame: false, up: 'y' },
  };
}
