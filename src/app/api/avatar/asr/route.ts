/**
 * /api/avatar/asr —— 语音转文字
 *
 * 输入:audio/webm(浏览器 MediaRecorder 格式)或 audio/wav
 * 流程:优先打 gateway /v1/audio/transcriptions(Qwen3-ASR 本地容器经 gateway 包装),
 * 失败 → OpenAI 兼容,最终 → 返回空 + 错误
 *
 * 输出:{ text, language } 或 { error }
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Gateway 配置: 本地 Qwen3 容器经 audio-gateway 包装成 OpenAI 兼容
// gateway 默认在 host 网络下监听 8001; 这里走 /v1 前缀
const GATEWAY_BASE = process.env.AUDIO_GATEWAY_BASE_URL || 'http://127.0.0.1:8001/v1';
const ASR_MODEL = 'qwen3-asr-0.6b';

export async function POST(req: NextRequest) {
  let buf: ArrayBuffer | null = null;
  let contentType = 'audio/webm';
  let filename = 'audio.webm';
  try {
    const form = await req.formData();
    const file = form.get('file') || form.get('audio');
    if (file && file instanceof File) {
      buf = await file.arrayBuffer();
      contentType = file.type || contentType;
      filename = file.name || filename;
    }
  } catch {
    // 可能不是 multipart,试 raw body
    try {
      buf = await req.arrayBuffer();
      contentType = req.headers.get('content-type') || contentType;
    } catch {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 });
    }
  }

  if (!buf || buf.byteLength === 0) {
    return NextResponse.json({ error: 'no audio data' }, { status: 400 });
  }
  if (buf.byteLength > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'audio too large (50MB max)' }, { status: 413 });
  }

  // 1) 试 audio-gateway /v1/audio/transcriptions(本地 Qwen3-ASR, OpenAI 兼容)
  try {
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: contentType }), filename);
    fd.append('model', ASR_MODEL);
    fd.append('language', 'zh');
    fd.append('response_format', 'json');
    const r = await fetch(`${GATEWAY_BASE}/audio/transcriptions`, {
      method: 'POST',
      body: fd,
      signal: AbortSignal.timeout(30000),
    });
    if (r.ok) {
      const j = await r.json();
      const text = String(j.text || '').trim();
      if (text) {
        return NextResponse.json({ text, language: j.language || 'zh' });
      }
    } else {
      console.warn(`[asr] gateway 返 ${r.status}:`, await r.text().catch(() => ''));
    }
  } catch (e) {
    console.warn('[asr] gateway 失败:', (e as Error).message);
  }

  // 2) 试 OpenAI 兼容云 API(回退方案,需 OPENAI_API_KEY)
  if (process.env.OPENAI_API_KEY) {
    try {
      const fd = new FormData();
      fd.append('file', new Blob([buf], { type: contentType }), filename);
      fd.append('model', 'whisper-1');
      fd.append('language', 'zh');
      const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: fd,
        signal: AbortSignal.timeout(30000),
      });
      if (r.ok) {
        const j = await r.json();
        const text = String(j.text || '').trim();
        if (text) return NextResponse.json({ text, language: j.language || 'zh' });
      }
    } catch (e) {
      console.warn('[asr] OpenAI 失败:', (e as Error).message);
    }
  }

  // 3) 全部失败 → 提示启动 gateway
  return NextResponse.json({
    error: 'ASR failed',
    msg: `没 ASR 服务可用。先在 qingqiuyue-go/docker/ 跑: podman-compose -f docker-compose-model.yml up -d asr gateway`,
  }, { status: 502 });
}
