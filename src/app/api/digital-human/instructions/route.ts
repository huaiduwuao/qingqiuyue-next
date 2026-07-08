/**
 * /api/digital-human/instructions
 *
 *   GET    /api/digital-human/instructions                 — list all
 *   POST   /api/digital-human/instructions                 — create
 *
 * 数据存在 file-system (开发) / 数据库 (生产可替换).
 * 路径: <cwd>/data/digital-human-instructions.json
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PERSONA_PRESETS } from '@/digital-human/instructions/presets';
import { invalidateInstructionsCache } from '@/digital-human/instructions/loader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STORE_PATH = path.join(process.cwd(), 'data', 'digital-human-instructions.json');

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

async function ensureStore(): Promise<Instruction[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    const initial: Instruction[] = PERSONA_PRESETS.map(p => ({
      id: p.id,
      agentId: p.id,
      name: p.name,
      description: p.description,
      prompt: p.prompt,
      version: 1,
      updatedAt: new Date(0).toISOString(),
      isDefault: true,
    }));
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

async function saveStore(list: Instruction[]) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(list, null, 2), 'utf-8');
}

export async function GET(req: NextRequest) {
  try {
    const all = await ensureStore();
    return NextResponse.json({ instructions: all, total: all.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentId, name, description, prompt, tags = [], updatedBy } = body;
    if (!agentId || !prompt) {
      return NextResponse.json({ error: 'agentId + prompt required' }, { status: 400 });
    }
    const all = await ensureStore();
    if (all.some(i => i.agentId === agentId)) {
      return NextResponse.json({ error: 'agentId exists, use PUT to update' }, { status: 409 });
    }
    const doc: Instruction = {
      id: crypto.randomBytes(8).toString('hex'),
      agentId,
      name: name || agentId,
      description,
      prompt,
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy,
      tags,
    };
    all.push(doc);
    await saveStore(all);
    invalidateInstructionsCache(agentId);
    return NextResponse.json(doc);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
