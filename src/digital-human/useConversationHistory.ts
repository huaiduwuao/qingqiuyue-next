'use client';

/**
 * useConversationHistory —— 数字人会话历史列表
 *
 * 封装 GET /api/realtime/digital-human/conversations 调用,
 * 供 ImmersiveDigitalHuman 等需要会话列表的组件使用。
 * 匿名用户传 userId=0(与后端 digital_human_conversation 匿名 session 对齐)。
 *
 * 2026-08: 重构自 Hermes 版本,改接 /api/realtime/digital-human/conversations,
 * 数据来自 agentmanager tagent AG-UI 持久会话元数据。
 */

import React from 'react';
import { useApp } from '../contexts/AppContext';

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
const API_BASE = '/api/realtime/digital-human';

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
        // 后端返回 { list: [...], total, page, limit }
        const records: any[] = j?.list ?? [];
        if (cancelled) return;
        setHistory(
          records.map((r: any) => ({
            id: r.id ?? '',
            title: sanitizeTitle(r.title),
            agentId: r.agentId || '',
            lastMessageAt: r.lastMessageAt || r.last_message_at || '',
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

/**
 * sanitizeTitle —— 过滤乱码会话标题。
 * 8/3 晚间 agentmanager-api 异常时写入了一批 GBK/U+FFFD 混合乱码 title(不可恢复)。
 * 检测 U+FFFD(�) 替换字符,命中则显示 (无标题) 而非乱码。
 */
function sanitizeTitle(raw: string | undefined | null): string {
  if (!raw) return '(无标题)';
  const trimmed = raw.trim();
  if (!trimmed) return '(无标题)';
  // 含 U+FFFD 替换字符 = 编码已损坏
  if (trimmed.includes('�')) return '(无标题)';
  return trimmed;
}
