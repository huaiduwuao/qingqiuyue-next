import { stewardClient } from '@/lib/api/client';

// Steward 部署控制面(超管)。后端:qingqiuyue-go cmd/steward,经 APISIX /api/steward/v1/*。
// 取代旧的 apis/deployment.ts(updater 已于 2026-09-14 移除)。

export type Tier = 0 | 1 | 2 | 3;
export type OpKind = 'build' | 'adopt' | 'restart_service' | 'deploy_release' | 'rollback' | 'detach';
export type OpStatus =
  | 'awaiting_approval' | 'queued' | 'running' | 'verifying'
  | 'succeeded' | 'failed' | 'rejected' | 'rolled_back';

export interface ContainerStatus {
  service: string;
  container: string;
  exists: boolean;
  image_id: string;
  running: boolean;
  health: string; // healthy | unhealthy | starting | ''(无 healthcheck)
  restarts: number;
  inspect_error?: string; // 非空:这一轮 podman 没查到(忙/超时),不代表容器不存在
}

export interface NodeReport {
  node: string;
  hostname: string;
  agent_version: string;
  root_disk_pct: number;
  tmpfs_pct: number;
  containers: ContainerStatus[];
  time: string;
}

export interface StewardNode {
  id: string;
  labels: string;
  agent_version: string;
  last_seen: string | null;
  desired_release_id: string;
  desired_op_id: string;
  current_release_id: string;
  applied_at: string | null;
  online: boolean;
  report: NodeReport | null;
}

export interface ReleaseItem {
  service: string;
  image_id: string;
  image_tag: string;
  commit: string;
}

export interface Release {
  id: string;
  go_commit: string;
  next_commit: string;
  source: 'build' | 'adopt';
  operation_id: string;
  verified_at: string | null;
  created_at: string;
  items: ReleaseItem[];
}

export interface Operation {
  id: string;
  kind: OpKind;
  node_id: string;
  tier: Tier;
  status: OpStatus;
  params: string;
  reason: string;
  requester_type: 'human' | 'agent' | 'system';
  requester_name: string;
  target_release_id: string;
  prev_release_id: string;
  result: string;
  message: string;
  verify_until: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface OperationEvent {
  id: number;
  level: 'info' | 'warn' | 'error';
  service: string;
  message: string;
  created_at: string;
}

export interface Approval {
  approver_name: string;
  decision: 'approved' | 'rejected';
  comment: string;
  created_at: string;
}

export interface OperationDetail extends Operation {
  events: OperationEvent[];
  approvals: Approval[];
}

export interface Automation {
  paused: boolean;
  reason: string;
  updated_by: string;
  updated_at: string | null;
}

export interface CreateOperation {
  kind: OpKind;
  node_id?: string;
  params?: Record<string, unknown>;
  reason?: string;
}

// 响应拦截器把 { code, msg, data } 原样返回,业务数据在 .data 上。
const payload = <T,>(res: unknown): T => (res as { data: T }).data;

export const fleet = async () =>
  payload<{ nodes: StewardNode[] }>(await stewardClient.get('/fleet')).nodes ?? [];

export const releases = async (limit = 20) =>
  payload<{ list: Release[] }>(await stewardClient.get('/releases', { params: { limit } })).list ?? [];

export const operations = async (limit = 50) =>
  payload<{ list: Operation[] }>(await stewardClient.get('/operations', { params: { limit } })).list ?? [];

export const operation = async (id: string) =>
  payload<OperationDetail>(await stewardClient.get(`/operations/${id}`));

export const createOperation = async (body: CreateOperation) =>
  payload<Operation>(await stewardClient.post('/operations', body));

export const approve = async (id: string, comment = '') =>
  payload<Operation>(await stewardClient.post(`/operations/${id}/approve`, { comment }));

export const reject = async (id: string, comment = '') =>
  payload<Operation>(await stewardClient.post(`/operations/${id}/reject`, { comment }));

// 自动化开关:暂停后 AI 助手发起的操作一律等人批准(自动回滚不受影响)。
export const automation = async () =>
  payload<Automation>(await stewardClient.get('/automation'));

export const setAutomation = async (paused: boolean, reason = '') =>
  payload<Automation>(await stewardClient.post('/automation', { paused, reason }));
