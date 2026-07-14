/**
 * 数字人指令加载器
 *
 * 从 Go 后端 /api/digital-human/instructions/[agentId] 获取
 * 回退到默认模板（仅当后端不可用时）
 *
 * 用法 (服务端):
 *   const prompt = await loadInstructionsForAgent('qingqiuyue_default');
 */

import { DEFAULT_DIGITAL_HUMAN_INSTRUCTIONS, PERSONA_PRESETS } from './presets';

export interface InstructionDoc {
  id: string;
  agentId: string;
  name: string;
  description?: string;
  prompt: string;
  version: number;
  updatedAt: string;
  updatedBy?: string;
}

interface CacheEntry {
  value: InstructionDoc;
  expiresAt: number;
}
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

/** 从 Go 后端数据库拉取 */
export async function loadInstructionsForAgent(agentId: string): Promise<InstructionDoc> {
  const c = cache.get(agentId);
  if (c && c.expiresAt > Date.now()) return c.value;

  const doc = await fetchFromBackend(agentId) || buildDefaultDoc(agentId);

  cache.set(agentId, { value: doc, expiresAt: Date.now() + CACHE_TTL_MS });
  return doc;
}

async function fetchFromBackend(agentId: string): Promise<InstructionDoc | null> {
  // 走 Next.js 自身透传到 Go 后端
  try {
    const url = `/api/digital-human/instructions/${encodeURIComponent(agentId)}`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    const data = await r.json();
    if (!data?.prompt) return null;
    return {
      id: data.id || `backend_${agentId}`,
      agentId,
      name: data.name || agentId,
      description: data.description,
      prompt: data.prompt,
      version: data.version || 1,
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function buildDefaultDoc(agentId: string): InstructionDoc {
  const preset = PERSONA_PRESETS.find(p => p.id === agentId);
  if (preset) {
    return {
      id: preset.id,
      agentId,
      name: preset.name,
      description: preset.description,
      prompt: preset.prompt,
      version: 1,
      updatedAt: new Date(0).toISOString(),
    };
  }
  return {
    id: `default_${agentId}`,
    agentId,
    name: '默认指令',
    prompt: DEFAULT_DIGITAL_HUMAN_INSTRUCTIONS,
    version: 1,
    updatedAt: new Date(0).toISOString(),
  };
}

/** 清缓存 — 管理员修改后调用 */
export function invalidateInstructionsCache(agentId?: string) {
  if (agentId) cache.delete(agentId);
  else cache.clear();
}
