'use client';

import React from 'react';
import { formatCount as formatViews, formatDurationLabelLong as formatDuration } from '@/lib/utils/format';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FolderIcon from '@mui/icons-material/Folder';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { ACCENT } from '@/constants/accents';
import { ListLayout, LIST_ROW } from '@/components/common/ListLayout';
import { CoverImage } from '@/components/common/CoverImage';
import { PlayTag } from '@/components/common/PlayTag';
import { VISIBILITY_BADGE, formatRelativeTime, privacyActionOf, type MyCollectionGroup, type MyItem } from './myHomeModel';

// ─── 子组件:作品网格 ───
export const WorkGridView = React.memo(function WorkGridView({
  list, batchMode, selected, onToggle, onClick, onTogglePrivate, showPrivacy,
}: {
  list: MyItem[]; batchMode: boolean; selected: Set<number>; onToggle: (id: number) => void;
  onClick: (it: MyItem) => void; onTogglePrivate: (it: MyItem) => void; showPrivacy: boolean;
}) {
  return (
    <ListLayout minColumnWidth={160} minColumns={2} gap={12}>
      {list.map((it) => {
        const isSelected = selected.has(it.id);
        const badge = it.visibility && it.visibility !== 'public' ? VISIBILITY_BADGE[it.visibility] : null;
        const privacyAction = privacyActionOf(it);
        return (
          <Box
            key={it.id}
            onClick={() => batchMode ? onToggle(it.id) : onClick(it)}
            sx={{
              [LIST_ROW]: { display: 'flex', alignItems: 'stretch' },
              position: 'relative',
              borderRadius: 1.5,
              overflow: 'hidden',
              cursor: 'pointer',
              bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
              border: '1px solid',
              borderColor: isSelected ? 'primary.main' : 'var(--border-color, transparent)',
              transition: 'all 0.2s',
              '&:hover': { transform: 'translateY(-2px)', borderColor: isSelected ? 'primary.main' : 'var(--border-strong, transparent)' },
            }}
          >
            {batchMode && (
              <Box sx={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}>
                <Checkbox
                  size="small"
                  checked={isSelected}
                  onClick={(e) => { e.stopPropagation(); onToggle(it.id); }}
                  sx={{ color: 'rgba(255,255,255,0.85)', p: 0.25, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 1 }}
                />
              </Box>
            )}
            <Box sx={{ position: 'relative', aspectRatio: '3/4', [LIST_ROW]: { width: { xs: 72, sm: 96 }, flexShrink: 0 } }}>
              <CoverImage src={it.cover} alt={it.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7) 100%)' }} />
              {it.durationSec > 0 && (
                <Box sx={{ position: 'absolute', bottom: 6, right: 6, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.65)', fontSize: 9, color: '#fff', fontFamily: 'monospace' }}>
                  {formatDuration(it.durationSec)}
                </Box>
              )}
              {badge && (
                <Box sx={{ position: 'absolute', top: 6, left: 6, px: 0.75, py: 0.25, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}>
                  <Typography sx={{ fontSize: 9, color: badge.color, fontWeight: 700 }}>{badge.label}</Typography>
                </Box>
              )}
              {/* 右上角批量模式下让给勾选框 */}
              {!batchMode && (
                <PlayTag variant="overlay" id={it.id} contentType={it.contentType} top={6} right={6} sx={{ maxWidth: 'calc(100% - 12px)' }} />
              )}
            </Box>
            <Box sx={{ p: 1.25, [LIST_ROW]: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', mb: 0.5, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {it.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', color: 'text.secondary', fontSize: 10 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <PlayArrowRoundedIcon sx={{ fontSize: 11 }} />
                  {formatViews(it.views)}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <FavoriteRoundedIcon sx={{ fontSize: 10 }} />
                  {it.likes}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 10 }} />
                  {it.comments}
                </Box>
              </Box>
              {showPrivacy && privacyAction && !batchMode && (
                <Box
                  onClick={(e) => { e.stopPropagation(); onTogglePrivate(it); }}
                  sx={{ mt: 0.5, fontSize: 10, color: 'text.muted', cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                >
                  {privacyAction === 'hide' ? '设为私密' : '取消私密'}
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
    </ListLayout>
  );
});

// ─── 子组件:合集网格 ───
export const CollectionGridView = React.memo(function CollectionGridView({ list, batchMode, selected, onToggle, onOpen }: { list: MyCollectionGroup[]; batchMode: boolean; selected: Set<number>; onToggle: (id: number) => void; onOpen?: (g: MyCollectionGroup) => void }) {
  return (
    <ListLayout rows minColumnWidth={260} gap={12}>
      {list.map((g) => {
        const isSelected = selected.has(g.id);
        return (
          <Box
            key={g.id}
            onClick={() => (batchMode ? onToggle(g.id) : onOpen?.(g))}
            sx={{
              position: 'relative',
              p: 1.25,
              borderRadius: 2,
              cursor: 'pointer',
              bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
              border: '1px solid',
              borderColor: isSelected ? 'primary.main' : 'var(--border-color, transparent)',
              display: 'flex',
              gap: 1.25,
              alignItems: 'center',
              transition: 'all 0.15s',
              '&:hover': { borderColor: isSelected ? 'primary.main' : 'var(--border-strong, transparent)' },
            }}
          >
            {batchMode && (
              <Checkbox size="small" checked={isSelected} onClick={(e) => { e.stopPropagation(); onToggle(g.id); }} sx={{ p: 0 }} />
            )}
            <Box sx={{ width: 56, height: 56, borderRadius: 1.5, overflow: 'hidden', flexShrink: 0 }}>
              <CoverImage src={g.cover} alt={g.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mb: 0.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {g.title}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {g.count} 个内容 · {formatRelativeTime(g.updatedAt)}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </ListLayout>
  );
});

// ─── 子组件:历史时间线 ───
export const HistoryListView = React.memo(function HistoryListView({ list, batchMode, selected, onToggle, onClick }: { list: MyItem[]; batchMode: boolean; selected: Set<number>; onToggle: (id: number) => void; onClick: (it: MyItem) => void }) {
  return (
    <ListLayout rows minColumnWidth={420} gap={8}>
      {list.map((it) => {
        const isSelected = selected.has(it.id);
        return (
          <Box
            key={it.id}
            onClick={() => batchMode ? onToggle(it.id) : onClick(it)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.25,
              borderRadius: 1.5,
              cursor: 'pointer',
              bgcolor: isSelected ? 'rgba(254,44,85,0.08)' : 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
              border: '1px solid',
              borderColor: isSelected ? 'primary.main' : 'var(--border-color, transparent)',
              transition: 'all 0.15s',
              '&:hover': { borderColor: isSelected ? 'primary.main' : 'var(--border-strong, transparent)' },
            }}
          >
            {batchMode && (
              <Checkbox size="small" checked={isSelected} onClick={(e) => { e.stopPropagation(); onToggle(it.id); }} sx={{ p: 0 }} />
            )}
            <Box sx={{ width: 80, height: 50, borderRadius: 1, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
              <CoverImage src={it.cover} alt={it.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <Box sx={{ position: 'absolute', right: 3, bottom: 3, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.7)', fontSize: 9, color: '#fff', fontFamily: 'monospace' }}>
                {formatDuration(it.durationSec)}
              </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', mb: 0.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {it.title}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                看到 {formatDuration(Math.floor(it.durationSec * 0.6))} · {formatViews(it.views)} 播放 · {formatRelativeTime(it.postedAt)}
              </Typography>
            </Box>
            <PlayTag id={it.id} contentType={it.contentType} sx={{ flexShrink: 0 }} />
            <VisibilityRoundedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          </Box>
        );
      })}
    </ListLayout>
  );
});

// ─── 子组件:稍后看网格 ───
export const LaterGridView = React.memo(function LaterGridView({ list, batchMode, selected, onToggle, onClick }: { list: MyItem[]; batchMode: boolean; selected: Set<number>; onToggle: (id: number) => void; onClick: (it: MyItem) => void }) {
  return (
    <ListLayout minColumnWidth={200} gap={12}>
      {list.map((it) => {
        const isSelected = selected.has(it.id);
        return (
          <Box
            key={it.id}
            onClick={() => batchMode ? onToggle(it.id) : onClick(it)}
            sx={{
              [LIST_ROW]: { display: 'flex', alignItems: 'stretch' },
              position: 'relative',
              borderRadius: 1.5,
              overflow: 'hidden',
              cursor: 'pointer',
              bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
              border: '1px solid',
              borderColor: isSelected ? 'primary.main' : 'var(--border-color, transparent)',
              transition: 'all 0.15s',
              '&:hover': { borderColor: isSelected ? 'primary.main' : 'var(--border-strong, transparent)' },
            }}
          >
            {batchMode && (
              <Box sx={{ position: 'absolute', top: 6, left: 6, zIndex: 2 }}>
                <Checkbox size="small" checked={isSelected} onClick={(e) => { e.stopPropagation(); onToggle(it.id); }} sx={{ p: 0.25, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 1 }} />
              </Box>
            )}
            <Box sx={{ position: 'relative', aspectRatio: '16/9', [LIST_ROW]: { width: { xs: 120, sm: 200 }, flexShrink: 0 } }}>
              <CoverImage src={it.cover} alt={it.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.5) 100%)' }} />
              <Box sx={{ position: 'absolute', top: 6, right: 6, px: 0.5, py: 0.25, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.6)' }}>
                <Typography sx={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>已添加 {formatRelativeTime(it.postedAt)}</Typography>
              </Box>
              {/* 右上是添加时间、左上是批量勾选框,能不能播放左下 */}
              <PlayTag variant="overlay" id={it.id} contentType={it.contentType} top="auto" left={6} bottom={6} sx={{ maxWidth: 'calc(100% - 12px)' }} />
            </Box>
            <Box sx={{ p: 1.25, [LIST_ROW]: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', mb: 0.5, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {it.title}
              </Typography>
              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                {formatDuration(it.durationSec)} · {formatViews(it.views)} 播放
              </Typography>
            </Box>
          </Box>
        );
      })}
    </ListLayout>
  );
});

// ─── 子组件:预约直播 ───
export const AppointmentListView = React.memo(function AppointmentListView({ list, onClick, onCancel }: { list: MyItem[]; onClick: (it: MyItem) => void; onCancel: (it: MyItem) => void }) {
  return (
    <ListLayout rows minColumnWidth={420} gap={8}>
      {list.map((it) => (
        <Box
          key={it.id}
          onClick={() => onClick(it)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            cursor: 'pointer',
            bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
            border: '1px solid var(--border-color, transparent)',
            transition: 'all 0.15s',
            '&:hover': { borderColor: 'var(--border-strong, transparent)' },
          }}
        >
          <Box sx={{ width: 72, height: 72, borderRadius: 1.5, overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
            <CoverImage src={it.cover} alt={it.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <Box sx={{ position: 'absolute', top: 4, left: 4, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'primary.main' }}>
              <Typography sx={{ fontSize: 8, color: '#fff', fontWeight: 800 }}>预约</Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary', mb: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {it.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, fontSize: 11, color: 'text.secondary', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <EventNoteRoundedIcon sx={{ fontSize: 11 }} />
                等待开播 · 开播后站内通知
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <VisibilityRoundedIcon sx={{ fontSize: 11 }} />
                {formatViews(it.views)} 预约
              </Box>
            </Box>
          </Box>
          <Button
            size="small"
            variant="outlined"
            onClick={(e) => { e.stopPropagation(); onCancel(it); }}
            sx={{ textTransform: 'none', fontSize: 11, borderRadius: 1.5, borderColor: 'divider', color: 'text.secondary', minWidth: 64 }}
          >
            取消预约
          </Button>
        </Box>
      ))}
    </ListLayout>
  );
});

// ─── 子组件:AI 笔记 ───
export const AINoteListView = React.memo(function AINoteListView({ list, batchMode, selected, onToggle }: { list: MyItem[]; batchMode: boolean; selected: Set<number>; onToggle: (id: number) => void }) {
  return (
    <ListLayout rows minColumnWidth={320} gap={8} packing="masonry">
      {list.map((it) => {
        const isSelected = selected.has(it.id);
        return (
          <Box
            key={it.id}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.5,
              p: 1.5,
              borderRadius: 2,
              cursor: 'pointer',
              bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
              border: '1px solid',
              borderColor: isSelected ? 'primary.main' : 'var(--border-color, transparent)',
            }}
            onClick={() => batchMode && onToggle(it.id)}
          >
            {batchMode && (
              <Checkbox size="small" checked={isSelected} onClick={(e) => { e.stopPropagation(); onToggle(it.id); }} sx={{ p: 0, mt: -0.5 }} />
            )}
            <Box sx={{ width: 40, height: 40, borderRadius: 1.5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(254,44,85,0.2))' }}>
              <AutoAwesomeRoundedIcon sx={{ fontSize: 20, color: 'primary.main' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }} noWrap>
                  {it.title}
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'text.muted' }}>{formatRelativeTime(it.postedAt)}</Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {(it as any).summary || (it as any).aiSummary || '该内容暂无 AI 摘要'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75 }}>
                <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(139,92,246,0.15)', color: ACCENT.purple.main, fontSize: 10, fontWeight: 600 }}>
                  AI 摘要
                </Box>
                <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: 'action.hover', color: 'text.secondary', fontSize: 10 }}>
                  {(it as any).citeCount != null ? `${(it as any).citeCount} 条引用` : '暂无引用'}
                </Box>
              </Box>
            </Box>
          </Box>
        );
      })}
    </ListLayout>
  );
});

// ─── 子组件:空状态 ───
export function EmptyState({ tab, subTab, onPublish, filtered }: { tab: string; subTab: string; onPublish?: () => void; filtered?: boolean }) {
  const config: Record<string, { title: string; hint: string; cta?: string }> = {
    works: { title: subTab === 'private' ? '暂无未公开的作品' : subTab === 'draft' ? '暂无草稿' : '该账号还未发布过作品', hint: subTab === 'private' ? '设为私密、审核中、未过审的作品会出现在这里' : '点击下方按钮开始创作吧', cta: '发布作品' },
    recommend: { title: '暂无推荐内容', hint: '基于你的浏览历史为你推荐' },
    like: { title: '还没有点赞过内容', hint: '去发现页找点喜欢的吧' },
    collect: { title: '收藏夹是空的', hint: '看到喜欢的内容点个收藏吧' },
    history: { title: '观看历史为空', hint: '你浏览过的内容会按时间记录在这里' },
    later: { title: '稍后再看是空的', hint: '把想看的内容先存起来吧' },
    order: { title: '暂无预约', hint: '在直播间点击"预约开播"即可加入' },
    playlist: { title: '还没有歌单', hint: '在歌曲的收藏菜单里新建歌单,或去「歌单」页创建' },
    collection: { title: '还没有作品合集', hint: '把同一系列的作品收进一个合集,方便整段追下去' },
    bookshelf: { title: '书架是空的', hint: '在小说或漫画详情页点「加入书架」' },
    ai: { title: 'AI 笔记还没生成', hint: '当你看过足够多的内容,AI 会自动整理笔记' },
  };
  // 筛选筛空了和"本来就没有"是两件事:前者别劝人去发作品,提示改筛选条件才有用。
  const c: { title: string; hint: string; cta?: string } = filtered
    ? { title: '没有符合条件的内容', hint: '换个关键词或时间范围试试' }
    : config[tab] || config.works;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 88,
          height: 88,
          borderRadius: 2.5,
          bgcolor: 'var(--bg-hover, transparent)',
          border: '1px solid var(--border-color, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <FolderIcon sx={{ fontSize: 44, color: 'var(--text-disabled, currentColor)' }} />
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary, currentColor)', mt: 1 }}>
        {c.title}
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'var(--text-muted, currentColor)', textAlign: 'center' }}>
        {c.hint}
      </Typography>
      {c.cta && onPublish && (
        <Button variant="contained" size="small" onClick={onPublish} sx={{ mt: 1, textTransform: 'none', fontSize: 12, borderRadius: 1.5 }}>
          {c.cta}
        </Button>
      )}
    </Box>
  );
}
