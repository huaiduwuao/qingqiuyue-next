/**
 * vrm/sceneBuilders.ts — 5 个 VRM 舞台场景（纯 three.js，无 React 依赖）
 *
 * 从 vrm-stage-pro.html 移植。
 * 设计：每个 builder 接收 THREE + sceneGroup，构造后返回 SceneHandle（含 dispose()）。
 * 切场景时，先 dispose 旧场景，再调新 builder。
 */

import type * as THREE from 'three';

export interface SceneHandle {
  /** 所有直射光（用于跟着节拍呼吸） */
  lights: THREE.Light[];
  /** 体积光束（跟着节拍呼吸 + 颜色） */
  beams: THREE.Object3D[];
  /** 主 LED 环（可旋转 + 透明） */
  ledRing?: THREE.Mesh;
  ledRing2?: THREE.Mesh;
  /** 背景屏（shader 有 uTime） */
  backdrop?: THREE.Mesh;
  /** 粒子系统（shader 有 uTime） */
  particles?: THREE.Points;
  /** 释放资源 */
  dispose: () => void;
  /** 场景标识，方便上层路由 */
  preset: string;
}

/* ---------------- 通用：天空圆顶（背景渐变） ---------------- */
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

/* ---------------- 体积光锥 ---------------- */
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

/* ---------------- 地面舞台 ---------------- */
function makeStageFloor(THREE_NS: typeof THREE, radius: number, color = 0x0c0a18) {
  const g = new THREE_NS.CircleGeometry(radius, 64);
  const m = new THREE_NS.MeshStandardMaterial({
    color, roughness: 0.25, metalness: 0.85, envMapIntensity: 0.9,
  });
  const floor = new THREE_NS.Mesh(g, m);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  return floor;
}

/* ---------------- LED 圆环 ---------------- */
function makeLEDRing(THREE_NS: typeof THREE, rIn: number, rOut: number, color: number) {
  const g = new THREE_NS.RingGeometry(rIn, rOut, 96);
  const m = new THREE_NS.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE_NS.DoubleSide });
  const ring = new THREE_NS.Mesh(g, m);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

/* ---------------- 桁架（顶部支架） ---------------- */
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

/* ---------------- 背景 LED 弧形屏 ---------------- */
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
      uTime: { value: 0 },
      uColA: { value: new THREE_NS.Color(0x1a0a2e) },
      uColB: { value: new THREE_NS.Color(0x3a1a5e) },
      uAccent: { value: new THREE_NS.Color(0xff4fd8) },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime; uniform vec3 uColA, uColB, uAccent;
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
  const mesh = new THREE_NS.Mesh(g, m);
  mesh.position.set(0, 2.5, -4);
  return mesh;
}

/* ---------------- 粒子：浮动光斑 ---------------- */
function makeParticles(THREE_NS: typeof THREE, count = 180, area = 20) {
  const g = new THREE_NS.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const palette = [
    new THREE_NS.Color(0xff4fd8), new THREE_NS.Color(0x4fd8ff),
    new THREE_NS.Color(0xffb74f), new THREE_NS.Color(0x9b6bff), new THREE_NS.Color(0xffffff),
  ];
  for (let i = 0; i < count; i++) {
    pos[i * 3 + 0] = (Math.random() - 0.5) * area;
    pos[i * 3 + 1] = Math.random() * 8 + 0.2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * area - 2;
    const c = palette[Math.floor(Math.random() * palette.length)];
    col[i * 3 + 0] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    sizes[i] = Math.random() * 0.08 + 0.02;
  }
  g.setAttribute('position', new THREE_NS.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE_NS.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE_NS.BufferAttribute(sizes, 1));
  const m = new THREE_NS.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE_NS.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSize; varying vec3 vCol; varying float vTwinkle;
      uniform float uTime;
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
    fragmentShader: `
      varying vec3 vCol; varying float vTwinkle;
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

/* ---------------- 5 个场景预设 ---------------- */
export function buildConcert(THREE_NS: typeof THREE, sceneGroup: THREE.Group): SceneHandle {
  const disposers: Array<() => void> = [];
  const lights: THREE.Light[] = [];
  const beams: THREE.Object3D[] = [];
  let ledRing: THREE.Mesh | undefined, ledRing2: THREE.Mesh | undefined, backdrop: THREE.Mesh | undefined;
  let particles: THREE.Points | undefined;

  sceneGroup.add(makeSkyDome(THREE_NS, 0x1a0a2e, 0x07060d));
  const ambient = new THREE_NS.AmbientLight(0x9988cc, 0.7);
  sceneGroup.add(ambient); lights.push(ambient);
  // 主光：VRM 0.0 经 rotateVRM0 后正面朝 +Z（向相机），模型右手在世界 -X 方向
  // 影视标准 3 点光：key 在被摄主体的右脸（世界 -X），fill 在左脸（世界 +X）
  const key = new THREE_NS.DirectionalLight(0xffffff, 1.8);
  key.position.set(-2, 4, 4);
  key.target.position.set(0, 0.9, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  sceneGroup.add(key, key.target); lights.push(key);
  // 补光：暖白，从相机左前方
  const fill = new THREE_NS.DirectionalLight(0xfff0d8, 0.9);
  fill.position.set(2, 2.5, 4);
  sceneGroup.add(fill); lights.push(fill);
  // 半身补光（从下方，消除眼窝阴影）
  const hemi = new THREE_NS.HemisphereLight(0xa0a8ff, 0x2a1a3a, 0.5);
  sceneGroup.add(hemi); lights.push(hemi);

  const colors = [0xff4fd8, 0x4fd8ff, 0x9b6bff, 0xffb74f, 0x4fff9b, 0xff6b9b];
  const positions: [number, number, number][] = [
    [-3, 4.2, 1.5], [3, 4.2, 1.5], [-4, 4.5, -1], [4, 4.5, -1], [0, 5, 2.5], [0, 4.5, -2.5],
  ];
  positions.forEach((p, i) => {
    const s = new THREE_NS.SpotLight(colors[i], 1.2, 14, Math.PI / 6, 0.6, 1.5);
    s.position.set(p[0], p[1], p[2]); s.target.position.set(0, 0.9, 0);
    sceneGroup.add(s, s.target); lights.push(s);
    const beam = makeLightBeam(THREE_NS, colors[i], 5, 0.7);
    beam.position.set(p[0] * 0.55, p[1] / 2, p[2] * 0.5);
    beam.lookAt(0, 0.9, 0);
    beam.rotateX(Math.PI / 2);
    sceneGroup.add(beam); beams.push(beam);
  });

  const truss = makeTruss(THREE_NS, 11, 5);
  truss.position.set(0, 0, -0.3);
  sceneGroup.add(truss);

  backdrop = makeBackdrop(THREE_NS, 13, 6, 2.5);
  sceneGroup.add(backdrop);

  sceneGroup.add(makeStageFloor(THREE_NS, 6, 0x0a0814));
  ledRing = makeLEDRing(THREE_NS, 2.55, 2.75, 0xff4fd8);
  sceneGroup.add(ledRing);
  ledRing2 = makeLEDRing(THREE_NS, 2.75, 2.85, 0x4fd8ff);
  ledRing2.position.y = 0.002;
  sceneGroup.add(ledRing2);

  particles = makeParticles(THREE_NS, 220, 24);
  sceneGroup.add(particles);

  disposers.push(() => { (particles?.material as THREE.Material | undefined)?.dispose(); particles?.geometry.dispose(); });
  disposers.push(() => { (backdrop?.material as THREE.Material | undefined)?.dispose(); backdrop?.geometry.dispose(); });
  disposers.push(() => { (ledRing?.material as THREE.Material | undefined)?.dispose(); ledRing?.geometry.dispose(); });
  disposers.push(() => { (ledRing2?.material as THREE.Material | undefined)?.dispose(); ledRing2?.geometry.dispose(); });

  return {
    lights, beams, ledRing, ledRing2, backdrop, particles,
    preset: 'concert',
    dispose: () => disposers.forEach(d => d()),
  };
}

export function buildIdol(THREE_NS: typeof THREE, sceneGroup: THREE.Group): SceneHandle {
  const disposers: Array<() => void> = [];
  const lights: THREE.Light[] = [];
  const beams: THREE.Object3D[] = [];
  let particles: THREE.Points | undefined;

  sceneGroup.add(makeSkyDome(THREE_NS, 0x221530, 0x0a0814));
  const ambient = new THREE_NS.AmbientLight(0xffd9b3, 0.8);
  sceneGroup.add(ambient); lights.push(ambient);
  const key = new THREE_NS.DirectionalLight(0xfff2d6, 1.6);
  key.position.set(1, 4, 3); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  sceneGroup.add(key); lights.push(key);
  const fill = new THREE_NS.DirectionalLight(0xfff0d8, 0.6);
  fill.position.set(-1.5, 2, 3);
  sceneGroup.add(fill); lights.push(fill);

  [{ c: 0xffd6a5, p: [-2.5, 3.5, 2] as [number, number, number] }, { c: 0xa5d6ff, p: [2.5, 3.5, 2] as [number, number, number] }, { c: 0xffffff, p: [0, 4.5, 1] as [number, number, number] }].forEach(({ c, p }) => {
    const s = new THREE_NS.SpotLight(c, 1.5, 12, Math.PI / 5, 0.7, 1.5);
    s.position.set(p[0], p[1], p[2]); s.target.position.set(0, 0.9, 0);
    sceneGroup.add(s, s.target); lights.push(s);
  });

  const mirror = new THREE_NS.Mesh(
    new THREE_NS.CircleGeometry(5, 64),
    new THREE_NS.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.1, metalness: 0.4 }),
  );
  mirror.rotation.x = -Math.PI / 2; mirror.receiveShadow = true;
  sceneGroup.add(mirror);
  disposers.push(() => { (mirror.material as THREE.Material).dispose(); mirror.geometry.dispose(); });

  const mirrorBg = new THREE_NS.Mesh(
    new THREE_NS.PlaneGeometry(10, 4, 32, 16),
    new THREE_NS.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.05, metalness: 0.95 }),
  );
  mirrorBg.position.set(0, 2, -3.5);
  sceneGroup.add(mirrorBg);
  disposers.push(() => { (mirrorBg.material as THREE.Material).dispose(); mirrorBg.geometry.dispose(); });

  for (const x of [-4.5, 4.5]) {
    const c = new THREE_NS.Mesh(
      new THREE_NS.BoxGeometry(0.3, 4, 0.3),
      new THREE_NS.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.6 }),
    );
    c.position.set(x, 2, -2);
    sceneGroup.add(c);
    disposers.push(() => { (c.material as THREE.Material).dispose(); c.geometry.dispose(); });
  }

  particles = makeParticles(THREE_NS, 60, 14);
  sceneGroup.add(particles);
  disposers.push(() => { (particles?.material as THREE.Material | undefined)?.dispose(); particles?.geometry.dispose(); });

  return { lights, beams, particles, preset: 'idol', dispose: () => disposers.forEach(d => d()) };
}

export function buildGarden(THREE_NS: typeof THREE, sceneGroup: THREE.Group): SceneHandle {
  const disposers: Array<() => void> = [];
  const lights: THREE.Light[] = [];
  const beams: THREE.Object3D[] = [];
  let particles: THREE.Points | undefined;

  sceneGroup.add(makeSkyDome(THREE_NS, 0x050818, 0x100a20));
  const ambient = new THREE_NS.AmbientLight(0x4a5a8a, 0.6);
  sceneGroup.add(ambient); lights.push(ambient);
  const moon = new THREE_NS.DirectionalLight(0xaab8ff, 1.2);
  moon.position.set(-3, 5, 2); moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  sceneGroup.add(moon); lights.push(moon);
  const fill = new THREE_NS.DirectionalLight(0xc8d0ff, 0.5);
  fill.position.set(2, 3, 3);
  sceneGroup.add(fill); lights.push(fill);

  const ms = new THREE_NS.SpotLight(0xc8d8ff, 2.0, 12, Math.PI / 5, 0.5, 1.4);
  ms.position.set(0, 5, 1.5); ms.target.position.set(0, 0.9, 0);
  sceneGroup.add(ms, ms.target); lights.push(ms);
  const beamMoon = makeLightBeam(THREE_NS, 0xa0c0ff, 5, 0.6);
  beamMoon.position.set(0, 2.5, 0.6);
  beamMoon.lookAt(0, 0.9, 0); beamMoon.rotateX(Math.PI / 2);
  sceneGroup.add(beamMoon); beams.push(beamMoon);

  const grass = new THREE_NS.Mesh(
    new THREE_NS.CircleGeometry(8, 64),
    new THREE_NS.MeshStandardMaterial({ color: 0x1a2820, roughness: 0.95, metalness: 0 }),
  );
  grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true;
  sceneGroup.add(grass);
  disposers.push(() => { (grass.material as THREE.Material).dispose(); grass.geometry.dispose(); });

  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    const r = 5 + Math.random() * 2;
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r - 2;
    const h = 1.2 + Math.random() * 1.0;
    const trunk = new THREE_NS.Mesh(
      new THREE_NS.CylinderGeometry(0.06, 0.08, h, 6),
      new THREE_NS.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.9 }),
    );
    trunk.position.set(x, h / 2, z);
    sceneGroup.add(trunk);
    disposers.push(() => { (trunk.material as THREE.Material).dispose(); trunk.geometry.dispose(); });
    const leaf = new THREE_NS.Mesh(
      new THREE_NS.ConeGeometry(0.45, 1.2, 8),
      new THREE_NS.MeshStandardMaterial({ color: 0x1e3a28, roughness: 0.85 }),
    );
    leaf.position.set(x, h + 0.5, z);
    sceneGroup.add(leaf);
    disposers.push(() => { (leaf.material as THREE.Material).dispose(); leaf.geometry.dispose(); });
  }

  particles = makeParticles(THREE_NS, 180, 20);
  sceneGroup.add(particles);
  disposers.push(() => { (particles?.material as THREE.Material | undefined)?.dispose(); particles?.geometry.dispose(); });

  return { lights, beams, particles, preset: 'garden', dispose: () => disposers.forEach(d => d()) };
}

export function buildNeon(THREE_NS: typeof THREE, sceneGroup: THREE.Group): SceneHandle {
  const disposers: Array<() => void> = [];
  const lights: THREE.Light[] = [];
  const beams: THREE.Object3D[] = [];
  let particles: THREE.Points | undefined;

  sceneGroup.add(makeSkyDome(THREE_NS, 0x100520, 0x05010f));
  const ambient = new THREE_NS.AmbientLight(0x6644aa, 0.7);
  sceneGroup.add(ambient); lights.push(ambient);
  const key = new THREE_NS.DirectionalLight(0xff66cc, 1.0);
  key.position.set(2, 4, 3); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  sceneGroup.add(key); lights.push(key);
  const fill = new THREE_NS.DirectionalLight(0xffffff, 0.5);
  fill.position.set(-1.5, 2, 3);
  sceneGroup.add(fill); lights.push(fill);

  [
    { c: 0xff0066, p: [-2.5, 3, 2.5] as [number, number, number] },
    { c: 0x00ffff, p: [2.5, 3, 2.5] as [number, number, number] },
    { c: 0xff00ff, p: [0, 4, 0] as [number, number, number] },
    { c: 0xffff00, p: [-2, 3, -1.5] as [number, number, number] },
    { c: 0x00ff66, p: [2, 3, -1.5] as [number, number, number] },
  ].forEach(({ c, p }) => {
    const s = new THREE_NS.SpotLight(c, 1.8, 12, Math.PI / 7, 0.5, 1.4);
    s.position.set(p[0], p[1], p[2]); s.target.position.set(0, 0.9, 0);
    sceneGroup.add(s, s.target); lights.push(s);
    const beam = makeLightBeam(THREE_NS, c, 5, 0.5);
    beam.position.set(p[0] * 0.6, p[1] / 2, p[2] * 0.5);
    beam.lookAt(0, 0.9, 0); beam.rotateX(Math.PI / 2);
    sceneGroup.add(beam); beams.push(beam);
  });

  const grid = new THREE_NS.Mesh(
    new THREE_NS.PlaneGeometry(20, 20, 20, 20),
    new THREE_NS.ShaderMaterial({
      side: THREE_NS.DoubleSide, transparent: true,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime;
        void main(){
          vec2 g = abs(fract(vUv*20.0 - vec2(uTime*0.1, 0.0)) - 0.5);
          float line = smoothstep(0.45, 0.5, max(g.x, g.y));
          float dist = length(vUv - 0.5);
          vec3 col = mix(vec3(1.0, 0.0, 0.8), vec3(0.0, 0.8, 1.0), vUv.x);
          float a = line * (1.0 - dist*0.8) * 0.7;
          gl_FragColor = vec4(col, a);
        }`,
    }),
  );
  grid.rotation.x = -Math.PI / 2; grid.position.y = 0.01;
  sceneGroup.add(grid);
  disposers.push(() => { (grid.material as THREE.Material).dispose(); grid.geometry.dispose(); });

  for (let i = 0; i < 8; i++) {
    const c = new THREE_NS.Color().setHSL(i / 8, 1.0, 0.55);
    const m = new THREE_NS.Mesh(
      new THREE_NS.BoxGeometry(0.1, 2 + Math.random() * 2, 0.1),
      new THREE_NS.MeshBasicMaterial({ color: c }),
    );
    const ang = (i / 8) * Math.PI * 2;
    m.position.set(Math.cos(ang) * 6, 1 + Math.random(), Math.sin(ang) * 6 - 2);
    sceneGroup.add(m);
    disposers.push(() => { (m.material as THREE.Material).dispose(); m.geometry.dispose(); });
  }

  particles = makeParticles(THREE_NS, 150, 20);
  sceneGroup.add(particles);
  disposers.push(() => { (particles?.material as THREE.Material | undefined)?.dispose(); particles?.geometry.dispose(); });

  return { lights, beams, particles, preset: 'neon', dispose: () => disposers.forEach(d => d()) };
}

export function buildStudio(THREE_NS: typeof THREE, sceneGroup: THREE.Group): SceneHandle {
  const disposers: Array<() => void> = [];
  const lights: THREE.Light[] = [];
  const beams: THREE.Object3D[] = [];

  sceneGroup.add(makeSkyDome(THREE_NS, 0xffffff, 0xf0f0f0));
  const ambient = new THREE_NS.AmbientLight(0xffffff, 0.9);
  sceneGroup.add(ambient); lights.push(ambient);
  const key = new THREE_NS.DirectionalLight(0xffffff, 1.0);
  key.position.set(2, 4, 2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  sceneGroup.add(key); lights.push(key);

  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const s = new THREE_NS.PointLight(0xffffff, 0.6, 6, 2);
    s.position.set(Math.cos(ang) * 2.5, 2.5, Math.sin(ang) * 2.5);
    sceneGroup.add(s); lights.push(s);
  }

  const curveG = new THREE_NS.PlaneGeometry(12, 8, 32, 16);
  const pos = curveG.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < -2) pos.setZ(i, pos.getZ(i) + Math.abs(y + 2) * 0.8);
  }
  curveG.computeVertexNormals();
  const paper = new THREE_NS.Mesh(curveG, new THREE_NS.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.95, metalness: 0 }));
  paper.position.set(0, 2, -3);
  sceneGroup.add(paper);
  disposers.push(() => { (paper.material as THREE.Material).dispose(); paper.geometry.dispose(); });

  const ground = new THREE_NS.Mesh(
    new THREE_NS.PlaneGeometry(20, 20),
    new THREE_NS.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  sceneGroup.add(ground);
  disposers.push(() => { (ground.material as THREE.Material).dispose(); ground.geometry.dispose(); });

  return { lights, beams, preset: 'studio', dispose: () => disposers.forEach(d => d()) };
}

/* ---------------- 草坪（白天阳光 + 大片绿色） ---------------- */
export function buildLawn(THREE_NS: typeof THREE, sceneGroup: THREE.Group): SceneHandle {
  const disposers: Array<() => void> = [];
  const lights: THREE.Light[] = [];
  const beams: THREE.Object3D[] = [];
  let particles: THREE.Points | undefined;

  // 蓝天圆顶
  sceneGroup.add(makeSkyDome(THREE_NS, 0x6db3f2, 0xb0dff7));

  // 环境光（暖白，模拟天空散射）
  const ambient = new THREE_NS.AmbientLight(0xfff8e0, 0.8);
  sceneGroup.add(ambient); lights.push(ambient);

  // 太阳 —— 暖白 directional，从右上 45° 打下来
  const sun = new THREE_NS.DirectionalLight(0xfff0c0, 2.0);
  sun.position.set(4, 8, 3);
  sun.target.position.set(0, 0.9, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sceneGroup.add(sun, sun.target); lights.push(sun);

  // 半球光（天蓝/草绿）—— 模拟自然反射
  const hemi = new THREE_NS.HemisphereLight(0x8ec5ff, 0x4a7a2a, 0.7);
  sceneGroup.add(hemi); lights.push(hemi);

  // 大片草坪（直径 16 的圆盘，绿色）
  const grass = new THREE_NS.Mesh(
    new THREE_NS.CircleGeometry(16, 64),
    new THREE_NS.MeshStandardMaterial({ color: 0x5fa83a, roughness: 0.95, metalness: 0 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  sceneGroup.add(grass);
  disposers.push(() => { (grass.material as THREE.Material).dispose(); grass.geometry.dispose(); });

  // 草尖细节：用半透明小三角形随机分布，做出"草地不平整"的感觉
  for (let i = 0; i < 220; i++) {
    const r = Math.random() * 7 + 1;
    const a = Math.random() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 0.5;
    const blade = new THREE_NS.Mesh(
      new THREE_NS.PlaneGeometry(0.04, 0.18 + Math.random() * 0.1),
      new THREE_NS.MeshStandardMaterial({
        color: new THREE_NS.Color().setHSL(0.28 + Math.random() * 0.05, 0.6, 0.35 + Math.random() * 0.1),
        roughness: 0.9, side: THREE_NS.DoubleSide, transparent: true, opacity: 0.85,
      }),
    );
    blade.position.set(x, 0.09, z);
    blade.rotation.y = Math.random() * Math.PI;
    blade.castShadow = false;
    sceneGroup.add(blade);
  }

  // 散落的树（圆锥+圆柱，6 棵）
  const treePositions: [number, number][] = [
    [4, -3], [-5, -2], [3, -5], [-4, 3], [5, 4], [-6, -4],
  ];
  for (const [x, z] of treePositions) {
    const h = 1.8 + Math.random() * 0.8;
    const trunk = new THREE_NS.Mesh(
      new THREE_NS.CylinderGeometry(0.12, 0.18, h * 0.4, 6),
      new THREE_NS.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 }),
    );
    trunk.position.set(x, h * 0.2, z);
    trunk.castShadow = true;
    sceneGroup.add(trunk);
    disposers.push(() => { (trunk.material as THREE.Material).dispose(); trunk.geometry.dispose(); });

    const leafColors = [0x3a8a3a, 0x4a9a4a, 0x5fa83a];
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE_NS.Mesh(
        new THREE_NS.SphereGeometry(0.6 - i * 0.12, 8, 6),
        new THREE_NS.MeshStandardMaterial({
          color: leafColors[i % leafColors.length],
          roughness: 0.8,
        }),
      );
      leaf.position.set(x + (Math.random() - 0.5) * 0.3, h * 0.4 + h * 0.5 + i * 0.5, z + (Math.random() - 0.5) * 0.3);
      leaf.scale.set(1, 0.7, 1);
      leaf.castShadow = true;
      sceneGroup.add(leaf);
      disposers.push(() => { (leaf.material as THREE.Material).dispose(); leaf.geometry.dispose(); });
    }
  }

  // 几朵小花（黄/白小圆点）
  for (let i = 0; i < 40; i++) {
    const r = 1.5 + Math.random() * 5;
    const a = Math.random() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r - 0.5;
    if (Math.hypot(x, z) < 1.2) continue;  // 避开模型正下方
    const flower = new THREE_NS.Mesh(
      new THREE_NS.SphereGeometry(0.05, 6, 4),
      new THREE_NS.MeshStandardMaterial({
        color: Math.random() > 0.5 ? 0xfff0a0 : 0xffffff,
        roughness: 0.7, emissive: 0x222200, emissiveIntensity: 0.2,
      }),
    );
    flower.position.set(x, 0.05, z);
    sceneGroup.add(flower);
  }

  // 蝴蝶/光斑粒子
  particles = makeParticles(THREE_NS, 80, 14);
  sceneGroup.add(particles);
  disposers.push(() => { (particles?.material as THREE.Material | undefined)?.dispose(); particles?.geometry.dispose(); });

  return { lights, beams, particles, preset: 'lawn', dispose: () => disposers.forEach(d => d()) };
}

/* ---------------- 工厂：根据名字取 builder ---------------- */
export type ScenePresetName = 'concert' | 'idol' | 'garden' | 'neon' | 'studio' | 'lawn';
export const SCENE_PRESETS: ScenePresetName[] = ['concert', 'idol', 'garden', 'neon', 'studio', 'lawn'];
export const SCENE_LABELS: Record<ScenePresetName, string> = {
  concert: '演唱会主舞台', idol: '偶像练习室', garden: '月光花园', neon: '赛博霓虹', studio: '摄影棚白底', lawn: '白天草坪',
};

export function buildScene(THREE_NS: typeof THREE, sceneGroup: THREE.Group, name: ScenePresetName): SceneHandle {
  switch (name) {
    case 'concert': return buildConcert(THREE_NS, sceneGroup);
    case 'idol': return buildIdol(THREE_NS, sceneGroup);
    case 'garden': return buildGarden(THREE_NS, sceneGroup);
    case 'neon': return buildNeon(THREE_NS, sceneGroup);
    case 'studio': return buildStudio(THREE_NS, sceneGroup);
    case 'lawn': return buildLawn(THREE_NS, sceneGroup);
  }
}
