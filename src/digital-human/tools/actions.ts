/**
 * 数字人动作库 — VRM humanoid 骨骼直接控制
 *
 * 设计: 每个动作定义一个 update(t, blend, scene, bones) 函数,
 *       在主循环里被 BlenderAvatar 调用。VRM0 / VRM1 都通过 bone 名大小写兼容。
 *
 * 适用场景 (LLM 决策的关键 hint):
 *   idle     — 默认
 *   wave     — 打招呼 / 告别
 *   bow      — 感谢 / 道歉 / 谦虚
 *   nod      — 同意 / 回应"嗯"
 *   shake    — 不同意 / 否认
 *   clap     — 鼓励 / 赞许
 *   cheer    — 兴奋 / 庆贺
 *   jump     — 强调 / 庆祝
 *   walk     — 用户说"走" "散步"
 *   run      — 用户说"快" "急"
 *   dance    — 用户说"跳舞" "庆祝"
 *   sing     — 用户说"唱歌"
 *   laugh    — 与 laugh 表情配合
 *   cry      — 与 cry 表情配合
 *   think    — 配合 thinking 表情
 *   point    — 用户说"那个" "这里"
 *   sit      — 用户说"坐" "休息"
 *   sleep    — 长时间无操作 / 用户说"睡"
 *   stretch  — 起床 / 入场
 *   greet    — 正式问候 (抬手 + 点头)
 *   salute   — 致敬 / 郑重场合
 *   kiss     — 飞吻 / 喜爱
 *   shrug    — 摊手 / "我也不知道"
 *   talk     — 边说边想
 *   explain  — 边讲边比划 (双手前伸)
 *   listen   — 安静等待 (微微歪头)
 *   pray     — 双手合十 (感谢 / 求好运)
 */

export type ActionName =
  | 'idle' | 'wave' | 'bow' | 'nod' | 'shake'
  | 'clap' | 'cheer' | 'jump' | 'walk' | 'run'
  | 'dance' | 'sing' | 'laugh' | 'cry' | 'think'
  | 'point' | 'sit' | 'sleep' | 'stretch' | 'greet'
  | 'salute' | 'kiss' | 'shrug' | 'talk' | 'explain'
  | 'listen' | 'pray'
  | 'groove' | 'idol';

export const ALL_ACTIONS: ActionName[] = [
  'idle', 'wave', 'bow', 'nod', 'shake',
  'clap', 'cheer', 'jump', 'walk', 'run',
  'dance', 'sing', 'laugh', 'cry', 'think',
  'point', 'sit', 'sleep', 'stretch', 'greet',
  'salute', 'kiss', 'shrug', 'talk', 'explain',
  'listen', 'pray',
  'groove', 'idol',
];

/** 中文标签 */
export const ACTION_LABELS: Record<ActionName, string> = {
  idle: '待机', wave: '挥手', bow: '鞠躬', nod: '点头', shake: '摇头',
  clap: '鼓掌', cheer: '欢呼', jump: '跳跃', walk: '走路', run: '跑步',
  dance: '跳舞', sing: '唱歌', laugh: '大笑', cry: '哭泣', think: '思考',
  point: '指示', sit: '坐下', sleep: '睡觉', stretch: '伸懒腰', greet: '行礼',
  salute: '敬礼', kiss: '飞吻', shrug: '摊手', talk: '讲话', explain: '讲解',
  listen: '倾听', pray: '祈祷',
  groove: '节奏律动', idol: '偶像挥手',
};

/** 动作元信息 (含 default duration / 是否 loopable) */
export interface ActionDef {
  duration: number;      // 单次播放时长 (s)
  loopable: boolean;
  /** 应用更精细分类 (描述会用上) */
  category: 'greeting' | 'emote' | 'locomotion' | 'performance' | 'rest' | 'thought' | 'neutral';
  /** 描述 (LLM/Hermes prompt 用) */
  description: string;
  /** 触发关键词 (LLM 路由器参考) */
  triggers: string[];
}

export const ACTION_METADATA: Record<ActionName, ActionDef> = {
  idle: { duration: 6, loopable: true, category: 'neutral', description: '默认待机, 随机头部摆动 + 呼吸', triggers: ['默认', 'idle'] },
  wave: { duration: 3, loopable: false, category: 'greeting', description: '举手挥舞, 打招呼或再见', triggers: ['你好', 'hi', 'hello', '再见', '拜', '招唤'] },
  bow: { duration: 2.5, loopable: false, category: 'greeting', description: '弯腰鞠躬, 表示感谢或道歉', triggers: ['谢谢', '感谢', '抱歉', '对不起', '劳驾', '请'] },
  nod: { duration: 2, loopable: false, category: 'emote', description: '点头示意, 表示同意或肯定', triggers: ['嗯', '是的', '同意', '对', '好'] },
  shake: { duration: 2.5, loopable: false, category: 'emote', description: '摇头示意, 表示否定或婉拒', triggers: ['不', '不要', '不对', '摇头', '否认'] },
  clap: { duration: 3, loopable: true, category: 'performance', description: '双手合拢鼓掌', triggers: ['鼓掌', '拍掌', '鼓励', '加油'] },
  cheer: { duration: 4, loopable: true, category: 'performance', description: '举手挥舞欢呼, 通常伴随蹦跳', triggers: ['耶', '太棒', '庆祝', '胜利', '欢呼', 'yeah'] },
  jump: { duration: 2, loopable: false, category: 'performance', description: '原地起跳, 表示兴奋或强调', triggers: ['跳', '跳跃', '跳起来'] },
  walk: { duration: 1.2, loopable: true, category: 'locomotion', description: '原地走路姿态, 配合 scene.x 位移可横向移动', triggers: ['走', '散步', '过来', '去'] },
  run: { duration: 0.7, loopable: true, category: 'locomotion', description: '原地跑步姿态, 速度更快', triggers: ['跑', '快', '追'] },
  dance: { duration: 2, loopable: true, category: 'performance', description: '跳舞, hips + 手臂大幅摆动', triggers: ['跳舞', 'dance', '来一段', '跳个舞'] },
  sing: { duration: 2, loopable: true, category: 'performance', description: '唱歌姿态, 手放胸前像握话筒', triggers: ['唱歌', 'sing', '来一首'] },
  laugh: { duration: 2.5, loopable: true, category: 'emote', description: '身体笑姿 + 头前倾 (搭配 laugh 表情)', triggers: ['笑', '哈哈', '好笑'] },
  cry: { duration: 3, loopable: true, category: 'emote', description: '低头哭泣姿态 (搭配 cry 表情)', triggers: ['哭', '难过', '伤心'] },
  think: { duration: 4, loopable: true, category: 'thought', description: '歪头思考 (右手托下巴)', triggers: ['想', '思考', '为什么', '怎么'] },
  point: { duration: 2, loopable: false, category: 'emote', description: '手指某处', triggers: ['那个', '这里', '那里', '你看'] },
  sit: { duration: 1, loopable: true, category: 'rest', description: '坐下 (膝盖 90°)', triggers: ['坐', '坐下', '休息'] },
  sleep: { duration: 5, loopable: true, category: 'rest', description: '睡觉 (低头闭眼)', triggers: ['睡', '睡觉'] },
  stretch: { duration: 4, loopable: false, category: 'rest', description: '伸懒腰 (抬手+头仰)', triggers: ['起床', '伸个懒腰'] },
  greet: { duration: 3, loopable: false, category: 'greeting', description: '正式行礼 (抬手 + 点头)', triggers: ['幸会', '你好呀', '初次见面'] },
  salute: { duration: 2, loopable: false, category: 'emote', description: '敬礼', triggers: ['敬礼', '致敬'] },
  kiss: { duration: 1.5, loopable: false, category: 'emote', description: '飞吻', triggers: ['飞吻', '亲一个', '爱你'] },
  shrug: { duration: 2, loopable: false, category: 'emote', description: '摊手 (我不知道 / 无可奈何)', triggers: ['不知道', '没办法', '摊手'] },
  talk: { duration: 2, loopable: true, category: 'thought', description: '讲话姿态 (微动+呼吸)', triggers: ['解释', '说', '讲'] },
  explain: { duration: 3, loopable: true, category: 'thought', description: '讲解姿态 (双手前伸比划)', triggers: ['详细说', '怎么用', '教'] },
  listen: { duration: 4, loopable: true, category: 'thought', description: '安静倾听 (歪头 + 看着对方)', triggers: ['听', '继续说'] },
  pray: { duration: 2.5, loopable: false, category: 'greeting', description: '双手合十 (感谢 / 求好运)', triggers: ['拜托', '感谢', '求求你'] },
  groove: { duration: 0, loopable: true, category: 'performance', description: '节奏律动: 弹跳 + 左右摆胯 + 手臂挥舞 (BPM 驱动)', triggers: ['节奏', '律动', 'groove', '跟着节奏'] },
  idol: { duration: 0, loopable: true, category: 'performance', description: '偶像挥手: 举臂左右摆 (BPM 驱动)', triggers: ['偶像', '挥手', 'idol'] },
};

/**
 * 动作注册表 — 主更新函数
 *
 * 用法 (在 BlenderAvatar 主循环):
 *   const r = useActionController();
 *   r.playAction('wave');
 *   每帧 r.tick(dt, vrm);
 */
export interface ActionController {
  playAction: (name: ActionName, opts?: { speed?: number; blendInMs?: number }) => void;
  getCurrent: () => { name: ActionName; t: number; speed: number };
  stopToIdle: () => void;
  /** 主循环调用 */
  tick: (dt: number, vrm: any) => void;
}

export function createActionController(): ActionController {
  let current: { name: ActionName; t: number; speed: number; blendInMs: number } = {
    name: 'idle', t: 0, speed: 1, blendInMs: 250,
  };

  function playAction(name: ActionName, opts: { speed?: number; blendInMs?: number } = {}) {
    const def = ACTION_METADATA[name] || ACTION_METADATA.idle;
    current = {
      name: def ? name : 'idle',
      t: 0,
      speed: opts.speed ?? 1,
      blendInMs: opts.blendInMs ?? 250,
    };
    // 非 loopable 动作超时回 idle
    if (!def.loopable) {
      setTimeout(() => {
        if (current.name === name) playAction('idle');
      }, def.duration * 1000 + 200);
    }
  }

  function stopToIdle() {
    playAction('idle');
  }

  function tick(dt: number, vrm: any) {
    if (!vrm?.humanoid) return;
    const { bones } = getBones(vrm);
    const def = ACTION_METADATA[current.name] || ACTION_METADATA.idle;

    // 复位 bone 然后应用自然姿态
    for (const node of Object.values<any>(bones)) {
      node.rotation.set(0, 0, 0);
    }
    setNaturalPose(bones);

    // 更新动作进度
    current.t += dt * current.speed;
    const actionFn = ACTION_UPDATERS[current.name] || ACTION_UPDATERS.idle;
    try {
      actionFn(current.t, 1, vrm.scene, bones);
    } catch (e) {
      // ignore single-frame failure
    }
  }

  return {
    playAction,
    getCurrent: () => ({ ...current }),
    stopToIdle,
    tick,
  };
}

/* ─── 骨骼工具 (VRM0/1 兼容) ─── */
const ALL_BONE_NAMES_VRM1: string[] = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftEye', 'rightEye', 'jaw',
];

export function getVRMVersion(v: any): 0 | 1 {
  const ver = (v?.meta?.metaVersion || '').toString();
  return (ver.startsWith('1') || ver.startsWith('2')) ? 1 : 0;
}

export function getBones(v: any): { bones: Record<string, any>; vrmVer: 0 | 1 } {
  const vrmVer = getVRMVersion(v);
  const useV1 = vrmVer === 1;
  const names = useV1
    ? ALL_BONE_NAMES_VRM1
    : Object.keys(v?.humanoid?.humanBones || {});
  const bones: Record<string, any> = {};
  for (const name of names) {
    const b = v.humanoid.getNormalizedBoneNode?.(name);
    if (b) bones[name] = b;
  }
  return { bones, vrmVer };
}

function setNaturalPose(bones: Record<string, any>) {
  const lu = bones.leftUpperArm || bones.LeftUpperArm;
  const ru = bones.rightUpperArm || bones.RightUpperArm;
  const ll = bones.leftLowerArm || bones.LeftLowerArm;
  const rl = bones.rightLowerArm || bones.RightLowerArm;
  const lh = bones.leftHand || bones.LeftHand;
  const rh = bones.rightHand || bones.RightHand;
  if (lu) lu.rotation.z = -1.4;
  if (ru) ru.rotation.z = 1.4;
  if (ll) ll.rotation.x = 0.3;
  if (rl) rl.rotation.x = 0.3;
  if (lh) lh.rotation.x = 0.3;
  if (rh) rh.rotation.x = 0.3;
  const lul = bones.leftUpperLeg || bones.LeftUpperLeg;
  const rul = bones.rightUpperLeg || bones.RightUpperLeg;
  if (lul) lul.rotation.x = -0.1;
  if (rul) rul.rotation.x = -0.1;
}

/* ─── 动作定义（Phase 1.5：从 ConfigBundle formula 动态生成） ─── */
import { loadConfigBundle } from '../vrm/config/loader';
import { safeEvalFormula } from '../vrm/config/loader';
import { getBone } from '../vrm/vrmCompat';

const _actionBundle = loadConfigBundle();
const _actionsByName = new Map(_actionBundle.actions.map((a) => [a.name, a]));

type ActionUpdater = (t: number, blend: number, scene: any, bones: Record<string, any>) => void;

/** 公式版 updater：用 safeEvalFormula 执行 formula，结果应用到 scene/bones */
function makeFormulaUpdater(formula: string | undefined): ActionUpdater {
  return (t, blend, scene, bones) => {
    if (!formula) return;
    const result = safeEvalFormula(formula, { t, blend });
    if (!result || !result.bones) return;
    for (const [bone, rot] of Object.entries(result.bones)) {
      // 兼容 VRM 0.0/1.0：bones 里可能是 camelCase 或 PascalCase
      let o = bones[bone];
      if (!o) {
        const pascal = bone.charAt(0).toUpperCase() + bone.slice(1);
        o = bones[pascal];
      }
      if (o && o.rotation) o.rotation.set(rot[0], rot[1], rot[2]);
    }
    if (typeof result.scenePosY === 'number' && scene?.position) scene.position.y = result.scenePosY;
    if (typeof result.scenePosX === 'number' && scene?.position) scene.position.x = result.scenePosX;
  };
}

/** 兼容导出：从 config bundle 公式构建的 updater 映射 */
export const ACTION_UPDATERS: Record<string, ActionUpdater> = (() => {
  const out: Record<string, ActionUpdater> = {};
  for (const [name, a] of _actionsByName) {
    out[name] = makeFormulaUpdater(a.formula);
  }
  return out;
})();