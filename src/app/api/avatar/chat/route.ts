/**
 * /api/avatar/chat —— LLM 对话 + TTS 音频 + viseme 口型驱动数据。
 *
 * 输入(text):
 *   用户输入文本(中文优先)
 *
 * 输出(JSON):
 *   {
 *     text: "回复文本",
 *     emotion: { smile: 0.8, blink: 0 },  // BlendShape 表情
 *     action: 'idle' | 'wave' | 'walk',     // 动作
 *     visemes: [                            // 时间轴口型
 *       { t: 0.0, shape: 'closed', weight: 1.0 },
 *       { t: 0.1, shape: 'aa', weight: 0.8 },
 *       ...
 *     ],
 *     audioUrl: '/api/avatar/tts/abc123.mp3'  // TTS 音频,前端播放
 *   }
 *
 * LLM 策略(完全开源,按优先级):
 *   1. NEXT_PUBLIC_OLLAMA_URL(本地 Ollama,qwen2.5:7b) — 完全离线
 *   2. NEXT_PUBLIC_OPENAI_BASE_URL + key(云 API)
 *   3. 失败则 mock 兜底
 *
 * TTS 策略(完全开源):
 *   - Edge-TTS 公共接口(微软 azure speech),无需 key,直接 fetch 合成
 *   - 输出 mp3,前端用 <audio> 播放 + Web Audio API 实时分析 viseme
 */

import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// LLM 配置(从环境变量读,完全开源)
const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434';
const OPENAI_BASE_URL = process.env.NEXT_PUBLIC_OPENAI_BASE_URL || '';
const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';

// 系统提示词 — 让 LLM 输出结构化情感 + 动作
const SYSTEM_PROMPT = `你是"清秋月"数字人助理,扮演一个温柔、专业的真人。
用户跟你说话时,你需要根据语境表现出合适的情感和动作。

回复格式(JSON,严格遵守):
{
  "text": "回复文本(1-2 句话,口语化,适合 TTS 朗读)",
  "emotion": "neutral" | "happy" | "sad" | "angry" | "surprised",
  "action": "idle" | "wave" | "think"
}

只输出 JSON,不要 markdown 代码块,不要额外解释。`;

// Edge-TTS 公共接口
const EDGE_TTS_VOICES: Record<string, string> = {
  'zh-CN-female': 'zh-CN-XiaoxiaoNeural',
  'zh-CN-male': 'zh-CN-YunxiNeural',
  'en-US-female': 'en-US-JennyNeural',
};

/**
 * 调 LLM(三种降级路径)
 */
async function callLLM(text: string, history: Array<{ role: string; content: string }> = []): Promise<{ text: string; emotion: string; action: string }> {
  // 1. Ollama 本地
  try {
    const r = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...history,
          { role: 'user', content: text },
        ],
        stream: false,
        format: 'json',
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (r.ok) {
      const j = await r.json();
      const content = j?.message?.content || '{}';
      try {
        const parsed = JSON.parse(content);
        return {
          text: parsed.text || content,
          emotion: parsed.emotion || 'neutral',
          action: parsed.action || 'idle',
        };
      } catch {
        return { text: content, emotion: 'neutral', action: 'idle' };
      }
    }
  } catch (e) {
    console.warn('[chat] Ollama 失败:', (e as Error).message);
  }

  // 2. OpenAI 兼容云 API
  if (OPENAI_BASE_URL && OPENAI_API_KEY) {
    try {
      const r = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'qwen-plus',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history,
            { role: 'user', content: text },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (r.ok) {
        const j = await r.json();
        const content = j?.choices?.[0]?.message?.content || '{}';
        try {
          const parsed = JSON.parse(content);
          return {
            text: parsed.text || content,
            emotion: parsed.emotion || 'neutral',
            action: parsed.action || 'idle',
          };
        } catch {
          return { text: content, emotion: 'neutral', action: 'idle' };
        }
      }
    } catch (e) {
      console.warn('[chat] OpenAI 失败:', (e as Error).message);
    }
  }

  // 3. Mock 兜底(无 LLM 时也能演示)
  const lower = text.toLowerCase();
  let emotion = 'neutral';
  let action = 'idle';
  if (/hi|hello|你好|嗨|欢迎/.test(lower)) {
    emotion = 'happy';
    action = 'wave';
  } else if (/你好/.test(lower)) {
    emotion = 'happy';
    action = 'wave';
  } else if (/再见|拜拜/.test(lower)) {
    emotion = 'happy';
    action = 'wave';
  }
  return {
    text: `(本地模式)你说:"${text}",我可以帮你查数据、跳页面、回答问题。`,
    emotion,
    action,
  };
}

/**
 * Edge-TTS 合成音频
 */
async function ttsEdge(text: string, voice = 'zh-CN-XiaoxiaoNeural'): Promise<Buffer> {
  // Edge-TTS 公共接口 SSML 路径(无需 API key)
  const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>
    <voice name='${voice}'>${escapeXml(text)}</voice>
  </speak>`;
  // 用 node-fetch 直接打 Edge-TTS endpoint
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
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * 简易 viseme 时序生成(基于音素时长)
 *
 * 真实 lip-sync 需要 ASR → phoneme alignment → viseme 序列;
 * 这里用一个简化的规则:文本按字符切分,中文每字 ~150ms,
 * 元音字触发 aa/ih/ou/E/O/U,辅音/静音触发 closed。
 */
function generateVisemeTimeline(text: string, charMs = 150): Array<{ t: number; shape: string; weight: number }> {
  const out: Array<{ t: number; shape: string; weight: number }> = [];
  let tMs = 0;
  const isVowel = (ch: string) => /[aeiouAEIOUäöüáéíóúàèìòù]/.test(ch);
  const isChineseVowel = (ch: string) =>
    /[啊哦诶一乌喔鸭叶衣鱼于啊呃哎爱]/u.test(ch) || /[aeiouAEIOU]/.test(ch);

  for (const ch of text) {
    if (/\s/.test(ch)) {
      // 空格 → 静音(closed)
      out.push({ t: tMs / 1000, shape: 'closed', weight: 1 });
      tMs += charMs;
      continue;
    }
    if (isVowel(ch) || isChineseVowel(ch)) {
      // 简单按字符类别选 viseme
      let shape = 'aa';
      const lower = ch.toLowerCase();
      if (/[ei]/u.test(lower) || /[诶一]/u.test(ch)) shape = 'ih';
      else if (/[ou]/u.test(lower) || /[哦乌]/u.test(ch)) shape = 'ou';
      else if (/[a]/u.test(lower) || /[啊]/u.test(ch)) shape = 'aa';
      else if (/[äö]/u.test(lower)) shape = 'E';
      else if (/[u]/u.test(lower)) shape = 'U';
      else if (/[o]/u.test(lower) || /[喔]/u.test(ch)) shape = 'O';
      out.push({ t: tMs / 1000, shape, weight: 1 });
      tMs += charMs;
    } else {
      // 辅音/无声
      out.push({ t: tMs / 1000, shape: 'closed', weight: 0.6 });
      tMs += charMs;
    }
  }
  // 末尾 closed
  out.push({ t: tMs / 1000, shape: 'closed', weight: 1 });
  return out;
}

/**
 * emotion 映射到 BlendShape 字典
 */
function emotionToMorphs(emotion: string): Record<string, number> {
  switch (emotion) {
    case 'happy':
      return { smile: 0.8, blink: 0 };
    case 'sad':
      return { sad: 0.8, smile: 0 };
    case 'angry':
      return { angry: 0.8, blink: 0 };
    case 'surprised':
      return { surprised: 1.0, blink: 0 };
    default:
      return { smile: 0, blink: 0 };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body.text || '';
    const history: Array<{ role: string; content: string }> = body.history || [];
    if (!text.trim()) {
      return NextResponse.json({ error: 'text required' }, { status: 400 });
    }

    // 1. 调 LLM
    const llmResp = await callLLM(text, history);

    // 2. 生成 viseme 时序(基于文本,等真实 lip-sync 时再换 ASR 路径)
    const visemes = generateVisemeTimeline(llmResp.text);

    // 3. emotion → BlendShape
    const emotion = emotionToMorphs(llmResp.emotion);

    // 4. TTS(Edge-TTS)异步生成音频
    let audioUrl: string | null = null;
    try {
      const voice = EDGE_TTS_VOICES['zh-CN-female'];
      const audio = await ttsEdge(llmResp.text, voice);
      const id = crypto.randomBytes(8).toString('hex');
      // 写 public/avatars/audio-cache/,Next.js 自动当静态资源 serve,
      // 避免 .next/ 在 build 时被清掉导致音频 404
      const audioDir = path.join(process.cwd(), 'public', 'avatars', 'audio-cache');
      await fs.mkdir(audioDir, { recursive: true });
      const audioPath = path.join(audioDir, `${id}.mp3`);
      await fs.writeFile(audioPath, audio);
      audioUrl = `/avatars/audio-cache/${id}.mp3`;
    } catch (e) {
      console.warn('[chat] TTS 失败:', (e as Error).message);
    }

    return NextResponse.json({
      text: llmResp.text,
      emotion,
      action: llmResp.action,
      visemes,
      audioUrl,
    });
  } catch (err: any) {
    console.error('[chat] error:', err);
    return NextResponse.json(
      { error: err?.message || 'chat failed', text: '抱歉,服务暂时不可用。' },
      { status: 500 },
    );
  }
}

// 旧的 Edge-TTS GET 路由已删除 —— 音频现在写到 public/avatars/audio-cache/,
// Next.js 自动把它当静态资源 serve,/avatars/audio-cache/<id>.mp3 直接可用。
// 保留这个文件不删仅为向后兼容历史调用,但永远返回 404,前端不需要再打这里。
export async function GET(req: NextRequest) {
  return NextResponse.json({ error: 'gone', msg: '音频走 /avatars/audio-cache/<id>.mp3' }, { status: 410 });
}