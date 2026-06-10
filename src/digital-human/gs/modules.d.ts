// 第三方高斯渲染器无官方类型声明,按 any 处理(运行时用真实 API)。
declare module '@mkkellogg/gaussian-splats-3d';

// Spark 本身有类型(./node_modules/@sparkjsdev/spark/dist/types/index.d.ts),
// 但 .d.ts 通过 dynamic import 进来时,TypeScript 不会自动把它们当 ESM 解析,
// 这里直接 re-export 我们用到的子集,确保 `import { SplatMesh } from '@sparkjsdev/spark'` 拿到的是类(可作为类型),不是 namespace。
declare module '@sparkjsdev/spark' {
  export { SplatMesh, SplatSkinning, SplatSkinningMode, SparkRenderer, ExtSplats } from '@sparkjsdev/spark/dist/types/index';
}
