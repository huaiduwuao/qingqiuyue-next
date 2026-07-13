'use client';

/**
 * useConversationHistory —— 数字人会话历史列表
 *
 * 封装 GET /api/realtime/hermes/conversations 调用,
 * 供 ImmersiveDigitalHuman 等需要会话列表的组件使用。
 * 匿名用户传 userId=0(与后端 digital_human_conversation 匿名 session 对齐)。
 */

import React from 'react';

export interface ConversationItem {
  id: string;
  title: string;
  agentId: string;
  lastMessageAt: string;
}

export interface UseConversationHistoryResult {
  history: ConversationItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const DEFAULT_USER_ID = 0;

export function useConversationHistory(
  limit: number = 20,
  userId: number = DEFAULT_USER_ID,
): UseConversationHistoryResult {
  const [history, setHistory] = React.useState<ConversationItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/realtime/hermes/conversations?userId=${userId}&limit=${limit}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        const j = await r.json();
        // 后端 SuccessPage 返回 {data:{records,totalRow}} 或裸 {records}
        const records: any[] = j?.data?.records ?? j?.records ?? [];
        if (cancelled) return;
        setHistory(
          records.map((r: any) => ({
            id: r.id,
            title: r.title || '(无标题)',
            agentId: r.agentId || '',
            lastMessageAt: r.lastMessageAt || '',
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
