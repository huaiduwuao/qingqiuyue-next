'use client';

/**
 * useConversationHistory —— 数字人会话历史列表
 *
 * 封装 GET /api/realtime/digital-human/conversations 调用,
 * 供 ImmersiveDigitalHuman 等需要会话列表的组件使用。
 * 匿名用户传 userId=0。
 *
 * 数据源: agentm_conversations 表 (session_uuid / title / agent_id / update_time)
 */

import React from 'react';
import { useApp } from '../contexts/AppContext';

export interface ConversationItem {
  id: string;           // session_uuid, 用于 URL 路由
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

const DEFAULT_USER_ID = 0;
const API_BASE = '/api/agentmanager';

export function useConversationHistory(
  limit: number = 20,
  overrideUserId?: number,
): UseConversationHistoryResult {
  const { currentUser } = useApp();
  const userId = overrideUserId ?? currentUser?.id ?? DEFAULT_USER_ID;

  const [history, setHistory] = React.useState<ConversationItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = `${API_BASE}/conversations?userId=${userId}&limit=${limit}`;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        const j = await r.json();
        const records: any[] = j?.list ?? [];
        if (cancelled) return;
        setHistory(
          records.map((r: any) => ({
            id: String(r.id ?? ''),
            title: sanitizeTitle(r.title),
            agentId: String(r.agentId || ''),
            lastMessageAt: r.update_time || r.updateTime || '',
            createTime: r.create_time || r.createTime || '',
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
  }, [limit, userId, tick]);

  return { history, loading, error, refresh };
}

function sanitizeTitle(raw: string | undefined | null): string {
  if (!raw) return '(无标题)';
  const trimmed = raw.trim();
  if (!trimmed) return '(无标题)';
  if (trimmed.includes('�')) return '(无标题)';
  return trimmed;
}
