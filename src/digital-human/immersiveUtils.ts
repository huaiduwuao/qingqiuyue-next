/**
 * ImmersiveDigitalHuman 用到的纯函数(从组件文件拆出,行为不变)。
 */
import type { ChatLogItem } from './useChatAvatar';
import type { TimeMode } from './vrm/world/env/timeOfDay';
import { roomBounds, type WorldDef } from './vrm/world/worldLayout';

export type AvatarMode = 'vrm' | '3dgs' | '2d';

/** 离开数字人页、又没有可靠的「上一页」时回到这里(和底部导航「首页」默认页签一致) */
export const DIGITAL_HUMAN_EXIT_HOME = '/home/recommend';

/**
 * 点「退出」该怎么走:'back' = 退回上一页,'home' = 直接回首页。
 * - 直接打开进来的(新标签、App 冷启动、外链)历史里只有这一条,history.back() 什么也不做;
 * - 屏幕里开过站内页面(同源 iframe)的话,iframe 里点链接也会记进整页的历史,
 *   history.back() / 安卓返回键先退的是 iframe 里的那一页 —— 看上去就是「点 × 没反应、回不到首页」。
 * 这两种情况都不赌 back,直接回首页。
 */
export function exitMode(historyLength: number, openedPages: boolean): 'back' | 'home' {
  return !openedPages && historyLength > 1 ? 'back' : 'home';
}
export interface GsAssetItem { id: string; name: string; assetUrl: string }

// 相对时间:刚建的会话显示「刚刚」,让"点了新会话"立刻可见
export function relativeTime(iso: string, now: number = Date.now()): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const diff = now - t;
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
export const DEFAULT_TITLES = new Set(['新会话', '未命名会话', '(无标题)']);

export function conversationTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return '新会话';
  return t.length > 50 ? `${t.slice(0, 50)}…` : t;
}

/** 只有最新一组快捷选项还能点,而且得是这一轮的(后面用户又说过话就作废);没有返回 -1 */
export function lastActiveChoicesIndex(chatLog: ChatLogItem[]): number {
  for (let i = chatLog.length - 1; i >= 0 && chatLog[i].who !== 'user'; i--) {
    if (chatLog[i].who === 'choices') return i;
  }
  return -1;
}

/** 时辰按钮:清晨 → 白天 → 黄昏 → 夜晚 → 跟随现在 → 清晨 */
export function nextTimeMode(current: TimeMode): TimeMode {
  const order: TimeMode[] = ['dawn', 'day', 'dusk', 'night', 'auto'];
  return order[(order.indexOf(current) + 1) % order.length];
}

/** /api/realtime/assets 的列表 → 可用的 3DGS 形象资产(就绪、带地址),当前的那份名字后加「(当前)」 */
export function readyGsAssets(list: { id: string; name: string; mode: string; status: string; active?: boolean; assetUrl?: string }[]): GsAssetItem[] {
  return list
    .filter((a) => a.mode === '3dgs' && a.status === 'ready' && a.assetUrl)
    .map((a) => ({ id: a.id, name: a.name + (a.active ? '(当前)' : ''), assetUrl: a.assetUrl as string }));
}

type RoomObject = { id: string; label?: string | null; asset?: { nameZh?: string | null } | null; assetKey: string; x: number; z: number; rotY: number; scale?: number | null };
type RoomPeer = { nickname: string; x: number; z: number; owner?: boolean; ai?: boolean };

/**
 * 创世三期:在房间里时,房间的结构化状态(数字人据此看懂房间,world_place / world_edit / room_design 用坐标和 id)。
 * snap 是舞台的世界快照(取自己的位置),objects / peers 只取前 40 / 20 个。
 */
export function buildRoomState(d: WorldDef, snap: { x: number; z: number } | null | undefined, objects: RoomObject[], peers: RoomPeer[]) {
  const b = roomBounds(d) ?? { hx: 5, hz: 4 };
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return {
    name: d.name,
    owner: d.room?.ownerName ?? '',
    mine: !!d.room?.mine,
    template: d.room?.template ?? 'study',
    size: [b.hx * 2, b.hz * 2] as [number, number],
    me: { x: r1(snap?.x ?? 0), z: r1(snap?.z ?? 0) },
    objects: objects.slice(0, 40).map((p) => ({ id: p.id, label: p.label || p.asset?.nameZh || p.assetKey, x: r1(p.x), z: r1(p.z), deg: Math.round((p.rotY * 180) / Math.PI) % 360, ...(p.scale && p.scale !== 1 ? { scale: r1(p.scale) } : {}) })),
    people: peers.slice(0, 20).map((p) => ({ name: p.nickname, x: r1(p.x), z: r1(p.z), ...(p.owner ? { owner: true } : {}), ...(p.ai ? { ai: true } : {}) })),
  };
}
