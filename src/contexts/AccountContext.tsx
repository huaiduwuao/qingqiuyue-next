'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface Group {
  id: number;
  name: string;
}

interface AccountContextValue {
  space: 'personal' | 'team';
  setSpace: (space: 'personal' | 'team') => void;
  selectedTeam: Group | null;
  setSelectedTeam: (team: Group | null) => void;
  teamList: Group[];
  setTeamList: (teams: Group[]) => void;
}

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

export function AccountContextProvider({ children }: { children: React.ReactNode }) {
  const [space, setSpace] = useState<'personal' | 'team'>('personal');
  const [selectedTeam, setSelectedTeam] = useState<Group | null>(null);
  const [teamList, setTeamList] = useState<Group[]>([]);

  return (
    <AccountContext.Provider value={{ space, setSpace, selectedTeam, setSelectedTeam, teamList, setTeamList }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within AccountContextProvider');
  }
  return context;
}
