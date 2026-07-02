import { NextRequest, NextResponse } from 'next/server'
import * as taskStore from '@/lib/task-engine/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/tasks/[taskId] — 查询任务状态
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await ctx.params
  const task = taskStore.getTask(taskId)
  if (!task) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(task)
}

// DELETE /api/tasks/[taskId] — 取消任务
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await ctx.params
  const task = taskStore.getTask(taskId)
  if (!task) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  taskStore.markCancelled(taskId)
  return NextResponse.json({ taskId, status: 'cancelled' })
}
