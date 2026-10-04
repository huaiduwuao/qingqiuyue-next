/**
 * vrm/world/worldLayout.ts — 数字人广场的布局与玩法规则(纯数据 + 纯函数,不依赖 three)
 *
 * 舞台(原点附近,三块显示器在它身后)是广场的中心;外面一圈是能走过去的地标,
 * 地上散着能捡的星光,每天有几条小任务。3D 构建见 buildWorld.ts,每帧逻辑见 useVrmWorld.ts。
 *
 * 坐标:x 向右,z 朝向默认机位(+z 是镜头这一侧),单位米。
 *
 * 2026-09-30:场景由后台维护(plaza_scene / plaza_character,见 Go plazaapp)。一个场景 = 一个 WorldDef
 * (一组地标 + 配色 + 中央舞台预设);这里的 WORLD_ZONES / DEFAULT_WORLD 是星光广场的默认值,
 * 接口拿不到时兜底用。所有几何函数都带一个 def 参数,默认就是星光广场。
 */

export const WORLD_RADIUS = 17;
/** 舞台中心留空的半径:星光不刷在这里,免得跟显示器/面板挤在一起 */
export const STAGE_CLEAR_RADIUS = 3.2;

/** 地标标识。星光广场是 dance/jukebox/wish/cinema/books/stars;其它场景由后台配置 */
export type ZoneId = string;

/** 地标画成什么样(星光广场的六个 + 感悟庭院用的几种中式造型) */
export type ZoneProp = 'dance' | 'jukebox' | 'wish' | 'cinema' | 'books' | 'stars' | 'pavilion' | 'stele' | 'lantern' | 'willow' | 'moongate';
/** 走进地标时面板里摆什么 */
export type ZoneFeedKind = 'cinema' | 'jukebox' | 'books' | 'dance' | 'stars' | 'wish' | 'insight' | 'none';

export interface WorldZone {
  id: ZoneId;
  label: string;
  emoji: string;
  /** 走进范围后提示卡上的一句话 */
  hint: string;
  /** 互动按钮上的字 */
  actionLabel: string;
  x: number;
  z: number;
  /** 进入这个半径算「到了」 */
  radius: number;
  /** 地标实体的半径:角色走不进去 */
  solidRadius: number;
  color: number;
  /**
   * 互动时回灌给数字人的一句话;为空 = 只在本地触发效果(舞池、观星台)。
   * 这些句子会走正常的对话流程,由模型决定调哪个工具(放歌、开屏幕……)。
   */
  prompt?: string;
  /** 造型;缺省按 id(星光广场六个地标 id 即造型) */
  prop?: ZoneProp;
  /** 面板内容;缺省按 id */
  feed?: ZoneFeedKind;
  /** feed=insight 时的感悟主题 */
  themeKey?: string;
}

export const WORLD_ZONES: WorldZone[] = [
  { id: 'dance', label: '舞池', emoji: '💃', hint: '灯光地板,一起跳一支', actionLabel: '跳舞', x: -8, z: 2, radius: 2.6, solidRadius: 0, color: 0xff4fd8 },
  { id: 'jukebox', label: '点唱机', emoji: '🎵', hint: '让她挑一首合你心情的歌', actionLabel: '点一首歌', x: 8, z: 2, radius: 2.2, solidRadius: 0.75, color: 0xffb74f, prompt: '我在点唱机前面,按我现在的心情放一首歌吧' },
  { id: 'wish', label: '许愿池', emoji: '⛲', hint: '投一枚星光,许个愿', actionLabel: '许愿', x: 0, z: 10, radius: 2.8, solidRadius: 1.7, color: 0x4fd8ff, prompt: '我在许愿池许了一个愿,送我一句温暖的祝福吧' },
  { id: 'cinema', label: '放映亭', emoji: '🎬', hint: '挑一部片子,在大屏上放', actionLabel: '推荐电影', x: -9.5, z: -6, radius: 2.4, solidRadius: 1.1, color: 0x9b6bff, prompt: '推荐一部适合现在看的电影,直接在大屏上打开' },
  { id: 'books', label: '书亭', emoji: '📚', hint: '找本好读的书,竖屏上看', actionLabel: '推荐一本书', x: 9.5, z: -6, radius: 2.4, solidRadius: 1.0, color: 0x6bff9b, prompt: '推荐一本好读的小说,在竖屏上打开' },
  { id: 'stars', label: '观星台', emoji: '🔭', hint: '抬头看看整座广场', actionLabel: '观星', x: 0, z: -11.5, radius: 2.6, solidRadius: 0.6, color: 0xc9d4ff, prompt: '我们在观星台,讲一个关于星空的冷知识' },
];

export const ZONE_BY_ID: Record<string, WorldZone> = Object.fromEntries(WORLD_ZONES.map((z) => [z.id, z]));

/** 一个场景(后台 plaza_scene 的前端形状) */
/** 房间外壳模板(创世:每人一间房) */
export type RoomTemplate = 'study' | 'courtyard' | 'loft' | 'empty' | 'splat';

/** 泼溅外壳的对齐:平移 / 缩放 / 旋转(弧度) */
export interface RoomShellAlign { x: number; y: number; z: number; scale: number; rotX: number; rotY: number; rotZ: number }

/** 房间的形状(一间房 = 一个 WorldDef,kind = 'room',key = "room:<房主 uid>") */
export interface WorldRoomInfo {
  ownerId: string;
  ownerName: string;
  /** 是不是我自己的房间(只有房主能布置) */
  mine: boolean;
  template: RoomTemplate;
  /** template = splat 时:泼溅文件地址(已经过 mediaUrl) */
  splatUrl?: string;
  /** 精简档(≤ 40 万点):流畅画质用;没有就用 splatUrl */
  splatLiteUrl?: string;
  splatKey?: string;
  shell?: RoomShellAlign;
}

/** 各模板的可走范围(半宽 x / 半深 z,米)。房间开口朝 +z(镜头那边) */
export const ROOM_SIZES: Record<RoomTemplate, { hx: number; hz: number }> = {
  study: { hx: 5, hz: 4 },
  loft: { hx: 6, hz: 4.5 },
  courtyard: { hx: 8, hz: 7 },
  empty: { hx: 9, hz: 9 },
  splat: { hx: 12, hz: 12 },
};

export const ROOM_TEMPLATE_LABELS: Record<RoomTemplate, string> = {
  study: '书斋', loft: '阁楼', courtyard: '庭院', empty: '空地', splat: '扫描的真实空间',
};

export function roomBounds(def: WorldDef): { hx: number; hz: number } | null {
  if (def.kind !== 'room' || !def.room) return null;
  return ROOM_SIZES[def.room.template] ?? ROOM_SIZES.study;
}

export interface WorldDef {
  key: string;
  name: string;
  intro?: string;
  kind: 'plaza' | 'insight' | 'room';
  /** kind = room:房间信息 */
  room?: WorldRoomInfo;
  /** kind=insight:感悟分组 wound / bond / qiqing / liuyu */
  group?: string;
  /** 中央舞台用哪个场景预设 */
  stage: string;
  palette?: { ground?: number; path?: number; accent?: number };
  /** 环境:时辰、天气、有没有草;缺省按场景类型(见 worldEnv) */
  env?: { time?: string; weather?: string; grass?: boolean; style?: 'stylized' | 'realistic'; assets?: string };
  zones: WorldZone[];
}

/** 场景的环境设置,缺的按类型补:星光广场是夜里 + 萤火;感悟庭院是黄昏 + 落花 + 草地;房间是白天、无天气、无草 */
export function worldEnv(def: WorldDef): { time: string; weather: string; grass: boolean; style: 'stylized' | 'realistic'; assets?: string } {
  if (def.kind === 'room') {
    return { time: def.env?.time || 'day', weather: def.env?.weather || 'none', grass: false, style: 'stylized', assets: def.env?.assets || undefined };
  }
  const plaza = def.kind !== 'insight';
  return {
    time: def.env?.time || (plaza ? 'night' : 'dusk'),
    weather: def.env?.weather || (plaza ? 'fireflies' : 'petals'),
    grass: def.env?.grass ?? !plaza,
    style: def.env?.style === 'realistic' ? 'realistic' : 'stylized',
    assets: def.env?.assets || undefined,
  };
}

/** 场景里的人物(后台 plaza_character) */
export interface WorldCharacter {
  id: string;
  sceneKey: string;
  /** 诗人留空名字 = 前端按主题取写得最多的名家 */
  name: string;
  title?: string;
  kind: 'poet' | 'guide';
  /** kind=poet:语料里的作者名(繁体);空 = 自动 */
  poet?: string;
  themeKey?: string;
  /** kind=guide:开口先念这个感悟分组的题记 */
  groupKey?: string;
  /** kind=guide:运营写的台词 */
  lines?: string[];
  x: number;
  z: number;
  color?: number;
}

export const DEFAULT_WORLD: WorldDef = { key: 'plaza', name: '星光广场', kind: 'plaza', stage: 'concert', zones: WORLD_ZONES };

/** 地标造型 / 面板缺省按 id 推(星光广场的老数据没有这两个字段) */
export const zoneProp = (z: WorldZone): ZoneProp => z.prop ?? (z.id as ZoneProp);
export const zoneFeed = (z: WorldZone): ZoneFeedKind => z.feed ?? ((['cinema', 'jukebox', 'books', 'dance', 'stars', 'wish'] as string[]).includes(z.id) ? (z.id as ZoneFeedKind) : 'none');
export const findZone = (def: WorldDef, id: string | null | undefined): WorldZone | null => (id ? def.zones.find((z) => z.id === id) ?? null : null);

/** 角色身体半径(推开地标用) */
const BODY_RADIUS = 0.35;

/**
 * 把目标点收进广场:先拉回世界圆内,再从地标实体里推出来。
 * 所有位置写入(键盘走、点地面、模型的 body.move)都过一遍。
 */
/** 八期:摆设在地上占的那块(绕竖轴转过 rot 的矩形,中心 x/z、半宽 hx/hz,米) */
export interface Obstacle { x: number; z: number; hx: number; hz: number; rot: number; /** 推得动的实体(movable)才带 */ id?: string }

/** (x, z) 在不在这个转过的矩形里(四边各放宽 margin 米) */
export function insideBox(b: Obstacle, x: number, z: number, margin = 0): boolean {
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  const dx = x - b.x, dz = z - b.z;
  return Math.abs(dx * c - dz * s) < b.hx + margin && Math.abs(dx * s + dz * c) < b.hz + margin;
}

/**
 * 把半径 r 的圆(人)从一组转过的矩形(摆设)里推出去:按矩形自己的坐标看,往穿得浅的那条边推。
 * 走两遍,挨着摆的两件之间不会被推进另一件里(推不出去的窄缝就停在原地附近)。
 */
export function pushOutOfBoxes(x: number, z: number, r: number, boxes: readonly Obstacle[]): { x: number; z: number } {
  for (let pass = 0; pass < 2; pass++) {
    let moved = false;
    for (const b of boxes) {
      const c = Math.cos(b.rot), s = Math.sin(b.rot);
      const dx = x - b.x, dz = z - b.z;
      // 世界 → 矩形局部(three 的 rotation.y:局部 (lx, lz) 转到世界是 (lx·c + lz·s, −lx·s + lz·c))
      let lx = dx * c - dz * s;
      let lz = dx * s + dz * c;
      const ex = b.hx + r, ez = b.hz + r;
      if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) continue;
      if (ex - Math.abs(lx) < ez - Math.abs(lz)) lx = (lx < 0 ? -1 : 1) * ex;
      else lz = (lz < 0 ? -1 : 1) * ez;
      x = b.x + lx * c + lz * s;
      z = b.z - lx * s + lz * c;
      moved = true;
    }
    if (!moved) break;
  }
  return { x, z };
}

export function clampToWorld(x: number, z: number, def: WorldDef = DEFAULT_WORLD, obstacles?: readonly Obstacle[]): { x: number; z: number } {
  const rb = roomBounds(def);
  if (rb) {
    // 房间:矩形,贴墙留出身体的宽度;前面(+z)开口那边也收住,不然走出房间掉进湖里
    const mx = rb.hx - BODY_RADIUS - 0.15, mz = rb.hz - BODY_RADIUS - 0.15;
    const box = (px: number, pz: number) => ({ x: Math.max(-mx, Math.min(mx, px)), z: Math.max(-mz, Math.min(mz, pz)) });
    let p = box(x, z);
    // 八期:绕开摆设;推完再收进墙里(贴墙的柜子不会把人推到墙外)
    if (obstacles?.length) {
      const q = pushOutOfBoxes(p.x, p.z, BODY_RADIUS, obstacles);
      p = box(q.x, q.z);
    }
    return p;
  }
  const limit = WORLD_RADIUS - 0.6;
  const r = Math.hypot(x, z);
  if (r > limit) {
    x = (x / r) * limit;
    z = (z / r) * limit;
  }
  for (const zone of def.zones) {
    if (zone.solidRadius <= 0) continue;
    const dx = x - zone.x;
    const dz = z - zone.z;
    const d = Math.hypot(dx, dz);
    const min = zone.solidRadius + BODY_RADIUS;
    if (d < min) {
      // 正好站在圆心上时随便挑个方向(朝镜头那边)推出去
      const nx = d > 1e-6 ? dx / d : 0;
      const nz = d > 1e-6 ? dz / d : 1;
      x = zone.x + nx * min;
      z = zone.z + nz * min;
    }
  }
  if (obstacles?.length) {
    ({ x, z } = pushOutOfBoxes(x, z, BODY_RADIUS, obstacles));
    const r2 = Math.hypot(x, z);
    if (r2 > limit) { x = (x / r2) * limit; z = (z / r2) * limit; }
  }
  return { x, z };
}

/** 角色当前所在的地标(最近且在范围内的那个) */
export function zoneAt(x: number, z: number, def: WorldDef = DEFAULT_WORLD): WorldZone | null {
  let best: WorldZone | null = null;
  let bestD = Infinity;
  for (const zone of def.zones) {
    const d = Math.hypot(x - zone.x, z - zone.z);
    if (d <= zone.radius && d < bestD) { best = zone; bestD = d; }
  }
  return best;
}

/** 走向某个地标时的落脚点:停在地标朝向舞台的那一侧,不钻进实体里 */
export function zoneApproachPoint(zone: WorldZone, def: WorldDef = DEFAULT_WORLD): { x: number; z: number } {
  const d = Math.hypot(zone.x, zone.z) || 1;
  const stand = Math.max(0.2, zone.solidRadius + 0.7);
  return clampToWorld(zone.x - (zone.x / d) * stand, zone.z - (zone.z / d) * stand, def);
}

// ── 星光 ────────────────────────────────────────────────────────────────

export interface Orb {
  id: number;
  x: number;
  z: number;
  /** 金色大星光分数更高,少见 */
  golden: boolean;
}

export const ORB_COUNT = 14;
export const ORB_PICK_RADIUS = 0.75;
export const ORB_POINTS = { normal: 10, golden: 50 } as const;
/** 捡掉一颗后多久在别处补一颗(毫秒) */
export const ORB_RESPAWN_MS = 18_000;

/** 可复现的伪随机(mulberry32),测试和「同一局刷的点一致」都靠它 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 在广场里找一个能放星光的点:不在舞台中心、不在地标里、不贴着别的星光 */
export function pickOrbSpot(rng: () => number, taken: { x: number; z: number }[], def: WorldDef = DEFAULT_WORLD): { x: number; z: number } {
  for (let attempt = 0; attempt < 60; attempt++) {
    // 面积均匀:半径取 sqrt
    const r = STAGE_CLEAR_RADIUS + Math.sqrt(rng()) * (WORLD_RADIUS - 1.6 - STAGE_CLEAR_RADIUS);
    const a = rng() * Math.PI * 2;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    if (def.zones.some((zn) => Math.hypot(x - zn.x, z - zn.z) < Math.max(zn.solidRadius + 0.8, 1.2))) continue;
    if (taken.some((o) => Math.hypot(x - o.x, z - o.z) < 1.6)) continue;
    return { x, z };
  }
  // 实在挤不下就放在外圈一个固定角度上
  const a = rng() * Math.PI * 2;
  return { x: Math.sin(a) * (WORLD_RADIUS - 3), z: Math.cos(a) * (WORLD_RADIUS - 3) };
}

export function spawnOrbs(seed: number, count = ORB_COUNT, def: WorldDef = DEFAULT_WORLD): Orb[] {
  // 房间里不刷星光:那是自己的家,不是玩法场地
  if (def.kind === 'room') return [];
  const rng = makeRng(seed);
  const orbs: Orb[] = [];
  for (let i = 0; i < count; i++) {
    const p = pickOrbSpot(rng, orbs, def);
    orbs.push({ id: i, x: p.x, z: p.z, golden: rng() < 0.12 });
  }
  return orbs;
}

/** 这一帧角色碰到了哪些星光 */
export function orbsInReach(x: number, z: number, orbs: Orb[], reach = ORB_PICK_RADIUS): Orb[] {
  return orbs.filter((o) => Math.hypot(x - o.x, z - o.z) <= reach);
}

// ── 任务与等级 ──────────────────────────────────────────────────────────

export type GameEvent =
  | { kind: 'orb'; golden: boolean }
  | { kind: 'visit'; zone: ZoneId; insight?: boolean }
  | { kind: 'talk'; character: string }
  | { kind: 'interact'; zone: ZoneId }
  | { kind: 'poke' }
  | { kind: 'chat' };

export interface QuestDef {
  id: string;
  label: string;
  emoji: string;
  target: number;
  /** 这条事件给这个任务加多少进度 */
  progress: (e: GameEvent, st: GameState) => number;
}

export const QUESTS: QuestDef[] = [
  { id: 'orbs', label: '收集 12 颗星光', emoji: '✨', target: 12, progress: (e) => (e.kind === 'orb' ? 1 : 0) },
  {
    id: 'explore', label: '逛遍 4 个地标', emoji: '🧭', target: 4,
    // 只算今天第一次到访的地标
    progress: (e, st) => (e.kind === 'visit' && !st.visited.includes(e.zone) ? 1 : 0),
  },
  { id: 'dance', label: '在舞池跳一支舞', emoji: '💃', target: 1, progress: (e) => (e.kind === 'interact' && e.zone === 'dance' ? 1 : 0) },
  { id: 'wish', label: '去许愿池许个愿', emoji: '⛲', target: 1, progress: (e) => (e.kind === 'interact' && e.zone === 'wish' ? 1 : 0) },
  {
    id: 'ponder', label: '在感悟庭院驻足 3 处', emoji: '🌙', target: 3,
    progress: (e, st) => (e.kind === 'visit' && e.insight && !st.visited.includes(e.zone) ? 1 : 0),
  },
  { id: 'meet', label: '和 2 位人物说说话', emoji: '🗣️', target: 2, progress: (e) => (e.kind === 'talk' ? 1 : 0) },
  { id: 'poke', label: '戳戳她 3 下', emoji: '👉', target: 3, progress: (e) => (e.kind === 'poke' ? 1 : 0) },
  { id: 'chat', label: '和她聊 3 句', emoji: '💬', target: 3, progress: (e) => (e.kind === 'chat' ? 1 : 0) },
];

export const QUEST_XP = 60;

export interface GameState {
  /** 这份进度属于哪一天(本地日期 YYYY-MM-DD),跨天任务清零,经验保留 */
  day: string;
  xp: number;
  /** 累计捡到的星光(不清零) */
  orbsTotal: number;
  quests: Record<string, number>;
  /** 今天已经领过奖的任务 */
  done: string[];
  /** 今天到过的地标 */
  visited: ZoneId[];
}

export function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function emptyGameState(day = localDay()): GameState {
  return { day, xp: 0, orbsTotal: 0, quests: {}, done: [], visited: [] };
}

/** 跨天:任务和到访清零,经验和累计星光保留 */
export function rollDay(st: GameState, day: string): GameState {
  if (st.day === day) return st;
  return { ...st, day, quests: {}, done: [], visited: [] };
}

export interface GameStep {
  state: GameState;
  /** 本次事件直接给的经验(星光) */
  gainedXp: number;
  /** 本次事件完成的任务 */
  completed: QuestDef[];
  levelUp: boolean;
}

export function applyGameEvent(prev: GameState, e: GameEvent, day = localDay()): GameStep {
  const st0 = rollDay(prev, day);
  const quests = { ...st0.quests };
  const done = [...st0.done];
  const completed: QuestDef[] = [];
  for (const q of QUESTS) {
    if (done.includes(q.id)) continue;
    const inc = q.progress(e, st0);
    if (inc <= 0) continue;
    const v = Math.min(q.target, (quests[q.id] ?? 0) + inc);
    quests[q.id] = v;
    if (v >= q.target) { done.push(q.id); completed.push(q); }
  }
  let gainedXp = 0;
  let orbsTotal = st0.orbsTotal;
  if (e.kind === 'orb') {
    gainedXp = e.golden ? ORB_POINTS.golden : ORB_POINTS.normal;
    orbsTotal += 1;
  }
  const visited = e.kind === 'visit' && !st0.visited.includes(e.zone) ? [...st0.visited, e.zone] : st0.visited;
  const xp = st0.xp + gainedXp + completed.length * QUEST_XP;
  const state: GameState = { day: st0.day, xp, orbsTotal, quests, done, visited };
  return { state, gainedXp, completed, levelUp: levelOf(xp).level > levelOf(st0.xp).level };
}

const LEVEL_TITLES = ['初来乍到', '广场常客', '星光收集者', '舞池新星', '许愿达人', '夜空旅人', '广场传说'];

/** 等级:每级所需经验逐级 +100(100, 200, 300 …) */
export function levelOf(xp: number): { level: number; title: string; into: number; need: number } {
  let level = 1;
  let need = 100;
  let rest = Math.max(0, Math.floor(xp));
  while (rest >= need) {
    rest -= need;
    level += 1;
    need += 100;
  }
  return { level, title: LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)], into: rest, need };
}

/** localStorage 里读回来的东西不可信,字段缺了/类型错了都补成默认值 */
export function parseGameState(raw: unknown, day = localDay()): GameState {
  const base = emptyGameState(day);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  const quests: Record<string, number> = {};
  if (r.quests && typeof r.quests === 'object') {
    for (const [k, v] of Object.entries(r.quests as Record<string, unknown>)) quests[k] = num(v);
  }
  // 地标由后台配置,只校验形状(与服务端 plazaapp 的 zoneIDRe 一致)
  const zoneIdRe = /^[a-z][a-z0-9_-]{0,39}$/;
  const st: GameState = {
    day: typeof r.day === 'string' ? r.day : day,
    xp: num(r.xp),
    orbsTotal: num(r.orbsTotal),
    quests,
    done: Array.isArray(r.done) ? r.done.filter((x): x is string => typeof x === 'string') : [],
    visited: Array.isArray(r.visited) ? (r.visited.filter((x) => typeof x === 'string' && zoneIdRe.test(x)) as ZoneId[]).slice(0, 64) : [],
  };
  return rollDay(st, day);
}

/**
 * 本机进度和服务端进度合并(换设备、清缓存后都不丢):经验/累计星光取大;
 * 同一天的任务取各项最大值、完成与到访取并集;不是今天的任务按跨天规则清掉。
 */
export function mergeGameStates(a: GameState, b: GameState, day = localDay()): GameState {
  const x = rollDay(a, day);
  const y = rollDay(b, day);
  const quests: Record<string, number> = { ...x.quests };
  for (const [k, v] of Object.entries(y.quests)) quests[k] = Math.max(quests[k] ?? 0, v);
  return {
    day,
    xp: Math.max(x.xp, y.xp),
    orbsTotal: Math.max(x.orbsTotal, y.orbsTotal),
    quests,
    done: Array.from(new Set([...x.done, ...y.done])),
    visited: Array.from(new Set([...x.visited, ...y.visited])),
  };
}

// ── 戳一戳 ──────────────────────────────────────────────────────────────

export interface PokeReaction {
  action: string;
  emotion: string;
  text: string;
}

const POKE_REACTIONS: PokeReaction[] = [
  { action: 'jump', emotion: 'surprised', text: '呀!' },
  { action: 'laugh', emotion: 'happy', text: '好痒~' },
  { action: 'wave', emotion: 'happy', text: '嗨~' },
  { action: 'greet', emotion: 'relaxed', text: '找我呀?' },
  { action: 'clap', emotion: 'happy', text: '嘿嘿' },
];
const POKE_ANNOYED: PokeReaction = { action: 'shake', emotion: 'angry', text: '别戳啦!' };

/** 第 n 次戳(从 0 算);短时间连戳 5 下以上会有点小脾气 */
export function pokeReaction(n: number, burst: number): PokeReaction {
  if (burst >= 5) return POKE_ANNOYED;
  return POKE_REACTIONS[((n % POKE_REACTIONS.length) + POKE_REACTIONS.length) % POKE_REACTIONS.length];
}
