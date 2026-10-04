/**
 * vrm/world/env/post.ts — 广场的后期:HDR 场景 → 泛光(Bloom)→ 调色 / 暗角 / 颗粒 → 屏幕
 *
 * 为什么不用 three 自带的 EffectComposer + UnrealBloomPass:场景里的三块显示器是「垫在画布下面的 DOM」,
 * 靠挖洞面片把画布那一块的 alpha 写成 0 才露出来(见 sceneDisplays.ts)。UnrealBloomPass 的合成会把 alpha
 * 搅乱,屏幕就被糊上一层光。这里自己写:场景画进带 MSAA 的半浮点 RGBA 目标(alpha 原样保留),
 * 亮部降采样模糊出泛光,最后合成时 rgb 加泛光、alpha 用场景的,挖洞处 rgb 清零。
 *
 * 环境光遮蔽(ao=true,写实画风高画质):场景目标带深度贴图,半分辨率 SSAO(由深度重建位置和法线,
 * 12 个半球采样、每像素随机旋转)→ 模糊 → 合成时乘进颜色;天空(深度 = 1)不压。屋檐下、墙角、东西落地处有了暗部。
 *
 * 色调映射(ACES)和 sRGB 输出在最后一步做:往屏幕画的 ShaderMaterial 带 tonemapping / colorspace 片段,
 * three 会按 renderer.toneMapping / outputColorSpace 注入。
 */

import type * as THREE from 'three';

export interface PostSettings {
  /** 泛光强度(0 = 关) */
  bloom: number;
  /** 亮部阈值(线性 HDR 亮度) */
  threshold: number;
  /** 饱和度(1 = 原样) */
  saturation: number;
  /** 暗角强度 */
  vignette: number;
  /** 冷暖:-1 偏冷 … 1 偏暖 */
  warmth: number;
  /** 胶片颗粒 */
  grain: number;
}

export const DEFAULT_POST: PostSettings = { bloom: 0.75, threshold: 0.85, saturation: 1.08, vignette: 0.35, warmth: 0, grain: 0.025 };

export interface PostPipeline {
  render: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, t: number) => void;
  setSize: (w: number, h: number) => void;
  set: (p: Partial<PostSettings>) => void;
  dispose: () => void;
}

const FULLSCREEN_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function createPost(THREE_NS: typeof THREE, renderer: THREE.WebGLRenderer, opts: { ao?: boolean } = {}): PostPipeline {
  const useAO = !!opts.ao;
  const size = new THREE_NS.Vector2();
  renderer.getDrawingBufferSize(size);
  const settings: PostSettings = { ...DEFAULT_POST };

  const sceneRT = new THREE_NS.WebGLRenderTarget(size.x, size.y, {
    type: THREE_NS.HalfFloatType, samples: 4, depthBuffer: true,
  });
  if (useAO) {
    // 多重采样目标的深度会在切换目标时解析到这张贴图上(three 的 resolveDepthBuffer)
    sceneRT.depthTexture = new THREE_NS.DepthTexture(size.x, size.y, THREE_NS.FloatType);
  }
  const aoRT = useAO ? new THREE_NS.WebGLRenderTarget(Math.max(1, size.x >> 1), Math.max(1, size.y >> 1), { type: THREE_NS.HalfFloatType, depthBuffer: false }) : null;
  const aoTmp = useAO ? new THREE_NS.WebGLRenderTarget(Math.max(1, size.x >> 1), Math.max(1, size.y >> 1), { type: THREE_NS.HalfFloatType, depthBuffer: false }) : null;
  const white = new THREE_NS.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  white.needsUpdate = true;
  // 泛光链:1/2 亮部 → 1/4 → 1/8 → 1/16,每级横竖各模糊一次,再逐级加回来
  const LEVELS = 4;
  const mk = (w: number, h: number) => new THREE_NS.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), { type: THREE_NS.HalfFloatType, depthBuffer: false });
  const down: THREE.WebGLRenderTarget[] = [];
  const tmp: THREE.WebGLRenderTarget[] = [];
  for (let i = 0; i < LEVELS; i++) {
    const d = 2 << i;
    down.push(mk(size.x / d, size.y / d));
    tmp.push(mk(size.x / d, size.y / d));
  }

  const quad = new THREE_NS.Mesh(new THREE_NS.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  const quadScene = new THREE_NS.Scene();
  quadScene.add(quad);
  const quadCam = new THREE_NS.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const brightMat = new THREE_NS.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uThreshold: { value: settings.threshold } },
    vertexShader: FULLSCREEN_VS,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform sampler2D tSrc; uniform float uThreshold;
      void main(){
        vec4 c = texture2D(tSrc, vUv);
        float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        // 软阈值:阈值附近平滑过渡,避免闪烁的硬边
        float k = smoothstep(uThreshold * 0.8, uThreshold * 1.6, l);
        gl_FragColor = vec4(min(c.rgb * k, vec3(16.0)), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const blurMat = new THREE_NS.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uDir: { value: new THREE_NS.Vector2() } },
    vertexShader: FULLSCREEN_VS,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir;
      void main(){
        // 9-tap 高斯(线性采样合并成 5 次取样)
        vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270;
        vec2 o1 = uDir * 1.3846153846, o2 = uDir * 3.2307692308;
        c += texture2D(tSrc, vUv + o1).rgb * 0.3162162162;
        c += texture2D(tSrc, vUv - o1).rgb * 0.3162162162;
        c += texture2D(tSrc, vUv + o2).rgb * 0.0702702703;
        c += texture2D(tSrc, vUv - o2).rgb * 0.0702702703;
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const copyMat = new THREE_NS.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uGain: { value: 1 } },
    vertexShader: FULLSCREEN_VS,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tSrc; uniform float uGain; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uGain, 1.0); }`,
    depthTest: false, depthWrite: false, blending: THREE_NS.AdditiveBlending, transparent: true,
  });
  // SSAO:半球核(越靠近中心越密)
  const KERNEL: THREE.Vector3[] = [];
  for (let i = 0; i < 12; i++) {
    const a = i * 2.39996, r = Math.sqrt((i + 0.5) / 12);
    const v = new THREE_NS.Vector3(Math.cos(a) * r, Math.sin(a) * r, Math.sqrt(Math.max(0, 1 - r * r)));
    const k = (i + 1) / 12;
    KERNEL.push(v.multiplyScalar(0.15 + 0.85 * k * k));
  }
  const aoMat = new THREE_NS.ShaderMaterial({
    uniforms: {
      tDepth: { value: null }, uProj: { value: new THREE_NS.Matrix4() }, uProjInv: { value: new THREE_NS.Matrix4() },
      uKernel: { value: KERNEL }, uRadius: { value: 0.55 }, uTexel: { value: new THREE_NS.Vector2() },
    },
    vertexShader: FULLSCREEN_VS,
    fragmentShader: /* glsl */ `
      varying vec2 vUv; uniform sampler2D tDepth; uniform mat4 uProj; uniform mat4 uProjInv;
      uniform vec3 uKernel[12]; uniform float uRadius; uniform vec2 uTexel;
      vec3 viewPos(vec2 uv){
        float d = texture2D(tDepth, uv).x;
        vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
        return p.xyz / p.w;
      }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        float d = texture2D(tDepth, vUv).x;
        if (d >= 0.9999) { gl_FragColor = vec4(1.0); return; }
        vec3 P = viewPos(vUv);
        // 法线:取左右上下里离得近的那一侧做差(边缘处不会被背景拉歪)
        vec3 px1 = viewPos(vUv + vec2(uTexel.x, 0.0)) - P, px2 = P - viewPos(vUv - vec2(uTexel.x, 0.0));
        vec3 py1 = viewPos(vUv + vec2(0.0, uTexel.y)) - P, py2 = P - viewPos(vUv - vec2(0.0, uTexel.y));
        vec3 dx = abs(px1.z) < abs(px2.z) ? px1 : px2;
        vec3 dy = abs(py1.z) < abs(py2.z) ? py1 : py2;
        vec3 N = normalize(cross(dx, dy));
        float ang = hash(vUv * 731.0) * 6.2831853;
        vec3 rnd = vec3(cos(ang), sin(ang), 0.0);
        vec3 T = normalize(rnd - N * dot(rnd, N));
        vec3 B = cross(N, T);
        mat3 TBN = mat3(T, B, N);
        float rad = uRadius * clamp(-P.z * 0.08, 0.35, 2.0); // 远处半径放大一点,近处别太黑
        float occ = 0.0;
        for (int i = 0; i < 12; i++) {
          vec3 S = P + TBN * uKernel[i] * rad;
          vec4 q = uProj * vec4(S, 1.0);
          vec2 suv = q.xy / q.w * 0.5 + 0.5;
          if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
          float sz = viewPos(suv).z;
          float range = smoothstep(0.0, 1.0, rad / abs(P.z - sz));
          occ += (sz >= S.z + 0.025 ? 1.0 : 0.0) * range;
        }
        float ao = 1.0 - occ / 12.0;
        gl_FragColor = vec4(vec3(ao), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });

  const compositeMat = new THREE_NS.ShaderMaterial({
    uniforms: {
      tAO: { value: white }, uAO: { value: useAO ? 1.0 : 0.0 },
      tScene: { value: null }, tBloom: { value: null },
      uBloom: { value: settings.bloom }, uSat: { value: settings.saturation }, uVig: { value: settings.vignette },
      uWarm: { value: settings.warmth }, uGrain: { value: settings.grain }, uTime: { value: 0 },
    },
    vertexShader: FULLSCREEN_VS,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tAO; uniform float uAO;
      uniform float uBloom; uniform float uSat; uniform float uVig; uniform float uWarm; uniform float uGrain; uniform float uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 s = texture2D(tScene, vUv);
        float ao = mix(1.0, texture2D(tAO, vUv).r, uAO);
        vec3 c = s.rgb * ao + texture2D(tBloom, vUv).rgb * uBloom;
        // 冷暖:暖 = 红黄抬、蓝压;冷相反
        c *= vec3(1.0 + 0.06 * uWarm, 1.0 + 0.015 * uWarm, 1.0 - 0.07 * uWarm);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, uSat);
        // 暗角
        vec2 d = vUv - 0.5;
        c *= 1.0 - uVig * smoothstep(0.35, 0.85, length(d * vec2(1.15, 1.0)));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        // 颗粒在显示空间里加,强度恒定
        gl_FragColor.rgb += (hash(vUv * 1024.0 + uTime) - 0.5) * uGrain;
        // 显示器挖洞处:alpha 原样保留,rgb 清零(预乘 alpha 画布上才不会糊一层光)
        float a = s.a;
        gl_FragColor = vec4(gl_FragColor.rgb * step(0.004, a), a);
      }`,
    depthTest: false, depthWrite: false, toneMapped: true, transparent: true, blending: THREE_NS.NoBlending,
  });

  function pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null, clear = true) {
    quad.material = mat;
    renderer.setRenderTarget(target);
    if (clear) renderer.clear(true, false, false);
    renderer.render(quadScene, quadCam);
  }

  const clearColor = new THREE_NS.Color();
  function render(r: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, t: number) {
    const prevAuto = r.autoClear;
    const prevAlpha = r.getClearAlpha();
    r.getClearColor(clearColor);

    // 1. 场景 → HDR 目标(alpha 0 清屏,挖洞处保持 0)
    r.setRenderTarget(sceneRT);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    r.render(scene, camera);
    r.autoClear = false;

    if (settings.bloom > 0.001) {
      // 2. 亮部 → 1/2,再逐级下采样模糊
      brightMat.uniforms.tSrc.value = sceneRT.texture;
      pass(brightMat, down[0]);
      for (let i = 0; i < LEVELS; i++) {
        if (i > 0) {
          copyMat.uniforms.tSrc.value = down[i - 1].texture;
          copyMat.uniforms.uGain.value = 1;
          copyMat.blending = THREE_NS.NoBlending;
          pass(copyMat, down[i]);
        }
        const w = down[i].width, h = down[i].height;
        blurMat.uniforms.tSrc.value = down[i].texture;
        blurMat.uniforms.uDir.value.set(1 / w, 0);
        pass(blurMat, tmp[i]);
        blurMat.uniforms.tSrc.value = tmp[i].texture;
        blurMat.uniforms.uDir.value.set(0, 1 / h);
        pass(blurMat, down[i]);
      }
      // 3. 从最小一级往上加回 down[0](各级权重相同,大半径光晕更柔)
      copyMat.blending = THREE_NS.AdditiveBlending;
      for (let i = LEVELS - 1; i > 0; i--) {
        copyMat.uniforms.tSrc.value = down[i].texture;
        copyMat.uniforms.uGain.value = 0.8;
        pass(copyMat, down[0], false);
      }
    }

    // 3.5 环境光遮蔽:深度 → 半分辨率 SSAO → 横竖各模糊一次
    if (aoRT && aoTmp && sceneRT.depthTexture) {
      const cam = camera as THREE.PerspectiveCamera;
      aoMat.uniforms.tDepth.value = sceneRT.depthTexture;
      aoMat.uniforms.uProj.value.copy(cam.projectionMatrix);
      aoMat.uniforms.uProjInv.value.copy(cam.projectionMatrixInverse);
      aoMat.uniforms.uTexel.value.set(1 / aoRT.width, 1 / aoRT.height);
      pass(aoMat, aoRT);
      blurMat.uniforms.tSrc.value = aoRT.texture;
      blurMat.uniforms.uDir.value.set(1 / aoRT.width, 0);
      pass(blurMat, aoTmp);
      blurMat.uniforms.tSrc.value = aoTmp.texture;
      blurMat.uniforms.uDir.value.set(0, 1 / aoRT.height);
      pass(blurMat, aoRT);
      compositeMat.uniforms.tAO.value = aoRT.texture;
    }

    // 4. 合成到屏幕
    compositeMat.uniforms.tScene.value = sceneRT.texture;
    compositeMat.uniforms.tBloom.value = down[0].texture;
    compositeMat.uniforms.uTime.value = t % 100;
    r.setClearColor(0x000000, 0);
    pass(compositeMat, null);

    r.autoClear = prevAuto;
    r.setClearColor(clearColor, prevAlpha);
  }

  function setSize(w: number, h: number) {
    sceneRT.setSize(w, h);
    aoRT?.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    aoTmp?.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    for (let i = 0; i < LEVELS; i++) {
      const d = 2 << i;
      down[i].setSize(Math.max(1, Math.floor(w / d)), Math.max(1, Math.floor(h / d)));
      tmp[i].setSize(Math.max(1, Math.floor(w / d)), Math.max(1, Math.floor(h / d)));
    }
  }

  function set(p: Partial<PostSettings>) {
    Object.assign(settings, p);
    brightMat.uniforms.uThreshold.value = settings.threshold;
    const u = compositeMat.uniforms;
    u.uBloom.value = settings.bloom;
    u.uSat.value = settings.saturation;
    u.uVig.value = settings.vignette;
    u.uWarm.value = settings.warmth;
    u.uGrain.value = settings.grain;
  }

  function dispose() {
    sceneRT.dispose();
    aoRT?.dispose();
    aoTmp?.dispose();
    white.dispose();
    aoMat.dispose();
    down.forEach((d) => d.dispose());
    tmp.forEach((d) => d.dispose());
    quad.geometry.dispose();
    [brightMat, blurMat, copyMat, compositeMat].forEach((m) => m.dispose());
  }

  return { render, setSize, set, dispose };
}
