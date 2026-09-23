'use client';

import React from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import FiberNewRoundedIcon from '@mui/icons-material/FiberNewRounded';
import ThumbUpAltRoundedIcon from '@mui/icons-material/ThumbUpAltRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';

import {
  fetchLeaderboard,
  fetchLeaderboardCatalog,
  SIGNAL_LABEL,
  type LeaderboardCategory,
  type LeaderboardEntry,
  type LeaderboardMetric,
  type LeaderboardPeriod,
} from '@/apis/leaderboard';
import { CoverImage } from '@/components/common/CoverImage';
import TrendingBoard from '@/components/home/TrendingBoard';
import { TYPE_LABEL, useContentNavigate } from '@/lib/contentRoute';
import { IMAGE_OVERLAY, MEDAL, SECTION_TINT } from '@/constants/gradients';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import {
  DeltaBadge,
  METRIC_GRADIENT,
  RankNumber,
  coverShape,
  formatBuiltAt,
  formatCount,
  metricStat,
} from './shared';

const PAGE_SIZE = 30;

const METRIC_ICON: Record<LeaderboardMetric, React.ReactNode> = {
  hot: <WhatshotRoundedIcon sx={{ fontSize: 16 }} />,
  rising: <TrendingUpRoundedIcon sx={{ fontSize: 16 }} />,
  new: <FiberNewRoundedIcon sx={{ fontSize: 16 }} />,
  praise: <ThumbUpAltRoundedIcon sx={{ fontSize: 16 }} />,
};

// 目录没回来之前的默认窗口,与后端 normalizePeriod 一致:分窗口的榜型默认日榜。
const DEFAULT_PERIOD: Partial<Record<LeaderboardMetric, LeaderboardPeriod>> = { hot: 'day', rising: 'day' };

/**
 * 排行榜主页面(首页左侧导航「排行榜」,/home/recommend?tab=rank)。
 *
 * 筛选状态全在 URL 上(type / cat / metric / period),任何一张榜都能直接分享、
 * 从侧栏小榜「查看完整榜单」一跳到位。所有筛选项来自后端目录,不写死。
 */
export function LeaderboardPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const navigate = useContentNavigate();

  const { data: catalog } = useQuery({
    queryKey: ['leaderboard', 'catalog'],
    queryFn: fetchLeaderboardCatalog,
    staleTime: 5 * 60_000,
  });

  // ── 从 URL 解析当前榜单;目录回来后把非法值落回合法值 ──
  const types = catalog?.types ?? [];
  const typeParam = (sp.get('type') || 'ALL').toUpperCase();
  const typeInfo = types.find((t) => t.code === typeParam);
  const type = catalog ? typeInfo?.code ?? 'ALL' : typeParam;

  const catParam = sp.get('cat') || '';
  const categories = typeInfo?.categories ?? [];
  const category = type === 'ALL' ? '' : catalog ? (categories.some((c) => c.key === catParam) ? catParam : '') : catParam;
  const categoryInfo = categories.find((c) => c.key === category);

  const metricParam = sp.get('metric') as LeaderboardMetric | null;
  const metricInfo = catalog?.metrics.find((m) => m.key === metricParam) ?? catalog?.metrics[0];
  const metric: LeaderboardMetric = metricInfo?.key ?? metricParam ?? 'hot';

  const periodParam = sp.get('period') as LeaderboardPeriod | null;
  const allowedPeriods = metricInfo ? metricInfo.periods : DEFAULT_PERIOD[metric] ? [DEFAULT_PERIOD[metric]!] : [];
  const period =
    allowedPeriods.length === 0
      ? undefined
      : periodParam && allowedPeriods.includes(periodParam)
        ? periodParam
        : allowedPeriods[0];
  const periodInfo = catalog?.periods.find((p) => p.key === period);

  const update = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(sp.toString());
    p.set('tab', 'rank');
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['leaderboard', 'board', type, category, metric, period],
    queryFn: ({ pageParam }) =>
      fetchLeaderboard({ type, category: category || undefined, metric, period, offset: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      if (!last) return undefined;
      const next = last.offset + last.list.length;
      return last.list.length > 0 && next < last.total ? next : undefined;
    },
    staleTime: 60_000,
  });

  const board = data?.pages[0] ?? null;
  const entries = (data?.pages ?? []).flatMap((p) => p?.list ?? []);
  const compared = !!board?.compared;
  const topScore = entries.reduce((m, e) => Math.max(m, e.score), 0);
  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);
  const open = (e: LeaderboardEntry) => navigate(e.contentType, e.id);

  // 滚动到底自动加载下一页,不再只靠「加载更多」按钮。
  // sentinel 挂在列表末尾;useInfiniteScroll 自己会向上找可滚动祖先(home 布局的 <main>)。
  const scroll = useInfiniteScroll({
    enabled: !isLoading && !!hasNextPage && !isFetchingNextPage,
  });
  React.useEffect(() => {
    if (scroll.isNearBottom && hasNextPage && !isFetchingNextPage && !isLoading) {
      fetchNextPage();
    }
  }, [scroll.isNearBottom, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  const titleParts = [
    typeInfo && type !== 'ALL' ? typeInfo.name : type === 'ALL' ? '全站' : '',
    categoryInfo?.name,
    metricInfo?.name ?? '热度榜',
  ].filter(Boolean);

  const dictAndTags = categories.filter((c) => c.kind !== 'source');
  const sources = categories.filter((c) => c.kind === 'source');

  return (
    <Box sx={{ display: 'flex', gap: 2.5, p: { xs: 1.5, md: 2.5 }, alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* ── 标题区 ── */}
        <Box
          sx={{
            borderRadius: 3,
            p: { xs: 2, md: 2.5 },
            mb: 2,
            background: SECTION_TINT.RED_YELLOW_PURPLE,
            border: '1px solid var(--border-color, transparent)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              background: MEDAL[1].badge,
              boxShadow: '0 6px 20px rgba(255, 180, 0, 0.35)',
              flexShrink: 0,
            }}
          >
            <EmojiEventsRoundedIcon sx={{ fontSize: 30, color: MEDAL[1].txt }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography component="h1" sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 800, lineHeight: 1.25 }}>
              {titleParts.join(' · ')}
              {period && periodInfo && (
                <Box component="span" sx={{ ml: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary, currentColor)' }}>
                  {periodInfo.name}
                </Box>
              )}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'var(--text-secondary, currentColor)', mt: 0.5 }}>
              {metricInfo?.desc ?? '按类型、分类实时生成的站内榜单'}
              {' · 每 10 分钟更新'}
              {board?.builtAt && ` · 更新于 ${formatBuiltAt(board.builtAt)}`}
              {board && ` · 共 ${board.total} 条`}
            </Typography>
          </Box>
          {!!board?.signals.length && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: 11, color: 'var(--text-muted, currentColor)' }}>排序依据</Typography>
              {board.signals.map((s) => (
                <Chip key={s} size="small" label={SIGNAL_LABEL[s] ?? s} sx={{ height: 22, fontSize: 11 }} />
              ))}
            </Box>
          )}
        </Box>

        {/* ── 类型 ── */}
        <Tabs
          value={types.some((t) => t.code === type) ? type : false}
          onChange={(_, v: string) => update({ type: v === 'ALL' ? undefined : v, cat: undefined })}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            minHeight: 40,
            mb: 1.25,
            borderBottom: '1px solid var(--border-color, transparent)',
            '& .MuiTab-root': { minHeight: 40, py: 0.5, px: 1.5, fontSize: 14, textTransform: 'none', minWidth: 0 },
            '& .Mui-selected': { fontWeight: 700 },
            '& .MuiTabs-indicator': { height: 3, borderRadius: 1.5 },
          }}
        >
          {types.map((t) => (
            <Tab
              key={t.code}
              value={t.code}
              label={
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                  {t.name}
                  <Box component="span" sx={{ fontSize: 10, color: 'var(--text-muted, currentColor)' }}>
                    {formatCount(t.count)}
                  </Box>
                </Box>
              }
            />
          ))}
        </Tabs>

        {/* ── 分类(字典 / 标签在前,来源平台在后) ── */}
        {categories.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              overflowX: 'auto',
              pb: 0.5,
              mb: 1.5,
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            }}
          >
            <CategoryChip label="全部" active={!category} onClick={() => update({ cat: undefined })} />
            {dictAndTags.map((c) => (
              <CategoryChip key={c.key} cat={c} active={category === c.key} onClick={() => update({ cat: c.key })} />
            ))}
            {sources.length > 0 && dictAndTags.length > 0 && <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />}
            {sources.map((c) => (
              <CategoryChip key={c.key} cat={c} active={category === c.key} onClick={() => update({ cat: c.key })} />
            ))}
          </Box>
        )}

        {/* ── 榜型 + 时间窗 ── */}
        {catalog && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Box
              role="tablist"
              sx={{
                display: 'flex',
                p: 0.5,
                gap: 0.5,
                borderRadius: 2,
                bgcolor: 'var(--bg-surface, transparent)',
                border: '1px solid var(--border-color, transparent)',
                overflowX: 'auto',
                maxWidth: '100%',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {catalog.metrics.map((m) => {
                const active = m.key === metric;
                return (
                  <Tooltip key={m.key} title={m.desc}>
                    <Box
                      component="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => update({ metric: m.key === 'hot' ? undefined : m.key, period: undefined })}
                      sx={{
                        all: 'unset',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 1.5,
                        fontSize: 13,
                        whiteSpace: 'nowrap',
                        fontWeight: active ? 700 : 500,
                        color: active ? '#fff' : 'var(--text-secondary, currentColor)',
                        background: active ? METRIC_GRADIENT[m.key] : 'transparent',
                        transition: 'background 0.15s, color 0.15s',
                        '&:hover': active ? {} : { bgcolor: 'var(--bg-hover, transparent)', color: 'var(--text-primary, currentColor)' },
                        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                      }}
                    >
                      {METRIC_ICON[m.key]}
                      {m.name}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
            {allowedPeriods.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, ml: { sm: 'auto' } }}>
                {allowedPeriods.map((p) => {
                  const info = catalog.periods.find((x) => x.key === p);
                  const active = p === period;
                  return (
                    <Chip
                      key={p}
                      size="small"
                      label={info?.name ?? p}
                      color={active ? 'primary' : 'default'}
                      variant={active ? 'filled' : 'outlined'}
                      onClick={() => update({ period: p === allowedPeriods[0] ? undefined : p })}
                      sx={{ fontSize: 12 }}
                    />
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* ── 口径说明:如实告诉用户这张榜是怎么排的 ── */}
        {board && metric === 'rising' && board.basis === 'fresh' && (
          <Notice>
            暂无上期排名快照,先按{periodInfo?.name ?? '本期'}内新上榜内容的热度排列;快照积累满一期后显示真实升降。
          </Notice>
        )}
        {board && (metric === 'hot' || metric === 'rising') && entries.length > 0 && board.signals.length === 0 && (
          <Notice>这一类内容暂时没有可用的热度信号,按入库时间排列。</Notice>
        )}
        {board && compared && periodInfo && (metric === 'hot' || metric === 'rising') && (
          <Typography sx={{ fontSize: 11, color: 'var(--text-muted, currentColor)', mb: 1 }}>
            名次变化{periodInfo.compare}
          </Typography>
        )}

        {/* ── 榜单 ── */}
        {isLoading ? (
          <BoardSkeleton />
        ) : entries.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center', color: 'var(--text-muted, currentColor)' }}>
            <EmojiEventsRoundedIcon sx={{ fontSize: 40, opacity: 0.4, mb: 1 }} />
            <Typography sx={{ fontSize: 13 }}>
              {metric === 'praise' ? '这一类内容还没有评分或点赞收藏,口碑榜暂时空缺' : '这张榜暂时没有内容'}
            </Typography>
          </Box>
        ) : (
          <>
            <Podium entries={podium} metric={metric} compared={compared} onOpen={open} />
            {rest.length > 0 && (
              <Box
                sx={{
                  borderRadius: 3,
                  bgcolor: 'var(--bg-surface, transparent)',
                  border: '1px solid var(--border-color, transparent)',
                  py: 0.5,
                }}
              >
                {rest.map((e) => (
                  <EntryRow
                    key={`${e.id}-${e.rank}`}
                    entry={e}
                    metric={metric}
                    compared={compared}
                    topScore={topScore}
                    showType={type === 'ALL'}
                    onOpen={open}
                  />
                ))}
              </Box>
            )}
            {hasNextPage && (
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Button variant="outlined" size="small" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? '加载中…' : '加载更多'}
                </Button>
              </Box>
            )}
            {/* 滚动到底的哨兵:进入视口即由上面的 effect 触发 fetchNextPage */}
            <Box ref={scroll.sentinelRef} sx={{ height: '1px' }} />
          </>
        )}
      </Box>

      {/* 全网热榜:跨平台热度(internal/trending),和站内榜互为参照。 */}
      <Box
        component="aside"
        sx={{ width: 320, flexShrink: 0, display: { xs: 'none', xl: 'block' }, position: 'sticky', top: 16 }}
      >
        <TrendingBoard title="全网热榜" defaultPeriod="day" maxItems={15} />
      </Box>
    </Box>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.75,
        px: 1.5,
        py: 1,
        mb: 1.5,
        borderRadius: 2,
        fontSize: 12,
        color: 'var(--text-secondary, currentColor)',
        bgcolor: 'var(--bg-surface, transparent)',
        border: '1px dashed var(--border-color, transparent)',
      }}
    >
      <InfoOutlinedIcon sx={{ fontSize: 16, mt: '1px', color: 'info.main' }} />
      <span>{children}</span>
    </Box>
  );
}

function CategoryChip({
  cat,
  label,
  active,
  onClick,
}: {
  cat?: LeaderboardCategory;
  label?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Chip
      size="small"
      onClick={onClick}
      icon={cat?.kind === 'source' ? <StorefrontRoundedIcon sx={{ fontSize: '14px !important' }} /> : undefined}
      label={
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.5 }}>
          {cat?.name ?? label}
          {cat && (
            <Box component="span" sx={{ fontSize: 10, opacity: 0.7 }}>
              {cat.count}
            </Box>
          )}
        </Box>
      }
      color={active ? 'primary' : 'default'}
      variant={active ? 'filled' : 'outlined'}
      sx={{ flexShrink: 0, height: 28, fontSize: 12, borderRadius: 2 }}
    />
  );
}

function metaLine(e: LeaderboardEntry, showType: boolean): string {
  return [
    e.author,
    showType ? TYPE_LABEL[e.contentType] : '',
    e.source,
    e.trendingRank ? `全网榜 #${e.trendingRank}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function Podium({
  entries,
  metric,
  compared,
  onOpen,
}: {
  entries: LeaderboardEntry[];
  metric: LeaderboardMetric;
  compared: boolean;
  onOpen: (e: LeaderboardEntry) => void;
}) {
  // 宽屏按 2-1-3 摆成领奖台,窄屏按名次竖排。
  const smOrder: Record<number, number> = { 1: 2, 2: 1, 3: 3 };
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: `repeat(${entries.length}, minmax(0, 1fr))` },
        gap: 1.5,
        alignItems: 'end',
        mb: 2,
        pt: { sm: 1.5 },
      }}
    >
      {entries.map((e) => {
        const medal = MEDAL[e.rank] ?? MEDAL[3];
        const first = e.rank === 1;
        return (
          <Box
            key={e.id}
            onClick={() => onOpen(e)}
            sx={{
              order: { xs: e.rank, sm: smOrder[e.rank] ?? e.rank },
              cursor: 'pointer',
              borderRadius: 3,
              p: 1.25,
              background: medal.bg,
              border: `1px solid ${medal.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              minWidth: 0,
              transform: { sm: first ? 'translateY(-10px)' : 'none' },
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { boxShadow: `0 8px 24px ${medal.border}` },
            }}
          >
            <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', height: { xs: 150, sm: first ? 200 : 170 } }}>
              <CoverImage src={e.cover} alt={e.title} sx={{ width: '100%', height: '100%' }} />
              <Box sx={{ position: 'absolute', inset: 0, background: IMAGE_OVERLAY.MID }} />
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  width: first ? 38 : 32,
                  height: first ? 38 : 32,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  background: medal.badge,
                  color: medal.txt,
                  fontWeight: 900,
                  fontSize: first ? 18 : 15,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                }}
              >
                {e.rank}
              </Box>
              <Box sx={{ position: 'absolute', top: 10, right: 8 }}>
                <DeltaBadge entry={e} compared={compared} solid />
              </Box>
              <Typography
                sx={{ position: 'absolute', bottom: 8, left: 10, right: 10, color: '#fff', fontSize: 12, fontWeight: 700 }}
                noWrap
              >
                {metricStat(e, metric)}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: first ? 15 : 14,
                fontWeight: 700,
                lineHeight: 1.35,
                minHeight: '2.7em',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                color: 'var(--text-primary, currentColor)',
              }}
            >
              {e.title}
            </Typography>
            <Typography noWrap sx={{ fontSize: 11, color: 'var(--text-muted, currentColor)' }}>
              {[e.labels?.slice(0, 2).join(' / '), metaLine(e, false)].filter(Boolean).join(' · ') || ' '}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function EntryRow({
  entry: e,
  metric,
  compared,
  topScore,
  showType,
  onOpen,
}: {
  entry: LeaderboardEntry;
  metric: LeaderboardMetric;
  compared: boolean;
  topScore: number;
  showType: boolean;
  onOpen: (e: LeaderboardEntry) => void;
}) {
  const shape = coverShape(e.contentType);
  const meta = metaLine(e, showType);
  return (
    <Box
      onClick={() => onOpen(e)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 1,
        mx: 0.5,
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'background 0.15s',
        '&:hover': { bgcolor: 'var(--bg-hover, transparent)' },
      }}
    >
      <Box sx={{ width: 36, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
        <RankNumber rank={e.rank} />
        <DeltaBadge entry={e} compared={compared} />
      </Box>
      <CoverImage src={e.cover} alt="" sx={{ width: shape.w, height: shape.h, borderRadius: 1.5, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, currentColor)' }}>
          {e.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, minWidth: 0 }}>
          {e.labels?.slice(0, 2).map((l) => (
            <Box
              key={l}
              component="span"
              sx={{
                px: 0.75,
                borderRadius: 1,
                fontSize: 10,
                lineHeight: '18px',
                flexShrink: 0,
                color: 'var(--text-secondary, currentColor)',
                bgcolor: 'var(--bg-hover, rgba(127,127,127,0.12))',
              }}
            >
              {l}
            </Box>
          ))}
          <Typography noWrap sx={{ fontSize: 11, color: 'var(--text-muted, currentColor)', minWidth: 0 }}>
            {meta}
          </Typography>
        </Box>
      </Box>
      {metric === 'new' ? (
        <Typography sx={{ fontSize: 11, color: 'var(--text-muted, currentColor)', flexShrink: 0 }}>
          {metricStat(e, metric)}
        </Typography>
      ) : (
        <Box sx={{ width: { xs: 64, sm: 120 }, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
          <Typography noWrap sx={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, currentColor)' }}>
            {metricStat(e, metric)}
          </Typography>
          {topScore > 0 && (
            <Box sx={{ width: '100%', height: 4, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
              <Box
                sx={{
                  width: `${Math.max(4, (e.score / topScore) * 100)}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: METRIC_GRADIENT[metric],
                }}
              />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

function BoardSkeleton() {
  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mb: 2 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={260} sx={{ bgcolor: 'action.hover', borderRadius: 3 }} />
        ))}
      </Box>
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={60} sx={{ bgcolor: 'action.hover', borderRadius: 2, mb: 0.75 }} />
      ))}
    </>
  );
}
