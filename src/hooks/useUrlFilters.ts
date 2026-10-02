'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * 把列表页的筛选条件放在 URL 查询参数里,而不是 useState。
 *
 * 放在 useState 里的筛选,点进详情页时组件卸载,返回后就回到默认值 ——
 * 用户刚选好的「日本 · 动漫 · 高评分」全丢了。放在 URL 里,浏览器返回、
 * 刷新、分享链接都能还原;主滚动条的位置(home/layout 按完整 URL 存)
 * 也跟着筛选条件对得上。
 *
 * 取值等于默认值时从 URL 删掉,地址栏保持干净。同一个 tick 里连着调几次
 * setFilters(比如目录到达后一次清掉好几个失效选项)会合并成一次结果,
 * 不会后一次覆盖前一次。
 */
export function useUrlFilters<T extends Record<string, string>>(
  defaults: T,
): [T, (patch: Partial<T>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  // 调用方每次渲染传进来的都是新对象(默认值可能随 props 变),按内容比较。
  const defaultsKey = JSON.stringify(defaults);
  const defs = useMemo(() => JSON.parse(defaultsKey) as T, [defaultsKey]);

  const values = useMemo(() => {
    const p = new URLSearchParams(qs);
    const out = {} as Record<string, string>;
    for (const [k, d] of Object.entries(defs)) out[k] = p.get(k) ?? d;
    return out as T;
  }, [qs, defs]);

  // router.replace 不会立即反映到 useSearchParams,连续调用时以上一次拼好的为准。
  const pending = useRef<string | null>(null);
  useEffect(() => {
    pending.current = null;
  }, [qs]);

  const setFilters = useCallback(
    (patch: Partial<T>) => {
      const p = new URLSearchParams(pending.current ?? qs);
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        if (v === '' || v === defs[k]) p.delete(k);
        else p.set(k, v as string);
      }
      const next = p.toString();
      if (next === (pending.current ?? qs)) return;
      pending.current = next;
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    },
    [qs, defs, pathname, router],
  );

  return [values, setFilters];
}
