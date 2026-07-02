'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { CurrentUser } from '@/beans/account';
import type { MenuItem } from '@/beans/system';

interface AppState {
  currentUser: CurrentUser | null;
  menuData: MenuItem[];
  dict: any[];
  modules: any[];
  showSearch: boolean;
  search: string;
  moduleTypeShow: any[];
  kfTalkShow: boolean;
  contactTalkShow: boolean;
  kfSingleShow: boolean;
  // 多角色会话状态
  activeAgentId: string | null;
  activeConversationId: string | null;
  agentStack: string[];
}

interface AppContextValue extends AppState {
  setCurrentUser: (user: CurrentUser | null) => void;
  setMenuData: (menu: MenuItem[]) => void;
  setDict: (dict: any[]) => void;
  setModules: (modules: any[]) => void;
  setShowSearch: (show: boolean) => void;
  setSearch: (search: string) => void;
  setModuleTypeShow: (modules: any[]) => void;
  setKfTalkShow: (show: boolean) => void;
  setContactTalkShow: (show: boolean) => void;
  setKfSingleShow: (show: boolean) => void;
  // 多角色操作
  setActiveAgent: (agentId: string | null) => void;
  setActiveConversation: (conversationId: string | null) => void;
  pushAgent: (agentId: string) => void;
  popAgent: () => string | null;
  clearAgentStack: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppContextProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [menuData, setMenuData] = useState<MenuItem[]>([]);
  const [dict, setDict] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [moduleTypeShow, setModuleTypeShow] = useState<any[]>([]);
  const [kfTalkShow, setKfTalkShow] = useState(false);
  const [contactTalkShow, setContactTalkShow] = useState(false);
  const [kfSingleShow, setKfSingleShow] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [agentStack, setAgentStack] = useState<string[]>([]);

  const setActiveAgent = useCallback((agentId: string | null) => {
    setActiveAgentId(agentId);
    if (agentId) {
      setAgentStack((prev) => (prev.includes(agentId) ? prev : [...prev, agentId]));
    }
  }, []);

  const setActiveConversation = useCallback((conversationId: string | null) => {
    setActiveConversationId(conversationId);
  }, []);

  const pushAgent = useCallback((agentId: string) => {
    setAgentStack((prev) => [...prev, agentId]);
    setActiveAgentId(agentId);
  }, []);

  const popAgent = useCallback((): string | null => {
    let popped: string | null = null;
    setAgentStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      popped = next.pop() || null;
      return next;
    });
    setActiveAgentId((current) => {
      if (current === popped) {
        const remaining = agentStack.filter((id) => id !== popped);
        return remaining.at(-1) || null;
      }
      return current;
    });
    return popped;
  }, [agentStack]);

  const clearAgentStack = useCallback(() => {
    setAgentStack([]);
    setActiveAgentId(null);
  }, []);

  const value: AppContextValue = {
    currentUser,
    menuData,
    dict,
    modules,
    showSearch,
    search,
    moduleTypeShow,
    kfTalkShow,
    contactTalkShow,
    kfSingleShow,
    activeAgentId,
    activeConversationId,
    agentStack,
    setCurrentUser,
    setMenuData,
    setDict,
    setModules,
    setShowSearch,
    setSearch,
    setModuleTypeShow,
    setKfTalkShow,
    setContactTalkShow,
    setKfSingleShow,
    setActiveAgent,
    setActiveConversation,
    pushAgent,
    popAgent,
    clearAgentStack,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppContextProvider');
  }
  return context;
}
