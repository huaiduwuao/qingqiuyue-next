'use client';

import { useState, useEffect, useCallback } from 'react';

export type HomeDensity = 'comfortable' | 'compact';
export type HomeLanguage = 'zh-CN' | 'zh-TW' | 'en';
export type HomeDefaultTab = 'home' | 'recommend' | 'follow' | 'friend' | 'live';

export interface HomeSettings {
  density: HomeDensity;
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
  density: 'comfortable',
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
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
