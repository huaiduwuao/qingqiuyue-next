'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** 工作台当前子页面放在 URL 的 ?tab= 上。 */
export const TAB_PARAM = 'tab';

/**
 * 解析 URL 上的 tab。旧 id 先经 aliases 映射;不在允许列表里(过期书签、手改 URL、
 * 无权限的入口)时回落到默认页。
 */
export function resolveTab(
  raw: string | null | undefined,
  allowed: ReadonlySet<string>,
  fallback: string,
  aliases: Readonly<Record<string, string>> = {},
): string {
  if (!raw) return fallback;
  const id = aliases[raw] ?? raw;
  return allowed.has(id) ? id : fallback;
}

/**
 * 工作台 tab 状态,以 URL 为准。
 *
 * 此前两个工作台都把 tab 存在 React state 里:子页面无法被链接(新手指引、通知、
 * 站内跳转都只能落到默认页),刷新后回到首页。改成 ?tab= 之后可以直接分享和刷新;
 * 切换时用 router.replace 而不是 push,不会一次点击压一条历史 —— 顶栏的返回按钮
 * 仍然回到进入工作台之前的页面。
 *
 * 调用方所在的组件树需要被 <Suspense> 包裹(useSearchParams 在静态导出下的要求)。
 */
export function useUrlTab(
  allowed: ReadonlySet<string>,
  fallback: string,
  aliases?: Readonly<Record<string, string>>,
): readonly [string, (id: string) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = resolveTab(searchParams.get(TAB_PARAM), allowed, fallback, aliases);

  const setTab = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id === fallback) next.delete(TAB_PARAM);
      else next.set(TAB_PARAM, id);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [fallback, pathname, router, searchParams],
  );

  return [tab, setTab] as const;
}
