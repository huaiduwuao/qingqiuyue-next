'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export interface SystemTab {
  id: string;
  label: string;
  path: string;
}

interface SystemTabContextValue {
  activeTab: SystemTab | null;
  setActiveTab: (tab: SystemTab) => void;
}

const SystemTabContext = createContext<SystemTabContextValue>({
  activeTab: null,
  setActiveTab: () => {},
});

export function SystemTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTabState] = useState<SystemTab | null>(null);

  const setActiveTab = (tab: SystemTab) => {
    setActiveTabState(tab);
  };

  return (
    <SystemTabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </SystemTabContext.Provider>
  );
}

export function useSystemTab() {
  return useContext(SystemTabContext);
}
