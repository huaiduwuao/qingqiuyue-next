/**
 * gs/ — 3D Gaussian Splatting 浏览器渲染与参数化模型驱动
 */

export { GaussianSplatRenderer as default } from './GaussianSplatRenderer';
export { GaussianSplatRenderer } from './GaussianSplatRenderer';
export type { GaussianSplatRendererProps, QualityMode } from './GaussianSplatRenderer';

export { loadGaussianAsset, loadPLY } from './gaussianLoader';
export type { LoadOptions } from './gaussianLoader';

export {
  parseGaussianBinary,
  parseSkinningBinary,
} from './assetFormat';
export type { MetaJSON, SMPLXJSON, GaussianAsset, SkinningData, PoseFrame } from './assetFormat';

export {
  deformGaussians,
  deformGaussianRotations,
  computeJointTransforms,
  axisAngleToMat3,
} from './lbsDeformer';
export type { SkinningInput, SkeletonInput, DeformOutput } from './lbsDeformer';

export { applyFlameToJoints, flameDeformGaussians } from './flameDeformer';
export type { FlameInput } from './flameDeformer';

export { loadSMPLX, loadKeyFrames } from './smplxLoader';
export type { SMPLXData, SMPLXLoadResult, KeyFrame } from './smplxLoader';

export { sortGaussiansByDepth, sortGaussiansFast } from './gaussianSorter';
