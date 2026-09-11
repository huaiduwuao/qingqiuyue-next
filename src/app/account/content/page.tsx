'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useActiveTab } from './ActiveTabContext';
import { CONTENT_HOME_TAB, STAFF_TAB_IDS, useIsContentStaff } from './navigation';

// 各子页面都是重度 client 组件(大量 useQuery + context),预渲染阶段跳过。
const lazyView = (loader: () => Promise<{ default: React.ComponentType }>) => dynamic(loader, { ssr: false });

const VIEWS: Record<string, React.ComponentType> = {
  [CONTENT_HOME_TAB]: lazyView(() => import('./_views/dashboard/page')),
  'hd-publish': lazyView(() => import('./_views/hd-publish/page')),
  works: lazyView(() => import('./_views/works/page')),
  collection: lazyView(() => import('./_views/collection/page')),
  'shortdrama-gen': lazyView(() => import('./_views/shortdrama-gen/page')),
  data: lazyView(() => import('./_views/data/page')),
  activity: lazyView(() => import('./_views/activity/page')),
  creator: lazyView(() => import('./_views/creator/page')),
  monetize: lazyView(() => import('./_views/monetize/MonetizeHub')),
  original: lazyView(() => import('./_views/original/page')),
  'hd-review': lazyView(() => import('./_views/hd-review/page')),
};

/**
 * 创作者中心唯一的页面入口。当前子页面由 URL 的 ?tab= 决定(见 ActiveTabContext);
 * 导航结构与各入口说明在 navigation.tsx。运营专属的子页面对普通用户回落到工作台。
 */
export default function CreatorContentPage() {
  const { activeTab } = useActiveTab();
  const isStaff = useIsContentStaff();
  const tab = STAFF_TAB_IDS.has(activeTab) && !isStaff ? CONTENT_HOME_TAB : activeTab;
  const View = VIEWS[tab] ?? VIEWS[CONTENT_HOME_TAB];
  return <View />;
}
