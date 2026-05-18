'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

const contentTypes = [
  { key: 'article', label: '文章' },
  { key: 'video', label: '视频' },
  { key: 'music', label: '音乐' },
  { key: 'novel', label: '小说' },
  { key: 'novel-chapter', label: '小说章节' },
  { key: 'film', label: '电影' },
  { key: 'teleplay', label: '电视剧' },
  { key: 'animation', label: '动画' },
  { key: 'animation-item', label: '动画集' },
  { key: 'comics', label: '漫画' },
  { key: 'comics-item', label: '漫画集' },
  { key: 'vshow', label: '微剧' },
  { key: 'vshow-item', label: '微剧集' },
  { key: 'live', label: '直播' },
  { key: 'picture-album', label: '相册' },
  { key: 'picture-detail', label: '图片详情' },
  { key: 'news', label: '新闻' },
  { key: 'pan', label: '网盘' },
  { key: 'website', label: '网站' },
  { key: 'urls', label: '链接' },
  { key: 'spider-queue', label: '爬虫队列' },
  { key: 'todo-queue', label: '待办队列' },
];

// Dynamic imports for code splitting
const componentMap: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  article: React.lazy(() => import('./components/article/page')),
  video: React.lazy(() => import('./components/video/page')),
  music: React.lazy(() => import('./components/music/page')),
  novel: React.lazy(() => import('./components/novel/page')),
  'novel-chapter': React.lazy(() => import('./components/novel-chapter/page')),
  film: React.lazy(() => import('./components/film/page')),
  teleplay: React.lazy(() => import('./components/teleplay/page')),
  animation: React.lazy(() => import('./components/animation/page')),
  'animation-item': React.lazy(() => import('./components/animation-item/page')),
  comics: React.lazy(() => import('./components/comics/page')),
  'comics-item': React.lazy(() => import('./components/comics-item/page')),
  vshow: React.lazy(() => import('./components/vshow/page')),
  'vshow-item': React.lazy(() => import('./components/vshow-item/page')),
  live: React.lazy(() => import('./components/live/page')),
  'picture-album': React.lazy(() => import('./components/picture-album/page')),
  'picture-detail': React.lazy(() => import('./components/picture-detail/page')),
  news: React.lazy(() => import('./components/news/page')),
  pan: React.lazy(() => import('./components/pan/page')),
  website: React.lazy(() => import('./components/website/page')),
  urls: React.lazy(() => import('./components/urls/page')),
  'spider-queue': React.lazy(() => import('./components/spider-queue/page')),
  'todo-queue': React.lazy(() => import('./components/todo-queue/page')),
};

export default function AccountContentPage() {
  const [tab, setTab] = useState(0);
  const currentType = contentTypes[tab];
  const ContentComponent = componentMap[currentType?.key];

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>内容管理</Typography>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          {contentTypes.map((type, index) => (
            <Tab key={type.key} label={type.label} />
          ))}
        </Tabs>
        <Box sx={{ mt: 3 }}>
          {ContentComponent ? (
            <React.Suspense fallback={<Typography>加载中...</Typography>}>
              <ContentComponent />
            </React.Suspense>
          ) : (
            <Typography color="text.secondary">内容类型: {currentType?.label}</Typography>
          )}
        </Box>
      </Box>
    </Container>
  );
}
