/**
 * comfyui/types.ts — ComfyUI API 类型
 */

export interface ComfyUIWorkflow {
  [nodeId: string]: {
    inputs: Record<string, unknown>
    class_type: string
    _meta?: { title: string }
  } | string
}

export interface QueuePromptResponse {
  prompt_id: string
  number: number
  node_errors: Record<string, unknown>
}

export interface ComfyUIHistoryItem {
  prompt: [number, string, ComfyUIWorkflow, { client_id?: string }, { client_id?: string }]
  outputs: Record<string, ComfyUIOutputNode>
  status: {
    status_str: string
    completed: boolean
    messages: Array<[string, any]>
  }
}

export interface ComfyUIOutputNode {
  images?: Array<{ filename: string; subfolder: string; type: string }>
  videos?: Array<{ filename: string; subfolder: string; type: string }>
  audio?: Array<{ filename: string; subfolder: string; type: string }>
  gifs?: Array<{ filename: string; subfolder: string; type: string }>
}

export interface ComfyUIProgressEvent {
  type: 'status' | 'progress' | 'executing' | 'execution_start' | 'execution_cached' | 'executed' | 'execution_error'
  data: any
}

export interface ComfyUIGenerateOptions {
  workflow?: ComfyUIWorkflow
  positivePrompt?: string
  negativePrompt?: string
  seed?: number
  width?: number
  height?: number
  frames?: number
  steps?: number
  cfg?: number
  inputImage?: string // base64 或 URL
}

export interface ComfyUIGeneratedFile {
  filename: string
  subfolder: string
  type: 'output' | 'temp'
  url: string
}
