/**
 * POST /api/video/generate — 创建视频生成任务
 *
 * 流程:
 *   1. 接收 { kind: 'text-to-video' | 'image-to-video', positivePrompt, ... }
 *   2. 创建 task-engine 任务
 *   3. 异步提交到 ComfyUI, 监听进度
 *   4. 产物下载后上传到 MinIO
 *   5. 通过 SSE 通知前端
 */

import { NextRequest, NextResponse } from 'next/server'
import * as taskEngine from '@/lib/task-engine/store'
import { buildWorkflow, type WorkflowKind } from '@/lib/comfyui/workflows/registry'
import {
  queuePrompt,
  subscribeProgress,
  extractFiles,
  fetchOutput,
  buildComfyuiUrl,
} from '@/lib/comfyui/client'
import * as minio from '@/lib/avatar-pipeline/minio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function uploadImageToComfyUI(base64: string, filename = 'input.png'): Promise<void> {
  const dataUrlPrefix = 'data:image/'
  if (!base64.startsWith(dataUrlPrefix)) {
    throw new Error('inputImage must be a data URL')
  }
  const commaIdx = base64.indexOf(',')
  const mime = base64.slice(dataUrlPrefix.length, base64.indexOf(';'))
  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'png'
  const buf = Buffer.from(base64.slice(commaIdx + 1), 'base64')

  const fd = new FormData()
  fd.append('image', new Blob([buf], { type: `image/${ext}` }), filename.replace(/\.[^.]+$/, `.${ext}`))
  fd.append('type', 'input')
  fd.append('overwrite', 'true')

  const r = await fetch(buildComfyuiUrl('/upload/image'), {
    method: 'POST',
    body: fd as any,
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`ComfyUI upload image failed: ${r.status} ${text}`)
  }
}

async function runComfyUITask(taskId: string, kind: WorkflowKind, body: any): Promise<void> {
  try {
    taskEngine.setStage(taskId, 'build_workflow', 'running')
    const { workflow, params } = buildWorkflow(kind, {
      positivePrompt: body.positivePrompt,
      negativePrompt: body.negativePrompt,
      seed: body.seed,
      width: body.width,
      height: body.height,
      frames: body.frames,
      steps: body.steps,
      cfg: body.cfg,
      inputImage: body.inputImage,
    })
    taskEngine.setStage(taskId, 'build_workflow', 'done')

    if (kind === 'image-to-video' && body.inputImage) {
      taskEngine.setStage(taskId, 'upload_image', 'running')
      await uploadImageToComfyUI(body.inputImage, 'input.png')
      taskEngine.setStage(taskId, 'upload_image', 'done')
    }

    taskEngine.setStage(taskId, 'queue_prompt', 'running')
    const clientId = `c_${taskId}`
    const { prompt_id: promptId } = await queuePrompt(workflow, clientId)
    taskEngine.setStage(taskId, 'queue_prompt', 'done', 100, `prompt_id=${promptId}`)

    taskEngine.setStage(taskId, 'generate', 'running', 0)

    await new Promise<void>((resolve, reject) => {
      const sub = subscribeProgress(promptId, clientId, {
        onProgress: (current, max, nodeId) => {
          const pct = max > 0 ? Math.round((current / max) * 100) : 0
          taskEngine.setStage(taskId, 'generate', 'running', pct, nodeId ? `node ${nodeId}` : undefined)
          taskEngine.setProgress(taskId, pct)
        },
        onExecuting: (nodeId) => {
          taskEngine.appendLog(taskId, 'info', `executing node ${nodeId}`)
        },
        onDone: async (files) => {
          taskEngine.setStage(taskId, 'generate', 'done', 100)
          resolve()
          sub.close()
        },
        onError: (message) => {
          reject(new Error(message))
          sub.close()
        },
      })
    })

    taskEngine.setStage(taskId, 'download', 'running')
    const history = await (await import('@/lib/comfyui/client')).getHistory(promptId)
    const item = history[promptId]
    const files = item ? extractFiles(item) : []
    if (files.length === 0) {
      throw new Error('ComfyUI returned no output files')
    }
    const first = files[0]
    const buffer = await fetchOutput(first.filename, first.subfolder, first.type)
    taskEngine.setStage(taskId, 'download', 'done')

    taskEngine.setStage(taskId, 'upload', 'running')
    const ext = first.filename.split('.').pop() || 'mp4'
    const key = `videos/${taskId}.${ext}`
    await minio.putObject(key, buffer, `video/${ext}`)
    const url = `/api/artifacts/${key}` // 后续可接入代理路由
    taskEngine.setStage(taskId, 'upload', 'done')

    taskEngine.markDone(taskId, {
      url,
      minioKey: key,
      filename: first.filename,
      promptId,
      params,
    })
  } catch (e) {
    console.error('[video/generate] task failed:', e)
    taskEngine.markFailed(taskId, e as Error)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const kind: WorkflowKind = body.kind === 'image-to-video' ? 'image-to-video' : 'text-to-video'

    if (!body.positivePrompt?.trim()) {
      return NextResponse.json({ error: 'positivePrompt is required' }, { status: 400 })
    }

    const task = taskEngine.createTask({
      taskType: 'video',
      userId: body.userId,
      payload: {
        kind,
        positivePrompt: body.positivePrompt,
        negativePrompt: body.negativePrompt,
        width: body.width,
        height: body.height,
        frames: body.frames,
        steps: body.steps,
        cfg: body.cfg,
        hasInputImage: !!body.inputImage,
      },
    })

    // 异步执行, 不阻塞响应
    runComfyUITask(task.id, kind, body).catch(() => {})

    return NextResponse.json({ taskId: task.id, status: task.status })
  } catch (e) {
    console.error('[api/video/generate] failed:', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
