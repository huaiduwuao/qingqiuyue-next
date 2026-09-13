'use client';

import React from 'react';
import { detail as contentDetail } from '@/apis/content-teleplay';
import { page as episodePage } from '@/apis/content-teleplay-item';
import { EpisodicVideoDetail, type EpisodicVideoConfig } from '@/components/detail/EpisodicVideoDetail';

// 电视剧与短剧共用这个详情页(见 contentType.gen.ts 的 TYPE_TO_ROUTE)。
const config: EpisodicVideoConfig = {
  kind: 'teleplay',
  trackType: 'TELEPLAY',
  typeLabel: '电视剧',
  unit: '集',
  listVariant: 'grid',
  listTitle: '选集播放',
  introTitle: '剧情简介',
  people: [
    { label: '导演', key: 'director' },
    { label: '主演', key: 'actors' },
  ],
  initialDuration: 45 * 60,
  fetchDetail: (id) => contentDetail({ id }),
  fetchItems: episodePage,
};

export default function TeleplayDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <EpisodicVideoDetail config={config} />
    </React.Suspense>
  );
}
