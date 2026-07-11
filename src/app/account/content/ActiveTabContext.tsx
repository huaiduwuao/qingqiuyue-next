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
 * View-only tab ids reachable through in-page actions (e.g. the four
 * "发布视频/图文/全景/文章" cards on the dashboard). They are intentionally
 * NOT shown in the sidebar — the sidebar already has a single "高清发布"
 * entry which currently drives the video publish flow. Image/article/
 * panorama publish flows live behind their own view id, set via
 * NewCreationSection.handleCreate, and are only valid as transient tabs
 * (i.e. not part of the persistent sidebar menu).
 *
 * Keeping them out of MENU_GROUPS also avoids polluting the sidebar with
 * placeholder entries while the corresponding views are still skeletons.
 */
const VIEW_ONLY_IDS = new Set([
  'image-publish',
  'article-publish',
  'panorama-publish',
]);

const ALLOWED_IDS = new Set([...KNOWN_IDS, ...VIEW_ONLY_IDS]);

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
    setActiveTabRaw(ALLOWED_IDS.has(id) ? id : 'content');
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
