/**
 * 数字人指令加载器
 *
 * 优先级: Hermes agent persona > 后端 /api/digital-human/instructions > 默认模板
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

/** 从 Hermes 后端拉取 */
export async function loadInstructionsForAgent(agentId: string): Promise<InstructionDoc> {
  const c = cache.get(agentId);
  if (c && c.expiresAt > Date.now()) return c.value;

  const doc = await fetchFromHermes(agentId) ||
              await fetchFromBackend(agentId) ||
              buildDefaultDoc(agentId);

  cache.set(agentId, { value: doc, expiresAt: Date.now() + CACHE_TTL_MS });
  return doc;
}

async function fetchFromHermes(agentId: string): Promise<InstructionDoc | null> {
  const base = process.env.HERMES_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:10003';
  try {
    const r = await fetch(`${base}/api/content/hermes/client/${encodeURIComponent(agentId)}`, {
      next: { revalidate: 0 },
    });
    if (!r.ok) return null;
    const payload = await r.json();
    const data = payload?.data || payload;
    if (!data?.systemPrompt) return null;
    return {
      id: `hermes_${agentId}`,
      agentId,
      name: data.name || agentId,
      description: data.description,
      prompt: data.systemPrompt,
      version: data.version || 1,
      updatedAt: data.updateTime || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchFromBackend(agentId: string): Promise<InstructionDoc | null> {
  // 同源 API 路由: /api/digital-human/instructions/[agentId]
  try {
    const base = process.env.NEXT_PUBLIC_SELF_URL || process.env.APP_BASE_URL || '';
    const url = base
      ? `${base}/api/digital-human/instructions/${encodeURIComponent(agentId)}`
      : `/api/digital-human/instructions/${encodeURIComponent(agentId)}`;
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
