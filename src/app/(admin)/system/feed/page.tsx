'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Tooltip,
  Avatar,
  Button,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Favorite as FavoriteIcon,
  Comment as CommentIcon,
  PersonAdd as PersonAddIcon,
  Article as ArticleIcon,
  Bookmark as BookmarkIcon,
} from '@mui/icons-material';
import { listFeeds, deleteFeed, Feed } from '@/apis/feed';

// 动态类型配置
const feedTypeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  publish: { label: '发布', color: 'secondary', icon: <ArticleIcon fontSize="small" /> },
  like: { label: '点赞', color: 'error', icon: <FavoriteIcon fontSize="small" /> },
  comment: { label: '评论', color: 'primary', icon: <CommentIcon fontSize="small" /> },
  follow: { label: '关注', color: 'success', icon: <PersonAddIcon fontSize="small" /> },
  collect: { label: '收藏', color: 'warning', icon: <BookmarkIcon fontSize="small" /> },
};

export default function FeedAdminPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadFeeds();
  }, [page]);

  const loadFeeds = async () => {
    setLoading(true);
    try {
      const res = await listFeeds({ page, pageSize: 20 });
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

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条动态吗？')) return;
    try {
      await deleteFeed(id);
      loadFeeds();
    } catch (error) {
      console.error('删除动态失败:', error);
      alert('删除失败，请重试');
    }
  };

  const getTypeChip = (type: string) => {
    const config = feedTypeConfig[type] || { label: type, color: 'default', icon: null };
    return (
      <Chip
        icon={config.icon as any}
        label={config.label}
        color={config.color as any}
        size="small"
        variant="outlined"
      />
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          动态管理
        </Typography>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>用户</TableCell>
              <TableCell>类型</TableCell>
              <TableCell>目标</TableCell>
              <TableCell>内容</TableCell>
              <TableCell>时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  加载中...
                </TableCell>
              </TableRow>
            ) : feeds.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  暂无动态
                </TableCell>
              </TableRow>
            ) : (
              feeds.map((feed) => (
                <TableRow key={feed.id}>
                  <TableCell>{feed.id}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar src={feed.userAvatar} sx={{ width: 32, height: 32 }}>
                        {feed.userNickname?.[0] || feed.userName?.[0] || 'U'}
                      </Avatar>
                      <Typography variant="body2">
                        {feed.userNickname || feed.userName}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{getTypeChip(feed.type)}</TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                      {feed.targetTitle || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {feed.content || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {new Date(feed.createTime).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="删除">
                      <IconButton size="small" color="error" onClick={() => handleDelete(feed.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 分页 */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, gap: 2 }}>
        <Button
          variant="outlined"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          上一页
        </Button>
        <Typography sx={{ alignSelf: 'center' }}>
          {page} / {Math.ceil(total / 20) || 1}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => setPage((p) => p + 1)}
          disabled={page >= Math.ceil(total / 20)}
        >
          下一页
        </Button>
      </Box>
    </Box>
  );
}
