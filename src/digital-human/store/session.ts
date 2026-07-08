/**
 * store/session.ts — 角色会话状态 (zustand)
 *
 * Phase 2.5: 持久化数字人运行时状态（位置/场景/动作/姿势/表情等）
 * VrmStage 每个 useEffect 调 update() 写当前状态
 * store 每 5s 自动 flush 到 /api/realtime/digital-human/sessions/me
 */

import { create } from 'zustand';
import type { CharacterSession } from '../vrm/config/types';

const DEFAULT_SESSION: CharacterSession = {
  id: '',
  userId: 'default', // TODO: 接入 auth 后改成真实 userId
  modelId: '00000000-0000-0000-0000-000000000001', // character
  sceneId: '00000000-0000-0000-0000-000000060001', // concert
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  rotationY: 0,
  yOffset: 0,
  bpm: 120,
  danceAmp: 1.0,
  updatedAt: new Date().toISOString(),
};

interface SessionStore {
  session: CharacterSession;
  /** 部分更新（VrmStage 调） */
  update: (patch: Partial<CharacterSession>) => void;
  /** 整体替换（VrmStage mount 时拉服务端 session 后调） */
  setSession: (s: CharacterSession) => void;
  /** 立即 flush 到服务端（VrmStage unmount / window beforeunload 调） */
  flush: () => Promise<void>;
  /** 重置到默认值（debug 用） */
  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: DEFAULT_SESSION,
  update: (patch) => set((s) => ({ session: { ...s.session, ...patch, updatedAt: new Date().toISOString() } })),
  setSession: (sess) => set({ session: sess }),
  flush: async () => {
    const s = get().session;
    try {
      const { upsertMySession } = await import('../api/digitalHumanConfig');
      await upsertMySession(s);
      console.log('[session] flushed to server');
    } catch (e) {
      console.warn('[session] flush failed:', e);
    }
  },
  reset: () => set({ session: { ...DEFAULT_SESSION, updatedAt: new Date().toISOString() } }),
}));
