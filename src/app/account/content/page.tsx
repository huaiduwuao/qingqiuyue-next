'use client';

import React, { useMemo } from 'react';
import { useActiveTab } from './ActiveTabContext';

import DashboardView from './_views/dashboard/page';
import HdPublishView from './_views/hd-publish/page';
import HdReviewView from './_views/hd-review/page';
import ActivityView from './_views/activity/page';
import CoCreateView from './_views/co-create/page';
import CollectionView from './_views/collection/page';
import WorksView from './_views/works/page';
import SpiderView from './_views/spider/page';
import CrawledView from './_views/crawled/page';
import OriginalView from './_views/original/page';
import DataView from './_views/data/page';
import CreatorView from './_views/creator/page';
import MonetizeView from './_views/monetize/page';

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
