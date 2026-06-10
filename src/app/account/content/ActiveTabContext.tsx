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
 * Owns the active sidebar tab. The /account/content/* sub-pages are no longer
 * separate routes — they live in /_views/ and are rendered conditionally by
 * the single /account/content/page.tsx based on this state. That keeps the
 * browser history clean so the top-app-bar back arrow returns the user to
 * wherever they came from before entering the creator workspace.
 */
export function ActiveTabProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTabRaw] = useState<TabId>('content');
  const [tabParams, setTabParams] = useState<TabParams>({});

  const setActiveTab = useCallback((id: TabId, params?: TabParams) => {
    setActiveTabRaw(KNOWN_IDS.has(id) ? id : 'content');
    setTabParams(params ?? {});
  }, []);

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
