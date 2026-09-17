'use client';

/**
 * FloatingDigitalHuman —— 全站右下角二次元浮窗
 *
 * 统一 VRM 渲染(从 /avatars/character.vrm)+ 共享 useChatAvatarWS hook
 * 跟 ImmersiveDigitalHuman 是同一套 chat + TTS + viseme 流程。
 */

import React from 'react';
import { Box, IconButton, TextField, Typography, CircularProgress, Collapse } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import NearMeRoundedIcon from '@mui/icons-material/NearMeRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { AssistantIntroHint, HideAssistantButton } from './AssistantChoice';
import { setAIPrefs, useAIPrefs } from '@/lib/aiPrefs';
import { alpha } from '@mui/material/styles';
import { useRouter, usePathname } from 'next/navigation';
import BlenderAvatar from './BlenderAvatar';
import { useChatAvatarWS } from './useChatAvatarWS';
import { dispatchToolCalls, type ToolCall as DhToolCall } from './tools/dispatcher';
import { parseIframeUI, iframeToolToTarget, type IframeOpenTarget } from './virtual-browser';
import { VirtualBrowser } from './VirtualBrowser';
import { ScenePanel } from './scene-ui/ScenePanel';
import { ToolCallCard, ThoughtBubble } from './scene-ui/ChatOpsEntry';
import type { ScenePanel as ScenePanelModel } from './scene-ui/types';
import { listModels } from './api/digitalHumanConfig';
import { clearAvatarCache } from './vrm/loadAvatar';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { VoiceIndicator, type VoiceIndicatorState } from '@/components/VoiceIndicator';
import { MicTestButton } from '@/components/MicTestButton';
import { AgentSelector } from '@/lib/agentmanager/AgentSelector';
import { useApp } from '@/contexts/AppContext';
import { useThemeMode } from '@/contexts/ThemeContext';
import { routeIntent } from '@/lib/intent/router';
import { executeIntent } from '@/lib/intent/executor';
import { logout } from '@/apis/user';
import type { VoiceLogEntry } from '@/lib/voice/logger';
import type { HermesAgentItem } from '@/beans/system';
import { getSafeAreaInsets } from '@/lib/safeArea';

const FIG_W = 320;
const FIG_H = 480;
// 收起态气泡直径 / 展开窗与屏幕边缘的最小间距
const BUBBLE = 48;
const EDGE = 12;

/**
 * 底部被占掉的高度:移动端底部导航(含 Home 指示条安全区)或纯安全区。
 * 之前气泡默认落在 innerHeight - 64,正好压在底部导航「我的」上面,把按钮挡死。
 */
function bottomReserved(): number {
  if (typeof document === 'undefined') return 0;
  const nav = document.querySelector('[data-mobile-bottom-nav]');
  if (nav) return nav.getBoundingClientRect().height;
  return getSafeAreaInsets().bottom;
}

/** 展开窗口的实际尺寸:窄屏按可用空间缩小,不再固定 320x480 撑出屏幕。 */
function figSize(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: FIG_W, h: FIG_H };
  const ins = getSafeAreaInsets();
  return {
    w: Math.max(240, Math.min(FIG_W, window.innerWidth - ins.left - ins.right - EDGE * 2)),
    h: Math.max(320, Math.min(FIG_H, window.innerHeight - ins.top - bottomReserved() - EDGE * 2)),
  };
}

/** 把坐标夹在可视区内:避开顶部安全区、底部导航,展开态再留 EDGE 边距。 */
function clampPos(p: { left: number; top: number }, open: boolean): { left: number; top: number } {
  if (typeof window === 'undefined') return p;
  const ins = getSafeAreaInsets();
  const { w, h } = open ? figSize() : { w: BUBBLE, h: BUBBLE };
  const pad = open ? EDGE : 0;
  const minLeft = ins.left + pad;
  const minTop = ins.top + pad;
  const maxLeft = Math.max(minLeft, window.innerWidth - ins.right - w - pad);
  const maxTop = Math.max(minTop, window.innerHeight - bottomReserved() - h - pad);
  return {
    left: Math.round(Math.max(minLeft, Math.min(maxLeft, p.left))),
    top: Math.round(Math.max(minTop, Math.min(maxTop, p.top))),
  };
}

/**
 * 默认落点:右下角,底部导航之上再让开一截 —— 推荐视频流的播放器控制条(全屏键)
 * 和各页的底部操作按钮都贴着底边,气泡直接压上去就把它们挡住了。用户仍可拖动。
 */
function defaultBubblePos(): { left: number; top: number } {
  if (typeof window === 'undefined') return { left: 0, top: 0 };
  const ins = getSafeAreaInsets();
  const lift = bottomReserved() > 0 ? 88 : 24;
  return clampPos(
    { left: window.innerWidth - ins.right - BUBBLE - 12, top: window.innerHeight - bottomReserved() - BUBBLE - lift },
    false,
  );
}

const HIDE_ON = ['/user/login', '/digital-human'];  // /digital-human 是沉浸式大窗口, 不显示浮窗

interface QingqiuyueWindow extends Window {
  __qingqiuyueWalkTo?: (target: { left: number; top: number }, durationMs?: number) => void;
  __qingqiuyueSetSummonMode?: React.Dispatch<React.SetStateAction<boolean>>;
}

interface DraggableElement extends HTMLElement {
  __dragged?: boolean;
}

interface AgentPayload {
  agentId: string;
  name: string;
  description?: string;
}

export default function FloatingDigitalHuman() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const hidden = HIDE_ON.some((p) => pathname.startsWith(p));
  // 是否显示由 providers 按 aiPrefs.assistant 决定;这里只管第一次见面的介绍卡
  const [aiPrefs] = useAIPrefs();

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0, clickX: 0, clickY: 0 });
  // 位置: 用 left/top + transform: translate() 做 GPU 加速动画
  // 数字人"在页面上走": 走的过程 transform 平滑过渡
  const [pos, setPos] = React.useState<{ left: number; top: number }>(defaultBubblePos);
  // 展开窗尺寸(随窗口/横竖屏变化)
  const [fig, setFig] = React.useState<{ w: number; h: number }>(() => figSize());
  // 用 ref 存储位置，避免 onDown 依赖 pos 导致每次拖动后重新创建
  const posRef = React.useRef(pos);
  React.useEffect(() => { posRef.current = pos; }, [pos]);
  // 默认收起(只显示小图标)— 之前默认展开常驻占屏,新版默认折叠
  // 用户主动点图标才展开大窗口。折叠状态大小见下方 IconButton。
  const [open, setOpen] = React.useState(false);
  const openRef = React.useRef(open);
  openRef.current = open;
  // 防御性 mount 兜底:HMR / 浏览器 state cache 可能让老 mount 实例仍
  // 持有 `open=true` — 强制一次关闭,避免「点哪里都不对 + 黑色遮挡」(老的
  // 320x480 浮窗画布覆盖在 publish 页面上,看起来是一块黑板)。
  React.useEffect(() => {
    setOpen(false);
  }, []);
  // 展开/收起时把位置夹回可视范围(收起是 48x48 气泡,展开按 figSize 计算)
  React.useEffect(() => {
    setFig(figSize());
    setPos((prev) => clampPos(prev, open));
  }, [open]);

  // 窗口尺寸 / 横竖屏 / 底部导航出现或消失(它会往 :root 写 --bottom-nav-inset)→ 重新夹回。
  // 底部导航要等 useResponsive 挂载后才渲染,所以再补一次延时重算。
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const reclamp = () => {
      setFig(figSize());
      setPos((prev) => clampPos(prev, openRef.current));
    };
    // 底部导航挂载后气泡要从桌面端默认位(贴底)抬到导航之上:重算默认落点而不只是夹回
    const t = window.setTimeout(() => {
      setFig(figSize());
      setPos((prev) => (openRef.current ? clampPos(prev, true) : defaultBubblePos()));
    }, 600);
    window.addEventListener('resize', reclamp);
    window.addEventListener('orientationchange', reclamp);
    const mo = new MutationObserver(reclamp);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', reclamp);
      window.removeEventListener('orientationchange', reclamp);
      mo.disconnect();
    };
  }, []);
  const [autoRotate, setAutoRotate] = React.useState(false);  // 默认不自动转圈, 数字人有自己的 idle 动画

  const app = useApp();
  const { setTheme } = useThemeMode();
  const { activeAgentId, agentStack, setActiveAgent, popAgent, currentUser } = app;
  const [availableAgents, setAvailableAgents] = React.useState<HermesAgentItem[]>([]);
  // 换装:当前 VRM 模型 URL(默认 character)。avatar.swapModel 工具切到其他模型
  const [modelUrl, setModelUrl] = React.useState('/avatars/character.vrm');
  // 意图拦截 ref:preSendText 从 hook 内部调用,用 ref 避免 hook 定义顺序循环依赖
  const intentHandlerRef = React.useRef<((text: string) => Promise<boolean>) | null>(null);

  React.useEffect(() => {
    // StrictMode/依赖变化都可能重跑,加 cancelled + AbortController 避免 stale state 与未取消请求。
    const controller = new AbortController();
    let cancelled = false;
    fetch('/api/agentmanager/multi-agent/staff', { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        // 数字员工列表:agentId=角色名(frontend/backend/ops/qa/worker),name=显示名,description=描述
        const agents = (data.agents || []).map((a: any) => ({
          agentId: a.agentId,
          name: a.name,
          role: a.description || a.agentId,
        })) as HermesAgentItem[];
        setAvailableAgents(agents);
        if (!activeAgentId && agents.length > 0) {
          setActiveAgent(agents[0].agentId);
        }
      })
      .catch((e) => {
        if (cancelled || e?.name === 'AbortError') return;
        console.error('[FloatingDigitalHuman] 加载 agents 失败:', e);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeAgentId, setActiveAgent]);

  const chat = useChatAvatarWS(activeAgentId || 'digital_human', {
    // G1: 数字人走 agentmanager 的数字员工(AG-UI),形象/语音/动作仍由 dispatcher 驱动
    useAgui: true,
    aguiAgent: activeAgentId || 'worker',
    // A4: 对话记录（仅已登录用户）
    userId: currentUser?.id,
    // 意图拦截:文字输入也走本地意图路由(走/换/切/去/打开 等),纯聊天放行 AG-UI
    preSendText: async (text) => {
      if (intentHandlerRef.current) return intentHandlerRef.current(text);
      return false; // handler 未就绪时放行 AG-UI
    },
    // I1: 数字人要看网页/视频 → 统一显示器 (浮窗内弹窗)
    onUI: (ui: any) => {
      const target = parseIframeUI(ui);
      if (target) setIframeTarget(target);
    },
    // 生成式 UI:浮窗没有 3D 舞台,用普通弹层承接同一份面板
    onScenePanel: (panel) => setScenePanel(panel),
    onToolCalls: (calls) => {
      // I1.2: 工具兜底(openUrl/video.*) → 统一显示器
      for (const c of calls as unknown as DhToolCall[]) {
        const target = iframeToolToTarget(c);
        if (target) setIframeTarget(target);
      }
      // Hermes/数字人下发的工具调用 — 用 dispatcher 映射到 BlenderAvatar 的
      // emotion/action/viseme/jawOpen。BlenderAvatar 没有 sinks handle,这里
      // 用本地 wrapper 把工具调用串到现有 setEmotion/setAction state。
      const result = dispatchToolCalls(
        calls as unknown as DhToolCall[],
        {
          setEmotion: (bs) => chat.setEmotion?.(Object.keys(bs)[0] || 'neutral'),
          setAction: (name) => chat.setAction?.(name),
          setViseme: () => {},
          setVisemeTimeline: (frames) => {
            // BlenderAvatar 不支持 viseme timeline，保留空实现
            // 如果未来切换到 VrmStage，这里可以改为: h?.setVisemeTimeline?.(frames)
          },
          setJawOpen: () => {},
          speak: () => {},
          // 移动:复用 __qingqiuyueWalkTo CSS 定位(与语音 walk_to 同机制)
          move: (target, opts) => {
            const w = (typeof window !== 'undefined' ? window : null) as QingqiuyueWindow | null;
            if (!w || !w.__qingqiuyueWalkTo) return;
            let left: number, top: number;
            const baseTop = Math.max(0, w.innerHeight - 560);
            if (typeof target === 'string') {
              if (target === 'left') { left = 8; top = baseTop; }
              else if (target === 'right') { left = Math.max(0, w.innerWidth - 328); top = baseTop; }
              else if (target === 'center') { left = Math.max(0, (w.innerWidth - 320) / 2); top = baseTop; }
              else { left = 8; top = baseTop; }
            } else {
              // {x,y,z}:x 横向,y 竖向,z 深度(粗略映射到屏幕偏移)
              left = Math.max(0, Math.min(w.innerWidth - 320, 8 + (target.x || 0) * 1));
              top = Math.max(0, baseTop - (target.y || 0) * 10 - (target.z || 0) * 0);
            }
            w.__qingqiuyueWalkTo({ left, top }, opts?.durationMs || 1500);
          },
          camera: () => {},
          // 换装:查模型列表 → 清缓存 → 切 modelUrl(触发 BlenderAvatar 重载)
          setModel: (modelId) => {
            listModels().then((models) => {
              const list = models || [];
              const m = list.find(x => x.id === modelId) || list.find(x => x.url === modelId);
              if (m) {
                clearAvatarCache(m.url);
                setModelUrl(m.url);
                chat.setText(`已为你换装成「${m.name}」。`);
              } else {
                const options = list.map(x => x.name).join('、');
                chat.setText(options ? `暂时没有「${modelId}」这个模型。可选：${options}` : `暂时没有可换的服装模型。`);
              }
            });
            return true;
          },
        },
      );
      console.log('[FloatingDigitalHuman] dispatched tool_calls:', result);
    },
  });
  const { chatBusy, chatLog, emotion, viseme, action, audioRef } = chat;

  // 语音唤醒词: 文本匹配模式 (ASR 后看文本里是否含 "小月")
  const wakePhrases = React.useMemo(() => ['小月', '清秋月', '清秋'], [])
  // 语音 agent: 一直跑 (点 mic 启动, 启动后无需再点)
  const [voiceEnabled, setVoiceEnabled] = React.useState(false)
  const [voiceLogs, setVoiceLogs] = React.useState<VoiceLogEntry[]>([])
  const [showVoiceLogs, setShowVoiceLogs] = React.useState(false)

  // 002:会话历史面板(浮窗不显示会话列表,仅保留"新对话"按钮)
  const handleNewConversation = React.useCallback(() => {
    chat.newConversation?.();
  }, [chat]);

  React.useEffect(() => {
    const onLog = (e: Event) => {
      const entry = (e as CustomEvent<VoiceLogEntry>).detail
      if (!entry) return
      setVoiceLogs((prev) => [...prev.slice(-99), entry])
    }
    window.addEventListener('voice-log', onLog)
    return () => window.removeEventListener('voice-log', onLog)
  }, [])

  const voice = useVoiceAgent({
    wakePhrases,
    asrGatewayUrl: typeof window !== 'undefined' ? `${window.location.origin}/api/audio` : '/api/audio',
    onCommand: async (text) => {
      // 数字人正在说? 打断
      if (chat.isSpeaking()) chat.cancel()

      // 意图路由: 走服务端 API (服务端有 OPENAI_API_KEY 可调 LLM)
      const conversationId = app.activeConversationId || 'default'
      let intentResult: Awaited<ReturnType<typeof routeIntent>>
      try {
        const r = await fetch('/api/intent/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            availableAgents: availableAgents.map((a) => ({
              id: a.agentId,
              displayName: a.name,
              description: a.role || '',
              tools: [],
            })),
          }),
        })
        if (r.ok) {
          intentResult = await r.json()
        } else {
          intentResult = await routeIntent(text, {
            availableAgents: availableAgents.map((a) => ({
              id: a.agentId,
              displayName: a.name,
              description: a.role || '',
              tools: [],
            })),
          })
        }
      } catch {
        intentResult = await routeIntent(text, {
          availableAgents: availableAgents.map((a) => ({
            id: a.agentId,
            displayName: a.name,
            description: a.role || '',
            tools: [],
          })),
        })
      }
      const { intent, replyText, emotion: emo, action: act } = intentResult

      // LLM 驱动的表情 + 动作: 让数字人有灵性, 不是傻站着
      if (emo) chat.setEmotion(emo)
      if (act) chat.setAction(act)

      if (intent.type === 'switch') {
        setActiveAgent(intent.agentId)
        chat.setText(replyText || `已切换到 ${availableAgents.find((a) => a.agentId === intent.agentId)?.name || intent.agentId}`)
        return
      }
      if (intent.type === 'return') {
        const prev = popAgent()
        if (prev) {
          chat.setText(replyText || `已返回 ${availableAgents.find((a) => a.agentId === app.activeAgentId)?.name || app.activeAgentId}`)
        }
        return
      }
      if (intent.type === 'delegate' || intent.type === 'navigate' || intent.type === 'open_external' || intent.type === 'walk_to' || intent.type === 'system' || intent.type === 'cron' || intent.type === 'query') {
        const res = await executeIntent(intent, { conversationId })
        chat.setText(replyText || res.message)
        return
      }

      // 普通聊天: 走 WS 流式通道 (text_token + audio_chunk + viseme)
      // router 只做意图分类, chat 不依赖它的 replyText
      chat.sendText(text)
    },
    isAvatarSpeaking: () => chat.isSpeaking(),
    onInterrupt: () => chat.cancel(),
  })

  // 意图拦截实现(文字输入):非聊天意图本地处理,聊天放行 AG-UI
  React.useEffect(() => {
    intentHandlerRef.current = async (text: string): Promise<boolean> => {
      // 仅含动作关键词才走 LLM 意图路由(避免每次打字都调 LLM 慢+耗 token)
      const ACTION_KEYWORDS = ['走', '换', '切', '去', '打开', '返回', '点一下', '去往']
      if (!ACTION_KEYWORDS.some((k) => text.includes(k))) return false
      const conversationId = app.activeConversationId || 'default'
      let intentResult: Awaited<ReturnType<typeof routeIntent>>
      try {
        const r = await fetch('/api/intent/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            availableAgents: availableAgents.map((a) => ({
              id: a.agentId,
              displayName: a.name,
              description: a.role || '',
              tools: [],
            })),
          }),
        })
        intentResult = r.ok
          ? await r.json()
          : await routeIntent(text, { availableAgents: availableAgents.map((a) => ({ id: a.agentId, displayName: a.name, description: a.role || '', tools: [] })) })
      } catch {
        intentResult = await routeIntent(text, { availableAgents: availableAgents.map((a) => ({ id: a.agentId, displayName: a.name, description: a.role || '', tools: [] })) })
      }
      const { intent, replyText } = intentResult
      if (intent.type === 'chat') return false // 纯聊天 → 放行 AG-UI
      // 非聊天意图 → 本地处理
      if (intent.type === 'switch') {
        setActiveAgent(intent.agentId)
        chat.setText(replyText || `已切换到 ${availableAgents.find((a) => a.agentId === intent.agentId)?.name || intent.agentId}`)
      } else if (intent.type === 'return') {
        const prev = popAgent()
        if (prev) chat.setText(replyText || `已返回 ${availableAgents.find((a) => a.agentId === app.activeAgentId)?.name || app.activeAgentId}`)
      } else if (intent.type === 'delegate' || intent.type === 'navigate' || intent.type === 'open_external' || intent.type === 'walk_to' || intent.type === 'system' || intent.type === 'cron' || intent.type === 'query') {
        const res = await executeIntent(intent, { conversationId })
        chat.setText(replyText || res.message)
      } else {
        return false // 未知类型放行
      }
      return true
    }
    return () => { intentHandlerRef.current = null }
  }, [availableAgents, activeAgentId, app.activeConversationId, popAgent, setActiveAgent, chat])

  // 注意:必须在所有 hook 之后才能 return null,否则 React Rules of Hooks 报错
  // "Rendered fewer hooks than expected"(pathname 切换时 hidden 翻转会导致
  // 下方的 useEffect 被跳过,hook 数量变化 → 崩)

  // I1: 统一显示器(取代旧 ExternalViewer 内联 iframe 模态)
  const [iframeTarget, setIframeTarget] = React.useState<IframeOpenTarget | null>(null)
  // 数字人下发的列表/网格/表单(ui_show_* 工具)
  const [scenePanel, setScenePanel] = React.useState<ScenePanelModel | null>(null)
  // 兼容旧事件 'digital-human-open-external'(executor 的 open_external 意图也走统一显示器)
  React.useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ url: string; label: string; mode: string }>).detail
      if (!detail) return
      // 复用统一显示器(解析器处理视频/嵌入判定), 不另起模态
      setIframeTarget(parseIframeUI({ type: 'iframe', url: detail.url, title: detail.label }))
    }
    window.addEventListener('digital-human-open-external', onOpen)
    return () => window.removeEventListener('digital-human-open-external', onOpen)
  }, [])

  // 走路时播 walk 动作, 走完回 idle
  React.useEffect(() => {
    const onWalk = () => {
      chat.setAction('walk')
      setTimeout(() => chat.setAction('idle'), 1800)
    }
    window.addEventListener('digital-human-walk', onWalk)
    return () => window.removeEventListener('digital-human-walk', onWalk)
  }, [chat])

  // system 意图: 音量/主题/全屏/刷新/登出等实际浏览器操作
  const preMuteVolumeRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    const applySystem = (e: Event) => {
      const detail = (e as CustomEvent<import('@/lib/intent/types').Intent>).detail
      if (!detail || detail.type !== 'system') return
      const { action, params } = detail
      const audio = chat.audioRef.current

      switch (action) {
        case 'volume-up': {
          if (audio) audio.volume = Math.min(1, (audio.volume || 0.5) + 0.1)
          break
        }
        case 'volume-down': {
          if (audio) audio.volume = Math.max(0, (audio.volume || 0.5) - 0.1)
          break
        }
        case 'volume-set': {
          const level = typeof params?.level === 'number' ? params.level : Number(params?.level)
          if (audio && !Number.isNaN(level)) audio.volume = Math.max(0, Math.min(1, level))
          break
        }
        case 'mute': {
          if (audio) {
            preMuteVolumeRef.current = audio.volume
            audio.volume = 0
          }
          break
        }
        case 'unmute': {
          if (audio) {
            const restored = preMuteVolumeRef.current ?? 0.5
            audio.volume = restored > 0 ? restored : 0.5
          }
          break
        }
        case 'theme-light':
          setTheme('light')
          break
        case 'theme-dark':
          setTheme('dark')
          break
        case 'fullscreen-on': {
          const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> }
          el.requestFullscreen?.().catch(() => {})
          break
        }
        case 'fullscreen-off': {
          const d = document as Document & { exitFullscreen?: () => Promise<void> }
          d.exitFullscreen?.().catch(() => {})
          break
        }
        case 'reload':
          window.location.reload()
          break
        case 'logout': {
          logout().catch(() => {}).finally(() => {
            router.push('/user/login')
          })
          break
        }
        default:
          break
      }
    }
    window.addEventListener('digital-human-system', applySystem)
    return () => window.removeEventListener('digital-human-system', applySystem)
  }, [chat, router, setTheme])

  // 拖动 offset (从当前 left/top 算)
  const onDown = React.useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-drag]')) return;
    dragRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      ox: posRef.current.left,
      oy: posRef.current.top,
      clickX: e.clientX,
      clickY: e.clientY,
    };
    setAutoRotate(false);
  }, []);

  // 统一用 window 事件处理拖动（避免 Canvas 拦截 pointermove/pointerup）
  React.useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d.active) return;
      setPos(clampPos({ left: d.ox + (e.clientX - d.sx), top: d.oy + (e.clientY - d.sy) }, open));
    };
    const handleUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d.active) return;
      dragRef.current.active = false;
      // 检查移动距离，大于5px认为是拖动，不触发点击
      const dx = e.clientX - d.clickX;
      const dy = e.clientY - d.clickY;
      const isDrag = Math.sqrt(dx * dx + dy * dy) >= 5;
      // 如果是拖动，给目标元素设置标志位，后续 click 事件检查此标志位
      if (isDrag && e.target) {
        const target = e.target as DraggableElement;
        target.__dragged = true;
        setTimeout(() => { target.__dragged = false; }, 50);
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [open]);

  // 数字人"走路": 平滑移动到目标坐标
  // duration 默认 1500ms(像正常步速走 200-400px)
  const walkTo = React.useCallback((target: { left: number; top: number }, durationMs = 1500) => {
    if (typeof window === 'undefined') return
    const clamped = clampPos(target, true)
    // 触发动画: 设 CSS transition 后修改位置
    if (wrapRef.current) {
      wrapRef.current.style.transition = `left ${durationMs}ms ease-in-out, top ${durationMs}ms ease-in-out`
    }
    setPos(clamped)
    // 清除 transition(动画完后)
    setTimeout(() => {
      if (wrapRef.current) wrapRef.current.style.transition = ''
    }, durationMs + 50)
  }, [])

  // 召唤模式: 用户点页面任何位置, 数字人走过去
  // 单独 useEffect 因为它跟 pet 互斥
  const [summonMode, setSummonModeRaw] = React.useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem('qingqiuyue-summon-mode') === 'true' } catch { return false }
  })
  const setSummonMode = React.useCallback((value: React.SetStateAction<boolean>) => {
    setSummonModeRaw((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      try { localStorage.setItem('qingqiuyue-summon-mode', String(next)) } catch {}
      return next
    })
  }, [])
  React.useEffect(() => {
    if (!summonMode) return
    const onClick = (e: MouseEvent) => {
      // 排除点击浮窗自身(避免点击浮窗就跳到自己位置)
      if (wrapRef.current?.contains(e.target as Node)) return
      // 数字人浮窗走到点击位置(浮窗左上角对齐点击位置 - 80px 偏移)
      const target = clampPos({ left: e.clientX - 80, top: e.clientY - 60 }, true)
      walkTo(target, 1500)
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [summonMode, walkTo])

  // 暴露 walkTo 到 window (executor 派事件时调)
  React.useEffect(() => {
    const w = window as QingqiuyueWindow
    w.__qingqiuyueWalkTo = walkTo
    w.__qingqiuyueSetSummonMode = setSummonMode
    return () => {
      delete w.__qingqiuyueWalkTo
      delete w.__qingqiuyueSetSummonMode
    }
  }, [walkTo, setSummonMode])

  // ⚠️ 所有 hooks 必须在 early return 前调用 (React Rules of Hooks)

  if (hidden) return null;

  if (!open) {
    return (
      <Box
        data-floating-digital-human
        sx={{
          position: 'fixed',
          left: pos.left,
          top: pos.top,
          zIndex: 1500,
          width: BUBBLE,
          height: BUBBLE,
          touchAction: 'none',
          // 轻微上下漂浮(React Bits 风格),减少动效偏好下静止
          animation: 'rb-float 3.2s ease-in-out infinite',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
        onPointerDown={onDown}
      >
        {/* 呼吸光环 */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid',
            borderColor: (t) => alpha(t.palette.primary.main, 0.55),
            animation: 'rb-pulse-ring 2.4s ease-out infinite',
            pointerEvents: 'none',
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        />
        <IconButton
          aria-label="展开数字人"
          onClick={(e) => {
            // 检查是否刚从拖动恢复，避免触发点击
            if ((e.target as DraggableElement).__dragged) return;
            if (!aiPrefs.introSeen) setAIPrefs({ introSeen: true });
            setOpen(true);
          }}
          sx={{
            width: BUBBLE,
            height: BUBBLE,
            borderRadius: '50%',
            background: (t) => `linear-gradient(135deg, ${t.palette.primary.main} 0%, #8B5CF6 100%)`,
            color: 'white',
            boxShadow: (t) => `0 8px 20px ${alpha(t.palette.primary.main, 0.45)}, inset 0 1px 0 rgba(255,255,255,0.35)`,
            border: '2px solid rgba(255,255,255,0.85)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': { transform: 'scale(1.06)' },
            '&:active': { transform: 'scale(0.96)' },
            cursor: 'grab',
          }}
        >
          <PersonRoundedIcon sx={{ fontSize: 24 }} />
        </IconButton>
        {!aiPrefs.introSeen && (
          <AssistantIntroHint
            side={typeof window !== 'undefined' && pos.left + BUBBLE / 2 > window.innerWidth / 2 ? 'left' : 'right'}
            onChat={() => setOpen(true)}
            onLearn={() => router.push('/digital-human?intro=1')}
          />
        )}
      </Box>
    );
  }

  return (
    <Box
      ref={wrapRef}
      sx={{
        position: 'fixed',
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        // transition 在 walkTo() 里动态设(平滑动画), 这里默认无
        width: fig.w,
        height: fig.h,
        maxWidth: 'calc(100vw - 16px)',
        borderRadius: 3,
        overflow: 'hidden',
        cursor: 'grab',
        touchAction: 'none',
        boxShadow: (t) => `0 8px 32px ${alpha(t.palette.common.black, 0.5)}`,
        border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.32)}`,
        background: '#05060B',
        zIndex: 1500,
        display: 'flex',
        flexDirection: 'column',
      }}
      onPointerDown={onDown}
      data-floating-digital-human
    >
      {/* 数字人本体 */}
      <Box sx={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        '& canvas': { width: '100% !important', height: '100% !important' },
      }}>
        <BlenderAvatar
          modelUrl={modelUrl}
          currentAction={action}
          emotion={emotion}
          viseme={viseme}
          autoRotate={autoRotate}
          sx={{ borderRadius: 0 }}
        />
      </Box>

      {/* 顶部按钮组 */}
      <Box data-no-drag sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        p: 0.75,
        display: 'flex',
        gap: 0.5,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
        zIndex: 2,
      }}>
        <IconButton
          size="small"
          aria-label="全屏"
          onClick={(e) => {
            e.stopPropagation();
            router.push('/digital-human?start=1');
          }}
          sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(0,0,0,0.4)' }}
        >
          <OpenInFullRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <IconButton
          size="small"
          aria-label="召唤模式(点击页面让数字人走过去)"
          title="召唤模式: 点击页面任何位置, 数字人走过去"
          onClick={(e) => { e.stopPropagation(); setSummonMode((s) => !s) }}
          sx={{
            color: summonMode ? '#25F4EE' : 'rgba(255,255,255,0.7)',
            bgcolor: summonMode ? 'rgba(37,244,238,0.25)' : 'rgba(0,0,0,0.3)',
            border: summonMode ? '1px dashed #25F4EE' : 'none',
          }}
        >
          <NearMeRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <IconButton
          size="small"
          aria-label="新对话"
          title="开始新对话(清空当前会话历史)"
          onClick={(e) => { e.stopPropagation(); handleNewConversation(); }}
          sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(0,0,0,0.4)' }}
        >
          <RefreshRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <MicTestButton />
        <IconButton
          size="small"
          aria-label="了解小助手"
          title="它能做什么、怎么用"
          onClick={(e) => { e.stopPropagation(); router.push('/digital-human?intro=1'); }}
          sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(0,0,0,0.4)' }}
        >
          <HelpOutlineRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <HideAssistantButton />
        <IconButton
          size="small"
          aria-label="关闭"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(0,0,0,0.4)' }}
        >
          <CloseRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      {/* 底部:聊天输入 + 记录 */}
      <Box data-no-drag sx={{
        p: 1,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
      }}>
        <AgentSelector
          activeAgentId={activeAgentId}
          agentStack={agentStack}
          availableAgents={availableAgents}
          onSwitch={(id) => {
            setActiveAgent(id);
            chat.setText('');
          }}
          onReturn={() => popAgent()}
          size="small"
        />

        {/* 聊天记录(最近 2 条) */}
        {chatLog.length > 0 && (
          <Box sx={{
            maxHeight: 80,
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 1,
            p: 0.75,
          }}>
            {chatLog.slice(-3).map((m, i) => (
              m.who === 'tool' && m.tool ? <ToolCallCard key={m.tool.id || i} entry={m.tool} compact />
              : m.who === 'thought' ? <ThoughtBubble key={`t-${i}`} text={m.text} compact />
              : (
              <Typography
                key={i}
                sx={{
                  fontSize: 10.5,
                  color: m.who === 'user' ? '#a0c4ff' : '#fff',
                  mb: 0.25,
                  wordBreak: 'break-word',
                }}
              >
                <strong>{m.who === 'user' ? '我' : 'AI'}:</strong> {m.text}
              </Typography>
              )
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <TextField
            size="small"
            fullWidth
            placeholder={voiceEnabled ? (voice.state === 'recording' ? '我在听...' : '说"小月"唤醒') : '跟数字人说点什么…'}
            value={chat.text}
            onChange={(e) => chat.setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), chat.send())}
            disabled={chatBusy}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                fontSize: 12,
                bgcolor: 'rgba(255,255,255,0.08)',
                '& fieldset': { borderColor: voiceEnabled ? (voice.state === 'recording' ? '#3b82f6' : '#a855f7') : 'rgba(255,255,255,0.2)' },
              },
              '& .MuiOutlinedInput-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
            }}
          />
          <IconButton
            size="small"
            data-no-drag
            onClick={(e) => {
              e.stopPropagation();
              setVoiceEnabled(v => {
                const newVal = !v
                // 直接在 click handler 里调 (保留 user gesture 上下文)
                // 否则 useEffect 异步触发时, AudioContext 会被浏览器 suspended
                if (newVal) voice.start()
                else voice.stop()
                return newVal
              })
            }}
            sx={{
              bgcolor: voiceEnabled ? '#a855f7' : (t) => alpha(t.palette.common.white, 0.1),
              color: voiceEnabled ? 'white' : 'rgba(255,255,255,0.7)',
              '&:hover': { bgcolor: voiceEnabled ? '#9333ea' : (t) => alpha(t.palette.common.white, 0.2) },
            }}
          >
            <MicRoundedIcon sx={{
              fontSize: 18,
              animation: voiceEnabled ? 'pulse 1.2s infinite' : 'none',
            }} />
          </IconButton>
          <IconButton
            size="small"
            data-no-drag
            disabled={chatBusy || !chat.text.trim()}
            onClick={(e) => {
              e.stopPropagation();
              chat.send();
            }}
            sx={{
              bgcolor: (t) => alpha(t.palette.primary.main, 0.8),
              color: 'white',
              '&:hover': { bgcolor: (t) => t.palette.primary.main },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
            }}
          >
            {chatBusy ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <SendRoundedIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Box>
        {voice.error && (
          <Typography sx={{ fontSize: 9, color: 'error.main', mt: 0.5 }}>
            {voice.error}
          </Typography>
        )}

        {/* 语音调试日志面板 */}
        {voiceLogs.length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            <Box
              data-no-drag
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: 'rgba(255,255,255,0.08)',
                borderRadius: 1,
                px: 0.75,
                py: 0.25,
              }}
            >
              <Typography variant="caption" sx={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                语音日志 ({voiceLogs.length})
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); setShowVoiceLogs(v => !v) }}
                sx={{ color: 'rgba(255,255,255,0.6)', p: 0.25 }}
              >
                {showVoiceLogs ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Box>
            <Collapse in={showVoiceLogs}>
              <Box sx={{
                mt: 0.5,
                maxHeight: 120,
                overflowY: 'auto',
                bgcolor: 'rgba(0,0,0,0.6)',
                borderRadius: 1,
                p: 0.75,
                fontFamily: 'monospace',
                fontSize: 9,
              }}>
                {voiceLogs.slice(-30).map((log, i) => (
                  <Box key={i} sx={{
                    color: log.level === 'error' ? '#fca5a5' : log.level === 'warn' ? '#fcd34d' : 'rgba(255,255,255,0.85)',
                    mb: 0.25,
                    wordBreak: 'break-word',
                    lineHeight: 1.3,
                  }}>
                    <span style={{ opacity: 0.5 }}>{new Date(log.ts).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>{' '}
                    [{log.tag}] {log.message}
                  </Box>
                ))}
              </Box>
            </Collapse>
          </Box>
        )}
      </Box>

      <audio ref={audioRef} hidden />

      {/* 语音指示器 (浮窗顶部, 一直显示状态) */}
      <Box data-no-drag sx={{
        position: 'absolute',
        top: 4, right: 36, zIndex: 3,
        pointerEvents: 'none',
      }}>
        {voiceEnabled && (
          <VoiceIndicator
            state={voice.state as VoiceIndicatorState}
            transcript={voice.transcript}
            wakeWord={voice.wakeWord}
            error={voice.error}
            position="top-right"
            showTranscript
          />
        )}
      </Box>

      {/* I1: 统一显示器(视频原声/地址栏/fallback/新标签), 取代旧 ExternalViewer */}
      {iframeTarget && (
        <VirtualBrowser
          target={iframeTarget}
          title={iframeTarget.rawUrl}
          onClose={() => setIframeTarget(null)}
          placement="modal"
        />
      )}

      {/* 数字人下发的列表/网格/表单。
          浮窗没有 3D 舞台(那是 /digital-human 全屏页的 CSS3D 面板),这里用普通弹层承接
          同一份 ScenePanel —— 否则用户在浮窗里让它搜资源,工具跑完了却什么都看不到。 */}
      {scenePanel && (
        <Box
          data-no-drag
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setScenePanel(null); }}
        >
          <Box sx={{ width: 'min(520px, 92vw)', height: 'min(680px, 86vh)' }}>
            <ScenePanel
              key={scenePanel.id}
              panel={scenePanel}
              onClose={() => setScenePanel(null)}
              onSend={(t) => { setScenePanel(null); void chat.sendText(t); }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
