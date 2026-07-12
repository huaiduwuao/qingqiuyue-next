'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { MENU_ITEMS } from './_components/CreatorSidebar';

type TabId = string;

export type TabParams = Record<string, string>;

interface ActiveTabContextValue {
  activeTab: TabId;
  /** Carries view-specific parameters (e.g. which video to pre-select in hd-review). */
  tabParams: TabParams;
  setActiveTab: (id: TabId, params?: TabParams) => void;
}

const ActiveTabContext = createContext<ActiveTabContextValue | null>(null);

const KNOWN_IDS = new Set(MENU_ITEMS.map((m) => m.id));

/**
 * View-only tab ids reachable through legacy deep links. They all redirect
 * to the unified hd-publish dispatcher (with type param), so we keep them
 * accepted here purely to avoid breaking existing setActiveTab calls — but
 * no view maps them anymore.
 */
const VIEW_ONLY_IDS = new Set<string>();

const ALLOWED_IDS = new Set([...KNOWN_IDS, ...VIEW_ONLY_IDS]);

/**
 * Owns the active sidebar tab. The /account/content/* sub-pages are no longer
 * separate routes — they live in /_views/ and are rendered conditionally by
 * the single /account/content/page.tsx based on this state. That keeps the
 * browser history clean so the top-app-bar back arrow returns the user to
 * wherever they came from before entering the creator workspace.
 *
 * 重构后:不再有 12 个 publish-* 子路由,所有 publish 路径都走 hd-publish
 * dispatcher,type 通过 tabParams 传入。
 */
export function ActiveTabProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTabRaw] = useState<TabId>('content');
  const [tabParams, setTabParams] = useState<TabParams>({});

  const setActiveTab = useCallback((id: TabId, params?: TabParams) => {
    setActiveTabRaw(ALLOWED_IDS.has(id) ? id : 'content');
    setTabParams(params ?? {});
  }, []);

  // 兼容旧 API:旧 setActiveTab('image-publish') 等都重定向到 'hd-publish'。
  // 这是页面 transition 时已经传了 type param 时做的兼容;新代码应直接传 'hd-publish'。

  const value = useMemo(
    () => ({ activeTab, tabParams, setActiveTab }),
    [activeTab, tabParams, setActiveTab],
  );
  return <ActiveTabContext.Provider value={value}>{children}</ActiveTabContext.Provider>;
}

export function useActiveTab() {
  const ctx = useContext(ActiveTabContext);
  if (!ctx) {
    // Outside the provider (e.g. during SSR) — fall back to a safe no-op.
    return { activeTab: 'content' as TabId, tabParams: {} as TabParams, setActiveTab: () => {} };
  }
  return ctx;
}
