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
  const found = (list?.records || list?.list || []).find((g: any) => g?.name === name) || (list?.records || list?.list || [])[0];
  if (found?.id) return found.id;
  const created = await unwrap(await api.post('/api/core/group', { data: { name } }));
  const id = created?.id ?? created?.data?.id;
  if (!id) throw new Error(`createGroup 失败：${JSON.stringify(created)}`);
  return id;
}

/** 幂等确保至少存在一个项目；返回 project id（必要时带 groupId）。 */
export async function ensureProject(api: APIRequestContext, groupId?: number, name = 'E2E-Project'): Promise<number> {
  const list = await unwrap(await api.get('/api/core/project/client/page', { params: { pageSize: 50 } }));
  const found = (list?.records || list?.list || []).find((p: any) => p?.name === name) || (list?.records || list?.list || [])[0];
  if (found?.id) return found.id;
  const data: any = { name };
  if (groupId) data.groupId = groupId;
  const created = await unwrap(await api.post('/api/core/project', { data }));
  const id = created?.id ?? created?.data?.id;
  if (!id) throw new Error(`createProject 失败：${JSON.stringify(created)}`);
  return id;
}
