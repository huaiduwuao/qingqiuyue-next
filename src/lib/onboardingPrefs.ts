'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * 首屏引导偏好 —— 控制 FirstRunGuide 弹窗的显示时机。
 *
 * 模型完全照抄 aiPrefs.ts(模块级 store + useSyncExternalStore):
 *   - 首屏引导是一组"用户希望怎么被介绍"的偏好,不该让弹窗 / 设置抽屉 / 详情页
 *     各自 useState 读 localStorage 后不同步。
 *   - 只存本机;登录同步走 sectionSync 那一套,不在这里重复造轮子。
 *
 * 触发策略:
 *   - completed: true       → 不再弹
 *   - dismissedAt: 时间戳    → 7 天内不再弹(用户点了"先逛逛")
 *   - interests: 内容类型 code → 引导完成时挑出对应预置频道,落进 sectionPrefs
 *   - seenWelcome: true     → /welcome 页打开一次后,把首屏引导的"自我说明"改成简版
 *   - version: 1            → 后续 schema 变更时迁移用
 */

export interface OnboardingPrefs {
  /** 用户走完引导(选了兴趣 + 点进入),不再弹 */
  completed: boolean;
  /** 用户点了"先逛逛"的毫秒时间戳;超过 7 天才再次弹 */
  dismissedAt?: number;
  /** 引导 Step 2 里选的内容类型 code(NOVEL/MUSIC/...),长度 0~5 */
  interests: string[];
  /** 是否进过 /welcome,用于引导文案里去掉重复的"清秋月是什么"段落 */
  seenWelcome: boolean;
  /** 后续 schema 变更时用,旧数据缺字段时按 v1 兜底 */
  version: 1;
}

export const ONBOARDING_VERSION = 1 as const;
export const ONBOARDING_DISMISS_DAYS = 7;

export const ONBOARDING_DEFAULTS: OnboardingPrefs = {
  completed: false,
  interests: [],
  seenWelcome: false,
  version: ONBOARDING_VERSION,
};

const KEY = 'qq-onboarding';
const EVENT = 'qq-onboarding-change';

function normalize(stored: any): OnboardingPrefs {
  const base: OnboardingPrefs = { ...ONBOARDING_DEFAULTS };
  if (!stored || typeof stored !== 'object') return base;
  if (typeof stored.completed === 'boolean') base.completed = stored.completed;
  if (typeof stored.dismissedAt === 'number') base.dismissedAt = stored.dismissedAt;
  if (Array.isArray(stored.interests)) {
    base.interests = stored.interests.filter((c: unknown) => typeof c === 'string').slice(0, 5);
  }
  if (typeof stored.seenWelcome === 'boolean') base.seenWelcome = stored.seenWelcome;
  base.version = ONBOARDING_VERSION;
  return base;
}

let cache: OnboardingPrefs | null = null;

function read(): OnboardingPrefs {
  if (cache) return cache;
  let stored: any = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    /* 隐私模式 / 数据损坏 → 默认值 */
  }
  cache = normalize(stored);
  return cache;
}

function write(next: OnboardingPrefs) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 写不进去也让本页生效 */
  }
  window.dispatchEvent(new Event(EVENT));
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

/** SSR / 首帧用默认值,挂载后换本机偏好(避免 hydration 警告)。 */
const SERVER_SNAPSHOT: OnboardingPrefs = { ...ONBOARDING_DEFAULTS };

export function setOnboardingPrefs(patch: Partial<OnboardingPrefs>) {
  write(normalize({ ...read(), ...patch }));
}

/**
 * 是否应该现在弹引导。
 *   - 已完成 → 不弹
 *   - 7 天内 dismiss 过 → 不弹
 *   - 其余 → 弹
 */
export function shouldShowOnboarding(now: number = Date.now(), prefs = read()): boolean {
  if (prefs.completed) return false;
  if (prefs.dismissedAt) {
    const age = now - prefs.dismissedAt;
    if (age < ONBOARDING_DISMISS_DAYS * 24 * 60 * 60 * 1000) return false;
  }
  return true;
}

export function markOnboardingCompleted(interests: string[]): void {
  setOnboardingPrefs({ completed: true, interests, dismissedAt: undefined });
}

export function dismissOnboarding(): void {
  setOnboardingPrefs({ dismissedAt: Date.now() });
}

export function markWelcomeSeen(): void {
  setOnboardingPrefs({ seenWelcome: true });
}

export function resetOnboarding(): void {
  setOnboardingPrefs({ ...ONBOARDING_DEFAULTS, dismissedAt: undefined });
}

/** SSR-safe hook;组件里再叠加一个 mounted 门控以避开 SSR hydration mismatch。 */
export function useOnboarding(): [OnboardingPrefs, (patch: Partial<OnboardingPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, read, () => SERVER_SNAPSHOT);
  const update = useCallback((patch: Partial<OnboardingPrefs>) => setOnboardingPrefs(patch), []);
  return [prefs, update];
}
