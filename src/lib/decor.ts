'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { getDecor, type UserDecor } from '@/apis/growth';

/**
 * 用户装扮(头像框 / 称号 / 名字颜色)与等级的批量加载。
 *
 * 一屏里有几十个头像,每个头像各发一次请求不可取:同一帧里要的 id 攒成一次 /user/decor?ids=…,
 * 结果缓存 5 分钟。组件只管 useDecor(userId)。自己换了装扮后调 invalidateDecor(id)。
 */

const TTL = 5 * 60_000;
const BATCH_DELAY = 30;
const BATCH_MAX = 100;

type Entry = { decor: UserDecor | null; at: number };

const cache = new Map<string, Entry>();
const queue = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let version = 0;

const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

async function flush() {
  timer = null;
  const ids = Array.from(queue).slice(0, BATCH_MAX);
  ids.forEach((id) => queue.delete(id));
  if (queue.size > 0) timer = setTimeout(flush, BATCH_DELAY);
  if (ids.length === 0) return;
  const now = Date.now();
  try {
    const list = await getDecor(ids);
    const got = new Map(list.map((d) => [String(d.userId), d]));
    ids.forEach((id) => cache.set(id, { decor: got.get(id) ?? null, at: now }));
  } catch {
    // 装扮只是装饰:失败就按"没有装扮"缓存一小会儿,不重试风暴、不影响头像本身
    ids.forEach((id) => cache.set(id, { decor: null, at: now - TTL + 30_000 }));
  }
  emit();
}

function request(id: string) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) return;
  if (queue.has(id)) return;
  queue.add(id);
  if (!timer) timer = setTimeout(flush, BATCH_DELAY);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useDecor(userId?: string | number | null): UserDecor | null {
  const id = userId ? String(userId) : '';
  useSyncExternalStore(subscribe, () => version, () => 0);
  useEffect(() => {
    if (id && id !== '0') request(id);
  }, [id]);
  return id ? cache.get(id)?.decor ?? null : null;
}

export function invalidateDecor(userId?: string | number | null) {
  if (!userId) return;
  cache.delete(String(userId));
  request(String(userId));
}

/** 头像框/名字颜色的样式值可能是 CSS 渐变、颜色,也可能是图片地址 */
export const decorBackground = (value: string) =>
  /^(https?:)?\/\//.test(value) || value.startsWith('/') ? `url(${value}) center / cover no-repeat` : value;
