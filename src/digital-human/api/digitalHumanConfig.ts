/**
 * api/digitalHumanConfig.ts — 数字人配置 + 会话 API 客户端
 *
 * Phase 2.4：7 套 CRUD + sessions/me 的 fetch 封装。
 * 默认 baseURL 走 /api/realtime/digital-human（与 Next.js 现有路由一致）。
 * 失败时调用方应 fallback 到本地 seed JSON（loader.ts 已处理）。
 */

import type {
  VrmModelConfig, ActionConfig, DanceStyleConfig, PoseConfig,
  ExpressionPresetConfig, VisemeConfig, SceneConfig, CharacterSession,
} from '../vrm/config/types';

const BASE = '/api/realtime/digital-human';

async function jget<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    // 后端返回格式 { data: T, total?: N } 或 T
    return (data.data ?? data) as T;
  } catch (e) {
    console.warn(`[digitalHumanConfig] GET ${url} failed:`, e);
    return null;
  }
}

async function jsend<T>(method: 'POST' | 'PUT' | 'DELETE', url: string, body?: any): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.data ?? data) as T;
  } catch (e) {
    console.warn(`[digitalHumanConfig] ${method} ${url} failed:`, e);
    return null;
  }
}

// ---------- Models ----------
export const listModels = () => jget<VrmModelConfig[]>(`${BASE}/models`);
export const getModel = (id: string) => jget<VrmModelConfig>(`${BASE}/models/${id}`);
export const createModel = (e: VrmModelConfig) => jsend<VrmModelConfig>('POST', `${BASE}/models`, e);
export const updateModel = (id: string, e: VrmModelConfig) => jsend<VrmModelConfig>('PUT', `${BASE}/models/${id}`, e);
export const deleteModel = (id: string) => jsend<{ deleted: string }>('DELETE', `${BASE}/models/${id}`);

// ---------- Actions ----------
export const listActions = (modelId?: string) =>
  jget<ActionConfig[]>(`${BASE}/actions${modelId ? `?modelId=${encodeURIComponent(modelId)}` : ''}`);
export const getAction = (id: string) => jget<ActionConfig>(`${BASE}/actions/${id}`);
export const createAction = (e: ActionConfig) => jsend<ActionConfig>('POST', `${BASE}/actions`, e);
export const updateAction = (id: string, e: ActionConfig) => jsend<ActionConfig>('PUT', `${BASE}/actions/${id}`, e);
export const deleteAction = (id: string) => jsend<{ deleted: string }>('DELETE', `${BASE}/actions/${id}`);

// ---------- Dance Styles ----------
export const listDanceStyles = (modelId?: string) =>
  jget<DanceStyleConfig[]>(`${BASE}/dance-styles${modelId ? `?modelId=${encodeURIComponent(modelId)}` : ''}`);
export const getDanceStyle = (id: string) => jget<DanceStyleConfig>(`${BASE}/dance-styles/${id}`);
export const createDanceStyle = (e: DanceStyleConfig) => jsend<DanceStyleConfig>('POST', `${BASE}/dance-styles`, e);
export const updateDanceStyle = (id: string, e: DanceStyleConfig) => jsend<DanceStyleConfig>('PUT', `${BASE}/dance-styles/${id}`, e);
export const deleteDanceStyle = (id: string) => jsend<{ deleted: string }>('DELETE', `${BASE}/dance-styles/${id}`);

// ---------- Poses ----------
export const listPoses = (modelId?: string) =>
  jget<PoseConfig[]>(`${BASE}/poses${modelId ? `?modelId=${encodeURIComponent(modelId)}` : ''}`);
export const getPose = (id: string) => jget<PoseConfig>(`${BASE}/poses/${id}`);
export const createPose = (e: PoseConfig) => jsend<PoseConfig>('POST', `${BASE}/poses`, e);
export const updatePose = (id: string, e: PoseConfig) => jsend<PoseConfig>('PUT', `${BASE}/poses/${id}`, e);
export const deletePose = (id: string) => jsend<{ deleted: string }>('DELETE', `${BASE}/poses/${id}`);

// ---------- Expression Presets ----------
export const listExpressionPresets = (modelId?: string) =>
  jget<ExpressionPresetConfig[]>(`${BASE}/expression-presets${modelId ? `?modelId=${encodeURIComponent(modelId)}` : ''}`);
export const getExpressionPreset = (id: string) => jget<ExpressionPresetConfig>(`${BASE}/expression-presets/${id}`);
export const createExpressionPreset = (e: ExpressionPresetConfig) => jsend<ExpressionPresetConfig>('POST', `${BASE}/expression-presets`, e);
export const updateExpressionPreset = (id: string, e: ExpressionPresetConfig) => jsend<ExpressionPresetConfig>('PUT', `${BASE}/expression-presets/${id}`, e);
export const deleteExpressionPreset = (id: string) => jsend<{ deleted: string }>('DELETE', `${BASE}/expression-presets/${id}`);

// ---------- Visemes ----------
export const listVisemes = (modelId?: string) =>
  jget<VisemeConfig[]>(`${BASE}/visemes${modelId ? `?modelId=${encodeURIComponent(modelId)}` : ''}`);
export const getViseme = (id: string) => jget<VisemeConfig>(`${BASE}/visemes/${id}`);
export const createViseme = (e: VisemeConfig) => jsend<VisemeConfig>('POST', `${BASE}/visemes`, e);
export const updateViseme = (id: string, e: VisemeConfig) => jsend<VisemeConfig>('PUT', `${BASE}/visemes/${id}`, e);
export const deleteViseme = (id: string) => jsend<{ deleted: string }>('DELETE', `${BASE}/visemes/${id}`);

// ---------- Scenes ----------
export const listScenes = () => jget<SceneConfig[]>(`${BASE}/scenes`);
export const getScene = (id: string) => jget<SceneConfig>(`${BASE}/scenes/${id}`);
export const getSceneByName = (name: string) => jget<SceneConfig>(`${BASE}/scenes/by-name/${encodeURIComponent(name)}`);
export const createScene = (e: SceneConfig) => jsend<SceneConfig>('POST', `${BASE}/scenes`, e);
export const updateScene = (id: string, e: SceneConfig) => jsend<SceneConfig>('PUT', `${BASE}/scenes/${id}`, e);
export const deleteScene = (id: string) => jsend<{ deleted: string }>('DELETE', `${BASE}/scenes/${id}`);

// ---------- Sessions ----------
export async function getMySession(userId: string): Promise<CharacterSession | null> {
  if (!userId) return null;
  const r = await jget<{ session: CharacterSession | null }>(`${BASE}/sessions/me?userId=${encodeURIComponent(userId)}`);
  return r?.session ?? null;
}
export const upsertMySession = (s: CharacterSession) =>
  jsend<{ session: CharacterSession }>('PUT', `${BASE}/sessions/me`, s);
