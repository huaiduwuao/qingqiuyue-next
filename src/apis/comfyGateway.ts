import { aiClient } from '@/lib/api/client';

// 算力节点(comfy-gateway)。每台 GPU 机器跑一个网关,gen-api 存着各节点的地址和令牌、按负载派单,
// 并代理各节点网关的管理接口(浏览器不接触令牌):
// qingqiuyue-go internal/genapp/gpu_admin.go、nodes.go → /api/ai/generate/admin/gpu/*(仅管理员)。

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

/** 一个算力节点(一台 GPU 机器)。id=0 是环境变量 COMFYUI_URL(没有数据库节点时在用,不能编辑)。 */
export interface GpuNode {
  id: number;
  name: string;
  baseUrl: string;
  enabled: boolean;
  note: string;
  legacy: boolean;
  tokenSet: boolean;
  online: boolean;
  gateway: boolean;
  version: string;
  running: number; // 在线的卡(ComfyUI 实例)
  instances: number;
  queue: number; // 在跑 + 排队
  error?: string;
}

export interface GpuNodeInput {
  name?: string;
  baseUrl?: string;
  token?: string; // 编辑时留空 = 不改
  enabled?: boolean;
  note?: string;
}

const base = '/generate/admin/gpu';

export async function listNodes(): Promise<GpuNode[]> {
  return ((await aiClient(`${base}/nodes`)) ?? []) as GpuNode[];
}

export async function createNode(body: GpuNodeInput): Promise<GpuNode> {
  return (await aiClient(`${base}/nodes`, { method: 'POST', data: body })) as GpuNode;
}

export async function updateNode(id: number, body: GpuNodeInput): Promise<GpuNode> {
  return (await aiClient(`${base}/nodes/${id}`, { method: 'PUT', data: body })) as GpuNode;
}

export async function deleteNode(id: number): Promise<void> {
  await aiClient(`${base}/nodes/${id}`, { method: 'DELETE' });
}

/** 测试连接(不保存);编辑已有节点时 token 可留空,带上 id 用库里的。 */
export async function probeNode(body: { baseUrl: string; token?: string; id?: number }): Promise<{ node: GpuNode; latencyMs: number }> {
  return (await aiClient(`${base}/probe`, { method: 'POST', data: body })) as { node: GpuNode; latencyMs: number };
}

export async function gatewayStatus(nodeId: number): Promise<GatewayStatus> {
  return (await aiClient(`${base}/nodes/${nodeId}/status`)) as GatewayStatus;
}

export async function gatewayPrompts(nodeId: number, limit = 100): Promise<PromptRecord[]> {
  const r = (await aiClient(`${base}/nodes/${nodeId}/prompts`, { params: { limit } })) as { list?: PromptRecord[] };
  return r?.list ?? [];
}

export async function instanceLogs(nodeId: number, id: number, tail = 300): Promise<string[]> {
  const r = (await aiClient(`${base}/nodes/${nodeId}/instances/${id}/logs`, { params: { tail } })) as { lines?: string[] };
  return r?.lines ?? [];
}

export async function instanceAction(nodeId: number, id: number, action: InstanceAction): Promise<GatewayInstance> {
  return (await aiClient(`${base}/nodes/${nodeId}/instances/${id}/${action}`, { method: 'POST' })) as GatewayInstance;
}
