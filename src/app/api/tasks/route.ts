import { NextRequest, NextResponse } from 'next/server'
import * as taskStore from '@/lib/task-engine/store'
import type { CreateTaskOptions } from '@/lib/task-engine/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/tasks — 创建通用异步任务
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<CreateTaskOptions>
    if (!body.taskType) {
      return NextResponse.json({ error: 'taskType is required' }, { status: 400 })
    }
    const task = taskStore.createTask({
      taskType: body.taskType,
      userId: body.userId,
      conversationId: body.conversationId,
      agentId: body.agentId,
      prompt: body.prompt,
      payload: body.payload,
      context: body.context,
    })
    return NextResponse.json({ taskId: task.id, status: task.status })
  } catch (e) {
    console.error('[api/tasks] create failed:', (e as Error).message)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
