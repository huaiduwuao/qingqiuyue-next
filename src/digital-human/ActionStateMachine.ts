/**
 * 动作状态机 —— 把 Agent 输出(文本/情感/动作)翻译成数字人的动作 clip 编排。
 * 对应公众号文章:唤醒→进入,默认站立,回复前思考,讲话循环手势,
 * 关键词触发跳舞/坐下/换装,情感触发表情。
 *
 * 兼容 2D 视频(只关心 action / emotion / mouthOpen)和 3DGS LBS(还关心 pose 数组)。
 * 没设置 pose 时,pose 是 0 数组(rest 姿态,3DGS 数字人保持不动)。
 */
import { AvatarAction, AvatarEmotion, DrivingFrame, KEYWORD_ACTIONS, EMOTION_KEYWORDS, IAvatarStage } from './types';
import { getActionPose, type ActionPoseClip } from './poseLibraries';

type Phase = 'offstage' | 'idle' | 'thinking' | 'speaking' | 'walking' | 'oneshot';

const ONESHOT_ACTIONS: AvatarAction[] = ['greet', 'wave', 'point', 'dance', 'sing', 'sit', 'enter', 'leave'];

/**
 * 情感 → FLAME 表情基默认键(按 FLAME 50 维常见定义,f<idx> 对应名字)。
 * mouthOpen 由音频驱动(mouthOpen 字段),所以这里不重复设 f15(嘴张)。
 */
const EMOTION_BLENDSHAPES: Record<AvatarEmotion, Record<string, number>> = {
  neutral:   {},
  happy:     { f6: 0.5, f7: 0.4 },      // 嘴角上扬 + 颧骨抬
  sad:       { f8: -0.4, f11: 0.2 },   // 嘴角下 + 内眉
  surprised: { f4: 0.7, f5: 0.5 },     // 眉抬 + 眼睁
  thinking:  { f11: 0.3, f12: 0.2 },   // 眉头微皱
};

export class ActionStateMachine {
  private phase: Phase = 'offstage';
  private action: AvatarAction = 'idle';
  private emotion: AvatarEmotion = 'neutral';
  private mouthOpen = 0;
  private raf: number | null = null;
  private oneshotTimer: ReturnType<typeof setTimeout> | null = null;
  private phaseStart = 0;
  private jointCount = 55;
  /** 强制外部姿态(例如实时驱动);非空时跳过内置 pose 库 */
  private overridePose: number[] | null = null;
  /** 当前动作的 pose 片段缓存 */
  private currentClip: ActionPoseClip | null = null;

  constructor(public stage: IAvatarStage) {}

  start() {
    this.transition('enter');
    this.scheduleBackToIdle(1200);
    this.loop();
  }

  stop() {
    if (this.raf != null) cancelAnimationFrame(this.raf);
    if (this.oneshotTimer) clearTimeout(this.oneshotTimer);
    this.raf = null;
  }

  // LLM 回复前
  enterThinking() {
    this.emotion = 'thinking';
    this.transition('thinking');
    this.phase = 'thinking';
  }

  enterSpeaking() {
    if (this.oneshotTimer) clearTimeout(this.oneshotTimer);
    this.transition('speaking');
    this.phase = 'speaking';
  }

  endSpeaking() {
    this.mouthOpen = 0;
    this.scheduleBackToIdle(0);
  }

  enterWalking(durationMs = 1700) {
    this.phase = 'walking';
    this.transition('walk');
    if (this.oneshotTimer) clearTimeout(this.oneshotTimer);
    this.oneshotTimer = setTimeout(() => {
      this.phase = 'idle';
      this.transition('idle');
    }, durationMs);
  }

  setMouthOpen(v: number) {
    this.mouthOpen = Math.max(0, Math.min(1, v));
  }

  setEmotion(e: AvatarEmotion) {
    this.emotion = e;
  }

  /**
   * 直接喂入 SMPL-X 姿态(覆盖内置 pose 库)。
   * 用于:① 外部实时驱动(WebSocket / TTS+viseme);② 调试。
   * 长度应为 jointCount*3(默认 165)。传 null 解除覆盖。
   */
  setOverridePose(pose: number[] | null) {
    this.overridePose = pose;
    if (pose && pose.length >= 3) this.jointCount = Math.floor(pose.length / 3);
  }

  /** 设置实际关节数(从资产 meta 读取),保证 pose 数组长度对齐 */
  setJointCount(n: number) {
    this.jointCount = n;
  }

  applyReply(text: string, explicitAction?: AvatarAction, explicitEmotion?: AvatarEmotion) {
    const emotion = explicitEmotion ?? this.inferEmotion(text);
    if (emotion) this.emotion = emotion;
    const action = explicitAction ?? this.inferAction(text);
    if (action && ONESHOT_ACTIONS.includes(action)) {
      this.playOneShot(action);
    }
  }

  private inferEmotion(text: string): AvatarEmotion | undefined {
    for (const { test, emotion } of EMOTION_KEYWORDS) if (test.test(text)) return emotion;
    return undefined;
  }
  private inferAction(text: string): AvatarAction | undefined {
    for (const { test, action } of KEYWORD_ACTIONS) if (test.test(text)) return action;
    return undefined;
  }

  playOneShot(action: AvatarAction, durationMs = 2500) {
    const prevPhase = this.phase;
    this.transition(action);
    this.phase = 'oneshot';
    if (this.oneshotTimer) clearTimeout(this.oneshotTimer);
    this.oneshotTimer = setTimeout(() => {
      if (action === 'leave') {
        this.phase = 'offstage';
        this.transition('leave');
        return;
      }
      this.phase = prevPhase === 'speaking' ? 'speaking' : 'idle';
      this.transition(prevPhase === 'speaking' ? 'speaking' : 'idle');
    }, durationMs);
  }

  private scheduleBackToIdle(delay: number) {
    if (this.oneshotTimer) clearTimeout(this.oneshotTimer);
    this.oneshotTimer = setTimeout(() => {
      this.phase = 'idle';
      this.transition('idle');
    }, delay);
  }

  private transition(action: AvatarAction) {
    if (this.action !== action) {
      this.action = action;
      this.phaseStart = performance.now();
      this.currentClip = getActionPose(action) ?? null;
    }
  }

  /**
   * 取出当前帧的 SMPL-X axis-angle pose。
   * 优先级:setOverridePose > 内置 pose 库(按 action 插值) > 全 0。
   * 长度对齐 jointCount*3。
   */
  private computePose(): number[] {
    let p: number[];
    if (this.overridePose) p = this.overridePose;
    else if (this.currentClip) p = this.currentClip.sample((performance.now() - this.phaseStart) / 1000);
    else p = new Array(55 * 3).fill(0);
    // 对齐 jointCount*3(资产可能是 24 / 55 关节)
    if (p.length === this.jointCount * 3) return p;
    if (p.length > this.jointCount * 3) return p.slice(0, this.jointCount * 3);
    const out = new Array(this.jointCount * 3).fill(0);
    for (let i = 0; i < Math.min(p.length, out.length); i++) out[i] = p[i];
    return out;
  }

  private loop = () => {
    const frame: DrivingFrame = {
      action: this.action,
      emotion: this.emotion,
      mouthOpen: this.phase === 'speaking' ? this.mouthOpen : 0,
      pose: this.computePose(),
      blendshapes: { ...EMOTION_BLENDSHAPES[this.emotion], f15: this.phase === 'speaking' ? this.mouthOpen : 0 },
    };
    try {
      this.stage.applyFrame(frame);
    } catch (e) {
      // 切 stage 时偶发;忽略单帧
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  get current() {
    return { phase: this.phase, action: this.action, emotion: this.emotion };
  }
}
