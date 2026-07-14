'use client';

/**
 * VrmPosePreview.tsx — 3D 骨骼编辑器组件
 *
 * 用于 /system/digital-human-config 管理页面中的姿势编辑器。
 * 功能：
 * - 渲染 VRM 模型
 * - 显示骨骼可视化球体（可点击）
 * - TransformControls Gizmo 拖拽旋转
 * - 骨骼高亮选中
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { loadAvatar } from '@/digital-human/vrm/loadAvatar';
import { getBone, detectVrmVersion } from '@/digital-human/vrm/vrmCompat';

export interface VrmBoneEditorHandle {
  applyBoneRotations: (rotations: Record<string, [number, number, number]>) => void;
  getBoneRotations: () => Record<string, [number, number, number]>;
  resetToNatural: () => void;
  resetSelectedBone: () => void;
}

interface VrmBoneEditorProps {
  modelUrl?: string;
  initialRotations?: Record<string, [number, number, number]>;
  onBoneChange?: (rotations: Record<string, [number, number, number]>) => void;
  onBoneSelect?: (boneName: string | null) => void;
  onLoad?: () => void;
}

// 骨骼分组
const BONE_GROUPS = [
  { label: '躯干', bones: ['spine', 'chest', 'neck', 'head'] },
  { label: '左臂', bones: ['leftUpperArm', 'leftLowerArm', 'leftHand'] },
  { label: '右臂', bones: ['rightUpperArm', 'rightLowerArm', 'rightHand'] },
  { label: '左腿', bones: ['leftUpperLeg', 'leftLowerLeg', 'leftFoot'] },
  { label: '右腿', bones: ['rightUpperLeg', 'rightLowerLeg', 'rightFoot'] },
];
const ALL_BONES = BONE_GROUPS.flatMap(g => g.bones);

export const VrmBoneEditor = forwardRef<VrmBoneEditorHandle, VrmBoneEditorProps>(
  function VrmBoneEditor(
    { modelUrl = '/avatars/character.vrm', initialRotations, onBoneChange, onBoneSelect, onLoad },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const orbitControlsRef = useRef<OrbitControls | null>(null);
    const transformControlsRef = useRef<TransformControls | null>(null);
    const vrmRef = useRef<any>(null);
    const humanoidRef = useRef<any>(null);
    const rafRef = useRef<number | null>(null);
    const boneVisualsRef = useRef<Map<string, THREE.Mesh>>(new Map());
    const selectedBoneNameRef = useRef<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedBone, setSelectedBone] = useState<string | null>(null);

    // 骨骼旋转状态（用于同步到父组件）
    const boneRotationsRef = useRef<Record<string, [number, number, number]>>({});

    // 默认材质
    const defaultMaterial = useRef(new THREE.MeshStandardMaterial({
      color: 0x888888,
      emissive: 0x333333,
      emissiveIntensity: 0.3,
    }));
    const selectedMaterial = useRef(new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      emissive: 0xff6b6b,
      emissiveIntensity: 0.6,
    }));

    // 设置自然姿态
    const setNaturalPose = useCallback((vrm: any) => {
      if (!vrm?.humanoid) return;
      const bones: [string, [number, number, number]][] = [
        ['leftUpperArm', [0, 0, -1.4]], ['rightUpperArm', [0, 0, 1.4]],
        ['leftLowerArm', [0.3, 0, 0]], ['rightLowerArm', [0.3, 0, 0]],
        ['leftUpperLeg', [-0.1, 0, 0]], ['rightUpperLeg', [-0.1, 0, 0]],
      ];
      for (const [name, rot] of bones) {
        const bone = getBone(vrm.humanoid, name);
        if (bone) bone.rotation.set(...rot);
      }
    }, []);

    // 应用骨骼旋转
    const applyBoneRotations = useCallback((rotations: Record<string, [number, number, number]>) => {
      if (!humanoidRef.current) return;
      boneRotationsRef.current = { ...rotations };
      for (const [boneName, [x, y, z]] of Object.entries(rotations)) {
        const bone = getBone(humanoidRef.current, boneName);
        if (bone && bone.rotation) {
          bone.rotation.set(x, y, z);
        }
      }
    }, []);

    // 获取当前骨骼旋转
    const getBoneRotations = useCallback(() => {
      const result: Record<string, [number, number, number]> = {};
      if (!humanoidRef.current) return result;

      for (const boneName of ALL_BONES) {
        const bone = getBone(humanoidRef.current, boneName);
        if (bone && bone.rotation) {
          result[boneName] = [bone.rotation.x, bone.rotation.y, bone.rotation.z];
        }
      }
      return result;
    }, []);

    // 重置到自然姿态
    const resetToNatural = useCallback(() => {
      if (!vrmRef.current) return;
      setNaturalPose(vrmRef.current);
      boneRotationsRef.current = {};
      onBoneChange?.({});
    }, [setNaturalPose, onBoneChange]);

    // 重置选中骨骼
    const resetSelectedBone = useCallback(() => {
      if (!selectedBoneNameRef.current || !humanoidRef.current) return;
      const boneName = selectedBoneNameRef.current;
      const bone = getBone(humanoidRef.current, boneName);
      if (bone) {
        bone.rotation.set(0, 0, 0);
        // 更新可视化球体
        const visual = boneVisualsRef.current.get(boneName);
        if (visual) {
          visual.material = defaultMaterial.current;
        }
        // 通知变化
        const newRotations = { ...boneRotationsRef.current };
        newRotations[boneName] = [0, 0, 0];
        boneRotationsRef.current = newRotations;
        onBoneChange?.(newRotations);
      }
    }, [onBoneChange]);

    // 选中骨骼
    const selectBone = useCallback((boneName: string | null) => {
      if (!humanoidRef.current) return;

      // 取消之前的选中
      if (selectedBoneNameRef.current) {
        const prevVisual = boneVisualsRef.current.get(selectedBoneNameRef.current);
        if (prevVisual) {
          prevVisual.material = defaultMaterial.current;
        }
      }

      selectedBoneNameRef.current = boneName;
      setSelectedBone(boneName);
      onBoneSelect?.(boneName);

      if (!boneName) {
        transformControlsRef.current?.detach();
        return;
      }

      // 高亮选中
      const visual = boneVisualsRef.current.get(boneName);
      if (visual) {
        visual.material = selectedMaterial.current;
      }

      // 附加 TransformControls
      const bone = getBone(humanoidRef.current, boneName);
      if (bone && transformControlsRef.current) {
        transformControlsRef.current.attach(bone);
      }
    }, [onBoneSelect]);

    // 创建骨骼可视化球体
    const createBoneVisuals = useCallback((humanoid: any) => {
      const visuals = new Map<string, THREE.Mesh>();

      for (const boneName of ALL_BONES) {
        const bone = getBone(humanoid, boneName);
        if (!bone) continue;

        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.025, 12, 12),
          defaultMaterial.current.clone()
        );
        sphere.userData.boneName = boneName;
        sphere.renderOrder = 1;

        // 将球体作为骨骼的子对象，这样会自动跟随骨骼移动/旋转
        bone.add(sphere);

        visuals.set(boneName, sphere);
      }

      return visuals;
    }, []);

    // 更新骨骼可视化位置（不再需要，因为球体已作为子对象）
    const updateBoneVisuals = useCallback(() => {
      // 球体现在作为骨骼子对象，无需手动更新位置
    }, []);

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      applyBoneRotations,
      getBoneRotations,
      resetToNatural,
      resetSelectedBone,
    }), [applyBoneRotations, getBoneRotations, resetToNatural, resetSelectedBone]);

    // 初始化 Three.js 场景
    useEffect(() => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const width = container.clientWidth || 500;
      const height = container.clientHeight || 500;

      // 创建渲染器
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(width, height);
      renderer.setClearColor(0x1a1a2e, 1);
      renderer.shadowMap.enabled = false;
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // 创建场景
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // 背景渐变
      const bgCanvas = document.createElement('canvas');
      bgCanvas.width = 2;
      bgCanvas.height = 256;
      const ctx = bgCanvas.getContext('2d')!;
      const gradient = ctx.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, '#1a1a2e');
      gradient.addColorStop(1, '#0f0f1a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 2, 256);
      const bgTexture = new THREE.CanvasTexture(bgCanvas);
      scene.background = bgTexture;

      // 相机
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 1.2, 3);
      camera.lookAt(0, 0.9, 0);
      cameraRef.current = camera;

      // OrbitControls（仅用于视角，不影响选中骨骼）
      const orbitControls = new OrbitControls(camera, renderer.domElement);
      orbitControls.target.set(0, 0.9, 0);
      orbitControls.enableDamping = true;
      orbitControls.dampingFactor = 0.05;
      orbitControls.minDistance = 0.5;
      orbitControls.maxDistance = 10;
      orbitControls.update();
      orbitControlsRef.current = orbitControls;

      // TransformControls（用于旋转骨骼）
      const transformControls = new TransformControls(camera, renderer.domElement);
      transformControls.setMode('rotate');
      transformControls.setSpace('local');
      transformControls.setSize(0.8);
      (scene as any).add(transformControls);
      transformControlsRef.current = transformControls;

      // 基础灯光
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
      dirLight.position.set(2, 4, 3);
      scene.add(dirLight);
      const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
      fillLight.position.set(-2, 2, -2);
      scene.add(fillLight);

      // 射线检测
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      // 点击检测骨骼
      const onCanvasClick = (e: MouseEvent) => {
        // 忽略 TransformControls 拖拽时的点击
        if (transformControls.dragging) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const boneMeshes = Array.from(boneVisualsRef.current.values());
        // 递归检测子对象（球体是骨骼的子对象）
        const intersects = raycaster.intersectObjects(boneMeshes, true);

        if (intersects.length > 0) {
          const boneName = intersects[0].object.userData.boneName as string;
          selectBone(boneName);
        } else {
          selectBone(null);
        }
      };

      // TransformControls 变化时同步
      const onTransformChange = () => {
        if (!selectedBoneNameRef.current) return;

        const bone = getBone(humanoidRef.current, selectedBoneNameRef.current);
        if (!bone) return;

        const newRotations = { ...boneRotationsRef.current };
        newRotations[selectedBoneNameRef.current] = [
          bone.rotation.x,
          bone.rotation.y,
          bone.rotation.z,
        ];
        boneRotationsRef.current = newRotations;
        onBoneChange?.(newRotations);
      };

      transformControls.addEventListener('change', onTransformChange);

      // 当 TransformControls 拖拽时禁用 OrbitControls
      let isTransformDragging = false;
      transformControls.addEventListener('mouseDown', () => {
        isTransformDragging = true;
        orbitControls.enabled = false;
      });
      transformControls.addEventListener('mouseUp', () => {
        isTransformDragging = false;
        orbitControls.enabled = true;
      });

      renderer.domElement.addEventListener('click', onCanvasClick);

      // 渲染循环
      const animate = () => {
        rafRef.current = requestAnimationFrame(animate);
        orbitControls.update();
        updateBoneVisuals();
        renderer.render(scene, camera);
      };
      animate();

      // 响应窗口大小变化
      const handleResize = () => {
        if (!container || !renderer || !camera) return;
        const w = container.clientWidth || 500;
        const h = container.clientHeight || 500;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', handleResize);

      // 加载 VRM
      let cancelled = false;
      (async () => {
        try {
          const cached = await loadAvatar(modelUrl, { rotateVRM0: true, removeUnnecessaryJoints: true });
          if (cancelled) return;

          vrmRef.current = cached.vrm;
          humanoidRef.current = cached.humanoid;

          // 设置场景
          cached.scene.traverse((o: any) => { o.frustumCulled = false; });
          scene.add(cached.scene);

          // 计算 Y 偏移
          const box = new THREE.Box3().setFromObject(cached.scene);
          const yOffset = -box.min.y;
          cached.scene.position.y = yOffset;

          // 设置自然姿态
          setNaturalPose(cached.vrm);

          // 创建骨骼可视化
          const visuals = createBoneVisuals(cached.humanoid);
          boneVisualsRef.current = visuals;

          // 应用初始旋转
          if (initialRotations && Object.keys(initialRotations).length > 0) {
            applyBoneRotations(initialRotations);
          }

          detectVrmVersion(cached.vrm);
          setLoading(false);
          onLoad?.();
        } catch (e: any) {
          console.error('[VrmBoneEditor] load failed', e);
          setError(e?.message || String(e));
          setLoading(false);
        }
      })();

      // 清理
      return () => {
        cancelled = true;
        window.removeEventListener('resize', handleResize);
        renderer.domElement.removeEventListener('click', onCanvasClick);
        transformControls.removeEventListener('change', onTransformChange);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        orbitControls.dispose();
        transformControls.dispose();
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      };
    }, [modelUrl, setNaturalPose, createBoneVisuals, updateBoneVisuals, applyBoneRotations, initialRotations, selectBone, onBoneChange, onLoad]);

    // 当 initialRotations 变化时同步
    useEffect(() => {
      if (initialRotations && Object.keys(initialRotations).length > 0) {
        applyBoneRotations(initialRotations);
      }
    }, [initialRotations, applyBoneRotations]);

    return (
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 400,
          position: 'relative',
          borderRadius: 1,
          overflow: 'hidden',
          cursor: 'crosshair',
        }}
      >
        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.6)', zIndex: 1 }}>
            <CircularProgress size={40} sx={{ color: '#ff6b6b' }} />
            <Typography sx={{ ml: 2, color: 'white', fontSize: 13 }}>加载模型...</Typography>
          </Box>
        )}
        {error && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.7)', zIndex: 1 }}>
            <Typography sx={{ color: '#ff6b6b', fontSize: 13 }}>加载失败: {error}</Typography>
          </Box>
        )}
        {!loading && !error && (
          <Box sx={{ position: 'absolute', bottom: 8, left: 8, right: 8, display: 'flex', justifyContent: 'space-between' }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
              点击骨骼球体选中 · 拖拽旋转
            </Typography>
            {selectedBone && (
              <Typography sx={{ color: '#ff6b6b', fontSize: 11, fontWeight: 600 }}>
                选中: {selectedBone.replace('left', '左').replace('right', '右')
                  .replace('UpperArm', '大臂').replace('LowerArm', '小臂')
                  .replace('Hand', '手').replace('UpperLeg', '大腿')
                  .replace('LowerLeg', '小腿').replace('Foot', '脚')
                  .replace('spine', '脊柱').replace('chest', '胸部')
                  .replace('neck', '颈部').replace('head', '头部')}
              </Typography>
            )}
          </Box>
        )}
      </Box>
    );
  }
);
