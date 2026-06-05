'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import SettingsIcon from '@mui/icons-material/Settings';
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-article';
import { withDefaults } from '@/utils/withDefaults';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { ReadingSettings, DEFAULT_PAGE_STYLE, type PageStyle } from '@/components/detail/ReadingSettings';
import { ReadingContainer } from '@/components/detail/ReadingContainer';
import { useContentNavigate } from '@/lib/contentRoute';

interface Article {
  id: number;
  title: string;
  subtitle?: string;
  cover?: string;
  author: string;
  authorAvatar: string;
  authorBio?: string;
  publishTime: string;
  viewCount: number;
  likeCount: number;
  collectCount: number;
  commentCount: number;
  category: string;
  tags: string[];
  content: string;
}

const MOCK_ARTICLE: Article = {
  id: 1,
  title: '秋日书斋:在数字时代重拾阅读的仪式感',
  subtitle: '从一本纸质书的温度,到一盏茶的清香,关于慢生活的实践笔记',
  cover: 'https://picsum.photos/seed/ar0/1200/600',
  author: '林清秋',
  authorAvatar: 'https://picsum.photos/seed/au1/100/100',
  authorBio: '作家 · 文化研究者 · 慢生活实践者',
  publishTime: '2026-06-02 10:00',
  viewCount: 24_500,
  likeCount: 1280,
  collectCount: 856,
  commentCount: 64,
  category: '随笔',
  tags: ['阅读', '慢生活', '文化', '书斋'],
  content: `秋日的清晨,推窗即见薄雾未散。我在书斋的竹椅上坐下,泡一壶明前龙井,将昨夜未读完的《浮生六记》翻到第三卷。

    沈复笔下的芸娘,是一位能在梅花雪夜里煮茶、在月下与夫君联句的雅趣女子。她以女性的细腻,构筑了一个充满诗意的家居空间。这种生活方式,在数字时代似乎越来越稀缺。

    一、为什么我们需要"书斋"

    书斋,在中国传统文化中,远不止一个物理空间。它是文人精神的栖息地,是与古往今来智者对话的场所。古人云:"书斋宜南,坐当明亮。"

    在今天这个信息过载的时代,我们更需要这样一个角落,让心静下来。一本书、一盏灯、一杯茶,这些朴素的元素,构筑起我们精神的防线。

    二、如何在数字时代重建仪式感

    1. 划定"无手机时间":每天至少 30 分钟,远离所有电子设备
    2. 选择一本纸质书:触感与书香无可替代
    3. 营造空间氛围:一盏暖色台灯,一缕檀香
    4. 写下读后感:让思考外化,让阅读有迹可循

    三、推荐书单

    这个秋天,我重读了以下几本书,推荐给同样爱好阅读的你:
    - 《浮生六记》沈复
    - 《我们仨》杨绛
    - 《生活的艺术家》李小龙
    - 《人间词话》王国维

    慢一点,深一度。这个秋日,愿你在书斋里,遇见更好的自己。`,
};

const MOCK_RELATED = [
  { id: 81, title: '春日读书记:与一本好书相遇的 N 种方式', author: '苏明远', time: '3 天前', views: '1.2万' },
  { id: 82, title: '咖啡馆与读书:寻找城市中的精神角落', author: '陈墨', time: '1 周前', views: '8.6千' },
  { id: 83, title: '从《论语》读君子之道', author: '钱文忠', time: '2 周前', views: '2.3万' },
];

function ArticleDetailContent() {
  const searchParams = useSearchParams();
  const navigate = useContentNavigate();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'article', id],
    queryFn: () => contentDetail({ id: Number(id) }).then((r) => r.data as Partial<Article>),
    enabled: !!id,
    placeholderData: MOCK_ARTICLE,
    select: (data) => withDefaults(MOCK_ARTICLE, data),
  });

  const [favorited, setFavorited] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageStyle, setPageStyle] = useState<PageStyle>(DEFAULT_PAGE_STYLE);

  const updateStyle = (updates: Partial<PageStyle>) =>
    setPageStyle((prev) => ({ ...prev, ...updates }));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title || '文章详情'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: 'text.tertiary' }}>
              <SettingsIcon />
            </IconButton>
            <IconButton onClick={() => setFavorited((f) => !f)} sx={{ color: favorited ? 'primary.main' : 'text.tertiary' }}>
              {favorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
            <IconButton onClick={() => setBookmarked((b) => !b)} sx={{ color: bookmarked ? 'warning.main' : 'text.tertiary' }}>
              {bookmarked ? <BookmarkIcon /> : <BookmarkBorderIcon />}
            </IconButton>
            <IconButton sx={{ color: 'text.tertiary' }}>
              <ShareIcon />
            </IconButton>
          </Box>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => (
          <Container maxWidth="md" sx={{ py: 4 }}>
            <Chip
              label={data.category}
              size="small"
              sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600, mb: 2 }}
            />

            <Typography
              variant="h3"
              sx={{ fontWeight: 800, color: 'text.primary', mb: 1.5, lineHeight: 1.3, fontSize: { xs: 24, sm: 32 } }}
            >
              {data.title}
            </Typography>
            {data.subtitle && (
              <Typography sx={{ color: 'text.tertiary', fontSize: 15, mb: 3, lineHeight: 1.6 }}>
                {data.subtitle}
              </Typography>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Avatar src={data.authorAvatar} sx={{ width: 48, height: 48 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>{data.author}</Typography>
                {data.authorBio && (
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.3 }}>{data.authorBio}</Typography>
                )}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.publishTime}</Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <VisibilityIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{(data.viewCount / 10000).toFixed(1)}万 阅读</Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>·</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.likeCount} 点赞</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>·</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.collectCount} 收藏</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>·</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{data.commentCount} 评论</Typography>
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

            <Divider sx={{ borderColor: 'divider', my: 3 }} />
            <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, fontWeight: 700 }}>
              相关推荐
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {MOCK_RELATED.map((r, idx) => (
                <Box
                  key={r.id}
                  onClick={() => navigate('ARTICLE', r.id)}
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
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{r.author}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>·</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{r.time}</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>·</Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{r.views} 阅读</Typography>
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

export default function ArticleDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <ArticleDetailContent />
    </React.Suspense>
  );
}
