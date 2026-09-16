'use client';

/**
 * 工作台数据层:react-query 缓存 + 项目事件流(SSE)驱动失效。
 *
 * 后端每个任务进度、每个实体变更都会推一条事件;这里按事件类型只失效相关查询,
 * 页面不用轮询。事件流断了(网络抖动)会自动重连;运行中的任务额外每 5 秒兜底刷新一次。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  dramaAPI,
  isTaskTerminal,
  streamProjectEvents,
  type DramaEvent,
  type Overview,
  type Step,
  type Task,
} from '@/apis/shortdrama';

export const qk = {
  projects: ['drama', 'projects'] as const,
  overview: (pid: number) => ['drama', 'overview', pid] as const,
  tasks: (pid: number) => ['drama', 'tasks', pid] as const,
  episode: (id: number) => ['drama', 'episode', id] as const,
  revisions: (pid: number) => ['drama', 'revisions', pid] as const,
  capabilities: ['drama', 'capabilities'] as const,
  agents: ['drama', 'agents'] as const,
};

export function useOverview(pid: number) {
  return useQuery<Overview>({ queryKey: qk.overview(pid), queryFn: () => dramaAPI.overview(pid), enabled: pid > 0 });
}

export function useEpisode(id: number) {
  return useQuery({ queryKey: qk.episode(id), queryFn: () => dramaAPI.episode(id), enabled: id > 0 });
}

export function useTasks(pid: number) {
  return useQuery({ queryKey: qk.tasks(pid), queryFn: () => dramaAPI.listTasks(pid), enabled: pid > 0 });
}

export function useCapabilities() {
  return useQuery({ queryKey: qk.capabilities, queryFn: dramaAPI.capabilities, staleTime: 60_000 });
}

export function useAgents() {
  return useQuery({ queryKey: qk.agents, queryFn: dramaAPI.agents, staleTime: 5 * 60_000 });
}

/**
 * 订阅项目事件。返回最新的任务快照(用于右侧活动面板实时日志)和连接状态。
 */
export function useProjectEvents(pid: number) {
  const qc = useQueryClient();
  const [liveTask, setLiveTask] = useState<Task | null>(null);
  const [connected, setConnected] = useState(false);
  const liveRef = useRef<Task | null>(null);

  useEffect(() => {
    if (!pid) return;
    const ac = new AbortController();
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const invalidateSoon = (keys: readonly (readonly unknown[])[]) => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      }, 250);
    };
    const onEvent = (e: DramaEvent) => {
      if (e.type === 'ready') {
        setConnected(true);
        return;
      }
      if (e.type === 'task') {
        const t = e.data as Task;
        liveRef.current = t;
        setLiveTask(t);
        invalidateSoon([qk.tasks(pid)]);
        if (isTaskTerminal(t.status)) {
          // 结束时全量刷一次,任何实体都可能变了
          invalidateSoon([qk.overview(pid), qk.tasks(pid), ['drama', 'episode'], qk.revisions(pid)]);
        }
        return;
      }
      if (e.type === 'entity') {
        const d = e.data as { kind: string; id?: number; episode_id?: number };
        const keys: (readonly unknown[])[] = [qk.overview(pid)];
        if (d.kind === 'shot' || d.kind === 'episode') {
          if (d.episode_id) keys.push(qk.episode(d.episode_id));
          else if (d.kind === 'episode' && d.id) keys.push(qk.episode(d.id));
          else keys.push(['drama', 'episode']);
        }
        invalidateSoon(keys);
      }
    };
    streamProjectEvents(pid, onEvent, ac.signal).catch(() => undefined);
    return () => {
      ac.abort();
      if (debounce) clearTimeout(debounce);
      setConnected(false);
    };
  }, [pid, qc]);

  // 兜底:任务运行中时定期刷新(事件丢了也不会卡住)
  useEffect(() => {
    if (!pid || !liveTask || isTaskTerminal(liveTask.status)) return;
    const id = setInterval(() => {
      qc.invalidateQueries({ queryKey: qk.tasks(pid) });
      qc.invalidateQueries({ queryKey: qk.overview(pid) });
    }, 5000);
    return () => clearInterval(id);
  }, [pid, liveTask, qc]);

  return { liveTask, connected };
}

/** 发起环节任务;返回 mutation。 */
export function useStartTask(pid: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ step, input }: { step: Step; input?: Record<string, unknown> }) => dramaAPI.startTask(pid, step, input ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tasks(pid) });
      qc.invalidateQueries({ queryKey: qk.overview(pid) });
    },
  });
}

/** 提交修改意见(反馈优化 Agent)。 */
export function useFeedback(pid: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { target_type: string; target_id: number; instruction: string }) => dramaAPI.feedback(pid, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.tasks(pid) });
      qc.invalidateQueries({ queryKey: qk.revisions(pid) });
    },
  });
}

/** 通用失效器。 */
export function useInvalidate(pid: number) {
  const qc = useQueryClient();
  return useCallback(
    (epId?: number) => {
      qc.invalidateQueries({ queryKey: qk.overview(pid) });
      if (epId) qc.invalidateQueries({ queryKey: qk.episode(epId) });
    },
    [qc, pid],
  );
}

/** 当前打开的项目 id 记在 sessionStorage,刷新不丢。 */
export function useCurrentProjectId(): [number, (id: number) => void] {
  const [pid, setPid] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      return Number(sessionStorage.getItem('drama:project') || 0);
    } catch {
      return 0;
    }
  });
  const set = useCallback((id: number) => {
    setPid(id);
    try {
      if (id) sessionStorage.setItem('drama:project', String(id));
      else sessionStorage.removeItem('drama:project');
    } catch {
      /* ignore */
    }
  }, []);
  return [pid, set];
}
