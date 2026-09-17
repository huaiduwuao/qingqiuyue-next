'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * 站内 AI 能力(浮窗小助手 / AI 搜索 / 数字人)的个人开关。
 *
 * 浮窗挂在 providers 里、开关在设置抽屉和数字人介绍页里,几处要同时生效,
 * 所以用一个模块级 store + useSyncExternalStore,而不是各自 useState 读 localStorage
 * (useHomeSettings 那种写法,改了抽屉里的开关,浮窗要刷新页面才知道)。
 * 只存本机:这些是"我想不想看到"的偏好,不是账号数据。
 */
export interface AIPrefs {
  /** 页面右下角的小助手气泡 */
  assistant: boolean;
  /** AI 搜索入口:首页侧栏「AI 助手」、搜索页的 AI 模式切换和提示 */
  aiEntry: boolean;
  /** 已经看过小助手的介绍(气泡旁的引导卡不再出现) */
  introSeen: boolean;
  /** 打开 /digital-human 时跳过介绍页,直接进入对话 */
  skipIntro: boolean;
}

const KEY = 'qq-ai-prefs';
const EVENT = 'qq-ai-prefs-change';

export const AI_PREFS_DEFAULTS: AIPrefs = {
  assistant: true,
  aiEntry: true,
  introSeen: false,
  skipIntro: false,
};

let cache: AIPrefs | null = null;

function read(): AIPrefs {
  if (cache) return cache;
  let stored: Partial<AIPrefs> = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) stored = JSON.parse(raw) as Partial<AIPrefs>;
  } catch {
    /* 隐私模式 / 数据损坏:按默认值 */
  }
  cache = { ...AI_PREFS_DEFAULTS, ...stored };
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

export function setAIPrefs(patch: Partial<AIPrefs>) {
  cache = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* 写不进去也让本页生效 */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function resetAIPrefs() {
  setAIPrefs(AI_PREFS_DEFAULTS);
}

/** 服务端渲染与首帧用默认值,挂载后换成本机偏好。 */
export function useAIPrefs(): [AIPrefs, (patch: Partial<AIPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, read, () => AI_PREFS_DEFAULTS);
  const update = useCallback((patch: Partial<AIPrefs>) => setAIPrefs(patch), []);
  return [prefs, update];
}
