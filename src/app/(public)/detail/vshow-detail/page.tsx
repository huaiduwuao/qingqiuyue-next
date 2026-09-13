'use client';

import React from 'react';
import { detail as contentDetail } from '@/apis/content-vshow';
import { page as itemPage } from '@/apis/content-vshow-item';
import { EpisodicVideoDetail, type EpisodicVideoConfig } from '@/components/detail/EpisodicVideoDetail';

const config: EpisodicVideoConfig = {
  kind: 'vshow',
  trackType: 'VSHOW',
  typeLabel: '综艺',
  unit: '期',
  listVariant: 'list',
  listTitle: '选期播放',
  introTitle: '节目简介',
  people: [
    { label: '主持人', key: 'host' },
    { label: '常驻嘉宾', key: 'guests' },
  ],
  initialDuration: 90 * 60,
  fetchDetail: (id) => contentDetail({ id }),
  fetchItems: itemPage,
};

export default function VShowDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <EpisodicVideoDetail config={config} />
    </React.Suspense>
  );
}
