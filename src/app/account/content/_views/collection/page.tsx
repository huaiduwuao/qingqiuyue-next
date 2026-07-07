'use client';

export const dynamic = "force-dynamic";

// 该页依赖 client context + 后端实时数据,SSR/pre-render 时 TIERS/orders 等未就绪 →
// 报 "Cannot read properties of undefined"。强制 dynamic 跳过预渲染。

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCollectionList, type Collection as ApiCollection } from '@/apis/dashboard';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import SearchIcon from '@mui/icons-material/Search';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import { gradient2, gradient3 } from '@/constants/gradients';
import { accountClient } from '@/lib/api/client';

type CollectionStatus = 'active' | 'finished' | 'draft';
type CollectionVisibility = 'public' | 'fansOnly' | 'private';
type CollectionCategory = 'vlog' | 'tutorial' | 'music' | 'fashion' | 'travel' | 'review' | 'other';

interface WorkRef {
  id: number;
  title: string;
  cover: string;
  duration?: string;
  views: number;
  type: 'video' | 'image' | 'article';
}

interface Collection {
  id: number;
  title: string;
  description: string;
  cover: string;
  status: CollectionStatus;
  visibility: CollectionVisibility;
  category: CollectionCategory;
  works: WorkRef[];
  totalViews: number;
  subscribers: number;
  autoSort: boolean;
  createdAt: number;
  updatedAt: number;
}

const ALL_WORKS: WorkRef[] = [
  { id: 1001, title: '夏日海边vlog｜治愈瞬间', cover: gradient3('#FE2C55', '#FF6B8A', '#FFB400'), duration: '03:42', views: 1284932, type: 'video' },
  { id: 1002, title: '小红书同款｜夏日穿搭', cover: gradient3('#25F4EE', '#5DF7F2', '#8B5CF6'), duration: '02:15', views: 423891, type: 'image' },
  { id: 1003, title: '挑战全网最辣螺蛳粉', cover: gradient3('#FFB400', '#FE2C55', '#8B5CF6'), duration: '05:28', views: 287432, type: 'video' },
  { id: 1004, title: '10分钟学会快手早餐', cover: gradient2('#5DDB96', '#25F4EE'), duration: '09:54', views: 0, type: 'video' },
  { id: 1005, title: '我的家乡｜回家路上', cover: gradient2('#5B8DEF', '#8B5CF6'), duration: '04:21', views: 0, type: 'video' },
  { id: 1006, title: '深夜独处歌单 10 首', cover: gradient2('#8B5CF6', '#FE2C55'), views: 8432, type: 'article' },
  { id: 1007, title: '【开箱】Sony A7C II', cover: gradient2('#FF6B8A', '#FFB400'), duration: '12:14', views: 0, type: 'video' },
  { id: 1008, title: '设计师的一天', cover: gradient2('#06B6D4', '#5B8DEF'), views: 124832, type: 'image' },
  { id: 1009, title: '岛屿旅行 Day1｜机场出发', cover: gradient2('#25F4EE', '#5DDB96'), duration: '06:33', views: 89231, type: 'video' },
  { id: 1010, title: '岛屿旅行 Day2｜浮潜', cover: gradient2('#5DDB96', '#FFB400'), duration: '08:12', views: 67843, type: 'video' },
  { id: 1011, title: '岛屿旅行 Day3｜日落', cover: gradient2('#FFB400', '#FE2C55'), duration: '04:48', views: 92187, type: 'video' },
  { id: 1012, title: '快手早餐｜3分钟蛋饼', cover: gradient2('#5DDB96', '#25F4EE'), duration: '03:12', views: 167423, type: 'video' },
];

const SEED: Collection[] = [
  {
    id: 901,
    title: '夏日海岛旅行 vlog',
    description: '三天两夜的海岛之旅,记录每一个治愈瞬间。',
    cover: gradient3('#FE2C55', '#FF6B8A', '#FFB400'),
    status: 'active',
    visibility: 'public',
    category: 'travel',
    works: [ALL_WORKS[8], ALL_WORKS[9], ALL_WORKS[10]],
    totalViews: 249261,
    subscribers: 2148,
    autoSort: false,
    createdAt: Date.now() - 86400000 * 14,
    updatedAt: Date.now() - 86400000 * 2,
  },
  {
    id: 902,
    title: '快手早餐教程系列',
    description: '7 道适合上班族的快手早餐,平均 10 分钟搞定。',
    cover: gradient2('#5DDB96', '#25F4EE'),
    status: 'active',
    visibility: 'public',
    category: 'tutorial',
    works: [ALL_WORKS[3], ALL_WORKS[11]],
    totalViews: 167423,
    subscribers: 932,
    autoSort: true,
    createdAt: Date.now() - 86400000 * 21,
    updatedAt: Date.now() - 86400000 * 5,
  },
  {
    id: 903,
    title: '夏日穿搭合集',
    description: '夏日 9 套穿搭,白色系为主。',
    cover: gradient3('#25F4EE', '#5DF7F2', '#8B5CF6'),
    status: 'finished',
    visibility: 'public',
    category: 'fashion',
    works: [ALL_WORKS[1], ALL_WORKS[7]],
    totalViews: 548723,
    subscribers: 3210,
    autoSort: false,
    createdAt: Date.now() - 86400000 * 45,
    updatedAt: Date.now() - 86400000 * 30,
  },
  {
    id: 904,
    title: '深夜独处歌单',
    description: '深夜助眠歌单合集,陆续更新中。',
    cover: gradient2('#8B5CF6', '#FE2C55'),
    status: 'active',
    visibility: 'fansOnly',
    category: 'music',
    works: [ALL_WORKS[5]],
    totalViews: 8432,
    subscribers: 487,
    autoSort: true,
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 86400000 * 1,
  },
  {
    id: 905,
    title: '相机开箱评测',
    description: '准备开始的开箱系列,从 Sony A7C II 开始。',
    cover: gradient2('#FF6B8A', '#FFB400'),
    status: 'draft',
    visibility: 'private',
    category: 'review',
    works: [ALL_WORKS[6]],
    totalViews: 0,
    subscribers: 0,
    autoSort: false,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 3600000 * 4,
  },
];

const STATUS_META: Record<CollectionStatus, { label: string; color: string; bg: string }> = {
  active: { label: '进行中', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)' },
  finished: { label: '已完结', color: '#5B8DEF', bg: 'rgba(91, 141, 239, 0.12)' },
  draft: { label: '草稿', color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.06)' },
};

const VISIBILITY_META: Record<CollectionVisibility, { label: string }> = {
  public: { label: '公开' },
  fansOnly: { label: '仅粉丝' },
  private: { label: '私密' },
};

const CATEGORY_OPTIONS: { key: CollectionCategory; label: string }[] = [
  { key: 'vlog', label: 'Vlog' },
  { key: 'tutorial', label: '教程' },
  { key: 'music', label: '音乐' },
  { key: 'fashion', label: '穿搭' },
  { key: 'travel', label: '旅行' },
  { key: 'review', label: '评测' },
  { key: 'other', label: '其他' },
];

const COVER_PRESETS = [
  gradient3('#FE2C55', '#FF6B8A', '#FFB400'),
  gradient2('#25F4EE', '#5DF7F2'),
  gradient2('#5DDB96', '#25F4EE'),
  gradient2('#8B5CF6', '#FE2C55'),
  gradient2('#FF6B8A', '#FFB400'),
  gradient2('#5B8DEF', '#8B5CF6'),
  gradient3('#FFB400', '#FE2C55', '#8B5CF6'),
  gradient2('#06B6D4', '#5B8DEF'),
];

function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function DetailHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-end' }}>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary' }}>{title}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
          整理同主题作品成合集,提升完播率与粉丝粘性
        </Typography>
      </Box>
      {action}
    </Box>
  );
}

export default function CollectionPage() {
  // 真接口拉作品合集(uid 隔离),失败时 fallback 到 SEED 兜底
  const { data: colResp } = useQuery({
    queryKey: ['creator-collections'],
    queryFn: () => getCollectionList({ page: 1, size: 50 }),
    staleTime: 30 * 1000,
  });
  const apiCollections: Collection[] = (colResp?.records ?? colResp?.list ?? []).map((c: ApiCollection) => ({
    id: Number(c.id) || 0,
    title: c.title,
    description: '',
    cover: c.cover || '',
    status: 'active',
    visibility: c.isPublic ? 'public' : 'private',
    category: 'travel' as any, // 后端暂无分类,UI 默认给个值
    works: [],
    totalViews: c.viewCount,
    subscribers: 0,
    autoSort: false,
    createdAt: c.updateTime,
    updatedAt: c.updateTime,
  }));
  const [collections, setCollections] = useState<Collection[]>(apiCollections.length ? apiCollections : SEED);
  useEffect(() => {
    if (apiCollections.length) setCollections(apiCollections);
  }, [apiCollections.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTab] = useState<0 | 1 | 2 | 3>(0);
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<{ id: number; el: HTMLElement } | null>(null);

  const counts = useMemo(() => ({
    all: collections.length,
    active: collections.filter((c) => c.status === 'active').length,
    finished: collections.filter((c) => c.status === 'finished').length,
    draft: collections.filter((c) => c.status === 'draft').length,
  }), [collections]);

  const filtered = useMemo(() => {
    let list = collections;
    if (tab === 1) list = list.filter((c) => c.status === 'active');
    else if (tab === 2) list = list.filter((c) => c.status === 'finished');
    else if (tab === 3) list = list.filter((c) => c.status === 'draft');
    if (keyword) list = list.filter((c) => c.title.toLowerCase().includes(keyword.toLowerCase()) || c.description.includes(keyword));
    return list;
  }, [collections, tab, keyword]);

  const totalWorks = collections.reduce((s, c) => s + c.works.length, 0);
  const totalViews = collections.reduce((s, c) => s + c.totalViews, 0);
  const totalSubs = collections.reduce((s, c) => s + c.subscribers, 0);

  const handleCreate = async (data: Omit<Collection, 'id' | 'totalViews' | 'subscribers' | 'createdAt' | 'updatedAt'>) => {
    try {
      await accountClient('/account/collection', {
        method: 'POST',
        data: {
          name: data.title,
          description: data.description,
          cover: data.cover,
          category: data.category,
          visibility: data.visibility,
          autoSort: data.autoSort,
          status: data.status,
          works: data.works.map((w) => ({ id: w.id, title: w.title, cover: w.cover, duration: w.duration, views: w.views, type: w.type })),
        },
      });
      const next: Collection = {
        ...data,
        id: Date.now(),
        totalViews: 0,
        subscribers: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setCollections((p) => [next, ...p]);
      setSnack('合集已创建');
      setCreateOpen(false);
    } catch (err) {
      // 失败回滚:不更新本地 state
      setSnack('创建失败,请重试');
    }
  };

  const handleUpdate = async (id: number, patch: Partial<Collection>) => {
    const current = collections.find((c) => c.id === id);
    if (!current) return;
    const changed = (
      patch.title !== undefined ||
      patch.description !== undefined ||
      patch.cover !== undefined ||
      patch.status !== undefined ||
      patch.visibility !== undefined ||
      patch.works !== undefined
    );
    if (!changed) {
      // 没有需要同步到后端的字段,只更新本地
      setCollections((p) => p.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)));
      return;
    }
    const prev = current;
    // 乐观更新
    setCollections((p) => p.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)));
    try {
      await accountClient('/account/collection', {
        method: 'PUT',
        data: {
          id,
          name: patch.title ?? current.title,
          description: patch.description ?? current.description,
          cover: patch.cover ?? current.cover,
          status: patch.status ?? current.status,
          visibility: patch.visibility ?? current.visibility,
          works: (patch.works ?? current.works).map((w) => ({
            id: w.id,
            title: w.title,
            cover: w.cover,
            duration: w.duration,
            views: w.views,
            type: w.type,
          })),
        },
      });
    } catch (err) {
      // 失败回滚到之前的状态
      setCollections((p) => p.map((c) => (c.id === id ? prev : c)));
      setSnack('保存失败,已恢复');
    }
  };

  const handleDelete = async (id: number) => {
    const target = collections.find((c) => c.id === id);
    if (!target) return;
    // 乐观更新
    setCollections((p) => p.filter((c) => c.id !== id));
    setAnchorEl(null);
    try {
      await accountClient('/account/collection', { method: 'DELETE', data: { id } });
      setSnack('合集已删除');
    } catch (err) {
      // 失败回滚
      setCollections((p) => [target, ...p]);
      setSnack('删除失败,已恢复');
    }
  };

  const handleFinish = (c: Collection) => {
    handleUpdate(c.id, { status: 'finished' });
    setSnack(`《${c.title}》已设为完结`);
    setAnchorEl(null);
  };

  const handleCopyLink = async (c: Collection) => {
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/collection?id=${c.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setSnack('链接已复制');
    } catch {
      setSnack('复制失败');
    }
    setAnchorEl(null);
  };

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
        <DetailHeader
          title="合集管理"
          action={
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => setCreateOpen(true)}
              sx={{
                textTransform: 'none',
                borderRadius: 1.5,
                background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
              }}
            >
              创建合集
            </Button>
          }
        />

        {/* 概览 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5, mb: 3 }}>
          {[
            { label: '合集总数', value: collections.length, color: '#FE2C55' },
            { label: '收录作品', value: totalWorks, color: '#25F4EE' },
            { label: '累计播放', value: formatNum(totalViews), color: '#FFB400' },
            { label: '合集订阅', value: formatNum(totalSubs), color: '#5DDB96' },
          ].map((s) => (
            <Box key={s.label} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</Typography>
            </Box>
          ))}
        </Box>

        {/* 筛选条 */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontSize: 13, py: 0.5 } }}
          >
            <Tab label={`全部 ${counts.all}`} />
            <Tab label={`进行中 ${counts.active}`} />
            <Tab label={`已完结 ${counts.finished}`} />
            <Tab label={`草稿 ${counts.draft}`} />
          </Tabs>
          <Box sx={{ flex: 1 }} />
          <TextField
            size="small"
            placeholder="搜索合集标题"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: 240, '& .MuiOutlinedInput-root': { fontSize: 13 } }}
          />
        </Box>

        {/* 合集卡片网格 */}
        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CollectionsRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography sx={{ fontSize: 14, color: 'text.disabled' }}>暂无合集</Typography>
            <Button onClick={() => setCreateOpen(true)} sx={{ mt: 1, textTransform: 'none', fontSize: 13 }}>
              创建第一个合集
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
            {filtered.map((c) => {
              const sm = STATUS_META[c.status];
              return (
                <Box
                  key={c.id}
                  sx={{
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    overflow: 'hidden',
                    transition: 'border-color 0.15s, transform 0.15s',
                    '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                  }}
                >
                  {/* 封面 + 状态 */}
                  <Box sx={{ position: 'relative', aspectRatio: '16/9', background: c.cover, overflow: 'hidden' }}>
                    <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.7) 100%)' }} />
                    <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 0.75 }}>
                      <Box sx={{ px: 0.75, py: 0.25, borderRadius: 0.5, bgcolor: sm.bg, color: sm.color, fontSize: 10, fontWeight: 700, backdropFilter: 'blur(4px)' }}>
                        {sm.label}
                      </Box>
                      {c.visibility !== 'public' && (
                        <Box sx={{ px: 0.75, py: 0.25, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.25, backdropFilter: 'blur(4px)' }}>
                          <LockOutlinedIcon sx={{ fontSize: 11 }} />
                          {VISIBILITY_META[c.visibility].label}
                        </Box>
                      )}
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => setAnchorEl({ id: c.id, el: e.currentTarget })}
                      sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.4)', color: '#fff', backdropFilter: 'blur(4px)', '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' } }}
                      aria-label="更多"
                    >
                      <MoreHorizIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <Box sx={{ position: 'absolute', bottom: 8, left: 8, right: 8, color: '#fff' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                        <CollectionsRoundedIcon sx={{ fontSize: 14 }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 600 }}>{c.works.length} 个作品</Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* 文本 + 数据 */}
                  <Box sx={{ p: 2 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary', mb: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.title}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1.5, height: 32, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {c.description}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, fontSize: 11, color: 'text.disabled' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        <VisibilityRoundedIcon sx={{ fontSize: 12 }} />
                        {formatNum(c.totalViews)}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        <FavoriteRoundedIcon sx={{ fontSize: 12 }} />
                        {formatNum(c.subscribers)} 订阅
                      </Box>
                      <Box sx={{ ml: 'auto' }}>{formatDate(c.updatedAt)}</Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        fullWidth
                        startIcon={<EditRoundedIcon sx={{ fontSize: 14 }} />}
                        onClick={() => setEditing(c)}
                        sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, borderColor: 'divider', color: 'text.secondary' }}
                      >
                        编辑
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ShareRoundedIcon sx={{ fontSize: 14 }} />}
                        onClick={() => handleCopyLink(c)}
                        sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, borderColor: 'divider', color: 'text.secondary' }}
                      >
                        分享
                      </Button>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        {/* 更多菜单 */}
        <Menu open={!!anchorEl} anchorEl={anchorEl?.el} onClose={() => setAnchorEl(null)}>
          {(() => {
            const c = anchorEl ? collections.find((x) => x.id === anchorEl.id) : null;
            if (!c) return null;
            return [
              <MenuItem key="edit" onClick={() => { setEditing(c); setAnchorEl(null); }} sx={{ fontSize: 13 }}>
                <EditRoundedIcon sx={{ fontSize: 16, mr: 1 }} />编辑合集
              </MenuItem>,
              <MenuItem key="share" onClick={() => handleCopyLink(c)} sx={{ fontSize: 13 }}>
                <ShareRoundedIcon sx={{ fontSize: 16, mr: 1 }} />复制链接
              </MenuItem>,
              c.status !== 'finished' ? (
                <MenuItem key="finish" onClick={() => handleFinish(c)} sx={{ fontSize: 13 }}>
                  <CollectionsRoundedIcon sx={{ fontSize: 16, mr: 1 }} />设为完结
                </MenuItem>
              ) : null,
              <Divider key="d" />,
              <MenuItem key="del" onClick={() => handleDelete(c.id)} sx={{ fontSize: 13, color: 'error.main' }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16, mr: 1 }} />删除合集
              </MenuItem>,
            ].filter(Boolean);
          })()}
        </Menu>

        <CreateCollectionDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreate={handleCreate}
        />

        <EditCollectionDrawer
          collection={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            if (editing) {
              handleUpdate(editing.id, patch);
              setSnack('合集已保存');
            }
            setEditing(null);
          }}
        />

        <Snackbar
          open={!!snack}
          autoHideDuration={2200}
          onClose={() => setSnack(null)}
          message={snack}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    </Box>
  );
}

// ───── 创建合集 Dialog ─────
function CreateCollectionDialog({
  open, onClose, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: Omit<Collection, 'id' | 'totalViews' | 'subscribers' | 'createdAt' | 'updatedAt'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState(COVER_PRESETS[0]);
  const [category, setCategory] = useState<CollectionCategory>('vlog');
  const [visibility, setVisibility] = useState<CollectionVisibility>('public');
  const [autoSort, setAutoSort] = useState(true);
  const [pickedWorks, setPickedWorks] = useState<Set<number>>(new Set());

  React.useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setCover(COVER_PRESETS[0]);
      setCategory('vlog');
      setVisibility('public');
      setAutoSort(true);
      setPickedWorks(new Set());
    }
  }, [open]);

  const canSubmit = title.trim().length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { bgcolor: 'background.paper', backgroundImage: 'none' } } }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, flex: 1 }}>创建新合集</Typography>
        <IconButton onClick={onClose} size="small"><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>
      <Box sx={{ p: 3, maxHeight: '70vh', overflowY: 'auto' }}>
        <Stack spacing={2.5}>
          {/* 封面选择 */}
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>合集封面</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ width: 160, aspectRatio: '16/9', borderRadius: 1.5, background: cover, flexShrink: 0 }} />
              <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                {COVER_PRESETS.map((c, i) => (
                  <Box
                    key={i}
                    onClick={() => setCover(c)}
                    sx={{
                      aspectRatio: '16/9',
                      borderRadius: 1,
                      background: c,
                      cursor: 'pointer',
                      border: '2px solid',
                      borderColor: cover === c ? 'primary.main' : 'transparent',
                      transition: 'border-color 0.15s',
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>

          <TextField
            label="合集标题"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 30))}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 30 }, formHelperText: { sx: { fontSize: 10 } } }}
            helperText={`${title.length}/30`}
          />

          <TextField
            label="合集描述"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 200))}
            fullWidth multiline minRows={2} maxRows={4}
            slotProps={{ htmlInput: { maxLength: 200 }, formHelperText: { sx: { fontSize: 10 } } }}
            helperText={`${description.length}/200`}
          />

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>分类</Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {CATEGORY_OPTIONS.map((opt) => (
                <Box
                  key={opt.key}
                  onClick={() => setCategory(opt.key)}
                  sx={{
                    px: 1.5, py: 0.5, borderRadius: 1, cursor: 'pointer', fontSize: 12,
                    bgcolor: category === opt.key ? 'rgba(254, 44, 85, 0.12)' : 'action.hover',
                    color: category === opt.key ? 'primary.main' : 'text.secondary',
                    border: '1px solid', borderColor: category === opt.key ? 'primary.main' : 'transparent',
                  }}
                >
                  {opt.label}
                </Box>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>可见性</Typography>
            <Stack direction="row" spacing={1}>
              {(['public', 'fansOnly', 'private'] as CollectionVisibility[]).map((v) => (
                <Box
                  key={v}
                  onClick={() => setVisibility(v)}
                  sx={{
                    px: 1.5, py: 0.5, borderRadius: 1, cursor: 'pointer', fontSize: 12,
                    bgcolor: visibility === v ? 'rgba(254, 44, 85, 0.12)' : 'action.hover',
                    color: visibility === v ? 'primary.main' : 'text.secondary',
                    border: '1px solid', borderColor: visibility === v ? 'primary.main' : 'transparent',
                  }}
                >
                  {VISIBILITY_META[v].label}
                </Box>
              ))}
            </Stack>
          </Box>

          <FormControlLabel
            control={<Switch checked={autoSort} onChange={(e) => setAutoSort(e.target.checked)} size="small" />}
            label={<Typography sx={{ fontSize: 12 }}>自动按发布时间排序</Typography>}
          />

          {/* 添加作品 */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>添加作品</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>已选 {pickedWorks.size} / {ALL_WORKS.length}</Typography>
            </Box>
            <Box sx={{ maxHeight: 240, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1.5, p: 0.5 }}>
              {ALL_WORKS.map((w) => {
                const picked = pickedWorks.has(w.id);
                return (
                  <Box
                    key={w.id}
                    onClick={() => {
                      setPickedWorks((s) => {
                        const n = new Set(s);
                        if (n.has(w.id)) n.delete(w.id);
                        else n.add(w.id);
                        return n;
                      });
                    }}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1, p: 0.75,
                      borderRadius: 1, cursor: 'pointer',
                      bgcolor: picked ? 'rgba(254, 44, 85, 0.06)' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={picked}
                      onChange={(e) => {
                        setPickedWorks((s) => {
                          const n = new Set(s);
                          if (e.target.checked) n.add(w.id);
                          else n.delete(w.id);
                          return n;
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      sx={{ p: 0 }}
                    />
                    <Box sx={{ width: 48, height: 30, borderRadius: 0.5, background: w.cover, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {w.title}
                      </Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                        {w.duration ? `${w.duration} · ` : ''}{formatNum(w.views)} 播放
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Stack>
      </Box>
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none', borderRadius: 1.5 }}>取消</Button>
        <Button
          onClick={() => {
            const works = ALL_WORKS.filter((w) => pickedWorks.has(w.id));
            onCreate({
              title: title.trim(), description, cover, category, visibility, autoSort,
              status: 'draft', works,
            });
          }}
          disabled={!canSubmit}
          variant="contained"
          sx={{
            textTransform: 'none', borderRadius: 1.5,
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
            '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
          }}
        >
          创建合集
        </Button>
      </Box>
    </Dialog>
  );
}

// ───── 编辑合集 Drawer (含作品重排序 + 增删) ─────
function EditCollectionDrawer({
  collection, onClose, onSave,
}: {
  collection: Collection | null;
  onClose: () => void;
  onSave: (patch: Partial<Collection>) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState(COVER_PRESETS[0]);
  const [status, setStatus] = useState<CollectionStatus>('active');
  const [visibility, setVisibility] = useState<CollectionVisibility>('public');
  const [works, setWorks] = useState<WorkRef[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  React.useEffect(() => {
    if (collection) {
      setTitle(collection.title);
      setDescription(collection.description);
      setCover(collection.cover);
      setStatus(collection.status);
      setVisibility(collection.visibility);
      setWorks([...collection.works]);
      setPickerOpen(false);
    }
  }, [collection?.id]);

  if (!collection) return null;

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...works];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setWorks(next);
  };
  const moveDown = (idx: number) => {
    if (idx === works.length - 1) return;
    const next = [...works];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setWorks(next);
  };
  const removeWork = (id: number) => setWorks((p) => p.filter((w) => w.id !== id));

  const availableToAdd = ALL_WORKS.filter((w) => !works.some((x) => x.id === w.id));

  return (
    <Drawer
      anchor="right"
      open={!!collection}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 560 }, bgcolor: 'background.paper' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>编辑合集</Typography>
        <IconButton onClick={onClose} size="small"><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        <Stack spacing={2}>
          <Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.75 }}>封面</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.75 }}>
              {COVER_PRESETS.map((c, i) => (
                <Box
                  key={i}
                  onClick={() => setCover(c)}
                  sx={{
                    aspectRatio: '16/9', borderRadius: 1, background: c, cursor: 'pointer',
                    border: '2px solid', borderColor: cover === c ? 'primary.main' : 'transparent',
                  }}
                />
              ))}
            </Box>
          </Box>

          <TextField label="标题" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 30))} fullWidth />
          <TextField label="描述" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 200))} fullWidth multiline minRows={2} />

          <Stack direction="row" spacing={2}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.75 }}>状态</Typography>
              <Stack direction="row" spacing={0.5}>
                {(['draft', 'active', 'finished'] as CollectionStatus[]).map((s) => (
                  <Box
                    key={s}
                    onClick={() => setStatus(s)}
                    sx={{
                      px: 1.25, py: 0.5, borderRadius: 1, cursor: 'pointer', fontSize: 11,
                      bgcolor: status === s ? STATUS_META[s].bg : 'action.hover',
                      color: status === s ? STATUS_META[s].color : 'text.secondary',
                      border: '1px solid', borderColor: status === s ? STATUS_META[s].color : 'transparent',
                    }}
                  >
                    {STATUS_META[s].label}
                  </Box>
                ))}
              </Stack>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.75 }}>可见性</Typography>
              <Stack direction="row" spacing={0.5}>
                {(['public', 'fansOnly', 'private'] as CollectionVisibility[]).map((v) => (
                  <Box
                    key={v}
                    onClick={() => setVisibility(v)}
                    sx={{
                      px: 1.25, py: 0.5, borderRadius: 1, cursor: 'pointer', fontSize: 11,
                      bgcolor: visibility === v ? 'rgba(254, 44, 85, 0.12)' : 'action.hover',
                      color: visibility === v ? 'primary.main' : 'text.secondary',
                      border: '1px solid', borderColor: visibility === v ? 'primary.main' : 'transparent',
                    }}
                  >
                    {VISIBILITY_META[v].label}
                  </Box>
                ))}
              </Stack>
            </Box>
          </Stack>

          {/* 作品管理 */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>作品 ({works.length})</Typography>
              <Box sx={{ flex: 1 }} />
              <Button size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />} onClick={() => setPickerOpen(true)} sx={{ textTransform: 'none', fontSize: 11 }} disabled={availableToAdd.length === 0}>
                添加作品
              </Button>
            </Box>
            {works.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 1.5, color: 'text.disabled', fontSize: 12 }}>
                合集中尚未添加作品
              </Box>
            ) : (
              <Stack spacing={0.75}>
                {works.map((w, idx) => (
                  <Box key={w.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                    <DragIndicatorRoundedIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'grab' }} />
                    <Box sx={{ width: 50, height: 32, borderRadius: 0.5, background: w.cover, flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {w.title}
                      </Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                        {w.duration ? `${w.duration} · ` : ''}{formatNum(w.views)} 播放
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => moveUp(idx)} disabled={idx === 0} sx={{ p: 0.25 }}>
                      <ArrowUpwardRoundedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => moveDown(idx)} disabled={idx === works.length - 1} sx={{ p: 0.25 }}>
                      <ArrowDownwardRoundedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => removeWork(w.id)} sx={{ p: 0.25 }} aria-label="移除">
                      <CloseRoundedIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </Box>
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none', borderRadius: 1.5 }}>取消</Button>
        <Button
          variant="contained"
          onClick={() => onSave({ title, description, cover, status, visibility, works })}
          sx={{
            textTransform: 'none', borderRadius: 1.5,
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
            '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
          }}
        >
          保存
        </Button>
      </Box>

      {/* 作品选择器 Dialog */}
      <Dialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: 'background.paper', backgroundImage: 'none' } } }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, flex: 1 }}>选择要添加的作品</Typography>
          <IconButton size="small" onClick={() => setPickerOpen(false)}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
        </Box>
        <Box sx={{ p: 1, maxHeight: 400, overflowY: 'auto' }}>
          {availableToAdd.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center', color: 'text.disabled', fontSize: 12 }}>所有作品已添加</Box>
          ) : (
            <Stack spacing={0.5}>
              {availableToAdd.map((w) => (
                <Box
                  key={w.id}
                  onClick={() => { setWorks((p) => [...p, w]); setPickerOpen(false); }}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.75, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <Box sx={{ width: 48, height: 30, borderRadius: 0.5, background: w.cover, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.title}</Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{w.duration ? `${w.duration} · ` : ''}{formatNum(w.views)} 播放</Typography>
                  </Box>
                  <AddRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Dialog>
    </Drawer>
  );
}
