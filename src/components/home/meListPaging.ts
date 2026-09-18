/**
 * 「我的」页列表(/me/list)的翻页判断。
 *
 * 单独拎出来是因为它是这个页面唯一有分支的逻辑,而且踩过坑:页面上写着
 * 「共 136316 个作品」,列表却只有第一页 —— 之前压根没往下翻,后端按默认
 * pageSize=20 返回,前端把 COUNT(*) 当标题用。
 */

/** /me/list 每页条数。后端 MaxPageSize = 100。 */
export const LIST_PAGE_SIZE = 24;

export type MeListPage = {
  list?: unknown[];
  /** 后端的 COUNT(*);未实现的页签回 0 */
  total?: number;
};

/**
 * 返回下一页页码;没有下一页时返回 undefined(react-query 据此置 hasNextPage=false)。
 *
 * total 是权威的:按"已加载够没够 total"判断,不看 hasMore —— 那个字段带
 * omitempty,false 时根本不出现在 JSON 里,只能当"有"用、不能当"没有"用。
 * total 拿不到(0)时退回"最后一页没装满就是到底了"。
 */
export function nextMeListPage(
  last: MeListPage | undefined,
  all: MeListPage[],
  pageSize: number = LIST_PAGE_SIZE,
): number | undefined {
  if (!last?.list?.length) return undefined;
  const loaded = all.reduce((n, p) => n + (p.list?.length ?? 0), 0);
  const total = last.total ?? 0;
  if (total > 0 ? loaded >= total : last.list.length < pageSize) return undefined;
  return all.length + 1;
}
