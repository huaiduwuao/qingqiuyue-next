import { aiClient } from '@/lib/api/client';

// 算力节点(comfy-gateway)。网关跑在 GPU 机器上,gen-api 持有令牌并代理它的管理接口:
// qingqiuyue-go internal/genapp/gpu_admin.go → /api/ai/generate/admin/gpu/*(仅管理员)。

export type InstanceState = 'stopped' | 'starting' | 'running' | 'crashed' | 'down';

export interface GPUStat {
  index: string;
  name: string;
  memTotalMiB: number;
  memUsedMiB: number;
  utilPercent: number;
  tempC: number;
  powerW: number;
}

export interface GatewayInstance {
  id: number;
  name: string;
  gpu: string;
  url: string;
  managed: boolean;
  state: InstanceState;
  pid: number;
  startedAt: string;
  readyAt: string;
  restarts: number;
  lastError: string;
  queueRunning: number;
  queuePending: number;
  nodeTypes: number;
  recentModels: string[] | null;
}

export interface GatewayStatus {
  version: string;
  startedAt: string;
  gpus: GPUStat[] | null;
  instances: GatewayInstance[];
  queue: { running: number; pending: number; gateway: number };
  prompts: { total: number; success: number; error: number; lost: number; canceled: number; active: number; retried: number };
  maxAttempts: number;
  s3: boolean;
}

export type PromptStatus = 'pending' | 'queued' | 'running' | 'success' | 'error' | 'lost' | 'canceled';

export interface PromptRecord {
  promptId: string;
  instance: number;
  instanceName: string;
  clientId: string;
  models: string[] | null;
  nodes: number;
  source: 'comfy' | 'api';
  attempts: number;
  tried?: number[] | null;
  dispatchedAt?: string;
  webhook?: string;
  outputs?: { node: string; filename: string; subfolder: string; type: string; url?: string }[] | null;
  submittedAt: string;
  startedAt?: string;
  finishedAt?: string;
  status: PromptStatus;
  error?: string;
}

export type InstanceAction = 'start' | 'stop' | 'restart';

export async function gatewayStatus(): Promise<GatewayStatus> {
  return (await aiClient('/generate/admin/gpu/status')) as GatewayStatus;
}

export async function gatewayPrompts(limit = 100): Promise<PromptRecord[]> {
  const r = (await aiClient('/generate/admin/gpu/prompts', { params: { limit } })) as { list?: PromptRecord[] };
  return r?.list ?? [];
}

export async function instanceLogs(id: number, tail = 300): Promise<string[]> {
  const r = (await aiClient(`/generate/admin/gpu/instances/${id}/logs`, { params: { tail } })) as { lines?: string[] };
  return r?.lines ?? [];
}

export async function instanceAction(id: number, action: InstanceAction): Promise<GatewayInstance> {
  return (await aiClient(`/generate/admin/gpu/instances/${id}/${action}`, { method: 'POST' })) as GatewayInstance;
}
