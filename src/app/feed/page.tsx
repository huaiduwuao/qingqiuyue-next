'use client';

import { useState, useEffect } from 'react';
import { getFollowingFeeds, listFeeds, Feed } from '@/apis/feed';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Skeleton,
  Avatar,
  Container,
  Tabs,
  Tab,
  Button,
} from '@mui/material';
import {
  Favorite,
  Comment,
  PersonAdd,
  Article,
  Bookmark,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 动态类型图标
const FeedIcon = ({ type }: { type: string }) => {
  const iconProps = { fontSize: 'small' as const };
  switch (type) {
    case 'like':
      return <Favorite {...iconProps} sx={{ color: 'error.main' }} />;
    case 'comment':
      return <Comment {...iconProps} sx={{ color: 'primary.main' }} />;
    case 'follow':
      return <PersonAdd {...iconProps} sx={{ color: 'success.main' }} />;
    case 'publish':
      return <Article {...iconProps} sx={{ color: 'secondary.main' }} />;
    case 'collect':
      return <Bookmark {...iconProps} sx={{ color: 'warning.main' }} />;
    default:
      return <Article {...iconProps} />;
  }
};

// 动态类型文本
const getFeedTypeText = (type: string) => {
  switch (type) {
    case 'like':
      return '点赞了';
    case 'comment':
      return '评论了';
    case 'follow':
      return '关注了';
    case 'publish':
      return '发布了';
    case 'collect':
      return '收藏了';
    default:
      return '';
  }
};

export default function FeedPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<'following' | 'all'>('following');

  useEffect(() => {
    loadFeeds();
  }, [page, activeTab]);

  const loadFeeds = async () => {
    setLoading(true);
    try {
      let res;
      if (activeTab === 'following') {
        res = await getFollowingFeeds({ page, pageSize: 20 });
      } else {
        res = await listFeeds({ page, pageSize: 20 });
      }
      if (res.data) {
        setFeeds(res.data.list || []);
        setTotal(res.data.total || 0);
      }
    } catch (error) {
      console.error('加载动态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const FeedCard = ({ feed }: { feed: Feed }) => (
    <Card sx={{ mb: 2 }}>
      <CardHeader
        avatar={
          <Avatar src={feed.userAvatar}>
            {feed.userNickname?.[0] || feed.userName?.[0] || 'U'}
          </Avatar>
        }
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" component="span" sx={{ fontWeight: 'bold' }}>
              {feed.userNickname || feed.userName}
            </Typography>
            <FeedIcon type={feed.type} />
          </Box>
        }
        subheader={
          <Typography variant="body2" color="text.secondary">
            {getFeedTypeText(feed.type)}
            {feed.targetTitle && (
              <Typography component="span" color="text.primary" sx={{ fontWeight: 500 }}>
                《{feed.targetTitle}》
              </Typography>
            )}
          </Typography>
        }
        action={
          <Typography variant="caption" color="text.secondary">
            {formatDistanceToNow(new Date(feed.createTime), {
              addSuffix: true,
              locale: zhCN,
            })}
          </Typography>
        }
      />
      {feed.content && (
        <CardContent sx={{ pt: 0 }}>
          <Typography variant="body2">{feed.content}</Typography>
        </CardContent>
      )}
    </Card>
  );

  const FeedSkeleton = () => (
    <Card sx={{ mb: 2 }}>
      <CardHeader
        avatar={<Skeleton variant="circular" width={40} height={40} />}
        title={<Skeleton variant="text" width="40%" />}
        subheader={<Skeleton variant="text" width="60%" />}
      />
    </Card>
  );

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
        动态
      </Typography>

      {/* 标签切换 */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="关注" value="following" />
        <Tab label="全部" value="all" />
      </Tabs>

      {/* 动态列表 */}
      {loading ? (
        <>
          <FeedSkeleton />
          <FeedSkeleton />
          <FeedSkeleton />
        </>
      ) : feeds.length > 0 ? (
        <>
          {feeds.map((feed) => (
            <FeedCard key={feed.id} feed={feed} />
          ))}

          {/* 分页 */}
          {total > 20 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, gap: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                上一页
              </Button>
              <Typography sx={{ alignSelf: 'center' }}>
                {page} / {Math.ceil(total / 20)}
              </Typography>
              <Button
                variant="outlined"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
              >
                下一页
              </Button>
            </Box>
          )}
        </>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
          <Article sx={{ fontSize: 64, opacity: 0.5, mb: 2 }} />
          <Typography>暂无动态</Typography>
          {activeTab === 'following' && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              关注更多用户，看看他们的动态
            </Typography>
          )}
        </Box>
      )}
    </Container>
  );
}
