// three.js 类型补充:GLTFLoader 路径不在 @types/three 中
declare module 'three/examples/jsm/loaders/GLTFLoader' {
  // 弱类型兜底,运行时由 webpack/turbopack 处理真实模块
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const GLTFLoader: any;
}

// WebGPURenderer 是较新 API,@types/three 暂未纳入
declare module 'three/webgpu' {
  // 弱类型兜底
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const WebGPURenderer: any;
}