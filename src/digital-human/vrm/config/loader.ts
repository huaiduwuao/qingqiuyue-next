/**
 * vrm/config/loader.ts — 配置加载器
 *
 * Phase 1：从 src/data/seed/ 静态 import JSON
 * Phase 2：先 fetch /api/realtime/digital-human/* → 失败时 fallback 到静态 JSON
 *
 * 返回完整的 ConfigBundle（model + scenes + actions + dances + poses + expressions + visemes）
 * 一次拉齐，VrmStage 整个生命周期不重新加载。
 *
 * 同步入口（loadConfigBundle）：模块加载时立即返回 seed JSON，
 *   tools/*.ts 能在 import 时生成字典（保持向后兼容）
 * 异步入口（loadConfigBundleAsync）：先 fetch API，再用 API 数据覆盖
 *   VrmStage mount 时调用，模型配置变化时无需重启
 */

import modelCharacter from '../../../data/seed/models/character.json';
import sceneConcert from '../../../data/seed/scenes/concert.json';
import sceneIdol from '../../../data/seed/scenes/idol.json';
import sceneGarden from '../../../data/seed/scenes/garden.json';
import sceneNeon from '../../../data/seed/scenes/neon.json';
import sceneStudio from '../../../data/seed/scenes/studio.json';
import sceneLawn from '../../../data/seed/scenes/lawn.json';
import actionsCharacter from '../../../data/seed/actions/character.json';
import dancesCharacter from '../../../data/seed/dances/character.json';
import posesCharacter from '../../../data/seed/poses/character.json';
import expressionsCharacter from '../../../data/seed/expressions/character.json';
import visemesCharacter from '../../../data/seed/visemes/character.json';

import type {
  VrmModelConfig, SceneConfig, ActionConfig, DanceStyleConfig,
  PoseConfig, ExpressionPresetConfig, VisemeConfig, ConfigBundle,
} from './types';

const SCENES: SceneConfig[] = [
  sceneConcert as unknown as SceneConfig,
  sceneIdol as unknown as SceneConfig,
  sceneGarden as unknown as SceneConfig,
  sceneNeon as unknown as SceneConfig,
  sceneStudio as unknown as SceneConfig,
  sceneLawn as unknown as SceneConfig,
];

/** 默认 model 总是 character（Phase 2 改成多 model） */
const DEFAULT_MODEL = modelCharacter as unknown as VrmModelConfig;

let BUNDLE: ConfigBundle = {
  model: DEFAULT_MODEL,
  scenes: SCENES,
  actions: actionsCharacter as unknown as ActionConfig[],
  danceStyles: dancesCharacter as unknown as DanceStyleConfig[],
  poses: posesCharacter as unknown as PoseConfig[],
  expressions: expressionsCharacter as unknown as ExpressionPresetConfig[],
  visemes: visemesCharacter as unknown as VisemeConfig[],
};

/** 同步加载（Phase 1 静态 JSON；Phase 2 改成 async fetch） */
export function loadConfigBundle(): ConfigBundle {
  console.log('[config] 加载 ConfigBundle:', {
    model: BUNDLE.model.name,
    scenes: BUNDLE.scenes.map((s) => s.name),
    actions: BUNDLE.actions.length,
    danceStyles: BUNDLE.danceStyles.length,
    poses: BUNDLE.poses.length,
    expressions: BUNDLE.expressions.length,
    visemes: BUNDLE.visemes.length,
  });
  return BUNDLE;
}

/** 工具：按 name 查（O(1) Map） */
export function buildLookups(bundle: ConfigBundle) {
  const sceneByName = new Map(bundle.scenes.map((s) => [s.name, s]));
  const actionByName = new Map(bundle.actions.map((a) => [a.name, a]));
  const danceByName = new Map(bundle.danceStyles.map((d) => [d.name, d]));
  const poseByName = new Map(bundle.poses.map((p) => [p.name, p]));
  const expressionByName = new Map(bundle.expressions.map((e) => [e.name, e]));
  const visemeByName = new Map(bundle.visemes.map((v) => [v.name, v]));
  return { sceneByName, actionByName, danceByName, poseByName, expressionByName, visemeByName };
}

/** 异步加载：从 API 拉所有 config，覆盖模块级 BUNDLE
 *  返回 Promise<ConfigBundle>（resolve 为最终生效的 bundle）
 *  失败时 fallback 到 seed JSON（不抛错）
 */
export async function loadConfigBundleAsync(): Promise<ConfigBundle> {
  if (typeof window === 'undefined') return BUNDLE; // SSR 阶段不动
  try {
    const [
      models, actions, danceStyles, poses, expressions, visemes, scenes,
    ] = await Promise.all([
      import('../../api/digitalHumanConfig').then(m => m.listModels()),
      import('../../api/digitalHumanConfig').then(m => m.listActions('character')),
      import('../../api/digitalHumanConfig').then(m => m.listDanceStyles('character')),
      import('../../api/digitalHumanConfig').then(m => m.listPoses('character')),
      import('../../api/digitalHumanConfig').then(m => m.listExpressionPresets('character')),
      import('../../api/digitalHumanConfig').then(m => m.listVisemes('character')),
      import('../../api/digitalHumanConfig').then(m => m.listScenes()),
    ]);
    // 只在所有都拿到的情况下覆盖（部分失败保留 seed）
    if (models && models.length && actions && danceStyles && poses && expressions && visemes && scenes) {
      BUNDLE = {
        model: models[0],
        scenes: scenes!,
        actions: actions!,
        danceStyles: danceStyles!,
        poses: poses!,
        expressions: expressions!,
        visemes: visemes!,
      };
      console.log('[loader] 异步覆盖 ConfigBundle:', {
        model: BUNDLE.model.name,
        actions: BUNDLE.actions.length,
        scenes: BUNDLE.scenes.length,
      });
    }
  } catch (e) {
    console.warn('[loader] loadConfigBundleAsync failed, fallback to seed:', e);
  }
  return BUNDLE;
}

/** 默认 scene = isDefault=true 的 */
export function getDefaultScene(bundle: ConfigBundle): SceneConfig {
  return bundle.scenes.find((s) => s.isDefault) || bundle.scenes[0];
}

/**
 * 安全 eval formula（避免作用域污染）
 * - formula 是字符串 JS 表达式
 * - 入参 t, blend, A, bass, phase
 * - 返回 { bones, scenePosY?, scenePosX? }
 *
 * 错误处理：formula 失败时返回空 dict，不让整个角色崩溃
 */
export function safeEvalFormula(
  formula: string | undefined,
  ctx: { t: number; blend?: number; A?: number; bass?: number; phase?: number } = { t: 0 },
): { bones: Record<string, [number, number, number]>; scenePosY?: number; scenePosX?: number } {
  if (!formula) return { bones: {} };
  try {
    const fn = new Function('t', 'blend', 'A', 'bass', 'phase', `return (${formula});`);
    const result = fn(ctx.t, ctx.blend ?? 1, ctx.A ?? 1, ctx.bass ?? 0, ctx.phase ?? 0);
    if (!result || typeof result !== 'object') return { bones: {} };
    return {
      bones: result.bones || {},
      scenePosY: result.scenePosY,
      scenePosX: result.scenePosX,
    };
  } catch (e) {
    console.warn('[safeEvalFormula] failed:', e, 'formula:', formula.slice(0, 100));
    return { bones: {} };
  }
}
