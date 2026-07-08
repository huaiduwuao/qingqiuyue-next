/**
 * 数字人管理 API 客户端
 * (走同源 /api/digital-human/*, 不需 adminClient)
 */

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

export const digitalHumanApi = {
  async listInstructions(): Promise<Instruction[]> {
    const r = await fetch('/api/digital-human/instructions');
    if (!r.ok) throw new Error(`list instructions ${r.status}`);
    const j = await r.json();
    return j.instructions || [];
  },

  async getInstruction(agentId: string): Promise<Instruction> {
    const r = await fetch(`/api/digital-human/instructions/${encodeURIComponent(agentId)}`);
    if (!r.ok) throw new Error(`get ${agentId} ${r.status}`);
    return r.json();
  },

  async createInstruction(data: Partial<Instruction>): Promise<Instruction> {
    const r = await fetch('/api/digital-human/instructions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`create ${r.status}: ${await r.text().catch(() => '')}`);
    return r.json();
  },

  async updateInstruction(agentId: string, data: Partial<Instruction>): Promise<Instruction> {
    const r = await fetch(`/api/digital-human/instructions/${encodeURIComponent(agentId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`update ${r.status}`);
    return r.json();
  },

  async deleteInstruction(agentId: string): Promise<void> {
    const r = await fetch(`/api/digital-human/instructions/${encodeURIComponent(agentId)}`, {
      method: 'DELETE',
    });
    if (!r.ok) throw new Error(`delete ${r.status}`);
  },

  async listTools(): Promise<{ tools: ToolSummary[]; fullSchema: any[] }> {
    const r = await fetch('/api/digital-human/tools');
    if (!r.ok) throw new Error(`tools ${r.status}`);
    return r.json();
  },
};
