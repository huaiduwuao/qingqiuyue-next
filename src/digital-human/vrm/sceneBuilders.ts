/**
 * vrm/sceneBuilders.ts — config-driven scene factory
 *
 * Phase 1.4 重构：替换 6 个硬编码 build* 函数为单一 buildScene(config)，
 * 从 SceneConfig 动态构建场景。向后兼容：保留 SceneHandle 类型和 buildSceneByName 旧 API。
 *
 * 不依赖 React。useVrmScene 仍然调 buildSceneByName(name) 即可。
 */

import type * as THREE from 'three';
import type { SceneConfig, LightConfig, DecorationConfig } from './config/types';
import { buildConcert, buildIdol, buildGarden, buildNeon, buildStudio, buildLawn } from './legacySceneBuilders';

// ============================================================================
// 公开类型：与之前保持一致
// ============================================================================

export interface SceneHandle {
  lights: THREE.Light[];
  beams: THREE.Object3D[];
  ledRing?: THREE.Mesh;
  ledRing2?: THREE.Mesh;
  backdrop?: THREE.Mesh;
  particles?: THREE.Points;
  preset: string;
  dispose: () => void;
}

// ============================================================================
// 通用 helper factory
// ============================================================================

function makeSkyDome(THREE_NS: typeof THREE, topColor: number, bottomColor: number) {
  const g = new THREE_NS.SphereGeometry(40, 32, 32);
  const m = new THREE_NS.ShaderMaterial({
    side: THREE_NS.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE_NS.Color(topColor) }, bot: { value: new THREE_NS.Color(bottomColor) } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 bot;
      void main(){ float t = clamp(vP.y / 30.0, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, t), 1.0); }`,
  });
  return new THREE_NS.Mesh(g, m);
}

function makeLEDRing(THREE_NS: typeof THREE, rIn: number, rOut: number, color: number) {
  const g = new THREE_NS.RingGeometry(rIn, rOut, 96);
  const m = new THREE_NS.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE_NS.DoubleSide });
  const ring = new THREE_NS.Mesh(g, m);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

function makeLightBeam(THREE_NS: typeof THREE, color: number, height = 4, radius = 0.9) {
  const g = new THREE_NS.CylinderGeometry(0.02, radius, height, 24, 1, true);
  const m = new THREE_NS.MeshBasicMaterial({
    color, transparent: true, opacity: 0.18,
    blending: THREE_NS.AdditiveBlending, depthWrite: false, side: THREE_NS.DoubleSide,
  });
  const mesh = new THREE_NS.Mesh(g, m);
  mesh.position.y = height / 2;
  return mesh;
}

function makeParticles(THREE_NS: typeof THREE, count = 180, area = 20, palette: number[] = [0xff4fd8, 0x4fd8ff, 0xffb74f, 0x9b6bff, 0xffffff]) {
  const g = new THREE_NS.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colors = palette.map((c) => new THREE_NS.Color(c));
  for (let i = 0; i < count; i++) {
    pos[i * 3 + 0] = (Math.random() - 0.5) * area;
    pos[i * 3 + 1] = Math.random() * 8 + 0.2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * area - 2;
    const c = colors[Math.floor(Math.random() * colors.length)];
    col[i * 3 + 0] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    sizes[i] = Math.random() * 0.08 + 0.02;
  }
  g.setAttribute('position', new THREE_NS.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE_NS.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE_NS.BufferAttribute(sizes, 1));
  const m = new THREE_NS.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE_NS.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute float aSize; varying vec3 vCol; varying float vTwinkle; uniform float uTime;
      void main(){
        vCol = color;
        vec3 p = position;
        p.y += sin(uTime*0.5 + p.x*0.3)*0.4;
        p.x += cos(uTime*0.3 + p.z*0.4)*0.2;
        vec4 mv = modelViewMatrix * vec4(p,1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * 320.0 / -mv.z;
        vTwinkle = 0.6 + 0.4 * sin(uTime*2.0 + p.x + p.y);
      }`,
    fragmentShader: `varying vec3 vCol; varying float vTwinkle;
      void main(){
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;
        float a = (1.0 - d*2.0) * vTwinkle;
        gl_FragColor = vec4(vCol, a * 0.9);
      }`,
    vertexColors: true,
  });
  return new THREE_NS.Points(g, m);
}

function makeTruss(THREE_NS: typeof THREE, width = 10, depth = 4) {
  const grp = new THREE_NS.Group();
  const bar = (x: number, y: number, z: number, len: number, axis: 'x' | 'y' | 'z' = 'x') => {
    const g = new THREE_NS.CylinderGeometry(0.04, 0.04, len, 8);
    const m = new THREE_NS.MeshStandardMaterial({ color: 0x222233, metalness: 0.8, roughness: 0.5 });
    const mesh = new THREE_NS.Mesh(g, m);
    mesh.position.set(x, y, z);
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    return mesh;
  };
  grp.add(bar(-width / 2, 1.8, -depth / 2, 3.6, 'y'), bar(width / 2, 1.8, -depth / 2, 3.6, 'y'));
  grp.add(bar(-width / 2, 1.8, depth / 2, 3.6, 'y'), bar(width / 2, 1.8, depth / 2, 3.6, 'y'));
  grp.add(bar(0, 3.6, -depth / 2, width, 'x'), bar(0, 3.6, depth / 2, width, 'x'));
  grp.add(bar(-width / 2, 3.6, 0, depth, 'z'), bar(width / 2, 3.6, 0, depth, 'z'));
  for (const cx of [-width / 2, width / 2]) for (const cz of [-depth / 2, depth / 2]) {
    const g = new THREE_NS.CylinderGeometry(0.025, 0.025, 1.3, 6);
    const m = new THREE_NS.MeshStandardMaterial({ color: 0x1a1a25, metalness: 0.7, roughness: 0.5 });
    const c = new THREE_NS.Mesh(g, m);
    c.position.set(cx, 3.0, cz);
    c.rotation.z = Math.PI / 4 * (cx > 0 ? -1 : 1);
    grp.add(c);
  }
  return grp;
}

function makeBackdrop(THREE_NS: typeof THREE, width = 12, height = 5, curve = 2) {
  const g = new THREE_NS.PlaneGeometry(width, height, 32, 16);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    pos.setZ(i, z - Math.abs(pos.getX(i)) / width * curve);
  }
  g.computeVertexNormals();
  const m = new THREE_NS.ShaderMaterial({
    side: THREE_NS.DoubleSide,
    uniforms: {
      uTime: { value: 0 }, uColA: { value: new THREE_NS.Color(0x1a0a2e) },
      uColB: { value: new THREE_NS.Color(0x3a1a5e) }, uAccent: { value: new THREE_NS.Color(0xff4fd8) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uColA, uColB, uAccent;
      void main(){
        vec2 uv = vUv;
        float wave = sin(uv.x * 6.0 - uTime * 0.6) * 0.5 + 0.5;
        vec3 col = mix(uColA, uColB, wave * 0.7);
        float scan = smoothstep(0.0, 0.05, fract(uv.y * 30.0 - uTime * 0.3));
        col += uAccent * scan * 0.12;
        float centerGlow = smoothstep(0.4, 0.0, length(uv - vec2(0.5, 0.5)));
        col += uAccent * centerGlow * 0.15 * (0.5 + 0.5 * sin(uTime * 1.2));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE_NS.Mesh(g, m);
}

function makeFloor(THREE_NS: typeof THREE, config: { type: 'circle' | 'plane' | 'none'; radius?: number; width?: number; depth?: number; color: number; roughness: number; metalness: number; receiveShadow: boolean }) {
  if (config.type === 'none') return null;
  let geo: THREE.BufferGeometry;
  if (config.type === 'circle') {
    geo = new THREE_NS.CircleGeometry(config.radius || 6, 64);
  } else {
    geo = new THREE_NS.PlaneGeometry(config.width || 20, config.depth || 20);
  }
  const m = new THREE_NS.MeshStandardMaterial({ color: config.color, roughness: config.roughness, metalness: config.metalness });
  const mesh = new THREE_NS.Mesh(geo, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = config.receiveShadow;
  return mesh;
}

function makeTree(THREE_NS: typeof THREE, height: number, trunkRadius: number, leafColor: number) {
  const grp = new THREE_NS.Group();
  const trunk = new THREE_NS.Mesh(
    new THREE_NS.CylinderGeometry(trunkRadius * 0.7, trunkRadius, height * 0.4, 6),
    new THREE_NS.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 }),
  );
  trunk.position.y = height * 0.2;
  trunk.castShadow = true;
  grp.add(trunk);
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE_NS.Mesh(
      new THREE_NS.SphereGeometry(trunkRadius * 4, 8, 6),
      new THREE_NS.MeshStandardMaterial({ color: leafColor, roughness: 0.8 }),
    );
    leaf.position.y = height * 0.4 + height * 0.5 + i * (trunkRadius * 3);
    leaf.scale.set(1, 0.7, 1);
    leaf.castShadow = true;
    grp.add(leaf);
  }
  return grp;
}

function makeColumn(THREE_NS: typeof THREE, w: number, h: number, d: number, color: number) {
  const m = new THREE_NS.Mesh(
    new THREE_NS.BoxGeometry(w, h, d),
    new THREE_NS.MeshStandardMaterial({ color, roughness: 0.6 }),
  );
  m.position.y = h / 2;
  return m;
}

function makeMirror(THREE_NS: typeof THREE, w: number, h: number, color: number) {
  const m = new THREE_NS.Mesh(
    new THREE_NS.PlaneGeometry(w, h, 32, 16),
    new THREE_NS.MeshStandardMaterial({ color, roughness: 0.05, metalness: 0.95 }),
  );
  m.position.y = h / 2;
  return m;
}

function makeCurvedPaper(THREE_NS: typeof THREE, w: number, h: number, color: number) {
  const g = new THREE_NS.PlaneGeometry(w, h, 32, 16);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < -2) pos.setZ(i, pos.getZ(i) + Math.abs(y + 2) * 0.8);
  }
  g.computeVertexNormals();
  const m = new THREE_NS.Mesh(g, new THREE_NS.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }));
  m.position.y = h / 2;
  return m;
}

function makeFloorCircle(THREE_NS: typeof THREE, radius: number, color: number, roughness: number, metalness: number) {
  const m = new THREE_NS.Mesh(
    new THREE_NS.CircleGeometry(radius, 64),
    new THREE_NS.MeshStandardMaterial({ color, roughness, metalness }),
  );
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true;
  return m;
}

// ============================================================================
// Decoration factory
// ============================================================================

function buildDecoration(THREE_NS: typeof THREE, dec: DecorationConfig): THREE.Object3D | null {
  const pos = dec.position ? new THREE_NS.Vector3(...dec.position) : new THREE_NS.Vector3();
  switch (dec.type) {
    case 'truss': {
      const width = (dec.params?.width as number) || 10;
      const depth = (dec.params?.depth as number) || 4;
      const m = makeTruss(THREE_NS, width, depth);
      m.position.copy(pos);
      return m;
    }
    case 'backdrop': {
      const width = (dec.params?.width as number) || 12;
      const height = (dec.params?.height as number) || 5;
      const curve = (dec.params?.curve as number) || 2;
      const m = makeBackdrop(THREE_NS, width, height, curve);
      m.position.copy(pos);
      return m;
    }
    case 'tree': {
      const height = (dec.params?.height as number) || 1.8;
      const trunkRadius = (dec.params?.trunkRadius as number) || 0.12;
      const leafColor = (dec.params?.leafColor as number) || 0x3a8a3a;
      const m = makeTree(THREE_NS, height, trunkRadius, leafColor);
      m.position.copy(pos);
      return m;
    }
    case 'column': {
      const w = (dec.params?.width as number) || 0.3;
      const h = (dec.params?.height as number) || 4;
      const d = (dec.params?.depth as number) || 0.3;
      const c = (dec.params?.color as number) || 0x2a2030;
      const m = makeColumn(THREE_NS, w, h, d, c);
      m.position.copy(pos);
      return m;
    }
    case 'mirror': {
      const w = (dec.params?.width as number) || 10;
      const h = (dec.params?.height as number) || 4;
      const c = (dec.params?.color as number) || 0xfffaf0;
      const m = makeMirror(THREE_NS, w, h, c);
      m.position.copy(pos);
      return m;
    }
    case 'box': {
      const w = (dec.params?.width as number) || 0.3;
      const h = (dec.params?.height as number) || 4;
      const d = (dec.params?.depth as number) || 0.3;
      const c = (dec.params?.color as number) || 0x000000;
      const m = makeColumn(THREE_NS, w, h, d, c);
      m.position.copy(pos);
      return m;
    }
    case 'screen': {
      // LED ring (type='ring') 或普通 plane
      const subType = (dec.params?.type as string) || 'plane';
      if (subType === 'ring') {
        const rIn = (dec.params?.innerRadius as number) || 2.55;
        const rOut = (dec.params?.outerRadius as number) || 2.75;
        const c = (dec.params?.color as number) || 0xff4fd8;
        return makeLEDRing(THREE_NS, rIn, rOut, c);
      } else if (subType === 'curved-paper') {
        const w = (dec.params?.width as number) || 12;
        const h = (dec.params?.height as number) || 8;
        const c = (dec.params?.color as number) || 0xfafafa;
        return makeCurvedPaper(THREE_NS, w, h, c);
      } else {
        // plane
        const w = (dec.params?.width as number) || 4;
        const h = (dec.params?.height as number) || 4;
        const c = (dec.params?.color as number) || 0xffffff;
        const m = new THREE_NS.Mesh(
          new THREE_NS.PlaneGeometry(w, h),
          new THREE_NS.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0, side: THREE_NS.DoubleSide }),
        );
        m.position.copy(pos);
        return m;
      }
    }
    case 'flower': {
      const c = (dec.params?.color as number) || 0xfff0a0;
      const m = new THREE_NS.Mesh(
        new THREE_NS.SphereGeometry(0.05, 6, 4),
        new THREE_NS.MeshStandardMaterial({ color: c, roughness: 0.7, emissive: 0x222200, emissiveIntensity: 0.2 }),
      );
      m.position.copy(pos);
      return m;
    }
    default:
      console.warn('[buildDecoration] unknown type:', (dec as any).type);
      return null;
  }
}

// ============================================================================
// Light factory
// ============================================================================

function buildLight(THREE_NS: typeof THREE, cfg: LightConfig): THREE.Light | null {
  const pos = cfg.position ? new THREE_NS.Vector3(...cfg.position) : new THREE_NS.Vector3();
  const target = cfg.target ? new THREE_NS.Vector3(...cfg.target) : new THREE_NS.Vector3(0, 0.9, 0);
  const color = new THREE_NS.Color(cfg.color);
  switch (cfg.type) {
    case 'ambient': return new THREE_NS.AmbientLight(color, cfg.intensity);
    case 'hemisphere': return new THREE_NS.HemisphereLight(color, new THREE_NS.Color(cfg.groundColor || 0), cfg.intensity);
    case 'directional': {
      const l = new THREE_NS.DirectionalLight(color, cfg.intensity);
      l.position.copy(pos); l.target.position.copy(target);
      if (cfg.castShadow) {
        l.castShadow = true;
        l.shadow.mapSize.set(cfg.shadowMapSize || 1024, cfg.shadowMapSize || 1024);
      }
      return l;
    }
    case 'point': {
      const l = new THREE_NS.PointLight(color, cfg.intensity, cfg.distance || 0, cfg.decay || 2);
      l.position.copy(pos);
      return l;
    }
    case 'spot': {
      const l = new THREE_NS.SpotLight(color, cfg.intensity, cfg.distance || 0, cfg.angle || 0.5, cfg.penumbra || 0.5, cfg.decay || 1);
      l.position.copy(pos); l.target.position.copy(target);
      return l;
    }
    default: return null;
  }
}

// ============================================================================
// 主体：buildScene(config)
// ============================================================================

export function buildScene(THREE_NS: typeof THREE, sceneGroup: THREE.Group, config: SceneConfig): SceneHandle {
  const disposers: Array<() => void> = [];
  const lights: THREE.Light[] = [];
  const beams: THREE.Object3D[] = [];
  let ledRing: THREE.Mesh | undefined, ledRing2: THREE.Mesh | undefined;
  let backdrop: THREE.Mesh | undefined;
  let particles: THREE.Points | undefined;

  // 背景
  if (config.background.type === 'sky_dome') {
    const top = config.background.skyTopColor ?? 0x1a0a2e;
    const bot = config.background.skyBottomColor ?? 0x07060d;
    sceneGroup.add(makeSkyDome(THREE_NS, top, bot));
  } else if (config.background.type === 'color' && config.background.color !== undefined) {
    // 通过 clear color 实现（useVrmRenderer 设 scene.background）
    // 这里不直接加 mesh，留给 useVrmScene 调 scene.background
  }

  // 地面
  if (config.floor.type !== 'none') {
    const f = makeFloor(THREE_NS, config.floor);
    if (f) {
      sceneGroup.add(f);
      disposers.push(() => { (f.material as THREE.Material).dispose(); f.geometry.dispose(); });
    }
  }

  // 光源
  for (const lcfg of config.lights) {
    const l = buildLight(THREE_NS, lcfg);
    if (l) {
      sceneGroup.add(l);
      // directional / spot 有 target object
      if ((l as any).target) sceneGroup.add((l as any).target);
      lights.push(l);
    }
  }

  // 装饰物
  for (const dec of config.decorations) {
    const obj = buildDecoration(THREE_NS, dec);
    if (obj) {
      if (dec.position) obj.position.set(...dec.position);
      if (dec.rotation) obj.rotation.set(...dec.rotation);
      if (dec.scale) obj.scale.set(...dec.scale);
      sceneGroup.add(obj);
      // 简单 dispose
      obj.traverse((o: any) => {
        if (o.geometry) disposers.push(() => o.geometry.dispose());
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m: any) => disposers.push(() => m.dispose()));
          else disposers.push(() => o.material.dispose());
        }
      });
      // 特殊：识别 LED ring / backdrop
      if (dec.type === 'screen' && dec.params?.type === 'ring') {
        if (!ledRing) ledRing = obj as THREE.Mesh;
        else ledRing2 = obj as THREE.Mesh;
      }
      if (dec.type === 'backdrop') backdrop = obj as THREE.Mesh;
    }
  }

  // 粒子
  if (config.particles) {
    particles = makeParticles(THREE_NS, config.particles.count, config.particles.area, config.particles.palette);
    sceneGroup.add(particles);
  }

  return {
    lights, beams, ledRing, ledRing2, backdrop, particles,
    preset: config.name,
    dispose: () => disposers.forEach((d) => d()),
  };
}

// ============================================================================
// 向后兼容：buildSceneByName(name) —— Phase 1 仍由它驱动，Phase 2 接 SceneConfig
// ============================================================================

// 临时保留：旧 build* 函数名（重定向到新 buildScene）
// 实际从 vrm/legacySceneBuilders.ts 导入（保留原硬编码路径）
// 见文件末尾 re-export
export { buildConcert, buildIdol, buildGarden, buildNeon, buildStudio, buildLawn } from './legacySceneBuilders';

// 类型导出
export type { SceneConfig, LightConfig, DecorationConfig } from './config/types';

// ============================================================================
// 向后兼容：ScenePresetName 类型 + SCENE_PRESETS / SCENE_LABELS 数组
// （从 SceneConfig 推导，useVrmScene / VrmControlPanel 还在用）
// ============================================================================

export type ScenePresetName = 'concert' | 'idol' | 'garden' | 'neon' | 'studio' | 'lawn';
export const SCENE_PRESETS: ScenePresetName[] = ['concert', 'idol', 'garden', 'neon', 'studio', 'lawn'];
export const SCENE_LABELS: Record<ScenePresetName, string> = {
  concert: '演唱会主舞台', idol: '偶像练习室', garden: '月光花园', neon: '赛博霓虹', studio: '摄影棚白底', lawn: '白天草坪',
};

/** 向后兼容：name → build* 的旧 API（Phase 2 切到 buildScene(config)） */
export function buildSceneByName(THREE_NS: typeof THREE, sceneGroup: THREE.Group, name: ScenePresetName): SceneHandle {
  switch (name) {
    case 'concert': return buildConcert(THREE_NS, sceneGroup);
    case 'idol': return buildIdol(THREE_NS, sceneGroup);
    case 'garden': return buildGarden(THREE_NS, sceneGroup);
    case 'neon': return buildNeon(THREE_NS, sceneGroup);
    case 'studio': return buildStudio(THREE_NS, sceneGroup);
    case 'lawn': return buildLawn(THREE_NS, sceneGroup);
  }
  // 兜底
  return buildConcert(THREE_NS, sceneGroup);
}
