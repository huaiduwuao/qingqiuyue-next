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
 * LLM 策略（API 优先，后端不部署 LLM）:
 *   1. OpenAI 兼容云 API — DeepSeek / MiniMax / 通义千问 等（主力）
 *   2. Ollama 本地（仅当显式配置了 OLLAMA_URL 才试，纯可选）
 *   3. 全部失败则返回 500 错误
 *
 * TTS 策略(完全开源):
 *   - Edge-TTS 公共接口(微软 azure speech),无需 key,直接 fetch 合成
 *   - 输出 mp3,前端用 <audio> 播放 + Web Audio API 实时分析 viseme
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { segmentsToVisemes, type AlignedSegment } from '@/lib/audio/viseme-mapper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// LLM 配置(从环境变量读,完全开源)
// ⚠️ 用不带 NEXT_PUBLIC_ 前缀的变量,避免 API key 进浏览器 bundle 泄露
const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
// Hermes 后端地址(用于取 agent persona)
const HERMES_API_BASE_URL = process.env.HERMES_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:10003';

/**
 * 从 Hermes 后端获取 agent 的 systemPrompt。
 * 失败时返回 null, 调用方使用默认 prompt。
 */
async function fetchHermesAgentPersona(agentId: string): Promise<string | null> {
  try {
    const url = `${HERMES_API_BASE_URL}/api/content/hermes/client/${encodeURIComponent(agentId)}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
      console.warn('[chat] Hermes agent fetch failed:', res.status, await res.text());
      return null;
    }
    const payload = await res.json();
    const systemPrompt = payload?.data?.systemPrompt || payload?.systemPrompt;
    if (typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
      return null;
    }
    return systemPrompt;
  } catch (e) {
    console.warn('[chat] fetchHermesAgentPersona error:', (e as Error).message);
    return null;
  }
}

// 系统提示词 — 让 LLM 输出结构化情感 + 动作 + 52 维 ARKit blendshape
const SYSTEM_PROMPT = `你是"清秋月"数字人助理,扮演一个温柔、专业的二次元角色。
用户跟你说话时,你需要根据语境表现出合适的情感和动作。

回复格式(JSON,严格遵守):
{
  "text": "回复文本(1-2 句话,口语化,适合 TTS 朗读)",
  "emotion_52": { ...52 维 ARKit blendshape, 见下 },
  "action": "idle" | "wave" | "walk" | "run" | "dance" | "sit" | "point" | "think" | "talk" | "bow"
}

## 52 维 ARKit Blendshape (emotion_52 字段, 0-1 权重):

眉毛 (5): browInnerUp, browDownLeft, browDownRight, browOuterUpLeft, browOuterUpRight
脸颊 (3): cheekPuff, cheekSquintLeft, cheekSquintRight
眼睛 (14): eyeBlinkLeft, eyeBlinkRight, eyeLookDownLeft, eyeLookDownRight,
          eyeLookInLeft, eyeLookInRight, eyeLookOutLeft, eyeLookOutRight,
          eyeLookUpLeft, eyeLookUpRight, eyeSquintLeft, eyeSquintRight,
          eyeWideLeft, eyeWideRight
下颚 (4): jawForward, jawLeft, jawOpen, jawRight
嘴 (22): mouthClose, mouthDimpleLeft, mouthDimpleRight, mouthFrownLeft, mouthFrownRight,
         mouthFunnel, mouthLeft, mouthLowerDownLeft, mouthLowerDownRight,
         mouthPressLeft, mouthPressRight, mouthPucker, mouthRight,
         mouthRollLower, mouthRollUpper, mouthShrugLower, mouthShrugUpper,
         mouthSmileLeft, mouthSmileRight, mouthStretchLeft, mouthStretchRight,
         mouthUpperUpLeft, mouthUpperUpRight
鼻子 (2): noseSneerLeft, noseSneerRight
舌头 (1): tongueOut

## emotion_52 模板 (按情绪选, **必须输出 emotion_52 字段**):

开心 happy: 笑容 + 眼笑
{
  "mouthSmileLeft": 0.8, "mouthSmileRight": 0.8,
  "cheekSquintLeft": 0.4, "cheekSquintRight": 0.4,
  "eyeSquintLeft": 0.3, "eyeSquintRight": 0.3,
  "browOuterUpLeft": 0.2, "browOuterUpRight": 0.2,
  "mouthDimpleLeft": 0.3, "mouthDimpleRight": 0.3
}

害羞 shy (笑 + 眼睛向下):
{
  "mouthSmileLeft": 0.5, "mouthSmileRight": 0.5,
  "eyeLookDownLeft": 0.6, "eyeLookDownRight": 0.6,
  "cheekSquintLeft": 0.2, "cheekSquintRight": 0.2
}

难过 sad:
{
  "mouthFrownLeft": 0.7, "mouthFrownRight": 0.7,
  "browInnerUp": 0.6,
  "eyeLookDownLeft": 0.4, "eyeLookDownRight": 0.4,
  "mouthStretchLeft": 0.3, "mouthStretchRight": 0.3
}

生气 angry:
{
  "browDownLeft": 0.8, "browDownRight": 0.8,
  "eyeSquintLeft": 0.5, "eyeSquintRight": 0.5,
  "noseSneerLeft": 0.3, "noseSneerRight": 0.3,
  "mouthPressLeft": 0.4, "mouthPressRight": 0.4,
  "jawForward": 0.2
}

惊讶 surprised:
{
  "eyeWideLeft": 0.9, "eyeWideRight": 0.9,
  "browOuterUpLeft": 0.8, "browOuterUpRight": 0.8,
  "jawOpen": 0.5,
  "mouthStretchLeft": 0.4, "mouthStretchRight": 0.4
}

疑惑 confused (歪头 + 皱眉):
{
  "browDownLeft": 0.4, "browDownRight": 0.4,
  "browInnerUp": 0.3,
  "mouthFrownLeft": 0.2, "mouthFrownRight": 0.2,
  "eyeSquintLeft": 0.2, "eyeSquintRight": 0.2
}

思考中 thinking (眼睛看左上方):
{
  "eyeLookOutLeft": 0.4, "eyeLookOutRight": 0.4,
  "browInnerUp": 0.3
}

眨眼 winking: eyeBlinkLeft: 0.9 (或 eyeBlinkRight)

中性 neutral: 所有值 0

## 10 个动作的使用场景 (按用户消息语境挑最贴合的):

- **wave**     → 用户说"你好" "hi" "在吗" "拜拜" "再见" (招呼/告别)
- **bow**      → 用户说"谢谢" "感谢" "抱歉" "对不起" "劳驾" (感谢/道歉)
- **bow**      → 谦虚的请求 ("帮我..." "请教...")
- **think**    → 用户问"为什么" "怎么" "什么意思" "你觉得呢" (思考/疑惑)
- **point**    → 用户说"那个" "这里" "那边" "你看" (指示某物)
- **sit**      → 用户说"坐下" "休息" "累了" (休息邀请)
- **walk**     → 用户说"走" "散步" "去" "过来" (移动/邀请同行)
- **run**      → 用户说"快" "跑" "紧急" "快点" (紧急)
- **dance**    → 用户说"跳舞" "开心" "庆祝" "happy" (快乐)
- **talk**      → 默认, 在解释/讨论/讲内容时 (动作小, 主要靠表情 + 嘴)
- **idle**     → 简短的肯定回答 "嗯" "好的" "知道了" (等待用户继续)

## 关键规则:
1. **每次回复都输出完整 emotion_52 字段** (即使是中性也要写 {})
2. emotion 反映**你这句话的语气**, 不是用户的情绪
3. action 反映**你做这个动作的意图** (用户说"走"时你 walk, 说"谢谢"时你 bow)
4. text 必须简短口语化, 不要超过 30 字
5. **绝对不要**用 markdown 代码块包装, 直接以 { 开头 以 } 结尾
6. 只输出 JSON, 不要额外解释`;

// Edge-TTS 公共接口
const EDGE_TTS_VOICES: Record<string, string> = {
  'zh-CN-female': 'zh-CN-XiaoxiaoNeural',
  'zh-CN-male': 'zh-CN-YunxiNeural',
  'en-US-female': 'en-US-JennyNeural',
};

/**
 * 剥离 LLM 输出里的 chain-of-thought 思考块
 * MiniMax M 系列(M2/M3)会输出 <think>...</think> 包裹的推理过程,
 * 这些不应该被 TTS 朗读出来 —— 数字人只播最终回答
 */
function stripThinkBlocks(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * 从 LLM 输出中提取 JSON 对象.
 * 兼容多种格式:
 *   1. 纯 JSON  →  {"text": "...", ...}
 *   2. markdown 围栏  →  ```json\n{...}\n```  或  ```\n{...}\n```
 *   3. JSON 嵌在文字里  →  文字{...}文字
 */
function extractJson(s: string): string {
  // 先剥 think
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  // 优先剥 markdown 围栏
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fence) return fence[1].trim()
  // 找第一个 { 到最后一个 }
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start >= 0 && end > start) return s.slice(start, end + 1)
  return s
}

/**
 * 调 LLM（API 优先，本地可选）
 *
 * 优先级:
 *   1. OpenAI 兼容云 API（DeepSeek / MiniMax / 通义千问 等）—— 主力，后端不部署 LLM
 *   2. Ollama 本地（仅当显式配置了 OLLAMA_URL 时才试，纯可选兜底）
 *   3. 全部失败 → throw Error
 */
async function callLLM(
  text: string,
  history: Array<{ role: string; content: string }> = [],
  systemPrompt?: string,
): Promise<{ text: string; emotion: string; emotion52: any; action: string }> {
  const prompt = systemPrompt || SYSTEM_PROMPT;

  // 1. OpenAI 兼容云 API（主力 — DeepSeek / MiniMax / Qwen 等）
  if (OPENAI_BASE_URL && OPENAI_API_KEY) {
    try {
      const model = process.env.OPENAI_MODEL || 'deepseek-chat';
      const r = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: prompt },
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
        try {
          j = JSON.parse(safe);
        } catch (e) {
          console.warn('[chat] LLM response 仍非 JSON:', (e as Error).message, 'raw len=', raw.length);
        }
        const content = extractJson(j?.choices?.[0]?.message?.content || '{}');
        try {
          const parsed = JSON.parse(content);
          return {
            text: parsed.text || content,
            emotion: parsed.emotion_high || parsed.emotion || 'neutral',
            emotion52: parsed.emotion_52 || parsed.emotion52 || {},
            action: parsed.action || 'idle',
          };
        } catch {
          return { text: content, emotion: 'neutral', emotion52: {}, action: 'idle' };
        }
      } else {
        console.warn(`[chat] API ${model} 返 ${r.status}:`,
          r.status === 404 ? 'model not found' : await r.text().catch(() => '(body unreadable)'));
      }
    } catch (e) {
      console.warn('[chat] API 调用失败:', (e as Error).message);
    }
  }

  // 2. Ollama 本地（仅当显式配置了 OLLAMA_URL 才试，纯可选）
  if (process.env.NEXT_PUBLIC_OLLAMA_URL) {
    try {
      const r = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
          messages: [
            { role: 'system', content: prompt },
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
        const content = extractJson(j?.message?.content || '{}');
        try {
          const parsed = JSON.parse(content);
          return {
            text: parsed.text || j?.message?.content || '',
            emotion: parsed.emotion_high || parsed.emotion || 'neutral',
            emotion52: parsed.emotion_52 || parsed.emotion52 || {},
            action: parsed.action || 'idle',
          };
        } catch {
          return { text: j?.message?.content || '', emotion: 'neutral', emotion52: {}, action: 'idle' };
        }
      }
    } catch (e) {
      console.warn('[chat] Ollama 失败:', (e as Error).message);
    }
  }

  // 3. 无可用 LLM → 直接抛错
  if (!OPENAI_BASE_URL || !OPENAI_API_KEY) {
    throw new Error('未配置 LLM API。请在 .env 中设置 OPENAI_BASE_URL 和 OPENAI_API_KEY（支持 DeepSeek / MiniMax / 通义千问 等 OpenAI 兼容 API）');
  }
  throw new Error('LLM API 调用失败，请检查 OPENAI_BASE_URL / OPENAI_API_KEY 配置及网络连接');
}

/**
 * Edge-TTS 合成音频
 */
async function ttsEdge(text: string, voice = 'zh-CN-XiaoxiaoNeural'): Promise<Buffer> {
  // 优先:audio-gateway (本地 Qwen3-TTS 经 FastAPI 包装, OpenAI 兼容 JSON 协议)
  const gatewayBase = process.env.AUDIO_GATEWAY_BASE_URL || 'http://127.0.0.1:8001/v1';
  try {
    const r = await fetch(`${gatewayBase}/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3-tts-0.6b-customvoice',
        input: text,
        voice: 'alloy',  // OpenAI voice 名, gateway 映射到 Qwen speaker (Vivian)
        response_format: 'wav',
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (r.ok) {
      const ab = await r.arrayBuffer();
      return Buffer.from(ab);
    }
    console.warn(`[chat] gateway TTS 返 ${r.status},fallback Edge-TTS`);
  } catch (e) {
    console.warn('[chat] gateway TTS 失败:', (e as Error).message);
  }
  // Edge-TTS 公共接口 SSML 路径(无需 API key)
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
    const agentId: string = body.agentId || 'digital_human';
    if (!text.trim()) {
      return NextResponse.json({ error: 'text required' }, { status: 400 });
    }

    // 根据 agentId 加载 persona, 替换 system prompt 中的角色定义部分
    let systemPrompt = SYSTEM_PROMPT;
    try {
      const persona = await fetchHermesAgentPersona(agentId);
      if (persona) {
        const formatStart = SYSTEM_PROMPT.indexOf('回复格式(JSON');
        const formatRules = formatStart >= 0 ? SYSTEM_PROMPT.slice(formatStart) : '';
        systemPrompt = `${persona}\n\n## 输出格式要求:\n${formatRules}`;
      }
    } catch (e) {
      console.warn('[chat] 加载 agent 失败, 使用默认 prompt:', (e as Error).message);
    }

    // 内容审核：用户输入
    try {
      const moderationRes = await fetch(`${process.env.HERMES_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:10003'}/api/core/moderation/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (moderationRes.ok) {
        const mod = await moderationRes.json();
        if (mod.data && !mod.data.passed) {
          return NextResponse.json({
            text: '抱歉，你的消息包含不当内容，我无法回复。',
            emotion: {},
            action: 'idle',
            visemes: [],
            audioUrl: null,
            isAIGenerated: true,
            moderation: mod.data,
          });
        }
      }
    } catch (e) {
      console.warn('[chat] 内容审核调用失败:', (e as Error).message);
    }

    // 1. 调 LLM
    const llmResp = await callLLM(text, history, systemPrompt);

    // 2. emotion → BlendShape (52 维, LLM 输出 emotion_52 优先, 否则降级到 emotionToMorphs)
    const emotion52 = { ...emotionToMorphs(llmResp.emotion), ...(llmResp.emotion52 || {}) };

    // 3. TTS(Edge-TTS)生成音频
    let audioUrl: string | null = null;
    let audioBuffer: Buffer | null = null;
    let audioDuration = 0;
    try {
      const voice = EDGE_TTS_VOICES['zh-CN-female'];
      audioBuffer = await ttsEdge(llmResp.text, voice);
      const id = crypto.randomBytes(8).toString('hex');
      const audioDir = path.join(process.cwd(), 'public', 'avatars', 'audio-cache');
      await fs.mkdir(audioDir, { recursive: true });
      const audioPath = path.join(audioDir, `${id}.mp3`);
      await fs.writeFile(audioPath, audioBuffer);
      audioUrl = `/avatars/audio-cache/${id}.mp3`;

      // 估算音频时长
      // - WAV 格式 (本地 Qwen3-TTS): 读 RIFF 头
      // - MP3 格式 (Edge-TTS 公共): 文本估算 ~150ms/字
      if (audioBuffer[0] === 0x52 && audioBuffer[1] === 0x49) {  // 'RI'
        try {
          const sr = audioBuffer.readUInt32LE(24)
          const channels = audioBuffer.readUInt16LE(22)
          const bits = audioBuffer.readUInt16LE(34)
          const dataSize = audioBuffer.length - 44
          audioDuration = dataSize / (sr * channels * (bits / 8))
        } catch {
          audioDuration = llmResp.text.length * 0.15
        }
      } else {
        audioDuration = llmResp.text.length * 0.15  // MP3 / 其他格式
      }
    } catch (e) {
      console.warn('[chat] TTS 失败:', (e as Error).message);
    }

    // 4. 真实 viseme 时间轴: TTS 音频 → ASR 强制对齐 → 拼音 → viseme
    //    失败时降级到文本启发式 (generateVisemeTimeline)
    let visemes: Array<{ t: number; shape: string; weight: number }> = generateVisemeTimeline(llmResp.text)
    let visemeSource: 'aligned' | 'text-fallback' = 'text-fallback'
    if (audioBuffer && process.env.AUDIO_GATEWAY_BASE_URL) {
      try {
        const fd = new FormData()
        fd.append('file', new Blob([new Uint8Array(audioBuffer)], { type: 'audio/wav' }), 'tts.wav')
        fd.append('model', 'qwen3-forced-aligner-0.6b')
        fd.append('language', 'Chinese')
        const r = await fetch(`${process.env.AUDIO_GATEWAY_BASE_URL}/audio/align`, {
          method: 'POST',
          body: fd,
          signal: AbortSignal.timeout(30000),
        })
        if (r.ok) {
          const j = await r.json()
          const segs: AlignedSegment[] = j.segments || []
          if (segs.length > 0) {
            visemes = segmentsToVisemes(segs, audioDuration)
            visemeSource = 'aligned'
            console.log(`[chat] viseme aligned: ${segs.length} segments, ${visemes.length} frames`)
          }
        } else {
          console.warn(`[chat] align 返 ${r.status}`)
        }
      } catch (e) {
        console.warn('[chat] align 失败, 用文本兜底:', (e as Error).message)
      }
    }

    return NextResponse.json({
      text: llmResp.text,
      emotion: emotion52,
      action: llmResp.action,
      visemes,
      audioUrl,
      audioDuration,
      visemeSource,
      isAIGenerated: true,
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