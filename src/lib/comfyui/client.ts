/**
 * comfyui/client.ts — ComfyUI HTTP + WebSocket 客户端
 *
 * 封装 ComfyUI 原生 API:
 *   - POST /prompt 提交工作流
 *   - WebSocket /ws 监听实时进度
 *   - GET /history/{prompt_id} 查询结果
 *   - GET /view 下载产物
 */

import { randomUUID } from 'crypto'
import type {
  ComfyUIWorkflow,
  QueuePromptResponse,
  ComfyUIHistoryItem,
  ComfyUIProgressEvent,
  ComfyUIGeneratedFile,
} from './types'

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188'

export function buildComfyuiUrl(path: string): string {
  const base = COMFYUI_URL.replace(/\/$/, '')
  return `${base}${path}`
}

export async function queuePrompt(
  workflow: ComfyUIWorkflow,
  clientId?: string,
): Promise<QueuePromptResponse> {
  const cid = clientId || `c_${randomUUID().slice(0, 8)}`
  const r = await fetch(buildComfyuiUrl('/prompt'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id: cid }),
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`ComfyUI queuePrompt failed: ${r.status} ${text}`)
  }
  return r.json()
}

export async function getHistory(promptId: string): Promise<Record<string, ComfyUIHistoryItem>> {
  const r = await fetch(buildComfyuiUrl(`/history/${promptId}`))
  if (!r.ok) {
    throw new Error(`ComfyUI getHistory failed: ${r.status}`)
  }
  return r.json()
}

export async function fetchOutput(
  filename: string,
  subfolder = '',
  type: 'output' | 'temp' | 'input' = 'output',
): Promise<Buffer> {
  const params = new URLSearchParams({ filename, subfolder, type })
  const r = await fetch(buildComfyuiUrl(`/view?${params.toString()}`))
  if (!r.ok) {
    throw new Error(`ComfyUI fetchOutput failed: ${r.status} ${filename}`)
  }
  const ab = await r.arrayBuffer()
  return Buffer.from(ab)
}

export function getOutputUrl(filename: string, subfolder = '', type = 'output'): string {
  const params = new URLSearchParams({ filename, subfolder, type })
  return buildComfyuiUrl(`/view?${params.toString()}`)
}

export interface ProgressCallbacks {
  onStart?: () => void
  onProgress?: (current: number, max: number, nodeId?: string) => void
  onExecuting?: (nodeId: string) => void
  onDone?: (files: ComfyUIGeneratedFile[]) => void
  onError?: (message: string) => void
}

export function subscribeProgress(
  promptId: string,
  clientId: string,
  callbacks: ProgressCallbacks,
): { close: () => void } {
  const url = buildComfyuiUrl('/ws').replace(/^http/, 'ws') + `?clientId=${clientId}`
  const ws = new WebSocket(url)
  let closed = false

  const close = () => {
    if (closed) return
    closed = true
    try { ws.close() } catch { /* */ }
  }

  ws.onopen = () => {
    callbacks.onStart?.()
  }

  ws.onmessage = (ev) => {
    if (typeof ev.data !== 'string') return
    try {
      const msg: ComfyUIProgressEvent = JSON.parse(ev.data)
      switch (msg.type) {
        case 'execution_start':
          callbacks.onStart?.()
          break
        case 'progress':
          callbacks.onProgress?.(msg.data.value || 0, msg.data.max || 1, msg.data.node_id)
          break
        case 'executing':
          if (msg.data.node) callbacks.onExecuting?.(msg.data.node)
          break
        case 'executed':
          // 单个节点完成, 不在这里处理最终结果
          break
        case 'execution_error':
          callbacks.onError?.(msg.data?.exception_message || 'execution error')
          close()
          break
      }
    } catch { /* */ }
  }

  ws.onerror = () => {
    callbacks.onError?.('WebSocket error')
    close()
  }

  ws.onclose = () => {
    closed = true
  }

  // 轮询 history 兜底 (WebSocket 可能先关, history 后出)
  const pollHistory = setInterval(async () => {
    try {
      const history = await getHistory(promptId)
      const item = history[promptId]
      if (item && item.status?.completed) {
        clearInterval(pollHistory)
        const files = extractFiles(item)
        callbacks.onDone?.(files)
        close()
      }
    } catch { /* */ }
  }, 2000)

  // 90 秒超时兜底
  const timeout = setTimeout(() => {
    clearInterval(pollHistory)
    callbacks.onError?.('timeout')
    close()
  }, 90 * 60 * 1000)

  return {
    close: () => {
      clearInterval(pollHistory)
      clearTimeout(timeout)
      close()
    },
  }
}

export function extractFiles(historyItem: ComfyUIHistoryItem): ComfyUIGeneratedFile[] {
  const files: ComfyUIGeneratedFile[] = []
  for (const nodeOutputs of Object.values(historyItem.outputs || {})) {
    for (const kind of ['images', 'videos', 'audio', 'gifs'] as const) {
      const arr = nodeOutputs[kind]
      if (!arr) continue
      for (const f of arr) {
        files.push({
          filename: f.filename,
          subfolder: f.subfolder,
          type: f.type === 'temp' ? 'temp' : 'output',
          url: getOutputUrl(f.filename, f.subfolder, f.type),
        })
      }
    }
  }
  return files
}

/** 深度克隆并替换工作流中的 prompt / seed 等变量 */
export function fillWorkflow(
  template: ComfyUIWorkflow,
  vars: Record<string, unknown>,
): ComfyUIWorkflow {
  const clone = JSON.parse(JSON.stringify(template)) as ComfyUIWorkflow
  for (const node of Object.values(clone)) {
    if (typeof node === 'string') continue
    for (const [key, val] of Object.entries(node.inputs)) {
      if (typeof val === 'string' && val.startsWith('${') && val.endsWith('}')) {
        const varName = val.slice(2, -1)
        if (varName in vars) {
          node.inputs[key] = vars[varName]
        }
      }
    }
  }
  return clone
}
