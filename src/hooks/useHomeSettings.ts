'use client';

import { useState, useEffect, useCallback } from 'react';

export type HomeLanguage = 'zh-CN' | 'zh-TW' | 'en';
export type HomeDefaultTab = 'home' | 'recommend' | 'follow' | 'friend' | 'live';

export interface HomeSettings {
  language: HomeLanguage;
  defaultTab: HomeDefaultTab;
  autoplayVideo: boolean;
  autoplaySound: boolean;
  showViewerCount: boolean;
  badgeCount: boolean;
  notifMention: boolean;
  notifComment: boolean;
  notifFollow: boolean;
  notifLive: boolean;
  aiSuggestions: boolean;
  aiHistory: boolean;
  aiVoiceInput: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
}

const STORAGE_KEY = 'home-settings';

const DEFAULTS: HomeSettings = {
  language: 'zh-CN',
  defaultTab: 'home',
  autoplayVideo: true,
  autoplaySound: false,
  showViewerCount: true,
  badgeCount: true,
  notifMention: true,
  notifComment: true,
  notifFollow: true,
  notifLive: true,
  aiSuggestions: true,
  aiHistory: true,
  aiVoiceInput: false,
  reduceMotion: false,
  highContrast: false,
};

function loadSettings(): HomeSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<HomeSettings>) };
  } catch {
    return DEFAULTS;
  }
}

export function useHomeSettings() {
  const [settings, setSettings] = useState<HomeSettings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // 存储被禁用(浏览器屏蔽所有 Cookie / 站点数据、旧版 Safari 无痕配额为 0)时 setItem 会抛;
    // 这个 hook 挂在全局 RealtimeProvider 里,不接住就是整站白屏。存不了只是下次不记得设置。
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* 只保留内存态 */
    }
    // 降级动画:在 <html> 上挂 reduce-motion 标记
    document.documentElement.dataset.reduceMotion = settings.reduceMotion ? '1' : '0';
    document.documentElement.dataset.highContrast = settings.highContrast ? '1' : '0';
  }, [settings, hydrated]);

  const update = useCallback((patch: Partial<HomeSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULTS);
  }, []);

  return { settings, update, reset, hydrated };
}
