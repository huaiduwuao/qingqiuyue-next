import { contentClient } from '@/lib/api/client';
import type { EntityId } from '@/lib/id';

/**
 * 列表卡片的「能播 / 能读」结论(content-api GET /availability?ids=)。
 *
 * 全站几十处列表各走各的接口,只有推荐流 / 榜单 / 搜索带着 playbackStatus。
 * 卡片拿 id 来问这一个接口,同一轮渲染里的询问合成一次请求(一屏 60 张卡 = 1 个请求),
 * 结果缓存 5 分钟 —— 同一张卡在首页、频道、相关推荐上说法一致。
 */
export interface AvailabilityItem {
  /** play = 视频/音乐/直播;read = 小说/漫画/文章/诗词;none = 壁纸、人物这类无所谓 */
  axis: 'play' | 'read' | 'none';
  status: string;
  ok: boolean;
  readyItems?: number;
  totalItems?: number;
}

const BATCH = 60;
const TTL = 5 * 60 * 1000;
const WAIT_MS = 16;

type Waiter = (v: AvailabilityItem | null) => void;

const cache = new Map<string, { at: number; v: AvailabilityItem | null }>();
const waiting = new Map<string, Waiter[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  timer = null;
  const ids = Array.from(waiting.keys());
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    let items: Record<string, AvailabilityItem> = {};
    try {
      const r: any = await contentClient('availability', { params: { ids: chunk.join(',') } });
      items = (r && r.items) || {};
    } catch {
      // 拿不到就不挂标签;不缓存失败,下一次渲染再问。
      for (const id of chunk) {
        waiting.get(id)?.forEach((w) => w(null));
        waiting.delete(id);
      }
      continue;
    }
    const now = Date.now();
    for (const id of chunk) {
      const v = items[id] ?? null;
      cache.set(id, { at: now, v });
      waiting.get(id)?.forEach((w) => w(v));
      waiting.delete(id);
    }
  }
}

/** 缓存里已有的结论(同步读,首帧就能画出来);没有返回 undefined。 */
export function peekAvailability(id: EntityId): AvailabilityItem | null | undefined {
  const hit = cache.get(String(id));
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  return undefined;
}

/** 问一条内容的结论,自动和同一轮的其它询问合批。 */
export function loadAvailability(id: EntityId): Promise<AvailabilityItem | null> {
  const key = String(id);
  const hit = peekAvailability(key);
  if (hit !== undefined) return Promise.resolve(hit);
  if (!/^\d+$/.test(key)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const list = waiting.get(key);
    if (list) list.push(resolve);
    else waiting.set(key, [resolve]);
    if (!timer) timer = setTimeout(flush, WAIT_MS);
  });
}
