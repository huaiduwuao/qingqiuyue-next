'use client';

import React, { createContext, useContext } from 'react';
import { useSpiderWebSocket, SpiderWSState } from '@/hooks/useSpiderWebSocket';

const SpiderRealtimeContext = createContext<SpiderWSState | null>(null);

export function SpiderRealtimeProvider({ children }: { children: React.ReactNode }) {
  const state = useSpiderWebSocket();
  return (
    <SpiderRealtimeContext.Provider value={state}>
      {children}
    </SpiderRealtimeContext.Provider>
  );
}

export function useSpiderRealtime(): SpiderWSState {
  const ctx = useContext(SpiderRealtimeContext);
  if (!ctx) {
    throw new Error('useSpiderRealtime must be used within SpiderRealtimeProvider');
  }
  return ctx;
}
