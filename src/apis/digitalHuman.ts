/**
 * 数字人管理 API 客户端
 * (走同源 /api/digital-human/*, 不需 adminClient)
 *
 * 后端(realtime-api digitalhuman 包)统一返回 {code, msg, data} 信封,
 * 这里用 unwrap 拆掉:code≠0 抛 msg,否则只把 data 交给调用方。
 * 以前直接 r.json() 当业务对象用,列表页永远是空的。
 */

import { API_PREFIX } from '@/lib/api/prefix';

export interface Instruction {
  id: string;
  agentId: string;
  name: string;
  description?: string;
  prompt: string;
  version: number;
  updatedAt: string;
  updatedBy?: string;
  tags?: string[];
  isDefault?: boolean;
}

export interface ToolSummary {
  name: string;
  category: string;
  description: string;
  params: string[];
}

interface Envelope<T> {
  code: number;
  msg?: string;
  data?: T;
}

async function unwrap<T>(r: Response, what: string): Promise<T> {
  if (!r.ok) throw new Error(`${what} ${r.status}: ${await r.text().catch(() => '')}`);
  const j = (await r.json()) as Envelope<T>;
  if (j.code !== 0) throw new Error(`${what}: ${j.msg || `code ${j.code}`}`);
  return j.data as T;
}

const jsonInit = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});

export const digitalHumanApi = {
  async listInstructions(): Promise<Instruction[]> {
    const r = await fetch(API_PREFIX + '/api/digital-human/instructions');
    const d = await unwrap<{ instructions?: Instruction[]; total?: number }>(r, 'list instructions');
    return d?.instructions || [];
  },

  async getInstruction(agentId: string): Promise<Instruction> {
    const r = await fetch(API_PREFIX + `/api/digital-human/instructions/${encodeURIComponent(agentId)}`);
    return unwrap<Instruction>(r, `get ${agentId}`);
  },

  async createInstruction(data: Partial<Instruction>): Promise<Instruction> {
    const r = await fetch(API_PREFIX + '/api/digital-human/instructions', jsonInit('POST', data));
    return unwrap<Instruction>(r, 'create');
  },

  async updateInstruction(agentId: string, data: Partial<Instruction>): Promise<Instruction> {
    const r = await fetch(API_PREFIX + `/api/digital-human/instructions/${encodeURIComponent(agentId)}`, jsonInit('PUT', data));
    return unwrap<Instruction>(r, `update ${agentId}`);
  },

  async deleteInstruction(agentId: string): Promise<void> {
    const r = await fetch(API_PREFIX + `/api/digital-human/instructions/${encodeURIComponent(agentId)}`, { method: 'DELETE' });
    await unwrap<{ deleted: string }>(r, `delete ${agentId}`);
  },

  async listTools(): Promise<{ tools: ToolSummary[]; fullSchema: any[] }> {
    const r = await fetch(API_PREFIX + '/api/digital-human/tools');
    // 后端 ToolSummary.params 是 "template, intensity" 这样的文本,UI 按数组渲染,这里拆开。
    const d = await unwrap<{
      tools?: Array<Omit<ToolSummary, 'params'> & { params?: string | string[] }>;
      fullSchema?: any[];
    }>(r, 'tools');
    const tools: ToolSummary[] = (d?.tools || []).map((t) => ({
      ...t,
      params: Array.isArray(t.params)
        ? t.params
        : String(t.params || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    }));
    return { tools, fullSchema: d?.fullSchema || [] };
  },
};
