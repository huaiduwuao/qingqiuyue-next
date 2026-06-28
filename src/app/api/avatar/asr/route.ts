/**
 * /api/avatar/asr —— 语音转文字
 *
 * 输入:audio/webm(浏览器 MediaRecorder 格式)或 audio/wav
 * 流程:优先打 xinference /v1/audio/transcriptions(Whisper-large-v3),
 * 失败 → OpenAI 兼容,最终 → 返回空 + 错误
 *
 * 输出:{ text, language } 或 { error }
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const XINFERENCE_BASE = process.env.NEXT_PUBLIC_OPENAI_BASE_URL || 'http://127.0.0.1:9997/v1';
const ASR_MODEL = process.env.XINFERENCE_ASR_MODEL || 'whisper-large-v3';

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

  // 1) 试 xinference /v1/audio/transcriptions(OpenAI 兼容 Whisper)
  try {
    const xinfBase = XINFERENCE_BASE.replace(/\/v1$/, '');
    const xinfUrl = `${xinfBase}/v1/audio/transcriptions`;
    const fd = new FormData();
    fd.append('file', new Blob([buf], { type: contentType }), filename);
    fd.append('model', ASR_MODEL);
    fd.append('language', 'zh');
    fd.append('response_format', 'json');
    const r = await fetch(xinfUrl, { method: 'POST', body: fd, signal: AbortSignal.timeout(30000) });
    if (r.ok) {
      const j = await r.json();
      const text = String(j.text || '').trim();
      if (text) {
        return NextResponse.json({ text, language: j.language || 'zh' });
      }
    } else {
      console.warn(`[asr] xinference 返 ${r.status}:`, await r.text().catch(() => ''));
    }
  } catch (e) {
    console.warn('[asr] xinference 失败:', (e as Error).message);
  }

  // 2) 试 OpenAI 兼容(其他 base)
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

  // 3) 全部失败 → 提示用户检查 xinference 模型
  return NextResponse.json({
    error: 'ASR failed',
    msg: `没 ASR 模型可用。先在 xinference 跑: curl -X GET 'http://127.0.0.1:9997/v1/models/launch?model_name=whisper-large-v3&model_type=audio'`,
  }, { status: 502 });
}
