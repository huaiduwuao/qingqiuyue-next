import { adminClient } from '@/lib/api/client';
import type { PageParams, PageResult } from '@/beans/pagination';
import { normalizePageResponse } from '@/beans/pagination';

export interface BotListParams extends PageParams {
  name?: string;
  keyword?: string;  // 模糊搜索 name/nickname
  status?: string;
}

export async function page(params: BotListParams): Promise<PageResult<any>> {
  const res = await adminClient('/bot/list', { params });
  return normalizePageResponse(res);
}

export async function get(id: number) {
  return adminClient(`/bot/${id}`);
}

export async function save(params: Record<string, unknown>) {
  return adminClient('/bot', { method: 'POST', data: params });
}

export async function update(params: Record<string, unknown>) {
  return adminClient(`/bot/${params.id}`, { method: 'PUT', data: params });
}

export async function remove(ids: number[]) {
  const list = Array.isArray(ids) ? ids : [ids];
  return Promise.all(list.map((id) => adminClient(`/bot/${id}`, { method: 'DELETE' })));
}

export async function pause(id: number) {
  return adminClient(`/bot/${id}/pause`, { method: 'POST' });
}

export async function resume(id: number) {
  return adminClient(`/bot/${id}/resume`, { method: 'POST' });
}

// AI 用户运营参数(后台可改,content-api 调度器一分钟内生效)
export interface BotConfig {
  paused: boolean;
  targetBotCount: number;
  maxBotsPerTick: number;
  dailyActionCap: number;
  postGapSeconds: number;
  maxPostsPerBotPerDay: number;
  engageBudgetPerTick: number;
  followDayCurve: boolean;
  // 悬赏中心:赏金是平台发放给 AI 用户的钻石
  bountyPerDay: number;
  bountyMinYuan: number;
  bountyMaxYuan: number;
  diamondGrantPerDayYuan: number;
  /** 每个 AI 用户一次性发放的钻石(钱包单位),每人只发一次 */
  initialDiamonds: number;
  /** 每天最多认领几个真人发布、开放满 10 分钟没人接的任务(需 LLM),0 = 不接 */
  botClaimsPerDay: number;
  // 内容中心:13 种类型按权重随机,自动审核通过后上线
  worksPerDay: number;
  /** 置 true 保存后,调度器一分钟内让 13 个 AI 用户每人投一种类型的作品(跑起来后自动清回 false) */
  seedWorksOnce?: boolean;
  /** 每小时保底:发帖、动态评论、悬赏、作品每小时至少各一次,不占每天额度 */
  hourlyFloor: boolean;
}

/** 「每种类型各发一篇」里一种类型的结果 */
export interface WorkSeedResult {
  kind: string;
  contentType: string;
  label: string;
  botId: number;
  botName: string;
  contentId?: string;
  status: 'published' | 'skipped' | 'failed';
  error?: string;
  /** http = 走了和创作者中心表单相同的发布接口;service = 服务内直接建内容 */
  via?: 'http' | 'service';
}

export interface WorkSeedStatus {
  running: boolean;
  startedAt: string;
  finishedAt?: string;
  results: WorkSeedResult[];
}

export interface BotConfigResponse {
  config: BotConfig;
  botCount: number;
  activeCount: number;
  llmEnabled: boolean;
  /** 最近一次「每种类型各发一篇」的进度与结果 */
  workSeed?: WorkSeedStatus;
  workKinds?: string[];
}

export async function getConfig(): Promise<BotConfigResponse> {
  const res: any = await adminClient('/bot/config');
  return res;
}

export async function saveConfig(cfg: BotConfig): Promise<BotConfig> {
  const res: any = await adminClient('/bot/config', { method: 'PUT', data: cfg });
  return res;
}

// 所有 AI 用户共用的大模型(OpenAI 兼容接口)。Key 只写不读:读回来只有 keySet 和末尾四位。
export interface BotLLMView {
  enabled: boolean;
  baseUrl: string;
  model: string;
  keySet: boolean;
  keyHint?: string;
}

export interface BotLLMInput {
  enabled: boolean;
  baseUrl: string;
  model: string;
  /** 留空表示不修改已保存的 Key */
  apiKey?: string;
}

export async function getLLM(): Promise<BotLLMView> {
  const res: any = await adminClient('/bot/llm');
  return res;
}

export async function saveLLM(input: BotLLMInput): Promise<BotLLMView> {
  const res: any = await adminClient('/bot/llm', { method: 'PUT', data: input });
  return res;
}

/** 用表单里的配置试调一次,不保存 */
export async function testLLM(input: BotLLMInput): Promise<{ reply: string; latencyMs: number }> {
  const res: any = await adminClient('/bot/llm/test', { method: 'POST', data: input });
  return res;
}

export async function refreshPersonas(): Promise<{ updated: number }> {
  const res: any = await adminClient('/bot/personas/refresh', { method: 'POST' });
  return res;
}

// 批量创建假人
export interface BatchCreateBotParams {
  count: number;                   // 数量 1-100
  prefix?: string;                 // 名称前缀
  personaPrompt?: string;          // 统一人设
  commentTemplates?: string[];     // 统一评论模板
  useLlmForComments?: boolean;     // 是否用 LLM
  llmModel?: string;               // LLM 模型
  commentIntervalMinutes?: number; // 评论间隔(分钟)
  initBalance?: number;            // 初始积分(分)
}

export interface BatchCreateBotResponse {
  successCount: number;
  failedCount: number;
  createdIds: number[];
  failedNames: string[];
}

export async function batchCreate(params: BatchCreateBotParams): Promise<BatchCreateBotResponse> {
  const res = await adminClient('/bot/batch', { method: 'POST', data: params });
  return res;
}