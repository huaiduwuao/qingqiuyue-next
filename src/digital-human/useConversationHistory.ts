'use client';

/**
 * useConversationHistory —— 数字人会话历史列表
 *
 * GET /api/agentmanager/conversations,带登录态;后端按 session 只返回当前用户的会话。
 * 未登录时不请求(接口必 401),列表为空、error 为 null,由页面给出登录提示。
 *
 * 数据源: agentm_sessions 表 (id / title / agent_id / update_time)
 */

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { listConversations } from './conversationApi';

export interface ConversationItem {
  id: string;           // agentm_sessions.id,即 AG-UI 的 session_id
  title: string;
  agentId: string;
  lastMessageAt: string;
  createTime: string;   // 会话创建时间(新会话 lastMsgAt 为空时用它算相对时间)
}

export interface UseConversationHistoryResult {
  history: ConversationItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useConversationHistory(limit: number = 20): UseConversationHistoryResult {
  const { status } = useAuth();
  const authed = status === 'authenticated';

  const [history, setHistory] = React.useState<ConversationItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    if (!authed) {
      setHistory([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    listConversations(limit)
      .then((j) => {
        if (cancelled) return;
        setHistory(
          (j?.list ?? []).map((r) => ({
            id: String(r.id ?? ''),
            title: sanitizeTitle(r.title),
            agentId: String(r.agentId ?? ''),
            lastMessageAt: r.updateTime || '',
            createTime: r.createTime || '',
          })),
        );
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [limit, authed, tick]);

  return { history, loading, error, refresh };
}

function sanitizeTitle(raw: string | undefined | null): string {
  if (!raw) return '(无标题)';
  const trimmed = raw.trim();
  if (!trimmed) return '(无标题)';
  if (trimmed.includes('�')) return '(无标题)';
  return trimmed;
}
