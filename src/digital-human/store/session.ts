/**
 * store/session.ts — 角色会话状态 (zustand)
 *
 * Phase 2.5: 持久化数字人运行时状态（位置/场景/动作/姿势/表情等）
 * VrmStage 每个 useEffect 调 update() 写当前状态
 * store 每 5s 自动 flush 到 /api/realtime/digital-human/sessions/me
 */

import { create } from 'zustand';
import type { CharacterSession } from '../vrm/config/types';
import { safeErrorLog } from '@/lib/error-handler';

const USER_ID_KEY = 'qingqiuyue:digital-human:userId';

/** Phase 6.1：userId 来源优先级
 *   1. localStorage 'qingqiuyue:digital-human:userId'（有外部 auth 时由 auth 系统写入）
 *   2. 随机生成（首次访问，永久保留到 localStorage）
 * 真正接入 auth 后改 setUserId(token.sub) 即可
 */
function resolveUserId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    const stored = window.localStorage.getItem(USER_ID_KEY);
    if (stored) return stored;
    const fresh = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? `anonymous-${crypto.randomUUID()}`
      : `anonymous-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(USER_ID_KEY, fresh);
    return fresh;
  } catch {
    return 'anonymous-fallback';
  }
}

const DEFAULT_SESSION: CharacterSession = {
  id: '',
  userId: resolveUserId(),
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

// 防抖定时器，防止频繁 flush
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingFlush = false;

interface SessionStore {
  session: CharacterSession;
  /** 部分更新（VrmStage 调） */
  update: (patch: Partial<CharacterSession>) => void;
  /** 整体替换（VrmStage mount 时拉服务端 session 后调） */
  setSession: (s: CharacterSession) => void;
  /** 立即 flush 到服务端（VrmStage unmount / window beforeunload 调） */
  flush: () => Promise<void>;
  /** 防抖 flush（用于定期保存，避免频繁请求） */
  flushDebounced: () => void;
  /** 重置到默认值（debug 用） */
  reset: () => void;
  /** 切换 userId（auth 接入时调） */
  setUserId: (userId: string) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  session: DEFAULT_SESSION,
  update: (patch) => set((s) => ({ session: { ...s.session, ...patch, updatedAt: new Date().toISOString() } })),
  setSession: (sess) => set({ session: sess }),
  flush: async () => {
    // 防止并发 flush
    if (pendingFlush) return
    pendingFlush = true

    // 获取当前快照，避免竞态
    const snapshot = get().session
    try {
      const { upsertMySession } = await import('../api/digitalHumanConfig');
      await upsertMySession(snapshot);
      console.log('[session] flushed to server');
    } catch (e) {
      safeErrorLog('session flush failed', e)
    } finally {
      pendingFlush = false
    }
  },
  // 防抖 flush，延迟 1 秒后执行
  flushDebounced: () => {
    if (flushTimer) {
      clearTimeout(flushTimer)
    }
    flushTimer = setTimeout(() => {
      flushTimer = null
      get().flush()
    }, 1000)
  },
  reset: () => set({ session: { ...DEFAULT_SESSION, updatedAt: new Date().toISOString() } }),
  setUserId: (userId) => {
    if (typeof window !== 'undefined') {
      try { window.localStorage.setItem(USER_ID_KEY, userId); } catch { /* ignore */ }
    }
    set((s) => ({ session: { ...s.session, userId, id: '' } }));  // 清 id 强制重新拉
  },
}));
