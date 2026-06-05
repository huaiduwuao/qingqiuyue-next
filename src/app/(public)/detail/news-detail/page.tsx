'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SourceIcon from '@mui/icons-material/Source';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsIcon from '@mui/icons-material/Settings';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-news';
import { withDefaults } from '@/utils/withDefaults';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { ReadingSettings, DEFAULT_PAGE_STYLE, type PageStyle } from '@/components/detail/ReadingSettings';
import { ReadingContainer } from '@/components/detail/ReadingContainer';
import { useContentNavigate } from '@/lib/contentRoute';

interface News {
  id: number;
  title: string;
  subtitle?: string;
  cover?: string;
  source: string;
  sourceLogo?: string;
  author?: string;
  publishTime: string;
  viewCount: number;
  likeCount: number;
  category: string;
  tags: string[];
  content: string;
  sourceUrl?: string;
}

const MOCK_NEWS: News = {
  id: 1,
  title: '非遗手工艺传承新路径:数字技术助力传统工艺走向世界',
  subtitle: '从江南刺绣到景德镇陶瓷,数字化保护与传播开辟新赛道',
  cover: 'https://picsum.photos/seed/n0/1200/600',
  source: '人民日报',
  sourceLogo: 'https://picsum.photos/seed/logo1/100/100',
  author: '本报记者 李文化',
  publishTime: '2026-06-04 09:30',
  viewCount: 86_4000,
  likeCount: 12_300,
  category: '文化',
  tags: ['非遗', '数字化', '传统工艺', '文化传播'],
  content: `【本报北京6月4日电】近年来,我国非遗手工艺保护与传承迎来新机遇。随着数字技术的发展,传统工艺正以崭新方式走向大众视野。

    记者从文化和旅游部获悉,截至目前,全国共有各级非遗代表性项目10万余项,国家级非遗代表性项目1557项。在数字技术的加持下,这些珍贵文化遗产正焕发新的生机。

    江南苏绣数字化保护中心通过高分辨率扫描和三维建模技术,成功将100余件珍贵绣品永久保存。同时,他们开发了线上展览平台,让全球观众可以足不出户欣赏这些艺术瑰宝。

    "数字技术不仅解决了非遗保护的难题,更为传统工艺的市场化开辟了新路径。"该中心负责人表示,过去一年,通过数字平台的传播,相关文创产品销量同比增长超过300%。

    与此同时,景德镇陶瓷业也在积极探索数字化转型。当地建立的陶瓷数字博物馆,收录了从宋代到现代的10万余件陶瓷作品,成为全球最大的陶瓷数字资源库。

    专家认为,数字化技术与传统手工艺的深度融合,既是文化传承的需要,也是产业升级的必然。`,
  sourceUrl: 'https://example.com/news/1',
};

const MOCK_RELATED = [
  { id: 71, title: '国风文化持续升温,年轻人成为消费主力', source: '光明日报', time: '2 小时前' },
  { id: 72, title: '古琴艺术数字化教学覆盖超百万人', source: '中国艺术报', time: '4 小时前' },
  { id: 73, title: '传统戏曲借助短视频焕发新生', source: '新华网', time: '昨天' },
  { id: 74, title: '二十四节气文化产品成市场新宠', source: '中国日报', time: '昨天' },
];

function NewsDetailContent() {
  const searchParams = useSearchParams();
  const navigate = useContentNavigate();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'news', id],
    queryFn: () => contentDetail({ id: Number(id) }).then((r) => r.data as Partial<News>),
    enabled: !!id,
    placeholderData: MOCK_NEWS,
    select: (data) => withDefaults(MOCK_NEWS, data),
  });

  const [favorited, setFavorited] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageStyle, setPageStyle] = useState<PageStyle>(DEFAULT_PAGE_STYLE);

  const updateStyle = (updates: Partial<PageStyle>) =>
    setPageStyle((prev) => ({ ...prev, ...updates }));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '新闻详情'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: 'text.tertiary' }}>
              <SettingsIcon />
            </IconButton>
            <IconButton onClick={() => setFavorited((f) => !f)} sx={{ color: favorited ? 'primary.main' : 'text.tertiary' }}>
              {favorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
            <IconButton sx={{ color: 'text.tertiary' }}>
              <ShareIcon />
            </IconButton>
          </Box>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => (
          <Container maxWidth="md" sx={{ py: 3 }}>
            <Chip
              label={data.category}
              size="small"
              sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600, mb: 2 }}
            />

            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 1.5, lineHeight: 1.4 }}>
              {data.title}
            </Typography>
            {data.subtitle && (
              <Typography sx={{ color: 'text.tertiary', fontSize: 15, mb: 2, lineHeight: 1.6 }}>
                {data.subtitle}
              </Typography>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SourceIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>{data.source}</Typography>
              </Box>
              {data.author && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.author}</Typography>}
              <Box sx={{ flex: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.publishTime}</Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <VisibilityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>阅读 {(data.viewCount / 10000).toFixed(1)}万</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', ml: 2 }}>
                点赞 {data.likeCount.toLocaleString()}
              </Typography>
            </Box>

            {data.cover && (
              <Box
                component="img"
                src={data.cover}
                alt={data.title}
                sx={{ width: '100%', borderRadius: 2, mb: 3 }}
              />
            )}

            <ReadingContainer style={pageStyle}>{data.content}</ReadingContainer>

            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 3, mt: 2 }}>
              {data.tags.map((t) => (
                <Chip
                  key={t}
                  label={`#${t}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 500 }}
                />
              ))}
            </Box>

            {data.sourceUrl && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.paper',
                  border: '1px solid #252836',
                  borderRadius: 2,
                  mb: 3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                }}
              >
                <SourceIcon sx={{ color: 'text.secondary' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>原文链接</Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.primary', wordBreak: 'break-all' }}>
                    {data.sourceUrl}
                  </Typography>
                </Box>
                <IconButton onClick={() => window.open(data.sourceUrl, '_blank')} sx={{ color: 'primary.main' }}>
                  <OpenInNewIcon />
                </IconButton>
              </Box>
            )}

            <Divider sx={{ borderColor: 'divider', my: 3 }} />
            <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, fontWeight: 700 }}>
              相关阅读
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {MOCK_RELATED.map((r, idx) => (
                <Box
                  key={r.id}
                  onClick={() => navigate('NEWS', r.id)}
                  sx={{
                    p: 1.5,
                    cursor: 'pointer',
                    borderBottom: idx < MOCK_RELATED.length - 1 ? '1px solid #252836' : 'none',
                    '&:hover': { bgcolor: 'rgba(254, 44, 85, 0.04)' },
                  }}
                >
                  <Typography sx={{ fontSize: 14, fontWeight: 500, color: 'text.primary', mb: 0.5, lineHeight: 1.5 }}>
                    {r.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{r.source}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>·</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{r.time}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Container>
        )}
      </AsyncState>

      <ReadingSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        style={pageStyle}
        onChange={updateStyle}
      />
    </Box>
  );
}

export default function NewsDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <NewsDetailContent />
    </React.Suspense>
  );
}
