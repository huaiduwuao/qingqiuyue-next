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
