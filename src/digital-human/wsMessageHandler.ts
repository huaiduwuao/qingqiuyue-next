/**
 * 数字人 WS 下行消息按类型处理(从 useChatAvatarWS.ts 的 connectWS 拆出,行为不变)。
 */
import type React from 'react';
import type { ChatLogItem } from './useChatAvatar';
import type { WSServerMsg } from './wsConnection';
import { applyFinalText, applyStreamToken, emotionToVRM } from './chatLogOps';

export interface WSMessageDeps {
  fullTextRef: React.MutableRefObject<string>;
  nextAudioTimeRef: React.MutableRefObject<number>;
  conversationIdRef: React.MutableRefObject<string | null>;
  onToolCallsRef: React.MutableRefObject<((calls: Array<{ name: string; args: Record<string, any> }>) => void) | undefined>;
  playAudioChunk: (audioB64: string) => void | Promise<void>;
  setChatLog: React.Dispatch<React.SetStateAction<ChatLogItem[]>>;
  setChatBusy: (v: boolean) => void;
  setViseme: (v: Record<string, number>) => void;
  setEmotion: (v: Record<string, number>) => void;
  setAction: (v: string) => void;
  setIsAvatarPlaying: (v: boolean) => void;
  setConversationId: (v: string) => void;
}

function handleTextToken(msg: WSServerMsg, d: WSMessageDeps) {
  if (msg.token) {
    d.fullTextRef.current += msg.token;
    // 更新最后一条 AI 消息(打字机效果)
    d.setChatLog((prev) => applyStreamToken(prev, d.fullTextRef.current, msg.token!));
  }
}

function handleAudioChunk(msg: WSServerMsg, d: WSMessageDeps) {
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
    d.playAudioChunk(msg.audioB64);
    d.setIsAvatarPlaying(true);
  }
  if (msg.visemes && msg.visemes.length > 0) {
    const last = msg.visemes[msg.visemes.length - 1];
    // DEBUG: 实际被应用的 viseme
    console.log('[dh-debug] viseme-apply', { shape: last.shape, weight: last.weight });
    d.setViseme({ [last.shape]: last.weight });
  }
}

function handleVisemeFrames(msg: WSServerMsg, d: WSMessageDeps) {
  if (msg.visemes && msg.visemes.length > 0) {
    const last = msg.visemes[msg.visemes.length - 1];
    d.setViseme({ [last.shape]: last.weight });
  }
}

function handleDone(msg: WSServerMsg, d: WSMessageDeps) {
  if (msg.textDone) {
    d.setChatBusy(false);
    if (msg.fullText) {
      d.fullTextRef.current = msg.fullText;
      d.setChatLog((prev) => applyFinalText(prev, msg.fullText!));
    }
    if (msg.emotion) d.setEmotion(emotionToVRM(msg.emotion));
    if (msg.action) d.setAction(msg.action);
    // Hermes/数字人 tool_calls 透传:把后端下发的工具调用抛给父组件,
    // 由父组件用 dispatchToolCalls 串到 BlenderAvatar / VrmStage。
    if (msg.toolCalls && msg.toolCalls.length > 0 && d.onToolCallsRef.current) {
      try {
        d.onToolCallsRef.current(
          msg.toolCalls.map((tc) => ({ name: tc.name, args: tc.args || {} })),
        );
      } catch (e) {
        console.warn('[useChatAvatarWS] onToolCalls threw:', e);
      }
    }
    // 002:服务端回传 conversationId → 持久化 + 更新 state
    if (msg.conversationId && msg.conversationId !== d.conversationIdRef.current) {
      try { localStorage.setItem('dhConversationId', msg.conversationId); } catch {}
      d.setConversationId(msg.conversationId);
    }
  }
  if (msg.audioDone) {
    d.setViseme({});
    d.setIsAvatarPlaying(false);
    d.nextAudioTimeRef.current = 0;
  }
}

function handleAsrResult(msg: WSServerMsg) {
  // 由 voice agent 通过自定义事件使用
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('ws-asr-result', {
        detail: { text: msg.asrText, isFinal: msg.asrIsFinal },
      }),
    );
  }
}

/** 建一个 WS onMessage:按 msg.type 分派到上面各个 handler */
export function createWSMessageHandler(d: WSMessageDeps): (msg: WSServerMsg) => void {
  return (msg: WSServerMsg) => {
    switch (msg.type) {
      case 'text_token':
        handleTextToken(msg, d);
        break;

      case 'audio_chunk':
        handleAudioChunk(msg, d);
        break;

      case 'viseme_frames':
        handleVisemeFrames(msg, d);
        break;

      case 'done':
        handleDone(msg, d);
        break;

      case 'error':
        console.warn('[useChatAvatarWS] server error:', msg.error);
        break;

      case 'frame':
        if (msg.blendshapes) {
          d.setViseme(msg.blendshapes);
        }
        break;

      case 'pong':
        break;

      case 'asr_result':
        handleAsrResult(msg);
        break;
    }
  };
}
