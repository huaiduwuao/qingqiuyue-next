/**
 * vrm/useVrmScenePanel.ts — 3D 场景内的 UI 面板层(CSS3DRenderer)
 *
 * 数字人下发的列表/表单/网格不再是浮在画布之上的一个普通弹窗,而是一块真正
 * 站在 3D 场景里的板子:跟着角色走、随相机转、有透视。
 *
 * 做法:
 *   - CSS3DRenderer 叠一层 DOM 在 WebGL canvas 之上,共用同一个 camera;
 *   - 面板内容是真 DOM(由 React portal 渲染进 host 元素),所以 MUI 的
 *     列表/输入框/按钮全都能正常交互 —— 不是贴图,是能点能打字的界面;
 *   - 每帧把面板摆到角色侧后方并朝向相机(billboard)。
 *
 * 已知取舍:CSS3D 层整体盖在 WebGL 之上,不做逐像素深度遮挡 —— 角色走到面板
 * 前面时不会挡住面板。面板挂在角色侧面,实际很少出现这种视角;真要做遮挡得往
 * WebGL 层写一块 colorWrite=false 的遮挡板,复杂度和收益不成比例,先不做。
 *
 * 用法(在 VrmStage 里):
 *   const panel = useVrmScenePanel({ container, camera, THREE_NS });
 *   // 每帧:panel.tick(avatarWorldPosition)
 *   // 把 panel.host 交给父组件 createPortal
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { CSS3DObject as CSS3DObjectT, CSS3DRenderer as CSS3DRendererT } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

/** 面板 DOM 的像素尺寸。世界尺寸 = 像素 × PANEL_SCALE。 */
const PANEL_WIDTH_PX = 560;
const PANEL_HEIGHT_PX = 720;
/** 0.0022 → 面板约 1.23 × 1.58 世界单位,和 1.6 高的角色比例协调。 */
const PANEL_SCALE = 0.0022;
/** 面板相对角色的横向偏移(世界单位,沿相机右方向)。 */
const PANEL_SIDE_OFFSET = 1.15;
/** 面板中心离地高度。 */
const PANEL_HEIGHT_Y = 1.15;
/** 面板外缘允许到达的 NDC 横向位置(1.0 = 画面边缘),留一点余量。 */
const NDC_EDGE_LIMIT = 0.96;
/** 往回收时的下限:再近就跟角色叠在一起了。 */
const PANEL_MIN_OFFSET = 0.55;

export interface UseVrmScenePanelOptions {
  /** canvas 的父容器,CSS3D 层会插进来 */
  container: HTMLElement | null;
  /** 与 WebGL 共用的相机 */
  camera: THREE.PerspectiveCamera | null;
  /** three 命名空间(VrmStage 动态 import 后传入) */
  THREE_NS: typeof THREE | null;
}

export interface ScenePanelApi {
  /** 面板内容的宿主元素,父组件用 createPortal 往里渲染 React 内容 */
  host: HTMLDivElement | null;
  /** 每帧调用:传入角色世界坐标,面板据此定位并朝向相机 */
  tick: (avatar: { x: number; y: number; z: number }) => void;
  /** 显示/隐藏面板(隐藏时不参与渲染,也不吃鼠标事件) */
  setVisible: (on: boolean) => void;
  /** 容器尺寸变化时同步 CSS3D 渲染器尺寸 */
  resize: () => void;
}

export function useVrmScenePanel(opts: UseVrmScenePanelOptions): ScenePanelApi {
  const { container, camera, THREE_NS } = opts;
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const rendererRef = useRef<CSS3DRendererT | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const objectRef = useRef<CSS3DObjectT | null>(null);
  const visibleRef = useRef(false);
  // 每帧复用的临时向量(three 是动态 import 的,只能在 effect 里造)
  const tmpDirRef = useRef<THREE.Vector3 | null>(null);
  const tmpEdgeRef = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (!container || !camera || !THREE_NS) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const { CSS3DRenderer, CSS3DObject } = await import(
        'three/examples/jsm/renderers/CSS3DRenderer.js'
      );
      if (cancelled) return;

      const renderer = new CSS3DRenderer();
      renderer.setSize(container.clientWidth, container.clientHeight);
      const el = renderer.domElement;
      el.style.position = 'absolute';
      el.style.inset = '0';
      el.style.zIndex = '2';
      // 容器本身不吃鼠标事件,否则整块盖住画布,OrbitControls 就转不动了。
      // 只有面板自己那块 DOM 打开 pointerEvents(见下面 hostEl)。
      el.style.pointerEvents = 'none';
      container.appendChild(el);

      const hostEl = document.createElement('div');
      hostEl.style.width = `${PANEL_WIDTH_PX}px`;
      hostEl.style.height = `${PANEL_HEIGHT_PX}px`;
      hostEl.style.pointerEvents = 'auto';
      // CSS3D 会给元素套 transform,内部内容按 DOM 正常布局
      hostEl.style.overflow = 'hidden';
      hostEl.style.borderRadius = '18px';
      // 拖动面板时不要连带触发 OrbitControls 转镜头
      const stop = (e: Event) => e.stopPropagation();
      for (const evt of ['pointerdown', 'pointermove', 'wheel', 'contextmenu']) {
        hostEl.addEventListener(evt, stop);
      }

      const object = new CSS3DObject(hostEl);
      object.scale.setScalar(PANEL_SCALE);
      object.visible = false;

      const scene = new THREE_NS.Scene();
      scene.add(object);
      tmpDirRef.current = new THREE_NS.Vector3();
      tmpEdgeRef.current = new THREE_NS.Vector3();

      rendererRef.current = renderer;
      sceneRef.current = scene;
      objectRef.current = object;
      setHost(hostEl);

      cleanup = () => {
        for (const evt of ['pointerdown', 'pointermove', 'wheel', 'contextmenu']) {
          hostEl.removeEventListener(evt, stop);
        }
        scene.remove(object);
        el.remove();
        rendererRef.current = null;
        sceneRef.current = null;
        objectRef.current = null;
        setHost(null);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [container, camera, THREE_NS]);

  const tick = useCallback((avatar: { x: number; y: number; z: number }) => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const object = objectRef.current;
    if (!renderer || !scene || !object || !camera) return;

    if (visibleRef.current && tmpDirRef.current && tmpEdgeRef.current) {
      // 摆到角色的「相机右手边」:不管镜头转到哪,面板总在画面里角色的旁边,
      // 而不是转到背后去。右方向 = 相机朝向 × 世界上方。
      const camDir = camera.getWorldDirection(tmpDirRef.current);
      // right = normalize(cross(camDir, worldUp))，worldUp = (0,1,0)
      //   x = camDir.y*0 - camDir.z*1 = -camDir.z
      //   z = camDir.x*1 - camDir.y*0 =  camDir.x
      const rx = -camDir.z, rz = camDir.x;
      const len = Math.hypot(rx, rz) || 1;
      const ux = rx / len, uz = rz / len;

      // 先按理想偏移摆一次，再把「面板外侧边缘」投影到 NDC。
      // 相机拉近或视角窄的时候，1.15 个世界单位会把面板推出画面右侧——
      // 面板是站在场景里的没错，但飘到看不见的地方就没意义了，所以按需往回收。
      let offset = PANEL_SIDE_OFFSET;
      const halfW = (PANEL_WIDTH_PX * PANEL_SCALE) / 2;
      const edge = tmpEdgeRef.current.set(
        avatar.x + ux * (offset + halfW),
        PANEL_HEIGHT_Y,
        avatar.z + uz * (offset + halfW),
      );
      edge.project(camera);
      // z 在 [-1,1] 之外说明点在相机背后，投影结果没有意义，这时不收
      if (edge.z > -1 && edge.z < 1 && Math.abs(edge.x) > NDC_EDGE_LIMIT) {
        const shrink = NDC_EDGE_LIMIT / Math.abs(edge.x);
        offset = Math.max(PANEL_MIN_OFFSET, (offset + halfW) * shrink - halfW);
      }

      object.position.set(
        avatar.x + ux * offset,
        PANEL_HEIGHT_Y,
        avatar.z + uz * offset,
      );
      // billboard:正对相机,面板文字始终不变形
      object.quaternion.copy(camera.quaternion);
    }

    renderer.render(scene, camera);
  }, [camera]);

  const setVisible = useCallback((on: boolean) => {
    visibleRef.current = on;
    const object = objectRef.current;
    if (object) object.visible = on;
    const renderer = rendererRef.current;
    // 隐藏时把整层挪出交互:避免看不见的面板还在吃点击
    if (renderer) renderer.domElement.style.visibility = on ? 'visible' : 'hidden';
  }, []);

  const resize = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer || !container) return;
    if (container.clientWidth === 0 || container.clientHeight === 0) return;
    renderer.setSize(container.clientWidth, container.clientHeight);
  }, [container]);

  useEffect(() => {
    if (!container) return;
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [container, resize]);

  return { host, tick, setVisible, resize };
}

