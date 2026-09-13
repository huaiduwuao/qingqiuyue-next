'use client';

import React from 'react';
import { detail as contentDetail } from '@/apis/content-animation';
import { page as itemPage } from '@/apis/content-animation-item';
import { EpisodicVideoDetail, type EpisodicVideoConfig } from '@/components/detail/EpisodicVideoDetail';

const config: EpisodicVideoConfig = {
  kind: 'animation',
  trackType: 'ANIMATION',
  typeLabel: '动漫',
  unit: '话',
  listVariant: 'grid',
  listTitle: '选集播放',
  introTitle: '剧情简介',
  people: [
    { label: '导演', key: 'director' },
    { label: '声优', key: 'actors' },
  ],
  initialDuration: 24 * 60,
  fetchDetail: (id) => contentDetail('animation', { id }),
  fetchItems: itemPage,
};

export default function AnimationDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <EpisodicVideoDetail config={config} />
    </React.Suspense>
  );
}
