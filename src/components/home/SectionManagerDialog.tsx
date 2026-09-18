'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

import { fetchContentTags, fetchContentTypes, fetchSubcategories, type SubcategoryItem } from '@/apis/home-discover';
import { fetchTopics } from '@/apis/community';
import { getMyLists, getPublicLists } from '@/apis/my-list';
import { TYPE_LABEL } from '@/lib/contentType.gen';
import {
  BUILTIN_TYPE_SECTIONS,
  HomeSection,
  RECOMMEND_SECTION,
  makeKeywordSection,
  makeTagSection,
  makePlaylistSection,
  makeTopicSection,
  makeTypeSection,
} from '@/lib/homeSections';
import { useHomeSections } from '@/lib/sectionPrefs';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 频道管理:首页顶部那排页签由用户自己决定。
 *
 * 上半「我的频道」拖动排序 + 点 × 移除(「推荐」锁死在第一位);
 * 下半「更多频道」按来源分组:内容分类 / 题材 / 热门标签 / 来源 / 专题(含我关注的)/
 * 歌单(平台编排的、别人公开的、自己建的),搜不到就用搜索词现场建一个关键词频道。
 *
 * 改动直接落到 lib/sectionPrefs(localStorage),页签栏 useSyncExternalStore 立刻跟着变,
 * 所以这里没有"保存"按钮 —— 点一下就生效,关掉弹窗不会回滚。
 */

type CandidateGroup = 'type' | 'genre' | 'tag' | 'source' | 'topic' | 'playlist' | 'following';

const GROUP_TABS: { key: CandidateGroup; label: string }[] = [
  { key: 'type', label: '内容分类' },
  { key: 'genre', label: '题材' },
  { key: 'tag', label: '热门标签' },
  { key: 'source', label: '来源' },
  { key: 'topic', label: '热门意境' },
  // 歌单也是专题的一种:一组编排好的内容,同样能当成首页的一格页签
  { key: 'playlist', label: '歌单' },
  { key: 'following', label: '我关注的' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SectionManagerDialog({ open, onClose }: Props) {
  const { isMobile } = useResponsive();
  const { isAuthenticated } = useAuth();
  const [sections, api] = useHomeSections();
  const [group, setGroup] = useState<CandidateGroup>('type');
  const [q, setQ] = useState('');

  const mine = sections.filter((s) => s.id !== RECOMMEND_SECTION.id);
  const mineIds = useMemo(() => new Set(sections.map((s) => s.id)), [sections]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = mine.findIndex((s) => s.id === active.id);
    const to = mine.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    api.replaceAll(arrayMove(mine, from, to));
  };

  // ─── 候选来源 ───
  // 内容分类:字典表 /dict/types 是后台可维护的全集,拉不到时退回代码里的预置清单。
  const typesQuery = useQuery({
    queryKey: ['section-catalog', 'types'],
    queryFn: () => fetchContentTypes().then((r: any) => (r?.data?.list ?? []) as { code: string; name: string }[]),
    enabled: open,
    staleTime: 10 * 60_000,
  });
  const subcatQuery = useQuery({
    queryKey: ['section-catalog', 'subcategory'],
    queryFn: () =>
      fetchSubcategories('all').then((r: any) => (r?.data?.groups ?? {}) as Record<string, SubcategoryItem[]>),
    enabled: open && group === 'genre',
    staleTime: 10 * 60_000,
  });
  // 一次请求同时拿话题标签和来源名(后端分两份返回),两个页签共用
  const tagsQuery = useQuery({
    queryKey: ['section-catalog', 'tags'],
    queryFn: () =>
      fetchContentTags({ limit: 80 }).then((r: any) => ({
        tags: (r?.data?.list ?? []) as { name: string; count: number }[],
        sources: (r?.data?.sources ?? []) as { name: string; count: number }[],
      })),
    enabled: open && (group === 'tag' || group === 'source'),
    staleTime: 10 * 60_000,
  });
  const topicsQuery = useQuery({
    queryKey: ['section-catalog', 'topics', q],
    queryFn: () => fetchTopics({ sort: 'hot', keyword: q || undefined, page: 1, size: 60 }).then((p) => p.list ?? []),
    enabled: open && group === 'topic',
    staleTime: 60_000,
  });
  // 歌单:平台编排的 + 别人公开的(广场,免登录)+ 自己建的,拼成一组候选。
  const playlistQuery = useQuery({
    queryKey: ['section-catalog', 'playlists', q],
    queryFn: () => getPublicLists({ type: 'playlist', keyword: q || undefined, sort: 'hot', size: 60 }),
    enabled: open && group === 'playlist',
    staleTime: 60_000,
  });
  const myPlaylistQuery = useQuery({
    queryKey: ['my-lists', 'playlist'],
    queryFn: () => getMyLists('playlist'),
    enabled: open && group === 'playlist' && isAuthenticated,
    staleTime: 60_000,
  });
  const followingQuery = useQuery({
    queryKey: ['section-catalog', 'topics', 'following'],
    queryFn: () => fetchTopics({ following: true, page: 1, size: 60 }).then((p) => p.list ?? []),
    enabled: open && group === 'following',
    staleTime: 60_000,
  });

  const candidates: { section: HomeSection; hint?: string }[] = useMemo(() => {
    const kw = q.trim();
    const hit = (s: string) => !kw || s.toLowerCase().includes(kw.toLowerCase());
    if (group === 'type') {
      const dict = typesQuery.data ?? [];
      const fromDict = dict.map((t) => {
        // 预置项优先(id 沿用旧 section 名,老链接和存量偏好还认得)
        const builtin = BUILTIN_TYPE_SECTIONS.find((b) => b.contentType === t.code);
        return builtin ?? makeTypeSection(t.code, t.name || TYPE_LABEL[t.code] || t.code);
      });
      // 字典表(module_content_type)只有 11 个大类,PICTURE / WALLPAPER / SHORT_DRAMA /
      // PERSON 这些确实有内容的类型不在里面,所以预置清单要并上来而不是被字典顶掉;
      // 反过来后台新加的类型也能自动出现。标签类预置项(游戏/美食/…)同样并进这一组。
      const merged = [...fromDict];
      for (const b of BUILTIN_TYPE_SECTIONS) {
        if (!merged.some((s) => s.id === b.id)) merged.push(b);
      }
      return merged.filter((s) => hit(s.label)).map((section) => ({ section }));
    }
    if (group === 'genre') {
      const groups = subcatQuery.data ?? {};
      const out: { section: HomeSection; hint?: string }[] = [];
      for (const [parent, items] of Object.entries(groups)) {
        const parentLabel = TYPE_LABEL[parent] || parent;
        for (const it of items ?? []) {
          if (!hit(it.name) && !hit(parentLabel)) continue;
          out.push({
            section: makeTypeSection(parent, parentLabel, it.code, it.name),
            hint: parentLabel,
          });
        }
      }
      return out;
    }
    if (group === 'tag' || group === 'source') {
      const src = group === 'source' ? tagsQuery.data?.sources : tagsQuery.data?.tags;
      return (src ?? [])
        .filter((t) => hit(t.name))
        .map((t) => ({ section: makeTagSection(t.name), hint: `${t.count} 条` }));
    }
    if (group === 'playlist') {
      // 自己的歌单排前面(最常加的就是它们),再接广场;同一张只出现一次。
      const mineLists = myPlaylistQuery.data?.list ?? [];
      const square = playlistQuery.data?.list ?? [];
      const seenList = new Set<string>();
      const out: { section: HomeSection; hint?: string }[] = [];
      for (const l of [...mineLists, ...square]) {
        const key = String(l.id);
        if (seenList.has(key) || !hit(l.name)) continue;
        seenList.add(key);
        out.push({
          section: makePlaylistSection(l.id, l.name),
          hint: l.official ? '官方' : l.mine ? `${l.itemCount} 首` : l.ownerName || `${l.itemCount} 首`,
        });
      }
      return out;
    }
    const topics = (group === 'topic' ? topicsQuery.data : followingQuery.data) ?? [];
    return topics
      .filter((t) => hit(t.title))
      .map((t) => ({
        section: makeTopicSection(t.id, t.title),
        hint: t.contentCount ? `${t.contentCount} 条` : t.auto ? '自动意境' : undefined,
      }));
  }, [group, q, typesQuery.data, subcatQuery.data, tagsQuery.data, topicsQuery.data, playlistQuery.data, myPlaylistQuery.data, followingQuery.data]);

  const loading =
    (group === 'type' && typesQuery.isLoading) ||
    (group === 'genre' && subcatQuery.isLoading) ||
    ((group === 'tag' || group === 'source') && tagsQuery.isLoading) ||
    (group === 'topic' && topicsQuery.isLoading) ||
    (group === 'playlist' && playlistQuery.isLoading) ||
    (group === 'following' && followingQuery.isLoading);

  const kw = q.trim();
  const customSection = kw ? makeKeywordSection(kw) : null;
  const canCreateCustom = !!customSection && !mineIds.has(customSection.id);

  const toggle = (section: HomeSection) => {
    if (mineIds.has(section.id)) api.remove(section.id);
    else api.add(section);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={isMobile}
      slotProps={{ paper: { sx: { bgcolor: 'background.paper', backgroundImage: 'none' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 2, pb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 800 }}>频道管理</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            拖动排序 · 点 × 移除 · 从下面任选加进来(改动立即生效)
          </Typography>
        </Box>
        <Button variant="text" size="small" sx={{ fontSize: 12 }} onClick={() => api.reset()}>
          恢复默认
        </Button>
        <IconButton size="small" onClick={onClose} aria-label="关闭">
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* 我的频道 */}
      <Box sx={{ px: 2, pb: 1.5 }}>
        <GroupTitle title="我的频道" extra={`${sections.length} 个`} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          <Tooltip title="推荐流固定在第一位,不能移除">
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1.25,
                py: 0.6,
                borderRadius: 1.5,
                fontSize: 13,
                fontWeight: 700,
                color: 'primary.main',
                bgcolor: 'action.selected',
                border: '1px solid',
                borderColor: 'primary.main',
              }}
            >
              <LockRoundedIcon sx={{ fontSize: 13 }} />
              {RECOMMEND_SECTION.label}
            </Box>
          </Tooltip>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={mine.map((s) => s.id)} strategy={rectSortingStrategy}>
              {mine.map((s) => (
                <SortableChip key={s.id} section={s} onRemove={() => api.remove(s.id)} />
              ))}
            </SortableContext>
          </DndContext>
        </Box>
        {mine.length === 0 && (
          <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 1 }}>
            只剩推荐流了 —— 从下面挑几个频道加回来。
          </Typography>
        )}
      </Box>

      {/* 更多频道 */}
      <Box sx={{ px: 2, pb: 2, minHeight: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>
        <GroupTitle title="更多频道" />
        <TextField
          size="small"
          fullWidth
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜频道 / 标签 / 意境,或直接输入自己想看的词"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ fontSize: 16 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ mb: 1, '& .MuiInputBase-input': { fontSize: 13 } }}
        />
        {canCreateCustom && (
          <Button
            size="small"
            variant="text"
            startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => {
              api.add(customSection!);
              setQ('');
            }}
            sx={{ alignSelf: 'flex-start', fontSize: 12, mb: 0.5 }}
          >
            建一个「{kw}」频道(按标题和标签取内容)
          </Button>
        )}
        <Tabs
          value={group}
          onChange={(_, v) => setGroup(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: 36,
            mb: 1,
            '& .MuiTab-root': { minHeight: 36, fontSize: 12.5, textTransform: 'none', px: 1.5, py: 0 },
          }}
        >
          {GROUP_TABS.map((t) => (
            <Tab key={t.key} value={t.key} label={t.label} />
          ))}
        </Tabs>
        <Box sx={{ flex: 1, minHeight: 120, maxHeight: { xs: 'none', sm: 260 }, overflowY: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" width={72} height={30} />
              ))}
            </Box>
          ) : candidates.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: 'text.disabled', py: 2 }}>
              {group === 'following'
                ? '还没关注意境 —— 在「意境」页关注几个,这里就能直接加成频道。'
                : group === 'playlist'
                  ? '还没有可选的歌单 —— 去音乐频道建一张,或等平台编排好的歌单刷新出来。'
                : group === 'source'
                  ? '还没聚合出来源(内容的来源标记为空)。'
                : kw
                  ? '没搜到现成的,可以用上面的按钮建一个自己的词。'
                  : '暂时没有可选项。'}
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {candidates.map(({ section, hint }) => {
                const added = mineIds.has(section.id);
                return (
                  <Box
                    key={section.id}
                    onClick={() => toggle(section)}
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.4,
                      px: 1.25,
                      py: 0.6,
                      borderRadius: 1.5,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      color: added ? 'text.disabled' : 'text.primary',
                      bgcolor: added ? 'action.hover' : 'transparent',
                      border: '1px solid',
                      borderColor: added ? 'transparent' : 'divider',
                      transition: 'all .15s',
                      '&:hover': { borderColor: 'primary.main' },
                    }}
                  >
                    {added ? <CheckRoundedIcon sx={{ fontSize: 13 }} /> : <AddRoundedIcon sx={{ fontSize: 13 }} />}
                    {section.label}
                    {hint && (
                      <Typography component="span" sx={{ fontSize: 10, color: 'text.disabled', ml: 0.25 }}>
                        {hint}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}

function GroupTitle({ title, extra }: { title: string; extra?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', letterSpacing: 0.5 }}>
        {title}
      </Typography>
      {extra && <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{extra}</Typography>}
    </Box>
  );
}

/** 「我的频道」里的一格:整块可拖,右侧 × 移除。 */
function SortableChip({ section, onRemove }: { section: HomeSection; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        pl: 0.5,
        pr: 0.25,
        py: 0.6,
        borderRadius: 1.5,
        fontSize: 13,
        cursor: 'grab',
        touchAction: 'none',
        opacity: isDragging ? 0.5 : 1,
        bgcolor: 'action.hover',
        border: '1px solid',
        borderColor: 'divider',
        '&:hover .section-chip-x': { opacity: 1 },
      }}
    >
      <DragIndicatorRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
      {section.label}
      <IconButton
        className="section-chip-x"
        size="small"
        aria-label={`移除 ${section.label}`}
        // 拖拽监听挂在外层,按钮要自己吃掉 pointerdown,否则点 × 会被当成拖起来
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        sx={{ p: 0.25, opacity: { xs: 1, sm: 0.5 }, transition: 'opacity .15s' }}
      >
        <CloseRoundedIcon sx={{ fontSize: 13 }} />
      </IconButton>
    </Box>
  );
}
