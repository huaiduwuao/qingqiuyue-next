'use client';

import React, { useEffect, useRef } from 'react';
import Box, { type BoxProps } from '@mui/material/Box';

interface Props extends BoxProps {
  /** 三段色带 */
  colorStops?: [string, string, string];
  /** 波幅 */
  amplitude?: number;
  /** 与底色的融合(0-1) */
  blend?: number;
  /** 流速 */
  speed?: number;
  /** 触屏/低端设备是否也跑 WebGL(默认 false:退化成静态渐变,省电) */
  enableOnMobile?: boolean;
}

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.5) return mix(uColorStops[0], uColorStops[1], t * 2.0);
  return mix(uColorStops[1], uColorStops[2], (t - 0.5) * 2.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 color = ramp(uv.x);
  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;
  float midPoint = 0.20;
  float alpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  vec3 auroraColor = intensity * color;
  fragColor = vec4(auroraColor * alpha, alpha);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Aurora(React Bits)—— WebGL 极光背景(ogl)。
 * 放在 position:relative 的容器里,自己铺满整层;容器需要 overflow:hidden。
 * 触屏默认退化成静态渐变(省电 + 老 WebView 没有 WebGL2 也不会白屏)。
 */
export default function Aurora({
  colorStops = ['#FE2C55', '#8B5CF6', '#25F4EE'],
  amplitude = 1.0,
  blend = 0.5,
  speed = 0.6,
  enableOnMobile = false,
  sx,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ colorStops, amplitude, blend, speed });
  propsRef.current = { colorStops, amplitude, blend, speed };

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const touch = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches;
    if (reduced || (touch && !enableOnMobile)) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    // ogl 走动态 import:只有真正要画极光的页面才下载它,而且老 WebView 缺 WebGL2 时
    // 初始化失败也只是回落到静态渐变,不影响页面。
    import('ogl')
      .then(({ Renderer, Program, Mesh, Color, Triangle }) => {
        if (cancelled || !ref.current) return;
        const renderer = new Renderer({
          alpha: true,
          premultipliedAlpha: true,
          antialias: false,
          dpr: Math.min(window.devicePixelRatio || 1, 1.5),
        });
        const gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.canvas.style.position = 'absolute';
        gl.canvas.style.inset = '0';
        gl.canvas.style.width = '100%';
        gl.canvas.style.height = '100%';

        const geometry = new Triangle(gl);
        const program = new Program(gl, {
          vertex: VERT,
          fragment: FRAG,
          uniforms: {
            uTime: { value: 0 },
            uAmplitude: { value: propsRef.current.amplitude },
            uColorStops: { value: propsRef.current.colorStops.map((c) => new Color(...hexToRgb(c))) },
            uResolution: { value: [container.offsetWidth, container.offsetHeight] },
            uBlend: { value: propsRef.current.blend },
          },
        });
        const mesh = new Mesh(gl, { geometry, program });
        container.appendChild(gl.canvas);

        const resize = () => {
          const w = container.offsetWidth;
          const h = container.offsetHeight;
          renderer.setSize(w, h);
          program.uniforms.uResolution.value = [w, h];
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(container);

        let raf = 0;
        let visible = true;
        const io = new IntersectionObserver((entries) => {
          visible = entries.some((e) => e.isIntersecting);
        });
        io.observe(container);
        const update = (t: number) => {
          raf = requestAnimationFrame(update);
          if (!visible || document.hidden) return;
          const p = propsRef.current;
          program.uniforms.uTime.value = t * 0.001 * p.speed;
          program.uniforms.uAmplitude.value = p.amplitude;
          program.uniforms.uBlend.value = p.blend;
          program.uniforms.uColorStops.value = p.colorStops.map((c) => new Color(...hexToRgb(c)));
          renderer.render({ scene: mesh });
        };
        raf = requestAnimationFrame(update);

        cleanup = () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          io.disconnect();
          if (gl.canvas.parentNode === container) container.removeChild(gl.canvas);
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        };
      })
      .catch(() => {
        /* 没有 WebGL2:保留静态渐变 */
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [enableOnMobile]);

  const fallback =
    `radial-gradient(ellipse 70% 60% at 20% 0%, ${colorStops[0]}44 0%, transparent 60%), ` +
    `radial-gradient(ellipse 60% 50% at 80% 10%, ${colorStops[2]}3a 0%, transparent 60%), ` +
    `radial-gradient(ellipse 80% 60% at 50% 100%, ${colorStops[1]}33 0%, transparent 70%)`;

  return (
    <Box
      ref={ref}
      aria-hidden
      {...rest}
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: fallback,
        ...sx,
      }}
    />
  );
}
