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
export const getModel = (id: number) => jget<VrmModelConfig>(`${BASE}/models/${id}`);
export const createModel = (e: VrmModelConfig) => jsend<VrmModelConfig>('POST', `${BASE}/models`, e);
export const updateModel = (id: number, e: VrmModelConfig) => jsend<VrmModelConfig>('PUT', `${BASE}/models/${id}`, e);
export const deleteModel = (id: number) => jsend<{ deleted: number }>('DELETE', `${BASE}/models/${id}`);

// ---------- Actions ----------
export const listActions = (modelId?: string) =>
  jget<ActionConfig[]>(`${BASE}/actions${modelId ? `?modelId=${encodeURIComponent(modelId)}` : ''}`);
export const getAction = (id: number) => jget<ActionConfig>(`${BASE}/actions/${id}`);
export const createAction = (e: ActionConfig) => jsend<ActionConfig>('POST', `${BASE}/actions`, e);
export const updateAction = (id: number, e: ActionConfig) => jsend<ActionConfig>('PUT', `${BASE}/actions/${id}`, e);
export const deleteAction = (id: number) => jsend<{ deleted: number }>('DELETE', `${BASE}/actions/${id}`);

// ---------- Dance Styles ----------
export const listDanceStyles = (modelId?: string) =>
  jget<DanceStyleConfig[]>(`${BASE}/dance-styles${modelId ? `?modelId=${encodeURIComponent(modelId)}` : ''}`);

// ---------- Poses ----------
export const listPoses = (modelId?: string) =>
  jget<PoseConfig[]>(`${BASE}/poses${modelId ? `?modelId=${encodeURIComponent(modelId)}` : ''}`);

// ---------- Expression Presets ----------
export const listExpressionPresets = (modelId?: string) =>
  jget<ExpressionPresetConfig[]>(`${BASE}/expression-presets${modelId ? `?modelId=${encodeURIComponent(modelId)}` : ''}`);

// ---------- Visemes ----------
export const listVisemes = (modelId?: string) =>
  jget<VisemeConfig[]>(`${BASE}/visemes${modelId ? `?modelId=${encodeURIComponent(modelId)}` : ''}`);

// ---------- Scenes ----------
export const listScenes = () => jget<SceneConfig[]>(`${BASE}/scenes`);
export const getScene = (id: number) => jget<SceneConfig>(`${BASE}/scenes/${id}`);
export const getSceneByName = (name: string) => jget<SceneConfig>(`${BASE}/scenes/by-name/${encodeURIComponent(name)}`);
export const createScene = (e: SceneConfig) => jsend<SceneConfig>('POST', `${BASE}/scenes`, e);
export const updateScene = (id: number, e: SceneConfig) => jsend<SceneConfig>('PUT', `${BASE}/scenes/${id}`, e);
export const deleteScene = (id: number) => jsend<{ deleted: number }>('DELETE', `${BASE}/scenes/${id}`);

// ---------- Sessions ----------
export async function getMySession(userId: string): Promise<CharacterSession | null> {
  if (!userId) return null;
  const r = await jget<{ session: CharacterSession | null }>(`${BASE}/sessions/me?userId=${encodeURIComponent(userId)}`);
  return r?.session ?? null;
}
export const upsertMySession = (s: CharacterSession) =>
  jsend<{ session: CharacterSession }>('PUT', `${BASE}/sessions/me`, s);
