import type { RunEvent } from './api'

export type TimelineItem =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; args?: string; result?: string; isError?: boolean; done: boolean }
  | { kind: 'note'; text: string; tone: 'info' | 'warning' | 'error' | 'success' }

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

const DECISION: Record<string, string> = {
  approved: '已批准,继续执行',
  rejected: '已驳回,操作没有执行',
  expired: '确认超时,操作没有执行',
}

/**
 * 把运行事件折叠成可读的时间线:连续的文本增量合成一段,工具调用与它的结果配对。
 * 每次都从头算(输入是完整事件列表),不会改动传入的事件。
 */
export function toTimeline(events: RunEvent[]): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const e of events) {
    const d = e.data || {}
    switch (e.t) {
      case 'run.queued':
        items.push({ kind: 'note', tone: 'info', text: `已排队${d.agent ? `(${d.agent})` : ''}` })
        break
      case 'run.started':
        items.push({ kind: 'note', tone: 'info', text: '开始执行' })
        break
      case 'msg.delta': {
        const last = items[items.length - 1]
        if (last && last.kind === 'text') last.text += d.text ?? ''
        else items.push({ kind: 'text', text: d.text ?? '' })
        break
      }
      case 'tool.call':
        items.push({ kind: 'tool', name: d.name, args: d.args, done: false })
        break
      case 'tool.result': {
        let paired = false
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i]
          if (it.kind === 'tool' && !it.done && it.name === d.name) {
            it.result = d.result
            it.isError = !!d.is_error
            it.done = true
            paired = true
            break
          }
        }
        if (!paired) items.push({ kind: 'tool', name: d.name, result: d.result, isError: !!d.is_error, done: true })
        break
      }
      case 'approval.requested':
        items.push({ kind: 'note', tone: 'warning', text: `等待确认:${d.tool}` })
        break
      case 'approval.decided':
        items.push({
          kind: 'note',
          tone: d.decision === 'approved' ? 'success' : 'warning',
          text: DECISION[d.decision] ?? String(d.decision),
        })
        break
      case 'agent.delegated':
        items.push({ kind: 'note', tone: 'info', text: `交给 ${d.agent} 的子任务已开始:${clip(d.task ?? '', 120)}` })
        break
      case 'agent.returned': {
        const ok = d.status === 'succeeded'
        items.push({
          kind: 'note',
          tone: ok ? 'success' : 'warning',
          text: `${d.agent} 的子任务${ok ? '完成' : d.status === 'cancelled' ? '被取消' : '失败'}${d.summary ? `:${clip(d.summary, 200)}` : ''}`,
        })
        break
      }
      case 'run.finished':
        items.push({ kind: 'note', tone: 'success', text: '已完成' })
        break
      case 'run.error':
        items.push({ kind: 'note', tone: 'error', text: `失败:${d.error || '未知错误'}` })
        break
      case 'run.cancelled':
        items.push({ kind: 'note', tone: 'warning', text: '已取消' })
        break
    }
  }
  return items
}
