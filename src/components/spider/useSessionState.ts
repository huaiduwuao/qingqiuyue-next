'use client';

/**
 * useSessionState —— 存在 sessionStorage 里的 useState。
 *
 * 后台切菜单是真路由跳转,页面组件整个卸载;补全 / 修复任务在后端照跑,
 * 可面板里的 task_id、选中的内容都放在组件 state 里,切回来就是一张空白面板,
 * 看起来像任务丢了。存进 sessionStorage 后,回到页面能按 task_id 重新接上。
 *
 * - 挂载后再读存储(不在 useState 初始化里读),静态导出的预渲染没有 sessionStorage,
 *   首帧读了会和服务端 HTML 对不上。
 * - 只在 setter 里写,不用 effect 同步 —— effect 同步会在读回之前先把初始值写回去。
 * - 存储不可用(隐私模式等)时退化成普通 state。
 */

import { useCallback, useEffect, useState } from 'react';

export function useSessionState<T>(key: string, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* 存储不可用或内容损坏:用初始值 */
    }
  }, [key]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        if (next == null) sessionStorage.removeItem(key);
        else sessionStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* 写不进去就只留在内存里 */
      }
    },
    [key],
  );

  return [value, set];
}
