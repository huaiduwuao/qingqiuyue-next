/**
 * vrm/physics/world.ts — Rapier 物理世界
 *
 * Phase 3：用 @dimforge/rapier3d-compat (WASM) 跑 60fps
 * 角色 body 用 KinematicPositionBased（脚本驱动位置，物理只管碰撞/摩擦）
 *
 * 异步 init RAPIER（WASM 加载） → 创建 world → 创建 ground / walls / character
 * step(dt) → 同步 body.translation() 到 scene.position
 */

import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { SceneConfig, VrmModelConfig } from '../config/types';

let _rapierInited = false;
let _rapierInitPromise: Promise<void> | null = null;

/** 异步初始化 Rapier WASM（只在浏览器里跑一次） */
export async function initRapier(): Promise<void> {
  if (_rapierInited) return;
  if (!_rapierInitPromise) {
    _rapierInitPromise = RAPIER.init().then(() => { _rapierInited = true; });
  }
  return _rapierInitPromise;
}

export interface PhysicsWorld {
  rapier: typeof RAPIER;
  world: RAPIER.World;
  character: RAPIER.RigidBody;
  characterCollider: RAPIER.Collider;
  ground: RAPIER.Collider;
  walls: RAPIER.RigidBody[];
  /** 步进 + 同步 scene.position */
  step: (dt: number, targetPos: { x: number; y: number; z: number }, scene: THREE.Object3D) => { x: number; y: number; z: number };
  /** 从某点向下射线检测地面高度（Foot IK 用） */
  raycastGround: (origin: { x: number; y: number; z: number }, maxDistance?: number) => number | null;
  /** 清理 */
  dispose: () => void;
}

export async function createPhysicsWorld(
  THREE_NS: typeof THREE,
  model: VrmModelConfig,
  scene: SceneConfig,
): Promise<PhysicsWorld> {
  await initRapier();
  const gravity = { x: 0, y: scene.physics.gravity, z: 0 };
  const world = new RAPIER.World(gravity);

  // 地面（固定 plane collider）
  const groundDesc = scene.floor.collider === 'plane'
    ? RAPIER.ColliderDesc.cuboid(50, 0.05, 50)  // plane 用薄 cuboid
    : RAPIER.ColliderDesc.cuboid(
        (scene.floor.radius || scene.floor.width || 6) / 2 + 0.1,
        0.05,
        (scene.floor.radius || scene.floor.depth || 6) / 2 + 0.1,
      );
  groundDesc.setTranslation(0, -0.05, 0);
  groundDesc.setFriction(0.8);
  const ground = world.createCollider(groundDesc);

  // 边界墙（4 面）
  const walls: RAPIER.RigidBody[] = [];
  const b = scene.physics.bounds;
  const wallH = 2, wallT = 0.2;
  const wallSpecs: [number, number, number, number, number, number][] = [
    // [hx, hy, hz, px, py, pz]
    [(b.maxX - b.minX) / 2 + wallT, wallH / 2, wallT / 2, (b.maxX + b.minX) / 2, wallH / 2, b.maxZ + wallT / 2], // far Z+
    [(b.maxX - b.minX) / 2 + wallT, wallH / 2, wallT / 2, (b.maxX + b.minX) / 2, wallH / 2, b.minZ - wallT / 2], // near Z-
    [wallT / 2, wallH / 2, (b.maxZ - b.minZ) / 2 + wallT, b.maxX + wallT / 2, wallH / 2, (b.maxZ + b.minZ) / 2], // right X+
    [wallT / 2, wallH / 2, (b.maxZ - b.minZ) / 2 + wallT, b.minX - wallT / 2, wallH / 2, (b.maxZ + b.minZ) / 2], // left X-
  ];
  for (const [hx, hy, hz, px, py, pz] of wallSpecs) {
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(px, py, pz);
    const body = world.createRigidBody(bodyDesc);
    const cd = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.5);
    world.createCollider(cd, body);
    walls.push(body);
  }

  // 角色 capsule
  const charDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(0, model.footOffsetY + model.capsule.height / 2, 0);
  const character = world.createRigidBody(charDesc);
  const capDesc = RAPIER.ColliderDesc.capsule(model.capsule.height / 2, model.capsule.radius)
    .setFriction(0.7);
  const characterCollider = world.createCollider(capDesc, character);

  // step + sync
  const step = (dt: number, targetPos: { x: number; y: number; z: number }, sceneObj: THREE.Object3D) => {
    // targetPos 是脚本想要的位置（来自 VrmStage move/setPosition）
    // kinematic body: 直接 setNextKinematicTranslation，物理 step 处理碰撞（撞墙会卡住）
    const cur = character.translation();
    const desiredX = targetPos.x;
    const desiredZ = targetPos.z;
    const desiredY = model.footOffsetY + model.capsule.height / 2;  // 始终贴地
    character.setNextKinematicTranslation({ x: desiredX, y: desiredY, z: desiredZ });

    // step physics
    world.timestep = Math.min(dt, 1 / 30); // 防止大 dt
    world.step();

    // 读实际位置（撞墙后被物理推回）
    const t = character.translation();
    sceneObj.position.x = t.x;
    sceneObj.position.y = t.y - model.capsule.height / 2 - model.footOffsetY;  // 角色脚底
    sceneObj.position.z = t.z;
    return { x: t.x, y: t.y, z: t.z };
  };

  const dispose = () => {
    // Rapier 0.19 没有显式 free，world.free() 释放所有
    world.free();
  };

  const raycastGround = (origin: { x: number; y: number; z: number }, maxDistance = 2): number | null => {
    try {
      const ray = new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 });
      const hit = world.castRay(ray, maxDistance, true);
      if (hit) {
        const p = ray.pointAt(hit.timeOfImpact);
        return p.y;
      }
    } catch (e) {
      console.warn('[PhysicsWorld.raycastGround] failed:', e);
    }
    return null;
  };

  return { rapier: RAPIER, world, character, characterCollider, ground, walls, step, raycastGround, dispose };
}
