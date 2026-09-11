'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useUrlTab } from '../components/useUrlTab';
import { CONTENT_HOME_TAB, CONTENT_TAB_ALIASES, CONTENT_TAB_IDS } from './navigation';

export type TabParams = Record<string, string>;

interface ActiveTabContextValue {
  activeTab: string;
  /** 一次性的视图参数(如发布页预选的类型、审核台预选的作品),不进 URL。 */
  tabParams: TabParams;
  setActiveTab: (id: string, params?: TabParams) => void;
}

const ActiveTabContext = createContext<ActiveTabContextValue | null>(null);

/**
 * 创作者中心当前子页面,以 URL 的 ?tab= 为准(见 useUrlTab):新手指引、通知与站内
 * 链接可以直达任意子页面,刷新不丢;切换用 replace,不会在浏览历史里堆积。
 */
export function ActiveTabProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setTab] = useUrlTab(CONTENT_TAB_IDS, CONTENT_HOME_TAB, CONTENT_TAB_ALIASES);
  const [tabParams, setTabParams] = useState<TabParams>({});

  const setActiveTab = useCallback(
    (id: string, params?: TabParams) => {
      setTabParams(params ?? {});
      setTab(CONTENT_TAB_ALIASES[id] ?? id);
    },
    [setTab],
  );

  const value = useMemo(() => ({ activeTab, tabParams, setActiveTab }), [activeTab, tabParams, setActiveTab]);
  return <ActiveTabContext.Provider value={value}>{children}</ActiveTabContext.Provider>;
}

export function useActiveTab(): ActiveTabContextValue {
  const ctx = useContext(ActiveTabContext);
  if (!ctx) {
    // Provider 之外(如预渲染阶段)安全降级为无操作。
    return { activeTab: CONTENT_HOME_TAB, tabParams: {}, setActiveTab: () => {} };
  }
  return ctx;
}
