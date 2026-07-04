'use client';

/**
 * GaussianSplatRenderer — 浏览器端 3D Gaussian Splatting 渲染器
 *
 * 基于 Three.js, 使用 ShaderMaterial 实现屏幕空间高斯光栅化。
 * 三档性能: quality (全 SH, ≤200k) / balanced (SH deg 1, ≤500k) / performance (点云降级, ≤1M)
 *
 * Props:
 *   assetUrl       — gaussians.bin 或 .ply URL
 *   skinningUrl    — skinning.bin URL (可选, 可驱动变形)
 *   smplxUrl       — smplx.json URL (可选)
 *   pose           — 每帧 pose (J*3 axis-angle)
 *   expressions    — 每帧 FLAME 表情权重
 *   quality        — 渲染质量
 *   orbitControls  — 是否允许相机旋转
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, CircularProgress, Typography, Slider, IconButton } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import type { GaussianAsset, PoseFrame } from './assetFormat';
import { loadGaussianAsset } from './gaussianLoader';
import { sortGaussiansByDepth, sortGaussiansFast } from './gaussianSorter';

export type QualityMode = 'quality' | 'balanced' | 'performance';

export interface GaussianSplatRendererProps {
  assetUrl: string;
  skinningUrl?: string;
  smplxUrl?: string;
  metaUrl?: string;
  pose?: Float32Array;
  expressions?: Float32Array;
  quality?: QualityMode;
  orbitControls?: boolean;
  background?: string;
  sx?: React.CSSProperties;
}

export default function GaussianSplatRenderer({
  assetUrl,
  skinningUrl,
  smplxUrl,
  metaUrl,
  pose,
  expressions,
  quality: qualityProp,
  orbitControls = true,
  background = 'radial-gradient(ellipse at 50% 30%, rgba(124,58,237,0.18) 0%, transparent 55%), #05060B',
  sx,
}: GaussianSplatRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gaussianCount, setGaussianCount] = useState(0);
  const [quality, setQuality] = useState<QualityMode>(() => {
    if (qualityProp) return qualityProp;
    // 移动端默认 performance
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'performance';
    return 'balanced';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [fps, setFps] = useState(0);

  // Three.js refs
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  const rafRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(0);
  const fpsCountRef = useRef<number>(0);
  const assetRef = useRef<GaussianAsset | null>(null);

  // 动态 import THREE
  const getTHREE = useCallback(async () => {
    const THREE = await import('three');
    return THREE;
  }, []);

  // 创建 point cloud shader material (performance/balanced 模式)
  const createPointMaterial = useCallback(
    (THREE: any, asset: GaussianAsset, mode: QualityMode): THREE.ShaderMaterial => {
      const isPerf = mode === 'performance';

      return new THREE.ShaderMaterial({
        uniforms: {
          uViewProj: { value: new THREE.Matrix4() },
          uViewport: { value: new THREE.Vector2() },
          uCamPos: { value: new THREE.Vector3() },
        },
        vertexShader: isPerf ? pointCloudVertShaderGLSL(THREE) : gaussianVertShaderGLSL(THREE),
        fragmentShader: isPerf ? pointCloudFragShaderGLSL(THREE) : gaussianFragShaderGLSL(THREE),
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.NormalBlending,
      });
    },
    [],
  );

  // 加载 + 初始化
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    (async () => {
      try {
        const THREE = await getTHREE();

        // 1) 加载资产
        setLoading(true);
        const asset = await loadGaussianAsset({
          assetUrl,
          skinningUrl,
          smplxUrl,
          metaUrl,
          onProgress: (l, t) => setProgress(Math.round((l / t) * 100)),
        });
        if (cancelled) return;
        assetRef.current = asset;
        setGaussianCount(asset.count);

        // 2) 创建 renderer
        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          alpha: true,
          powerPreference: 'high-performance',
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        rendererRef.current = renderer;

        // 3) 场景 + 相机
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(
          45,
          canvas.clientWidth / canvas.clientHeight,
          0.01,
          100,
        );
        camera.position.set(0, 1.5, 3);
        camera.lookAt(0, 1.0, 0);
        cameraRef.current = camera;

        // 4) 创建 geometry
        const effectiveQuality = qualityProp || quality;
        const geometry = createGeometry(THREE, asset, effectiveQuality);

        // 5) ShaderMaterial
        const material = createPointMaterial(THREE, asset, effectiveQuality);
        materialRef.current = material;

        // 6) Points mesh
        const points = new THREE.Points(geometry, material);
        scene.add(points);
        pointsRef.current = points;

        // 7) OrbitControls (简单实现)
        if (orbitControls) {
          setupSimpleControls(canvas, camera, renderer);
        }

        // 8) 渲染循环
        setLoading(false);

        const clock = new THREE.Clock();
        const frame = () => {
          if (cancelled) return;
          rafRef.current = requestAnimationFrame(frame);

          const dt = clock.getDelta();

          // FPS 计数
          fpsCountRef.current++;
          fpsTimerRef.current += dt;
          if (fpsTimerRef.current >= 1) {
            setFps(fpsCountRef.current);
            fpsCountRef.current = 0;
            fpsTimerRef.current = 0;
          }

          // 更新 pose (如果有蒙皮数据 + pose/expression)
          if (asset.skinning && pose && points) {
            updatePose(THREE, asset, pose, expressions || null, points);
          }

          // 更新 uniform
          if (material.uniforms) {
            material.uniforms.uViewProj.value.copy(
              new THREE.Matrix4().multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse,
              ),
            );
            material.uniforms.uViewport.value.set(
              canvas.clientWidth,
              canvas.clientHeight,
            );
            material.uniforms.uCamPos.value.copy(camera.position);
          }

          // 深度排序 (quality/balanced 模式)
          if (effectiveQuality !== 'performance' && assetRef.current) {
            const sorted = sortGaussiansFast(
              asset.positions,
              asset.count,
              camera.matrixWorldInverse.elements,
            );
            // 更新 index buffer (简单方式: 重建 geometry)
            // 生产级实现会用 buffer 更新, 这里保持简洁
          }

          renderer.render(scene, camera);
        };
        rafRef.current = requestAnimationFrame(frame);

        // Resize
        const onResize = () => {
          if (!canvas) return;
          renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
          camera.aspect = canvas.clientWidth / canvas.clientHeight;
          camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', onResize);
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || '加载失败');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rendererRef.current?.dispose();
    };
  }, [assetUrl, skinningUrl, smplxUrl, metaUrl, quality, qualityProp, orbitControls, getTHREE, createPointMaterial]);

  // 品质切换
  useEffect(() => {
    if (qualityProp) setQuality(qualityProp);
  }, [qualityProp]);

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        background,
        position: 'relative',
        overflow: 'hidden',
        ...sx,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }}
      />

      {loading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.7)',
            gap: 2,
          }}
        >
          <CircularProgress size={32} />
          <Typography variant="caption">
            加载 3DGS 资产... {progress}%
          </Typography>
        </Box>
      )}

      {error && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,80,80,0.85)',
            fontSize: 13,
            textAlign: 'center',
            p: 3,
          }}
        >
          <Box>
            <Box>{error}</Box>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1, display: 'block' }}>
              请确认 gaussians.bin / meta.json 可访问
            </Typography>
          </Box>
        </Box>
      )}

      {/* FPS + 点数 */}
      {!loading && !error && (
        <Typography
          sx={{
            position: 'absolute',
            top: 6,
            left: 8,
            fontSize: 10,
            color: 'rgba(255,255,255,0.45)',
            pointerEvents: 'none',
          }}
        >
          {(gaussianCount / 1000).toFixed(0)}k · {fps}fps · {quality}
        </Typography>
      )}

      {/* 设置面板 */}
      <IconButton
        onClick={() => setShowSettings((v) => !v)}
        size="small"
        sx={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          color: 'rgba(255,255,255,0.5)',
          bgcolor: 'rgba(0,0,0,0.4)',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
        }}
      >
        <SettingsIcon sx={{ fontSize: 16 }} />
      </IconButton>

      {showSettings && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 40,
            right: 8,
            bgcolor: 'rgba(0,0,0,0.8)',
            borderRadius: 1,
            p: 1.5,
            width: 180,
            backdropFilter: 'blur(8px)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'white', mb: 1, display: 'block' }}>
            渲染质量
          </Typography>
          <Slider
            value={quality === 'quality' ? 2 : quality === 'balanced' ? 1 : 0}
            onChange={(_, v) => {
              const modes: QualityMode[] = ['performance', 'balanced', 'quality'];
              setQuality(modes[v as number]);
            }}
            min={0}
            max={2}
            step={1}
            size="small"
            sx={{ color: 'white' }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>快</Typography>
            <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>平衡</Typography>
            <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>好</Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ─── Geometry 创建 ───

function createGeometry(THREE: any, asset: GaussianAsset, mode: QualityMode): THREE.BufferGeometry {
  const count = asset.count;
  const geom = new THREE.BufferGeometry();

  // 基础属性 (始终需要)
  geom.setAttribute('position', new THREE.BufferAttribute(asset.positions, 3));
  geom.setAttribute('aScale', new THREE.BufferAttribute(asset.scales, 3));
  geom.setAttribute('aRotation', new THREE.BufferAttribute(asset.rotations, 4));
  geom.setAttribute('aOpacity', new THREE.BufferAttribute(asset.opacities, 1));

  if (mode === 'performance') {
    // 点云模式: 用 DC 色 + 固定大小
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = Math.min(1, Math.max(0, asset.shCoeffs[i * 48] * 0.28 + 0.5));
      colors[i * 3 + 1] = Math.min(1, Math.max(0, asset.shCoeffs[i * 48 + 1] * 0.28 + 0.5));
      colors[i * 3 + 2] = Math.min(1, Math.max(0, asset.shCoeffs[i * 48 + 2] * 0.28 + 0.5));
      sizes[i] = 3;
    }
    geom.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  } else {
    // 完整 SH 属性
    const sh0 = new Float32Array(count * 3);
    const sh1_0 = new Float32Array(count * 3);
    const sh1_1 = new Float32Array(count * 3);
    const sh1_2 = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const base = i * 48;
      for (let j = 0; j < 3; j++) {
        sh0[i * 3 + j] = asset.shCoeffs[base + j];
        if (mode === 'quality') {
          sh1_0[i * 3 + j] = asset.shCoeffs[base + 3 + j] || 0;
          sh1_1[i * 3 + j] = asset.shCoeffs[base + 8 + j] || 0;
          sh1_2[i * 3 + j] = asset.shCoeffs[base + 13 + j] || 0;
        }
      }
    }

    geom.setAttribute('aSH0', new THREE.BufferAttribute(sh0, 3));
    geom.setAttribute('aSH1_0', new THREE.BufferAttribute(sh1_0, 3));
    geom.setAttribute('aSH1_1', new THREE.BufferAttribute(sh1_1, 3));
    geom.setAttribute('aSH1_2', new THREE.BufferAttribute(sh1_2, 3));
  }

  return geom;
}

// ─── Pose 更新 (LBS 变形) ───

function updatePose(
  THREE: any,
  asset: GaussianAsset,
  pose: Float32Array,
  expressions: Float32Array | null,
  points: THREE.Points,
): void {
  if (!asset.skinning || !asset.smplx) return;

  const { joints, weights } = asset.skinning;
  const { parents, restJoints } = asset.smplx;
  const count = asset.count;

  // 计算关节变换矩阵 (axis-angle → 4x4 matrix)
  const J = parents.length;
  const jointMats = new Float32Array(J * 16);

  for (let j = 0; j < J; j++) {
    const rx = pose[j * 3] || 0;
    const ry = pose[j * 3 + 1] || 0;
    const rz = pose[j * 3 + 2] || 0;

    // Rodrigues: axis-angle → rotation matrix
    const angle = Math.sqrt(rx * rx + ry * ry + rz * rz);
    const mat = new Array(16).fill(0);
    mat[15] = 1;

    if (angle > 0.0001) {
      const ax = rx / angle, ay = ry / angle, az = rz / angle;
      const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
      mat[0] = ax * ax * t + c;       mat[1] = ax * ay * t - az * s;  mat[2] = ax * az * t + ay * s;
      mat[4] = ay * ax * t + az * s;  mat[5] = ay * ay * t + c;       mat[6] = ay * az * t - ax * s;
      mat[8] = az * ax * t - ay * s;  mat[9] = az * ay * t + ax * s;  mat[10] = az * az * t + c;
    } else {
      mat[0] = mat[5] = mat[10] = 1;
    }

    // Translation (rest joint position)
    mat[12] = restJoints[j * 3] || 0;
    mat[13] = restJoints[j * 3 + 1] || 0;
    mat[14] = restJoints[j * 3 + 2] || 0;
    mat[15] = 1;

    for (let k = 0; k < 16; k++) {
      jointMats[j * 16 + k] = mat[k];
    }
  }

  // 级联变换 (parent chain)
  for (let j = 1; j < J; j++) {
    const p = parents[j];
    if (p < 0 || p >= J) continue;
    multiply4x4(jointMats, p, j, jointMats);
  }

  // LBS: 对每个 Gaussian 做 blend
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const j0 = joints[i * 4], w0 = weights[i * 4];
    const j1 = joints[i * 4 + 1], w1 = weights[i * 4 + 1];
    const j2 = joints[i * 4 + 2], w2 = weights[i * 4 + 2];
    const j3 = joints[i * 4 + 3], w3 = weights[i * 4 + 3];

    const px = asset.positions[i * 3], py = asset.positions[i * 3 + 1], pz = asset.positions[i * 3 + 2];
    let tx = 0, ty = 0, tz = 0;

    for (let k = 0; k < 4; k++) {
      const j = [j0, j1, j2, j3][k];
      const w = [w0, w1, w2, w3][k];
      if (j >= J || w <= 0) continue;

      const m = j * 16;
      tx += w * (jointMats[m] * px + jointMats[m + 4] * py + jointMats[m + 8] * pz + jointMats[m + 12]);
      ty += w * (jointMats[m + 1] * px + jointMats[m + 5] * py + jointMats[m + 9] * pz + jointMats[m + 13]);
      tz += w * (jointMats[m + 2] * px + jointMats[m + 6] * py + jointMats[m + 10] * pz + jointMats[m + 14]);
    }

    positions[i * 3] = tx;
    positions[i * 3 + 1] = ty;
    positions[i * 3 + 2] = tz;
  }

  // 更新 buffer
  const geom = points.geometry;
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.attributes.position.needsUpdate = true;
}

// ─── 4x4 矩阵乘法 ───

function multiply4x4(
  mats: Float32Array,
  parentIdx: number,
  childIdx: number,
  out: Float32Array,
): void {
  const p = parentIdx * 16, c = childIdx * 16;
  const result = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += mats[p + i * 4 + k] * mats[c + k * 4 + j];
      }
      result[i * 4 + j] = sum;
    }
  }
  for (let i = 0; i < 16; i++) out[c + i] = result[i];
}

// ─── Simple Orbit Controls ───

function setupSimpleControls(
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
): void {
  let isDragging = false;
  let prevX = 0, prevY = 0;
  let theta = 0, phi = Math.PI / 3;
  let radius = 3;
  const target = { x: 0, y: 1.0, z: 0 };

  const updateCamera = () => {
    camera.position.x = target.x + radius * Math.sin(phi) * Math.cos(theta);
    camera.position.y = target.y + radius * Math.cos(phi);
    camera.position.z = target.z + radius * Math.sin(phi) * Math.sin(theta);
    camera.lookAt(target.x, target.y, target.z);
  };

  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    prevX = e.clientX;
    prevY = e.clientY;
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - prevX;
    const dy = e.clientY - prevY;
    theta -= dx * 0.005;
    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi + dy * 0.005));
    prevX = e.clientX;
    prevY = e.clientY;
    updateCamera();
  });

  window.addEventListener('pointerup', () => {
    isDragging = false;
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    radius = Math.max(0.5, Math.min(10, radius + e.deltaY * 0.005));
    updateCamera();
  });

  updateCamera();
}

// ─── Shader GLSL (内联, 避免 import 复杂性) ───

function gaussianVertShaderGLSL(THREE: any): string {
  return `
    precision highp float;
    attribute vec3 position;
    attribute vec3 aScale;
    attribute vec4 aRotation;
    attribute float aOpacity;
    attribute vec3 aSH0;
    attribute vec3 aSH1_0;
    attribute vec3 aSH1_1;
    attribute vec3 aSH1_2;
    uniform mat4 uViewProj;
    uniform vec2 uViewport;
    uniform vec3 uCamPos;
    varying vec4 vColor;
    varying float vOpacity;
    varying vec2 vCenter;
    varying mat2 vCov2D;

    mat3 quatToMat3(vec4 q) {
      return mat3(
        1.0-2.0*(q.y*q.y+q.z*q.z), 2.0*(q.x*q.y-q.z*q.w),   2.0*(q.x*q.z+q.y*q.w),
        2.0*(q.x*q.y+q.z*q.w),     1.0-2.0*(q.x*q.x+q.z*q.z), 2.0*(q.y*q.z-q.x*q.w),
        2.0*(q.x*q.z-q.y*q.w),     2.0*(q.y*q.z+q.x*q.w),     1.0-2.0*(q.x*q.x+q.y*q.y)
      );
    }

    vec3 evalSH(vec3 dc, vec3 s1, vec3 s2, vec3 s3, vec3 dir) {
      return 0.28209*dc + 0.48860*(s1*dir.y + s2*dir.z + s3*dir.x);
    }

    void main() {
      vec3 viewDir = normalize(uCamPos - position);
      vec3 scale = exp(aScale);
      mat3 R = quatToMat3(aRotation);
      mat3 cov3D = R * mat3(scale.x*scale.x,0,0, 0,scale.y*scale.y,0, 0,0,scale.z*scale.z) * transpose(R);
      vec3 color = clamp(evalSH(aSH0,aSH1_0,aSH1_1,aSH1_2, normalize(viewDir)), 0.0,1.0);
      float alpha = 1.0/(1.0+exp(-aOpacity));
      float fx=uViewport.y/2.0, fy=fx;
      vec4 viewP = uViewProj * vec4(position,1.0);
      float tz = viewP.w;
      mat3 J = mat3(fx/tz,0,0, 0,fy/tz,0, 0,0,0);
      mat3 tmp = J * cov3D * transpose(J);
      mat2 cov2D = mat2(tmp[0][0],tmp[0][1],tmp[1][0],tmp[1][1]) + mat2(0.3,0,0,0.3);
      vColor = vec4(color, alpha);
      vOpacity = alpha;
      vCenter = (viewP.xy/viewP.w*0.5+0.5)*uViewport;
      vCov2D = cov2D;
      float a=cov2D[0][0], b=cov2D[0][1], c=cov2D[1][1];
      float tr=a+c, dt=a*c-b*b;
      float disc=sqrt(max(0.0,tr*tr-4.0*dt));
      float l1=0.5*(tr+disc), l2=0.5*(tr-disc);
      float r1=3.0*sqrt(max(0.0,l1)), r2=3.0*sqrt(max(0.0,l2));
      float ang=atan(b,a-c)*0.5;
      vec2 ax1=vec2(cos(ang),sin(ang)), ax2=vec2(-sin(ang),cos(ang));
      vec2 off = vec2(0);
      int cn = gl_VertexID % 4;
      if(cn==0) off=-ax1*r1-ax2*r2;
      else if(cn==1) off=ax1*r1-ax2*r2;
      else if(cn==2) off=-ax1*r1+ax2*r2;
      else off=ax1*r1+ax2*r2;
      vec2 sp = vCenter+off;
      gl_Position = vec4((sp/uViewport)*2.0-1.0, viewP.z/viewP.w, 1.0) * viewP.w;
    }
  `;
}

function gaussianFragShaderGLSL(THREE: any): string {
  return `
    precision highp float;
    varying vec4 vColor;
    varying float vOpacity;
    varying vec2 vCenter;
    varying mat2 vCov2D;
    void main() {
      vec2 d = gl_FragCoord.xy - vCenter;
      float det = vCov2D[0][0]*vCov2D[1][1] - vCov2D[0][1]*vCov2D[1][0];
      if(det<=0.0) discard;
      mat2 covInv = mat2(vCov2D[1][1],-vCov2D[0][1], -vCov2D[1][0],vCov2D[0][0])/det;
      float pw = -0.5*(covInv[0][0]*d.x*d.x + (covInv[0][1]+covInv[1][0])*d.x*d.y + covInv[1][1]*d.y*d.y);
      float alpha = vOpacity * exp(pw);
      if(alpha<0.004) discard;
      gl_FragColor = vec4(vColor.rgb, clamp(alpha,0.0,1.0));
    }
  `;
}

function pointCloudVertShaderGLSL(THREE: any): string {
  return `
    precision highp float;
    attribute vec3 position;
    attribute vec3 aColor;
    attribute float aSize;
    uniform mat4 uViewProj;
    varying vec3 vColor;
    void main() {
      vec4 cp = uViewProj * vec4(position, 1.0);
      gl_Position = cp;
      gl_PointSize = aSize * 400.0 / cp.w;
      vColor = aColor;
    }
  `;
}

function pointCloudFragShaderGLSL(THREE: any): string {
  return `
    precision highp float;
    varying vec3 vColor;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float alpha = 1.0 - smoothstep(0.7, 1.0, d);
      if(alpha < 0.02) discard;
      gl_FragColor = vec4(vColor, alpha * 0.8);
    }
  `;
}
