'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * 全站内容列表的展示样式:瀑布流 / 网格 / 列表。
 *
 * 切换按钮散在各个列表头部和设置抽屉里,改一处要处处立即生效,
 * 所以和 aiPrefs 一样用模块级 store + useSyncExternalStore;只存本机。
 */
export type ListLayoutMode = 'masonry' | 'grid' | 'list';

export const LIST_LAYOUT_MODES: ListLayoutMode[] = ['masonry', 'grid', 'list'];
export const LIST_LAYOUT_LABEL: Record<ListLayoutMode, string> = {
  masonry: '瀑布流',
  grid: '网格',
  list: '列表',
};

const KEY = 'qq-list-layout';
const EVENT = 'qq-list-layout-change';
const DEFAULT_MODE: ListLayoutMode = 'masonry';

let cache: ListLayoutMode | null = null;

function isMode(v: unknown): v is ListLayoutMode {
  return v === 'masonry' || v === 'grid' || v === 'list';
}

function read(): ListLayoutMode {
  if (cache) return cache;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(KEY);
  } catch {
    /* 隐私模式:按默认值 */
  }
  cache = isMode(stored) ? stored : DEFAULT_MODE;
  return cache;
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function setListLayout(mode: ListLayoutMode) {
  cache = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* 写不进去也让本页生效 */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** 服务端渲染与首帧用默认值,挂载后换成本机偏好。 */
export function useListLayout(): [ListLayoutMode, (mode: ListLayoutMode) => void] {
  const mode = useSyncExternalStore(subscribe, read, () => DEFAULT_MODE);
  const update = useCallback((m: ListLayoutMode) => setListLayout(m), []);
  return [mode, update];
}
