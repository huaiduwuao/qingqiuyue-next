'use client';

import { useEffect, useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { LIST_PAGE_SIZE, nextMeListPage } from '@/components/home/meListPaging';
import { homeClient, formatApiError } from '@/lib/api/client';
import { setMark } from '@/apis/content-mark';
import { privacyActionOf, type ListResp, type MyItem, type WorkVisibility } from './myHomeModel';

/** 「我的」列表:按页取 /me/list,滚到底自动续下一页。 */
export function useMeList(mainTab: string, subTab: string, keywordQuery: string, dateRange: string) {
  // 列表是分页的:以前这里只打一次 /me/list(后端默认 pageSize=20),页面却照着
  // COUNT(*) 写「共 N 个作品」—— N 上万、列表永远 20 条、往下滚也不会再请求。
  // 现在按页取,滚到底自动续下一页。
  //
  // 关键词和时间范围一起发给后端:筛选必须和分页在同一条查询里,否则筛的永远只是
  // "已经加载到的那几条"。它们进 queryKey,所以改条件 = 换一个查询,自动从第 1 页重来。
  const listQuery = useInfiniteQuery({
    queryKey: ['home', 'me', 'list', mainTab, subTab, keywordQuery, dateRange],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({
        tab: mainTab,
        sub: subTab,
        page: String(pageParam),
        pageSize: String(LIST_PAGE_SIZE),
      });
      if (keywordQuery) qs.set('keyword', keywordQuery);
      if (dateRange !== 'all') qs.set('range', dateRange);
      return homeClient.get<ListResp>(`/me/list?${qs}`).then((r) => r);
    },
    getNextPageParam: (last, all) => nextMeListPage(last, all),
    // 换关键词时先留着上一批,列表不会闪成空白再填回来
    placeholderData: (prev) => prev,
  });

  const loadedList = useMemo(
    () => listQuery.data?.pages.flatMap((p) => p.list ?? []) ?? [],
    [listQuery.data],
  );

  // 滚到底自动续页。哨兵挂在列表末尾,滚动容器是 home/layout 的 <main>(overflow:auto),
  // hook 自己往上找。
  const scroll = useInfiniteScroll({
    enabled: listQuery.hasNextPage && !listQuery.isFetchingNextPage && !listQuery.isLoading,
  });

  useEffect(() => {
    if (scroll.isNearBottom && listQuery.hasNextPage && !listQuery.isFetchingNextPage) {
      listQuery.fetchNextPage();
    }
  }, [scroll.isNearBottom, listQuery.hasNextPage, listQuery.isFetchingNextPage, listQuery.fetchNextPage]);
  return { listQuery, loadedList, scroll };
}

/** 「我的」页的写操作:保存资料、作品私密开关、私密账号开关、取消预约。结果提示走 setToast。 */
export function useMyHomeMutations({
  setToast,
  setEditOpen,
  setCancelDialog,
}: {
  setToast: (msg: string | null) => void;
  setEditOpen: (open: boolean) => void;
  setCancelDialog: (it: MyItem | null) => void;
}) {
  const qc = useQueryClient();

  const saveProfileMutation = useMutation({
    mutationFn: (payload: Record<string, any>) => homeClient.post('/me/profile', payload).then((r) => r),
    onSuccess: () => {
      setToast('资料已更新');
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ['home', 'me', 'profile'] });
    },
    onError: () => {
      setToast('保存失败,请重试');
    },
  });

  // 单个作品的私密开关:写 module_content.status(UN_PUBLISH = 私密),只影响这一个作品。
  // 以前这里打的是账号级的 /me/toggle-private,还把作品 id 一起塞进去:作品纹丝不动,
  // 账号的 is_private 反而被改掉了。
  //
  // 取消私密要过审(平台规则:非运营人员上线内容一律进审核),所以提示按后端回的
  // 真实状态说,不写死"已公开"。
  const workPrivacyMutation = useMutation({
    mutationFn: (it: MyItem) =>
      homeClient
        .post<{ visibility?: WorkVisibility }>(`/me/works/${it.id}/private`, {
          private: privacyActionOf(it) === 'hide',
        })
        .then((r) => r),
    onSuccess: (data) => {
      setToast(
        data?.visibility === 'private' ? '已设为私密,仅自己可见'
          : data?.visibility === 'reviewing' ? '已提交审核,通过后重新公开'
          : data?.visibility === 'public' ? '已设为公开'
          : '已更新'
      );
      qc.invalidateQueries({ queryKey: ['home', 'me', 'list'] });
    },
    onError: (err) => setToast(formatApiError(err)),
  });

  // 账号级私密开关(「私密账号」):开启后别人看我的主页拿不到任何作品。
  // 和上面那个作品开关是两码事,入口也分开:这个只在「编辑资料」里。
  const accountPrivateMutation = useMutation({
    mutationFn: (next: boolean) =>
      homeClient.post<{ isPrivate?: boolean }>('/me/toggle-private', { isPrivate: next }).then((r) => r),
    onSuccess: (data) => {
      setToast(data?.isPrivate ? '已开启私密账号,作品仅自己可见' : '已关闭私密账号');
      qc.invalidateQueries({ queryKey: ['home', 'me', 'profile'] });
    },
    onError: (err) => setToast(formatApiError(err)),
  });

  const cancelAppointmentMutation = useMutation({
    mutationFn: (item: MyItem) => setMark(item.id, 'reserve', false),
    onSuccess: () => {
      setToast('已取消预约');
      setCancelDialog(null);
      qc.invalidateQueries({ queryKey: ['home', 'me', 'list'] });
    },
    onError: (err) => {
      setToast(formatApiError(err));
    },
  });
  return { saveProfileMutation, workPrivacyMutation, accountPrivateMutation, cancelAppointmentMutation };
}
