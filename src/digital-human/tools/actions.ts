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
  | 'listen' | 'pray';

export const ALL_ACTIONS: ActionName[] = [
  'idle', 'wave', 'bow', 'nod', 'shake',
  'clap', 'cheer', 'jump', 'walk', 'run',
  'dance', 'sing', 'laugh', 'cry', 'think',
  'point', 'sit', 'sleep', 'stretch', 'greet',
  'salute', 'kiss', 'shrug', 'talk', 'explain',
  'listen', 'pray',
];

/** 中文标签 */
export const ACTION_LABELS: Record<ActionName, string> = {
  idle: '待机', wave: '挥手', bow: '鞠躬', nod: '点头', shake: '摇头',
  clap: '鼓掌', cheer: '欢呼', jump: '跳跃', walk: '走路', run: '跑步',
  dance: '跳舞', sing: '唱歌', laugh: '大笑', cry: '哭泣', think: '思考',
  point: '指示', sit: '坐下', sleep: '睡觉', stretch: '伸懒腰', greet: '行礼',
  salute: '敬礼', kiss: '飞吻', shrug: '摊手', talk: '讲话', explain: '讲解',
  listen: '倾听', pray: '祈祷',
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

/* ─── 动作定义 ─── */
type ActionUpdater = (t: number, blend: number, scene: any, bones: Record<string, any>) => void;

export const ACTION_UPDATERS: Record<ActionName, ActionUpdater> = {
  idle(t, blend, scene, b) {
    const head = b.head || b.Head;
    const chest = b.chest || b.Chest;
    const spine = b.spine || b.Spine;
    const hips = b.hips || b.Hips;
    if (head) {
      head.rotation.y = Math.sin(t * 0.4) * 0.18;
      head.rotation.x = Math.sin(t * 0.7) * 0.08 - 0.02;
      head.rotation.z = Math.sin(t * 0.3) * 0.06;
    }
    if (chest) {
      chest.rotation.x = Math.sin(t * 0.9) * 0.05;
      chest.rotation.y = Math.sin(t * 0.25) * 0.08;
    }
    if (spine) spine.rotation.z = Math.sin(t * 0.4) * 0.04;
    if (hips) hips.rotation.z = Math.sin(t * 0.3) * 0.03;
    scene.position.y = Math.abs(Math.sin(t * 0.9)) * 0.02;
    scene.position.x = Math.sin(t * 0.4) * 0.01;
  },
  wave(t, blend, scene, b) {
    const phase = Math.sin(t * 4);
    const ru = b.rightUpperArm || b.RightUpperArm;
    const rl = b.rightLowerArm || b.RightLowerArm;
    if (ru) ru.rotation.z = -2.5 + phase * 0.4;
    if (rl) rl.rotation.z = -0.3;
    scene.position.y = Math.abs(phase) * 0.02;
  },
  bow(t, blend, scene, b) {
    const chest = b.chest || b.Chest;
    const neck = b.neck || b.Neck;
    const p = t < 1 ? t : Math.max(0, 1 - (t - 1) * 0.7);
    if (chest) chest.rotation.x = p * 0.5;
    if (neck) neck.rotation.x = p * 0.3;
  },
  nod(t, blend, scene, b) {
    const neck = b.neck || b.Neck;
    const head = b.head || b.Head;
    const phase = (t * 2 * Math.PI) % (Math.PI * 2);
    const amp = Math.sin(phase) * Math.exp(-t * 0.5) * 0.25;
    if (neck) neck.rotation.x = amp;
    if (head) head.rotation.x = amp * 0.7;
  },
  shake(t, blend, scene, b) {
    const head = b.head || b.Head;
    const neck = b.neck || b.Neck;
    const phase = Math.sin(t * 6) * Math.exp(-t * 0.4) * 0.4;
    if (head) head.rotation.y = phase;
    if (neck) neck.rotation.y = phase * 0.4;
  },
  clap(t, blend, scene, b) {
    const cycle = (t * 3) % 1;
    const close = Math.sin(cycle * Math.PI);
    const lu = b.leftUpperArm || b.LeftUpperArm;
    const ru = b.rightUpperArm || b.RightUpperArm;
    const ll = b.leftLowerArm || b.LeftLowerArm;
    const rl = b.rightLowerArm || b.RightLowerArm;
    if (lu) lu.rotation.z = -0.8;
    if (ru) ru.rotation.z = 0.8;
    if (ll) ll.rotation.z = 1.4 - close * 0.3;
    if (rl) rl.rotation.z = -1.4 + close * 0.3;
  },
  cheer(t, blend, scene, b) {
    const bounce = Math.abs(Math.sin(t * 4));
    const lu = b.leftUpperArm || b.LeftUpperArm;
    const ru = b.rightUpperArm || b.RightUpperArm;
    if (lu) lu.rotation.z = -2.5 + Math.sin(t * 4) * 0.2;
    if (ru) ru.rotation.z = 2.5 + Math.sin(t * 4 + Math.PI) * 0.2;
    scene.position.y = bounce * 0.05;
  },
  jump(t, blend, scene, b) {
    const normT = Math.min(1, t / 1.2);
    const height = normT < 0.5 ? normT * 2 : (1 - (normT - 0.5) * 2);
    scene.position.y = Math.max(0, height * 0.4);
    const bend = (1 - normT) * 0.6;
    const lul = b.leftUpperLeg || b.LeftUpperLeg;
    const rul = b.rightUpperLeg || b.RightUpperLeg;
    const lll = b.leftLowerLeg || b.LeftLowerLeg;
    const rll = b.rightLowerLeg || b.RightLowerLeg;
    if (lul) lul.rotation.x = -bend;
    if (rul) rul.rotation.x = -bend;
    if (lll) lll.rotation.x = bend * 1.5;
    if (rll) rll.rotation.x = bend * 1.5;
    const lu = b.leftUpperArm || b.LeftUpperArm;
    const ru = b.rightUpperArm || b.RightUpperArm;
    if (lu) lu.rotation.z = -2.2 - height * 0.3;
    if (ru) ru.rotation.z = 2.2 + height * 0.3;
  },
  walk(t, blend, scene, b) {
    const phase = Math.sin(t * 5.2);
    const lul = b.leftUpperLeg || b.LeftUpperLeg;
    const rul = b.rightUpperLeg || b.RightUpperLeg;
    const lll = b.leftLowerLeg || b.LeftLowerLeg;
    const rll = b.rightLowerLeg || b.RightLowerLeg;
    if (lul) lul.rotation.x = phase * 0.45;
    if (rul) rul.rotation.x = -phase * 0.45;
    if (lll) lll.rotation.x = Math.max(0, -phase * 0.4);
    if (rll) rll.rotation.x = Math.max(0, phase * 0.4);
    const lua = b.leftUpperArm || b.LeftUpperArm;
    const rua = b.rightUpperArm || b.RightUpperArm;
    if (lua) lua.rotation.x = -phase * 0.3;
    if (rua) rua.rotation.x = phase * 0.3;
    scene.position.y = Math.abs(Math.sin(t * 5.2)) * 0.025;
    scene.position.x = Math.sin(t * 5.2 / 2) * 0.06;
  },
  run(t, blend, scene, b) {
    const phase = Math.sin(t * 9);
    const lul = b.leftUpperLeg || b.LeftUpperLeg;
    const rul = b.rightUpperLeg || b.RightUpperLeg;
    const lll = b.leftLowerLeg || b.LeftLowerLeg;
    const rll = b.rightLowerLeg || b.RightLowerLeg;
    if (lul) lul.rotation.x = phase * 0.7;
    if (rul) rul.rotation.x = -phase * 0.7;
    if (lll) lll.rotation.x = Math.max(0, -phase * 0.6);
    if (rll) rll.rotation.x = Math.max(0, phase * 0.6);
    const lua = b.leftUpperArm || b.LeftUpperArm;
    const rua = b.rightUpperArm || b.RightUpperArm;
    if (lua) lua.rotation.x = -phase * 0.55;
    if (rua) rua.rotation.x = phase * 0.55;
    scene.position.y = Math.abs(Math.sin(t * 9)) * 0.05;
    scene.position.x = Math.sin(t * 9 / 2) * 0.1;
  },
  dance(t, blend, scene, b) {
    const hips = b.hips || b.Hips;
    const chest = b.chest || b.Chest;
    const lu = b.leftUpperArm || b.LeftUpperArm;
    const ru = b.rightUpperArm || b.RightUpperArm;
    if (hips) {
      hips.rotation.y = t * 1.2;
      hips.rotation.z = Math.sin(t * 2) * 0.15;
    }
    if (chest) chest.rotation.z = Math.sin(t * 2) * 0.25;
    if (lu) lu.rotation.z = -2.5 + Math.sin(t * 2.5) * 0.6;
    if (ru) ru.rotation.z = 2.5 + Math.sin(t * 2.5 + Math.PI) * 0.6;
    scene.position.y = Math.abs(Math.sin(t * 4)) * 0.05;
    scene.position.x = Math.sin(t * 2) * 0.04;
  },
  sing(t, blend, scene, b) {
    const neck = b.neck || b.Neck;
    const chest = b.chest || b.Chest;
    if (neck) neck.rotation.x = -0.15 + Math.sin(t * 3) * 0.05;
    if (chest) {
      chest.rotation.x = -0.05;
      chest.rotation.y = Math.sin(t * 1.5) * 0.15;
    }
    const ru = b.rightUpperArm || b.RightUpperArm;
    if (ru) ru.rotation.z = 1.0;
    scene.position.y = Math.abs(Math.sin(t * 2.5)) * 0.025;
  },
  laugh(t, blend, scene, b) {
    const chest = b.chest || b.Chest;
    const head = b.head || b.Head;
    const phase = Math.sin(t * 6) * 0.15;
    if (chest) {
      chest.rotation.x = phase * 0.3;
      chest.rotation.z = phase * 0.3;
    }
    if (head) {
      head.rotation.x = -0.05 + Math.abs(phase) * 0.2;
      head.rotation.z = phase * 0.2;
    }
    scene.position.y = Math.abs(Math.sin(t * 4)) * 0.04;
  },
  cry(t, blend, scene, b) {
    const head = b.head || b.Head;
    const spine = b.spine || b.Spine;
    const breath = Math.sin(t * 2) * 0.05;
    if (head) {
      head.rotation.x = 0.25 + breath;
      head.rotation.z = Math.sin(t * 1.3) * 0.08;
    }
    if (spine) spine.rotation.x = 0.15;
  },
  think(t, blend, scene, b) {
    const neck = b.neck || b.Neck;
    const ru = b.rightUpperArm || b.RightUpperArm;
    const rl = b.rightLowerArm || b.RightLowerArm;
    if (neck) neck.rotation.z = 0.25 + Math.sin(t * 0.5) * 0.05;
    if (ru) ru.rotation.z = -1.6;
    if (rl) rl.rotation.x = -1.2;
    scene.position.y = Math.abs(Math.sin(t * 0.6)) * 0.015;
  },
  point(t, blend, scene, b) {
    const ru = b.rightUpperArm || b.RightUpperArm;
    const rl = b.rightLowerArm || b.RightLowerArm;
    const neck = b.neck || b.Neck;
    if (ru) ru.rotation.z = -1.6;
    if (rl) rl.rotation.x = -0.2;
    if (neck) neck.rotation.x = -0.1;
  },
  sit(t, blend, scene, b) {
    scene.position.y = -0.35;
    const lul = b.leftUpperLeg || b.LeftUpperLeg;
    const rul = b.rightUpperLeg || b.RightUpperLeg;
    if (lul) lul.rotation.x = -1.5;
    if (rul) rul.rotation.x = -1.5;
  },
  sleep(t, blend, scene, b) {
    const neck = b.neck || b.Neck;
    const head = b.head || b.Head;
    const breath = Math.sin(t * 0.6) * 0.05;
    scene.position.y = -0.05;
    if (neck) neck.rotation.x = 0.4 + breath;
    if (head) head.rotation.x = 0.6;
  },
  stretch(t, blend, scene, b) {
    const phase = t < 2 ? t / 2 : (t < 3.5 ? 1 : Math.max(0, 1 - (t - 3.5) * 2));
    const lu = b.leftUpperArm || b.LeftUpperArm;
    const ru = b.rightUpperArm || b.RightUpperArm;
    if (lu) lu.rotation.z = -2.7 * phase;
    if (ru) ru.rotation.z = 2.7 * phase;
    const head = b.head || b.Head;
    if (head) head.rotation.x = -0.2 * phase;
    scene.position.y = Math.sin(t * 2) * 0.02 * phase;
  },
  greet(t, blend, scene, b) {
    const head = b.head || b.Head;
    const neck = b.neck || b.Neck;
    const nod = Math.sin(t * Math.PI * 2) * 0.15 * Math.exp(-t * 0.5);
    if (head) head.rotation.x = nod;
    if (neck) neck.rotation.x = nod * 0.5;
    const ru = b.rightUpperArm || b.RightUpperArm;
    const rl = b.rightLowerArm || b.RightLowerArm;
    if (ru) ru.rotation.z = -2.4;
    if (rl) rl.rotation.z = -0.3;
  },
  salute(t, blend, scene, b) {
    const ru = b.rightUpperArm || b.RightUpperArm;
    const rl = b.rightLowerArm || b.RightLowerArm;
    if (ru) ru.rotation.z = -2.5;
    if (rl) rl.rotation.z = -0.6;
    const head = b.head || b.Head;
    if (head) head.rotation.x = -0.05;
  },
  kiss(t, blend, scene, b) {
    const ru = b.rightUpperArm || b.RightUpperArm;
    const rl = b.rightLowerArm || b.RightLowerArm;
    if (ru) ru.rotation.z = -1.8;
    if (rl) rl.rotation.x = -0.5;
    const head = b.head || b.Head;
    if (head) {
      head.rotation.x = -0.2;
      head.rotation.z = 0.2 * Math.sin(t * 8);
    }
  },
  shrug(t, blend, scene, b) {
    const normT = Math.min(1, t / 1.5);
    const lu = b.leftUpperArm || b.LeftUpperArm;
    const ru = b.rightUpperArm || b.RightUpperArm;
    if (lu) { lu.rotation.z = -1.6 * normT; lu.rotation.x = -0.4 * normT; }
    if (ru) { ru.rotation.z = 1.6 * normT; ru.rotation.x = -0.4 * normT; }
    const head = b.head || b.Head;
    if (head) head.rotation.z = Math.sin(t * Math.PI) * 0.1 * normT;
  },
  talk(t, blend, scene, b) {
    const chest = b.chest || b.Chest;
    if (chest) chest.rotation.x = Math.sin(t * 3) * 0.05;
    scene.position.y = Math.abs(Math.sin(t * 3)) * 0.02;
  },
  explain(t, blend, scene, b) {
    const lu = b.leftUpperArm || b.LeftUpperArm;
    const ru = b.rightUpperArm || b.RightUpperArm;
    const ll = b.leftLowerArm || b.LeftLowerArm;
    const rl = b.rightLowerArm || b.RightLowerArm;
    if (lu) lu.rotation.z = -1.0 + Math.sin(t * 1.5) * 0.3;
    if (ru) ru.rotation.z = 1.0 + Math.sin(t * 1.5 + Math.PI) * 0.3;
    if (ll) ll.rotation.x = -0.3;
    if (rl) rl.rotation.x = -0.3;
    scene.position.y = Math.abs(Math.sin(t * 1.2)) * 0.018;
  },
  listen(t, blend, scene, b) {
    const neck = b.neck || b.Neck;
    const head = b.head || b.Head;
    if (neck) neck.rotation.z = 0.18;
    if (head) {
      head.rotation.y = Math.sin(t * 0.6) * 0.1;
      head.rotation.x = Math.sin(t * 0.4) * 0.06 - 0.04;
    }
    scene.position.y = Math.abs(Math.sin(t * 0.7)) * 0.018;
  },
  pray(t, blend, scene, b) {
    const lu = b.leftUpperArm || b.LeftUpperArm;
    const ru = b.rightUpperArm || b.RightUpperArm;
    const ll = b.leftLowerArm || b.LeftLowerArm;
    const rl = b.rightLowerArm || b.RightLowerArm;
    if (lu) lu.rotation.z = -0.6;
    if (ru) ru.rotation.z = 0.6;
    if (ll) ll.rotation.x = -1.2;
    if (rl) rl.rotation.x = -1.2;
    const head = b.head || b.Head;
    if (head) head.rotation.x = -0.1;
  },
};
