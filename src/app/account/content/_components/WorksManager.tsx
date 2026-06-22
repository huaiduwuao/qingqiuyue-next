'use client';

import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import SearchIcon from '@mui/icons-material/Search';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { gradient2, gradient3 } from '@/constants/gradients';

type WorkType = 'video' | 'image' | 'article';
type WorkStatus = 'published' | 'reviewing' | 'draft' | 'private' | 'rejected';

interface Work {
  id: number;
  title: string;
  type: WorkType;
  status: WorkStatus;
  cover: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  collectNum: number;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  description: string;
}

const SEED: Work[] = [
  { id: 1001, title: '夏日海边vlog｜这个夏天最治愈的5个瞬间', type: 'video', status: 'published', cover: gradient3('#FE2C55', '#FF6B8A', '#FFB400'), views: 1284932, likes: 89432, comments: 3211, shares: 1820, collectNum: 5210, createdAt: Date.now() - 86400000 * 5, updatedAt: Date.now() - 86400000 * 5, tags: ['vlog', '夏日', '治愈'], description: '记录 5 个治愈瞬间,背景音乐用《夏日漱石》。' },
  { id: 1002, title: '小红书同款｜夏日穿搭合集', type: 'image', status: 'published', cover: gradient3('#25F4EE', '#5DF7F2', '#8B5CF6'), views: 423891, likes: 32104, comments: 1287, shares: 932, collectNum: 3842, createdAt: Date.now() - 86400000 * 7, updatedAt: Date.now() - 86400000 * 7, tags: ['穿搭', '小红书', '夏日'], description: '9 套夏日穿搭,白色系为主,搭配草编包。' },
  { id: 1003, title: '挑战全网最辣螺蛳粉!结果我输了…', type: 'video', status: 'published', cover: gradient3('#FFB400', '#FE2C55', '#8B5CF6'), views: 287432, likes: 21890, comments: 2143, shares: 612, collectNum: 1287, createdAt: Date.now() - 86400000 * 9, updatedAt: Date.now() - 86400000 * 9, tags: ['挑战', '美食', '辣'], description: '挑战变态辣螺蛳粉,坚持 3 分 17 秒后投降。' },
  { id: 1004, title: '10分钟学会 3 道快手早餐', type: 'video', status: 'reviewing', cover: gradient2('#5DDB96', '#25F4EE'), views: 0, likes: 0, comments: 0, shares: 0, collectNum: 0, createdAt: Date.now() - 86400000 * 1, updatedAt: Date.now() - 86400000 * 1, tags: ['美食', '早餐', '教程'], description: '三明治 / 蛋饼 / 燕麦杯,适合上班族。' },
  { id: 1005, title: '我的家乡', type: 'video', status: 'draft', cover: gradient2('#5B8DEF', '#8B5CF6'), views: 0, likes: 0, comments: 0, shares: 0, collectNum: 0, createdAt: Date.now() - 86400000 * 12, updatedAt: Date.now() - 3600000 * 2, tags: ['家乡', '旅行'], description: '未完成,等剪辑完成后发布。' },
  { id: 1006, title: '深夜独处歌单', type: 'article', status: 'private', cover: gradient2('#8B5CF6', '#FE2C55'), views: 8432, likes: 921, comments: 87, shares: 24, collectNum: 312, createdAt: Date.now() - 86400000 * 15, updatedAt: Date.now() - 86400000 * 15, tags: ['歌单', '音乐', '深夜'], description: '深夜独处 10 首推荐,助眠为主。' },
  { id: 1007, title: '开箱 VLOG', type: 'video', status: 'rejected', cover: gradient2('#FF6B8A', '#FFB400'), views: 0, likes: 0, comments: 0, shares: 0, collectNum: 0, createdAt: Date.now() - 86400000 * 18, updatedAt: Date.now() - 86400000 * 18, tags: ['开箱'], description: '因版权问题被驳回,请重新剪辑。' },
  { id: 1008, title: '设计师的一天', type: 'image', status: 'published', cover: gradient2('#06B6D4', '#5B8DEF'), views: 124832, likes: 8932, comments: 421, shares: 187, collectNum: 943, createdAt: Date.now() - 86400000 * 22, updatedAt: Date.now() - 86400000 * 22, tags: ['设计', '日常', '工作'], description: '记录普通设计师的日常 9 点到 22 点。' },
];

const STATUS_META: Record<WorkStatus, { label: string; color: string; bg: string }> = {
  published: { label: '已发布', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)' },
  reviewing: { label: '审核中', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)' },
  draft: { label: '草稿', color: 'text.secondary', bg: 'action.hover' },
  private: { label: '私密', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  rejected: { label: '已驳回', color: '#FF6B8A', bg: 'rgba(255, 107, 138, 0.12)' },
};

const TYPE_META: Record<WorkType, { label: string; icon: React.ReactNode; color: string }> = {
  video: { label: '视频', icon: <VideocamRoundedIcon sx={{ fontSize: 14 }} />, color: '#FE2C55' },
  image: { label: '图文', icon: <ImageRoundedIcon sx={{ fontSize: 14 }} />, color: '#25F4EE' },
  article: { label: '文章', icon: <ArticleRoundedIcon sx={{ fontSize: 14 }} />, color: '#8B5CF6' },
};

const TYPE_OPTIONS: { key: 'all' | WorkType; label: string }[] = [
  { key: 'all', label: '全部类型' },
  { key: 'video', label: '视频' },
  { key: 'image', label: '图文' },
  { key: 'article', label: '文章' },
];

function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function WorksManager() {
  const [works, setWorks] = useState<Work[]>(SEED);
  const [tab, setTab] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [typeFilter, setTypeFilter] = useState<'all' | WorkType>('all');
  const [keyword, setKeyword] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [snack, setSnack] = useState<string | null>(null);
  const [editing, setEditing] = useState<Work | null>(null);
  const [anchorEl, setAnchorEl] = useState<{ id: number; el: HTMLElement } | null>(null);

  const counts = useMemo(() => {
    const c = { all: works.length, published: 0, reviewing: 0, draft: 0, private: 0, rejected: 0 };
    works.forEach((w) => { c[w.status]++; });
    return c;
  }, [works]);

  const filtered = useMemo(() => {
    let list = works;
    if (tab === 1) list = list.filter((w) => w.status === 'published');
    else if (tab === 2) list = list.filter((w) => w.status === 'reviewing');
    else if (tab === 3) list = list.filter((w) => w.status === 'draft');
    else if (tab === 4) list = list.filter((w) => w.status === 'private' || w.status === 'rejected');
    if (typeFilter !== 'all') list = list.filter((w) => w.type === typeFilter);
    if (keyword) list = list.filter((w) => w.title.toLowerCase().includes(keyword.toLowerCase()) || w.tags.some((t) => t.includes(keyword)));
    return list;
  }, [works, tab, typeFilter, keyword]);

  const toggleSelect = (id: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((w) => w.id)));
  };

  const updateWork = (id: number, patch: Partial<Work>) => {
    setWorks((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: Date.now() } : w)));
  };

  const handleDelete = (id: number) => {
    setWorks((prev) => prev.filter((w) => w.id !== id));
    setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
    setSnack('作品已删除');
    setAnchorEl(null);
  };

  const handleTogglePrivate = (w: Work) => {
    const next: WorkStatus = w.status === 'private' ? 'published' : 'private';
    updateWork(w.id, { status: next });
    setSnack(next === 'private' ? '已设为私密' : '已设为公开');
    setAnchorEl(null);
  };

  const handlePublish = (w: Work) => {
    updateWork(w.id, { status: 'reviewing' });
    setSnack('已提交审核,预计 24 小时内完成');
    setAnchorEl(null);
  };

  const handleBatchDelete = () => {
    if (selected.size === 0) return;
    setWorks((prev) => prev.filter((w) => !selected.has(w.id)));
    setSnack(`已删除 ${selected.size} 个作品`);
    setSelected(new Set());
    setBatchMode(false);
  };

  const handleBatchSetPrivate = (priv: boolean) => {
    if (selected.size === 0) return;
    setWorks((prev) => prev.map((w) => selected.has(w.id) ? { ...w, status: priv ? 'private' as WorkStatus : 'published' as WorkStatus, updatedAt: Date.now() } : w));
    setSnack(priv ? `已将 ${selected.size} 个作品设为私密` : `已将 ${selected.size} 个作品设为公开`);
    setSelected(new Set());
    setBatchMode(false);
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: { xs: 2, md: 2.5 },
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ width: 4, height: 18, borderRadius: 2, background: 'linear-gradient(180deg, #FE2C55 0%, #FFB400 100%)' }} />
        <Typography sx={{ fontSize: 16, fontWeight: 700, flex: 1 }}>我的作品</Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
          sx={{
            textTransform: 'none', fontSize: 12, borderRadius: 1.5,
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
            '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
          }}
        >
          发布作品
        </Button>
      </Box>

      {/* 状态 Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => { setTab(v); setSelected(new Set()); }}
        variant="scrollable" scrollButtons="auto"
        sx={{
          mb: 1.5,
          minHeight: 36, borderBottom: 1, borderColor: 'divider',
          '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontSize: 12, py: 0.5 },
        }}
      >
        <Tab label={`全部 ${counts.all}`} />
        <Tab label={`已发布 ${counts.published}`} />
        <Tab label={`审核中 ${counts.reviewing}`} />
        <Tab label={`草稿 ${counts.draft}`} />
        <Tab label={`私密/驳回 ${counts.private + counts.rejected}`} />
      </Tabs>

      {/* 过滤工具栏 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="搜索标题或标签"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: 200, '& .MuiOutlinedInput-root': { fontSize: 12, height: 32, bgcolor: 'action.hover' } }}
        />
        <Tabs
          value={typeFilter}
          onChange={(_, v) => setTypeFilter(v)}
          sx={{ minHeight: 32, '& .MuiTab-root': { minHeight: 32, textTransform: 'none', fontSize: 11, py: 0.25, px: 1 } }}
        >
          {TYPE_OPTIONS.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
        </Tabs>
        <Box sx={{ flex: 1 }} />
        {batchMode ? (
          <>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>已选 {selected.size} / {filtered.length}</Typography>
            <Button size="small" onClick={toggleAll} sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>
              {selected.size === filtered.length ? '取消全选' : '全选'}
            </Button>
            <Button size="small" onClick={() => handleBatchSetPrivate(true)} disabled={selected.size === 0} sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>设为私密</Button>
            <Button size="small" onClick={() => handleBatchSetPrivate(false)} disabled={selected.size === 0} sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>设为公开</Button>
            <Button size="small" onClick={handleBatchDelete} disabled={selected.size === 0} sx={{ textTransform: 'none', fontSize: 12, color: 'error.main' }}>删除</Button>
            <IconButton size="small" onClick={() => { setBatchMode(false); setSelected(new Set()); }} aria-label="退出批量">
              <CloseRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </>
        ) : (
          <Button
            size="small" variant="outlined" onClick={() => setBatchMode(true)} disabled={filtered.length === 0}
            sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, borderColor: 'divider', color: 'text.secondary' }}
          >
            批量管理
          </Button>
        )}
      </Box>

      {/* 作品列表 */}
      {filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
          <Typography sx={{ fontSize: 13 }}>暂无作品</Typography>
          <Button size="small" variant="text" sx={{ mt: 1, textTransform: 'none', fontSize: 12 }}>去发布</Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {filtered.map((w) => {
            const sm = STATUS_META[w.status];
            const tm = TYPE_META[w.type];
            const isSelected = selected.has(w.id);
            return (
              <Box
                key={w.id}
                onClick={() => batchMode && toggleSelect(w.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.25,
                  borderRadius: 1.5,
                  bgcolor: isSelected ? 'rgba(254, 44, 85, 0.06)' : 'action.hover',
                  border: '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'transparent',
                  cursor: batchMode ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: isSelected ? 'primary.main' : 'divider' },
                }}
              >
                {batchMode && (
                  <Checkbox size="small" checked={isSelected} onClick={(e) => e.stopPropagation()} onChange={() => toggleSelect(w.id)} sx={{ p: 0 }} />
                )}
                <Box
                  sx={{
                    width: 80, height: 50, borderRadius: 1, flexShrink: 0, position: 'relative',
                    background: w.cover, overflow: 'hidden',
                  }}
                >
                  <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.4) 100%)' }} />
                  <Box sx={{ position: 'absolute', top: 4, left: 4, color: '#fff', opacity: 0.9 }}>{tm.icon}</Box>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>
                      {w.title}
                    </Typography>
                    <Box sx={{ px: 0.75, py: 0.1, borderRadius: 0.5, bgcolor: sm.bg, color: sm.color, fontSize: 9, fontWeight: 700 }}>{sm.label}</Box>
                    {w.tags.slice(0, 2).map((tag) => (
                      <Box key={tag} sx={{ px: 0.5, py: 0.1, borderRadius: 0.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'action.hover', color: 'text.secondary', fontSize: 9 }}>#{tag}</Box>
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 11, color: 'text.disabled', flexWrap: 'wrap' }}>
                    {w.status === 'published' && (
                      <>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}><VisibilityRoundedIcon sx={{ fontSize: 11 }} />{formatNum(w.views)}</Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}><FavoriteRoundedIcon sx={{ fontSize: 11 }} />{formatNum(w.likes)}</Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}><ChatBubbleOutlineRoundedIcon sx={{ fontSize: 11 }} />{formatNum(w.comments)}</Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}><ShareOutlinedIcon sx={{ fontSize: 11 }} />{formatNum(w.shares)}</Box>
                      </>
                    )}
                    <Typography sx={{ fontSize: 10 }}>更新于 {formatDate(w.updatedAt)}</Typography>
                  </Box>
                </Box>
                {!batchMode && (
                  <Stack direction="row" spacing={0.5}>
                    {w.status === 'draft' && (
                      <Button size="small" variant="contained" onClick={() => handlePublish(w)} sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5, minWidth: 56, py: 0.25 }}>
                        发布
                      </Button>
                    )}
                    <Button size="small" variant="outlined" startIcon={<EditRoundedIcon sx={{ fontSize: 12 }} />} onClick={() => setEditing(w)} sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5, borderColor: 'divider', color: 'text.secondary', py: 0.25 }}>
                      编辑
                    </Button>
                    <IconButton size="small" onClick={(e) => setAnchorEl({ id: w.id, el: e.currentTarget })} aria-label="更多操作">
                      <MoreHorizIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Stack>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      <Menu open={!!anchorEl} anchorEl={anchorEl?.el} onClose={() => setAnchorEl(null)}>
        {(() => {
          const w = anchorEl ? works.find((x) => x.id === anchorEl.id) : null;
          if (!w) return null;
          return [
            <MenuItem key="priv" onClick={() => handleTogglePrivate(w)} sx={{ fontSize: 12 }}>
              {w.status === 'private' ? <><LockOpenOutlinedIcon sx={{ fontSize: 14, mr: 1 }} />设为公开</> : <><LockOutlinedIcon sx={{ fontSize: 14, mr: 1 }} />设为私密</>}
            </MenuItem>,
            <MenuItem key="edit" onClick={() => { setEditing(w); setAnchorEl(null); }} sx={{ fontSize: 12 }}>
              <EditRoundedIcon sx={{ fontSize: 14, mr: 1 }} />编辑详情
            </MenuItem>,
            <Divider key="d" />,
            <MenuItem key="del" onClick={() => handleDelete(w.id)} sx={{ fontSize: 12, color: 'error.main' }}>
              <DeleteOutlineRoundedIcon sx={{ fontSize: 14, mr: 1 }} />删除作品
            </MenuItem>,
          ];
        })()}
      </Menu>

      <EditWorkDrawer
        open={!!editing}
        work={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) updateWork(editing.id, patch);
          setSnack('已保存');
          setEditing(null);
        }}
        onDelete={() => {
          if (editing) handleDelete(editing.id);
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
  );
}

function EditWorkDrawer({
  open, work, onClose, onSave, onDelete,
}: {
  open: boolean;
  work: Work | null;
  onClose: () => void;
  onSave: (patch: Partial<Work>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [status, setStatus] = useState<WorkStatus>('draft');

  React.useEffect(() => {
    if (work) {
      setTitle(work.title);
      setDescription(work.description);
      setTagsText(work.tags.join(' '));
      setStatus(work.status);
    }
  }, [work?.id]);

  if (!work) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 480 }, bgcolor: 'background.paper' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>编辑作品</Typography>
        <IconButton size="small" onClick={onClose} aria-label="关闭">
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        <Stack spacing={2}>
          <Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.75 }}>封面</Typography>
            <Box sx={{ width: '100%', aspectRatio: '16/9', borderRadius: 1.5, background: work.cover, position: 'relative' }}>
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: 12, cursor: 'pointer' }}>
                点击更换封面
              </Box>
            </Box>
          </Box>

          <TextField
            label="标题" value={title} onChange={(e) => setTitle(e.target.value.slice(0, 30))}
            fullWidth slotProps={{ htmlInput: { maxLength: 30 }, formHelperText: { sx: { fontSize: 10 } } }}
            helperText={`${title.length}/30`}
          />

          <TextField
            label="描述" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 200))}
            fullWidth multiline minRows={3} maxRows={6}
            slotProps={{ htmlInput: { maxLength: 200 }, formHelperText: { sx: { fontSize: 10 } } }}
            helperText={`${description.length}/200`}
          />

          <TextField
            label="标签 (空格分隔)" value={tagsText} onChange={(e) => setTagsText(e.target.value)}
            fullWidth placeholder="例如: vlog 夏日 治愈"
          />

          <Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.75 }}>状态</Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {(['draft', 'reviewing', 'published', 'private'] as WorkStatus[]).map((s) => {
                const meta = STATUS_META[s];
                return (
                  <Box
                    key={s}
                    onClick={() => setStatus(s)}
                    sx={{
                      px: 1.25, py: 0.5, borderRadius: 1, cursor: 'pointer', fontSize: 11,
                      bgcolor: status === s ? meta.bg : 'action.hover',
                      color: status === s ? meta.color : 'text.secondary',
                      border: '1px solid',
                      borderColor: status === s ? meta.color : 'transparent',
                    }}
                  >
                    {meta.label}
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Stack>
      </Box>
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5 }}>
        <Button color="error" onClick={onDelete} sx={{ textTransform: 'none' }}>删除</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" onClick={onClose} sx={{ textTransform: 'none', borderRadius: 2 }}>取消</Button>
        <Button
          variant="contained" onClick={() => onSave({ title, description, tags: tagsText.split(/\s+/).filter(Boolean), status })}
          sx={{ textTransform: 'none', borderRadius: 2, background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' } }}
        >
          保存
        </Button>
      </Box>
    </Drawer>
  );
}
