'use client';

/**
 * useChatAvatarWS —— 数字人对话 hook(WebSocket 流式版)
 *
 * 与 useChatAvatar 接口完全一致(ChatAvatarState), 但内部用 WebSocket
 * 替代 HTTP fetch, 实现:
 *   - LLM token 流式打字机效果
 *   - TTS 音频 chunk 即时播放(首字延迟 < 500ms)
 *   - 实时 viseme 帧同步
 *   - barge-in 打断
 *   - WS 断连 → 自动降级 HTTP
 *   - 指数退避重连
 */

import React from 'react';
import { devLog } from '@/lib/dev-log';
import type {
  ChatAvatarState,
  ChatLogItem,
  VisemeFrame,
} from './useChatAvatar';
import {
  SCENE_PANEL_DISMISS_TOOL,
  SCENE_PANEL_TOOLS,
  scenePanelFromToolCall,
  type ScenePanel,
} from './scene-ui/types';

/** 业务工具执行时给用户的可见反馈(否则一次搜索十几秒界面是死的) */
const TOOL_RUNNING_HINT: Record<string, string> = {
  resource_search: '正在搜资源…',
  bounty_list: '正在查悬赏…',
  bounty_create: '正在发布悬赏…',
  workflow_execute: '正在跑工作流…',
  browser_open: '正在打开网页…',
};

/** 句末标点:流式朗读按这些切句 */
const SENTENCE_END = /[。！？!?；;\n]/;

/**
 * 返回 text 中最后一个句末标点之后的位置(没有则返回 0)。
 * 用于「攒够一整句就先读出来」——首次出声不必等整段生成完。
 */
function lastSentenceEnd(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) {
    if (SENTENCE_END.test(text[i])) return i + 1;
  }
  return 0;
}

// ─── WS 消息类型(对齐 Go wsmux.go) ───

interface WSClientMsg {
  type: string;
  text?: string;
  history?: Array<{ role: string; content: string }>;
  agentId?: string;
  conversationId?: string; // 002:服务端会话 id,空 → server 创建
  pcm?: string;
  energy?: number;
  language?: string;
  token?: string;
}

interface WSServerMsg {
  type: string;          // text_token | audio_chunk | viseme_frames | done | error | asr_result | pong | frame
  token?: string;
  textDone?: boolean;
  audioDone?: boolean;
  audioB64?: string;
  visemes?: VisemeFrame[];
  emotion?: string;
  action?: string;
  fullText?: string;
  asrText?: string;
  asrIsFinal?: boolean;
  error?: string;
  mouthOpen?: number;
  blendshapes?: Record<string, number>;
  pose?: number[];
  expressions?: number[];
  seq?: number;
  /** 后端在 done 消息里携带的工具调用(Hermes/数字人用) */
  toolCalls?: Array<{ name: string; args?: Record<string, any> }>;
  /** 002:服务端创建/复用后回传的会话 id,前端写 localStorage */
  conversationId?: string;
}

// ─── WebSocket 连接管理 ───

// 智能过滤 TTS 内容:跳过代码块、复杂数据、URL、文件路径等
function filterTTSContent(text: string): string {
  if (!text) return '';

  // 按行分割
  const lines = text.split('\n');
  const filtered: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过空行
    if (!trimmed) continue;

    // 跳过英文思考过程 (user is saying..., I should..., Let me...)
    if (/^(user is|i should|let me|i need|i will|i'm going|the user|this is)/i.test(trimmed)) continue;

    // 跳过代码块标记
    if (trimmed.startsWith('```') || trimmed.startsWith('`') && trimmed.endsWith('`')) continue;

    // 跳过纯代码行(包含大量编程符号)
    if (/^[\s]*[{}();=<>!@#$%^&*+\[\]|\\\/~`"'-][\s]*$/.test(trimmed) && trimmed.length > 3) continue;

    // 跳过 URL
    if (/^https?:\/\//.test(trimmed) || /^www\./.test(trimmed)) continue;

    // 跳过文件路径
    if (/^[A-Za-z]:\\/.test(trimmed) || /^\/[a-z]/.test(trimmed)) continue;

    // 跳过 markdown 标题
    if (/^#{1,6}\s/.test(trimmed)) continue;

    // 跳过列表标记开头的复杂内容(如 "- [x] task")
    if (/^[-*+]\s*\[/.test(trimmed)) continue;

    // 跳过 JSON/XML 片段
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) continue;
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) continue;

    // 跳过数字列表项(如 "1. item")
    if (/^\d+\.\s/.test(trimmed) && trimmed.length < 5) continue;

    // 保留有意义的文本
    filtered.push(trimmed);
  }

  // 合并并限制长度
  const result = filtered.join(' ').trim();
  // 如果过滤后太短,返回空(不读)
  if (result.length < 3) return '';
  // 限制 TTS 长度 (避免读太长)
  return result.slice(0, 500);
}

// G3: 用 audio-gateway 真实 TTS 说话(OpenAI 兼容 /audio/speech)。
// 流式:请求 stream=true → 上游按句切分 chunked 返回 → 用 MediaSource+SourceBuffer
// 边收边播(不用等整段合成完)。Qwen3-TTS 模型不支持真流式,这是"按句模拟流式"。
// audioRef: 隐藏 audio 元素,播放 MediaSource。
async function speakWithTTS(text: string, audioRef: React.MutableRefObject<HTMLAudioElement | null>) {
  try {
    const res = await fetch('/api/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'tts',
        input: text,
        voice: 'default',
        stream: true,        // 流式:按句 chunked 返回
        response_format: 'mp3',
      }),
    });
    if (!res.ok) return;
    const audio = audioRef.current;
    if (!audio) return;

    // MediaSource:把流式 mp3 chunk 追加到 SourceBuffer 边收边播。
    // 浏览器对 mp3 的 SourceBuffer 支持好(mimeType audio/mpeg)。
    if (typeof MediaSource !== 'undefined' && 'MediaSource' in window) {
      const ms = new MediaSource();
      audio.src = URL.createObjectURL(ms);
      let sb: SourceBuffer | null = null;
      const streamDone = res.body?.getReader();
      if (!streamDone) return;

      ms.addEventListener('sourceopen', async () => {
        try {
          sb = ms.addSourceBuffer('audio/mpeg');
        } catch {
          // 部分浏览器 mpeg 不支持 SourceBuffer,回退整段 blob
          return fallbackBlob(res, audio);
        }
        const reader = streamDone;
        // SourceBuffer 追加需要排队(updateend 后再 append,避免忙时抛错)
        let appending = false;
        let pendingBuf: ArrayBuffer | null = null;
        const flush = () => {
          if (!sb) return;
          if (appending || !pendingBuf) return;
          appending = true;
          try {
            sb.appendBuffer(pendingBuf);
          } catch {
            appending = false;
            pendingBuf = null;
          }
        };
        sb.addEventListener('updateend', () => {
          appending = false;
          pendingBuf = null;
          flush();
        });
        const pump = async (): Promise<void> => {
          const { done, value } = await reader.read();
          if (done) {
            if (ms.readyState === 'open') ms.endOfStream();
            return;
          }
          // 每个 chunk 转 ArrayBuffer 后 append(mp3 流式可解析)
          const buf = new Uint8Array(value.byteLength);
          buf.set(value);
          pendingBuf = buf.buffer as ArrayBuffer;
          flush();
          // 开始播放(等第一句进来就播,不等整段)
          if (audio.paused && audio.readyState >= 2) audio.play().catch(() => {});
          await pump();
        };
        void pump();
      });
      return;
    }

    // 无 MediaSource 环境:回退整段 blob
    fallbackBlob(res, audio);
  } catch { /* TTS 失败不影响文本 */ }
}

// 回退:整段下载后播放(非流式环境)
async function fallbackBlob(res: Response, audio: HTMLAudioElement) {
  try {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    audio.src = url;
    audio.play().catch(() => {});
  } catch { /* ignore */ }
}

// ─── TTS 播放队列 ───
//
// 现在是「攒够一句就送去合成」,一轮回复会调好几次 TTS。而 speakWithTTS 每次都
// 直接改写同一个 <audio> 的 src —— 不排队的话后一句会把前一句掐掉,只听见最后一句。
// 这里串行化:一句播完(或失败)再起下一句;打断时清空队列。
const ttsQueue: Array<{
  text: string;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  signal?: AbortSignal;
}> = [];
let ttsRunning = false;

function enqueueTTS(
  text: string,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  signal?: AbortSignal,
) {
  ttsQueue.push({ text, audioRef, signal });
  void runTTSQueue();
}

/** 打断时调:丢掉还没播的句子。 */
export function clearTTSQueue() {
  ttsQueue.length = 0;
}

async function runTTSQueue() {
  if (ttsRunning) return;
  ttsRunning = true;
  try {
    while (ttsQueue.length > 0) {
      const job = ttsQueue.shift()!;
      if (job.signal?.aborted) continue;
      const audio = job.audioRef.current;
      if (!audio) continue;
      await speakWithTTS(job.text, job.audioRef);
      if (job.signal?.aborted) break;
      // 等这一句放完再放下一句(加超时兜底,避免 ended 永远不来时卡死队列)
      await waitForAudioEnd(audio, job.signal);
    }
  } finally {
    ttsRunning = false;
  }
}

function waitForAudioEnd(audio: HTMLAudioElement, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      audio.removeEventListener('ended', finish);
      audio.removeEventListener('error', finish);
      signal?.removeEventListener('abort', finish);
      clearTimeout(timer);
      resolve();
    };
    // 60s 兜底:上游卡住时不要把整条队列堵死
    const timer = setTimeout(finish, 60_000);
    audio.addEventListener('ended', finish);
    audio.addEventListener('error', finish);
    signal?.addEventListener('abort', finish);
  });
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;


// G2: 解析数字人形象指令 <emotion:x/> / <action:y/> / <mouth:speak/>,
// 映射成 onToolCalls 能识别的 DhToolCall(face.setExpression / body.playAction / mouth.speak)。
/**
 * 扫出文本里的 <ui:{json}/> 指令(目前只剩 iframe 一种用法:让数字人开网页/视频)。
 *
 * 用花括号配对扫描,不用正则。旧代码这里有两条写法不一致的正则:
 *   解析用 /<ui:(\{[^}]*(?:,\s*"[^"]*"\s*:[^}]*)*\})\/>/  —— [^}] 跨不过嵌套花括号
 *   剥离用 /<ui:((?:[^{}]|\{[^{}]*\})*)\/>/                —— 能跨一层
 * 于是带嵌套的 UI 指令「既解析不出来、也剥不掉」,原始 JSON 直接漏进聊天气泡,
 * 还会被 TTS 一字一句念出来。
 *
 * 列表/表单/网格已改走 AG-UI 工具调用(ui_show_list 等),不再从这条文本通道走。
 *
 * 返回解析出的对象和剥掉指令后的文本,保证「解析到的」与「剥掉的」永远是同一批。
 */
function extractUiDirectives(text: string): { uis: unknown[]; stripped: string } {
  const TAG = '<ui:';
  const uis: unknown[] = [];
  let out = '';
  let i = 0;

  while (i < text.length) {
    const start = text.indexOf(TAG, i);
    if (start < 0) { out += text.slice(i); break; }

    // 从 '{' 开始做花括号配对(跳过字符串字面量里的括号)
    let j = start + TAG.length;
    if (text[j] !== '{') { out += text.slice(i, j); i = j; continue; }
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (; j < text.length; j++) {
      const ch = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { end = j; break; }
      }
    }
    // 没闭合(还在流式传输中)→ 原样保留,等后续 chunk
    if (end < 0) { out += text.slice(i); break; }
    if (text.slice(end + 1, end + 3) !== '/>') {
      out += text.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    out += text.slice(i, start);
    try {
      const parsed = JSON.parse(text.slice(start + TAG.length, end + 1));
      if (parsed && typeof parsed === 'object') uis.push(parsed);
    } catch { /* JSON 坏了就整条丢弃,不阻断对话 */ }
    i = end + 3;
  }

  return { uis, stripped: out };
}

/**
 * 剥掉形象指令标签,得到可显示 / 可朗读的纯文本。
 * <emotion:x/> / <action:x/> / <mouth:speak/> 用正则,<ui:{json}/> 用上面的配对扫描。
 */
export function stripAvatarDirectives(text: string): string {
  return extractUiDirectives(text).stripped
    .replace(/<emotion:[a-zA-Z_]+\/>/g, '')
    .replace(/<action:[a-zA-Z_]+\/>/g, '')
    .replace(/<mouth:speak\/>/g, '');
}

/**
 * 解析形象指令。
 *
 * ⚠️ 必须只喂「新到达的那一段文本」,不能喂累积全文。
 * 旧代码每收到一个 delta 就把 fullText 整段重解析一遍,于是开头的
 * <action:wave/> 会在每一片上重复触发一次 —— 一条回复分 N 片就派发 N 次动作,
 * 动画被反复打断重启,动态 UI 面板也会重复弹 N 次。
 */
function parseAvatarDirectives(text: string, options: UseChatAvatarWSOptions) {
  // I1: LLM 可能把 < > 转义成 </>,先还原再解析
  const raw = text
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\"/g, '"');
  const calls: Array<{ name: string; args: Record<string, any> }> = [];
  // 表情 <emotion:xxx/>
  const emoRe = /<emotion:([a-zA-Z_]+)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = emoRe.exec(raw))) {
    calls.push({ name: 'face.setExpression', args: { name: m[1] } });
  }
  // 动作 <action:xxx/>
  const actRe = /<action:([a-zA-Z_]+)\/>/g;
  while ((m = actRe.exec(raw))) {
    calls.push({ name: 'body.playAction', args: { name: m[1] } });
  }
  // 口型 <mouth:speak/> — 用当前文本生成 viseme 时间线
  const mouthRe = /<mouth:speak\/>/g;
  while ((m = mouthRe.exec(raw))) {
    calls.push({ name: 'mouth.speak', args: { text: raw } });
  }
  // <ui:{json}/>:目前只剩 iframe 用法(开网页/视频),交给入口组件的虚拟浏览器
  if (options.onUI) {
    for (const ui of extractUiDirectives(raw).uis) {
      if (ui && typeof ui === 'object' && (ui as { type?: unknown }).type) options.onUI(ui);
    }
  }
  if (calls.length > 0) {
    devLog.debug('[parseAvatarDirectives] found calls:', calls.map(c => c.name));
    options.onToolCalls?.(calls);
  }
}

/**
 * 从流式文本里增量取出「刚补全的完整指令标签」。
 *
 * 只在标签闭合(出现 `/>`)之后才交给解析器,并记住已消费到哪个下标,
 * 保证同一个标签只派发一次 —— 既不会因为分片截断丢标签,也不会重复触发。
 */
function makeDirectiveScanner() {
  let consumed = 0;
  return (fullText: string): string => {
    // 最后一个完整闭合标签的结束位置
    const tail = fullText.lastIndexOf('/>');
    if (tail < 0) return '';
    const end = tail + 2;
    if (end <= consumed) return '';
    const segment = fullText.slice(consumed, end);
    consumed = end;
    return segment;
  };
}

interface WSConnection {
  ws: WebSocket;
  url: string;
  seq: number;
  agentId: string;
  // 待发送队列(重连时缓存)
  pending: WSClientMsg[];
  // 回调
  onMessage: (msg: WSServerMsg) => void;
  onOpen: () => void;
  onClose: (err?: string) => void;
  // 状态
  connected: boolean;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  // 用户主动断开标记(disconnect 调用后置 true)
  // 用于:
  //   1. 阻止 CONNECTING 状态下调 close()(避免浏览器原生报
  //      "WebSocket is closed before the connection is established")
  //   2. 阻止重连逻辑
  cancelled: boolean;
}

function createWSConnection(
  url: string,
  agentId: string,
  onMessage: (msg: WSServerMsg) => void,
  onOpen: () => void,
  onClose: (err?: string) => void,
): WSConnection {
  const conn: WSConnection = {
    ws: null as unknown as WebSocket,
    url,
    seq: 0,
    agentId,
    pending: [],
    onMessage,
    onOpen,
    onClose,
    connected: false,
    reconnectTimer: null,
    reconnectAttempts: 0,
    cancelled: false,
  };
  connect(conn);
  return conn;
}

function connect(conn: WSConnection) {
  if (conn.cancelled) return;
  if (conn.ws && conn.ws.readyState === WebSocket.OPEN) return;

  try {
    const wsUrl = conn.url.startsWith('ws')
      ? conn.url
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${conn.url}`;
    const ws = new WebSocket(wsUrl);
    conn.ws = ws;

    ws.onopen = () => {
      // 用户在 CONNECTING 期间点了 disconnect → 等到 OPEN 后再安静关闭,
      // 避免浏览器报 "WebSocket is closed before the connection is established"
      if (conn.cancelled) {
        try { ws.close(1000, 'cancelled'); } catch { /* noop */ }
        return;
      }
      conn.connected = true;
      conn.reconnectAttempts = 0;
      // 发送缓存的消息
      while (conn.pending.length > 0) {
        const msg = conn.pending.shift();
        if (msg) sendRaw(conn, msg);
      }
      conn.onOpen();
    };

    ws.onmessage = (e) => {
      // 已取消的连接忽略后续消息
      if (conn.cancelled) return;
      try {
        const msg: WSServerMsg = JSON.parse(e.data);
        if (msg.seq != null) conn.seq = msg.seq;
        conn.onMessage(msg);
      } catch {
        // 非 JSON 消息忽略
      }
    };

    ws.onclose = () => {
      conn.connected = false;
      if (conn.cancelled) return; // 用户主动断开,不重连、不报错
      const shouldReconnect = conn.reconnectAttempts < 10;
      if (shouldReconnect) {
        const delay = Math.min(
          RECONNECT_MAX_MS,
          RECONNECT_BASE_MS * Math.pow(2, conn.reconnectAttempts),
        );
        conn.reconnectAttempts++;
        conn.reconnectTimer = setTimeout(() => connect(conn), delay);
      } else {
        conn.onClose('WebSocket 连接失败, 已降级到 HTTP');
      }
    };

    ws.onerror = () => {
      // 用户主动断开导致的 error 静默,不污染控制台
      if (conn.cancelled) return;
      // onclose 会紧随其后触发
    };
  } catch {
    if (!conn.cancelled) {
      conn.onClose('WebSocket 初始化失败');
    }
  }
}

function sendRaw(conn: WSConnection, msg: WSClientMsg) {
  if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
    conn.ws.send(JSON.stringify(msg));
  } else {
    conn.pending.push(msg);
  }
}

function disconnect(conn: WSConnection) {
  // 标记主动断开 → 所有 onopen/onmessage/onclose/onerror handler 见到此标志都直接 return
  conn.cancelled = true;
  if (conn.reconnectTimer) {
    clearTimeout(conn.reconnectTimer);
    conn.reconnectTimer = null;
  }
  conn.reconnectAttempts = 999; // 阻止重连
  if (conn.ws) {
    const state = conn.ws.readyState;
    if (state === WebSocket.OPEN || state === WebSocket.CLOSING) {
      // 只有 OPEN/CLOSING 状态调 close() 不会触发浏览器原生 onerror
      conn.ws.close(1000, 'client disconnect');
    }
    // CONNECTING 状态:不要调 close(),让 onopen 触发时检测 cancelled 并安静关闭
    // 避免浏览器报 "WebSocket is closed before the connection is established"
  }
  conn.connected = false;
}

// ─── Hook ───

export interface UseChatAvatarWSOptions {
  /**
   * 当后端 done 消息里带回 tool_calls 时触发(数字人 → 后端 → 前端)。
   * 父组件拿到后用 dispatchToolCalls 把工具调用串到 BlenderAvatar / VrmStage。
   *
   * 兼容字段:后端仍可能只下发 emotion/action(旧协议),此时不调本回调。
   */
  onToolCalls?: (calls: Array<{ name: string; args: Record<string, any> }>) => void;
  /**
   * AG-UI 模式(G1):true 时对话走 agentmanager 的 AG-UI(数字员工),
   * 不再走 Hermes WebSocket。保留数字人形象/语音/动作驱动。
   */
  useAgui?: boolean;
  /** AG-UI 模式下的 agent 名(如 frontend/backend/ops/qa/worker),默认 worker */
  aguiAgent?: string;
  /** H1:从 AG-UI 文本流解析出的动态 UI(数字员工干活后弹结果),入口组件渲染 */
  onUI?: (ui: any) => void;
  /**
   * 数字人调 ui_show_list / ui_show_grid / ui_show_form 时下发的 3D 场景面板。
   * 传 null 表示关闭面板(ui_dismiss)。
   *
   * 取代了原来的 <ui:{json}/> 文本标记:那条路要求 LLM 在散文里手写嵌套 JSON,
   * 而前端用正则去捞 —— 正则跨不过嵌套花括号,列表/表单一条都捞不出来。
   */
  onScenePanel?: (panel: ScenePanel | null) => void;
  /**
   * 未知工具被调用时回调（用于告知用户动作不存在）。
   * 目前没有实现方:未知动作/表情的提示由入口组件读 dispatchToolCalls 的返回值给出。
   */
  onUnknownTool?: (toolName: string) => void;
  /** 用户 ID，用于对话记录（仅已登录用户有效） */
  userId?: number;
  /**
   * 发送前拦截(AG-UI 模式):返回 true 表示已处理(不再发往 AG-UI),false/undefined 继续发。
   * 用于文字输入也走本地意图路由(walk_to/换装/切agent),纯聊天放行给 AG-UI。
   */
  preSendText?: (text: string) => boolean | Promise<boolean>;
}

export function useChatAvatarWS(agentId: string = 'digital_human', options: UseChatAvatarWSOptions = {}): ChatAvatarState {
  // 状态(与 useChatAvatar 完全一致)
  const [text, setText] = React.useState('');
  const [chatBusy, setChatBusy] = React.useState(false);
  const [chatLog, setChatLog] = React.useState<ChatLogItem[]>([]);
  const [emotion, setEmotion] = React.useState<Record<string, number>>({});
  const [viseme, setViseme] = React.useState<Record<string, number>>({});
  const [action, setAction] = React.useState('idle');
  const [isAIGenerated, setIsAIGenerated] = React.useState(false);
  const [isAvatarPlaying, setIsAvatarPlaying] = React.useState(false);
  const [wsFailed, setWsFailed] = React.useState(false);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  // AG-UI 模式下当前这轮请求的中断控制器(barge-in 用)
  const abortRef = React.useRef<AbortController | null>(null);
  const connRef = React.useRef<WSConnection | null>(null);
  const agentRef = React.useRef(agentId);
  agentRef.current = agentId;
  const onToolCallsRef = React.useRef(options.onToolCalls);
  onToolCallsRef.current = options.onToolCalls;

  // G1: AG-UI 模式选项
  const useAgui = !!options.useAgui;
  const aguiAgent = options.aguiAgent || 'worker';
  // 对话记录:用户 ID
  const userIdRef = React.useRef(options.userId);
  React.useEffect(() => { userIdRef.current = options.userId; }, [options.userId]);

  // 002:conversationId 持久化(会话维度历史)
  const [conversationId, setConversationId] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem('dhConversationId');
    } catch {
      return null;
    }
  });
  const conversationIdRef = React.useRef(conversationId);
  React.useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  // 新对话:清空本地 ID + 清 chatLog(后续消息会带空 convId,server 新建)
  const newConversation = React.useCallback(() => {
    try { localStorage.removeItem('dhConversationId'); } catch {}
    setConversationId(null);
    setChatLog([]);
    setEmotion({});
    setViseme({});
    setAction('idle');
    fullTextRef.current = '';
    setText('');
  }, []);

  // 切换到指定会话(供历史面板调用)
  const switchConversation = React.useCallback((cid: string) => {
    try { localStorage.setItem('dhConversationId', cid); } catch {}
    setConversationId(cid);
    setChatLog([]);
    setEmotion({});
    setViseme({});
    setAction('idle');
    fullTextRef.current = '';
    setText('');
  }, []);

  // 加载指定会话的历史消息(从会话列表同源接口拉取),填充 chatLog
  const isLoadingMessagesRef = React.useRef(false);

  const loadConversationMessages = React.useCallback(async (cid: string) => {
    isLoadingMessagesRef.current = true;
    try {
      const res = await fetch(`/api/agentmanager/conversations/${cid}/messages`).catch(() => null)
      if (!res || !res.ok) return
      const j = await res.json().catch(() => null)
      const msgs = j?.messages ?? []
      // 映射 role → who,过滤掉空内容占位消息(工具调用占位 content='' 不显示)
      //
      // 落库的是 LLM 的原始输出,里面还带着 <emotion:x/> / <action:x/> /
      // <mouth:speak/> 这些形象指令。直播时前端会剥掉再显示,读历史时之前没剥 ——
      // 于是翻旧会话就能看见一行行 "<mouth:speak/>你发送了一个字母…"。
      // 剥完可能变成空串(整条消息只有指令),这类一并过滤掉。
      const items = msgs
        .filter((m: any) => typeof m.content === 'string' && m.content.trim() !== '')
        .map((m: any) => ({
          who: (m.role === 'user' ? 'user' : 'ai') as 'user' | 'ai',
          text: stripAvatarDirectives(m.content).trim(),
        }))
        .filter((m: ChatLogItem) => m.text !== '')
      setChatLog(items)
    } catch {
      // 加载失败不阻塞(保持空列表)
    } finally {
      isLoadingMessagesRef.current = false;
    }
  }, [])

  // 002:AI 消息持久化 — chatLog 增长时,追加 AI 消息到后端
  // (用户消息已在 send() 里直接写;这里只处理 AI 回复)
  const prevChatLogLenRef = React.useRef(0);
  React.useEffect(() => {
    const currentLen = chatLog.length;
    if (currentLen <= prevChatLogLenRef.current) {
      prevChatLogLenRef.current = currentLen;
      return;
    }
    if (isLoadingMessagesRef.current) {
      prevChatLogLenRef.current = currentLen;
      return; // 正在从后端加载历史,跳过本次持久化
    }
    const cid = conversationIdRef.current;
    if (!cid || typeof cid !== 'string' || cid.startsWith('local-')) {
      prevChatLogLenRef.current = currentLen;
      return;
    }
    // 取本轮新增的消息(最后一条)
    const added = chatLog[currentLen - 1];
    if (added && added.who === 'ai') {
      fetch(`/api/agentmanager/conversations/${cid}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'assistant', content: added.text }),
      }).catch(() => {});
    }
    prevChatLogLenRef.current = currentLen;
  }, [chatLog]);

  // AudioContext 用于播放流式音频 chunk
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const nextAudioTimeRef = React.useRef<number>(0);
  const fullTextRef = React.useRef('');
  const thinkingTextRef = React.useRef('');
  const [thinkingLog, setThinkingLog] = React.useState('');

  // 获取或创建 AudioContext
  const getAudioCtx = React.useCallback(() => {
    if (!audioCtxRef.current && typeof window !== 'undefined') {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (AC) audioCtxRef.current = new AC();
    }
    return audioCtxRef.current;
  }, []);

  // 播放 base64 PCM16 音频 chunk
  const playAudioChunk = React.useCallback(
    async (audioB64: string) => {
      const ctx = getAudioCtx();
      if (!ctx) return;

      try {
        // 解码 base64 → ArrayBuffer → AudioBuffer (后端保证 16kHz mono PCM16)
        const raw = Uint8Array.from(atob(audioB64), (c) => c.charCodeAt(0));
        const pcm16 = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2));

        // 转 Float32
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
          float32[i] = pcm16[i] / 32768;
        }

        const audioBuffer = ctx.createBuffer(1, float32.length, 16000);
        audioBuffer.getChannelData(0).set(float32);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        // 调度播放(保证 chunk 之间无缝)
        const now = ctx.currentTime;
        const startTime = Math.max(now, nextAudioTimeRef.current);
        source.start(startTime);
        nextAudioTimeRef.current = startTime + audioBuffer.duration;
      } catch {
        // PCM 播放失败, 忽略
      }
    },
    [getAudioCtx],
  );

  // 情绪名 → VRM expression
  const emotionToVRM = React.useCallback((name: string): Record<string, number> => {
    const map: Record<string, Record<string, number>> = {
      smile: { smile: 1.0 },
      surprised: { surprised: 1.0 },
      angry: { angry: 1.0 },
      sad: { sad: 1.0 },
      neutral: {},
    };
    return map[name] || {};
  }, []);

  // 连接 WebSocket
  const connectWS = React.useCallback(() => {
    // dev 模式: NEXT_PUBLIC_WS_BASE 直连后端(Next.js rewrites 不支持 WS 升级)
    // 生产环境: 相对路径, 经 nginx/APISIX 代理(enable_websocket: true)
    const base = process.env.NEXT_PUBLIC_WS_BASE || '';
    // 数字人 WS 路径统一到 /ws/realtime
    const wsPath = '/api/avatar/ws';
    const wsUrl = base
      ? `${base}${wsPath}?agentId=${encodeURIComponent(agentRef.current)}`
      : `${wsPath}?agentId=${encodeURIComponent(agentRef.current)}`;

    const conn = createWSConnection(
      wsUrl,
      agentRef.current,
      // onMessage
      (msg: WSServerMsg) => {
        switch (msg.type) {
          case 'text_token':
            if (msg.token) {
              fullTextRef.current += msg.token;
              // 更新最后一条 AI 消息(打字机效果)
              setChatLog((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.who === 'ai') {
                  copy[copy.length - 1] = { ...last, text: fullTextRef.current };
                } else {
                  copy.push({ who: 'ai', text: msg.token! });
                }
                return copy;
              });
            }
            break;

          case 'audio_chunk':
            // DEBUG: 诊断口型链路 — 一次 commit 后可以整段删
             
            console.log('[dh-debug] audio_chunk', {
              hasAudio: !!msg.audioB64,
              audioBytes: msg.audioB64 ? Math.round(msg.audioB64.length * 0.75) : 0,  // base64 → bytes 近似
              visemeCount: msg.visemes?.length || 0,
              firstViseme: msg.visemes?.[0],
              lastViseme: msg.visemes?.[msg.visemes.length - 1],
              audioDone: msg.audioDone,
              textDone: msg.textDone,
            });
            if (msg.audioB64) {
              playAudioChunk(msg.audioB64);
              setIsAvatarPlaying(true);
            }
            if (msg.visemes && msg.visemes.length > 0) {
              const last = msg.visemes[msg.visemes.length - 1];
              // DEBUG: 实际被应用的 viseme
               
              console.log('[dh-debug] viseme-apply', { shape: last.shape, weight: last.weight });
              setViseme({ [last.shape]: last.weight });
            }
            break;

          case 'viseme_frames':
            if (msg.visemes && msg.visemes.length > 0) {
              const last = msg.visemes[msg.visemes.length - 1];
              setViseme({ [last.shape]: last.weight });
            }
            break;

          case 'done': {
            if (msg.textDone) {
              setChatBusy(false);
              if (msg.fullText) {
                fullTextRef.current = msg.fullText;
                setChatLog((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last && last.who === 'ai') {
                    copy[copy.length - 1] = { ...last, text: msg.fullText! };
                  } else if (msg.fullText) {
                    copy.push({ who: 'ai', text: msg.fullText });
                  }
                  return copy;
                });
              }
              if (msg.emotion) setEmotion(emotionToVRM(msg.emotion));
              if (msg.action) setAction(msg.action);
              // Hermes/数字人 tool_calls 透传:把后端下发的工具调用抛给父组件,
              // 由父组件用 dispatchToolCalls 串到 BlenderAvatar / VrmStage。
              if (msg.toolCalls && msg.toolCalls.length > 0 && onToolCallsRef.current) {
                try {
                  onToolCallsRef.current(
                    msg.toolCalls.map((tc) => ({ name: tc.name, args: tc.args || {} })),
                  );
                } catch (e) {
                  console.warn('[useChatAvatarWS] onToolCalls threw:', e);
                }
              }
              // 002:服务端回传 conversationId → 持久化 + 更新 state
              if (msg.conversationId && msg.conversationId !== conversationIdRef.current) {
                try { localStorage.setItem('dhConversationId', msg.conversationId); } catch {}
                setConversationId(msg.conversationId);
              }
            }
            if (msg.audioDone) {
              setViseme({});
              setIsAvatarPlaying(false);
              nextAudioTimeRef.current = 0;
            }
            break;
          }

          case 'error':
            console.warn('[useChatAvatarWS] server error:', msg.error);
            break;

          case 'frame':
            if (msg.blendshapes) {
              setViseme(msg.blendshapes);
            }
            break;

          case 'pong':
            break;

          case 'asr_result':
            // 由 voice agent 通过自定义事件使用
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('ws-asr-result', {
                  detail: { text: msg.asrText, isFinal: msg.asrIsFinal },
                }),
              );
            }
            break;
        }
      },
      // onOpen
      () => {
        setWsFailed(false);
      },
      // onClose
      (err) => {
        if (err) {
          console.warn('[useChatAvatarWS]', err);
          setWsFailed(true);
        }
      },
    );

    connRef.current = conn;
  }, [playAudioChunk, emotionToVRM]);

  // 初始化连接
  React.useEffect(() => {
    // G1: AG-UI 模式不需要 WS 连接（走 HTTP SSE）
    if (options.useAgui) return;
    connectWS();
    return () => {
      if (connRef.current) disconnect(connRef.current);
      // 清理情绪/动作 timeout
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    };
  }, [connectWS, options.useAgui]);

  // 心跳: 每 30s 发一次 ping,防止 APISIX/nginx 60s 空闲超时断连
  React.useEffect(() => {
    if (options.useAgui) return; // AG-UI 模式不需要心跳
    const timer = setInterval(() => {
      const conn = connRef.current;
      if (conn && conn.connected) {
        sendRaw(conn, { type: 'ping' });
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [options.useAgui]);

  // send: 发送聊天消息
  const send = React.useCallback(async () => {
    const t = text.trim();
    if (!t || chatBusy) return;

    setChatBusy(true);
    setChatLog((c) => [...c, { who: 'user', text: t }]);
    fullTextRef.current = '';
    thinkingTextRef.current = '';
    setThinkingLog('');
    setText('');
    setIsAIGenerated(true);
    nextAudioTimeRef.current = 0;

    // 002:持久化用户消息到后端(digital_human_conversation.messages)
    const cid = conversationIdRef.current;
    if (cid && typeof cid === 'string' && !cid.startsWith('local-')) {
      fetch(`/api/agentmanager/conversations/${cid}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: t }),
      }).catch(() => {}); // fire-and-forget
    }

    // G1: AG-UI 模式(数字员工),替代 Hermes WS
    if (useAgui) {
      // 发送前拦截(本地意图路由):返回 true 表示已处理,不再发 AG-UI
      if (options.preSendText) {
        const handled = await options.preSendText(t);
        if (handled) { setChatBusy(false); return; }
      }
      await aguiChatOnce(t);
      return;
    }

    const conn = connRef.current;
    if (conn && conn.connected) {
      // WS 模式
      sendRaw(conn, {
        type: 'chat',
        text: t,
        agentId: agentRef.current,
        conversationId: conversationIdRef.current || undefined,
        history: chatLog.map((m) => ({
          role: m.who === 'user' ? 'user' : 'assistant',
          content: m.text,
        })),
      });
    } else {
      // HTTP 降级
      try {
        const r = await fetch('/api/avatar/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: t,
            agentId: agentRef.current,
            conversationId: conversationIdRef.current || undefined,
            history: chatLog.map((m) => ({
              role: m.who === 'user' ? 'user' : 'assistant',
              content: m.text,
            })),
          }),
        });
        if (r.ok) {
          const resp = await r.json();
          setChatLog((c) => [...c, { who: 'ai', text: resp.text }]);
          if (resp.emotion) setEmotion(resp.emotion);
          if (resp.action) setAction(resp.action);
          if (resp.isAIGenerated !== undefined) setIsAIGenerated(resp.isAIGenerated);
          if (resp.audioUrl && audioRef.current) {
            audioRef.current.src = resp.audioUrl;
            audioRef.current.play().catch(() => {});
          }
        } else {
          setChatLog((c) => [...c, { who: 'ai', text: '抱歉, 服务暂时不可用。' }]);
        }
      } catch {
        setChatLog((c) => [...c, { who: 'ai', text: '抱歉, 服务暂时不可用。' }]);
        setIsAIGenerated(false);
      } finally {
        setChatBusy(false);
      }
    }
  }, [text, chatBusy, chatLog]);

  // sendText: 直接发送指定文本(绕过 text state, 给 voice agent 用)
  const sendText = React.useCallback(
    async (v: string) => {
      const t = v.trim();
      if (!t || chatBusy) return;

      setChatBusy(true);
      setChatLog((c) => [...c, { who: 'user', text: t }]);
      fullTextRef.current = '';
      thinkingTextRef.current = '';
      setThinkingLog('');
      setIsAIGenerated(true);
      nextAudioTimeRef.current = 0;

      // G1: AG-UI 模式(数字员工)
      if (useAgui) {
        // 发送前拦截(本地意图路由):返回 true 表示已处理,不再发 AG-UI
        if (options.preSendText) {
          const handled = await options.preSendText(t);
          if (handled) { setChatBusy(false); return; }
        }
        await aguiChatOnce(t);
        return;
      }

      const conn = connRef.current;
      if (conn && conn.connected) {
        sendRaw(conn, {
          type: 'chat',
          text: t,
          agentId: agentRef.current,
          conversationId: conversationIdRef.current || undefined,
          history: chatLog.map((m) => ({
            role: m.who === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
        });
      } else {
        // HTTP 降级
        try {
          const r = await fetch('/api/avatar/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: t,
              agentId: agentRef.current,
              history: chatLog.map((m) => ({
                role: m.who === 'user' ? 'user' : 'assistant',
                content: m.text,
              })),
            }),
          });
          if (r.ok) {
            const resp = await r.json();
            setChatLog((c) => [...c, { who: 'ai', text: resp.text }]);
            if (resp.emotion) setEmotion(resp.emotion);
            if (resp.action) setAction(resp.action);
            if (resp.isAIGenerated !== undefined) setIsAIGenerated(resp.isAIGenerated);
            if (resp.audioUrl && audioRef.current) {
              audioRef.current.src = resp.audioUrl;
              audioRef.current.play().catch(() => {});
            }
          } else {
            setChatLog((c) => [...c, { who: 'ai', text: '抱歉, 服务暂时不可用。' }]);
          }
        } catch {
          setChatLog((c) => [...c, { who: 'ai', text: '抱歉, 服务暂时不可用。' }]);
          setIsAIGenerated(false);
        } finally {
          setChatBusy(false);
        }
      }
    },
    [chatBusy, chatLog],
  );

  // cancel: 打断
  const cancel = React.useCallback(() => {
    const conn = connRef.current;
    if (conn && conn.connected) {
      sendRaw(conn, { type: 'cancel' });
    }
    // AG-UI 模式没有 WS 连接:必须真的把 SSE 请求 abort 掉。
    // 之前只暂停了音频,流照跑、onDone 照触发,TTS 又把整段重念一遍 ——
    // 用户打断了个寂寞。
    abortRef.current?.abort();
    abortRef.current = null;
    clearTTSQueue();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsAvatarPlaying(false);
    setViseme({});
    setChatBusy(false);
    nextAudioTimeRef.current = 0;
  }, []);

  // isSpeaking
  const isSpeaking = React.useCallback(() => {
    if (isAvatarPlaying) return true;
    const a = audioRef.current;
    if (!a) return false;
    return !a.paused && a.currentTime > 0 && !a.ended;
  }, [isAvatarPlaying]);

  // 情绪 + 动作驱动(LLM 驱动的外部接口)
  // 使用 ref 跟踪 timeout ID，组件卸载时清理防止内存泄漏
  const emotionTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const setEmotionExternal = React.useCallback(
    (name: string | Record<string, number>) => {
      // 清除之前的 timeout
      if (emotionTimerRef.current) {
        clearTimeout(emotionTimerRef.current);
        emotionTimerRef.current = null;
      }
      // 传入 blendshape dict 时直接用，传入 emotion name 时走转换
      if (typeof name === 'object') {
        setEmotion(name);
        // dict 形式不自动清除，由调用方控制
      } else {
        setEmotion(emotionToVRM(name));
        emotionTimerRef.current = setTimeout(() => {
          setEmotion({});
          emotionTimerRef.current = null;
        }, 5000);
      }
    },
    [emotionToVRM],
  );

  const setActionExternal = React.useCallback((name: string) => {
    // 清除之前的 timeout
    if (actionTimerRef.current) {
      clearTimeout(actionTimerRef.current);
      actionTimerRef.current = null;
    }
    setAction(name);
    actionTimerRef.current = setTimeout(() => {
      setAction('idle');
      actionTimerRef.current = null;
    }, 6000);
  }, []);

  // recording (简化: 通过 voice agent 直接走 WS asr)
  const [recording, setRecording] = React.useState(false);
  const [recordingError, setRecordingError] = React.useState<string | null>(null);

  const toggleRecording = React.useCallback(async () => {
    // 录音由 AlwaysListening voice agent 处理, 这里只是状态占位
    setRecording((r) => !r);
  }, []);

  // 暴露 WS 引用给 voice agent
  const wsRef = React.useRef<{
    send: (msg: WSClientMsg) => void;
    connected: boolean;
  }>({
    send: (msg: WSClientMsg) => {
      if (connRef.current) sendRaw(connRef.current, msg);
    },
    connected: false,
  });

  React.useEffect(() => {
    wsRef.current.connected = connRef.current?.connected ?? false;
  });

  // G1: AG-UI 对话(数字员工)。替代 Hermes WS,保留数字人形象/语音/动作驱动。
  const aguiChatOnce = React.useCallback(
    async (userText: string) => {
      // 打断用:每轮对话一个 AbortController。
      // 之前 cancel() 只发 WS 的 cancel 消息,而 AG-UI 模式压根没有 WS 连接 ——
      // 用户打断时音频暂停了,SSE 却照跑,onDone 一到 TTS 又开口把整段念一遍。
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const { agentmAPI } = await import('@/lib/agentmanager/api');
        // 增量扫描器:保证同一个 <action:.../> 只派发一次(旧代码每片重解析全文)
        const scanDirectives = makeDirectiveScanner();
        // 已朗读到的位置:边流边按句读,不用等整段生成完
        let spokenUpto = 0;
        // H4 从当前对话日志构造历史上下文(用户/助手交替),让 agent 延续上下文
        const history = chatLog
          .filter((m) => m.who === 'user' || m.who === 'ai')
          .slice(-10)
          .map((m) => ({
            role: m.who === 'user' ? 'user' : 'assistant',
            content: m.text,
          }));

        // 流式朗读:文本攒够一个完整句子就送去 TTS,首次出声不用等整段写完。
        const speakReady = (final: boolean) => {
          if (ac.signal.aborted) return;
          const clean = stripAvatarDirectives(fullTextRef.current);
          const pending = clean.slice(spokenUpto);
          if (!pending) return;
          // 找最后一个句末标点;final 时不挑了,剩下的一次读完
          const cut = final ? pending.length : lastSentenceEnd(pending);
          if (cut <= 0) return;
          const say = pending.slice(0, cut);
          spokenUpto += cut;
          const ttsText = filterTTSContent(say);
          if (ttsText) enqueueTTS(ttsText, audioRef, ac.signal);
        };

        await agentmAPI.aguiChat(
          {
            agent: aguiAgent || 'worker',
            prompt: userText,
            session_id: conversationIdRef.current || undefined,
            user_id: userIdRef.current || undefined, // 仅已登录用户记录对话
            // G2: 数字人模式,后端注入形象指令模板,回答内嵌 <emotion:x/>/<action:y/>
            avatar_mode: true,
            // H4: 携带历史上下文
            history,
          },
          {
            onThinking: (t) => {
              // 思考过程:累积到 thinkingLog,显示为思考面板
              thinkingTextRef.current += t;
              setThinkingLog(thinkingTextRef.current);
            },
            onDelta: (t) => {
              fullTextRef.current += t;
              // 只把「本次新闭合的标签段」交给解析器,避免重复派发动作/表情
              const segment = scanDirectives(fullTextRef.current);
              if (segment) parseAvatarDirectives(segment, options);
              // 清洗掉形象指令,只显示纯文本
              const cleanText = stripAvatarDirectives(fullTextRef.current);
              // 打字机效果
              setChatLog((c) => {
                const last = c[c.length - 1];
                if (last && last.who === 'ai') {
                  return [...c.slice(0, -1), { who: 'ai', text: cleanText }];
                }
                return [...c, { who: 'ai', text: cleanText }];
              });
              // 攒够一整句就先读出来
              speakReady(false);
            },
            onToolStart: (name) => {
              // 业务工具开始执行时给个可见反馈,免得用户以为卡住了
              const hint = TOOL_RUNNING_HINT[name];
              if (hint) setThinkingLog(hint);
            },
            onToolCall: (name, toolCallId, argsJSON) => {
              // 到这里 args 已经由 api.ts 攒完整了(TOOL_CALL_END 才交付),
              // 不用再自己缓冲补参、也不会拿到半截 JSON。
              let args: Record<string, any> = {};
              if (argsJSON) {
                try {
                  const parsed = JSON.parse(argsJSON);
                  if (parsed && typeof parsed === 'object') args = parsed;
                } catch {
                  devLog.warn('[agui] 工具参数解析失败:', name, argsJSON?.slice(0, 200));
                }
              }

              // 生成式 UI 工具 → 3D 场景面板(列表 / 网格 / 表单)
              if (name === SCENE_PANEL_DISMISS_TOOL) {
                options.onScenePanel?.(null);
                return;
              }
              if (SCENE_PANEL_TOOLS[name]) {
                const panel = scenePanelFromToolCall(name, args, toolCallId);
                if (panel) options.onScenePanel?.(panel);
                else devLog.warn('[agui] UI 工具参数不合法,不弹面板:', name, args);
                return;
              }

              // 其余工具走 dispatcher 通路:数字人形象/动作/换装/移动驱动
              options.onToolCalls?.([{ name, args }]);
            },
            onToolEnd: () => {
              setThinkingLog('');
            },
            onDone: () => {
              setChatBusy(false);
              // 收尾:把最后一段还没闭合成句的文本读掉
              speakReady(true);
            },
            onError: (err) => {
              setChatLog((c) => [...c, { who: 'ai', text: `❌ ${err}` }]);
              setChatBusy(false);
            },
          },
          ac.signal,
        );
      } catch (e: any) {
        if (e?.name === 'AbortError') return; // 主动打断,不算错误
        setChatLog((c) => [...c, { who: 'ai', text: `❌ ${e?.message || 'AG-UI 调用失败'}` }]);
        setChatBusy(false);
      }
    },
    [aguiAgent, options, chatLog],
  );

  return {
    text,
    setText,
    chatBusy,
    chatLog,
    emotion,
    viseme,
    action,
    isAIGenerated,
    send,
    sendText,
    conversationId,
    newConversation,
    switchConversation,
    loadConversationMessages,
    setEmotion: setEmotionExternal,
    setAction: setActionExternal,
    setViseme,
    setChatLog,
    thinkingLog,
    setThinkingLog,
    audioRef: audioRef as React.MutableRefObject<HTMLAudioElement | null>,
    recording,
    recordingError,
    toggleRecording,
    cancel,
    isSpeaking,
  };
}

// 导出 WS client 类型供 voice agent 使用
export type { WSClientMsg, WSServerMsg };
