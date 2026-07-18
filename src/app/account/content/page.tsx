'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useActiveTab } from './ActiveTabContext';

// 创作者中心各 tab view 全是 client 组件 + 大量 useQuery,pre-render 时拿不到
// React Context(`useActiveTab`)会触发 "Cannot read properties of undefined"。
// 改用 next/dynamic + ssr:false 让 SSR 阶段直接跳过,运行时再渲染。
const DashboardView = dynamic(() => import('./_views/dashboard/page'), { ssr: false });
const HdPublishView = dynamic(() => import('./_views/hd-publish/page'), { ssr: false });
const HdReviewView = dynamic(() => import('./_views/hd-review/page'), { ssr: false });
const ActivityView = dynamic(() => import('./_views/activity/page'), { ssr: false });
const CoCreateView = dynamic(() => import('./_views/co-create/page'), { ssr: false });
const CollectionView = dynamic(() => import('./_views/collection/page'), { ssr: false });
const WorksView = dynamic(() => import('./_views/works/page'), { ssr: false });
const OriginalView = dynamic(() => import('./_views/original/page'), { ssr: false });
const DataView = dynamic(() => import('./_views/data/page'), { ssr: false });
const CreatorView = dynamic(() => import('./_views/creator/page'), { ssr: false });
const MonetizeView = dynamic(() => import('./_views/monetize/page'), { ssr: false });
const ShortdramaGenView = dynamic(() => import('./_views/shortdrama-gen/page'), { ssr: false });

/**
 * Single entry point for the creator workspace. Sub-pages used to live at
 * /account/content/{tab} as separate routes, which meant every sidebar click
 * pushed a new entry onto the browser history. The top-app-bar back arrow
 * (router.back) would then walk the user through every tab they visited
 * before finally returning to the page they came from.
 *
 * Tab state now lives in ActiveTabContext; this page just looks up the
 * current tab and renders the matching view. The URL stays at
 * /account/content the whole time.
 *
 * 重构后:所有 12 个 publish-* 旧 tab id 都已重定向到 'hd-publish' dispatcher。
 * 现在 tab 列表只剩 12 条业务 tab + hd-publish,switch 分支大幅减少。
 *
 * 注意:爬虫管理/抓取内容/假人管理 已迁移到管理平台(/system/spider),不再在此渲染。
 */
export default function CreatorContentPage() {
  const { activeTab } = useActiveTab();

  const view = useMemo(() => {
    switch (activeTab) {
      // 唯一发布入口。所有旧 publish-* tab 兼容:虽 ActiveTabContext 已收窄
      // ALLOWED_IDS,但若有遗留 deep-link 进来,统一走 HdPublishView(默认 chip = 'video')。
      case 'hd-publish':
      case 'image-publish':
      case 'image-mv-publish':
      case 'article-publish':
      case 'novel-publish':
      case 'news-publish':
      case 'music-publish':
      case 'comics-publish':
      case 'vshow-publish':
      case 'teleplay-publish':
      case 'film-publish':
      case 'animation-publish':
      case 'live-publish':
        return <HdPublishView />;
      case 'hd-review':
        return <HdReviewView />;
      case 'activity':
        return <ActivityView />;
      case 'co-create':
        return <CoCreateView />;
      case 'collection':
        return <CollectionView />;
      case 'works':
        return <WorksView />;
      case 'original':
        return <OriginalView />;
      case 'data':
        return <DataView />;
      case 'creator':
        return <CreatorView />;
      case 'monetize':
        return <MonetizeView />;
      case 'shortdrama-gen':
        return <ShortdramaGenView />;
      case 'content':
      default:
        return <DashboardView />;
    }
  }, [activeTab]);

  return view;
}
