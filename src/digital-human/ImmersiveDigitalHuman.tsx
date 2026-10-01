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
import { Box, ButtonBase, IconButton, TextField, Typography, CircularProgress, Drawer, List, ListItemButton, ListItemText, Divider, Button, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import ParkRoundedIcon from '@mui/icons-material/ParkRounded';
import { useWorldGame } from './scene-ui/useWorldGame';
import { GameStatusBar, GameToasts, Minimap, QuestPanel, WorldHelp, WorldTools, ZonePrompt, useWorldHelp } from './scene-ui/GameHud';
import { AuraShop, PlatformTasks, ZonePanel } from './scene-ui/PlazaPanels';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { usePlazaOnline } from './scene-ui/usePlazaOnline';
import type { FeedAction, ZoneFeed } from './scene-ui/plazaFeeds';
import { playTracks } from '@/lib/player/playlist';
import { zoneFeed } from './vrm/world/worldLayout';
import type { WorldEvent } from './vrm/world/useVrmWorld';
import { usePlazaScenes } from './scene-ui/usePlazaScenes';
import { CharacterPanel, ScenePicker } from './scene-ui/PlazaPeople';
import { SCENE_PRESETS } from './vrm/sceneBuilders';
import { TIME_LABELS, type TimeMode } from './vrm/world/env/timeOfDay';
import { roomBounds, worldEnv } from './vrm/world/worldLayout';
import { WORLD_ASSET_BASE } from './vrm/world/realKit';
import { mediaUrl } from '@/lib/media';
import { useWorldObjects, type WorldToolEvent } from './scene-ui/useWorldObjects';
import { GenesisHud, GenesisPanels, RoomPlate, RoomsSection, useGenesis } from './scene-ui/Genesis';
import { useRoomSocket } from './scene-ui/useRoomSocket';
import { RoomChat } from './scene-ui/RoomChat';
import { useRoomVoice } from './scene-ui/useRoomVoice';
import { quickCheck, useFpsGate, type GateVerdict } from './perfGate';
import { PerfBlockScreen } from './PerfBlockScreen';
import type { PlazaState } from './scene-state';
import { useRouter } from 'next/navigation';
import { alpha } from '@mui/material/styles';
import { VrmStage, type VrmStageHandle } from './VrmStage';
import { useChatAvatarWS } from './useChatAvatarWS';
import { createPortal } from 'react-dom';
import { DynamicUIModal } from './dynamic-ui/DynamicUIModal';
import type { DynamicUI, UIAction } from './dynamic-ui/types';
import { ScenePanel } from './scene-ui/ScenePanel';
import type { ScenePanel as ScenePanelModel } from './scene-ui/types';
import { dispatchToolCalls, type ToolCall as DhToolCall } from './tools/dispatcher';
import { applyDispatchResults, buildSceneState, type SceneSnapshot } from './scene-state';
import { ToolCallCard, ThoughtBubble } from './scene-ui/ChatOpsEntry';
import ChatRichItem, { isRichItem } from './scene-ui/ChatRichItem';
import dynamic from 'next/dynamic';
import ClipAvatar from './ClipAvatar';
import { probeClips, type AvatarSpeakState } from './clip-avatar';
// 3DGS 渲染器只能在浏览器里加载(three + WebGL)
const GaussianSplatRenderer = dynamic(() => import('./gs/GaussianSplatRenderer'), { ssr: false });
type AvatarMode = 'vrm' | '3dgs' | '2d';
interface GsAssetItem { id: string; name: string; assetUrl: string }
import { textToVisemeTimeline } from './tools/visemes';
import { parseIframeUI, iframeToolToTarget, resolveIframeUrl, type IframeOpenTarget } from './virtual-browser';
import SceneDisplay from './scene-ui/SceneDisplay';
import { pageFromTarget, parseSlot, resolveDisplayInput, sitePage, slotForUrl, toSitePath, type DisplayPage, type DisplayPages } from './scene-ui/displays';
import { contentHref } from './scene-ui/content';
import { DISPLAY_SLOTS, DISPLAY_SPECS, type DisplaySlot } from './vrm/sceneDisplays';
import type { DisplayHosts } from './vrm/useVrmScenePanel';
import { useConversationHistory } from './useConversationHistory';
import { createConversation, isServerConversationId, renameConversation } from './conversationApi';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { VoiceIndicator, type VoiceIndicatorState } from '@/components/VoiceIndicator';
import { useThemeMode } from '@/contexts/ThemeContext';
import { logout } from '@/apis/user';
import { useQuery } from '@tanstack/react-query';
import VrmControlPanel from '@/components/digital-human/VrmControlPanel';
import VrmEmotionChips from '@/components/digital-human/VrmEmotionChips';
import VrmPoseChips from '@/components/digital-human/VrmPoseChips';
import { listModels } from './api/digitalHumanConfig';
import { clearAvatarCache } from './vrm/loadAvatar';
import type { VrmModelConfig } from './vrm/config/types';
import type { ScenePresetName, CameraPresetName, DanceStyle } from './vrm/types';
import { API_PREFIX } from '@/lib/api/prefix';
import { authFetch } from '@/lib/api/auth'; // realtime-api 全部要登录

// ── 调试：排查 runtime.lastError 来源 ──
// 只在开发环境,或地址栏带 ?dhdebug=1 时启用。以前模块一加载就给整个 app 挂
// 全局 keydown、替换 window.requestAnimationFrame、起一个永不清理的 setInterval:
// 线上用户访问过一次 /digital-human 之后,在任何页面按个「1」都会写进 noThree,
// 下次刷新 3D 就不渲染了。
// 操作步骤:
//   1. 打开 http://localhost:3000/digital-human(线上加 ?dhdebug=1)
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
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch { /* 隐私模式写不进去 */ }
  devLog.log('[debug] flags saved:', f, '(刷新页面生效)');
};
const debugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (process.env.NODE_ENV !== 'production') return true;
  try { return new URLSearchParams(window.location.search).has('dhdebug'); } catch { return false; }
};
if (typeof window !== 'undefined') {
  // 子组件(BlenderAvatar / VAD / 唤醒词)在自己的 effect 里读这个开关,比本组件的 effect 早,
  // 所以开关值要在模块加载时就定好。没开调试时一律视为关闭 —— 即使 localStorage 里
  // 残留了以前误触写进去的 noThree。
  const flags = debugEnabled() ? loadFlags() : {};
  (window as any).__DIGITAL_HUMAN_DEBUG = { noThree: !!flags.noThree, noVoice: !!flags.noVoice, noWake: !!flags.noWake };
}

/** 调试快捷键 + rAF/音频帧率采样:只在调试开启且本组件挂载期间生效,卸载时全部还原 */
function useDigitalHumanDebug() {
  React.useEffect(() => {
    if (!debugEnabled()) return;
    devLog.log('[debug] current flags:', (window as any).__DIGITAL_HUMAN_DEBUG, '| 按 1/2/3 切换, 0 清除, 需刷新生效');

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; // 不在输入框里触发
      if ((e.target as HTMLElement | null)?.isContentEditable) return;
      const f = loadFlags();
      switch (e.key) {
        case '1': f.noThree = !f.noThree; saveFlags(f); break;
        case '2': f.noVoice = !f.noVoice; saveFlags(f); break;
        case '3': f.noWake  = !f.noWake;  saveFlags(f); break;
        case '0': try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } devLog.log('[debug] all flags cleared'); break;
      }
    };
    window.addEventListener('keydown', onKey);

    // 每 2 秒采样一次，统计 rAF / audio 帧率
    let rAFCount = 0, audioFrameCount = 0;
    const origRAF = window.requestAnimationFrame;
    const wrappedRAF = (cb: FrameRequestCallback) => origRAF.call(window, (t: number) => { rAFCount++; cb(t); });
    window.requestAnimationFrame = wrappedRAF;
    const timer = setInterval(() => {
      if (rAFCount > 0 || audioFrameCount > 0) {
        devLog.debug(`[debug] rAF=${rAFCount}/2s (~${Math.round(rAFCount/2)}fps) audioFrame=${audioFrameCount}/2s`);
        rAFCount = 0; audioFrameCount = 0;
      }
    }, 2000);
    (window as any).__DEBUG_audioFrameInc = () => { audioFrameCount++; };

    return () => {
      window.removeEventListener('keydown', onKey);
      clearInterval(timer);
      // 期间别人又包了一层就不动,免得把别人的包装拆掉
      if (window.requestAnimationFrame === wrappedRAF) window.requestAnimationFrame = origRAF;
      delete (window as any).__DEBUG_audioFrameInc;
    };
  }, []);
}

// 相对时间:刚建的会话显示「刚刚」,让"点了新会话"立刻可见
function relativeTime(iso: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}天前`;
  return new Date(t).toLocaleDateString('zh-CN');
}

// 后端/旧版本给会话起的默认名;还叫这些名字的会话,第一条消息到来时改用消息做标题
const DEFAULT_TITLES = new Set(['新会话', '未命名会话', '(无标题)']);

function conversationTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return '新会话';
  return t.length > 50 ? `${t.slice(0, 50)}…` : t;
}

/** initialRoom:?room=<uid> 串门链接直达那个人的房间 */
export default function ImmersiveDigitalHuman({ initialRoom }: { initialRoom?: string | null } = {}) {
  const router = useRouter();
  useDigitalHumanDebug();
  const { setTheme } = useThemeMode();
  // 修复 hydration mismatch: 等客户端 mount 后再渲染动态内容
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  // VrmStage sinks 引用（用 state 而非 ref，避免首次渲染时 ref.current 还没填的坑）
  const [stageHandle, setStageHandle] = React.useState<VrmStageHandle | null>(null);
  const stageHandleRef = React.useRef<VrmStageHandle | null>(null);
  stageHandleRef.current = stageHandle;
  // H1: 动态 UI(数字员工干活后弹结果面板)
  const [dynamicUI, setDynamicUI] = React.useState<DynamicUI | null>(null);
  // 3D 场景内的 UI 面板:数字人调 ui_show_list/grid/form 时下发,
  // 由 CSS3DRenderer 摆在角色身旁,内容用 portal 渲染进 VrmStage 给的宿主元素
  const [scenePanel, setScenePanel] = React.useState<ScenePanelModel | null>(null);
  const [panelHost, setPanelHost] = React.useState<HTMLDivElement | null>(null);
  // 场景里的显示器(大屏/副屏/竖屏):作品详情、网页、视频都在屏幕上开,页面本身不跳转,
  // 对话和场景不会断。宿主元素由 VrmStage 的 CSS3D 层给,内容 portal 进去。
  const [displayHosts, setDisplayHosts] = React.useState<DisplayHosts | null>(null);
  const [displayPages, setDisplayPages] = React.useState<DisplayPages>({});
  const [displaysOn, setDisplaysOn] = React.useState(() => {
    try { return localStorage.getItem('dh_displays') !== '0'; } catch { return true; }
  });
  const [focusedDisplay, setFocusedDisplay] = React.useState<DisplaySlot | null>(null);
  // 最近打开的那块屏:没有 3D 屏幕可用时(非 VRM 形象 / 手机)只叠这一块在画面上
  const [activeDisplay, setActiveDisplay] = React.useState<DisplaySlot | null>(null);
  // 星光广场(舞台外一整座能逛的广场 + 小玩法);记住用户的选择,默认开
  const [worldOn, setWorldOn] = React.useState(true);
  React.useEffect(() => {
    try { if (localStorage.getItem('dh_world') === '0') setWorldOn(false); } catch { /* 隐私模式 */ }
  }, []);
  const toggleWorld = React.useCallback(() => {
    setWorldOn((on) => {
      try { localStorage.setItem('dh_world', on ? '0' : '1'); } catch { /* ignore */ }
      return !on;
    });
  }, []);
  const [questsOpen, setQuestsOpen] = React.useState(false);
  const plazaStateRef = React.useRef<PlazaState | null>(null);
  // 言出法随:聊天钩子比场景 / 舞台先建,工具事件经这个 ref 转给 useWorldObjects
  const worldToolRef = React.useRef<((e: WorldToolEvent) => void) | null>(null);
  const worldHelp = useWorldHelp();
  const [narrow, setNarrow] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)');
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const openTargetRef = React.useRef<(target: IframeOpenTarget, opts?: { title?: string; slot?: DisplaySlot | null }) => void>(() => {});
  const openOnDisplayRef = React.useRef<(input: string, opts?: { title?: string; slot?: DisplaySlot | null }) => void>(() => {});
  const closeDisplayRef = React.useRef<(slot: DisplaySlot | null) => void>(() => {});
  // 每块屏当前停在哪一页(屏幕里点链接会变),随场景状态上报给模型
  const displayLocRef = React.useRef<Partial<Record<DisplaySlot, { url: string; title: string }>>>({});
  // 场景动作协议:每轮随请求上报给模型的场景快照(只记前端真的执行了的指令)
  const sceneRef = React.useRef<SceneSnapshot>({});
  // 形象:VRM 骨骼模型 / 3DGS 高斯资产 / 2D 片段;三种共用同一套对话、面板、工具日志。
  // 背景:场景预设,或把一份 3DGS 场景资产垫在 VRM 舞台后面(两层各自的相机,暂不联动)。
  const [avatarMode, setAvatarMode] = React.useState<AvatarMode>('vrm');
  const [gsAssets, setGsAssets] = React.useState<GsAssetItem[]>([]);
  const [gsAsset, setGsAsset] = React.useState('');
  const [gsBackdrop, setGsBackdrop] = React.useState('');
  const [speaking, setSpeaking] = React.useState(false);
  // 2D 片段是否真的能播(mp4 不进仓库,没放文件时静态站回退成 index.html)
  const [clipsProblem, setClipsProblem] = React.useState<string | null>('检查中');
  React.useEffect(() => {
    let alive = true;
    probeClips('/avatar/clips.json').then((p) => { if (alive) setClipsProblem(p); });
    return () => { alive = false; };
  }, []);
  React.useEffect(() => {
    const ac = new AbortController();
    authFetch(API_PREFIX + '/api/realtime/assets', { signal: ac.signal }).then((r) => r.json()).then((d) => {
      const list = ((d?.data?.list || []) as { id: string; name: string; mode: string; status: string; active?: boolean; assetUrl?: string }[])
        .filter((a) => a.mode === '3dgs' && a.status === 'ready' && a.assetUrl)
        .map((a) => ({ id: a.id, name: a.name + (a.active ? '(当前)' : ''), assetUrl: a.assetUrl as string }));
      setGsAssets((prev) => [...prev.filter((p) => p.id === 'config'), ...list]);
      const active = list.find((a) => a.name.endsWith('(当前)')) || list[0];
      if (active) setGsAsset((cur) => cur || active.assetUrl);
    }).catch(() => {});
    authFetch(API_PREFIX + '/api/realtime/config', { signal: ac.signal }).then((r) => r.json()).then((d) => {
      const u = d?.data?.assetUrl as string | undefined;
      if (u) {
        setGsAssets((prev) => (prev.some((a) => a.assetUrl === u) ? prev : [{ id: 'config', name: '默认资产', assetUrl: u }, ...prev]));
        setGsAsset((cur) => cur || u);
      }
    }).catch(() => {});
    return () => ac.abort();
  }, []);
  // 选哪个数字员工对话(worker / frontend / … / builder / 自定义):以前写死 worker,builder 根本没法从这里用
  const [staffList, setStaffList] = React.useState<{ agentId: string; name: string; description: string }[]>([]);
  const [aguiAgent, setAguiAgent] = React.useState('worker');
  React.useEffect(() => {
    const ac = new AbortController();
    fetch(API_PREFIX + '/api/agentmanager/multi-agent/staff', { signal: ac.signal }).then((r) => r.json()).then((d) => setStaffList(d.agents || [])).catch(() => {});
    return () => ac.abort();
  }, []);
  // 002:全屏页体现多会话能力(放在 chat 之前:发第一条消息建会话后要刷新它)
  const { history, loading: historyLoading, error: historyError, refresh: refreshHistory } = useConversationHistory(20);
  const [sessionError, setSessionError] = React.useState<string | null>(null);
  const chat = useChatAvatarWS(undefined, {
    // G1: 数字人走 agentmanager 的数字员工(AG-UI),形象/动作仍由 dispatcher 驱动
    useAgui: true,
    // 还没有服务端会话就直接提问:先建一个(用这条消息当标题),对话才会落库、出现在列表里
    ensureConversation: async (firstText) => {
      try {
        const conv = await createConversation(conversationTitle(firstText));
        setSessionError(null);
        refreshHistory();
        return String(conv.id);
      } catch (e) {
        setSessionError(e instanceof Error ? e.message : '创建会话失败');
        return null;
      }
    },
    aguiAgent,
    getSceneState: () => buildSceneState({
      ...sceneRef.current,
      displays: Object.fromEntries(DISPLAY_SLOTS.map((sl) => {
        const loc = displayLocRef.current[sl];
        return [sl, loc ? { name: DISPLAY_SPECS[sl].label, ...loc } : null];
      })),
      plaza: plazaStateRef.current,
    }),
    // H1: 接收动态 UI 指令并渲染;I1: iframe 指令走独立显示器
    onUI: (ui: any) => {
      // I1: iframe 指令 → 统一解析器产出目标, 弹显示器
      const target = parseIframeUI(ui);
      if (target) {
        openTargetRef.current(target, { title: ui.title, slot: parseSlot(ui.screen) });
        return;
      }
      setDynamicUI(ui as DynamicUI);
    },
    // 生成式 UI:数字人把列表/网格/表单推到 3D 场景面板
    onScenePanel: (panel) => setScenePanel(panel),
    onWorldTool: (e) => worldToolRef.current?.(e),
    // 数字人自己往屏幕上放东西 / 关屏(screen_open / screen_close)
    onScreen: (cmd) => {
      const slot = parseSlot(cmd.screen);
      if (cmd.op === 'close') {
        closeDisplayRef.current(slot);
        return;
      }
      const href = cmd.url || (cmd.id && cmd.contentType ? contentHref({ id: cmd.id, contentType: cmd.contentType.toUpperCase(), title: cmd.title || '' }) : null);
      if (href) openOnDisplayRef.current(href, { title: cmd.title, slot });
    },
    // 一轮话念完:表情慢慢回到自然状态,不要带着最后一句的表情僵在那
    onSpeechEnd: () => stageHandleRef.current?.setEmotion({}),
    onToolCalls: (calls) => {
      // I1.2: 数字人/用户要看网页或视频 → 弹统一显示器 (工具兜底, 与 <ui:iframe/> 指令同源)
      // 注意: 必须先于 stageHandle 早退处理, 否则 stage 未就绪时网页/视频指令被丢弃
      for (const c of calls as unknown as DhToolCall[]) {
        const target = iframeToolToTarget(c);
        if (target) openTargetRef.current(target, { slot: parseSlot((c.params || c.args)?.screen) });
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
      sceneRef.current = applyDispatchResults(sceneRef.current, results);
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
  // ── 场景显示器 ──────────────────────────────────────────────────────────
  // 以前点作品是 window.open(…,'noopener'):这种调用永远返回 null,于是「新标签 + 当前页也跳走」
  // 两件事一起发生 —— 对话没了,新标签里又没有历史可退。现在一律在场景里的屏幕上开。
  const openPage = React.useCallback((page: DisplayPage, slot: DisplaySlot) => {
    displayLocRef.current[slot] = { url: page.rawUrl, title: page.title || '' };
    setDisplayPages((prev) => ({ ...prev, [slot]: page }));
    setDisplaysOn(true);
    setActiveDisplay(slot);
    setFocusedDisplay(slot); // 镜头凑过去:屏幕在全景里太小,点开就是想看
    setSessionDrawerOpen(false); // 会话列表会挡住左边的大屏
  }, []);
  const openTarget = React.useCallback((target: IframeOpenTarget, opts: { title?: string; slot?: DisplaySlot | null } = {}) => {
    const page = pageFromTarget(target, opts.title);
    openPage(page, opts.slot || slotForUrl(page.rawUrl));
  }, [openPage]);
  const openOnDisplay = React.useCallback((input: string, opts: { title?: string; slot?: DisplaySlot | null } = {}) => {
    const url = resolveDisplayInput(input);
    const site = toSitePath(url);
    if (site) {
      if (site.startsWith('/digital-human')) return; // 屏幕里再开一个数字人页面就套娃了
      openPage(sitePage(site, opts.title), opts.slot || slotForUrl(site));
    } else {
      openTarget(resolveIframeUrl({ url }), opts);
    }
  }, [openPage, openTarget]);
  const closeDisplay = React.useCallback((slot: DisplaySlot | null) => {
    setDisplayPages((prev) => {
      if (!slot) return {};
      const next = { ...prev };
      delete next[slot];
      return next;
    });
    if (slot) delete displayLocRef.current[slot];
    else displayLocRef.current = {};
    setFocusedDisplay((cur) => (!slot || cur === slot ? null : cur));
  }, []);
  // 把页面挪到下一块屏(大屏 → 副屏 → 竖屏 → 大屏)
  const moveDisplay = React.useCallback((from: DisplaySlot, currentUrl: string) => {
    const to = DISPLAY_SLOTS[(DISPLAY_SLOTS.indexOf(from) + 1) % DISPLAY_SLOTS.length];
    closeDisplay(from);
    openOnDisplay(currentUrl, { slot: to });
  }, [closeDisplay, openOnDisplay]);
  // chat hook 的回调在这些函数之前创建,经 ref 调用
  openTargetRef.current = openTarget;
  openOnDisplayRef.current = openOnDisplay;
  closeDisplayRef.current = closeDisplay;
  const openContent = React.useCallback((href: string) => openOnDisplay(href), [openOnDisplay]);
  const { chatBusy, chatLog, emotion, viseme, action, send, sendText, audioRef,
    text, setText, conversationId, switchConversation,
    loadConversationMessages, setEmotion, setViseme, setChatLog, thinkingLog } = chat;
  // 文本标签 <action:x/> 驱动的动作、面板、内嵌浏览器也要进快照,模型下一轮才看得到
  React.useEffect(() => { sceneRef.current.action = action || 'idle'; }, [action]);
  React.useEffect(() => { sceneRef.current.panel = scenePanel ? { kind: scenePanel.kind, title: scenePanel.title } : null; }, [scenePanel]);
  React.useEffect(() => { sceneRef.current.model = avatarMode; }, [avatarMode]);
  // 换到非 VRM 形象时 VrmStage 卸载,handle 失效
  React.useEffect(() => { if (avatarMode !== 'vrm') setStageHandle(null); }, [avatarMode]);
  // 2D 片段的说话状态:TTS 的 <audio> 在放就是 speaking(500ms 轮询,不依赖元素何时挂上)
  React.useEffect(() => {
    const id = window.setInterval(() => {
      const a = audioRef.current;
      setSpeaking(!!a && !a.paused && !a.ended);
    }, 500);
    return () => window.clearInterval(id);
  }, [audioRef]);
  const speakState: AvatarSpeakState = speaking ? 'speaking' : chatBusy ? 'thinking' : 'idle';
  // 会话列表:宽屏默认展开,手机默认收起(否则挡住形象),顶部按钮切换
  const [sessionDrawerOpen, setSessionDrawerOpen] = React.useState(
    () => typeof window === 'undefined' || window.matchMedia('(min-width: 900px)').matches,
  );
  // 诊断：监听 stageHandle 变化
  React.useEffect(() => { devLog.debug('[Immersive] stageHandle 变化:', stageHandle); }, [stageHandle]);

  // 有面板就让 3D 面板层可见,没有就收起来
  React.useEffect(() => {
    stageHandle?.setScenePanelVisible(!!scenePanel);
  }, [stageHandle, scenePanel]);

  // 3D 屏幕只在 VRM 形象 + 宽屏时可用;其余情况把最近打开的那一页叠在画面上
  const displaysInScene = avatarMode === 'vrm' && !narrow && !!displayHosts;
  React.useEffect(() => {
    try { localStorage.setItem('dh_displays', displaysOn ? '1' : '0'); } catch { /* 隐私模式 */ }
    if (!displaysOn) setFocusedDisplay(null);
  }, [displaysOn]);
  React.useEffect(() => {
    stageHandle?.setDisplaysVisible(displaysOn && displaysInScene);
  }, [stageHandle, displaysOn, displaysInScene]);
  React.useEffect(() => {
    stageHandle?.focusDisplay(displaysInScene ? focusedDisplay : null);
  }, [stageHandle, focusedDisplay, displaysInScene]);
  // Esc 退回全景
  React.useEffect(() => {
    if (!focusedDisplay) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocusedDisplay(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedDisplay]);
  const renderDisplay = (slot: DisplaySlot, overlay: boolean) => (
    <SceneDisplay
      slot={slot}
      page={displayPages[slot] ?? null}
      focused={focusedDisplay === slot}
      overlay={overlay}
      onOpen={(input) => openOnDisplay(input, { slot })}
      onClose={() => closeDisplay(slot)}
      onFocus={(on) => setFocusedDisplay(on ? slot : null)}
      onMove={overlay ? undefined : (url) => moveDisplay(slot, url)}
      onLocation={(info) => { if (displayLocRef.current[slot]) displayLocRef.current[slot] = info; }}
    />
  );

  // 开发期调试:控制台 __showScenePanel({...}) 直接弹一块面板,
  // 不用真的跑通「LLM → 工具调用 → SSE」整条链路就能调面板样式/交互。
  // 与文件顶部 __DIGITAL_HUMAN_DEBUG / __vrmStageHandle 同一套调试口子。
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return;
    (window as any).__showScenePanel = (p: ScenePanelModel | null) => setScenePanel(p);
    return () => { delete (window as any).__showScenePanel; };
  }, []);

  // 把 TTS 用的 <audio> 接到舞台分析器上 —— 说话时的口型才会跟着真实语音走,
  // 而不是按「每字 150ms」硬猜。两者本来在两个不同的 audio 元素上,分析器听不到 TTS。
  React.useEffect(() => {
    const el = audioRef.current;
    if (!stageHandle || !el) return;
    stageHandle.connectAudioElement(el);
  }, [stageHandle, audioRef]);
  const [panelOpen, setPanelOpen] = React.useState(false);
  // 只有最新一组快捷选项还能点,而且得是这一轮的(后面用户又说过话就作废)
  let lastChoicesIndex = -1;
  for (let i = chatLog.length - 1; i >= 0 && chatLog[i].who !== 'user'; i--) {
    if (chatLog[i].who === 'choices') {
      lastChoicesIndex = i;
      break;
    }
  }
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

  // 002:点击"新会话" → 先调后端创建空会话(立即出现在列表),再切换过去。
  // 失败要让用户看见:以前悄悄退回本地会话,之后的对话既不落库也不进列表。
  const [creatingSession, setCreatingSession] = React.useState(false);
  const handleNewConversation = async () => {
    if (creatingSession) return;
    setCreatingSession(true);
    try {
      const conv = await createConversation('新会话');
      setSessionError(null);
      switchConversation?.(String(conv.id)); // 切到新会话(清空 chatLog)
      refreshHistory();                        // 刷新列表,新会话立即出现
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : '创建会话失败');
    } finally {
      setCreatingSession(false);
    }
  };

  // 点历史会话:切过去并加载它的消息(之前只切 id,聊天区一直是空的)
  const openConversation = (cid: string) => {
    if (cid === conversationId) return;
    switchConversation?.(cid);
    loadConversationMessages?.(cid);
  };

  // 003:发消息后更新会话标题(第一条用户消息前50字)
  // 需要 realtime-api 部署后支持 PUT /conversations/:id 路由
  const updateConversationTitle = React.useCallback(async (convId: string, title: string) => {
    if (!isServerConversationId(convId)) return;
    // 只给还叫默认名的会话起标题,别每条消息都把标题改成最新一句
    const item = history.find((h) => h.id === convId);
    if (!item || !DEFAULT_TITLES.has(item.title)) return;
    try {
      await renameConversation(convId, conversationTitle(title));
      refreshHistory(); // 标题变了就刷新列表
    } catch (e) {
      devLog.warn('[updateTitle] error:', e);
    }
  }, [history, refreshHistory]);

  // 监听 chatLog 变化,在发送第一条用户消息后更新标题
  const prevChatLogLenRef = React.useRef(0);
  React.useEffect(() => {
    const currentLen = chatLog.length;
    if (currentLen > prevChatLogLenRef.current) {
      // 有新消息加入 chatLog,找到新增的用户消息
      const added = chatLog.slice(prevChatLogLenRef.current);
      const firstUserMsg = added.find((m) => m.who === 'user');
      if (firstUserMsg && isServerConversationId(conversationId)) {
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

  // 创世:每人一间房、捏人(房间是场景列表里 kind = room 的那几个)
  const genesis = useGenesis({ enabled: avatarMode === 'vrm' && worldOn });
  // 场景与人物(后台 /system/plaza 维护):星光广场 + 感悟庭院…… + 我的房间 / 串门去过的房间
  const scenes = usePlazaScenes(avatarMode === 'vrm' && worldOn, genesis.room.defs);
  const goHome = React.useCallback(() => {
    const m = genesis.room.mine;
    if (m) scenes.switchTo(`room:${m.ownerId}`);
    else void genesis.room.reload().then((r) => r && scenes.switchTo(`room:${r.ownerId}`));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genesis.room.mine, scenes.switchTo]);
  // ?room=<uid>:进来就去那个人的房间(一次)
  const initialRoomDoneRef = React.useRef(false);
  React.useEffect(() => {
    if (!initialRoom || initialRoomDoneRef.current || !genesis.room.mine) return;
    initialRoomDoneRef.current = true;
    genesis.room.enter(initialRoom).then((k) => scenes.switchTo(k)).catch((e) => {
      // 没开放 / 不存在:留在原地,提示一句(game 还没建好,用浏览器原生提示太吵,只记日志)
      devLog.warn('[genesis] 串门失败', e);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoom, genesis.room.mine]);

  // 广场玩法:经验/任务记账 + 角色反应 + 地标互动
  const confettiTimerRef = React.useRef<number | null>(null);
  const game = useWorldGame({
    def: scenes.def,
    handle: stageHandle,
    sendText: (t) => { void sendText(t); },
    setDancing: (on) => updateStageState({ dancing: on }),
    dancing: stageState.dancing,
    celebrate: () => {
      updateStageState({ confetti: true });
      if (confettiTimerRef.current) window.clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = window.setTimeout(() => updateStageState({ confetti: false }), 4000);
    },
    busy: chatBusy,
  });
  React.useEffect(() => () => { if (confettiTimerRef.current) window.clearTimeout(confettiTimerRef.current); }, []);
  // 「和她聊 3 句」:用户消息每多一条记一次(切到旧会话一次性载入很多条,不算)
  const userMsgCountRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const n = chatLog.filter((m) => m.who === 'user').length;
    const prev = userMsgCountRef.current;
    userMsgCountRef.current = n;
    if (prev !== null && n === prev + 1) game.record({ kind: 'chat' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatLog]);
  const worldActive = avatarMode === 'vrm' && worldOn;
  // 写实画风的场景里换成写实形象(Blender 流水线生成的真人 + 汉服);回到风格化场景用回自己选的形象
  const realEnv = worldActive ? worldEnv(scenes.def) : null;
  const realAvatarUrl = realEnv?.style === 'realistic' ? mediaUrl((realEnv.assets || WORLD_ASSET_BASE) + '/avatars/real_f01.vrm') : null;

  // 广场联网:谁在广场、许愿墙、祝福、光环;许愿/祝福会在服务端记平台每日任务
  const [tasksKey, setTasksKey] = React.useState(0);
  // 七期:广场也走房间集线器;已经在集线器里的人,心跳那边不再画成人影
  const hubPeersRef = React.useRef<Set<string>>(new Set());
  const online = usePlazaOnline({
    handle: stageHandle,
    // 房间里的人走创世的多人同步(useRoomSocket),不再发广场心跳,免得同一个人画两遍
    enabled: worldActive && scenes.def.kind !== 'room',
    toast: (icon, t) => game.toast(icon, t),
    sceneKey: scenes.def.key,
    exclude: () => hubPeersRef.current,
    onWished: () => { game.record({ kind: 'interact', zone: 'wish' }); setTasksKey((k) => k + 1); },
    onBlessed: () => setTasksKey((k) => k + 1),
  });
  // 言出法随:摆放、现做进度、换场景(过场)
  const [travel, setTravel] = React.useState<string | null>(null);
  const worldObjects = useWorldObjects({
    handle: stageHandle,
    enabled: worldActive,
    def: scenes.def,
    defs: scenes.defs,
    switchTo: scenes.switchTo,
    toast: (icon, t) => game.toast(icon, t),
    onTravel: (name) => { setTravel(name); window.setTimeout(() => setTravel(null), 2600); },
  });
  worldToolRef.current = worldObjects.handleTool;
  // 创世二期:房间里的多人同步(同伴的真形象、位置、说话、别人改的摆放)
  const roomSock = useRoomSocket({
    handle: stageHandle,
    def: scenes.def,
    enabled: worldActive,
    applyEdit: worldObjects.applyRemote,
    applyRoom: genesis.room.applyRemote,
    onKick: (msg) => { game.toast('🚪', msg); goHome(); },
    toast: (icon, t) => game.toast(icon, t),
  });
  hubPeersRef.current = new Set(roomSock.status === 'open' ? roomSock.peers.map((p) => p.id) : []);
  // 创世四期:房间语音(真人开麦走房间连接;AI 的话服务端合成后也从这条连接来)
  const roomVoice = useRoomVoice({ rs: roomSock, handle: stageHandle, toast: (icon, t) => game.toast(icon, t) });
  function roomStateOf() {
    const d = scenes.def;
    const b = roomBounds(d) ?? { hx: 5, hz: 4 };
    const snap = stageHandleRef.current?.getWorldSnapshot();
    const r1 = (v: number) => Math.round(v * 10) / 10;
    return {
      name: d.name,
      owner: d.room?.ownerName ?? '',
      mine: !!d.room?.mine,
      template: d.room?.template ?? 'study',
      size: [b.hx * 2, b.hz * 2] as [number, number],
      me: { x: r1(snap?.x ?? 0), z: r1(snap?.z ?? 0) },
      objects: worldObjects.items.slice(0, 40).map((p) => ({ id: p.id, label: p.label || p.asset?.nameZh || p.assetKey, x: r1(p.x), z: r1(p.z), deg: Math.round((p.rotY * 180) / Math.PI) % 360, ...(p.scale && p.scale !== 1 ? { scale: r1(p.scale) } : {}) })),
      people: roomSock.peers.slice(0, 20).map((p) => ({ name: p.nickname, x: r1(p.x), z: r1(p.z), ...(p.owner ? { owner: true } : {}), ...(p.ai ? { ai: true } : {}) })),
    };
  }
  // 发给模型的场景状态里带上广场信息(她在哪个地标、有几个人在逛),模型能据此接话
  plazaStateRef.current = worldActive ? {
    placed: worldObjects.placedSummary,
    scenes: scenes.defs.map((d) => `${d.key}:${d.name}`),
    scene: scenes.def.name,
    zone: game.zone,
    zoneLabel: game.zoneInfo?.label,
    landmarks: scenes.def.zones.map((z) => `${z.id}:${z.label}`),
    characters: scenes.characters.map((c) => [c.title, c.name].filter(Boolean).join('·')).filter(Boolean),
    online: online.online,
    level: game.level.level,
    orbsTotal: game.state.orbsTotal,
    // 创世三期:在房间里时,房间的结构化状态(数字人据此看懂房间,world_place / world_edit / room_design 用坐标和 id)
    ...(scenes.def.kind === 'room' && scenes.def.room ? { room: roomStateOf() } : {}),
  } : null;
  // 地标内容面板:走进地标自动展开,可以手动收起(离开再进来会重新展开)
  const [panelZone, setPanelZone] = React.useState<string | null>(null);
  React.useEffect(() => { setPanelZone(game.zone); }, [game.zone]);
  const panelZoneInfo = panelZone && game.zoneInfo?.id === panelZone && zoneFeed(game.zoneInfo) !== 'none' ? game.zoneInfo : null;

  // 人物:点他或走到他跟前就打开对话面板;第一次和某人说话记「和人物说说话」任务
  const [charId, setCharId] = React.useState<string | null>(null);
  const talkedRef = React.useRef(new Set<string>());
  const openCharacter = React.useCallback((id: string) => {
    setCharId(id);
    if (!talkedRef.current.has(id)) { talkedRef.current.add(id); game.record({ kind: 'talk', character: id }); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const currentChar = charId ? scenes.characters.find((c) => c.id === charId) ?? null : null;
  const onWorldEvent = React.useCallback((e: WorldEvent) => {
    if (genesis.onWorldEvent(e)) return;
    if (e.type === 'character') { openCharacter(e.id); return; }
    if (e.type === 'nearCharacter') { if (e.id) openCharacter(e.id); return; }
    game.onWorldEvent(e);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCharacter, game.onWorldEvent]);

  // 画质:手机默认流畅,桌面默认高;记在本机
  const [worldQuality, setWorldQuality] = React.useState<'high' | 'low'>('high');
  React.useEffect(() => {
    let q: 'high' | 'low' = window.matchMedia('(max-width: 899px)').matches ? 'low' : 'high';
    try { const saved = localStorage.getItem('dh_world_quality'); if (saved === 'high' || saved === 'low') q = saved; } catch { /* 隐私模式 */ }
    setWorldQuality(q);
  }, []);
  // 设备性能门槛:每次进来都现场检测 —— 快检(没有 WebGL2 / 软件渲染 / 内存或 CPU 太弱)+ 进门后量帧率,跑不动就拦(perfGate.ts)
  const [gate, setGate] = React.useState<GateVerdict | null>(null);
  React.useEffect(() => {
    const v = quickCheck();
    if (v.blocked) setGate(v);
  }, []);
  const fpsGate = useFpsGate({
    enabled: avatarMode === 'vrm' && !gate,
    quality: worldQuality,
    setQuality: (q) => { setWorldQuality(q); try { localStorage.setItem('dh_world_quality', q); } catch { /* ignore */ } },
    onDegrade: () => game.toast('⚙️', '设备有点吃力,已自动切到流畅画质'),
  });
  const blockedBy = gate ?? fpsGate.verdict;
  const toggleQuality = () => setWorldQuality((q) => {
    const n = q === 'high' ? 'low' : 'high';
    try { localStorage.setItem('dh_world_quality', n); } catch { /* ignore */ }
    return n;
  });
  // 时辰:默认跟场景,点按钮在 清晨 → 白天 → 黄昏 → 夜晚 → 跟随现在 之间轮换
  const [worldTime, setWorldTime] = React.useState<TimeMode | null>(null);
  const currentTime = (worldTime ?? worldEnv(scenes.def).time) as TimeMode;
  const cycleTime = () => {
    const order: TimeMode[] = ['dawn', 'day', 'dusk', 'night', 'auto'];
    const next = order[(order.indexOf(currentTime) + 1) % order.length];
    setWorldTime(next);
    game.toast(next === 'night' ? '🌙' : next === 'auto' ? '🕰️' : '☀️', TIME_LABELS[next]);
  };

  // 换场景:中央舞台换成场景指定的预设,角色回到舞台前
  const [scenePickerOpen, setScenePickerOpen] = React.useState(false);
  const lastSceneRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!worldActive) return;
    const d = scenes.def;
    if (lastSceneRef.current === d.key) return;
    const first = lastSceneRef.current === null;
    lastSceneRef.current = d.key;
    setWorldTime(null);
    setCharId(null);
    setPanelZone(null);
    if ((SCENE_PRESETS as string[]).includes(d.stage)) updateStageState({ scene: d.stage as ScenePresetName });
    if (!first) {
      stageHandleRef.current?.enterScene();
      game.toast(d.kind === 'insight' ? '🌙' : '✨', `来到「${d.name}」`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes.def.key, worldActive]);
  const [auraShopOpen, setAuraShopOpen] = React.useState(false);
  const onFeedAction = React.useCallback((a: FeedAction, feed: ZoneFeed | null) => {
    if (a.kind === 'play') {
      const n = playTracks(feed?.tracks?.length ? feed.tracks : [{ id: a.trackId }], { startId: a.trackId, source: { kind: 'playlist', name: '广场点唱机' } });
      if (n > 0) { stageHandleRef.current?.setAction('groove'); stageHandleRef.current?.floatText('🎵', '#ffb74f'); }
      return;
    }
    openOnDisplayRef.current(a.href, { slot: a.slot ?? null });
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
    asrGatewayUrl: `${API_PREFIX}/api/audio`,
    onCommand: async (text) => {
      if (chat.isSpeaking()) chat.cancel()
      await sendText(text)
    },
    isAvatarSpeaking: () => chat.isSpeaking(),
    onInterrupt: () => chat.cancel(),
  })

  // 跑不动:整页换成拦截页,3D 舞台不挂载(不再吃显卡)
  if (blockedBy) {
    return (
      <PerfBlockScreen
        reason={blockedBy.reason}
        detail={blockedBy.detail}
        onBack={() => router.push('/')}
        onRetry={() => {
          fpsGate.reset();
          const v = quickCheck();
          setGate(v.blocked ? v : null);
        }}
      />
    );
  }
  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1, background: '#05060B' }}>
      {/* 换场景的过场:黑底淡入「前往 X」,新场景建好后淡出 */}
      <Box sx={{
        position: 'absolute', inset: 0, zIndex: 50, pointerEvents: travel ? 'auto' : 'none',
        bgcolor: '#05060B', opacity: travel ? 1 : 0, transition: 'opacity 0.6s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1.5,
      }}>
        <Box sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 22, letterSpacing: 6 }}>{travel ? `前往 · ${travel}` : ''}</Box>
        <Box sx={{ width: 160, height: 2, bgcolor: 'rgba(255,255,255,0.12)', overflow: 'hidden', borderRadius: 1 }}>
          <Box sx={{ width: '40%', height: '100%', bgcolor: 'rgba(255,220,160,0.8)', animation: travel ? 'dhTravel 1.2s ease-in-out infinite' : 'none',
            '@keyframes dhTravel': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(250%)' } } }} />
        </Box>
      </Box>
      {/* 全屏 VRM 角色（与浮窗同一个 character.vrm） — 用 VrmStage 替代 BlenderAvatar */}
      {/* 背景层:一份 3DGS 场景资产垫在 VRM 舞台后面(orbit 关掉,当静态布景) */}
      {avatarMode === 'vrm' && gsBackdrop && (
        <GaussianSplatRenderer
          assetUrl={`${gsBackdrop}/gaussians.bin`}
          metaUrl={`${gsBackdrop}/meta.json`}
          orbitControls={false}
          background="#05060B"
          sx={{ position: 'absolute', inset: 0, zIndex: 0 }}
        />
      )}
      {avatarMode === 'vrm' && (
        <VrmStage
          onReady={(h) => { devLog.debug('[Immersive] onReady 被调用, h=', h); setStageHandle(h); }}
          modelUrl={(worldActive ? genesis.avatarUrl : null) ?? realAvatarUrl ?? selectedModel?.url ?? '/avatars/character.vrm'}
          worldEditing={worldActive && genesis.editing}
          avatarParams={worldActive ? genesis.avatarParams : null}
          onAvatarLoaded={genesis.avatar.setInfo}
          currentAction={action}
          emotion={emotion}
          viseme={viseme}
          autoBlink={stageState.autoBlink}
          lookAtCamera={stageState.lookAtCamera}
          onScenePanelHost={setPanelHost}
          onDisplayHosts={setDisplayHosts}
          world={worldOn}
          worldDef={scenes.def}
          characters={scenes.characters}
          worldQuality={worldQuality}
          worldTime={worldTime}
          onWorldEvent={onWorldEvent}
          transparentBackground={!!gsBackdrop}
          background={gsBackdrop ? 'transparent' : undefined}
          sx={{ position: 'absolute', inset: 0, zIndex: 1 }}
        />
      )}
      {/* 3DGS 形象:可驱动高斯资产(pose / 表情驱动走 WS 通道,这里先做静态展示) */}
      {avatarMode === '3dgs' && gsAsset && (
        <GaussianSplatRenderer
          assetUrl={`${gsAsset}/gaussians.bin`}
          skinningUrl={`${gsAsset}/skinning.bin`}
          smplxUrl={`${gsAsset}/smplx.json`}
          metaUrl={`${gsAsset}/meta.json`}
          sx={{ position: 'absolute', inset: 0 }}
        />
      )}
      {/* 2D 形象:片段表按 说话/思考/动作 切视频 */}
      {avatarMode === '2d' && <ClipAvatar state={speakState} action={action} />}

      {/* 3D 场景内的 UI 面板:CSS3D 把这块 DOM 摆到角色身旁(跟着走、随相机转),
          内容是真 DOM,所以列表能点、表单能填。点/提交都会回灌成新一轮对话。 */}
      {panelHost && scenePanel && createPortal(
        <ScenePanel
          // key 绑到面板 id:换一块面板要重挂组件,否则上一张表单填的值会留在新表单里
          key={scenePanel.id}
          panel={scenePanel}
          onClose={() => setScenePanel(null)}
          onSend={(t) => {
            setScenePanel(null);
            void sendText(t);
          }}
          onOpen={openContent}
        />,
        panelHost,
      )}
      {/* 非 VRM 形象没有 3D 面板宿主:面板直接叠在画面右侧 */}
      {!panelHost && scenePanel && (
        <Box sx={{ position: 'absolute', right: { xs: 12, md: 24 }, top: 'calc(64px + var(--sat, 0px))', zIndex: 4, width: { xs: 'calc(100vw - 24px)', md: 'min(420px, 90vw)' } }}>
          <ScenePanel
            key={scenePanel.id}
            panel={scenePanel}
            onClose={() => setScenePanel(null)}
            onSend={(t) => { setScenePanel(null); void sendText(t); }}
            onOpen={openContent}
          />
        </Box>
      )}

      {/* 场景里的显示器:每块屏的内容 portal 进 CSS3D 层给的宿主元素 */}
      {displaysInScene && displayHosts && DISPLAY_SLOTS.map((slot) => {
        const host = displayHosts[slot];
        return host ? createPortal(renderDisplay(slot, false), host, slot) : null;
      })}
      {/* 没有 3D 屏幕可用(非 VRM 形象 / 手机):最近打开的那一页叠在画面上半部分 */}
      {!displaysInScene && activeDisplay && displayPages[activeDisplay] && (
        <Box sx={{
          position: 'absolute', zIndex: 4, top: 'calc(64px + var(--sat, 0px))', right: { xs: 12, md: 24 }, left: { xs: 12, md: 'auto' },
          width: { md: 'min(640px, 50vw)' }, height: 'calc(100vh - min(40vh, 400px) - 84px)', minHeight: 240,
          borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(37,244,238,0.3)', boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}>
          {renderDisplay(activeDisplay, true)}
        </Box>
      )}

      {/* 顶部:退出按钮 + 模型选择 + 会话列表切换 + 控制台切换 */}
      <IconButton
        onClick={() => router.back()}
        size="medium"
        aria-label="退出"
        sx={{
          position: 'absolute',
          top: 'calc(12px + var(--sat, 0px))',
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
            top: 'calc(12px + var(--sat, 0px))',
            // 手机上会话按钮在 left:60,模型选择器排在它右边,不叠在一起
            left: { xs: 108, sm: 60 },
            zIndex: 3,
            minWidth: { xs: 0, sm: 120 },
            maxWidth: { xs: 'calc(100vw - 220px)', sm: 'none' }, // 右边让出广场开关 + 控制台两个按钮
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
          top: 'calc(12px + var(--sat, 0px))',
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
      {avatarMode === 'vrm' && (
        <IconButton
          onClick={toggleWorld}
          size="medium"
          aria-label={worldOn ? '收起星光广场' : '打开星光广场'}
          title={worldOn ? '收起星光广场(回到小舞台)' : '打开星光广场'}
          sx={{
            position: 'absolute',
            top: 'calc(12px + var(--sat, 0px))',
            right: narrow ? 60 : 108,
            zIndex: 3,
            color: worldOn ? '#9dffcb' : 'rgba(255,255,255,0.85)',
            bgcolor: worldOn ? 'rgba(157,255,203,0.15)' : 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            '&:hover': { bgcolor: 'rgba(157,255,203,0.2)' },
          }}
        >
          <ParkRoundedIcon />
        </IconButton>
      )}
      {avatarMode === 'vrm' && !narrow && (
        <IconButton
          onClick={() => setDisplaysOn((o) => !o)}
          size="medium"
          aria-label={displaysOn ? '收起场景里的屏幕' : '显示场景里的屏幕'}
          title={displaysOn ? '收起场景里的屏幕' : '显示场景里的屏幕'}
          sx={{
            position: 'absolute',
            top: 'calc(12px + var(--sat, 0px))',
            right: 60,
            zIndex: 3,
            color: displaysOn ? '#25F4EE' : 'rgba(255,255,255,0.85)',
            bgcolor: displaysOn ? 'rgba(37,244,238,0.15)' : 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            '&:hover': { bgcolor: 'rgba(37,244,238,0.2)' },
          }}
        >
          <TvRoundedIcon />
        </IconButton>
      )}
      <IconButton
        onClick={() => setPanelOpen((o) => !o)}
        size="medium"
        aria-label="舞台控制台"
        sx={{
          position: 'absolute',
          top: 'calc(12px + var(--sat, 0px))',
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

      {/* 星光广场 HUD:顶部等级/任务/提示,右侧小地图,走进地标弹互动卡 */}
      {/* 广场 HUD 出错只丢 HUD,不能把整页(对话、语音)带崩 */}
      {worldActive && (
        <ErrorBoundary fallback={<></>}>
          <Box sx={{
            position: 'absolute', zIndex: 3, left: '50%', transform: 'translateX(-50%)',
            // 手机顶栏两边都是按钮,放到第二行
            top: narrow ? 'calc(62px + var(--sat, 0px))' : 'calc(12px + var(--sat, 0px))',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, pointerEvents: 'none',
          }}>
            <GameStatusBar game={game} compact={narrow} questsOpen={questsOpen} onToggleQuests={() => setQuestsOpen((o) => !o)} />
            {questsOpen && (
              <QuestPanel game={game}>
                <PlatformTasks refreshKey={tasksKey} onPoints={(t) => game.toast('🪙', t)} />
              </QuestPanel>
            )}
            <GameToasts game={game} />
          </Box>
          {/* 手机上叠着打开的页面、或任务清单展开时让位 */}
          {!(!displaysInScene && activeDisplay && displayPages[activeDisplay]) && !(narrow && questsOpen) && !genesis.editing && !genesis.settingsOpen && (
            <Box sx={{
              position: 'absolute', zIndex: 3, right: { xs: 12, md: 16 },
              top: narrow ? 'calc(112px + var(--sat, 0px))' : 'calc(68px + var(--sat, 0px))',
              display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center',
            }}>
              <ButtonBase
                onClick={() => setScenePickerOpen(true)}
                aria-label="换场景"
                sx={{ px: 1.25, py: 0.4, borderRadius: 999, bgcolor: 'rgba(8,10,20,0.62)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 12, fontWeight: 700, maxWidth: narrow ? 104 : 156 }}
              >
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🧭 {scenes.def.name}</Box>
              </ButtonBase>
              <GenesisHud g={genesis} def={scenes.def} onGoHome={goHome} narrow={narrow} />
              <Minimap handle={stageHandle} size={narrow ? 104 : 156} def={scenes.def} />
              <WorldTools game={game} onHelp={worldHelp.show} timeLabel={TIME_LABELS[currentTime]} onTime={cycleTime} quality={worldQuality} onQuality={toggleQuality} onShop={() => setAuraShopOpen((o) => !o)} shopOpen={auraShopOpen} />
              {auraShopOpen && (
                <AuraShop
                  onClose={() => setAuraShopOpen(false)}
                  onChanged={(msg) => { game.toast('✨', msg); online.refreshAura(); setTasksKey((k) => k + 1); }}
                />
              )}
            </Box>
          )}
          {/* 地标内容:桌面在左侧(会话列表开着时让到它右边),手机是聊天区上方的一块 */}
          {(currentChar || panelZoneInfo) && (
            <Box sx={narrow ? {
              position: 'absolute', zIndex: 4, left: 12, right: 12,
              bottom: 'calc(min(46vh, 460px) + 72px)', maxHeight: '30vh', display: 'flex',
            } : {
              position: 'absolute', zIndex: 3, left: sessionDrawerOpen ? 292 : 16,
              top: 'calc(64px + var(--sat, 0px))', maxHeight: 'calc(100vh - min(40vh, 400px) - 90px)', display: 'flex',
            }}>
              {currentChar ? (
                <CharacterPanel
                  key={currentChar.id + currentChar.name}
                  character={currentChar}
                  themeName={scenes.def.zones.find((z) => z.themeKey && z.themeKey === currentChar.themeKey)?.label}
                  width={narrow ? '100%' : 340}
                  onClose={() => setCharId(null)}
                  onOpen={(href, slot) => openOnDisplayRef.current(href, { slot: slot ?? null })}
                  onAskHer={(t) => { void sendText(t); }}
                  onSay={(t) => stageHandleRef.current?.characterSay(currentChar.id, t)}
                  onOpenScenes={() => setScenePickerOpen(true)}
                />
              ) : panelZoneInfo ? (
                <ZonePanel
                  key={panelZoneInfo.id}
                  zone={panelZoneInfo}
                  width={narrow ? '100%' : 340}
                  onClose={() => setPanelZone(null)}
                  onAction={onFeedAction}
                  onAsk={game.interact}
                  online={online}
                />
              ) : null}
            </Box>
          )}
          <ZonePrompt
            game={game}
            touch={narrow}
            bottom={narrow ? 'calc(min(46vh, 460px) + 10px)' : 'calc(min(40vh, 400px) + 10px)'}
          />
          {worldHelp.open && <WorldHelp onClose={worldHelp.close} touch={narrow} />}
          <RoomPlate def={scenes.def} onGoHome={goHome} narrow={narrow} room={genesis.room.roomOf(scenes.def.key)} toast={(icon, t) => game.toast(icon, t)} />
          <RoomChat rs={roomSock} narrow={narrow} voice={roomVoice} />
          <GenesisPanels
            g={genesis}
            def={scenes.def}
            handle={stageHandle}
            objects={worldObjects}
            siteBases={models.map((m) => ({ base: m.url, name: m.name, hint: '站内形象' }))}
            toast={(icon, t) => game.toast(icon, t)}
            narrow={narrow}
          />
          {scenePickerOpen && (
            <ScenePicker
              defs={scenes.defs}
              current={scenes.def.key}
              onPick={(k) => { setScenePickerOpen(false); scenes.switchTo(k); }}
              onClose={() => setScenePickerOpen(false)}
              extra={<RoomsSection g={genesis} toast={(icon, t) => game.toast(icon, t)} current={scenes.def.key} onPick={(k) => { setScenePickerOpen(false); scenes.switchTo(k); }} />}
            />
          )}
        </ErrorBoundary>
      )}

      {/* 底部 chip 条：情绪 + 姿势（移动端隐藏，腾位置给 chat） */}
      <Box sx={{
        position: 'absolute', left: 16, right: { xs: 16, md: 540 }, bottom: { xs: 100, md: 100 },
        zIndex: 3, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 0.5,
      }}>
        <VrmEmotionChips handle={stageHandle} />
        <VrmPoseChips handle={stageHandle} />
      </Box>

      {/* 右侧控制面板（这里原来重复渲染了两份完全一样的实例） */}
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
        // 让出顶部的退出/模型/会话按钮;底部让出聊天区(高 40vh,最多 400px)
        top: 'calc(64px + var(--sat, 0px))',
        left: { xs: 12, sm: 16 },
        width: { xs: 'calc(100vw - 24px)', sm: 260 },
        maxWidth: 260,
        maxHeight: 'calc(100vh - min(40vh, 400px) - 80px)',
        zIndex: 3,
        background: 'rgba(0,0,0,0.5)',
        borderRadius: 2,
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: sessionDrawerOpen ? 'flex' : 'none',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
            会话
            <Box component="span" sx={{ ml: 0.75, fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
              {mounted ? history.length : ''}
            </Box>
          </Typography>
          <Button size="small" disabled={creatingSession} onClick={handleNewConversation} sx={{ fontSize: 11, color: '#25F4EE', textTransform: 'none' }}>
            {creatingSession ? '创建中…' : '+ 新会话'}
          </Button>
        </Box>
        {(sessionError || historyError) && (
          <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography role="alert" sx={{ fontSize: 11, color: '#ff8a80', flex: 1 }}>
              {sessionError || `会话列表加载失败:${historyError}`}
            </Typography>
            <IconButton size="small" aria-label="重新加载会话" onClick={() => { setSessionError(null); refreshHistory(); }} sx={{ color: 'rgba(255,255,255,0.6)', p: 0.25 }}>
              <RefreshRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        )}
        <Box sx={{ overflowY: 'auto', flex: 1 }}>
          {!mounted || (historyLoading && history.length === 0) ? (
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', p: 2, textAlign: 'center' }}>
              加载中…
            </Typography>
          ) : history.length === 0 ? (
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', p: 2, textAlign: 'center' }}>
              还没有会话,直接提问或点「新会话」开始
            </Typography>
          ) : (
            history.map((h) => {
              const isCurrent = conversationId === h.id;
              const timeStr = relativeTime(h.lastMessageAt || h.createTime);
              return (
              <ListItemButton
                key={h.id}
                selected={isCurrent}
                onClick={() => openConversation(h.id)}
                sx={{
                  py: 1,
                  px: 1.5,
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  borderLeft: isCurrent ? '2px solid #25F4EE' : '2px solid transparent',
                  '&.Mui-selected': { bgcolor: 'rgba(37,244,238,0.15)' },
                }}
              >
                <ListItemText
                  primary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {h.title}
                      </Box>
                      {isCurrent && (
                        <Box component="span" sx={{ fontSize: 9, color: '#25F4EE', flexShrink: 0, border: '1px solid rgba(37,244,238,0.5)', borderRadius: 0.5, px: 0.5, lineHeight: 1.6 }}>
                          当前
                        </Box>
                      )}
                    </Box>
                  }
                  secondary={timeStr}
                  slotProps={{
                    primary: { sx: { fontSize: 12, color: '#fff' }, component: 'div' },
                    secondary: { sx: { fontSize: 10, color: 'rgba(255,255,255,0.35)' } },
                  }}
                />
              </ListItemButton>
              );
            })
          )}
        </Box>
      </Box>

      {/* 底部聊天区:全宽气泡式 */}
      <Box sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        // 手机上形象/数字员工选择器单独占一行,聊天区给高一点;底部让出手势条
        height: { xs: '46vh', md: '40vh' },
        maxHeight: { xs: 460, md: 400 },
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
              m.who === 'tool' && m.tool ? (
                <ToolCallCard key={m.tool.id || i} entry={m.tool} />
              ) : m.who === 'thought' ? (
                <ThoughtBubble key={`t-${i}`} text={m.text} />
              ) : m.who === 'cards' || m.who === 'choices' ? (
                isRichItem(m) ? (
                  <ChatRichItem
                    key={`r-${i}`}
                    item={m}
                    active={!chatBusy && i === lastChoicesIndex}
                    onSend={(t) => void sendText(t)}
                    onOpen={openContent}
                  />
                ) : null
              ) : (
              <Box
                key={i}
                sx={{
                  alignSelf: m.who === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: { xs: '86%', md: '70%' },
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
              )
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
        <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 'calc(16px + var(--sab, 0px))', display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: 1, alignItems: 'center' }}>
          {/* 形象 / 背景 / 数字员工:手机上独占一行(以前和输入框挤一行,输入框被挤成一条缝) */}
          <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', md: 'auto' }, minWidth: 0, flexShrink: 0, '& select': { flex: { xs: '1 1 0', md: '0 0 auto' }, minWidth: 0 } }}>
          <select
            aria-label="形象"
            title="形象:VRM 骨骼模型 / 3DGS 高斯资产 / 2D 片段"
            value={avatarMode}
            onChange={(e) => setAvatarMode(e.target.value as AvatarMode)}
            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '8px 6px', fontSize: 12, maxWidth: narrow ? undefined : 96 }}
          >
            <option value="vrm">VRM</option>
            <option value="3dgs" disabled={gsAssets.length === 0}>3DGS{gsAssets.length === 0 ? '(无资产)' : ''}</option>
            <option value="2d" disabled={!!clipsProblem} title={clipsProblem || ''}>2D{clipsProblem ? '(无片段)' : ''}</option>
          </select>
          {avatarMode === 'vrm' && gsAssets.length > 0 && (
            <select
              aria-label="背景"
              title="背景:场景预设,或用一份 3DGS 场景资产垫在角色后面"
              value={gsBackdrop}
              onChange={(e) => setGsBackdrop(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '8px 6px', fontSize: 12, maxWidth: narrow ? undefined : 110 }}
            >
              <option value="">预设场景</option>
              {gsAssets.map((a) => <option key={a.id} value={a.assetUrl}>GS · {a.name}</option>)}
            </select>
          )}
          {avatarMode === '3dgs' && gsAssets.length > 1 && (
            <select aria-label="3DGS 资产" value={gsAsset} onChange={(e) => setGsAsset(e.target.value)} style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '8px 6px', fontSize: 12, maxWidth: narrow ? undefined : 110 }}>
              {gsAssets.map((a) => <option key={a.id} value={a.assetUrl}>{a.name}</option>)}
            </select>
          )}
          <select
            aria-label="数字员工"
            value={aguiAgent}
            onChange={(e) => setAguiAgent(e.target.value)}
            style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '8px 6px', fontSize: 12, maxWidth: narrow ? undefined : 120 }}
          >
            {(staffList.length ? staffList : [{ agentId: 'worker', name: '全能数字员工', description: '' }]).map((st) => (
              <option key={st.agentId} value={st.agentId}>{st.name}</option>
            ))}
          </select>
          </Box>
          <TextField
            fullWidth
            placeholder={voiceEnabled ? (voice.state === 'recording' ? '我在听…' : '说"小月"唤醒') : '跟数字人说点什么…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            disabled={chatBusy}
            size="small"
            sx={{
              flex: 1,
              minWidth: 0,
              width: 'auto',
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
              // 在屏幕上开,不把数字人页面跳走
              const target = action.target as string;
              if (target) openOnDisplay(target);
            } else if (action.handler === 'tool' && action.target) {
              // 工具类动作:回灌对话
              chat.sendText(String(action.target));
            }
            setDynamicUI(null);
          }}
        />
      )}

    </Box>
  );
}
