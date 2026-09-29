/**
 * vrm/world/env/shaders.ts — 天空 / 水面 / 地形共用的 GLSL 片段
 */

/** 值噪声 + fbm(2D),云、水波、地形着色都用它 */
export const NOISE_GLSL = /* glsl */ `
  float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1,0)), u.x), mix(hash12(i + vec2(0,1)), hash12(i + vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = r * p * 2.03; a *= 0.5; }
    return v;
  }
`;

/**
 * 天空颜色:给一个方向,算出这个方向上的天色(渐变 + 太阳光晕,不含云和星星)。
 * 水面用它算倒影,天空球用它打底 —— 两边是同一个函数,倒影才对得上。
 */
export const SKY_COLOR_GLSL = /* glsl */ `
  uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uSunColor; uniform vec3 uSunDir; uniform float uNight;
  vec3 skyColor(vec3 dir){
    float h = dir.y;
    vec3 c = h > 0.0
      ? mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.45))
      : mix(uHorizon, uGround, pow(clamp(-h * 3.0, 0.0, 1.0), 0.6));
    float d = max(dot(dir, uSunDir), 0.0);
    // 太阳附近的暖光晕;夜里太阳在地平线下,这一项自然消失
    float up = smoothstep(-0.15, 0.05, uSunDir.y);
    c += uSunColor * (pow(d, 8.0) * 0.35 + pow(d, 64.0) * 0.6) * up;
    // 地平线一圈更亮(大气散射)
    c += uHorizon * 0.25 * pow(1.0 - abs(h), 6.0) * (1.0 - uNight * 0.7);
    return c;
  }
`;
