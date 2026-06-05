'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type MainTab = 'interaction' | 'system' | 'dm';

interface MsgUiState {
  mainTab: MainTab;
  subType: string;
  selectedId: number | null;
  setMainTab: (v: MainTab) => void;
  setSubType: (v: string) => void;
  setSelectedId: (v: number | null) => void;
}

// sessionStorage 持久化 —— 跨 unmount/remount / 整页刷新都保持;
// 关闭 tab 自动清空(不污染下次会话)。不写 localStorage,避免多 tab 串味。
export const useMsgUi = create<MsgUiState>()(
  persist(
    (set) => ({
      mainTab: 'dm',
      subType: 'all',
      selectedId: 1,
      setMainTab: (mainTab) => set({ mainTab }),
      setSubType: (subType) => set({ subType }),
      setSelectedId: (selectedId) => set({ selectedId }),
    }),
    {
      name: 'msg-ui',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        mainTab: state.mainTab,
        subType: state.subType,
        selectedId: state.selectedId,
      }),
    },
  ),
);
