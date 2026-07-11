import type { APIRequestContext, Page, Request } from '@playwright/test';

/** 任务相关接口路径正则（基址 /api/core）。 */
export const RX = {
  taskList: /\/api\/core\/task\/page(\?|$)/,
  // 创建仅匹配 /task 或 /task/（排除 /task/{id} 及其子路径）
  taskCreate: /\/api\/core\/task\/?(\?|$)/,
  taskUpdate: /\/api\/core\/task\/\d+\/?(\?|$)/,
  taskDelete: /\/api\/core\/task\/\d+\/?(\?|$)/,
  taskAction: (a: 'claim' | 'submit' | 'review') => new RegExp(`\\/api\\/core\\/task\\/\\d+\\/${a}\\/?(\\?|$)`),
  projectList: /\/api\/core\/project\/client\/page(\?|$)/,
  groupList: /\/api\/core\/group\/client\/page(\?|$)/,
};

const match = (r: Request, method: string, re: RegExp) => r.method() === method && re.test(r.url());

export const waitList = (p: Page) => p.waitForRequest((r) => match(r, 'GET', RX.taskList));
export const waitCreate = (p: Page) =>
  p.waitForRequest((r) => match(r, 'POST', RX.taskCreate) && !RX.taskUpdate.test(r.url()));
export const waitDelete = (p: Page) => p.waitForRequest((r) => match(r, 'DELETE', RX.taskDelete));
export const waitAction = (p: Page, a: 'claim' | 'submit' | 'review') =>
  p.waitForRequest((r) => match(r, 'POST', RX.taskAction(a)));

/** 解包 { code, msg, data }。 */
export async function unwrap(res: { json(): Promise<any> }) {
  const j = await res.json();
  return j?.data ?? j;
}

/** 幂等确保至少存在一个团队；返回 team id。 */
export async function ensureGroup(api: APIRequestContext, name = 'E2E-Group'): Promise<number> {
  const list = await unwrap(await api.get('/api/core/group/client/page', { params: { pageSize: 50 } }));
  const records = list?.records || list?.list || (Array.isArray(list) ? list : []);
  let found = records.find((g: any) => g?.name === name);
  if (found?.id) return found.id;
  // 触发创建 —— 响应可能只回 {code:0,msg:'创建成功'},创建完用同 name 再查一次
  await (await api.post('/api/core/group', { data: { name } })).json().catch(() => ({}));
  const after = await unwrap(await api.get('/api/core/group/client/page', { params: { pageSize: 50 } }));
  const rec2 = after?.records || after?.list || (Array.isArray(after) ? after : []);
  found = rec2.find((g: any) => g?.name === name) || rec2[0];
  if (!found?.id) throw new Error(`ensureGroup 失败，列表中没有 name=${name}: ${JSON.stringify(after)}`);
  return found.id;
}

/** 幂等确保至少存在一个项目；返回 project id（必要时带 groupId）。 */
export async function ensureProject(api: APIRequestContext, groupId?: number, name = 'E2E-Project'): Promise<number> {
  // Playwright params 不收 undefined → 只在 groupId 存在时透传,避开 TS 严格类型
  const baseParams: Record<string, string | number> = { pageSize: 50 };
  if (groupId != null) baseParams.groupId = groupId;
  const list = await unwrap(await api.get('/api/core/project/client/page', { params: baseParams }));
  const records = list?.records || list?.list || (Array.isArray(list) ? list : []);
  let found = records.find((p: any) => p?.name === name);
  if (found?.id) return found.id;
  const data: any = { name };
  if (groupId != null) data.groupId = groupId;
  await (await api.post('/api/core/project', { data })).json().catch(() => ({}));
  // 后端创建可能仅返回 {code:0,msg:'创建成功'} 不带回实体 → 回查列表取 id
  const after = await unwrap(await api.get('/api/core/project/client/page', { params: baseParams }));
  const rec2 = after?.records || after?.list || (Array.isArray(after) ? after : []);
  found = rec2.find((p: any) => p?.name === name) || rec2[0];
  if (!found?.id) throw new Error(`ensureProject 失败，列表中没有 name=${name}: ${JSON.stringify(after)}`);
  return found.id;
}

/** 幂等建一个任务（同 project 下同名存在则复用）；返回 task id。createTask 后端无 bool 字段，可直接走 API。 */
export async function seedTask(
  api: APIRequestContext,
  { projectId, groupId, title, status = 'pending' }: { projectId: number; groupId: number; title: string; status?: string },
): Promise<number> {
  const list = await unwrap(await api.get('/api/core/task/page', { params: { pageSize: 100, projectId } }));
  const recs = list?.records || list?.list || (Array.isArray(list) ? list : []);
  const found = recs.find((t: any) => t?.title === title);
  if (found?.id) return found.id;
  const data: any = { projectId, groupId, groupIds: [groupId], title, description: 'e2e seed', priority: 'P1', status };
  const resp = await (await api.post('/api/core/task', { data })).json();
  const ok = resp?.code === 200 || resp?.code === '200' || resp?.code === 0 || resp?.code === '0';
  if (!ok) throw new Error(`createTask 失败：${JSON.stringify(resp)}`);
  const after = await unwrap(await api.get('/api/core/task/page', { params: { pageSize: 100, projectId } }));
  const rec2 = after?.records || after?.list || (Array.isArray(after) ? after : []);
  const created = rec2.find((t: any) => t?.title === title);
  if (!created?.id) throw new Error(`createTask 成功但回查未拿到 id`);
  return created.id;
}

/** 幂等确保至少存在一个需求。status 用后端默认 (PENDING)，返回 demand id。 */
export async function seedDemand(
  api: APIRequestContext,
  { groupId, projectId, title, status = 'PENDING' }: { groupId: number; projectId?: number; title: string; status?: string },
): Promise<number> {
  const list = await unwrap(await api.get('/api/core/demand/client/page', { params: { pageSize: 50, groupId } }));
  const records = list?.records || list?.list || (Array.isArray(list) ? list : []);
  const found = records.find((d: any) => d?.title === title);
  if (found?.id) return found.id;
  const data: any = { groupId, title, content: 'e2e seed demand', pay: 0, status };
  if (projectId) data.projectId = projectId;
  const resp = await (await api.post('/api/core/demand', { data })).json().catch((e: any) => ({ error: String(e) }));
  const ok = resp?.code === 200 || resp?.code === '200' || resp?.code === 0 || resp?.code === '0';
  if (!ok) throw new Error(`createDemand 失败：${JSON.stringify(resp)}`);
  const after = await unwrap(await api.get('/api/core/demand/client/page', { params: { pageSize: 50, groupId } }));
  const rec2 = after?.records || after?.list || (Array.isArray(after) ? after : []);
  const created = rec2.find((d: any) => d?.title === title);
  if (!created?.id) throw new Error(`createDemand 成功但回查未拿到 id`);
  return created.id;
}

