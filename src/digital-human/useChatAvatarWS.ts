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
  };
  connect(conn);
  return conn;
}

function connect(conn: WSConnection) {
  if (conn.ws && conn.ws.readyState === WebSocket.OPEN) return;

  try {
    const wsUrl = conn.url.startsWith('ws')
      ? conn.url
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${conn.url}`;
    const ws = new WebSocket(wsUrl);
    conn.ws = ws;

    ws.onopen = () => {
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
      // onclose 会紧随其后触发
    };
  } catch {
    conn.onClose('WebSocket 初始化失败');
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
  if (conn.reconnectTimer) {
    clearTimeout(conn.reconnectTimer);
    conn.reconnectTimer = null;
  }
  conn.reconnectAttempts = 999; // 阻止重连
  if (conn.ws) {
    conn.ws.onclose = null; // 阻止 onclose 触发重连
    conn.ws.close();
  }
  conn.connected = false;
}

// ─── Hook ───

export function useChatAvatarWS(agentId: string = 'digital_human'): ChatAvatarState {
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
        // 解码 base64 → ArrayBuffer → AudioBuffer
        const raw = Uint8Array.from(atob(audioB64), (c) => c.charCodeAt(0));
        const pcm16 = new Int16Array(raw.buffer);

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
    const wsUrl = base
      ? `${base}/api/realtime/ws?agentId=${encodeURIComponent(agentRef.current)}`
      : `/api/realtime/ws?agentId=${encodeURIComponent(agentRef.current)}`;

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
            if (msg.audioB64) {
              playAudioChunk(msg.audioB64);
              setIsAvatarPlaying(true);
            }
            if (msg.visemes && msg.visemes.length > 0) {
              const last = msg.visemes[msg.visemes.length - 1];
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
    };
  }, [connectWS]);

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

    const conn = connRef.current;
    if (conn && conn.connected) {
      // WS 模式
      sendRaw(conn, {
        type: 'chat',
        text: t,
        agentId: agentRef.current,
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

      const conn = connRef.current;
      if (conn && conn.connected) {
        sendRaw(conn, {
          type: 'chat',
          text: t,
          agentId: agentRef.current,
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
  const setEmotionExternal = React.useCallback(
    (name: string) => {
      setEmotion(emotionToVRM(name));
      setTimeout(() => setEmotion({}), 5000);
    },
    [emotionToVRM],
  );

  const setActionExternal = React.useCallback((name: string) => {
    setAction(name);
    setTimeout(() => setAction('idle'), 6000);
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
