'use client';

import { devLog } from '@/lib/dev-log';

/**
 * ImmersiveDigitalHuman —— /digital-human 沉浸式全屏页面
 *
 * 2026-07 升级：用 VrmStage 替代 BlenderAvatar。
 *   - 全身取景（camera 0,1.1,4.5 FOV 30）
 *   - 5 个场景预设、6 个相机视角预设
 *   - 12 表情滑杆 + 10 情绪 chip + 6 姿势 chip
 *   - 保留 chat / voice / wake-up / system 全部功能
 *   - 兼容 useChatAvatarWS（emotion/viseme/action 直传）
 *   - 通过 VrmStageHandle 暴露 sinks，给 V2 sinks 模式或
 *     未来从 chat WS 解析 tool_calls 预留入口
 */

import React from 'react';
import { Box, IconButton, TextField, Typography, CircularProgress, Drawer, List, ListItemButton, ListItemText, Divider, Button, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import { useRouter } from 'next/navigation';
import { alpha } from '@mui/material/styles';
import { VrmStage, type VrmStageHandle } from './VrmStage';
import { useChatAvatarWS } from './useChatAvatarWS';
import { DynamicUIModal } from './dynamic-ui/DynamicUIModal';
import type { DynamicUI, UIAction } from './dynamic-ui/types';
import { dispatchToolCalls, type ToolCall as DhToolCall } from './tools/dispatcher';
import { textToVisemeTimeline } from './tools/visemes';
import { parseIframeUI, iframeToolToTarget, type IframeOpenTarget } from './virtual-browser';
import { VirtualBrowser } from './VirtualBrowser';
import { useConversationHistory } from './useConversationHistory';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { VoiceIndicator, type VoiceIndicatorState } from '@/components/VoiceIndicator';
import { useThemeMode } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { logout } from '@/apis/user';
import { useQuery } from '@tanstack/react-query';
import VrmControlPanel from '@/components/digital-human/VrmControlPanel';
import VrmEmotionChips from '@/components/digital-human/VrmEmotionChips';
import VrmPoseChips from '@/components/digital-human/VrmPoseChips';
import { listModels } from './api/digitalHumanConfig';
import { clearAvatarCache } from './vrm/loadAvatar';
import type { VrmModelConfig } from './vrm/config/types';
import type { ScenePresetName, CameraPresetName, DanceStyle } from './vrm/types';

// ── 调试：排查 runtime.lastError 来源 ──
// 操作步骤:
//   1. 打开 http://localhost:3000/digital-human
//   2. 先记下控制台错误出现频率
//   3. 按 1 → 刷新页面 → 看错误是否停止 (排除 Three.js)
//   4. 按 2 → 刷新页面 → 点麦克风 → 看错误是否出现 (排除 VAD)
//   5. 按 3 → 刷新页面 → 点麦克风 → 看错误是否出现 (排除 ONNX wake-word)
//   "开关状态" 会打印在控制台，切换后需手动刷新页面生效
//   按 0 清除所有开关
const STORAGE_KEY = 'dh_debug_flags';
const loadFlags = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
};
const saveFlags = (f: Record<string, boolean>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  devLog.log('[debug] flags saved:', f, '(刷新页面生效)');
};
if (typeof window !== 'undefined') {
  const flags = loadFlags();
  (window as any).__DIGITAL_HUMAN_DEBUG = { noThree: !!flags.noThree, noVoice: !!flags.noVoice, noWake: !!flags.noWake };
  devLog.log('[debug] current flags:', (window as any).__DIGITAL_HUMAN_DEBUG, '| 按 1/2/3 切换, 0 清除, 需刷新生效');

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; // 不在输入框里触发
    const f = loadFlags();
    switch (e.key) {
      case '1': f.noThree = !f.noThree; saveFlags(f); break;
      case '2': f.noVoice = !f.noVoice; saveFlags(f); break;
      case '3': f.noWake  = !f.noWake;  saveFlags(f); break;
      case '0': localStorage.removeItem(STORAGE_KEY); devLog.log('[debug] all flags cleared'); break;
    }
  });

  // 每 2 秒采样一次，统计 rAF / audio 帧率
  let rAFCount = 0, audioFrameCount = 0;
  const origRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb: FrameRequestCallback) => origRAF(() => { rAFCount++; cb(performance.now()); });
  const timer = setInterval(() => {
    if (rAFCount > 0 || audioFrameCount > 0) {
      devLog.debug(`[debug] rAF=${rAFCount}/2s (~${Math.round(rAFCount/2)}fps) audioFrame=${audioFrameCount}/2s`);
      rAFCount = 0; audioFrameCount = 0;
    }
  }, 2000);
  (window as any).__DEBUG_audioFrameInc = () => { audioFrameCount++; };
}

export default function ImmersiveDigitalHuman() {
  const router = useRouter();
  const { setTheme } = useThemeMode();
  // 修复 hydration mismatch: 等客户端 mount 后再渲染动态内容
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  // VrmStage sinks 引用（用 state 而非 ref，避免首次渲染时 ref.current 还没填的坑）
  const [stageHandle, setStageHandle] = React.useState<VrmStageHandle | null>(null);
  // H1: 动态 UI(数字员工干活后弹结果面板)
  const [dynamicUI, setDynamicUI] = React.useState<DynamicUI | null>(null);
  // I1: 虚拟浏览器 iframe 显示器(真实加载网页,零后端)
  // 统一显示器组件(地址栏/视频原声/fallback/新标签), 取代旧的 inline iframe
  const [browserFrame, setBrowserFrame] = React.useState<{ url: string; title?: string } | null>(null);
  const [browserTarget, setBrowserTarget] = React.useState<IframeOpenTarget | null>(null);
  const chat = useChatAvatarWS(undefined, {
    // G1: 数字人走 agentmanager 的数字员工(AG-UI),形象/动作仍由 dispatcher 驱动
    useAgui: true,
    aguiAgent: 'worker',
    // H1: 接收动态 UI 指令并渲染;I1: iframe 指令走独立显示器
    onUI: (ui: any) => {
      // I1: iframe 指令 → 统一解析器产出目标, 弹显示器
      const target = parseIframeUI(ui);
      if (target) {
        setBrowserTarget(target);
        setBrowserFrame({ url: target.url, title: ui.title });
        return;
      }
      setDynamicUI(ui as DynamicUI);
    },
    onToolCalls: (calls) => {
      // I1.2: 数字人/用户要看网页或视频 → 弹统一显示器 (工具兜底, 与 <ui:iframe/> 指令同源)
      // 注意: 必须先于 stageHandle 早退处理, 否则 stage 未就绪时网页/视频指令被丢弃
      for (const c of calls as unknown as DhToolCall[]) {
        const target = iframeToolToTarget(c);
        if (target) {
          setBrowserTarget(target);
          setBrowserFrame({ url: target.url, title: target.rawUrl });
        }
      }
      // 把 Hermes/数字人下发的 tool_calls 串到 VrmStage handle。
      // stageHandle 为 null 时(还没就绪)只 log,不动 avatar。
      if (!stageHandle) {
        devLog.warn('[Immersive] tool_calls arrived before stageHandle ready:', calls);
        return;
      }
      const h = stageHandle;
      const results = dispatchToolCalls(
        calls as unknown as DhToolCall[],
        {
          setEmotion: (bs) => { h.setEmotion(bs); chat.setEmotion?.(bs); },
          setAction: (name) => h.setAction(name),
          setViseme: (shape, weight) => {
            // AG-UI 文本模式无 ASR 音频数据，无法做真实 viseme 对齐
            // 说话时表情跟随由 <emotion:x/> 驱动，已通过 setEmotion 覆盖
          },
          setVisemeTimeline: (frames) => h.setVisemeTimeline(frames),
          setJawOpen: () => {},
          speak: (text, audioUrl) => {
            // 口型:从文本生成 viseme 时间线
            const visemes = textToVisemeTimeline(text, 150); // 每个 viseme 150ms
            h.speak(text, audioUrl, visemes);
          },
          move: (target, opts) => h.move(target as Parameters<typeof h.move>[0], opts),
          camera: () => {},
          setScene: (name) => h.setScene(name),
          setCameraPreset: (name) => h.setCameraPreset(name),
          setPose: (name) => h.setPose(name as Parameters<typeof h.setPose>[0]),
          // 换装:查模型列表 → 切 selectedModel(VrmStage 用 modelUrl=selectedModel.url 重载)
          setModel: (modelId) => {
            listModels().then((models) => {
              const list = models || [];
              const m = list.find(x => x.id === modelId) || list.find(x => x.url === modelId);
              if (m) {
                clearAvatarCache(m.url);
                setSelectedModel(m);
                setChatLog((prev) => [...prev, { who: 'ai', text: `已为你换装成「${m.name}」。` }]);
              } else {
                const options = list.map(x => x.name).join('、');
                setChatLog((prev) => [...prev, { who: 'ai', text: options ? `暂时没有「${modelId}」这个模型。可选：${options}` : `暂时没有可换的服装模型。` }]);
              }
            });
            return true;
          },
        },
      );
      // 未知动作/表情 → 追加提示到聊天记录
      for (const r of results) {
        if (!r.ok && r.error) {
          const msg = r.error.includes('unknown action') || r.error.includes('unknown expression')
            ? `⚠️ ${r.error}，试试说「挥手」「跳舞」等其他动作吧~`
            : `⚠️ ${r.error}`;
          setChatLog((prev) => [...prev, { who: 'ai', text: msg }]);
        }
      }
      devLog.debug('[Immersive] dispatched tool_calls:', results);
    },
  });
  const { chatBusy, chatLog, emotion, viseme, action, send, sendText, audioRef,
    text, setText, conversationId, newConversation, switchConversation,
    loadConversationMessages, setEmotion, setViseme, setChatLog, thinkingLog } = chat;
  // 002:全屏页体现多会话能力
  const { history, refresh: refreshHistory } = useConversationHistory(20);
  const [sessionDrawerOpen, setSessionDrawerOpen] = React.useState(true);
  // 诊断：监听 stageHandle 变化
  React.useEffect(() => { devLog.debug('[Immersive] stageHandle 变化:', stageHandle); }, [stageHandle]);
  const [panelOpen, setPanelOpen] = React.useState(false);
  // 002:聊天消息区自动滚动到底
  const chatScrollRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatLog]);

  // 002:刚进入时自动加载最近会话的历史消息
  //   - 有 conversationId(localStorage)→ 加载它;没有 → 加载列表最后一个
  const autoLoadedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoLoadedRef.current) return;
    if (history.length === 0) return; // 无会话,等用户新建
    autoLoadedRef.current = true;
    const target = conversationId && history.some((h) => h.id === conversationId)
      ? conversationId
      : history[0].id;
    // 切换过去(清空 + 设 ID)+ 加载历史
    if (conversationId !== target) {
      switchConversation?.(target);
    }
    loadConversationMessages?.(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, conversationId]);

  // 002:点击"新会话" → 先调后端创建空会话(立即出现在列表),再切换过去
  const { currentUser } = useApp();
  const handleNewConversation = React.useCallback(async () => {
    try {
      const res = await fetch('/api/agentmanager/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id ?? 0,
          agentId: 'worker',
          title: '新会话',
        }),
      });
      const j = await res.json().catch(() => null);
      console.log('[handleNewConversation] response:', j);
      if (j?.id) {
        // 后端返回数字 ID，前端用字符串
        const cid = String(j.id);
        console.log('[handleNewConversation] switching to:', cid);
        switchConversation?.(cid); // 切到新会话(清空 chatLog)
        refreshHistory();           // 刷新列表,新会话立即出现
        return;
      }
    } catch (e) {
      console.error('[handleNewConversation] error:', e);
      /* 创建失败则退回本地新会话 */
    }
    newConversation?.();
    refreshHistory();
  }, [currentUser?.id, switchConversation, refreshHistory, newConversation]);

  // 003:发消息后更新会话标题(第一条用户消息前50字)
  // 需要 realtime-api 部署后支持 PUT /conversations/:id 路由
  const updateConversationTitle = React.useCallback(async (convId: string, title: string) => {
    if (!convId || convId.startsWith('local-')) return;
    try {
      const truncated = title.length > 50 ? title.slice(0, 50) + '…' : title;
      const res = await fetch(`/api/agentmanager/conversations/${encodeURIComponent(convId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: truncated }),
      });
      if (!res.ok) {
        devLog.warn('[updateTitle] failed:', res.status, convId);
        return;
      }
      refreshHistory(); // 标题变了就刷新列表
    } catch (e) {
      devLog.warn('[updateTitle] error:', e);
    }
  }, [refreshHistory]);

  // 监听 chatLog 变化,在发送第一条用户消息后更新标题
  const prevChatLogLenRef = React.useRef(0);
  React.useEffect(() => {
    const currentLen = chatLog.length;
    if (currentLen > prevChatLogLenRef.current) {
      // 有新消息加入 chatLog,找到新增的用户消息
      const added = chatLog.slice(prevChatLogLenRef.current);
      const firstUserMsg = added.find((m) => m.who === 'user');
      if (firstUserMsg && conversationId && !conversationId.startsWith('local-')) {
        updateConversationTitle(conversationId, firstUserMsg.text);
      }
    }
    prevChatLogLenRef.current = currentLen;
  }, [chatLog, conversationId, updateConversationTitle]);

  // 模型选择
  const modelsQuery = useQuery({
    queryKey: ['dhc', 'models'],
    queryFn: listModels,
    staleTime: 5 * 60 * 1000,
  });
  const models: VrmModelConfig[] = modelsQuery.data ?? [];
  const defaultModel = models.find((m) => m.isDefault) ?? models[0];
  const [selectedModel, setSelectedModel] = React.useState<VrmModelConfig | null>(null);

  // 初始化 selectedModel
  React.useEffect(() => {
    if (defaultModel && !selectedModel) {
      setSelectedModel(defaultModel);
    }
  }, [defaultModel, selectedModel]);

  const [stageState, setStageState] = React.useState({
    dancing: false,
    danceStyle: 'groove' as DanceStyle,
    bpm: 120,
    danceAmp: 1,
    scene: 'concert' as ScenePresetName,
    camera: 'front' as CameraPresetName,
    confetti: false,
    autoBlink: true,
    lookAtCamera: true,
    fov: 30,
    songOn: false,
    micOn: false,
    yOffset: 0,
  });
  const updateStageState = React.useCallback((patch: Partial<typeof stageState>) => {
    setStageState((prev) => ({ ...prev, ...patch }));
  }, []);

  // 实时读 VrmStage 里的 positionRef 给面板显示（每 250ms）
  const [posDisplay, setPosDisplay] = React.useState({ x: 0, z: 0 });
  React.useEffect(() => {
    const id = setInterval(() => {
      const p = stageHandle?.getPosition?.();
      if (p) setPosDisplay({ x: p.x, z: p.z });
    }, 250);
    return () => clearInterval(id);
  }, [stageHandle]);

  // 把 UI state 推到 VrmStage.handle（每条都打日志，方便排查哪条没生效）
  React.useEffect(() => { devLog.debug('[Immersive→handle] setScene', stageState.scene, '| handle:', !!stageHandle); stageHandle?.setScene(stageState.scene); }, [stageHandle, stageState.scene]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setCameraPreset', stageState.camera, '| handle:', !!stageHandle); stageHandle?.setCameraPreset(stageState.camera); }, [stageHandle, stageState.camera]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setDanceStyle', stageState.danceStyle, '| handle:', !!stageHandle); stageHandle?.setDanceStyle(stageState.danceStyle); }, [stageHandle, stageState.danceStyle]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setDancing', stageState.dancing, '| handle:', !!stageHandle); stageHandle?.setDancing(stageState.dancing); }, [stageHandle, stageState.dancing]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setBpm', stageState.bpm, '| handle:', !!stageHandle); stageHandle?.setBpm(stageState.bpm); }, [stageHandle, stageState.bpm]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setDanceAmp', stageState.danceAmp, '| handle:', !!stageHandle); stageHandle?.setDanceAmp(stageState.danceAmp); }, [stageHandle, stageState.danceAmp]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setConfetti', stageState.confetti, '| handle:', !!stageHandle); stageHandle?.setConfetti(stageState.confetti); }, [stageHandle, stageState.confetti]);
  React.useEffect(() => { stageHandle?.setYOffset(stageState.yOffset); }, [stageHandle, stageState.yOffset]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] setAutoBlink', stageState.autoBlink); }, [stageState.autoBlink]);  // autoBlink 走 prop，不走 handle
  React.useEffect(() => { devLog.debug('[Immersive→handle] setLookAtCamera', stageState.lookAtCamera); }, [stageState.lookAtCamera]);  // lookAtCamera 走 prop
  // 唱歌/麦克风：on 触发 start，off 触发 stop
  React.useEffect(() => { devLog.debug('[Immersive→handle] songOn', stageState.songOn, '| handle:', !!stageHandle); if (stageHandle) stageState.songOn ? stageHandle.startSong() : stageHandle.stopSong(); }, [stageHandle, stageState.songOn]);
  React.useEffect(() => { devLog.debug('[Immersive→handle] micOn', stageState.micOn, '| handle:', !!stageHandle); if (stageHandle) stageState.micOn ? stageHandle.startMic() : stageHandle.stopMic(); }, [stageHandle, stageState.micOn]);

  // system 意图: 音量/主题/全屏/刷新/登出等实际浏览器操作
  const preMuteVolumeRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    const applySystem = (e: Event) => {
      const detail = (e as CustomEvent<import('@/lib/intent/types').Intent>).detail
      if (!detail || detail.type !== 'system') return
      const { action: sysAction, params } = detail
      const audio = audioRef.current

      switch (sysAction) {
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
  }, [audioRef, router, setTheme])

  // 语音唤醒: 点 mic 一次 → 一直监听 (说"小月"+ 命令 → barge-in 打断)
  const wakePhrases = React.useMemo(() => ['小月', '清秋月', '清秋'], [])
  const [voiceEnabled, setVoiceEnabled] = React.useState(false)
  const voice = useVoiceAgent({
    wakePhrases,
    asrGatewayUrl: typeof window !== 'undefined' ? `${window.location.origin}/api/audio` : '/api/audio',
    onCommand: async (text) => {
      if (chat.isSpeaking()) chat.cancel()
      await sendText(text)
    },
    isAvatarSpeaking: () => chat.isSpeaking(),
    onInterrupt: () => chat.cancel(),
  })

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1, background: '#05060B' }}>
      {/* 全屏 VRM 角色（与浮窗同一个 character.vrm） — 用 VrmStage 替代 BlenderAvatar */}
      <VrmStage
        onReady={(h) => { devLog.debug('[Immersive] onReady 被调用, h=', h); setStageHandle(h); }}
        modelUrl={selectedModel?.url ?? '/avatars/character.vrm'}
        currentAction={action}
        emotion={emotion}
        viseme={viseme}
        autoBlink={stageState.autoBlink}
        lookAtCamera={stageState.lookAtCamera}
        sx={{ position: 'absolute', inset: 0 }}
      />

      {/* 顶部:退出按钮 + 模型选择 + 会话列表切换 + 控制台切换 */}
      <IconButton
        onClick={() => router.back()}
        size="medium"
        aria-label="退出"
        sx={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 3,
          color: 'rgba(255,255,255,0.85)',
          bgcolor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
        }}
      >
        <CloseRoundedIcon />
      </IconButton>

      {/* 模型选择器 */}
      {models.length > 1 && (
        <FormControl
          size="small"
          sx={{
            position: 'absolute',
            top: 12,
            left: 60,
            zIndex: 3,
            minWidth: 120,
            '& .MuiOutlinedInput-root': {
              color: 'rgba(255,255,255,0.85)',
              bgcolor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
              '&.Mui-focused fieldset': { borderColor: '#25F4EE' },
            },
            '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.7)' },
          }}
        >
          <Select
            value={selectedModel?.id ?? ''}
            onChange={(e) => {
              const m = models.find((m) => m.id === e.target.value);
              if (m) setSelectedModel(m);
            }}
            displayEmpty
            startAdornment={
              <PersonRoundedIcon sx={{ fontSize: 18, mr: 0.5, color: 'rgba(255,255,255,0.7)' }} />
            }
            sx={{ fontSize: 13 }}
          >
            {models.map((m) => (
              <MenuItem key={m.id} value={m.id} sx={{ fontSize: 13 }}>
                {m.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <IconButton
        onClick={() => setSessionDrawerOpen((o) => !o)}
        size="medium"
        aria-label="会话列表"
        sx={{
          position: 'absolute',
          top: 12,
          left: { xs: 60, sm: models.length > 1 ? 190 : 60 },
          zIndex: 3,
          color: sessionDrawerOpen ? '#25F4EE' : 'rgba(255,255,255,0.85)',
          bgcolor: sessionDrawerOpen ? 'rgba(37,244,238,0.15)' : 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          '&:hover': { bgcolor: 'rgba(37,244,238,0.2)' },
        }}
      >
        <ForumRoundedIcon />
      </IconButton>
      <IconButton
        onClick={() => setPanelOpen((o) => !o)}
        size="medium"
        aria-label="舞台控制台"
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 3,
          color: panelOpen ? '#ff4fd8' : 'rgba(255,255,255,0.85)',
          bgcolor: panelOpen ? 'rgba(255,79,216,0.15)' : 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          '&:hover': { bgcolor: 'rgba(255,79,216,0.2)' },
        }}
      >
        <TuneRoundedIcon />
      </IconButton>

      {/* 底部 chip 条：情绪 + 姿势（移动端隐藏，腾位置给 chat） */}
      <Box sx={{
        position: 'absolute', left: 16, right: { xs: 16, md: 540 }, bottom: { xs: 100, md: 100 },
        zIndex: 3, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 0.5,
      }}>
        <VrmEmotionChips handle={stageHandle} />
        <VrmPoseChips handle={stageHandle} />
      </Box>

      {/* 右侧控制面板 */}
      <VrmControlPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        handle={stageHandle}
        state={stageState}
        onChange={updateStageState}
        posDisplay={posDisplay}
      />

      {/* 右侧控制面板 */}
      <VrmControlPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        handle={stageHandle}
        state={stageState}
        onChange={updateStageState}
        posDisplay={posDisplay}
      />

      {/* 完全自由场景:左侧会话列表(可折叠) + 底部聊天区(气泡式) */}
      {/* 会话列表 */}
      <Box sx={{
        position: 'absolute',
        top: 16,
        left: 16,
        width: 260,
        maxHeight: 'calc(100vh - 120px)',
        zIndex: 3,
        background: 'rgba(0,0,0,0.5)',
        borderRadius: 2,
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>会话</Typography>
          <Button size="small" onClick={handleNewConversation} sx={{ fontSize: 11, color: '#25F4EE', textTransform: 'none' }}>
            + 新会话
          </Button>
        </Box>
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {history.length === 0 ? (
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', p: 2, textAlign: 'center' }}>
              还没有会话
            </Typography>
          ) : (
            history.map((h) => (
              <ListItemButton
                key={h.id}
                selected={conversationId === h.id}
                onClick={() => switchConversation?.(h.id)}
                sx={{
                  py: 1,
                  px: 1.5,
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  '&.Mui-selected': { bgcolor: 'rgba(37,244,238,0.15)' },
                }}
              >
                <ListItemText
                  primary={h.title}
                  slotProps={{
                    primary: { sx: { fontSize: 12, color: '#fff', noWrap: true } }
                  }}
                />
              </ListItemButton>
            ))
          )}
        </Box>
      </Box>

      {/* 底部聊天区:全宽气泡式 */}
      <Box sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '40vh',
        maxHeight: 400,
        zIndex: 3,
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* 思考面板 */}
        {thinkingLog && (
          <Box sx={{
            mx: 2,
            mb: 1,
            p: 1.5,
            background: 'rgba(100,100,255,0.12)',
            borderRadius: 2,
            border: '1px solid rgba(100,100,255,0.25)',
          }}>
            <Typography sx={{ fontSize: 12, color: 'rgba(200,200,255,0.95)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
              💭 {thinkingLog.replace(/<think>|<\/think>/g, '').trim()}
            </Typography>
          </Box>
        )}

        {/* 聊天消息区 */}
        <Box
          ref={chatScrollRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 2,
            pb: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {chatLog.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', mt: 4 }}>
              {mounted ? (conversationId ? '这个会话还没有消息，说点什么开始吧~' : '发条消息创建新会话吧~') : '加载中…'}
            </Typography>
          ) : (
            chatLog.map((m, i) => (
              <Box
                key={i}
                sx={{
                  alignSelf: m.who === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '70%',
                  p: 1.5,
                  borderRadius: m.who === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: m.who === 'user' ? 'rgba(37,244,238,0.2)' : 'rgba(255,255,255,0.12)',
                  border: m.who === 'user' ? '1px solid rgba(37,244,238,0.3)' : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <Typography sx={{ fontSize: 13, color: '#fff', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {m.text}
                </Typography>
              </Box>
            ))
          )}
          {/* AI 思考中 */}
          {chatBusy && (
            <Box sx={{ alignSelf: 'flex-start', p: 1.5, borderRadius: '16px 16px 16px 4px', background: 'rgba(255,255,255,0.1)' }}>
              <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.7)' }} />
            </Box>
          )}
        </Box>

        {/* 输入区 */}
        <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            fullWidth
            placeholder={voiceEnabled ? (voice.state === 'recording' ? '我在听…' : '说"小月"唤醒') : '跟数字人说点什么…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            disabled={chatBusy}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                '& fieldset': { borderColor: voiceEnabled ? (voice.state === 'recording' ? '#3b82f6' : '#a855f7') : 'rgba(255,255,255,0.2)' },
              },
              '& .MuiOutlinedInput-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
            }}
          />
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              console.log('[mic] click, voiceEnabled=', voiceEnabled, 'voice.state=', voice.state);
              setVoiceEnabled(v => {
                const newVal = !v;
                console.log('[mic] toggling to', newVal);
                if (newVal) {
                  console.log('[mic] calling voice.start()');
                  voice.start();
                } else {
                  console.log('[mic] calling voice.stop()');
                  voice.stop();
                }
                return newVal;
              });
            }}
            sx={{
              bgcolor: voiceEnabled ? '#a855f7' : 'rgba(255,255,255,0.1)',
              color: voiceEnabled ? 'white' : 'rgba(255,255,255,0.7)',
              '&:hover': { bgcolor: voiceEnabled ? '#9333ea' : 'rgba(255,255,255,0.2)' },
            }}
          >
            <MicRoundedIcon sx={{ fontSize: 22, animation: voiceEnabled ? 'pulse 1.2s infinite' : 'none' }} />
          </IconButton>
          <IconButton
            onClick={send}
            disabled={chatBusy || !text.trim()}
            sx={{
              bgcolor: 'rgba(37,244,238,0.2)',
              color: '#25F4EE',
              '&:hover': { bgcolor: 'rgba(37,244,238,0.3)' },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            {chatBusy ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <SendRoundedIcon />}
          </IconButton>
        </Box>
        {voice.error && (
          <Typography sx={{ fontSize: 10, color: 'error.main', textAlign: 'center', pb: 1 }}>
            {voice.error}
          </Typography>
        )}
      </Box>

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

      <audio ref={audioRef} hidden />

      {/* H1: 动态 UI(数字员工干活后弹结果面板) */}
      {dynamicUI && (
        <DynamicUIModal
          ui={dynamicUI}
          onClose={() => setDynamicUI(null)}
          onAction={(action: UIAction) => {
            if (action.handler === 'navigate') {
              // 导航类动作:跳转
              const target = action.target as string;
              if (target) window.location.href = target;
            } else if (action.handler === 'tool' && action.target) {
              // 工具类动作:回灌对话
              chat.sendText(String(action.target));
            }
            setDynamicUI(null);
          }}
        />
      )}

      {/* I1: 虚拟浏览器显示器(统一组件: 地址栏 / 视频原声 / fallback / 新标签) */}
      {browserTarget && (
        <VirtualBrowser
          target={browserTarget}
          title={browserFrame?.title}
          onClose={() => { setBrowserTarget(null); setBrowserFrame(null); }}
        />
      )}
    </Box>
  );
}
