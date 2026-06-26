'use client';

/**
 * usePipelineJob —— 包装 EventSource 订阅 + reducer 状态
 *
 * 状态机:
 *   upload  →  configure  →  run  →  preview
 *     ↑                                    │
 *     └────────────────────────────────────┘
 *
 * 每个阶段都依赖 usePipelineJob 暴露的 { job, events, cancel, ... }
 */

import { useEffect, useReducer, useRef, useCallback } from 'react';
import type {
  JobSnapshot,
  JobStatus,
  PipelineStage,
  SseEvent,
  Artifact,
} from '@/lib/avatar-pipeline/types';
import { PIPELINE_STAGES } from '@/lib/avatar-pipeline/types';

export type WizardStep = 'mode' | 'upload' | 'library' | 'configure' | 'run' | 'preview';

interface State {
  step: WizardStep;
  job: JobSnapshot | null;
  logs: { stream: 'stdout' | 'stderr'; line: string; t: number }[];
  artifacts: Artifact[];
  error: { code: string; stage: string; message: string; logsTail: string[] } | null;
  connection: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  /** 是否刚连上(用于区分历史 replay vs 实时事件) */
  justConnected: boolean;
}

type Action =
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SNAPSHOT'; job: JobSnapshot }
  | { type: 'SSE_EVENT'; event: SseEvent }
  | { type: 'CONNECTION'; connection: State['connection'] }
  | { type: 'RESET' };

const LOG_RING = 200;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step };
    case 'SNAPSHOT':
      return { ...state, job: action.job };
    case 'SSE_EVENT': {
      const e = action.event;
      // 复制 job 以更新
      const job = state.job ? { ...state.job } : null;
      switch (e.event) {
        case 'connected':
          return { ...state, connection: 'open', justConnected: true };
        case 'stage': {
          if (job) {
            job.stage = e.data.stage;
            job.pct = e.data.pct;
            job.status = 'running';
          }
          return { ...state, job };
        }
        case 'progress': {
          if (job) job.pct = e.data.pct;
          return { ...state, job };
        }
        case 'log': {
          const logs = [...state.logs, e.data];
          if (logs.length > LOG_RING) logs.splice(0, logs.length - LOG_RING);
          return { ...state, logs };
        }
        case 'status': {
          if (job) {
            job.status = e.data.status;
            job.stage = e.data.stage;
            job.pct = e.data.pct;
          }
          return { ...state, job };
        }
        case 'artifact': {
          const { t, ...art } = e.data;
          if (job) job.artifacts = [...(job.artifacts || []), art];
          return { ...state, artifacts: [...state.artifacts, art], job };
        }
        case 'done': {
          if (job) {
            job.status = 'completed';
            job.pct = 100;
            job.durationMs = e.data.durationMs;
            job.artifacts = e.data.artifacts;
            job.finishedAt = Date.now();
          }
          return { ...state, job, step: 'preview' };
        }
        case 'error': {
          if (job) {
            job.status = 'failed';
            job.finishedAt = Date.now();
            job.error = {
              stage: e.data.stage,
              message: e.data.message,
              logsTail: e.data.logsTail,
            };
          }
          return { ...state, job, error: { code: e.data.code, stage: e.data.stage, message: e.data.message, logsTail: e.data.logsTail } };
        }
        case 'cancelled': {
          if (job) job.status = 'cancelled';
          return { ...state, job, step: 'preview' };
        }
        default:
          return state;
      }
    }
    case 'CONNECTION':
      return { ...state, connection: action.connection };
    case 'RESET':
      return {
        step: 'mode',
        job: null,
        logs: [],
        artifacts: [],
        error: null,
        connection: 'idle',
        justConnected: false,
      };
  }
}

const initialState: State = {
  step: 'mode',
  job: null,
  logs: [],
  artifacts: [],
  error: null,
  connection: 'idle',
  justConnected: false,
};

export function usePipelineJob(jobId: string | null) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const sourceRef = useRef<EventSource | null>(null);

  // SSE 订阅(只在 run 阶段需要)
  useEffect(() => {
    if (!jobId || state.step !== 'run') {
      sourceRef.current?.close();
      sourceRef.current = null;
      return;
    }
    dispatch({ type: 'CONNECTION', connection: 'connecting' });
    const src = new EventSource(`/api/avatar/pipeline/jobs/${jobId}/events`);
    sourceRef.current = src;
    src.onopen = () => {
      dispatch({ type: 'CONNECTION', connection: 'open' });
    };
    src.onerror = () => {
      dispatch({ type: 'CONNECTION', connection: 'error' });
    };
    const types: SseEvent['event'][] = [
      'connected', 'stage', 'progress', 'log', 'status',
      'artifact', 'done', 'error', 'cancelled',
    ];
    types.forEach((t) => {
      src.addEventListener(t, (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data);
          dispatch({ type: 'SSE_EVENT', event: { event: t, data } as SseEvent });
        } catch { /* */ }
      });
    });
    return () => {
      src.close();
      sourceRef.current = null;
    };
  }, [jobId, state.step]);

  const setStep = useCallback((step: WizardStep) => {
    dispatch({ type: 'SET_STEP', step });
  }, []);

  const setJob = useCallback((job: JobSnapshot) => {
    dispatch({ type: 'SNAPSHOT', job });
  }, []);

  const cancel = useCallback(async () => {
    if (!jobId) return;
    await fetch(`/api/avatar/pipeline/jobs/${jobId}`, { method: 'DELETE' });
  }, [jobId]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return { state, setStep, setJob, cancel, reset };
}

/** 各阶段的中文标签 + 图标(供 RunStep 用) */
export const STAGE_LABELS: Record<PipelineStage, string> = {
  capture: '抽帧',
  reconstruct: 'COLMAP 重建',
  train_3dgs: '3DGS 训练(可选)',
  mesh: 'Mesh 清理',
  rig_blender: '绑骨 + 表情',
  deploy: '部署',
};

export const STAGE_ORDER = PIPELINE_STAGES;
