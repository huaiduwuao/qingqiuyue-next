/**
 * vrm/particles.ts — 彩屑粒子（独立于场景工厂，由控制台 "彩屑氛围" 开关触发）
 */

import type * as THREE from 'three';

export function makeConfetti(THREE_NS: typeof THREE) {
  const count = 200;
  const g = new THREE_NS.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const palette = [0xff4fd8, 0x4fd8ff, 0xffb74f, 0x4fff9b, 0xffffff, 0x9b6bff];
  for (let i = 0; i < count; i++) {
    pos[i * 3 + 0] = (Math.random() - 0.5) * 4;
    pos[i * 3 + 1] = 2 + Math.random() * 3;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    const c = new THREE_NS.Color(palette[Math.floor(Math.random() * palette.length)]);
    col[i * 3 + 0] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    vel[i * 3 + 0] = (Math.random() - 0.5) * 0.4;
    vel[i * 3 + 1] = -0.3 - Math.random() * 0.5;
    vel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
  }
  g.setAttribute('position', new THREE_NS.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE_NS.BufferAttribute(col, 3));
  g.setAttribute('aVel', new THREE_NS.BufferAttribute(vel, 3));
  const m = new THREE_NS.PointsMaterial({
    size: 0.08, vertexColors: true, transparent: true, opacity: 0.95,
    depthWrite: false, blending: THREE_NS.AdditiveBlending,
  });
  return new THREE_NS.Points(g, m);
}

export function updateConfetti(_THREE_NS: typeof THREE, points: THREE.Points | null, dt: number) {
  if (!points) return;
  const pos = points.geometry.attributes.position;
  const vel = points.geometry.attributes.aVel;
  const N = pos.count;
  for (let i = 0; i < N; i++) {
    pos.array[i * 3 + 0] += vel.array[i * 3 + 0] * dt;
    pos.array[i * 3 + 1] += vel.array[i * 3 + 1] * dt;
    pos.array[i * 3 + 2] += vel.array[i * 3 + 2] * dt;
    pos.array[i * 3 + 0] += Math.sin((pos.array[i * 3 + 1] + i) * 3) * 0.01;
    if (pos.array[i * 3 + 1] < 0) {
      pos.array[i * 3 + 0] = (Math.random() - 0.5) * 4;
      pos.array[i * 3 + 1] = 4 + Math.random() * 2;
      pos.array[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
  }
  pos.needsUpdate = true;
}
