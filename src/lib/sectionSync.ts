'use client';

import { useEffect, useRef } from 'react';

import { fetchMySections, saveMySections } from '@/apis/home-sections';
import { useApp } from '@/contexts/AppContext';

import type { HomeSection } from './homeSections';
import {
  hydrateSections,
  sectionsTouched,
  snapshotSections,
  subscribeSections,
} from './sectionPrefs';

/**
 * 频道列表的账号同步。
 *
 * 本机 localStorage 仍是第一手(未登录、离线、请求失败都不影响用),
 * 登录后再和账号里的那份对齐:
 *
 *   账号里有 → 以账号为准(换设备打开就是同一排页签)
 *   账号里空 + 本机用户动过 → 把本机这份迁上去(老用户第一次登录不丢自己的排布)
 *   两边都空 → 什么都不做,用默认排布
 *
 * 之后每次改动防抖一下再整批 PUT。失败不回滚本机 —— 宁可这台机器上先生效,
 * 下次改动或下次登录再补上,也不要因为网络抖动把用户刚拖好的顺序弹回去。
 */

const PUSH_DELAY = 800;

export function useHomeSectionSync() {
  const { currentUser } = useApp();
  const userId = currentUser?.id ? String(currentUser.id) : '';
  // 已经和账号对齐过:没对齐前不要把本机内容往上推(会盖掉别的设备的)
  const readyForUserRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // hydrate 自己也会触发 store 事件,别把它当成"用户改了"又推回去
  const hydratingRef = useRef(false);

  // 登录 / 换账号:拉账号里的那份
  useEffect(() => {
    if (!userId) {
      readyForUserRef.current = '';
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { list, needLogin } = await fetchMySections();
        if (cancelled || needLogin) return;
        if (list.length > 0) {
          hydratingRef.current = true;
          hydrateSections(list);
          hydratingRef.current = false;
        } else if (sectionsTouched()) {
          // 账号里还没有,本机是用户自己排过的 → 迁上去
          await saveMySections(snapshotSections());
        }
        readyForUserRef.current = userId;
      } catch {
        /* 拉不到就继续用本机那份 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // 本机改动 → 防抖整批推上去
  useEffect(() => {
    if (!userId) return;
    const push = () => {
      if (hydratingRef.current || readyForUserRef.current !== userId) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const list: HomeSection[] = snapshotSections();
        saveMySections(list).catch(() => {
          /* 推不上去不影响本机;下次改动或下次登录再补 */
        });
      }, PUSH_DELAY);
    };
    const unsubscribe = subscribeSections(push);
    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [userId]);
}
