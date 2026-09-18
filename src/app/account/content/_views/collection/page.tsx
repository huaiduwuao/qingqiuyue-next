'use client';

// 该页依赖 client context + 后端实时数据,SSR/pre-render 时 TIERS/orders 等未就绪 →
// 报 "Cannot read properties of undefined"。强制 dynamic 跳过预渲染。
//
// 数据源:PG 的 user_my_list / user_my_list_item,走 /api/content/my-list/*
// (后端 internal/handler/my_list.go)。以前这里请求 /api/core/creator/collection/list
// 读、/api/core/account/collection 写,两个端点都在,但都落在 Doris 的
// user_content_collect 上 —— 那张表只有 user_id+content_id+type,没有合集元数据,
// 于是写入把标题/封面/简介全丢,读出来只能按 ref_id 分组硬造一个「默认收藏夹」。
// (列表还恒为空:上一版把 useState 的初值设成首次渲染时还没到的 query 结果。)
// 现在和「我的」页的 作品合集 页签(/api/content/home/me/list?tab=collection,
// 读 user_my_list 的 topic+album)共用同一张表,改完那边立刻能看到。
//
// user_my_list 没有的字段(合集状态 进行中/已完结/草稿、分类、自动排序、订阅数、
// 累计播放)都已从界面上去掉 —— 与其显示写不进去的开关和恒为 0 的数字,不如不显示。

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getMyLists,
  createMyList,
  updateMyList,
  deleteMyList,
  getMyListContent,
  addToMyList,
  removeFromMyList,
  reorderMyList,
  type MyListItem as ApiMyList,
} from '@/apis/my-list';
import { getMyWorks, type MyWork } from '@/apis/dashboard';
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
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import SearchIcon from '@mui/icons-material/Search';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import { ListLayout, ListLayoutSwitch, LIST_ROW, LIST_COMPACT } from '@/components/common/ListLayout';
import { toEntityId, sameId, type EntityId } from '@/lib/id';
import { coverBackground } from '@/lib/media';

/**
 * 创作者中心建的合集统一存成 user_my_list.type = 'topic'(专题)。
 * 「我的」页的 作品合集 页签读 topic + album,所以这里建的合集在那边也看得到。
 */
const CREATOR_LIST_TYPE = 'topic' as const;

/** 合集名长度上限跟后端一致(my_list.go:名称需为 1–40 个字) */
const NAME_MAX = 40;
/** 简介上限,后端列是 varchar(500),界面收紧到 200 */
const DESC_MAX = 200;

// 作品(内容)id 是超 2^53 的 BIGINT,后端给的是字符串,原样保留(见 lib/id.ts)。
// 合集 id 是 PG 自增,小整数。
interface WorkRef {
  id: EntityId;
  title: string;
  cover: string;
  views: number;
}

interface Collection {
  id: EntityId;
  title: string;
  description: string;
  /** 自己设的封面;为空时用 covers 里前几项的封面兜底 */
  cover: string;
  covers: string[];
  isPublic: boolean;
  itemCount: number;
  /** 后端给的是 "2006-01-02 15:04:05" 字符串,原样截前 10 位显示,不进 Date(避免时区偏移) */
  updateTime: string;
}

function toCollection(l: ApiMyList): Collection {
  return {
    id: l.id,
    title: l.name,
    description: l.description ?? '',
    cover: l.coverUrl ?? '',
    covers: l.covers ?? [],
    isPublic: !!l.isPublic,
    itemCount: l.itemCount ?? 0,
    updateTime: l.updateTime ?? '',
  };
}

function toWorkRef(w: MyWork): WorkRef | null {
  const id = toEntityId(w.id);
  if (id === null) return null;
  return { id, title: w.title, cover: w.cover ?? '', views: w.views ?? 0 };
}

function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

/** 封面缺省时拿夹子里前几项的封面拼一格,和「我的」页的宫格逻辑一致 */
function collectionCover(c: Collection): string {
  return c.cover || c.covers[0] || '';
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
  const qc = useQueryClient();
  const [tab, setTab] = useState<0 | 1 | 2>(0);
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  // 每次打开换一个 key,让创建表单重新挂载拿到干净初值(不用 effect 里 setState 重置)
  const [createSeq, setCreateSeq] = useState(0);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<{ id: EntityId; el: HTMLElement } | null>(null);

  const listQ = useQuery({
    queryKey: ['creator-collections', CREATOR_LIST_TYPE],
    queryFn: () => getMyLists(CREATOR_LIST_TYPE),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });

  // 直接从 query 派生 —— 以前这里是 useState(apiCollections),初值在首次渲染(数据还没到)
  // 时就定死了,接口回来也不会刷新,列表永远是空的。
  const collections: Collection[] = useMemo(
    () => (listQ.data?.list ?? []).map(toCollection),
    [listQ.data],
  );

  // 「添加作品」选择器的数据源:/api/core/creator/my/works —— 只返回 status='PUBLISH'
  // 的作品,合集里就不会出现还在审核/未发布的稿子。
  const worksQ = useQuery({
    queryKey: ['creator-my-works'],
    queryFn: () => getMyWorks(),
    staleTime: 30 * 1000,
  });
  const myWorks: WorkRef[] = useMemo(
    () => ((worksQ.data?.list ?? worksQ.data?.records ?? []) as MyWork[]).map(toWorkRef).filter((w): w is WorkRef => w !== null),
    [worksQ.data],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['creator-collections'] });
    // 「我的」页的 作品合集 页签读同一张表
    qc.invalidateQueries({ queryKey: ['my-lists'] });
  };

  const createM = useMutation({
    mutationFn: (v: { name: string; description: string; coverUrl: string; isPublic: boolean; contentIds: EntityId[] }) =>
      createMyList({ ...v, type: CREATOR_LIST_TYPE }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setSnack('合集已创建');
    },
    onError: () => setSnack('创建失败,请重试'),
  });

  // 保存一个合集:元数据一次 PUT,作品的增/删/排序各走各的端点。
  const saveM = useMutation({
    mutationFn: async (v: {
      id: EntityId;
      name: string;
      description: string;
      coverUrl: string;
      isPublic: boolean;
      workIds: EntityId[];
      /** 打开抽屉时夹子里原本的作品,用来算增删 */
      originalIds: EntityId[];
    }) => {
      await updateMyList(v.id, {
        name: v.name,
        description: v.description,
        coverUrl: v.coverUrl,
        isPublic: v.isPublic,
      });
      const removed = v.originalIds.filter((id) => !v.workIds.some((x) => sameId(x, id)));
      for (const cid of removed) {
        await removeFromMyList(v.id, cid);
      }
      const added = v.workIds.filter((id) => !v.originalIds.some((x) => sameId(x, id)));
      if (added.length > 0) {
        await addToMyList(v.id, added);
      }
      // 排序放最后,新加进来的项也要按界面上的顺序落位
      if (v.workIds.length > 1) {
        await reorderMyList(v.id, v.workIds);
      }
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setSnack('合集已保存');
    },
    onError: () => setSnack('保存失败,请重试'),
  });

  const deleteM = useMutation({
    mutationFn: (id: EntityId) => deleteMyList(id),
    onSuccess: () => {
      invalidate();
      setSnack('合集已删除');
    },
    onError: () => setSnack('删除失败,请重试'),
  });

  const counts = useMemo(
    () => ({
      all: collections.length,
      pub: collections.filter((c) => c.isPublic).length,
      priv: collections.filter((c) => !c.isPublic).length,
    }),
    [collections],
  );

  const filtered = useMemo(() => {
    let list = collections;
    if (tab === 1) list = list.filter((c) => c.isPublic);
    else if (tab === 2) list = list.filter((c) => !c.isPublic);
    if (keyword) {
      const kw = keyword.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(kw) || c.description.toLowerCase().includes(kw));
    }
    return list;
  }, [collections, tab, keyword]);

  const totalWorks = collections.reduce((s, c) => s + c.itemCount, 0);

  const openCreate = () => {
    setCreateSeq((n) => n + 1);
    setCreateOpen(true);
  };

  const handleDelete = (id: EntityId) => {
    setAnchorEl(null);
    deleteM.mutate(id);
  };

  const handleCopyLink = async (c: Collection) => {
    setAnchorEl(null);
    if (!c.isPublic) {
      setSnack('私密合集的链接别人打不开,先在编辑里设为公开');
      return;
    }
    // /playlist?id= 是所有 user_my_list 的详情页(/account/my-lists/detail 也只是转到这里)
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/playlist?id=${c.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setSnack('链接已复制');
    } catch {
      setSnack('复制失败');
    }
  };

  const busy = createM.isPending || saveM.isPending || deleteM.isPending;

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Box sx={{ maxWidth: 'var(--page-max)', mx: 'auto', p: { xs: 2, md: 3 } }}>
        <DetailHeader
          title="合集管理"
          action={
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={openCreate}
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

        {/* 概览 —— 只放 user_my_list 真有的数字 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 3 }}>
          {[
            { label: '合集总数', value: String(collections.length), color: '#FE2C55' },
            { label: '收录作品', value: formatNum(totalWorks), color: '#25F4EE' },
            { label: '公开合集', value: String(counts.pub), color: '#5DDB96' },
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
            <Tab label={`公开 ${counts.pub}`} />
            <Tab label={`私密 ${counts.priv}`} />
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
          <ListLayoutSwitch />
        </Box>

        {/* 合集卡片网格 */}
        {listQ.isLoading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={22} />
          </Box>
        ) : listQ.isError ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography sx={{ fontSize: 14, color: 'text.disabled' }}>合集加载失败</Typography>
            <Button onClick={() => listQ.refetch()} sx={{ mt: 1, textTransform: 'none', fontSize: 13 }}>
              重试
            </Button>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CollectionsRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography sx={{ fontSize: 14, color: 'text.disabled' }}>
              {collections.length === 0 ? '暂无合集' : '没有符合条件的合集'}
            </Typography>
            {collections.length === 0 && (
              <Button onClick={openCreate} sx={{ mt: 1, textTransform: 'none', fontSize: 13 }}>
                创建第一个合集
              </Button>
            )}
          </Box>
        ) : (
          <ListLayout minColumnWidth={300} gap={16}>
            {filtered.map((c) => (
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
                  [LIST_ROW]: { display: 'flex', alignItems: 'stretch' },
                }}
              >
                {/* 封面 + 可见性 */}
                <Box
                  sx={{
                    position: 'relative',
                    aspectRatio: '16/9',
                    background: coverBackground(collectionCover(c), 'linear-gradient(135deg, #2A2D3A 0%, #1A1C26 100%)'),
                    overflow: 'hidden',
                    [LIST_ROW]: { width: { xs: 120, sm: 200 }, flexShrink: 0 },
                  }}
                >
                  <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.7) 100%)' }} />
                  <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 0.75 }}>
                    <Box
                      sx={{
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 0.5,
                        bgcolor: 'rgba(0,0,0,0.5)',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.25,
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      {c.isPublic ? <PublicRoundedIcon sx={{ fontSize: 11 }} /> : <LockOutlinedIcon sx={{ fontSize: 11 }} />}
                      {c.isPublic ? '公开' : '私密'}
                    </Box>
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <CollectionsRoundedIcon sx={{ fontSize: 14 }} />
                      <Typography sx={{ fontSize: 11, fontWeight: 600 }}>{c.itemCount} 个作品</Typography>
                    </Box>
                  </Box>
                </Box>

                {/* 文本 + 数据 */}
                <Box sx={{ p: 2, [LIST_COMPACT]: { p: 1.5 }, [LIST_ROW]: { flex: 1, minWidth: 0, p: 1.5, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary', mb: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.title}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1.5, height: 32, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {c.description || '还没有写简介'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, fontSize: 11, color: 'text.disabled' }}>
                    <Box sx={{ ml: 'auto' }}>{c.updateTime ? `更新于 ${c.updateTime.slice(0, 10)}` : ''}</Box>
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
            ))}
          </ListLayout>
        )}

        {/* 更多菜单 */}
        <Menu open={!!anchorEl} anchorEl={anchorEl?.el} onClose={() => setAnchorEl(null)}>
          {(() => {
            const c = anchorEl ? collections.find((x) => sameId(x.id, anchorEl.id)) : null;
            if (!c) return null;
            return [
              <MenuItem key="edit" onClick={() => { setEditing(c); setAnchorEl(null); }} sx={{ fontSize: 13 }}>
                <EditRoundedIcon sx={{ fontSize: 16, mr: 1 }} />编辑合集
              </MenuItem>,
              <MenuItem key="share" onClick={() => handleCopyLink(c)} sx={{ fontSize: 13 }}>
                <ShareRoundedIcon sx={{ fontSize: 16, mr: 1 }} />复制链接
              </MenuItem>,
              <Divider key="d" />,
              <MenuItem key="del" onClick={() => handleDelete(c.id)} sx={{ fontSize: 13, color: 'error.main' }} disabled={busy}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16, mr: 1 }} />删除合集
              </MenuItem>,
            ];
          })()}
        </Menu>

        <CreateCollectionDialog
          key={createSeq}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          submitting={createM.isPending}
          onCreate={(v) => createM.mutate(v)}
          allWorks={myWorks}
        />

        <EditCollectionDrawer
          collection={editing}
          onClose={() => setEditing(null)}
          allWorks={myWorks}
          submitting={saveM.isPending}
          onSave={(v) => saveM.mutate(v)}
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

/** 作品行(创建对话框 / 选择器共用) */
function WorkRow({ work, right }: { work: WorkRef; right?: React.ReactNode }) {
  return (
    <>
      <Box sx={{ width: 48, height: 30, borderRadius: 0.5, background: coverBackground(work.cover, 'action.hover'), flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {work.title}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{formatNum(work.views)} 播放</Typography>
      </Box>
      {right}
    </>
  );
}

/**
 * 封面选择:user_my_list.cover_url 存的是图片地址(「我的」页拿它当 <img src>),
 * 所以只能从合集里作品的封面里挑,不能塞 CSS 渐变。不挑就留空,由后端/前端用
 * 第一项的封面兜底。
 */
function CoverPicker({
  candidates,
  value,
  onChange,
}: {
  candidates: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const opts = useMemo(() => Array.from(new Set(candidates.filter(Boolean))).slice(0, 8), [candidates]);
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
        合集封面 —— 从已选作品的封面里挑一张,不选就用第一个作品的封面
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        <Box
          onClick={() => onChange('')}
          sx={{
            aspectRatio: '16/9',
            borderRadius: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: value === '' ? 'primary.main' : 'text.secondary',
            bgcolor: 'action.hover',
            border: '2px solid',
            borderColor: value === '' ? 'primary.main' : 'transparent',
          }}
        >
          自动
        </Box>
        {opts.map((src) => (
          <Box
            key={src}
            onClick={() => onChange(src)}
            sx={{
              aspectRatio: '16/9',
              borderRadius: 1,
              background: coverBackground(src, 'action.hover'),
              cursor: 'pointer',
              border: '2px solid',
              borderColor: value === src ? 'primary.main' : 'transparent',
              transition: 'border-color 0.15s',
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

/** 公开 / 私密 二选一(user_my_list 只有 is_public,没有「仅粉丝」) */
function VisibilityPicker({ isPublic, onChange }: { isPublic: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>可见性</Typography>
      <Stack direction="row" spacing={1}>
        {[
          { v: true, label: '公开' },
          { v: false, label: '私密' },
        ].map((o) => (
          <Box
            key={o.label}
            onClick={() => onChange(o.v)}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              cursor: 'pointer',
              fontSize: 12,
              bgcolor: isPublic === o.v ? 'rgba(254, 44, 85, 0.12)' : 'action.hover',
              color: isPublic === o.v ? 'primary.main' : 'text.secondary',
              border: '1px solid',
              borderColor: isPublic === o.v ? 'primary.main' : 'transparent',
            }}
          >
            {o.label}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

// ───── 创建合集 Dialog ─────
function CreateCollectionDialog({
  open, onClose, onCreate, allWorks, submitting,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (v: { name: string; description: string; coverUrl: string; isPublic: boolean; contentIds: EntityId[] }) => void;
  allWorks: WorkRef[];
  submitting: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [picked, setPicked] = useState<EntityId[]>([]);

  const pickedWorks = useMemo(
    () => picked.map((id) => allWorks.find((w) => sameId(w.id, id))).filter((w): w is WorkRef => !!w),
    [picked, allWorks],
  );

  const toggle = (id: EntityId) =>
    setPicked((p) => (p.some((x) => sameId(x, id)) ? p.filter((x) => !sameId(x, id)) : [...p, id]));

  const canSubmit = name.trim().length > 0 && name.trim().length <= NAME_MAX && !submitting;

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
          <TextField
            label="合集标题"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
            fullWidth
            slotProps={{ htmlInput: { maxLength: NAME_MAX }, formHelperText: { sx: { fontSize: 10 } } }}
            helperText={`${name.length}/${NAME_MAX}`}
          />

          <TextField
            label="合集描述"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
            fullWidth multiline minRows={2} maxRows={4}
            slotProps={{ htmlInput: { maxLength: DESC_MAX }, formHelperText: { sx: { fontSize: 10 } } }}
            helperText={`${description.length}/${DESC_MAX}`}
          />

          <VisibilityPicker isPublic={isPublic} onChange={setIsPublic} />

          {/* 添加作品 */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>添加作品</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>已选 {picked.length} / {allWorks.length}</Typography>
            </Box>
            <Box sx={{ maxHeight: 240, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1.5, p: 0.5 }}>
              {allWorks.length === 0 ? (
                <Box sx={{ p: 3, textAlign: 'center', color: 'text.disabled', fontSize: 12 }}>
                  暂无可加入合集的作品
                </Box>
              ) : (
                allWorks.map((w) => {
                  const on = picked.some((x) => sameId(x, w.id));
                  return (
                    <Box
                      key={w.id}
                      onClick={() => toggle(w.id)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1, p: 0.75,
                        borderRadius: 1, cursor: 'pointer',
                        bgcolor: on ? 'rgba(254, 44, 85, 0.06)' : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={on}
                        onChange={() => toggle(w.id)}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ p: 0 }}
                      />
                      <WorkRow work={w} />
                    </Box>
                  );
                })
              )}
            </Box>
          </Box>

          {/* 已挑中的封面也留在候选里,取消勾选那个作品后不会突然变回「自动」 */}
          <CoverPicker candidates={[cover, ...pickedWorks.map((w) => w.cover)]} value={cover} onChange={setCover} />
        </Stack>
      </Box>
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none', borderRadius: 1.5 }}>取消</Button>
        <Button
          onClick={() =>
            onCreate({
              name: name.trim(),
              description: description.trim(),
              coverUrl: cover,
              isPublic,
              contentIds: picked,
            })
          }
          disabled={!canSubmit}
          variant="contained"
          startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : undefined}
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
//
// 外壳只管开合,表单是独立组件并按 collection.id 做 key —— 换一个合集就重新挂载,
// 初值直接写在 useState 里,不用 effect 去 setState 同步(那样会连带多渲染一轮)。
function EditCollectionDrawer({
  collection, onClose, onSave, allWorks, submitting,
}: {
  collection: Collection | null;
  onClose: () => void;
  onSave: (v: {
    id: EntityId;
    name: string;
    description: string;
    coverUrl: string;
    isPublic: boolean;
    workIds: EntityId[];
    originalIds: EntityId[];
  }) => void;
  allWorks: WorkRef[];
  submitting: boolean;
}) {
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
      {collection && (
        <EditCollectionForm
          key={String(collection.id)}
          collection={collection}
          onClose={onClose}
          onSave={onSave}
          allWorks={allWorks}
          submitting={submitting}
        />
      )}
    </Drawer>
  );
}

function EditCollectionForm({
  collection, onClose, onSave, allWorks, submitting,
}: {
  collection: Collection;
  onClose: () => void;
  onSave: (v: {
    id: EntityId;
    name: string;
    description: string;
    coverUrl: string;
    isPublic: boolean;
    workIds: EntityId[];
    originalIds: EntityId[];
  }) => void;
  allWorks: WorkRef[];
  submitting: boolean;
}) {
  const [name, setName] = useState(collection.title);
  const [description, setDescription] = useState(collection.description);
  const [cover, setCover] = useState(collection.cover);
  const [isPublic, setIsPublic] = useState(collection.isPublic);
  /** null = 还没动过,直接用后端那份顺序;动过之后才走本地草稿 */
  const [draftWorks, setDraftWorks] = useState<WorkRef[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // 卡片上只有条目数和几张封面,真正的作品清单(含顺序)开抽屉时才拉
  const contentQ = useQuery({
    queryKey: ['creator-collection-content', collection.id],
    queryFn: () => getMyListContent(collection.id),
    staleTime: 0,
  });

  const loadedWorks: WorkRef[] = useMemo(
    () =>
      (contentQ.data?.list ?? [])
        .map((it) => {
          const id = toEntityId(it.contentId);
          return id === null ? null : { id, title: it.title, cover: it.coverUrl ?? '', views: it.views ?? 0 };
        })
        .filter((w): w is WorkRef => w !== null),
    [contentQ.data],
  );
  /** 打开时夹子里原本有哪些作品 —— 保存时用来算增删 */
  const originalIds = useMemo(() => loadedWorks.map((w) => w.id), [loadedWorks]);

  const works = draftWorks ?? loadedWorks;

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...works];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setDraftWorks(next);
  };
  const moveDown = (idx: number) => {
    if (idx === works.length - 1) return;
    const next = [...works];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setDraftWorks(next);
  };
  const removeWork = (id: EntityId) => setDraftWorks(works.filter((w) => !sameId(w.id, id)));
  const addWork = (w: WorkRef) => setDraftWorks([...works, w]);

  const availableToAdd = allWorks.filter((w) => !works.some((x) => sameId(x.id, w.id)));
  const canSubmit = name.trim().length > 0 && name.trim().length <= NAME_MAX && !submitting && !contentQ.isLoading;

  return (
    <>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        <Stack spacing={2}>
          <TextField
            label="标题"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
            fullWidth
            slotProps={{ htmlInput: { maxLength: NAME_MAX } }}
          />
          <TextField
            label="描述"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
            fullWidth multiline minRows={2}
            slotProps={{ htmlInput: { maxLength: DESC_MAX } }}
          />

          <VisibilityPicker isPublic={isPublic} onChange={setIsPublic} />

          {/* 作品管理 */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>作品 ({works.length})</Typography>
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                startIcon={<AddRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={() => setPickerOpen(true)}
                sx={{ textTransform: 'none', fontSize: 11 }}
                disabled={availableToAdd.length === 0}
              >
                添加作品
              </Button>
            </Box>
            {contentQ.isLoading ? (
              <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={18} /></Box>
            ) : contentQ.isError ? (
              <Box sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 1.5, color: 'text.disabled', fontSize: 12 }}>
                作品清单加载失败
              </Box>
            ) : works.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 1.5, color: 'text.disabled', fontSize: 12 }}>
                合集中尚未添加作品
              </Box>
            ) : (
              <Stack spacing={0.75}>
                {works.map((w, idx) => (
                  <Box key={w.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
                    <DragIndicatorRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                    <WorkRow
                      work={w}
                      right={
                        <>
                          <IconButton size="small" onClick={() => moveUp(idx)} disabled={idx === 0} sx={{ p: 0.25 }} aria-label="上移">
                            <ArrowUpwardRoundedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <IconButton size="small" onClick={() => moveDown(idx)} disabled={idx === works.length - 1} sx={{ p: 0.25 }} aria-label="下移">
                            <ArrowDownwardRoundedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <IconButton size="small" onClick={() => removeWork(w.id)} sx={{ p: 0.25 }} aria-label="移除">
                            <CloseRoundedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </>
                      }
                    />
                  </Box>
                ))}
              </Stack>
            )}
          </Box>

          {/* 已挑中的封面也留在候选里,作品被移出后不会突然变回「自动」 */}
          <CoverPicker candidates={[cover, ...works.map((w) => w.cover)]} value={cover} onChange={setCover} />
        </Stack>
      </Box>
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none', borderRadius: 1.5 }}>取消</Button>
        <Button
          variant="contained"
          disabled={!canSubmit}
          startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : undefined}
          onClick={() =>
            onSave({
              id: collection.id,
              name: name.trim(),
              description: description.trim(),
              coverUrl: cover,
              isPublic,
              workIds: works.map((w) => w.id),
              originalIds,
            })
          }
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
                  onClick={() => { addWork(w); setPickerOpen(false); }}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.75, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <WorkRow work={w} right={<AddRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />} />
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Dialog>
    </>
  );
}
