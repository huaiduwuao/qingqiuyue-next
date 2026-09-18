'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Box, Chip, Tooltip, Typography } from '@mui/material';
import { DataGridTable } from '@/components/tables/DataGridTable';
import type { GridColDef } from '@mui/x-data-grid';
import { deleteFeed, fetchAdminFeed, fetchCommunityStats, type FeedItem, type SplitCount } from '@/apis/community';
import { formatApiError } from '@/lib/api/client';

const TYPE_LABEL: Record<string, string> = {
  post: '帖子',
  publish: '发布作品',
  comment: '评论作品',
  like: '点赞',
  collect: '收藏',
  follow: '关注',
};

function sumType(stats: Record<string, SplitCount> | undefined, key: 'real' | 'bot') {
  return Object.values(stats ?? {}).reduce((n, s) => n + (s[key] || 0), 0);
}

const columns: GridColDef<FeedItem>[] = [
  { field: 'id', headerName: 'ID', width: 90, renderCell: (p) => String(p.value) },
  {
    field: 'user',
    headerName: '用户',
    width: 170,
    sortable: false,
    renderCell: (params) => {
      const u = params.value as FeedItem['user'];
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '100%' }}>
          <Avatar src={u.avatar || undefined} sx={{ width: 28, height: 28 }}>{u.name?.[0]}</Avatar>
          <Typography variant="body2" noWrap sx={{ maxWidth: 90 }}>{u.name}</Typography>
          {u.isBot && <Chip label="AI" size="small" color="info" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
        </Box>
      );
    },
  },
  {
    field: 'type',
    headerName: '类型',
    width: 110,
    sortable: false,
    renderCell: (params) => {
      const f = params.row as FeedItem;
      return <Chip size="small" variant="outlined" label={`${TYPE_LABEL[f.type] || f.type}${f.actorCount > 1 ? ` ×${f.actorCount}` : ''}`} />;
    },
  },
  {
    field: 'text',
    headerName: '正文 / 目标',
    width: 260,
    sortable: false,
    renderCell: (params) => {
      const f = params.row as FeedItem;
      return (
        <Box>
          <Typography variant="body2" sx={{ maxWidth: 260, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {f.text || f.target?.title || f.targetUser?.name || '-'}
          </Typography>
          {f.text && f.target && <Typography variant="caption" color="text.secondary">《{f.target.title}》</Typography>}
        </Box>
      );
    },
  },
  { field: 'topics', headerName: '话题', width: 130, sortable: false, renderCell: (params) => (params.value as FeedItem['topics'])?.map((t) => t.title).join('、') || '-' },
  { field: 'likeCount', headerName: '赞 / 评', width: 90, renderCell: (params) => `${params.value} / ${(params.row as FeedItem).commentCount}` },
  {
    field: 'createTime',
    headerName: '时间',
    width: 170,
    renderCell: (params) => <Typography variant="caption">{new Date(params.value as string).toLocaleString()}</Typography>,
  },
];

/** 社区运营:24 小时数据(真人 / AI 分开算)+ 全部动态,可删除违规内容 */
export default function FeedAdminPage() {
  const qc = useQueryClient();
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});

  const stats = useQuery({ queryKey: ['admin', 'community', 'stats'], queryFn: fetchCommunityStats, refetchInterval: 60_000 });

  const remove = async (id: string | number) => {
    if (!window.confirm('确定删除这条动态?删除后用户侧不再展示。')) return;
    try {
      await deleteFeed(id);
      qc.invalidateQueries({ queryKey: ['admin', 'community'] });
      // 让表格刷新当前页
      setFilterValues((v) => ({ ...v }));
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

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>社区运营</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        最近 24 小时,真人与 AI 虚拟用户分开统计。
        {s && ` 在岗 AI 用户 ${s.bots.active ?? 0} 个;话题/合集:官方 ${s.topics.official}、用户创建 ${s.topics.userMade}(今日新增 ${s.topics.newToday})。`}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 1.5, mb: 3 }}>
        {cards.map((c) => (
          <Box key={c.label} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Tooltip title={c.hint ?? ''}>
              <Typography variant="caption" color="text.secondary">{c.label}</Typography>
            </Tooltip>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{c.real}</Typography>
            {c.bot !== undefined && <Typography variant="caption" color="text.secondary">AI:{c.bot}</Typography>}
          </Box>
        ))}
      </Box>

      <DataGridTable
        title="全部动态"
        columns={columns}
        fetchData={async (params) => {
          const res = await fetchAdminFeed({
            page: params.pageNumber,
            size: params.pageSize,
            author: (params.author as '' | 'real' | 'bot') || '',
            type: (params.type as string) || '',
            keyword: (params.keyword as string) || '',
          });
          return {
            records: res.list || [],
            totalRow: res.total || 0,
          };
        }}
        onDelete={(row) => remove(row.id)}
        filters={{
          fields: [
            { key: 'author', label: '发起者', type: 'select', options: [{ label: '真人', value: 'real' }, { label: 'AI 用户', value: 'bot' }] },
            { key: 'type', label: '类型', type: 'select', options: Object.entries(TYPE_LABEL).map(([value, label]) => ({ label: String(label), value })) },
            { key: 'keyword', label: '正文包含', type: 'text' },
          ],
          values: filterValues,
          onChange: setFilterValues,
          onReset: () => setFilterValues({}),
        }}
      />
    </Box>
  );
}
