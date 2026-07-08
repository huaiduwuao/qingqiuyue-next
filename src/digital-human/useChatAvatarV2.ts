'use client';

/**
 * useChatAvatarV2 —— 接入 /api/digital-human/chat 的 LLM + 工具调用驱动 hook
 *
 * 与 useChatAvatar / useChatAvatarWS 的差别:
 *   - 请求 /api/digital-human/chat (新), 接收 tool_calls
 *   - 把 tool_calls 通过 sinks 推到外部 — 通常 BlenderAvatar 的 onToolCall
 *   - 同时保留 emotion / viseme / action 兼容旧 prop 接口
 *
 * 设计:
 *   - sinks 由外部 (BlenderAvatar parent) 注入
 *   - 同时把 emotion / action 推给 BlenderAvatar 的 prop, 兼容旧代码
 */

import React from 'react';
import type { ChatLogItem, VisemeFrame } from './useChatAvatar';

export interface ChatAvatarV2Resp {
  text: string;
  tool_calls?: Array<{ name: string; params: Record<string, any> }>;
  /** 兼容旧字段 */
  emotion?: Record<string, number>;
  action?: string;
  visemes?: VisemeFrame[];
  audioUrl?: string | null;
  audioDuration?: number;
  visemeSource?: 'aligned' | 'text-fallback';
  isAIGenerated?: boolean;
}

export interface ChatAvatarV2Sinks {
  setEmotion: (bs: Record<string, number>) => void;
  setAction: (name: string) => void;
  setViseme: (shape: string, weight: number) => void;
  setVisemeTimeline: (frames: VisemeFrame[]) => void;
  setJawOpen: (v: number) => void;
  /** 通用工具调用 */
  onToolCall: (call: { name: string; params: Record<string, any> }) => void;
  /** TTS 播放 (可选) */
  speak: (text: string, audioUrl?: string) => void;
}

export interface ChatAvatarV2State {
  text: string;
  setText: (v: string) => void;
  chatBusy: boolean;
  chatLog: ChatLogItem[];
  emotion: Record<string, number>;
  viseme: Record<string, number>;
  action: string;
  isAIGenerated: boolean;
  send: () => Promise<void>;
  sendText: (v: string) => Promise<void>;
  cancel: () => void;
  isSpeaking: () => boolean;
}

export function useChatAvatarV2(
  agentId: string,
  sinks: ChatAvatarV2Sinks,
): ChatAvatarV2State {
  const [text, setText] = React.useState('');
  const [chatBusy, setChatBusy] = React.useState(false);
  const [chatLog, setChatLog] = React.useState<ChatLogItem[]>([]);
  const [emotion, setEmotion] = React.useState<Record<string, number>>({});
  const [viseme, setViseme] = React.useState<Record<string, number>>({});
  const [action, setAction] = React.useState('idle');
  const [isAIGenerated, setIsAIGenerated] = React.useState(false);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const visemeTimelineRef = React.useRef<VisemeFrame[]>([]);
  const visemeStartRef = React.useRef<number>(0);
  const visemeActiveRef = React.useRef<boolean>(false);
  const isAvatarPlayingRef = React.useRef(false);

  const send = React.useCallback(async () => {
    const t = text.trim();
    if (!t || chatBusy) return;
    await doSend(t, chatLog, sinks, agentId, {
      setChatBusy, setChatLog, setEmotion, setAction, setViseme, setText,
      setIsAIGenerated,
      audioRef, visemeTimelineRef, visemeStartRef, visemeActiveRef, isAvatarPlayingRef,
    });
  }, [text, chatBusy, chatLog, sinks, agentId]);

  const sendText = React.useCallback(async (v: string) => {
    const t = v.trim();
    if (!t || chatBusy) return;
    await doSend(t, chatLog, sinks, agentId, {
      setChatBusy, setChatLog, setEmotion, setAction, setViseme, setText: () => {},
      setIsAIGenerated,
      audioRef, visemeTimelineRef, visemeStartRef, visemeActiveRef, isAvatarPlayingRef,
    });
  }, [chatBusy, chatLog, sinks, agentId]);

  const cancel = React.useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    visemeActiveRef.current = false;
    sinks.setViseme('sil', 1);
    setViseme({});
    isAvatarPlayingRef.current = false;
    setChatBusy(false);
  }, [sinks]);

  const isSpeaking = React.useCallback(() => {
    if (isAvatarPlayingRef.current) return true;
    const a = audioRef.current;
    if (!a) return false;
    return !a.paused && a.currentTime > 0 && !a.ended;
  }, []);

  return {
    text, setText,
    chatBusy, chatLog,
    emotion, viseme, action,
    isAIGenerated,
    send, sendText, cancel, isSpeaking,
  };
}

interface DoSendCtx {
  setChatBusy: React.Dispatch<React.SetStateAction<boolean>>;
  setChatLog: React.Dispatch<React.SetStateAction<ChatLogItem[]>>;
  setEmotion: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setAction: React.Dispatch<React.SetStateAction<string>>;
  setViseme: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setText: (v: string) => void;
  setIsAIGenerated: React.Dispatch<React.SetStateAction<boolean>>;
  audioRef: React.MutableRefObject<HTMLAudioElement | null>;
  visemeTimelineRef: React.MutableRefObject<VisemeFrame[]>;
  visemeStartRef: React.MutableRefObject<number>;
  visemeActiveRef: React.MutableRefObject<boolean>;
  isAvatarPlayingRef: React.MutableRefObject<boolean>;
}

async function doSend(
  t: string,
  chatLog: ChatLogItem[],
  sinks: ChatAvatarV2Sinks,
  agentId: string,
  ctx: DoSendCtx,
) {
  ctx.setChatBusy(true);
  ctx.setChatLog(c => [...c, { who: 'user', text: t }]);
  ctx.setText('');
  ctx.setIsAIGenerated(true);

  try {
    const r = await fetch('/api/digital-human/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: t,
        agentId,
        history: chatLog.map(m => ({ role: m.who === 'user' ? 'user' : 'assistant', content: m.text })),
        enableTools: true,
      }),
    });
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({} as any));
      throw new Error(errBody?.error || `服务返回 ${r.status}`);
    }
    const resp: ChatAvatarV2Resp = await r.json();
    ctx.setChatLog(c => [...c, { who: 'ai', text: resp.text }]);
    ctx.setIsAIGenerated(resp.isAIGenerated === true);

    // 1) 新协议: tool_calls — 优先用 dispatcher 推到 BlenderAvatar
    if (resp.tool_calls && resp.tool_calls.length > 0) {
      for (const call of resp.tool_calls) {
        try {
          sinks.onToolCall(call);
        } catch (e) {
          console.warn('[dh-v2] tool call failed:', call.name, e);
        }
      }
    } else {
      // 2) 兼容旧字段
      if (resp.emotion) {
        ctx.setEmotion(resp.emotion);
        sinks.setEmotion(resp.emotion);
      }
      if (resp.action) {
        ctx.setAction(resp.action);
        sinks.setAction(resp.action);
      }
    }

    // 3) viseme timeline + 音频播放
    ctx.setViseme({});
    ctx.visemeTimelineRef.current = resp.visemes || [];
    if (resp.audioUrl && ctx.audioRef.current) {
      const a = ctx.audioRef.current;
      a.onplay = () => {
        ctx.visemeStartRef.current = performance.now();
        ctx.visemeActiveRef.current = true;
        ctx.isAvatarPlayingRef.current = true;
        sinks.setVisemeTimeline(resp.visemes || []);
      };
      a.onended = () => {
        ctx.visemeActiveRef.current = false;
        ctx.setViseme({});
        ctx.isAvatarPlayingRef.current = false;
      };
      a.src = resp.audioUrl;
      a.play().catch(() => {
        // autoplay 拒绝, 仍跑 viseme 时间线
        ctx.visemeStartRef.current = performance.now();
        ctx.visemeActiveRef.current = true;
        sinks.setVisemeTimeline(resp.visemes || []);
      });
    } else if (resp.visemes && resp.visemes.length > 0) {
      ctx.visemeStartRef.current = performance.now();
      ctx.visemeActiveRef.current = true;
      sinks.setVisemeTimeline(resp.visemes || []);
    }
  } catch (err: any) {
    ctx.setChatLog(c => [...c, { who: 'ai', text: `抱歉,服务不可用:${err?.message || String(err)}` }]);
    ctx.setIsAIGenerated(false);
  } finally {
    ctx.setChatBusy(false);
  }
}
