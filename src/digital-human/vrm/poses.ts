/**
 * vrm/poses.ts — 6 个程序化姿势的目标骨骼旋转
 *
 * 数值来自 vrm-stage-pro.html 的 POSES 表。
 * bone 名是 VRM 1.0 camelCase 规范（与项目 character.vrm 0.0 兼容 — BlenderAvatar 内部有 PascalCase 兜底）。
 */

import type { PoseName } from './types';

type Rot = [x: number, y: number, z: number];
type PoseSpec = Partial<Record<string, Rot>>;

export const POSES: Record<PoseName, PoseSpec> = {
  // 待机：手臂自然下垂
  idle: {
    leftUpperArm: [0, 0, -1.15],
    rightUpperArm: [0, 0, 1.15],
    leftLowerArm: [0, 0, -0.15],
    rightLowerArm: [0, 0, 0.15],
    leftUpperLeg: [0, 0, 0],
    rightUpperLeg: [0, 0, 0],
    leftLowerLeg: [0, 0, 0],
    rightLowerLeg: [0, 0, 0],
    spine: [0, 0, 0],
    chest: [0, 0, 0],
    neck: [0, 0, 0],
    head: [0, 0, 0],
  },
  // 单手挥手：右臂举起
  wave: {
    leftUpperArm: [0, 0, -0.2],
    rightUpperArm: [0, 0, 1.95],
    rightLowerArm: [0, 0, 1.3],
    leftLowerArm: [0, 0, -0.15],
    spine: [0, 0, 0], chest: [0, 0, 0],
    neck: [0, -0.15, 0], head: [0, -0.2, 0],
  },
  // 双手举起
  bothUp: {
    leftUpperArm: [0, 0, -2.6],
    rightUpperArm: [0, 0, 2.6],
    leftLowerArm: [0, 0, -0.3],
    rightLowerArm: [0, 0, 0.3],
    leftUpperLeg: [0, 0, 0], rightUpperLeg: [0, 0, 0],
  },
  // 叉腰
  akimbo: {
    leftUpperArm: [0, 0, -0.7],
    rightUpperArm: [0, 0, 0.7],
    leftLowerArm: [-1.4, 0, -0.1],
    rightLowerArm: [1.4, 0, 0.1],
    spine: [0, 0, 0], chest: [0, 0, 0],
  },
  // 指向：右臂水平伸
  point: {
    leftUpperArm: [0, 0, -0.3],
    rightUpperArm: [0, 0, 1.5],
    rightLowerArm: [0, 0, 0.4],
    leftLowerArm: [0, 0, -0.15],
    neck: [0, -0.4, 0], head: [0, -0.3, 0],
  },
  // 比心/合十：双手胸前合拢
  pray: {
    leftUpperArm: [0, 0, -1.1],
    rightUpperArm: [0, 0, 1.1],
    leftLowerArm: [-0.4, 0, -0.6],
    rightLowerArm: [0.4, 0, 0.6],
    chest: [0, 0, 0],
  },
};
