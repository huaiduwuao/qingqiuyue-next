/**
 * /api/digital-human/chat —— LLM 对话 + 工具调用 (Hermes function_calling)
 *
 * 与旧 /api/avatar/chat 不同之处:
 *   - 输出含 **tool_calls** 数组 (按 Hermes 协议), 由前端 dispatcher 推给 BlenderAvatar
 *   - System prompt 从 /digital-human/instructions 加载 (Hermes agent > backend > 默认)
 *   - 兼容旧字段: emotion_52 / action / visemes / audioUrl 仍可存在, 但推荐改为 tool_calls
 *
 * LLM 策略 (与 /api/avatar/chat 同):
 *   1. OpenAI 兼容云 API (DeepSeek / MiniMax / 通义千问 等)
 *   2. Ollama 本地 (可选)
 *   3. 失败 -> 500
 *
 * TTS 策略 (复用):
 *   1. Qwen3-TTS (audio-gateway, OpenAI 兼容 JSON)
 *   2. Edge-TTS 公共接口 fallback
 *
 * Viseme 策略:
 *   1. Qwen3-forced-aligner (audio-gateway, multipart upload)
 *   2. 文本启发式 fallback
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { segmentsToVisemes, type AlignedSegment } from '@/lib/audio/viseme-mapper';
import { loadInstructionsForAgent } from '@/digital-human/instructions/loader';
import {
  ALL_ACTIONS,
  ACTION_LABELS,
  ACTION_METADATA,
} from '@/digital-human/tools/actions';
import { buildToolsHint } from '@/digital-human/tools/tools';
import { EXPRESSION_PRESET_LABELS } from '@/digital-human/tools/expressions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const HERMES_API_BASE_URL = process.env.HERMES_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:10003';

interface ChatToolCall {
  name: string;
  params: Record<string, any>;
}

interface ChatResp {
  text: string;
  tool_calls: ChatToolCall[];
  /** 兼容旧字段 (单 action 时填) */
  action?: string;
  emotion?: Record<string, number>;
  visemes?: Array<{ t: number; shape: string; weight: number }>;
  audioUrl?: string | null;
  audioDuration?: number;
  isAIGenerated?: boolean;
  visemeSource?: 'aligned' | 'text-fallback';
  moderation?: any;
}

const EDGE_TTS_VOICES: Record<string, string> = {
  'zh-CN-female': 'zh-CN-XiaoxiaoNeural',
  'zh-CN-male': 'zh-CN-YunxiNeural',
  'en-US-female': 'en-US-JennyNeural',
};

function stripThinkBlocks(s: string): string {
  return s.replace(/think[\s\S]*?<\/think>/gi, '').trim();
}

function extractJson(s: string): string {
  s = s.replace(/think[\s\S]*?<\/think>/gi, '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) return fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

/**
 * System prompt 拼装
 */
async function buildSystemPrompt(agentId: string): Promise<string> {
  const doc = await loadInstructionsForAgent(agentId);
  // 末尾追加工具清单 (永远最新 — 工具集不存 Hermes)
  return `${doc.prompt}

---
## 实时工具清单 (由服务强制注入)

${buildToolsHint()}
`;
}

async function callLLM(
  text: string,
  history: Array<{ role: string; content: string }>,
  systemPrompt: string,
  enableTools: boolean,
): Promise<{ text: string; tool_calls: ChatToolCall[]; action?: string; emotion52?: any; emotion?: string }> {
  if (OPENAI_BASE_URL && OPENAI_API_KEY) {
    try {
      const model = process.env.OPENAI_MODEL || 'deepseek-chat';
      const r = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: text },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(40000),
      });
      if (r.ok) {
        const raw = await r.text();
        const safe = raw.replace(/[\x80-\xFF]/g, '?');
        let j: any = {};
        try { j = JSON.parse(safe); } catch {}
        const content = extractJson(j?.choices?.[0]?.message?.content || '{}');
        try {
          const parsed = JSON.parse(content);
          return {
            text: parsed.text || content,
            tool_calls: Array.isArray(parsed.tool_calls) ? parsed.tool_calls : [],
            action: parsed.action,
            emotion52: parsed.emotion_52,
            emotion: parsed.emotion,
          };
        } catch {
          return { text: content, tool_calls: [] };
        }
      } else {
        console.warn(`[dh-chat] API ${model} 返 ${r.status}:`, await r.text().catch(() => '(unreadable)'));
      }
    } catch (e) {
      console.warn('[dh-chat] API 调用失败:', (e as Error).message);
    }
  }

  if (process.env.NEXT_PUBLIC_OLLAMA_URL) {
    try {
      const r = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
          messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: text }],
          stream: false,
          format: 'json',
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (r.ok) {
        const j = await r.json();
        const content = extractJson(j?.message?.content || '{}');
        try {
          const parsed = JSON.parse(content);
          return {
            text: parsed.text || j?.message?.content || '',
            tool_calls: Array.isArray(parsed.tool_calls) ? parsed.tool_calls : [],
            action: parsed.action,
            emotion52: parsed.emotion_52,
            emotion: parsed.emotion,
          };
        } catch {
          return { text: j?.message?.content || '', tool_calls: [] };
        }
      }
    } catch (e) {
      console.warn('[dh-chat] Ollama 失败:', (e as Error).message);
    }
  }

  if (!OPENAI_BASE_URL || !OPENAI_API_KEY) {
    throw new Error('未配置 LLM API (OPENAI_BASE_URL + OPENAI_API_KEY)');
  }
  throw new Error('LLM API 调用失败');
}

async function tts(text: string, voice = 'zh-CN-XiaoxiaoNeural'): Promise<Buffer> {
  const gatewayBase = process.env.AUDIO_GATEWAY_BASE_URL || 'http://127.0.0.1:8001/v1';
  try {
    const r = await fetch(`${gatewayBase}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3-tts-0.6b-customvoice',
        input: text,
        voice: 'alloy',
        response_format: 'wav',
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (r.ok) {
      const ab = await r.arrayBuffer();
      return Buffer.from(ab);
    }
  } catch (e) {
    console.warn('[dh-chat] gateway TTS 失败:', (e as Error).message);
  }
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>
    <voice name='${voice}'>${escapeXml(text)}</voice>
  </speak>`;
  const url = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?trustedclienttoken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'Ocp-Apim-Subscription-Key': '',
    },
    body: ssml,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Edge-TTS ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function generateVisemeTimeline(text: string, charMs = 150): Array<{ t: number; shape: string; weight: number }> {
  const out: Array<{ t: number; shape: string; weight: number }> = [];
  let tMs = 0;
  const isChineseVowel = (ch: string) => /[啊哦诶一乌喔鸭叶衣鱼于呃哎爱哦呜]/u.test(ch);
  for (const ch of text) {
    if (/\s/.test(ch)) {
      out.push({ t: tMs / 1000, shape: 'closed', weight: 1 });
    } else if (isChineseVowel(ch) || /[aeiouAEIOU]/.test(ch)) {
      let shape = 'aa';
      const lower = ch.toLowerCase();
      if (/[eiI]/u.test(lower)) shape = 'ih';
      else if (/[ouU]/u.test(lower) || /[哦乌]/.test(ch)) shape = 'ou';
      else if (/[a]/i.test(lower) || /[啊]/.test(ch)) shape = 'aa';
      else if (/[o]/i.test(lower) || /[喔]/.test(ch)) shape = 'O';
      out.push({ t: tMs / 1000, shape, weight: 1 });
    } else {
      out.push({ t: tMs / 1000, shape: 'closed', weight: 0.6 });
    }
    tMs += charMs;
  }
  out.push({ t: tMs / 1000, shape: 'closed', weight: 1 });
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = (body.text || '').trim();
    const history: Array<{ role: string; content: string }> = body.history || [];
    const agentId: string = body.agentId || 'qingqiuyue_default';
    const enableTools: boolean = body.enableTools !== false;

    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

    // 内容审核
    try {
      const moderationRes = await fetch(
        `${HERMES_API_BASE_URL}/api/core/moderation/check`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) },
      );
      if (moderationRes.ok) {
        const mod = await moderationRes.json();
        if (mod.data && !mod.data.passed) {
          return NextResponse.json({
            text: '抱歉,你的消息包含不当内容,我无法回复。',
            tool_calls: [], action: 'idle', visemes: [], audioUrl: null,
            isAIGenerated: true, moderation: mod.data,
          } satisfies ChatResp);
        }
      }
    } catch (e) {
      console.warn('[dh-chat] moderation 失败:', (e as Error).message);
    }

    // 加载 system prompt (Hermes > backend > 默认)
    const systemPrompt = await buildSystemPrompt(agentId);

    // 调 LLM
    const llmResp = await callLLM(text, history, systemPrompt, enableTools);

    // TTS
    let audioUrl: string | null = null;
    let audioBuffer: Buffer | null = null;
    let audioDuration = 0;
    if (llmResp.text) {
      try {
        const voice = EDGE_TTS_VOICES['zh-CN-female'];
        audioBuffer = await tts(llmResp.text, voice);
        const id = crypto.randomBytes(8).toString('hex');
        const audioDir = path.join(process.cwd(), 'public', 'avatars', 'audio-cache');
        await fs.mkdir(audioDir, { recursive: true });
        const isWav = audioBuffer[0] === 0x52 && audioBuffer[1] === 0x49;
        const ext = isWav ? 'wav' : 'mp3';
        const audioPath = path.join(audioDir, `${id}.${ext}`);
        await fs.writeFile(audioPath, audioBuffer);
        audioUrl = `/avatars/audio-cache/${id}.${ext}`;
        if (isWav) {
          try {
            const sr = audioBuffer.readUInt32LE(24);
            const channels = audioBuffer.readUInt16LE(22);
            const bits = audioBuffer.readUInt16LE(34);
            const dataSize = audioBuffer.length - 44;
            audioDuration = dataSize / (sr * channels * (bits / 8));
          } catch {
            audioDuration = llmResp.text.length * 0.15;
          }
        } else {
          audioDuration = llmResp.text.length * 0.15;
        }
      } catch (e) {
        console.warn('[dh-chat] TTS 失败:', (e as Error).message);
      }
    }

    // Viseme
    let visemes = generateVisemeTimeline(llmResp.text || text);
    let visemeSource: 'aligned' | 'text-fallback' = 'text-fallback';
    if (audioBuffer && process.env.AUDIO_GATEWAY_BASE_URL) {
      try {
        const fd = new FormData();
        fd.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/wav' }), 'tts.wav');
        fd.append('model', 'qwen3-forced-aligner-0.6b');
        fd.append('language', 'Chinese');
        const r = await fetch(`${process.env.AUDIO_GATEWAY_BASE_URL}/audio/align`, {
          method: 'POST', body: fd, signal: AbortSignal.timeout(30000),
        });
        if (r.ok) {
          const j = await r.json();
          const segs: AlignedSegment[] = j.segments || [];
          if (segs.length > 0) {
            visemes = segmentsToVisemes(segs, audioDuration);
            visemeSource = 'aligned';
          }
        }
      } catch (e) {
        console.warn('[dh-chat] align 失败:', (e as Error).message);
      }
    }

    const resp: ChatResp = {
      text: llmResp.text,
      tool_calls: llmResp.tool_calls || [],
      visemes,
      audioUrl,
      audioDuration,
      visemeSource,
      isAIGenerated: true,
      // 兼容旧字段
      emotion: llmResp.emotion52 || {},
      action: llmResp.action || 'idle',
    };
    return NextResponse.json(resp);
  } catch (err: any) {
    console.error('[dh-chat] error:', err);
    return NextResponse.json(
      { error: err?.message || 'chat failed', text: '抱歉,服务暂时不可用。' },
      { status: 500 },
    );
  }
}
