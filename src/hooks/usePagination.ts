import type { PageResult, LegacyPageResult } from '@/beans/pagination';
import { normalizePageResponse } from '@/beans/pagination';

// 原来这里的 usePagination hook 没有任何调用方,而且在 render 里 setTimeout 触发请求
// (首页为空时会无限重拉),已删除。只剩下面这个兼容导出给 src/apis/* 用,
// 新代码直接 import { normalizePageResponse } from '@/beans/pagination'。

/** 旧版 API 响应归一化 —— 就是 beans/pagination 的 normalizePageResponse。
 * @deprecated 改用 `normalizePageResponse`(@/beans/pagination)
 */
export function normalizeLegacyPageResponse<T>(data: LegacyPageResult<T>): PageResult<T> {
  return normalizePageResponse(data);
}
