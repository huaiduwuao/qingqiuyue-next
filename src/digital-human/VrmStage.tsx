'use client';

import { devLog } from '@/lib/dev-log';

/**
 * VrmStage.tsx — 全身取景 + 多场景 + 5 hooks 编排的 VRM 舞台
 *
 * 设计要点：
 *   - 替代 BlenderAvatar 用在 /digital-human 公共页。保留 emotion/viseme/action 三个 prop
 *     （向后兼容 useChatAvatarWS 的输出）。
 *   - 用 forwardRef 暴露 VrmStageHandle（接 Hermes 工具调用的入口）。
 *   - 内部用 5 个独立 hook 拆解关注点：renderer / scene / lipSync / dance / camera。
 *   - 复用 ./vrm/loadAvatar 的 cache + 加载逻辑（与 BlenderAvatar 共享）。
 *
 * 关键 prop：
 *   - modelUrl    VRM 路径，默认 /avatars/character.vrm
 *   - emotion     表情 blendshape dict（chat hook 推过来）
 *   - viseme      口型 blendshape dict（chat hook 推过来）
 *   - currentAction  动作名（idle/wave/...，chat hook 推过来）
 *
 * VrmStageHandle（ref.current）：
 *   - setEmotion(dict) / setViseme(dict) / setAction(name)
 *   - setScene(name) / setCameraPreset(name) / setDanceStyle(name)
 *   - setDanceAmp(n) / setBpm(n)
 *   - speak(text, audioUrl?)
 *   - getScreenshot()  (debug)
 */

import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

import { loadConfigBundle, loadConfigBundleAsync } from './vrm/config/loader';
import type { ConfigBundle } from './vrm/config/types';
import { useVrmPhysics } from './vrm/useVrmPhysics';
import { useExpressionLerp } from './vrm/useExpressionLerp';
import { loadAvatar, type Cached } from './vrm/loadAvatar';
import { useVrmRenderer } from './vrm/useVrmRenderer';
import { useVrmScene } from './vrm/useVrmScene';
import { useVrmLipSync } from './vrm/useVrmLipSync';
import { useVrmAnimation } from './vrm/useVrmAnimation';
import { useVrmCamera } from './vrm/useVrmCamera';
import { useVrmScenePanel, type DisplayHosts } from './vrm/useVrmScenePanel';
import { DISPLAY_SPECS, displayFocusPose, type DisplaySlot } from './vrm/sceneDisplays';
import { makeConfetti, updateConfetti } from './vrm/particles';
import { createAudioHandle, type AudioHandle } from './vrm/audio';
import { useVrmWorld, type WorldEvent } from './vrm/world/useVrmWorld';
import type { WorldPeer } from './vrm/world/buildWorld';
import type { PlacedObject } from './vrm/world/worldObjects';
import type { RoomPeer } from './vrm/world/peerAvatars';
import type { TimeMode } from './vrm/world/env/timeOfDay';
import type { SeatSpot } from './vrm/world/interact';
import type { BlockGrid, BlockOp } from './vrm/world/blocks';
import type { TerrainData, TerrainPatch, TerrainWater } from './vrm/world/terrain';
import type { BlockHit } from './vrm/world/blockLayer';
import { DEFAULT_WORLD, clampToWorld, type Orb, type RoomShellAlign, type WorldCharacter, type WorldDef, type ZoneId } from './vrm/world/worldLayout';
import { applyAvatarParams, inspectAvatar, type AvatarInfo } from './vrm/avatarCustomize';
import type { AvatarParams } from '@/apis/world';
import { detectVrmVersion, setExpression, setExpressionDict, listAvailableExpressions, getBone } from './vrm/vrmCompat';
import { lookupAutoExpression } from './vrm/config/types';
import type { ScenePresetName, CameraPresetName, DanceStyle, PoseName } from './vrm/types';

export interface VrmStageHandle {
  setEmotion: (dict: Record<string, number>) => void;
  setViseme: (dict: Record<string, number>) => void;
  setAction: (name: string) => void;
  setScene: (name: ScenePresetName) => void;
  setCameraPreset: (name: CameraPresetName) => void;
  setDanceStyle: (s: DanceStyle) => void;
  setDanceAmp: (v: number) => void;
  setBpm: (v: number) => void;
  setDancing: (on: boolean) => void;
  setPose: (name: PoseName) => void;
  /** 触发口型时间线（TTS+viseme） */
  speak: (text: string, audioUrl?: string, visemes?: { t: number; shape: string; weight: number }[]) => void;
  /** 设置口型时间线数据（由 chat hook 调用） */
  setVisemeTimeline: (timeline: { t: number; shape: string; weight: number }[]) => void;
  /** 切换"是否被手动 UI 覆盖"（表情/口型/眨眼滑杆时） */
  setUserLipOverride: (on: boolean) => void;
  setUserBlinkOverride: (on: boolean) => void;
  /** 彩屑开关 */
  setConfetti: (on: boolean) => void;
  /** 场景内 UI 面板的显示开关（内容由父组件 portal 进 onScenePanelHost 给的宿主元素） */
  setScenePanelVisible: (on: boolean) => void;
  /** 场景里的显示器(大屏/副屏/竖屏)整体显示或收起 */
  setDisplaysVisible: (on: boolean) => void;
  /** 镜头凑近某块显示器;传 null 飞回凑近之前的机位 */
  focusDisplay: (slot: DisplaySlot | null) => void;
  /**
   * 把外部的 <audio>（TTS 输出）接到舞台的 WebAudio 分析器上，让口型跟着真实语音走。
   *
   * 不接的话，说话时的嘴型只能靠 textToVisemeTimeline 按「每字 150ms」猜，
   * 跟实际语速对不上；TTS 音频本来就在另一个 <audio> 元素上，分析器根本听不到。
   * 同一个元素重复调用是安全的（内部幂等）。
   */
  connectAudioElement: (el: HTMLAudioElement) => void;
  /** 演示歌曲 */
  startSong: () => void;
  stopSong: () => void;
  /** 麦克风 */
  startMic: () => Promise<boolean>;
  stopMic: () => void;
  /** 身体位置（body.move tool） */
  move: (target: { x: number; y?: number; z: number } | 'left' | 'right' | 'center' | 'forward' | 'back', opts?: { durationMs?: number; style?: 'walk' | 'run' | 'teleport' }) => void;
  /** 直接设位置（瞬移） */
  setPosition: (x: number, z: number) => void;
  /** 调整 Y 偏移（手动调） */
  setYOffset: (y: number) => void;
  /** 获取当前 (x, z) */
  getPosition: () => { x: number; z: number };
  getScreenshot: () => string | null;
  /** 广场:走到某点(自动决定走/跑,超出广场会被收回来) */
  walkTo: (x: number, z: number) => void;
  /** 广场:角色头顶冒一句飘字 */
  floatText: (text: string, color?: string) => void;
  /** 广场:镜头拉高俯瞰整座广场;false 飞回原来的机位 */
  setOverview: (on: boolean) => void;
  /** 广场:小地图用的快照(角色位置/朝向、镜头朝向、星光、所在地标) */
  getWorldSnapshot: () => { x: number; z: number; yaw: number; camYaw: number; orbs: Orb[]; zone: ZoneId | null; peers: { id: string; x: number; z: number; aura?: string }[]; characters: { id: string; x: number; z: number }[]; sit?: number | null; y?: number } | null;
  /** 十期:某件能坐的摆设上的座位(世界坐标);from = 人现在在哪 */
  seatSpots: (id: string, from: { x: number; z: number }) => SeatSpot[];
  /** 十期:坐到某个座位上(不过碰撞,直接落座);走动 / 走向别处时自动站起来 */
  sitAt: (spot: SeatSpot) => void;
  /** 十期:站起来(站到座位前面);没坐着就什么都不做 */
  standUp: () => void;
  /** 十期:正坐着的座位(null = 站着) */
  sitting: () => SeatSpot | null;
  /** 十二期:换一份积木网格(null = 这里没有) */
  setBlockGrid: (grid: BlockGrid | null) => void;
  /** 地形:换一整张(null = 没有)/ 盖上改到的一块 / 点到地形哪儿 / 笔刷预览圈 */
  setTerrain: (t: TerrainData | null) => void;
  setTerrainWater: (w: TerrainWater | null) => void;
  applyTerrainPatch: (p: TerrainPatch) => void;
  terrainPick: (clientX: number, clientY: number) => { x: number; y: number; z: number } | null;
  setTerrainBrush: (b: { x: number; z: number; r: number; color?: number } | null) => void;
  /** 十二期:网格改好了,画面跟着改 */
  applyBlockOps: (ops: readonly BlockOp[]) => void;
  /** 十二期:搭建中(点击不走路,交给搭建面板) */
  setBuilding: (on: boolean) => void;
  /** 潜水按钮:按住 = 往下潜 */
  setDiving: (on: boolean) => void;
  /** 现在泡在液体里没有(潜水按钮要不要出来) */
  inLiquid: () => boolean;
  /** 十二期:屏幕上这一点打中哪块积木 / 地面哪一格 */
  blockPick: (clientX: number, clientY: number) => BlockHit | null;
  /** 十二期:预览框 */
  setBlockGhost: (a: { x: number; y: number; z: number } | null, b?: { x: number; y: number; z: number }, remove?: boolean) => void;
  /** 广场:其他在线的人 */
  setPeers: (peers: WorldPeer[]) => void;
  /** 广场:自己脚下的光环(颜色 / rainbow / null) */
  setAura: (value: string | null) => void;
  /** 广场:在任意世界坐标冒一句飘字(许愿池上方冒别人的愿望) */
  floatTextAt: (text: string, x: number, y: number, z: number, color?: string) => void;
  /** 广场:某位人物头顶冒一句话 */
  characterSay: (id: string, text: string) => void;
  /** 言出法随:整批设置 / 增改 / 删掉摆出来的东西 */
  setPlacements: (list: PlacedObject[]) => void;
  upsertPlacement: (p: PlacedObject) => void;
  removePlacement: (id: string) => void;
  /** 广场:换场景后回到舞台前、镜头复位 */
  enterScene: () => void;
  /** 创世 · 布置房间:选中哪一件(脚下高亮);null = 取消 */
  selectPlacement: (id: string | null) => void;
  /** 创世 · 布置房间:某件摆放在场景里的组(gizmo 挂它身上) */
  getPlacementGroup: (id: string) => import('three').Group | null;
  /** 创世:three 的几样东西(布置房间的 gizmo 要用);还没初始化 = null */
  /**
   * 八期:按当前画面截一张图(房间封面):先画一帧再立刻读,中间裁成 16:9、缩到 maxW 宽的 JPEG data URL;
   * userData.noCapture 的东西(选中圈、gizmo)这一帧不画。画不出返回 null
   */
  captureFrame: (maxW?: number) => string | null;
  getThree: () => { THREE: typeof import('three'); scene: import('three').Scene; camera: import('three').PerspectiveCamera; renderer: import('three').WebGLRenderer; controls: any; canvas: HTMLCanvasElement } | null;
  /** 创世 · 泼溅外壳:实时改对齐 / 按包围盒自动摆正 */
  setRoomAlign: (a: RoomShellAlign) => void;
  autoFitRoom: () => RoomShellAlign | null;
  /** 创世 · 捏人:把参数套到当前形象上(换模型后自动重套) */
  applyAvatarParams: (p: AvatarParams | null) => void;
  /** 创世 · 捏人:当前模型能调什么(脸型形变、眼骨、颜色分类) */
  getAvatarInfo: () => AvatarInfo | null;
  /** 创世二期 · 房间里的其他人(真形象,插值走动) */
  setRoomPeers: (list: RoomPeer[]) => void;
  /** 创世二期 · 某人头顶冒一句话 */
  peerSay: (id: string, text: string) => void;
  /** 四期语音:同伴嘴型的音量来源(谁此刻嘴张多大,0..1);null 关掉 */
  setPeerVoiceLevels: (fn: ((id: string) => number) | null) => void;
}

export interface VrmStageProps {
  modelUrl?: string;
  /** 表情（chat hook 推过来） */
  emotion?: Record<string, number>;
  /** 口型（chat hook 推过来） */
  viseme?: Record<string, number>;
  /** 动作（chat hook 推过来） */
  currentAction?: string;
  /** 自动眨眼（默认 true） */
  autoBlink?: boolean;
  /** 视线跟随相机（默认 true） */
  lookAtCamera?: boolean;
  /** 背景色（默认透明，让场景 sky dome 显示） */
  background?: string;
  /** 透传样式 */
  sx?: React.CSSProperties;
  /** 调试：按 1 跳过 three.js */
  debugNoThree?: boolean;
  /**
   * handle 就绪回调（首帧 mount 后触发，useImperativeHandle 跑完才 fire）。
   * 父组件用这个把 handle 存到 state，避免首次渲染时 ref.current 还没填的坑。
   */
  onReady?: (handle: VrmStageHandle) => void;
  /**
   * ConfigBundle（可选）
   * - 不传：模块加载时自动从 src/data/seed/*.json 加载（Phase 1 行为）
   * - 传：父组件可以注入从 API 拉来的 config（Phase 2 用）
   */
  config?: ConfigBundle;
  /**
   * 3D 场景内 UI 面板的宿主元素就绪回调。
   *
   * 面板由 CSS3DRenderer 摆在场景里(跟着角色走、随相机转),但内容是真 DOM,
   * 父组件拿到这个 host 后用 createPortal 往里渲染 React —— 列表能点、表单能填。
   * 传 null 表示面板层被卸载了。
   */
  onScenePanelHost?: (host: HTMLDivElement | null) => void;
  /** 场景里几块显示器的宿主元素就绪回调(同上,父组件 portal 进去);null = 已卸载 */
  onDisplayHosts?: (hosts: DisplayHosts | null) => void;
  /** 舞台后面垫了别的渲染层(3DGS 场景)时置 true:three 不画背景和雾 */
  transparentBackground?: boolean;
  /**
   * 开启「广场」:舞台外铺一整座能逛的广场(地标、星光),WASD/方向键走动、点地面前往、
   * 点角色戳一戳,角色朝着走的方向转身。关着就是原来的小舞台 + WASD 转镜头。
   */
  world?: boolean;
  /** 广场里发生的事(捡到星光、进出地标、戳一戳、按 F 互动),由页面层记账 */
  onWorldEvent?: (e: WorldEvent) => void;
  /** 当前场景(后台配置的地标);不传 = 星光广场 */
  worldDef?: WorldDef;
  /** 当前场景里的人物 */
  characters?: WorldCharacter[];
  /** 广场画质:high(湖山天光 + 后期 + 草)/ low(不做后期和草)/ off(只有广场本身) */
  worldQuality?: 'high' | 'low' | 'off';
  /** 用户手动选的时辰;null = 场景默认 */
  worldTime?: TimeMode | null;
  /** 创世:正在布置房间(点东西 = 选中) */
  worldEditing?: boolean;
  /** 创世:捏人参数(换模型后自动重新套上) */
  avatarParams?: AvatarParams | null;
  /** 形象加载完成(捏人面板据此刷新能调的项) */
  onAvatarLoaded?: (info: AvatarInfo) => void;
}

const EXPRESSION_PASSTHROUGH = new Set([
  // VRM 1.0 / ARKit 52 维表情
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'eyeLookDownLeft', 'eyeLookDownRight', 'eyeLookInLeft', 'eyeLookInRight',
  'eyeLookOutLeft', 'eyeLookOutRight', 'eyeLookUpLeft', 'eyeLookUpRight',
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeSquintLeft', 'eyeSquintRight',
  'eyeWideLeft', 'eyeWideRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'jawOpen', 'jawForward', 'jawLeft', 'jawRight',
  'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthDimpleLeft', 'mouthDimpleRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthPressLeft', 'mouthPressRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthOpen',
  'noseSneerLeft', 'noseSneerRight',
  // VRM 1.0 预设表情
  'happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral',
  // VRM 0.0 表情（兼容）
  'joy', 'sorrow', 'fun', 'aa', 'ih', 'ou', 'ee', 'oh',
  'blink', 'blinkLeft', 'blinkRight',
  'viseme_sil', 'viseme_aa', 'viseme_E', 'viseme_I', 'viseme_O', 'viseme_U', 'viseme_ou', 'viseme_ih',
  'viseme_PP', 'viseme_FF', 'viseme_TH', 'viseme_DD', 'viseme_kk', 'viseme_CH', 'viseme_SS', 'viseme_nn', 'viseme_RR',
]);

/**
 * 设置自然姿态：让 VRM 模型从 T-pose 变为自然站立姿势
 * VRM 模型默认是 T-pose，手臂水平外伸
 * 大臂 rotation.z ≈ ±1.4 rad 让手臂垂到身体两侧
 */
function setNaturalPose(vrm: any) {
  if (!vrm?.humanoid) return;
  const lUpper = getBone(vrm.humanoid, 'leftUpperArm');
  const rUpper = getBone(vrm.humanoid, 'rightUpperArm');
  const lLower = getBone(vrm.humanoid, 'leftLowerArm');
  const rLower = getBone(vrm.humanoid, 'rightLowerArm');
  const lHand = getBone(vrm.humanoid, 'leftHand');
  const rHand = getBone(vrm.humanoid, 'rightHand');
  const lUpperLeg = getBone(vrm.humanoid, 'leftUpperLeg');
  const rUpperLeg = getBone(vrm.humanoid, 'rightUpperLeg');

  // 大臂往下垂 (rotation.z = -1.4 ≈ -80° 让手臂从水平外伸 → 垂到身体两侧)
  if (lUpper) lUpper.rotation.z = -1.4;
  if (rUpper) rUpper.rotation.z = 1.4;
  // 小臂微弯 (手肘往前)
  if (lLower) lLower.rotation.x = 0.3;
  if (rLower) rLower.rotation.x = 0.3;
  // 手自然下垂
  if (lHand) lHand.rotation.x = 0.3;
  if (rHand) rHand.rotation.x = 0.3;
  // 腿直立微张
  if (lUpperLeg) lUpperLeg.rotation.x = -0.1;
  if (rUpperLeg) rUpperLeg.rotation.x = -0.1;
}

export const VrmStage = forwardRef<VrmStageHandle, VrmStageProps>(function VrmStage(props, ref) {
  const {
    modelUrl = '/avatars/character.vrm',
    emotion = {},
    viseme = {},
    currentAction = 'idle',
    autoBlink = true,
    lookAtCamera = true,
    background = 'transparent',
    sx,
    debugNoThree,
    onReady,
    config: configProp,
    onScenePanelHost,
    onDisplayHosts,
    transparentBackground,
    world = false,
    worldDef = DEFAULT_WORLD,
    characters,
    worldQuality = 'high',
    worldTime = null,
    onWorldEvent,
    worldEditing = false,
    avatarParams = null,
    onAvatarLoaded,
  } = props;
  const avatarParamsRef = useRef(avatarParams);
  avatarParamsRef.current = avatarParams;
  const onAvatarLoadedRef = useRef(onAvatarLoaded);
  onAvatarLoadedRef.current = onAvatarLoaded;
  const worldOnRef = useRef(world);
  worldOnRef.current = world;
  const worldDefRef = useRef(worldDef);
  worldDefRef.current = worldDef;
  // Phase 1：模块加载时已 loadConfigBundle()，所有子模块（expressions/visemes/actions）已用
  // Phase 2：父组件可以传 config prop 覆盖
  // 用 useState 保持引用稳定，async loader 完成后一次性更新，避免每次 render 产生新对象
  const [configBundle, setConfigBundle] = useState(() => configProp ?? loadConfigBundle());
  const [currentScene, setCurrentScene] = useState<string>('concert');  // 默认场景
  useEffect(() => {
    if (configProp) {
      setConfigBundle(configProp);
      return;
    }
    loadConfigBundleAsync().then((b) => {
      setConfigBundle(b);
      devLog.debug(`[VrmStage] async config updated: ${b.actions.length} actions, ${b.scenes.length} scenes`);
    });
  }, [configProp]);

  // 当前激活的 scene config（从 bundle.scenes 找 name === 当前 scene）
  // 通过 setCurrentScene(name) 从外部切换场景，或内部默认使用 'concert'
  const currentSceneConfig = useMemo(() => {
    return configBundle.scenes.find((s) => s.name === currentScene) || configBundle.scenes[0];
  }, [configBundle, currentScene]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // CSS3D 面板层挂在 canvas 的父容器上(与 canvas 同尺寸、同坐标系)
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const vrmSceneRef = useRef<any>(null);  // THREE.Object3D of the loaded VRM
  const vrmDataRef = useRef<Cached | null>(null);
  const expressionManagerRef = useRef<any>(null);
  /** 最近一次「嘴由真实音频驱动」的时刻(performance.now) */
  const lastAudioLipAtRef = useRef(0);
  const vrmRef = useRef<any>(null);
  const handleInternalRef = useRef<VrmStageHandle | null>(null);  // useImperativeHandle 工厂里同步存 handle
  const vrmVersionRef = useRef<0 | 1>(1);  // VRM 0.0/1.0 — 0 用 joy/sorrow/fun/viseme_aa，1 用 happy/aa

  // Phase 3.2: 表情/口型/动作的 lerp 平滑过渡
  // emotionLerp / visemeLerp 用 ref 拿 em（vrm 异步加载后才就绪）
  // 注意：vrmVersionRef 必须在 emotionLerp 之前定义
  const emotionLerp = useExpressionLerp({ emRef: expressionManagerRef, vrmVersionRef, speed: 6 });
  const visemeLerp = useExpressionLerp({ emRef: expressionManagerRef, vrmVersionRef, speed: 10 });

  // Phase 4: 统一动画状态机（auto-emotion/viseme 适配）
  const animStateRef = useRef<{ currentAction: string; currentPose: string }>({
    currentAction: 'idle', currentPose: 'idle',
  });

  // 关键：把 hook 返回值（每次 render 都是新对象）存到 ref，handle 内部读 ref
  // 这样 useImperativeHandle 的 factory 用空 deps 只跑一次，handle 引用稳定
  const sceneApiRef = useRef<any>(null);
  const animApiRef = useRef<any>(null);
  const camApiRef = useRef<any>(null);
  const rendererStateRef = useRef<any>(null);
  const lipApiRef = useRef<any>(null);
  const rendererApiRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confettiOn, setConfettiOn] = useState(false);
  const confettiRef = useRef<any>(null);
  // 角色位置（x, z，y 由 yOffset 控制）
  const positionRef = useRef({ x: 0, z: 0, prevX: 0, prevZ: 0 });
  const yOffsetRef = useRef(0);  // 手动 Y 偏移
  // 由模型包围盒推导的物理胶囊尺寸（setYOffset 时同步给物理世界）
  const modelMetricsRef = useRef<{ height: number; radius: number; footOffsetY: number } | null>(null);
  // 行走状态（useVrmDance 通过 walkRef 读这个来播放行走动画）
  // 移动动画状态
  const moveAnimRef = useRef<{ active: boolean; startTime: number; duration: number; fromX: number; fromZ: number; toX: number; toZ: number; style: 'walk' | 'run' | 'teleport' }>({
    active: false, startTime: 0, duration: 0, fromX: 0, fromZ: 0, toX: 0, toZ: 0, style: 'walk',
  });
  // 行走状态（useVrmDance 通过 walkRef 读这个来播放行走动画）
  const walkRef = useRef<{ moving: boolean; phase: number; style: 'walk' | 'run' | 'idle' | 'teleport'; dist?: number }>({ moving: false, phase: 0, style: 'idle', dist: 0 });
  // 行走步进（每帧 dt 累积）
  const walkStepRef = useRef(0);
  // 十期:坐着的座位(null = 站着)
  const sitRef = useRef<SeatSpot | null>(null);
  // 十二期:脚下积木的高度(站在平台 / 台阶上)
  const groundYRef = useRef(0);

  // Phase 3: 物理（vrmDataRef 之后才能访问 scene）
  const vrmSceneForPhysics = vrmDataRef.current?.scene ?? null;
  const targetPositionRef = useRef({ x: 0, y: 0, z: 0 });
  const physics = useVrmPhysics({
    model: configBundle.model,
    sceneConfig: currentSceneConfig,
    vrmScene: vrmSceneForPhysics,
    targetPositionRef,
    onStep: (pos) => {
      // 物理 step 后实际位置写回 positionRef（让 useEffects/session 看到）
      positionRef.current.x = pos.x;
      positionRef.current.z = pos.z;
    },
  });

  const userLipOverrideRef = useRef(false);
  const userBlinkOverrideRef = useRef(false);
  const blinkTRef = useRef(1.5);
  const blinkVRef = useRef(0);

  // 口型时间线状态（speak 方法设置，tick 循环消费）
  const visemeTimelineRef = useRef<{ t: number; shape: string; weight: number }[]>([]);
  const visemeStartTimeRef = useRef<number>(0);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // 0. 共享 audio handle（dance 需要它来同步 BPM）
  const audioRef = useRef<AudioHandle | null>(null);
  if (!audioRef.current) audioRef.current = createAudioHandle();
  const audio = audioRef.current;

  // 1. renderer
  const rendererApi = useVrmRenderer({ canvas: canvasRef.current, fov: 30, enableControls: true });
  const rendererState = rendererApi.state;
  rendererApiRef.current = rendererApi;
  rendererStateRef.current = rendererState;

  // 2. scene
  const sceneApi = useVrmScene({ rendererState, vrmScene: vrmSceneRef.current, initialPreset: 'concert', transparent: transparentBackground });
  sceneApiRef.current = sceneApi;

  // 2.5 场景内 UI 面板层(CSS3D):与 WebGL 共用 camera,面板站在场景里跟着角色
  const panelApi = useVrmScenePanel({
    container: stageEl,
    camera: rendererState?.camera ?? null,
    THREE_NS: (rendererState as any)?.THREE_NS ?? null,
    scene: rendererState?.scene ?? null,
    canvas: rendererState ? canvasRef.current : null,
  });
  const panelApiRef = useRef(panelApi);
  panelApiRef.current = panelApi;
  // host 就绪/卸载时通知父组件(父组件据此 createPortal)
  useEffect(() => { onScenePanelHost?.(panelApi.host); }, [panelApi.host, onScenePanelHost]);
  useEffect(() => { onDisplayHosts?.(panelApi.displayHosts); }, [panelApi.displayHosts, onDisplayHosts]);
  // 凑近看屏幕之前的机位,看完飞回去
  const preFocusPoseRef = useRef<{ pos: [number, number, number]; target: [number, number, number] } | null>(null);

  // 3. 统一动画状态机（替代 useVrmDance）
  const animApi = useVrmAnimation({ vrmRef, audio, walkRef, configBundle, physics, sitRef, groundRef: groundYRef });
  animApiRef.current = animApi;

  // 4. lip sync
  const lipApi = useVrmLipSync({
    emRef: expressionManagerRef,
    audio,
    userLipOverride: false,
    vrmVersionRef,
  });
  lipApiRef.current = lipApi;

  // 5. camera
  const camApi = useVrmCamera({ camera: rendererState?.camera ?? null, controls: rendererState?.controls ?? null });
  camApiRef.current = camApi;

  // 6. 广场(可选)
  const onWorldEventRef = useRef(onWorldEvent);
  onWorldEventRef.current = onWorldEvent;
  const worldApi = useVrmWorld({
    enabled: world && !debugNoThree,
    THREE_NS: (rendererState as any)?.THREE_NS ?? null,
    scene: rendererState?.scene ?? null,
    camera: rendererState?.camera ?? null,
    canvas: rendererState ? canvasRef.current : null,
    preset: sceneApi.preset,
    def: worldDef,
    characters,
    quality: worldQuality,
    timeMode: worldTime,
    renderer: (rendererState as any)?.renderer ?? null,
    getAvatar: () => vrmDataRef.current?.scene ?? null,
    walkTo: (x, z) => handleInternalRef.current?.walkTo(x, z),
    editing: worldEditing,
    onEvent: (e) => onWorldEventRef.current?.(e),
  });
  const worldApiRef = useRef(worldApi);
  worldApiRef.current = worldApi;
  // 广场开着时由它接管渲染(有后期就走后期,没有就照常画)
  useEffect(() => {
    if (!rendererState) return;
    rendererApi.setRenderOverride(world ? (r, sc, cam, t) => worldApiRef.current.render(r, sc, cam, t) : null);
    return () => rendererApi.setRenderOverride(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendererState, world]);
  /** 角色朝向(绕 Y,0 = 面朝 +Z 即默认机位);走动时转向前进方向,停下一会儿转回来看镜头 */
  const yawRef = useRef(0);
  const idleSinceRef = useRef(0);
  const overviewPoseRef = useRef<{ pos: [number, number, number]; target: [number, number, number] } | null>(null);
  /** 俯瞰时把视角拉宽(舞台相机 30° 太窄,拉到 55° 才装得下整座广场);null = 回到原视角 */
  const fovTargetRef = useRef<number | null>(null);
  const baseFovRef = useRef<number | null>(null);
  // 广场比舞台大得多:允许镜头拉远一些(太远会出天空球)
  useEffect(() => {
    const c = rendererState?.controls;
    if (!c) return;
    c.maxDistance = world ? 24 : 12;
  }, [rendererState, world]);

  /** 捏人:把 avatarParamsRef 里的参数套到当前模型上,并按新的脚底位置重新贴地 */
  function applyAvatarNow() {
    const cached = vrmDataRef.current;
    const rs = rendererStateRef.current;
    if (!cached || !rs?.THREE_NS) return;
    try {
      const r = applyAvatarParams(rs.THREE_NS, cached.vrm, avatarParamsRef.current);
      yOffsetRef.current = r.footOffset;
      cached.scene.position.y = r.footOffset;
      if (modelMetricsRef.current) {
        modelMetricsRef.current = { ...modelMetricsRef.current, height: r.height, footOffsetY: r.footOffset };
        physics.setModelMetrics(modelMetricsRef.current);
      }
    } catch (e) {
      devLog.warn('[VrmStage] 捏人参数没套上', e);
    }
  }

  // 加载 VRM
  useEffect(() => {
    if (!rendererState) return;
    if (debugNoThree) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const cached = await loadAvatar(modelUrl, { rotateVRM0: true, removeUnnecessaryJoints: true });
        if (cancelled) return;
        vrmDataRef.current = cached;
        vrmRef.current = cached.vrm;
        // 开发时方便在控制台 / 测试页里量骨骼(线上不挂)
        if (process.env.NODE_ENV !== 'production') (window as unknown as { __vrm?: unknown }).__vrm = cached.vrm;
        vrmSceneRef.current = cached.scene;
        expressionManagerRef.current = cached.expressionManager;
        // 检测 VRM 版本 + 列出可用的 expression（调试用）
        const ver = detectVrmVersion(cached.vrm);
        vrmVersionRef.current = ver;
        const available = listAvailableExpressions(cached.expressionManager);
        devLog.debug(`[VrmStage] VRM 版本: ${ver}, 可用 expressions (${available.length}):`, available.slice(0, 30));
        cached.scene.traverse((o: any) => { o.castShadow = true; o.frustumCulled = false; });
        rendererState.scene.add(cached.scene);
        // 贴地：信任模型自然原点（VRM 标准：feet 在 y=0），用 yOffset 手动微调
        const THREE_NS = (rendererState as any).THREE_NS as typeof import('three');
        const box = new THREE_NS.Box3().setFromObject(cached.scene);
        const autoYOffset = -box.min.y;
        yOffsetRef.current = autoYOffset;
        devLog.debug(`[VrmStage] Box3 minY=${box.min.y.toFixed(3)} maxY=${box.max.y.toFixed(3)} => auto yOffset=${autoYOffset.toFixed(3)}`);
        cached.scene.position.y = yOffsetRef.current;
        const height = box.max.y - box.min.y;
        const radius = Math.max(0.15, (box.max.x - box.min.x) * 0.5, (box.max.z - box.min.z) * 0.5) * 0.35;
        modelMetricsRef.current = { height, radius, footOffsetY: autoYOffset };
        physics.setModelMetrics(modelMetricsRef.current);
        // 视线
        if (cached.vrm.lookAt) {
          cached.vrm.lookAt.target = lookAtCamera ? rendererState.camera : null;
        }
        // 设置自然姿态：让手臂从 T-pose 自然下垂
        // VRM 模型默认是 T-pose，手臂水平外伸
        // 大臂 rotation.z ≈ ±1.4 rad 让手臂垂到身体两侧
        setNaturalPose(cached.vrm);
        // 捏人参数:套上后脚底位置会变,重新量
        applyAvatarNow();
        onAvatarLoadedRef.current?.(inspectAvatar(cached.vrm));
        setLoading(false);
      } catch (e: any) {
        devLog.error('[VrmStage] load failed', e);
        setError(e?.message || String(e));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      const cached = vrmDataRef.current;
      if (cached && rendererState) rendererState.scene.remove(cached.scene);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendererState, modelUrl]);

  // 捏人参数变了:直接套到当前模型上(不重新加载)
  useEffect(() => { applyAvatarNow(); }, [avatarParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // WASD/QE 键盘控制 — 自由轨道
  // 广场模式:WASD/方向键走、Shift 跑、Q/E 转镜头、空格跳、F 互动
  const keysRef = useRef<Record<string, boolean>>({});
  // 潜水:按住 C(或手机上的潜水按钮)往下潜,松开慢慢浮回去;diveRef = 现在潜了多深(米)
  const diveRef = useRef(0);
  const diveHoldRef = useRef(false);
  const pushAtRef = useRef(0);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (worldOnRef.current) {
        if (k === ' ' || k === 'spacebar') {
          e.preventDefault();
          if (!e.repeat) handleInternalRef.current?.setAction('jump');
          return;
        }
        if (k === 'f') {
          if (!e.repeat) onWorldEventRef.current?.({ type: 'interact' });
          return;
        }
        if (['w', 'a', 's', 'd', 'q', 'e', 'c', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
          keysRef.current[k] = true;
          if (k.startsWith('arrow')) e.preventDefault();
        }
        return;
      }
      if (['w', 'a', 's', 'd', 'q', 'e'].includes(k)) {
        keysRef.current[k] = true;
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = false; };
    const onBlur = () => { keysRef.current = {}; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // 启动 rAF（拿到 rendererState 后）
  useEffect(() => {
    if (!rendererState) return;
    rendererApi.setOnFrame((dt, t) => {
      // 0. WASD 键盘控制（先于其他，避免 camera 动画冲突）
      const keys = keysRef.current;
      const inWorld = worldOnRef.current;
      // 广场里 WASD 是走路(见下面第 4 步),Q/E 左右转镜头
      let kbX = 0, kbY = 0;
      if (inWorld) {
        if (keys.q) camApi.orbit('left', dt * 1.6);
        if (keys.e) camApi.orbit('right', dt * 1.6);
        // 凑近看屏幕时不走动,不然镜头会跟着角色从屏幕前滑走
        if (!preFocusPoseRef.current) {
          kbY = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
          kbX = (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
        }
      } else {
        if (keys.w) camApi.orbit('in', dt);
        if (keys.s) camApi.orbit('out', dt);
        if (keys.a) camApi.orbit('left', dt);
        if (keys.d) camApi.orbit('right', dt);
        if (keys.q) camApi.orbit('up', dt);
        if (keys.e) camApi.orbit('down', dt);
      }
      // 1. lip sync:有真实语音在响时,嘴跟着音频频谱走(和声音天然同步)
      const audioLip = lipApi.tick(dt);
      if (audioLip) lastAudioLipAtRef.current = performance.now();
      // 句内的短暂停顿不算「不说了」,免得时间线在停顿里插进来抢嘴
      const audioDriven = performance.now() - lastAudioLipAtRef.current < 400;
      // 2. 自动眨眼（直接 setValue，因为它是一闪即过的脉冲，不走 lerp）
      if (autoBlink && vrmDataRef.current?.expressionManager && !userBlinkOverrideRef.current) {
        blinkTRef.current -= dt;
        if (blinkTRef.current <= 0) blinkTRef.current = 1.2 + Math.random() * 3.5;
        blinkVRef.current = blinkTRef.current > 0.12 ? 0 : Math.sin((0.12 - blinkTRef.current) / 0.12 * Math.PI);
        vrmDataRef.current.expressionManager.setValue('blink', blinkVRef.current);
      }
      // 3. 把 chat 推过来的 emotion / viseme 喂给 lerp
      //    （不是直接 setValue —— 走 emotionLerp / visemeLerp 平滑）
      //    注意：只有当 props.emotion 非空时才覆盖用户通过 handle.setEmotion 设置的值
      if (vrmDataRef.current?.expressionManager) {
        // 合并 emotion: chat emotion + 适配规则（autoEmotion）
        // 适配规则在 Phase 4.1 落地；目前先只用 chat
        const emotionTarget: Record<string, number> = {};
        for (const [k, v] of Object.entries(emotion)) {
          if (EXPRESSION_PASSTHROUGH.has(k)) emotionTarget[k] = v;
        }
        // 只有当 chat emotion 有值时才更新 lerp target（避免覆盖用户手动设置的值）
        if (Object.keys(emotionTarget).length > 0) {
          emotionLerp.setTarget(emotionTarget);
        }
        // 视口（viseme）直接走 chat
        const visemeTarget: Record<string, number> = {};
        for (const [k, v] of Object.entries(viseme)) {
          if (EXPRESSION_PASSTHROUGH.has(k)) visemeTarget[k] = v;
        }
        // 口型时间线处理（覆盖静态 viseme）
        // 文本时间线只是兜底(没有音频可分析时按字数猜口型)。音频在驱动时让位并作废,
        // 放完也要清掉 —— 以前只有 speak(audioUrl) 分支会清,AG-UI 路径下最后一帧会一直挂着。
        let timeline = visemeTimelineRef.current;
        if (timeline.length > 0) {
          const elapsed = (performance.now() - visemeStartTimeRef.current) / 1000;
          if (audioDriven || elapsed > timeline[timeline.length - 1].t + 0.3) {
            visemeTimelineRef.current = [];
            timeline = [];
            visemeLerp.setTarget({});
          }
        }
        if (timeline.length > 0 && !userLipOverrideRef.current) {
          const elapsedSec = (performance.now() - visemeStartTimeRef.current) / 1000;
          // 找到当前时间对应的 viseme 帧
          let currentFrame = timeline[timeline.length - 1];
          for (const frame of timeline) {
            if (frame.t <= elapsedSec) {
              currentFrame = frame;
            } else {
              break;
            }
          }
          // 将 viseme 帧应用到 lerp target
          if (currentFrame) {
            const shape = currentFrame.shape;
            const weight = currentFrame.weight;
            // 映射到对应的 VRM blendshape
            const vrmVersion = vrmVersionRef.current;
            if (vrmVersion === 0) {
              // VRM 0.0: 使用 viseme_ 前缀
              visemeTarget[`viseme_${shape.toLowerCase()}`] = weight;
            } else {
              // VRM 1.0: 直接用形状名
              // 常见的 viseme 映射
              const visemeMap: Record<string, string[]> = {
                'aa': ['aa', 'jawOpen'],
                'ih': ['ih', 'mouthFunnel'],
                'ou': ['ou', 'mouthPucker'],
                'oh': ['oh'],
                'ee': ['ih'],
                'O': ['oh', 'jawOpen'],
                'U': ['ou', 'mouthPucker'],
                // 闭嘴 = 什么口型都不给(target 为空,lerp 会把上一个口型淡出)。
                // 以前映射到 jawOpen,「闭嘴」反而把下巴张开了。
                'closed': [],
              };
              const shapes = visemeMap[shape.toLowerCase()] ?? [shape];
              for (const s of shapes) {
                if (EXPRESSION_PASSTHROUGH.has(s)) {
                  visemeTarget[s] = weight;
                }
              }
            }
          }
        }
        if (Object.keys(visemeTarget).length > 0) {
          visemeLerp.setTarget(visemeTarget);
        } else if (timeline.length > 0) {
          visemeLerp.setTarget({});
        }
        // 注意：emotionManager 是在 vrm 加载后才就绪的；
        // useExpressionLerp 用的是 ref 拿到的 em — 加载后会即时生效
        emotionLerp.tick(dt);
        visemeLerp.tick(dt);
      }
      // 4. 位置 / 行走动画
      const mv = moveAnimRef.current;
      const pos = positionRef.current;
      if ((kbX !== 0 || kbY !== 0) && rendererState && sitRef.current) handleInternalRef.current?.standUp();
      if ((kbX !== 0 || kbY !== 0) && rendererState) {
        // 以镜头为参照:W 是「往画面里走」,D 是「往画面右边走」
        mv.active = false;
        const cam = rendererState.camera;
        const tgt = rendererState.controls?.target ?? { x: pos.x, z: pos.z };
        let fx = tgt.x - cam.position.x, fz = tgt.z - cam.position.z;
        const fl = Math.hypot(fx, fz) || 1;
        fx /= fl; fz /= fl;
        let mx = fx * kbY - fz * kbX;
        let mz = fz * kbY + fx * kbX;
        const ml = Math.hypot(mx, mz) || 1;
        mx /= ml; mz /= ml;
        const running = !!keys.shift;
        // 真人的速度:走 1.5 米/秒、慢跑 3.6 米/秒(动捕按走过的距离推进,速度越接近真人越自然)
        // 泡在水这类液体物质里走得慢(物质的 liquid.slow)
        const slow = worldOnRef.current ? worldApiRef.current.slowAt(pos.x, pos.z, groundYRef.current) : 0;
        const speed = (running ? 3.6 : 1.5) * (1 - slow);
        pos.prevX = pos.x; pos.prevZ = pos.z;
        // 八期:绕开摆设(撞上就顺着边滑过去)
        const next = clampToWorld(pos.x + mx * speed * dt, pos.z + mz * speed * dt, worldDefRef.current, worldApiRef.current.obstacles(groundYRef.current));
        // 推得动的东西(movable):顶着它走、几乎走不动时,告诉服务端推一下(服务端挪它、推给大家)
        if (Math.hypot(next.x - pos.x, next.z - pos.z) < speed * dt * 0.4 && performance.now() - pushAtRef.current > 200) {
          const id = worldApiRef.current.movableAt(pos.x + mx * 0.45, pos.z + mz * 0.45);
          if (id) { pushAtRef.current = performance.now(); onWorldEventRef.current?.({ type: 'push', id, dx: mx, dz: mz }); }
        }
        pos.x = next.x; pos.z = next.z;
        walkRef.current.moving = true;
        walkRef.current.style = running ? 'run' : 'walk';
        walkStepRef.current += dt * (running ? 8 : 4) * 2 * Math.PI;
        walkRef.current.phase = walkStepRef.current;
      } else if (mv.active) {
        // 液体里点地走:进度按 slow 打折(把起点往后推)
        if (worldOnRef.current) mv.startTime += dt * 1000 * worldApiRef.current.slowAt(pos.x, pos.z, groundYRef.current);
        const elapsed = performance.now() - mv.startTime;
        const k = Math.min(1, elapsed / mv.duration);
        const eased = 1 - Math.pow(1 - k, 2);  // easeOutQuad
        pos.prevX = pos.x; pos.prevZ = pos.z;
        pos.x = mv.fromX + (mv.toX - mv.fromX) * eased;
        pos.z = mv.fromZ + (mv.toZ - mv.fromZ) * eased;
        // 十二期:点地走过去也不穿墙(积木墙、家具):顺着边滑
        if (worldOnRef.current) {
          const c = clampToWorld(pos.x, pos.z, worldDefRef.current, worldApiRef.current.obstacles(groundYRef.current));
          pos.x = c.x; pos.z = c.z;
        }
        if (k >= 1) {
          mv.active = false;
          walkRef.current.moving = false;
        }
        // 行走步进（基于速度：walk 4 步/秒，run 8 步/秒）
        const speed = mv.style === 'run' ? 8 : 4;
        walkStepRef.current += dt * speed * 2 * Math.PI;
        walkRef.current.phase = walkStepRef.current;
      } else {
        pos.prevX = pos.x; pos.prevZ = pos.z;
        // 静止时步进慢衰减（让最后的相位平滑停下，不跳）
        walkStepRef.current *= 0.92;
        walkRef.current.phase = walkStepRef.current;
        walkRef.current.moving = false;
      }

      // 水流:泡在流动的液体里被冲着走(物质 liquid.flow,方向 = 积木朝向);坐着不冲
      if (worldOnRef.current && !sitRef.current) {
        const f = worldApiRef.current.flowAt(pos.x, pos.z, groundYRef.current);
        if (f) {
          const c = clampToWorld(pos.x + f.x * dt, pos.z + f.z * dt, worldDefRef.current, worldApiRef.current.obstacles(groundYRef.current));
          pos.x = c.x; pos.z = c.z;
        }
      }

      // 走过的距离:真人动捕的步态按它推进(一个循环 = 步幅 × 腿长)
      walkRef.current.dist = (walkRef.current.dist ?? 0) + Math.hypot(pos.x - pos.prevX, pos.z - pos.prevZ);

      // 十二期:脚下的积木 —— 迈得上去的立刻站上去,走出边缘往下掉(9 米/秒)
      if (worldOnRef.current && !sitRef.current) {
        const inLiquid = worldApiRef.current.inLiquid(pos.x, pos.z, groundYRef.current);
        diveRef.current = inLiquid && (keysRef.current.c || diveHoldRef.current) ? Math.min(30, diveRef.current + 1.2 * dt) : Math.max(0, diveRef.current - 1.5 * dt);
        const want = worldApiRef.current.groundAt(pos.x, pos.z, groundYRef.current, diveRef.current);
        const before = groundYRef.current;
        // 一步能迈的(≤ 0.6 米)立刻站上去;更高的(爬梯子、浮上水面)按 2.5 米/秒升;往下掉 9 米/秒
        groundYRef.current = want >= before ? (want - before > 0.6 ? before + Math.min(want - before, 2.5 * dt) : want) : Math.max(want, before - 9 * dt);
        const dy = groundYRef.current - before;
        if (dy !== 0 && rendererState && !overviewPoseRef.current && !preFocusPoseRef.current) {
          rendererState.camera.position.y += dy;
          if (rendererState.controls) rendererState.controls.target.y += dy;
        }
      }
      (targetPositionRef.current as { ground?: number }).ground = groundYRef.current;
      // Phase 3: 同步给物理 + 物理 step（撞墙会修正 pos）
      targetPositionRef.current.x = pos.x;
      targetPositionRef.current.y = yOffsetRef.current;
      targetPositionRef.current.z = pos.z;
      if (physics.ready) {
        physics.step(dt);
        // physics 写入 vrmScene.position 后，同步回 pos
        pos.x = vrmDataRef.current?.scene.position.x ?? pos.x;
        pos.z = vrmDataRef.current?.scene.position.z ?? pos.z;
      } else {
        // 没物理：直接写 scene.position（旧路径）
        if (vrmDataRef.current?.scene) {
          vrmDataRef.current.scene.position.x = pos.x;
          vrmDataRef.current.scene.position.y = yOffsetRef.current + groundYRef.current;
          vrmDataRef.current.scene.position.z = pos.z;
        }
      }
      const dx = pos.x - pos.prevX;
      const dz = pos.z - pos.prevZ;
      // 镜头跟着角色平移;俯瞰、凑近看屏幕时不跟。镜头正在飞的途中也要把终点一起挪,不然飞到的是旧位置
      if ((dx !== 0 || dz !== 0) && rendererState && !overviewPoseRef.current && !preFocusPoseRef.current) {
        camApi.shift(dx, dz);
        rendererState.camera.position.x += dx;
        rendererState.camera.position.z += dz;
        if (rendererState.controls) {
          rendererState.controls.target.x += dx;
          rendererState.controls.target.z += dz;
        }
      }
      // 4.5 广场:角色朝向 + 地标/星光
      if (inWorld && vrmDataRef.current?.scene && rendererState) {
        const root = vrmDataRef.current.scene;
        // rotateVRM0 会把 VRM0 模型转 180°,朝向要叠在这个基准上
        if (root.userData.baseYaw === undefined) root.userData.baseYaw = root.rotation.y;
        const moved = Math.hypot(dx, dz);
        let targetYaw: number | null = null;
        if (moved > 1e-4) {
          targetYaw = Math.atan2(dx, dz);
          idleSinceRef.current = t;
        } else if (sitRef.current) {
          targetYaw = sitRef.current.yaw;
        } else if (t - idleSinceRef.current > 1.6) {
          // 停下来一会儿就转回来面向镜头(聊天时要看着人)
          const cam = rendererState.camera.position;
          targetYaw = Math.atan2(cam.x - pos.x, cam.z - pos.z);
        }
        if (targetYaw !== null) {
          let d = targetYaw - yawRef.current;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          yawRef.current += d * Math.min(1, dt * (moved > 1e-4 ? 10 : 3));
        }
        root.rotation.y = (root.userData.baseYaw as number) + yawRef.current;
        worldApiRef.current.tick(t, dt, pos, animApiRef.current?.dancing ?? false);
      }
      // 4.9 镜头不进地下:预设机位、飞镜头、拉远都不许低于脚下地面 0.25 米(看不到地底)
      if (rendererState) {
        const minY = (worldOnRef.current ? groundYRef.current : 0) + 0.25;
        if (rendererState.camera.position.y < minY) rendererState.camera.position.y = minY;
      }
      // 5. 统一动画状态机
      animApi.tick(t, dt);
      // 6. scene breath
      const bass = lipApi.audio.poll().bass;
      sceneApi.tick(t, dt, bass, animApiRef.current?.dancing ?? false, 1);
      // 7. camera anim
      camApi.tick(dt);
      {
        const cam = rendererState.camera;
        if (baseFovRef.current === null) baseFovRef.current = cam.fov;
        const want = fovTargetRef.current ?? baseFovRef.current;
        if (Math.abs(cam.fov - want) > 0.05) {
          cam.fov += (want - cam.fov) * Math.min(1, dt * 3.5);
          cam.updateProjectionMatrix();
        }
      }
      // 7. confetti
      if (confettiOn && confettiRef.current && rendererState) {
        updateConfetti((rendererState as any).THREE_NS, confettiRef.current, dt);
      }
      // 8. VRM 内部更新（spring bone / lookAt）
      vrmDataRef.current?.vrm?.update?.(dt);
      // 9. 场景内 UI 面板:摆到角色身侧并朝向相机，然后渲染 CSS3D 层。
      //    放在最后，位置用的是本帧物理修正后的最终坐标，面板不会比角色慢一帧。
      panelApiRef.current.tick({ x: pos.x, y: yOffsetRef.current, z: pos.z });
    });
    rendererApi.start();
    return () => rendererApi.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendererState, autoBlink, confettiOn]);

  // 暴露位置给 UI 显示（每 250ms 更新一次，避免频繁 re-render）
  const [, forceUpdatePos] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceUpdatePos((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  // 数字人位置不做持久化:用户重新进来回到初始位置(0,0,0)。
  // 之前 Phase 2.5 的 session 持久化(mount 拉取恢复 + 每 5s flush + unmount 保存)
  // 已按产品决策移除——数字人状态不跨会话保留,初始位置即默认。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 复位到初始位置(默认 modelId/sceneId 已在 VrmStage 内部处理)
    handleInternalRef.current?.setPosition(0, 0);
    handleInternalRef.current?.setYOffset(0);
  }, []);

  // 暴露 handle — 用 useMemo 直接构造（不用 useImperativeHandle，React 19 行为不稳）
  // handle 引用稳定（deps=[] 只跑一次），方法内部用 ref 读最新值
  const handle: VrmStageHandle = useMemo(() => {
    devLog.debug('[VrmStage] handle 已构造（useMemo, 只跑一次）');
    // 全局调试：方便在控制台测试
    if (typeof window !== 'undefined') {
      (window as any).__vrmStageHandle = null; // 先清空，等下面赋值
    }
    return {
      setEmotion: (dict) => {
        if (!vrmDataRef.current?.expressionManager) { devLog.warn('[VrmStage.setEmotion] expressionManager 未就绪'); return; }
        // Phase 3.2: 走 lerp，不再直接 setValue
        // （chat / 适配规则也走同一个 lerp 通道）
        const filtered: Record<string, number> = {};
        for (const [k, v] of Object.entries(dict)) {
          if (EXPRESSION_PASSTHROUGH.has(k)) filtered[k] = v;
        }
        emotionLerp.setTarget(filtered);
      },
      setViseme: (dict) => {
        if (!vrmDataRef.current?.expressionManager) { devLog.warn('[VrmStage.setViseme] expressionManager 未就绪'); return; }
        devLog.debug('[VrmStage.setViseme] ver=' + vrmVersionRef.current, dict);
        const filtered: Record<string, number> = {};
        for (const [k, v] of Object.entries(dict)) {
          if (EXPRESSION_PASSTHROUGH.has(k)) filtered[k] = v;
        }
        visemeLerp.setTarget(filtered);
      },
      setAction: (name) => {
        devLog.debug('[VrmStage.setAction]', name);
        animStateRef.current.currentAction = name;
        animApiRef.current?.playAction(name);
        // Phase 5: auto-emotion/viseme 适配
        const auto = lookupAutoExpression(name);
        if (auto.expression || auto.viseme) {
          const emotionDict: Record<string, number> = {};
          if (auto.expression) {
            const expCfg = configBundle.expressions.find((e) => e.name === auto.expression);
            if (expCfg) {
              const intensity = auto.intensity ?? 1;
              for (const [k, v] of Object.entries(expCfg.blendshapes)) {
                emotionDict[k] = v * intensity;
              }
            }
          }
          emotionLerp.setTarget(emotionDict);
          if (auto.viseme) {
            visemeLerp.setTarget({ [auto.viseme]: 0.8 });
          }
        }
      },
      setScene: (name) => {
        devLog.debug('[VrmStage.setScene]', name);
        sceneApiRef.current?.setPreset(name);
        rebuildConfetti(name);
      },
      setCameraPreset: (name) => { devLog.debug('[VrmStage.setCameraPreset]', name); camApiRef.current?.switchTo(name); },
      setDanceStyle: (s) => { devLog.debug('[VrmStage.setDanceStyle]', s); animApiRef.current?.setStyle(s); },
      setDanceAmp: (v) => { devLog.debug('[VrmStage.setDanceAmp]', v); animApiRef.current?.setAmp(v); },
      setBpm: (v) => { devLog.debug('[VrmStage.setBpm]', v); animApiRef.current?.setBpm(v); },
      setDancing: (on) => { devLog.debug('[VrmStage.setDancing]', on); animApiRef.current?.setDancing(on); },
      setPose: (name) => { devLog.debug('[VrmStage.setPose]', name); animApiRef.current?.setPose(name); },
      speak: (text, audioUrl, visemes) => {
        devLog.debug('[VrmStage.speak]', text, audioUrl, visemes?.length ? `${visemes.length} frames` : '');
        // 设置口型时间线
        if (visemes && visemes.length > 0) {
          visemeTimelineRef.current = visemes;
          visemeStartTimeRef.current = performance.now();
        }
        // 播放音频
        if (audioUrl) {
          // 确保 audio element 存在
          if (!audioElRef.current) {
            audioElRef.current = document.createElement('audio');
            audioElRef.current.crossOrigin = 'anonymous';
          }
          const el = audioElRef.current;
          // 连接 audio element 到 WebAudio 分析器（用于口型同步）
          lipApiRef.current?.connectElement(el);
          el.onended = () => {
            // 播放结束后清空口型
            visemeTimelineRef.current = [];
          };
          el.src = audioUrl;
          el.play().catch((e) => {
            devLog.warn('[VrmStage.speak] audio play failed:', e);
          });
        }
      },
      setVisemeTimeline: (timeline) => {
        devLog.debug('[VrmStage.setVisemeTimeline]', timeline.length, 'frames');
        visemeTimelineRef.current = timeline;
        visemeStartTimeRef.current = performance.now();
      },
      setUserLipOverride: (on) => { devLog.debug('[VrmStage.setUserLipOverride]', on); userLipOverrideRef.current = on; },
      setUserBlinkOverride: (on) => { devLog.debug('[VrmStage.setUserBlinkOverride]', on); userBlinkOverrideRef.current = on; },
      setScenePanelVisible: (on) => {
        devLog.debug('[VrmStage.setScenePanelVisible]', on);
        panelApiRef.current.setVisible(on);
      },
      setDisplaysVisible: (on) => {
        devLog.debug('[VrmStage.setDisplaysVisible]', on);
        panelApiRef.current.setDisplaysVisible(on);
      },
      focusDisplay: (slot) => {
        const cam = camApiRef.current;
        const rs = rendererStateRef.current;
        if (!cam || !rs) return;
        if (!slot) {
          const back = preFocusPoseRef.current;
          preFocusPoseRef.current = null;
          if (back) cam.flyTo(back.pos, back.target);
          return;
        }
        if (!preFocusPoseRef.current) preFocusPoseRef.current = cam.getPose();
        const pose = displayFocusPose(DISPLAY_SPECS[slot], rs.camera.fov, rs.camera.aspect);
        cam.flyTo(pose.pos, pose.target);
      },
      connectAudioElement: (el) => {
        devLog.debug('[VrmStage.connectAudioElement]');
        lipApiRef.current?.connectElement(el);
      },
      setConfetti: (on) => {
        devLog.debug('[VrmStage.setConfetti]', on);
        setConfettiOn(on);
        if (on) rebuildConfetti(sceneApiRef.current?.preset ?? 'concert');
        else removeConfetti();
      },
      startSong: () => { devLog.debug('[VrmStage.startSong]'); lipApiRef.current?.startSong(); },
      stopSong: () => { devLog.debug('[VrmStage.stopSong]'); lipApiRef.current?.stopSong(); },
      startMic: async () => { devLog.debug('[VrmStage.startMic]'); const ok = await lipApiRef.current?.startMic() ?? false; devLog.debug('[VrmStage.startMic] result=', ok); return ok; },
      stopMic: () => { devLog.debug('[VrmStage.stopMic]'); lipApiRef.current?.stopMic(); },
      move: (target, opts = {}) => {
        if (sitRef.current) handleInternalRef.current?.standUp();
        const durationMs = opts.durationMs ?? 1500;
        const style = opts.style ?? 'walk';
        // target 解析
        let tx = positionRef.current.x, tz = positionRef.current.z;
        if (target === 'left') { tx -= 2; }
        else if (target === 'right') { tx += 2; }
        else if (target === 'forward') { tz -= 2; }
        else if (target === 'back') { tz += 2; }
        else if (target === 'center') { tx = 0; tz = 0; }
        else if (typeof target === 'object') { tx = target.x ?? tx; tz = target.z ?? tz; }
        // 边界:广场里收进广场(绕开地标),否则限制在 ±6
        if (worldOnRef.current) {
          ({ x: tx, z: tz } = clampToWorld(tx, tz, worldDefRef.current, worldApiRef.current.obstacles(groundYRef.current)));
        } else {
          tx = Math.max(-6, Math.min(6, tx));
          tz = Math.max(-6, Math.min(6, tz));
        }
        devLog.debug(`[VrmStage.move] style=${style} duration=${durationMs}ms from=(${positionRef.current.x.toFixed(2)}, ${positionRef.current.z.toFixed(2)}) to=(${tx.toFixed(2)}, ${tz.toFixed(2)})`);
        walkRef.current.style = style;
        if (style === 'teleport') {
          positionRef.current.prevX = positionRef.current.x;
          positionRef.current.prevZ = positionRef.current.z;
          positionRef.current.x = tx;
          positionRef.current.z = tz;
          walkRef.current.moving = false;
          return;
        }
        moveAnimRef.current = {
          active: true,
          startTime: performance.now(),
          duration: durationMs,
          fromX: positionRef.current.x,
          fromZ: positionRef.current.z,
          toX: tx, toZ: tz,
          style,
        };
        walkRef.current.moving = true;
        walkStepRef.current = 0;
      },
      setPosition: (x, z) => {
        devLog.debug(`[VrmStage.setPosition] (${x}, ${z})`);
        positionRef.current.prevX = positionRef.current.x;
        positionRef.current.prevZ = positionRef.current.z;
        const c = worldOnRef.current ? clampToWorld(x, z, worldDefRef.current, worldApiRef.current.obstacles(groundYRef.current)) : { x: Math.max(-6, Math.min(6, x)), z: Math.max(-6, Math.min(6, z)) };
        positionRef.current.x = c.x;
        positionRef.current.z = c.z;
        walkRef.current.moving = false;
      },
      setYOffset: (y) => {
        devLog.debug(`[VrmStage.setYOffset] y=${y}`);
        yOffsetRef.current = y;
        // 同步给物理世界：否则下一帧 step 会用旧的 footOffsetY 覆盖回来
        if (modelMetricsRef.current) {
          modelMetricsRef.current.footOffsetY = y;
          physics.setModelMetrics(modelMetricsRef.current);
        }
        if (vrmDataRef.current?.scene) vrmDataRef.current.scene.position.y = y;
      },
      getPosition: () => ({ x: positionRef.current.x, z: positionRef.current.z }),
      getScreenshot: () => {
        const r = (rendererStateRef.current as any)?.renderer;
        if (!r) return null;
        try { return r.domElement.toDataURL('image/png'); } catch { return null; }
      },
      walkTo: (x, z) => {
        const target = worldOnRef.current ? clampToWorld(x, z, worldDefRef.current, worldApiRef.current.obstacles(groundYRef.current)) : { x, z };
        const d = Math.hypot(target.x - positionRef.current.x, target.z - positionRef.current.z);
        if (d < 0.05) return;
        const style = d > 6 ? 'run' : 'walk';
        const speed = style === 'run' ? 3.4 : 1.45; // 真人速度(动捕步态按走过的距离推进)
        handleInternalRef.current?.move({ x: target.x, z: target.z }, { durationMs: Math.max(350, (d / speed) * 1000), style });
      },
      floatText: (text, color) => {
        const p = positionRef.current;
        const h = modelMetricsRef.current?.height ?? 1.6;
        worldApiRef.current.floatText(text, p.x, h + 0.15, p.z, color);
      },
      setOverview: (on) => {
        const cam = camApiRef.current;
        if (!cam) return;
        if (on) {
          if (!overviewPoseRef.current) overviewPoseRef.current = cam.getPose();
          fovTargetRef.current = 55;
          const c = rendererStateRef.current?.controls;
          if (c) c.maxDistance = 36;
          // 够高才能越过舞台背景板看到后面的观星台
          cam.flyTo([0, 28, 12], [0, 0, -1.5], 1.4);
        } else {
          const back = overviewPoseRef.current;
          overviewPoseRef.current = null;
          fovTargetRef.current = null;
          const c = rendererStateRef.current?.controls;
          if (c) c.maxDistance = worldOnRef.current ? 24 : 12;
          if (back) {
            // 俯瞰期间角色可能走动过:回到「跟在角色身后」的相对机位
            const p = positionRef.current;
            const off = { x: back.pos[0] - back.target[0], y: back.pos[1] - back.target[1], z: back.pos[2] - back.target[2] };
            cam.flyTo([p.x + off.x, back.target[1] + off.y, p.z + off.z], [p.x, back.target[1], p.z], 1.1);
          }
        }
      },
      getWorldSnapshot: () => {
        if (!worldOnRef.current) return null;
        const rs = rendererStateRef.current;
        const snap = worldApiRef.current.snapshot();
        let camYaw = 0;
        if (rs) {
          const tgt = rs.controls?.target ?? { x: positionRef.current.x, z: positionRef.current.z };
          camYaw = Math.atan2(tgt.x - rs.camera.position.x, tgt.z - rs.camera.position.z);
        }
        return { x: positionRef.current.x, z: positionRef.current.z, yaw: yawRef.current, camYaw, orbs: snap.orbs, zone: snap.zone, peers: snap.peers, characters: snap.characters, sit: sitRef.current?.y ?? null, y: groundYRef.current };
      },
      seatSpots: (id, from) => worldApiRef.current.seatSpots(id, from),
      sitAt: (spot) => {
        moveAnimRef.current.active = false;
        walkRef.current.moving = false;
        // 镜头跟着挪过去(瞬移不带镜头,这里手动平移,和走路时一样)
        const dx = spot.x - positionRef.current.x, dz = spot.z - positionRef.current.z;
        const rs = rendererStateRef.current;
        if (rs && !overviewPoseRef.current && !preFocusPoseRef.current) {
          camApiRef.current?.shift(dx, dz);
          rs.camera.position.x += dx;
          rs.camera.position.z += dz;
          if (rs.controls) { rs.controls.target.x += dx; rs.controls.target.z += dz; }
        }
        positionRef.current.prevX = positionRef.current.x = spot.x;
        positionRef.current.prevZ = positionRef.current.z = spot.z;
        sitRef.current = spot;
      },
      standUp: () => {
        const s = sitRef.current;
        if (!s) return;
        sitRef.current = null;
        const dx = s.approach.x - positionRef.current.x, dz = s.approach.z - positionRef.current.z;
        const rs = rendererStateRef.current;
        if (rs && !overviewPoseRef.current && !preFocusPoseRef.current) {
          camApiRef.current?.shift(dx, dz);
          rs.camera.position.x += dx;
          rs.camera.position.z += dz;
          if (rs.controls) { rs.controls.target.x += dx; rs.controls.target.z += dz; }
        }
        handleInternalRef.current?.setPosition(s.approach.x, s.approach.z);
      },
      sitting: () => sitRef.current,
      setBlockGrid: (grid) => worldApiRef.current.setBlockGrid(grid),
      setTerrain: (t) => worldApiRef.current.setTerrain(t),
      setTerrainWater: (w) => worldApiRef.current.setTerrainWater(w),
      applyTerrainPatch: (p) => worldApiRef.current.applyTerrainPatch(p),
      terrainPick: (x, y) => worldApiRef.current.terrainPick(x, y),
      setTerrainBrush: (b) => worldApiRef.current.setTerrainBrush(b),
      applyBlockOps: (ops) => worldApiRef.current.applyBlockOps(ops),
      setBuilding: (on) => worldApiRef.current.setBuilding(on),
      setDiving: (on) => { diveHoldRef.current = on; },
      inLiquid: () => worldOnRef.current && worldApiRef.current.inLiquid(positionRef.current.x, positionRef.current.z, groundYRef.current),
      blockPick: (x, y) => worldApiRef.current.blockPick(x, y),
      setBlockGhost: (a, b, remove) => worldApiRef.current.setBlockGhost(a, b, remove),
      setPeers: (peers) => worldApiRef.current.setPeers(peers),
      setAura: (value) => worldApiRef.current.setAura(value),
      floatTextAt: (text, x, y, z, color) => worldApiRef.current.floatText(text, x, y, z, color),
      characterSay: (id, text) => worldApiRef.current.characterSay(id, text),
      setPlacements: (list) => worldApiRef.current.setPlacements(list),
      upsertPlacement: (p) => worldApiRef.current.upsertPlacement(p),
      removePlacement: (id) => worldApiRef.current.removePlacement(id),
      selectPlacement: (id) => worldApiRef.current.selectPlacement(id),
      getPlacementGroup: (id) => worldApiRef.current.placementGroup(id),
      captureFrame: (maxW = 640) => {
        const rs = rendererStateRef.current;
        if (!rs?.renderer || !rs.scene || !rs.camera) return null;
        const hidden: import('three').Object3D[] = [];
        rs.scene.traverse((o: import('three').Object3D) => { if (o.userData.noCapture && o.visible) { o.visible = false; hidden.push(o); } });
        try {
          // 没开 preserveDrawingBuffer:画完马上在同一个任务里读
          if (!(worldOnRef.current && worldApiRef.current.render(rs.renderer, rs.scene, rs.camera, performance.now() / 1000))) rs.renderer.render(rs.scene, rs.camera);
          const src = rs.renderer.domElement;
          const W = src.width, H = src.height;
          let cw = W, ch = Math.round((W * 9) / 16);
          if (ch > H) { ch = H; cw = Math.round((H * 16) / 9); }
          const out = document.createElement('canvas');
          out.width = Math.min(maxW, cw);
          out.height = Math.round((out.width * 9) / 16);
          const ctx = out.getContext('2d');
          if (!ctx || !cw || !ch) return null;
          ctx.drawImage(src, (W - cw) / 2, (H - ch) / 2, cw, ch, 0, 0, out.width, out.height);
          return out.toDataURL('image/jpeg', 0.82);
        } catch {
          return null;
        } finally {
          hidden.forEach((o) => { o.visible = true; });
        }
      },
      getThree: () => {
        const rs = rendererStateRef.current;
        if (!rs?.scene || !rs?.camera || !rs?.renderer || !canvasRef.current) return null;
        return { THREE: rs.THREE_NS, scene: rs.scene, camera: rs.camera, renderer: rs.renderer, controls: rs.controls, canvas: canvasRef.current };
      },
      setRoomAlign: (a) => worldApiRef.current.setRoomAlign(a),
      autoFitRoom: () => worldApiRef.current.autoFitRoom(),
      applyAvatarParams: (p) => { avatarParamsRef.current = p; applyAvatarNow(); },
      getAvatarInfo: () => (vrmDataRef.current ? inspectAvatar(vrmDataRef.current.vrm) : null),
      setRoomPeers: (list) => worldApiRef.current.setRoomPeers(list),
      peerSay: (id, text) => worldApiRef.current.peerSay(id, text),
      setPeerVoiceLevels: (fn) => worldApiRef.current.setPeerVoiceLevels(fn),
      enterScene: () => {
        // 瞬移不会带动镜头(镜头只跟走路的位移),所以手动把镜头也挪回舞台前
        moveAnimRef.current.active = false;
        positionRef.current.prevX = positionRef.current.x = 0;
        positionRef.current.prevZ = positionRef.current.z = 1.2;
        yawRef.current = 0;
        overviewPoseRef.current = null;
        fovTargetRef.current = null;
        camApiRef.current?.flyTo([0, 1.2, 5.9], [0, 0.95, 1.2], 0.6);
      },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步给内部 ref（让 forwardRef 的 ref 也能拿到 —— 即使父组件没传 ref）
  handleInternalRef.current = handle;
  if (ref) (ref as React.MutableRefObject<VrmStageHandle | null>).current = handle;
  // 全局调试变量（方便在控制台测试）
  if (typeof window !== 'undefined') {
    (window as any).__vrmStageHandle = handle;
  }

  // useEffect: handle 构造后通知父组件（只触发一次）
  const onReadyCalledRef = useRef(false);
  useEffect(() => {
    if (!onReady) return;
    if (!handle) return;
    if (onReadyCalledRef.current) return;
    onReadyCalledRef.current = true;
    onReady(handle);
  }, [onReady, handle]);

  function rebuildConfetti(_name: ScenePresetName) {
    if (!rendererState || !confettiOn) return;
    const THREE_NS = (rendererState as any).THREE_NS as typeof import('three');
    removeConfetti();
    confettiRef.current = makeConfetti(THREE_NS);
    // 挂到主 scene（彩屑应当浮在整个舞台上）
    rendererState.scene.add(confettiRef.current);
  }
  function removeConfetti() {
    if (confettiRef.current && rendererState) {
      rendererState.scene.remove(confettiRef.current);
      confettiRef.current.geometry.dispose();
      confettiRef.current.material.dispose();
      confettiRef.current = null;
    }
  }

  // resize 容器（WebGL 与 CSS3D 两层要一起跟着容器尺寸走，否则面板会错位）
  useEffect(() => {
    const id = setInterval(() => {
      rendererApi.resize();
      panelApiRef.current.resize();
    }, 250);
    return () => clearInterval(id);
  }, [rendererApi]);

  return (
    <Box ref={setStageEl} sx={{ position: 'relative', width: '100%', height: '100%', background, ...sx }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', outline: 'none', touchAction: 'none' }}
      />
      {loading && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, pointerEvents: 'none' }}>
          <CircularProgress size={28} sx={{ color: 'rgba(255,255,255,0.6)' }} />
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>加载数字人…</Typography>
        </Box>
      )}
      {error && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Typography sx={{ color: 'error.main', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>{error}</Typography>
        </Box>
      )}
    </Box>
  );
});
