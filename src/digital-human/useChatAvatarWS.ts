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
import { appendMessage, isServerConversationId, listMessages } from './conversationApi';
import type {
  ChatAvatarState,
  ChatLogItem,
} from './useChatAvatar';
import { buildRealtimeChatBody, readRealtimeChatReply, type ChatResp } from './useChatAvatar';
import type { ScenePanel } from './scene-ui/types';
import type { ContentRef } from './scene-ui/content';
import { API_PREFIX } from '@/lib/api/prefix';
import { authHeaders } from '@/lib/api/auth';
import { cutSpeakable, filterTTSContent, parseAvatarDirectives, stripAvatarDirectives } from './avatarDirectives';
import { aguiHistory, chatLogFromServerMessages, chatLogToHistory, emotionToVRM, insertThought, pcm16B64ToFloat32, upsertTurnText } from './chatLogOps';
import { clearTTSQueue, enqueueTTS, setTTSIdleListener } from './ttsQueue';
import { createWSConnection, disconnect, sendRaw, type WSClientMsg, type WSConnection, type WSServerMsg } from './wsConnection';
import { createWSMessageHandler } from './wsMessageHandler';
import { TOOL_RUNNING_HINT, handleAguiCustom, handleAguiToolCall, handleAguiToolResult, type AguiToolContext, type ScreenCommand } from './aguiToolCalls';

// 拆出去的模块原来都从这里导出,保留导出口
export { cutSpeakable, stripAvatarDirectives } from './avatarDirectives';
export { upsertTurnText, insertThought } from './chatLogOps';
export { clearTTSQueue } from './ttsQueue';
export type { ScreenCommand } from './aguiToolCalls';

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
  /** 3D 场景动作协议:每轮随请求上报的场景状态(scene-state.ts),后端塞进 system prompt */
  getSceneState?: () => unknown;
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
  /** 一轮话全部念完(队列清空)时调:入口组件据此让表情回到自然状态 */
  onSpeechEnd?: () => void;
  /** 搜索结果的结构化数据(AG-UI CUSTOM content_results)。不传则只在对话里出卡片 */
  onContentResults?: (items: ContentRef[]) => void;
  /**
   * 数字人操作场景里的显示器(screen_open / screen_close)。
   * 不传 = 这个入口没有场景屏幕(浮窗),指令被忽略。
   */
  onScreen?: (cmd: ScreenCommand) => void;
  /**
   * 言出法随:world_place 在结果回来后交付(要服务端挑好的素材),world_edit / scene_go 在调用时交付。
   * result 是 world_place 的 JSON 结果(见 agentmanager engine/tools_world.go)。
   */
  onWorldTool?: (e: { name: 'world_place' | 'world_edit' | 'scene_go' | 'room_design'; args: Record<string, any>; result?: any }) => void;
  /**
   * AG-UI 模式:当前还没有服务端会话时,发送前调用它建一个并返回 id(失败返回 null);
   * firstText 是这条消息,可直接用作会话标题。
   * 没有它,第一条消息的 session_id 为空,后端不落库、会话列表里也看不到这段对话。
   */
  ensureConversation?: (firstText: string) => Promise<string | null>;
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
  // 形象指令是延后执行的(等那句话出声),执行时要用最新的 options ——
  // 发消息那一刻的闭包里 stageHandle 可能还没就绪。
  const optionsRef = React.useRef(options);
  // 言出法随:world_place 的结果回来时要知道参数,按工具调用 id 记一下
  const worldCallsRef = React.useRef(new Map<string, { name: string; args: Record<string, any> }>());
  optionsRef.current = options;
  React.useEffect(() => setTTSIdleListener(() => optionsRef.current.onSpeechEnd?.()), []);
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

  // AG-UI 发送前确保有服务端会话:没有就建一个,只换 id、不清当前对话记录
  const ensureConversationRef = React.useRef(options.ensureConversation);
  ensureConversationRef.current = options.ensureConversation;
  const ensureServerConversation = React.useCallback(async (firstText: string) => {
    if (isServerConversationId(conversationIdRef.current)) return;
    const cid = await ensureConversationRef.current?.(firstText).catch(() => null);
    if (!isServerConversationId(cid)) return;
    conversationIdRef.current = cid;
    try { localStorage.setItem('dhConversationId', cid); } catch {}
    setConversationId(cid);
  }, []);

  // 加载指定会话的历史消息(从会话列表同源接口拉取),填充 chatLog
  const isLoadingMessagesRef = React.useRef(false);

  const loadConversationMessages = React.useCallback(async (cid: string) => {
    isLoadingMessagesRef.current = true;
    try {
      if (!isServerConversationId(cid)) return
      const j = await listMessages(cid).catch(() => null)
      const msgs = j?.messages ?? []
      setChatLog(chatLogFromServerMessages(msgs))
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
    // AG-UI 模式由后端 recorder 记录整轮对话,前端再写一遍就是重复消息
    if (useAgui || !isServerConversationId(cid)) {
      prevChatLogLenRef.current = currentLen;
      return;
    }
    // 取本轮新增的消息(最后一条)
    const added = chatLog[currentLen - 1];
    if (added && added.who === 'ai') {
      appendMessage(cid, 'assistant', added.text).catch(() => {});
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

  // 卸载时关掉 AudioContext:浏览器对同时存在的 AudioContext 有上限,反复进出页面会越积越多
  React.useEffect(() => () => {
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    nextAudioTimeRef.current = 0;
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
  }, []);

  // 播放 base64 PCM16 音频 chunk
  const playAudioChunk = React.useCallback(
    async (audioB64: string) => {
      const ctx = getAudioCtx();
      if (!ctx) return;

      try {
        // 解码 base64 → ArrayBuffer → AudioBuffer (后端保证 16kHz mono PCM16)
        const float32 = pcm16B64ToFloat32(audioB64);

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


  // 连接 WebSocket
  const connectWS = React.useCallback(() => {
    // dev 模式: NEXT_PUBLIC_WS_BASE 直连后端(Next.js rewrites 不支持 WS 升级)
    // 生产环境: 相对路径, 经 nginx/APISIX 代理(enable_websocket: true)
    const base = process.env.NEXT_PUBLIC_WS_BASE || '';
    // 数字人 WS:realtime-api 注册在 /api/realtime/ws(avatarapp.go)。前端走 /ws/realtime:
    // nginx 只有 ^~ /ws/ 这一段带 Upgrade 头(^~ /api/ 不升级),APISIX 再改写到 /api/realtime/ws。
    const wsPath = '/ws/realtime';
    const wsUrl = base
      ? `${base}${wsPath}?agentId=${encodeURIComponent(agentRef.current)}`
      : `${wsPath}?agentId=${encodeURIComponent(agentRef.current)}`;

    const conn = createWSConnection(
      wsUrl,
      agentRef.current,
      // onMessage:按消息类型分派(见 wsMessageHandler)
      createWSMessageHandler({
        fullTextRef,
        nextAudioTimeRef,
        conversationIdRef,
        onToolCallsRef,
        playAudioChunk,
        setChatLog,
        setChatBusy,
        setViseme,
        setEmotion,
        setAction,
        setIsAvatarPlaying,
        setConversationId,
      }),
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
  }, [playAudioChunk]);

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

  // aguiChatOnce 定义在下面,send / sendText 经 ref 调最新的那个
  // (直接放进 useCallback 依赖会在声明前被读到;不放又会拿到旧闭包里的 options / chatLog)
  const aguiChatOnceRef = React.useRef<(userText: string) => Promise<void>>(async () => {});

  /** AG-UI 一轮:本地意图拦截 → 确保服务端会话 → 发 AG-UI。
   *  任何一步抛错都要把 chatBusy 放回去,否则输入框一直是禁用的。 */
  const sendAgui = React.useCallback(async (t: string) => {
    try {
      // 发送前拦截(本地意图路由):返回 true 表示已处理,不再发 AG-UI
      const preSendText = optionsRef.current.preSendText;
      if (preSendText && (await preSendText(t))) {
        setChatBusy(false);
        return;
      }
      await ensureServerConversation(t);
      // aguiChatOnce 自己在 onDone / onError / catch 里收尾 chatBusy
      await aguiChatOnceRef.current(t);
    } catch (e) {
      setChatLog((c) => [...c, { who: 'ai', text: `❌ ${e instanceof Error ? e.message : '发送失败'}` }]);
      setChatBusy(false);
    }
  }, [ensureServerConversation]);

  // HTTP 降级通道的回复落到 state:后端只回 {text, toolCalls},工具调用同 WS 的 done 帧一样抛给父组件
  const applyHttpReply = React.useCallback((resp: ChatResp) => {
    setChatLog((c) => [...c, { who: 'ai', text: resp.text }]);
    if (resp.emotion) setEmotion(resp.emotion);
    if (resp.action) setAction(resp.action);
    if (resp.isAIGenerated !== undefined) setIsAIGenerated(resp.isAIGenerated);
    if (resp.toolCalls && resp.toolCalls.length > 0 && onToolCallsRef.current) {
      try {
        onToolCallsRef.current(resp.toolCalls.map((tc) => ({ name: tc.name, args: tc.args || {} })));
      } catch (e) {
        console.warn('[useChatAvatarWS] onToolCalls threw:', e);
      }
    }
    if (resp.audioUrl && audioRef.current) {
      audioRef.current.src = resp.audioUrl;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  /** send / sendText 共用:AG-UI → WS → HTTP 降级 */
  const deliver = React.useCallback(
    async (t: string) => {
      // G1: AG-UI 模式(数字员工),替代 Hermes WS
      if (useAgui) {
        await sendAgui(t);
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
          history: chatLogToHistory(chatLog),
        });
      } else {
        // HTTP 降级
        try {
          const r = await fetch(API_PREFIX + '/api/realtime/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            // 对齐后端 avatarapp.ChatReq:{message, history};agentId/conversationId 只有 WS 通道收
            body: buildRealtimeChatBody(t, chatLogToHistory(chatLog)),
          });
          const resp = await readRealtimeChatReply(r);
          applyHttpReply(resp);
        } catch {
          setChatLog((c) => [...c, { who: 'ai', text: '抱歉, 服务暂时不可用。' }]);
          setIsAIGenerated(false);
        } finally {
          setChatBusy(false);
        }
      }
    },
    [chatLog, useAgui, sendAgui, applyHttpReply],
  );

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
    // AG-UI 模式由后端 recorder 记录,这里只管 WS 模式
    const cid = conversationIdRef.current;
    if (!useAgui && isServerConversationId(cid)) {
      appendMessage(cid, 'user', t).catch(() => {}); // fire-and-forget
    }

    await deliver(t);
  }, [text, chatBusy, useAgui, deliver]);

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

      await deliver(t);
    },
    [chatBusy, deliver],
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
    [],
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
        // 原始文本(带形象指令)已经切到哪了:边流边按句读,不用等整段生成完。
        // 每个标签只会落进一句里,天然只派发一次。
        let rawUpto = 0;
        // H4 从当前对话日志构造历史上下文(用户/助手交替),让 agent 延续上下文
        const history = aguiHistory(chatLog);
        // 工具调用 / 结果 / 自定义事件的处理(见 aguiToolCalls)
        const toolCtx: AguiToolContext = { setChatLog, options, optionsRef, worldCalls: worldCallsRef.current };

        // 流式朗读:文本攒够一个完整句子就送去 TTS,首次出声不用等整段写完。
        // 这句里写的表情/动作挂在这句的 onStart 上:声音响起的那一刻才执行(见 Utterance)。
        const speakReady = (final: boolean) => {
          if (ac.signal.aborted) return;
          const { chunk, next } = cutSpeakable(fullTextRef.current, rawUpto, final);
          if (!chunk) return;
          rawUpto = next;
          enqueueTTS({
            text: filterTTSContent(stripAvatarDirectives(chunk)),
            audioRef,
            signal: ac.signal,
            onStart: () => parseAvatarDirectives(chunk, optionsRef.current),
          });
        };

        await agentmAPI.aguiChat(
          {
            agent: aguiAgent || 'worker',
            prompt: userText,
            session_id: conversationIdRef.current || undefined,
            user_id: userIdRef.current || undefined, // 仅已登录用户记录对话
            // G2: 数字人模式,后端注入形象指令模板,回答内嵌 <emotion:x/>/<action:y/>
            avatar_mode: true,
            // 场景动作协议:让模型知道锚点/动作/机位,以及自己现在在哪
            scene_state: options.getSceneState?.(),
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
              // 清洗掉形象指令,只显示纯文本(指令本身跟着语音走,见 speakReady)
              const cleanText = stripAvatarDirectives(fullTextRef.current);
              // 打字机效果
              setChatLog((c) => upsertTurnText(c, cleanText));
              // 攒够一整句就先读出来
              speakReady(false);
            },
            onToolStart: (name) => {
              // 业务工具开始执行时给个可见反馈,免得用户以为卡住了
              const hint = TOOL_RUNNING_HINT[name];
              if (hint) setThinkingLog(hint);
            },
            onToolCall: (name, toolCallId, argsJSON) => handleAguiToolCall(name, toolCallId, argsJSON, toolCtx),
            onToolResult: (toolCallId, content) => handleAguiToolResult(toolCallId, content, toolCtx),
            onToolEnd: () => {
              setThinkingLog('');
            },
            onCustom: (name, value) => handleAguiCustom(name, value, userText, toolCtx),
            onDone: () => {
              setChatBusy(false);
              // 收尾:把最后一段还没闭合成句的文本读掉
              speakReady(true);
              // 这轮的思考过程从浮动面板挪进记录,用户回看时知道它为什么这么做
              const thought = thinkingTextRef.current.replace(/<think>|<\/think>/g, '').trim();
              if (thought) setChatLog((c) => insertThought(c, thought));
              setThinkingLog('');
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
  aguiChatOnceRef.current = aguiChatOnce;

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
