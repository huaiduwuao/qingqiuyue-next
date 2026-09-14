'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { deleteFeed, fetchAdminFeed, fetchCommunityStats, type SplitCount } from '@/apis/community';
import { formatApiError } from '@/lib/api/client';

const TYPE_LABEL: Record<string, string> = {
  post: '帖子',
  publish: '发布作品',
  comment: '评论作品',
  like: '点赞',
  collect: '收藏',
  follow: '关注',
};

const PAGE_SIZE = 20;

function sumType(stats: Record<string, SplitCount> | undefined, key: 'real' | 'bot') {
  return Object.values(stats ?? {}).reduce((n, s) => n + (s[key] || 0), 0);
}

/** 社区运营:24 小时数据(真人 / AI 分开算)+ 全部动态,可删除违规内容 */
export default function FeedAdminPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [author, setAuthor] = useState<'' | 'real' | 'bot'>('');
  const [type, setType] = useState('');
  const [keyword, setKeyword] = useState('');

  const stats = useQuery({ queryKey: ['admin', 'community', 'stats'], queryFn: fetchCommunityStats, refetchInterval: 60_000 });
  const list = useQuery({
    queryKey: ['admin', 'community', 'feed', page, author, type, keyword],
    queryFn: () => fetchAdminFeed({ page, size: PAGE_SIZE, author, type, keyword }),
  });

  const remove = async (id: string | number) => {
    if (!window.confirm('确定删除这条动态?删除后用户侧不再展示。')) return;
    try {
      await deleteFeed(id);
      qc.invalidateQueries({ queryKey: ['admin', 'community'] });
    } catch (e) {
      window.alert(formatApiError(e));
    }
  };

  const s = stats.data;
  const cards: { label: string; real: number; bot?: number; hint?: string }[] = s
    ? [
        { label: '活跃真人(24h)', real: s.activeRealUsers, hint: '发过动态/点赞/评论的真人' },
        { label: '帖子', real: s.feedByType.post?.real ?? 0, bot: s.feedByType.post?.bot ?? 0 },
        { label: '全部动态', real: sumType(s.feedByType, 'real'), bot: sumType(s.feedByType, 'bot') },
        { label: '动态点赞', real: s.feedLikes.real, bot: s.feedLikes.bot },
        { label: '动态评论', real: s.feedComments.real, bot: s.feedComments.bot },
        { label: '关注用户', real: s.userFollows.real, bot: s.userFollows.bot },
        { label: '关注话题', real: s.topicFollows.real, bot: s.topicFollows.bot },
        { label: '互动提醒', real: Object.values(s.notices).reduce((a, b) => a + b, 0), hint: '发给真人的赞/评论/关注提醒' },
      ]
    : [];
  const total = list.data?.total ?? 0;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>社区运营</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        最近 24 小时,真人与 AI 虚拟用户分开统计。
        {s && ` 在岗 AI 用户 ${s.bots.active ?? 0} 个;话题/合集:官方 ${s.topics.official}、用户创建 ${s.topics.userMade}(今日新增 ${s.topics.newToday})。`}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 1.5, mb: 3 }}>
        {cards.map((c) => (
          <Paper key={c.label} variant="outlined" sx={{ p: 1.5 }}>
            <Tooltip title={c.hint ?? ''}>
              <Typography variant="caption" color="text.secondary">{c.label}</Typography>
            </Tooltip>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{c.real}</Typography>
            {c.bot !== undefined && <Typography variant="caption" color="text.secondary">AI:{c.bot}</Typography>}
          </Paper>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField select size="small" label="发起者" value={author} onChange={(e) => { setAuthor(e.target.value as '' | 'real' | 'bot'); setPage(1); }} sx={{ width: 140 }}>
          <MenuItem value="">全部</MenuItem>
          <MenuItem value="real">真人</MenuItem>
          <MenuItem value="bot">AI 用户</MenuItem>
        </TextField>
        <TextField select size="small" label="类型" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} sx={{ width: 140 }}>
          <MenuItem value="">全部</MenuItem>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
        </TextField>
        <TextField size="small" label="正文包含" value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} sx={{ width: 220 }} />
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>用户</TableCell>
              <TableCell>类型</TableCell>
              <TableCell>正文 / 目标</TableCell>
              <TableCell>话题</TableCell>
              <TableCell>赞 / 评</TableCell>
              <TableCell>时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.isLoading ? (
              <TableRow><TableCell colSpan={8} align="center">加载中...</TableCell></TableRow>
            ) : (list.data?.list.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={8} align="center">暂无动态</TableCell></TableRow>
            ) : (
              list.data!.list.map((f) => (
                <TableRow key={String(f.id)}>
                  <TableCell>{String(f.id)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar src={f.user.avatar || undefined} sx={{ width: 28, height: 28 }}>{f.user.name?.[0]}</Avatar>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 120 }}>{f.user.name}</Typography>
                      {f.user.isBot && <Chip label="AI" size="small" color="info" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={`${TYPE_LABEL[f.type] || f.type}${f.actorCount > 1 ? ` ×${f.actorCount}` : ''}`} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 320, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {f.text || f.target?.title || f.targetUser?.name || '-'}
                    </Typography>
                    {f.text && f.target && <Typography variant="caption" color="text.secondary">《{f.target.title}》</Typography>}
                  </TableCell>
                  <TableCell>{f.topics.map((t) => t.title).join('、') || '-'}</TableCell>
                  <TableCell>{f.likeCount} / {f.commentCount}</TableCell>
                  <TableCell><Typography variant="caption">{new Date(f.createTime).toLocaleString()}</Typography></TableCell>
                  <TableCell>
                    <Tooltip title="删除">
                      <IconButton size="small" color="error" onClick={() => remove(f.id)}><DeleteIcon /></IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, gap: 2 }}>
        <Button variant="outlined" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>上一页</Button>
        <Typography sx={{ alignSelf: 'center' }}>{page} / {Math.ceil(total / PAGE_SIZE) || 1}</Typography>
        <Button variant="outlined" onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / PAGE_SIZE)}>下一页</Button>
      </Box>
    </Box>
  );
}
