'use client';

import { useCallback, useState } from 'react';
import type {
  PageParams,
  PageResult,
  PaginationState,
  LegacyPageResult,
} from '@/beans/pagination';
import { calculatePaginationState, createInitialPaginationState } from '@/beans/pagination';

/** usePagination Options */
export interface UsePaginationOptions<T = unknown, P extends PageParams = PageParams> {
  /** 请求函数，接收分页参数，返回 Promise<PageResult<T>> */
  fetchFn: (params: P) => Promise<PageResult<T>>;
  /** 初始分页参数 */
  initialParams?: Partial<P>;
  /** 每页条数（默认 20） */
  pageSize?: number;
  /** 是否立即加载第一页（默认 true） */
  immediate?: boolean;
  /** 追加模式：true=追加数据，false=替换数据 */
  appendMode?: boolean;
}

/** usePagination 返回值 */
export interface UsePaginationReturn<T = unknown> {
  /** 分页状态 */
  pagination: PaginationState;
  /** 数据列表 */
  list: T[];
  /** 加载指定页 */
  loadPage: (page: number) => void;
  /** 加载下一页 */
  loadNextPage: () => void;
  /** 刷新（重新加载第一页） */
  refresh: () => void;
  /** 加载更多（追加模式） */
  loadMore: () => void;
  /** 重置分页状态 */
  reset: () => void;
  /** 修改每页条数并重新加载 */
  changePageSize: (size: number) => void;
}

/**
 * 统一分页 Hook
 * 封装分页状态管理和数据加载逻辑
 *
 * @example
 * // 基础用法
 * const { pagination, list, loadNextPage, refresh } = usePagination({
 *   fetchFn: (params) => api.getContent(params),
 * });
 *
 * @example
 * // 带额外参数
 * const { pagination, list, loadNextPage } = usePagination({
 *   fetchFn: (params) => api.getContent({ ...params, categoryId: 1 }),
 *   initialParams: { categoryId: 1 },
 * });
 *
 * @example
 * // 追加模式（无限滚动）
 * const { list, loadMore, pagination } = usePagination({
 *   fetchFn: (params) => api.getList(params),
 *   appendMode: true,
 * });
 */
export function usePagination<T = unknown, P extends PageParams = PageParams>(
  options: UsePaginationOptions<T, P>
): UsePaginationReturn<T> {
  const {
    fetchFn,
    initialParams = {} as Partial<P>,
    pageSize = 20,
    immediate = true,
    appendMode = false,
  } = options;

  const [pagination, setPagination] = useState<PaginationState>(() => ({
    ...createInitialPaginationState(),
    pageSize,
  }));
  const [list, setList] = useState<T[]>([]);

  /** 执行分页请求 */
  const executeFetch = useCallback(
    async (page: number, currentAppendMode: boolean) => {
      setPagination((prev) => ({ ...prev, loading: true }));

      try {
        const params = { ...initialParams, page, pageSize } as P;
        const result = await fetchFn(params);

        const computed = calculatePaginationState(page, pageSize, result.total);

        setPagination((prev) => ({
          ...prev,
          page,
          loading: false,
          ...computed,
        }));

        setList((prevList) =>
          currentAppendMode ? [...prevList, ...result.list] : result.list
        );

        return result;
      } catch (error) {
        setPagination((prev) => ({ ...prev, loading: false }));
        throw error;
      }
    },
    [fetchFn, initialParams, pageSize]
  );

  /** 加载指定页 */
  const loadPage = useCallback(
    (page: number) => {
      executeFetch(page, false);
    },
    [executeFetch]
  );

  /** 加载下一页 */
  const loadNextPage = useCallback(() => {
    const nextPage = pagination.page + 1;
    executeFetch(nextPage, appendMode);
  }, [pagination.page, appendMode, executeFetch]);

  /** 刷新（重新加载第一页） */
  const refresh = useCallback(() => {
    executeFetch(1, false);
  }, [executeFetch]);

  /** 加载更多（追加模式） */
  const loadMore = useCallback(() => {
    if (pagination.hasMore && !pagination.loading) {
      loadNextPage();
    }
  }, [pagination.hasMore, pagination.loading, loadNextPage]);

  /** 重置分页状态 */
  const reset = useCallback(() => {
    setPagination({ ...createInitialPaginationState(), pageSize });
    setList([]);
  }, [pageSize]);

  /** 修改每页条数并重新加载 */
  const changePageSize = useCallback(
    (size: number) => {
      setPagination((prev) => ({ ...prev, pageSize: size }));
      executeFetch(1, false);
    },
    [executeFetch]
  );

  // 立即加载第一页
  if (immediate && pagination.page === 1 && list.length === 0 && !pagination.loading) {
    // 使用 setTimeout 避免在渲染期间执行副作用
    setTimeout(() => executeFetch(1, false), 0);
  }

  return {
    pagination,
    list,
    loadPage,
    loadNextPage,
    refresh,
    loadMore,
    reset,
    changePageSize,
  };
}

/** 旧版 API 响应归一化 */
export function normalizeLegacyPageResponse<T>(data: LegacyPageResult<T>): PageResult<T> {
  const list = data.list ?? data.records ?? [];
  const total = data.total ?? data.totalRow ?? 0;
  const pageSize = data.pageSize ?? 20;
  const totalPages = data.totalPages ?? Math.ceil(total / pageSize);
  const hasMore = data.hasMore ?? (pageSize > 0 && total > pageSize);

  return {
    list,
    total,
    page: data.page ?? 1,
    pageSize,
    totalPages,
    hasMore,
  };
}
