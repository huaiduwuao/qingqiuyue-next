'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useActiveTab } from './ActiveTabContext';

// 创作者中心各 tab view 全是 client 组件 + 大量 useQuery,pre-render 时拿不到
// React Context(`useActiveTab`)会触发 "Cannot read properties of undefined"。
// 改用 next/dynamic + ssr:false 让 SSR 阶段直接跳过,运行时再渲染。
const DashboardView = dynamic(() => import('./_views/dashboard/page'), { ssr: false });
const HdPublishView = dynamic(() => import('./_views/hd-publish/page'), { ssr: false });
const ImagePublishView = dynamic(() => import('./_views/image-publish/page'), { ssr: false });
const ImageMvPublishView = dynamic(() => import('./_views/image-mv-publish/page'), { ssr: false });
const ArticlePublishView = dynamic(() => import('./_views/article-publish/page'), { ssr: false });
const NovelPublishView = dynamic(() => import('./_views/novel-publish/page'), { ssr: false });
const NewsPublishView = dynamic(() => import('./_views/news-publish/page'), { ssr: false });
const MusicPublishView = dynamic(() => import('./_views/music-publish/page'), { ssr: false });
const ComicsPublishView = dynamic(() => import('./_views/comics-publish/page'), { ssr: false });
const VshowPublishView = dynamic(() => import('./_views/vshow-publish/page'), { ssr: false });
const TeleplayPublishView = dynamic(() => import('./_views/teleplay-publish/page'), { ssr: false });
const FilmPublishView = dynamic(() => import('./_views/film-publish/page'), { ssr: false });
const AnimationPublishView = dynamic(() => import('./_views/animation-publish/page'), { ssr: false });
const LivePublishView = dynamic(() => import('./_views/live-publish/page'), { ssr: false });
const HdReviewView = dynamic(() => import('./_views/hd-review/page'), { ssr: false });
const ActivityView = dynamic(() => import('./_views/activity/page'), { ssr: false });
const CoCreateView = dynamic(() => import('./_views/co-create/page'), { ssr: false });
const CollectionView = dynamic(() => import('./_views/collection/page'), { ssr: false });
const WorksView = dynamic(() => import('./_views/works/page'), { ssr: false });
const SpiderView = dynamic(() => import('./_views/spider/page'), { ssr: false });
const CrawledView = dynamic(() => import('./_views/crawled/page'), { ssr: false });
const OriginalView = dynamic(() => import('./_views/original/page'), { ssr: false });
const DataView = dynamic(() => import('./_views/data/page'), { ssr: false });
const CreatorView = dynamic(() => import('./_views/creator/page'), { ssr: false });
const MonetizeView = dynamic(() => import('./_views/monetize/page'), { ssr: false });

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
 */
export default function CreatorContentPage() {
  const { activeTab } = useActiveTab();

  const view = useMemo(() => {
    switch (activeTab) {
      case 'hd-publish':
        return <HdPublishView />;
      case 'image-publish':
        return <ImagePublishView />;
      case 'image-mv-publish':
        return <ImageMvPublishView />;
      case 'article-publish':
        return <ArticlePublishView />;
      case 'novel-publish':
        return <NovelPublishView />;
      case 'news-publish':
        return <NewsPublishView />;
      case 'music-publish':
        return <MusicPublishView />;
      case 'comics-publish':
        return <ComicsPublishView />;
      case 'vshow-publish':
        return <VshowPublishView />;
      case 'teleplay-publish':
        return <TeleplayPublishView />;
      case 'film-publish':
        return <FilmPublishView />;
      case 'animation-publish':
        return <AnimationPublishView />;
      case 'live-publish':
        return <LivePublishView />;
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
      case 'spider':
        return <SpiderView />;
      case 'crawled':
        return <CrawledView />;
      case 'original':
        return <OriginalView />;
      case 'data':
        return <DataView />;
      case 'creator':
        return <CreatorView />;
      case 'monetize':
        return <MonetizeView />;
      case 'content':
      default:
        return <DashboardView />;
    }
  }, [activeTab]);

  return view;
}
