/**
 * comfyui/workflows/registry.ts — 工作流模板注册表
 *
 * 模板来源:
 *   1. 本地 JSON 文件 (src/lib/comfyui/workflows/templates/*.json)
 *   2. 未来可扩展: 从 DB 读取用户自定义工作流
 *
 * 模板变量约定:
 *   ${positivePrompt}  正向提示词
 *   ${negativePrompt}  负向提示词
 *   ${seed}            随机种子
 *   ${width}           宽度
 *   ${height}          高度
 *   ${frames}          帧数
 *   ${steps}           采样步数
 *   ${cfg}             CFG scale
 *   ${inputImage}      图生视频时的输入图片路径
 */

import textToVideo from './templates/text-to-video.json'
import imageToVideo from './templates/image-to-video.json'
import type { ComfyUIWorkflow, ComfyUIGenerateOptions } from '@/lib/comfyui/types'
import { fillWorkflow } from '@/lib/comfyui/client'

export type WorkflowKind = 'text-to-video' | 'image-to-video'

export interface WorkflowTemplate {
  id: WorkflowKind
  name: string
  description: string
  workflow: ComfyUIWorkflow
  defaultParams: Partial<ComfyUIGenerateOptions>
}

const templates: WorkflowTemplate[] = [
  {
    id: 'text-to-video',
    name: '文生视频',
    description: '输入文字描述, AI 生成短视频',
    workflow: textToVideo as ComfyUIWorkflow,
    defaultParams: {
      width: 512,
      height: 512,
      frames: 16,
      steps: 20,
      cfg: 7.5,
    },
  },
  {
    id: 'image-to-video',
    name: '图生视频',
    description: '上传图片, AI 基于图片生成动态视频',
    workflow: imageToVideo as ComfyUIWorkflow,
    defaultParams: {
      width: 512,
      height: 512,
      frames: 16,
      steps: 20,
      cfg: 7.5,
    },
  },
]

export function listWorkflowTemplates(): WorkflowTemplate[] {
  return templates
}

export function getWorkflowTemplate(id: WorkflowKind): WorkflowTemplate | undefined {
  return templates.find((t) => t.id === id)
}

export function buildWorkflow(
  id: WorkflowKind,
  opts: ComfyUIGenerateOptions,
): { workflow: ComfyUIWorkflow; params: RequiredParams } {
  const tpl = getWorkflowTemplate(id)
  if (!tpl) throw new Error(`workflow template not found: ${id}`)

  const merged = { ...tpl.defaultParams, ...opts }
  const params: RequiredParams = {
    positivePrompt: merged.positivePrompt || '',
    negativePrompt: merged.negativePrompt || '',
    seed: merged.seed ?? Math.floor(Math.random() * 1_000_000_000),
    width: merged.width ?? 512,
    height: merged.height ?? 512,
    frames: merged.frames ?? 16,
    steps: merged.steps ?? 20,
    cfg: merged.cfg ?? 7.5,
  }

  const workflow = fillWorkflow(tpl.workflow, {
    ...params,
    inputImage: merged.inputImage || '',
  })

  return { workflow, params }
}

interface RequiredParams {
  positivePrompt: string
  negativePrompt: string
  seed: number
  width: number
  height: number
  frames: number
  steps: number
  cfg: number
}
