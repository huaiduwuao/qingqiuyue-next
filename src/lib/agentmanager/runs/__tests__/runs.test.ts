import { describe, expect, it } from 'vitest'
import { parseSSE, type RunEvent } from '../api'
import { toTimeline } from '../timeline'

const ev = (seq: number, t: string, data?: any): RunEvent => ({ seq, session_id: 'run:x', t, ts: '', data })

describe('parseSSE', () => {
  it('splits complete frames and keeps the unfinished tail', () => {
    const buf =
      'id: 1\nevent: run.queued\ndata: {"seq":1,"t":"run.queued"}\n\n' +
      ': ping\n\n' +
      'id: 2\ndata: {"seq":2,"t":"msg.delta","data":{"text":"你好"}}\n\n' +
      'id: 3\ndata: {"seq":3,'
    const { events, rest } = parseSSE(buf)
    expect(events.map((e) => e.seq)).toEqual([1, 2])
    expect(events[1].data.text).toBe('你好')
    expect(rest).toBe('id: 3\ndata: {"seq":3,')
  })

  it('handles CRLF line endings and skips malformed frames', () => {
    const { events } = parseSSE('data: {"seq":1,"t":"a"}\r\n\r\ndata: {broken\r\n\r\ndata: {"seq":2,"t":"b"}\r\n\r\n')
    expect(events.map((e) => e.t)).toEqual(['a', 'b'])
  })
})

describe('toTimeline', () => {
  it('merges text deltas and pairs tool calls with results', () => {
    const items = toTimeline([
      ev(1, 'run.started'),
      ev(2, 'msg.delta', { text: '我先' }),
      ev(3, 'msg.delta', { text: '算一下' }),
      ev(4, 'tool.call', { name: 'sandbox_exec', args: '{"command":"python3 -c 1+1"}' }),
      ev(5, 'tool.result', { name: 'sandbox_exec', result: 'exit_code: 0\n2' }),
      ev(6, 'msg.delta', { text: '结果是 2' }),
      ev(7, 'run.finished', { status: 'succeeded' }),
    ])
    expect(items.map((i) => i.kind)).toEqual(['note', 'text', 'tool', 'text', 'note'])
    expect(items[1]).toEqual({ kind: 'text', text: '我先算一下' })
    expect(items[2]).toMatchObject({ kind: 'tool', name: 'sandbox_exec', done: true, isError: false })
  })

  it('shows approvals and failures as notes', () => {
    const items = toTimeline([
      ev(1, 'approval.requested', { tool: 'bounty_create' }),
      ev(2, 'approval.decided', { decision: 'rejected' }),
      ev(3, 'run.error', { error: '运行超时' }),
    ])
    expect(items).toEqual([
      { kind: 'note', tone: 'warning', text: '等待确认:bounty_create' },
      { kind: 'note', tone: 'warning', text: '已驳回,操作没有执行' },
      { kind: 'note', tone: 'error', text: '失败:运行超时' },
    ])
  })
})
