/**
 * 数字人对话记录(ChatLogItem[])的纯变换:打字机、思考、工具卡结果、历史上下文等。
 * 从 useChatAvatarWS.ts 拆出,行为不变。
 */
import type { ChatLogItem } from './useChatAvatar';
import { stripAvatarDirectives } from './avatarDirectives';

/** 本轮起点:最后一条用户消息之后 */
function turnStart(c: ChatLogItem[]): number {
  for (let i = c.length - 1; i >= 0; i--) if (c[i].who === 'user') return i + 1;
  return 0;
}

/**
 * 打字机:更新本轮的 AI 气泡(工具卡可能插在它后面,不能只看最后一条,否则每次
 * 工具调用之后都会再开一个气泡、正文重复一遍)。
 */
export function upsertTurnText(c: ChatLogItem[], text: string): ChatLogItem[] {
  const start = turnStart(c);
  for (let i = c.length - 1; i >= start; i--) {
    if (c[i].who === 'ai') return [...c.slice(0, i), { who: 'ai', text }, ...c.slice(i + 1)];
  }
  return [...c, { who: 'ai', text }];
}

/** 思考过程放在本轮第一条 AI / 工具记录之前 */
export function insertThought(c: ChatLogItem[], thought: string): ChatLogItem[] {
  const start = turnStart(c);
  const item: ChatLogItem = { who: 'thought', text: thought };
  return [...c.slice(0, start), item, ...c.slice(start)];
}

/**
 * WS text_token:最后一条是 AI 气泡就换成累积全文,否则新开一条(只放这个 token)。
 * fullText 要在 setState 的 updater 里取当时的累积值。
 */
export function applyStreamToken(prev: ChatLogItem[], fullText: string, token: string): ChatLogItem[] {
  const copy = [...prev];
  const last = copy[copy.length - 1];
  if (last && last.who === 'ai') {
    copy[copy.length - 1] = { ...last, text: fullText };
  } else {
    copy.push({ who: 'ai', text: token });
  }
  return copy;
}

/** WS done 带回整段全文:覆盖最后一条 AI 气泡,没有就补一条 */
export function applyFinalText(prev: ChatLogItem[], fullText: string): ChatLogItem[] {
  const copy = [...prev];
  const last = copy[copy.length - 1];
  if (last && last.who === 'ai') {
    copy[copy.length - 1] = { ...last, text: fullText };
  } else if (fullText) {
    copy.push({ who: 'ai', text: fullText });
  }
  return copy;
}

/** 工具卡:结果回来后标成 done / error 并挂上结果 */
export function markToolResult(c: ChatLogItem[], toolCallId: string, content: string): ChatLogItem[] {
  return c.map((m) => (m.who === 'tool' && m.tool?.id === toolCallId
    ? { ...m, tool: { ...m.tool, status: content.startsWith('ERROR:') ? 'error' : 'done', result: content } }
    : m));
}

/** WS / HTTP 通道随消息带的完整历史 */
export function chatLogToHistory(chatLog: ChatLogItem[]): Array<{ role: string; content: string }> {
  return chatLog.map((m) => ({
    role: m.who === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));
}

/** H4 AG-UI 历史上下文:只取用户/助手气泡,最近 10 条 */
export function aguiHistory(chatLog: ChatLogItem[]): Array<{ role: string; content: string }> {
  return chatLog
    .filter((m) => m.who === 'user' || m.who === 'ai')
    .slice(-10)
    .map((m) => ({
      role: m.who === 'user' ? 'user' : 'assistant',
      content: m.text,
    }));
}

/**
 * 服务端会话记录 → 对话气泡。
 * 映射 role → who,过滤掉空内容占位消息(工具调用占位 content='' 不显示)
 *
 * 落库的是 LLM 的原始输出,里面还带着 <emotion:x/> / <action:x/> /
 * <mouth:speak/> 这些形象指令。直播时前端会剥掉再显示,读历史时之前没剥 ——
 * 于是翻旧会话就能看见一行行 "<mouth:speak/>你发送了一个字母…"。
 * 剥完可能变成空串(整条消息只有指令),这类一并过滤掉。
 */
export function chatLogFromServerMessages(msgs: any[]): ChatLogItem[] {
  return msgs
    // 服务端记录里还有 tool 行(content 是工具名)和 system 行,不是对话气泡
    .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== '')
    .map((m: any) => ({
      who: (m.role === 'user' ? 'user' : 'ai') as 'user' | 'ai',
      text: stripAvatarDirectives(m.content).trim(),
    }))
    .filter((m: ChatLogItem) => m.text !== '');
}

/** 工具参数 JSON → 对象(坏 JSON 就当空) */
export function safeParseArgs(argsJSON?: string): Record<string, unknown> {
  if (!argsJSON) return {};
  try {
    const v = JSON.parse(argsJSON);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

// 情绪名 → VRM expression
export function emotionToVRM(name: string): Record<string, number> {
  const map: Record<string, Record<string, number>> = {
    smile: { smile: 1.0 },
    surprised: { surprised: 1.0 },
    angry: { angry: 1.0 },
    sad: { sad: 1.0 },
    neutral: {},
  };
  return map[name] || {};
}

/** base64 PCM16(16kHz mono)→ Float32 采样 */
export function pcm16B64ToFloat32(audioB64: string): Float32Array {
  const raw = Uint8Array.from(atob(audioB64), (c) => c.charCodeAt(0));
  const pcm16 = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2));

  // 转 Float32
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / 32768;
  }
  return float32;
}
