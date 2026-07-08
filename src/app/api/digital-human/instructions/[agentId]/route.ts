/**
 * /api/digital-human/instructions/[agentId]
 *
 *   GET    /[agentId]  — fetch one
 *   PUT    /[agentId]  — update (bump version)
 *   DELETE /[agentId]  — delete
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { invalidateInstructionsCache } from '@/digital-human/instructions/loader';
import { invalidateInstructionsCache as _inv } from '@/digital-human/instructions/loader';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STORE_PATH = path.join(process.cwd(), 'data', 'digital-human-instructions.json');

interface Instruction {
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

async function loadStore(): Promise<Instruction[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveStore(list: Instruction[]) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(list, null, 2), 'utf-8');
}

export async function GET(req: NextRequest, ctx: { params: { agentId: string } }) {
  try {
    const agentId = decodeURIComponent(ctx.params.agentId);
    const all = await loadStore();
    const doc = all.find(i => i.agentId === agentId);
    if (!doc) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(doc);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: { params: { agentId: string } }) {
  try {
    const agentId = decodeURIComponent(ctx.params.agentId);
    const body = await req.json();
    const all = await loadStore();
    const idx = all.findIndex(i => i.agentId === agentId);
    if (idx < 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const old = all[idx];
    const updated: Instruction = {
      ...old,
      ...body,
      agentId,                       // 不允许改 id
      id: old.id,
      version: old.version + 1,
      updatedAt: new Date().toISOString(),
    };
    all[idx] = updated;
    await saveStore(all);
    invalidateInstructionsCache(agentId);
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { agentId: string } }) {
  try {
    const agentId = decodeURIComponent(ctx.params.agentId);
    const all = await loadStore();
    const idx = all.findIndex(i => i.agentId === agentId);
    if (idx < 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
    if (all[idx].isDefault) {
      return NextResponse.json({ error: 'cannot delete default template' }, { status: 403 });
    }
    all.splice(idx, 1);
    await saveStore(all);
    invalidateInstructionsCache(agentId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
