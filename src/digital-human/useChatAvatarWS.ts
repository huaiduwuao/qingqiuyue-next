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
import type {
  ChatAvatarState,
  ChatLogItem,
  VisemeFrame,
} from './useChatAvatar';

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

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

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
  const connRef = React.useRef<WSConnection | null>(null);
  const agentRef = React.useRef(agentId);
  agentRef.current = agentId;
  const onToolCallsRef = React.useRef(options.onToolCalls);
  onToolCallsRef.current = options.onToolCalls;

  // G1: AG-UI 模式选项
  const useAgui = !!options.useAgui;
  const aguiAgent = options.aguiAgent || 'worker';

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

  // AudioContext 用于播放流式音频 chunk
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const nextAudioTimeRef = React.useRef<number>(0);
  const fullTextRef = React.useRef('');

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
    const wsPath = '/ws/realtime';
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
    connectWS();
    return () => {
      if (connRef.current) disconnect(connRef.current);
      // 清理情绪/动作 timeout
      if (emotionTimerRef.current) clearTimeout(emotionTimerRef.current);
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    };
  }, [connectWS]);

  // 心跳: 每 30s 发一次 ping,防止 APISIX/nginx 60s 空闲超时断连
  React.useEffect(() => {
    const timer = setInterval(() => {
      const conn = connRef.current;
      if (conn && conn.connected) {
        sendRaw(conn, { type: 'ping' });
      }
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // send: 发送聊天消息
  const send = React.useCallback(async () => {
    const t = text.trim();
    if (!t || chatBusy) return;

    setChatBusy(true);
    setChatLog((c) => [...c, { who: 'user', text: t }]);
    fullTextRef.current = '';
    setText('');
    setIsAIGenerated(true);
    nextAudioTimeRef.current = 0;

    // G1: AG-UI 模式(数字员工),替代 Hermes WS
    if (useAgui) {
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
      setIsAIGenerated(true);
      nextAudioTimeRef.current = 0;

      // G1: AG-UI 模式(数字员工)
      if (useAgui) {
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
    (name: string) => {
      // 清除之前的 timeout
      if (emotionTimerRef.current) {
        clearTimeout(emotionTimerRef.current);
        emotionTimerRef.current = null;
      }
      setEmotion(emotionToVRM(name));
      emotionTimerRef.current = setTimeout(() => {
        setEmotion({});
        emotionTimerRef.current = null;
      }, 5000);
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
      try {
        const { agentmAPI } = await import('@/lib/agentmanager/api');
        const toolStarted: string[] = [];
        await agentmAPI.aguiChat(
          {
            agent: aguiAgent || 'worker',
            prompt: userText,
            session_id: conversationIdRef.current || undefined,
          },
          {
            onDelta: (t) => {
              fullTextRef.current += t;
              // 打字机效果
              setChatLog((c) => {
                const last = c[c.length - 1];
                if (last && last.who === 'ai') {
                  return [...c.slice(0, -1), { who: 'ai', text: fullTextRef.current }];
                }
                return [...c, { who: 'ai', text: fullTextRef.current }];
              });
            },
            onToolCall: (name, toolCallId) => {
              toolStarted.push(toolCallId || name);
              // 复用 dispatcher 通路:数字人形象/动作驱动
              options.onToolCalls?.([{ name, args: {} }]);
            },
            onToolEnd: () => {
              // 工具结束(暂不额外处理)
            },
            onDone: () => {
              setChatBusy(false);
            },
            onError: (err) => {
              setChatLog((c) => [...c, { who: 'ai', text: `❌ ${err}` }]);
              setChatBusy(false);
            },
          },
        );
      } catch (e: any) {
        setChatLog((c) => [...c, { who: 'ai', text: `❌ ${e?.message || 'AG-UI 调用失败'}` }]);
        setChatBusy(false);
      }
    },
    [aguiAgent, options],
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
    setEmotion: setEmotionExternal,
    setAction: setActionExternal,
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
