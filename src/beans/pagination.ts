/**
 * 统一分页类型定义
 * 与后端 response.SuccessPageEx 响应格式对齐
 */

/** 统一分页请求参数 */
export interface PageParams {
  /** 当前页码（从 1 开始） */
  page?: number;
  /** 当前页码（别名，兼容旧代码） */
  pageNumber?: number;
  /** 每页条数（默认 20，最大 100） */
  pageSize?: number;
}

/** 统一分页响应数据 */
export interface PageResult<T = unknown> {
  /** 数据列表 */
  list: T[];
  /** 总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 是否有更多数据 */
  hasMore: boolean;
}

/** 兼容旧格式的分页响应（后端可能返回 records/totalRow） */
export interface LegacyPageResult<T = unknown> {
  /** 数据列表（兼容 records） */
  list: T[];
  /** 总记录数（兼容 totalRow） */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页条数 */
  pageSize: number;
  /** 总页数（部分接口可能缺失） */
  totalPages?: number;
  /** 是否有更多数据（部分接口可能缺失） */
  hasMore?: boolean;
  /** 兼容字段：records */
  records?: T[];
  /** 兼容字段：totalRow */
  totalRow?: number;
}

/** 分页状态 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  loading: boolean;
  hasMore: boolean;
}

/** 创建初始分页状态 */
export function createInitialPaginationState(): PaginationState {
  return {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
    loading: false,
    hasMore: false,
  };
}

/** 从响应数据计算分页状态 */
export function calculatePaginationState(
  page: number,
  pageSize: number,
  total: number
): Pick<PaginationState, 'total' | 'totalPages' | 'hasMore'> {
  const totalPages = Math.ceil(total / pageSize);
  return {
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

/** API 响应归一化：统一字段名 */
export function normalizePageResponse<T>(data: LegacyPageResult<T>): PageResult<T> {
  const list = data.list ?? data.records ?? [];
  const total = data.total ?? data.totalRow ?? 0;
  const page = data.page ?? 1;
  const pageSize = data.pageSize ?? 20;
  const totalPages = data.totalPages ?? Math.ceil(total / pageSize);
  const hasMore = data.hasMore ?? page < totalPages;

  return {
    list,
    total,
    page: data.page ?? 1,
    pageSize,
    totalPages,
    hasMore,
  };
}
