/**
 * vrm/vrmCompat.ts — VRM 0.0 ↔ 1.0 兼容层
 *
 * 项目 character.vrm 实际是 VRM 0.0 格式（虽然 BlenderAvatar.tsx 注释标 0.0），
 * 它和 VRM 1.0 的差异：
 *   表情：0.0 用 joy/sorrow/fun/viseme_aa，1.0 用 happy/sad/surprised/aa
 *   骨骼：0.0 用 PascalCase（LeftUpperArm），1.0 用 camelCase（leftUpperArm）
 *   自定义 blendshape：1.0 直接 52 维 ARKit 名，0.0 不一定有
 *
 * 这个模块提供：
 *   - mapExpressionName(name, version)  → 返回当前 VRM 认识的别名
 *   - setExpression(em, name, value, version)  → 智能 setValue（兜底 ARKit→0.0）
 *   - getBone(humanoid, name)  → 兼容 camelCase/PascalCase
 */

import type { VRMExpressionPresetName } from '@pixiv/three-vrm';

/** ARKit 52 维 → VRM 1.0 预设表情的映射 */
const ARKIT_TO_VRM1_PRESET: Record<string, string> = {
  // 嘴型
  mouthSmileLeft: 'happy',
  mouthSmileRight: 'happy',
  mouthOpen: 'surprised',  // 张嘴 ≈ 惊讶
  mouthPucker: 'surprised', // 嘟嘴 ≈ 惊讶
  // 眼型
  eyeSquintLeft: 'happy',
  eyeSquintRight: 'happy',
  eyeWideLeft: 'surprised',
  eyeWideRight: 'surprised',
  eyeBlinkLeft: 'happy',
  eyeBlinkRight: 'happy',
  // 脸颊
  cheekSquintLeft: 'happy',
  cheekSquintRight: 'happy',
  // 眉毛
  browOuterUpLeft: 'happy',
  browOuterUpRight: 'happy',
  browDownLeft: 'angry',
  browDownRight: 'angry',
  // 其他
  jawOpen: 'surprised',
};

/** ARKit 52 维 → VRM 0.0 预设/viseme 的映射（仅 0.0 缺时才需要映射） */
const ARKIT_TO_VRM0: Record<string, string> = {
  // 表情
  happy: 'joy',
  sad: 'sorrow',
  surprised: 'fun',
  // 嘴型（VRM 0.0 用 viseme_ 前缀，1.0 直接用）
  aa: 'viseme_aa',
  ih: 'viseme_ih',
  ou: 'viseme_ou',
  ee: 'viseme_E',
  oh: 'viseme_O',
  E: 'viseme_E',
  I: 'viseme_I',
  O: 'viseme_O',
  U: 'viseme_U',
  // VRM 1.0 旧版别名
  blinkLeft: 'blinkLeft',
  blinkRight: 'blinkRight',
};

/** VRM 0.0 → ARKit 反向映射（用于 0.0 preset 读出后转 ARKit） */
const VRM0_TO_ARKIT: Record<string, string> = {
  joy: 'happy',
  sorrow: 'sad',
  fun: 'surprised',
  viseme_aa: 'aa',
  viseme_ih: 'ih',
  viseme_ou: 'ou',
  viseme_E: 'ee',
  viseme_O: 'oh',
};

/** 推断 VRM 版本：1 = VRM 1.0，0 = VRM 0.0 */
export function detectVrmVersion(vrm: any): 0 | 1 {
  const metaVersion: string = (vrm?.meta as any)?.metaVersion || '1';
  return String(metaVersion).startsWith('0') ? 0 : 1;
}

/** 在 expressionManager 上 setValue，兼容 0.0/1.0 命名 */
export function setExpression(em: any, name: string, value: number, version: 0 | 1): boolean {
  if (!em) return false;
  // 1.0：先尝试直接设置 ARKit 名称（如果模型支持），再尝试映射到预设
  if (version === 1) {
    em.setValue(name, value);
    // 如果直接设置失败，尝试映射到 VRM 1.0 预设
    if (ARKIT_TO_VRM1_PRESET[name]) {
      em.setValue(ARKIT_TO_VRM1_PRESET[name], value);
    }
    return true;
  }
  // 0.0：先试原名（如 0.0 也定义了 52 维 ARKit 自定义通道），再映射
  // setValue 不会抛错，但模型若无此 preset 就是 no-op
  em.setValue(name, value);
  if (ARKIT_TO_VRM0[name]) {
    em.setValue(ARKIT_TO_VRM0[name], value);
  }
  return true;
}

/** 表情 dict 整批设（兼容 0.0/1.0） */
export function setExpressionDict(em: any, dict: Record<string, number>, version: 0 | 1): void {
  if (!em) return;
  for (const [k, v] of Object.entries(dict)) {
    setExpression(em, k, v, version);
  }
}

/** 兼容 camelCase/PascalCase 取骨骼（VRM 0.0 骨骼名是 PascalCase，1.0 是 camelCase） */
export function getBone(humanoid: any, name: string): any {
  if (!humanoid) return null;
  // 1.0 camelCase
  let node = humanoid.getNormalizedBoneNode?.(name);
  if (node) return node;
  // 0.0 PascalCase（仅首字母大写）
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);
  node = humanoid.getNormalizedBoneNode?.(pascal);
  if (node) return node;
  // 0.0 全部 PascalCase（LeftUpperArm → LEFTUPPERARM）
  const upper = name.toUpperCase();
  node = humanoid.getNormalizedBoneNode?.(upper);
  return node || null;
}

/** 取模型所有可用的 expression 名（用于调试） */
export function listAvailableExpressions(em: any): string[] {
  if (!em) return [];
  const out: string[] = [];
  // VRM 0.x/1.x 的 expressionManager 都有 _expressionMap
  if (em._expressionMap) {
    for (const k of Object.keys(em._expressionMap)) out.push(k);
  } else if (em._blendShapeGroups) {
    for (const k of Object.keys(em._blendShapeGroups)) out.push(k);
  }
  return out;
}
