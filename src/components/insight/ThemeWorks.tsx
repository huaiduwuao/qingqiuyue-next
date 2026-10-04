'use client';

// 主题页与分支页共用的作品区:分类型预览 + 分页、从古至今时间线、可用性筛选。
// 传进来的 key 可以是编辑主题,也可以是自动分支(后端把分支当合成主题,同一套接口)。

import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Pagination from '@mui/material/Pagination';
import Skeleton from '@mui/material/Skeleton';
import { EmptyState } from '@/components/common/AsyncState';
import {
  theme as fetchTheme,
  timeline as fetchTimeline,
  items as fetchItems,
  type InsightAvail,
  type InsightItem,
  type InsightSection,
  type InsightTheme,
} from '@/apis/insight';
import { AVAIL_META, InsightCard } from '@/components/insight/InsightCards';
import { TYPE_LABEL } from '@/lib/contentRoute';
import { workClickCapture } from '@/lib/topicTrack';
import { layerOf } from '@/apis/mind';
import { layerMeta, useMindMe } from '@/components/insight/mindHooks';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';
const PAGE_SIZE = 24;

export const typeName = (t: string) => (t === 'POETRY' ? '诗词' : TYPE_LABEL[t] || t);

/** 筛选后为空时的说法:要说清楚是「站内暂时没有」,不是「没有相关作品」。 */
export const emptyText = (avail: InsightAvail) =>
  avail === 'play'
    ? '这里暂时没有本站能直接播放的作品'
    : avail === 'read'
      ? '这里暂时没有站内能直接看的作品'
      : '这里还没有收录到相关作品';

/** 诗词两列文字卡,其余作品封面网格。 */
export function ItemGrid({
  list,
  accent,
  showType,
  compact,
}: {
  list: InsightItem[];
  accent: string;
  showType?: boolean;
  /** 预览行:手机上诗词只露 4 首,否则一栏要划很久才到电影 */
  compact?: boolean;
}) {
  const verses = list.filter((i) => i.contentType === 'POETRY');
  const works = list.filter((i) => i.contentType !== 'POETRY');
  return (
    <>
      {verses.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
            gap: 1.5,
            mb: works.length ? 2 : 0,
            ...(compact && { '& > :nth-of-type(n+5)': { display: { xs: 'none', sm: 'block' } } }),
          }}
        >
          {verses.map((it) => (
            <InsightCard key={String(it.id)} item={it} accent={accent} />
          ))}
        </Box>
      )}
      {works.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(3, minmax(0, 1fr))',
              sm: 'repeat(4, minmax(0, 1fr))',
              md: 'repeat(6, minmax(0, 1fr))',
              lg: 'repeat(8, minmax(0, 1fr))',
            },
            gap: 1.5,
          }}
        >
          {works.map((it) => (
            <InsightCard key={String(it.id)} item={it} accent={accent} showType={showType} />
          ))}
        </Box>
      )}
    </>
  );
}

export function SectionRow({ s, accent, onMore }: { s: InsightSection; accent: string; onMore: () => void }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 600 }}>
          {typeName(s.contentType)}
          <Typography component="span" sx={{ fontSize: 12, color: 'text.disabled', ml: 1 }}>
            {s.total.toLocaleString()}
          </Typography>
        </Typography>
        {s.total > s.items.length && (
          <Typography onClick={onMore} sx={{ fontSize: 12, color: accent, cursor: 'pointer' }}>
            查看全部 →
          </Typography>
        )}
      </Box>
      <ItemGrid list={s.items} accent={accent} compact />
    </Box>
  );
}

/** 分页列表:按类型,或按时间线的一段。 */
export function PagedList({
  themeKey,
  type,
  era,
  avail,
  accent,
}: {
  themeKey: string;
  type?: string;
  era?: string;
  avail: InsightAvail;
  accent: string;
}) {
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [type, era, avail]);
  const q = useQuery({
    queryKey: ['insight', 'items', themeKey, type || '', era || '', avail, page],
    queryFn: () => fetchItems({ key: themeKey, type, era, avail: avail || undefined, page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const total = q.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (q.isLoading) return <Skeleton variant="rounded" height={320} />;
  if (!total) return <EmptyState text={emptyText(avail)} />;
  return (
    <>
      <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 1.5 }}>共 {total.toLocaleString()} 部</Typography>
      <ItemGrid list={q.data?.list ?? []} accent={accent} showType={!type} />
      {pageCount > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={pageCount}
            page={page}
            size="small"
            onChange={(_, p) => {
              setPage(p);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </Box>
      )}
    </>
  );
}

export function WorksTab({ t, avail, accent }: { t: InsightTheme; avail: InsightAvail; accent: string }) {
  const [type, setType] = React.useState('');
  const q = useQuery({
    queryKey: ['insight', 'theme', t.key, avail],
    queryFn: () => fetchTheme(t.key, avail),
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  });
  const sections = q.data?.sections ?? [];
  if (q.isLoading) return <Skeleton variant="rounded" height={420} />;
  if (!sections.length) return <EmptyState text={emptyText(avail)} />;
  return (
    // 点开作品时记「在这个节点里点了哪部」,节点下的作品按它重排(lib/topicTrack)
    <Box onClickCapture={workClickCapture(t.key)}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
        <Chip
          size="small"
          label="全部"
          color={type === '' ? 'primary' : 'default'}
          variant={type === '' ? 'filled' : 'outlined'}
          onClick={() => setType('')}
        />
        {sections.map((s) => (
          <Chip
            key={s.contentType}
            size="small"
            label={`${typeName(s.contentType)} ${s.total.toLocaleString()}`}
            color={type === s.contentType ? 'primary' : 'default'}
            variant={type === s.contentType ? 'filled' : 'outlined'}
            onClick={() => setType(type === s.contentType ? '' : s.contentType)}
          />
        ))}
      </Box>
      {type ? (
        <PagedList themeKey={t.key} type={type} avail={avail} accent={accent} />
      ) : (
        <LayeredSections
          sections={sections}
          accent={accent}
          onMore={(ct) => {
            setType(ct);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </Box>
  );
}

/**
 * 按内容层分组的分栏:一层照见(歌、短片、短剧)→ 二层体味(影视、书、文章)→ 三层参悟(诗词)。
 * 心境境界以内的层展开;更深的层只露一行,点「往深一层」展开 —— 软引导,不锁(后端 mind.go)。
 */
function LayeredSections({
  sections,
  accent,
  onMore,
}: {
  sections: InsightSection[];
  accent: string;
  onMore: (contentType: string) => void;
}) {
  const m = useMindMe().data;
  const stageLayer = m?.stage.layer ?? 1;
  const [opened, setOpened] = React.useState<Record<number, boolean>>({});
  const layers = [1, 2, 3]
    .map((l) => ({ l, secs: sections.filter((s) => (s.layer ?? layerOf(s.contentType)) === l) }))
    .filter((x) => x.secs.length > 0);
  return (
    <>
      {layers.map(({ l, secs }) => {
        const meta = layerMeta(m, l);
        const open = l <= stageLayer || opened[l];
        return (
          <Box key={l} sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mb: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontFamily: SERIF, fontSize: 19, fontWeight: 700, color: accent, letterSpacing: '0.1em' }}>
                {['一', '二', '三'][l - 1]}层 · {meta.name}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{meta.hint}</Typography>
            </Box>
            {open ? (
              secs.map((s) => <SectionRow key={s.contentType} s={s} accent={accent} onMore={() => onMore(s.contentType)} />)
            ) : (
              <Box sx={{ position: 'relative', mb: 4 }}>
                {/* 只露一行:让人知道下面还有,不挡着 */}
                <Box sx={{ maxHeight: 132, overflow: 'hidden', opacity: 0.55, pointerEvents: 'none' }}>
                  <ItemGrid list={secs[0].items.slice(0, 8)} accent={accent} compact />
                </Box>
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    pb: 1,
                    background: (th) => `linear-gradient(180deg, transparent 0%, ${th.palette.background.default} 85%)`,
                  }}
                >
                  <Typography
                    onClick={() => setOpened((o) => ({ ...o, [l]: true }))}
                    sx={{ fontSize: 14, fontWeight: 600, color: accent, cursor: 'pointer' }}
                  >
                    往深一层 · {secs.map((s) => `${typeName(s.contentType)} ${s.total.toLocaleString()}`).join(' · ')} ›
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.25 }}>
                    心境到了「{m?.stages?.find((x) => x.layer === l)?.name ?? '下一境'}」会默认展开
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        );
      })}
    </>
  );
}

export function TimelineTab({ t, avail, accent }: { t: InsightTheme; avail: InsightAvail; accent: string }) {
  const [era, setEra] = React.useState('');
  const q = useQuery({
    queryKey: ['insight', 'timeline', t.key, avail],
    queryFn: () => fetchTimeline(t.key, avail),
    staleTime: 10 * 60_000,
    placeholderData: keepPreviousData,
  });
  const eras = q.data?.eras ?? [];
  if (q.isLoading) return <Skeleton variant="rounded" height={420} />;
  if (!eras.length) return <EmptyState text={emptyText(avail)} />;
  if (era) {
    const e = eras.find((x) => x.key === era);
    return (
      <>
        <Typography
          onClick={() => setEra('')}
          sx={{ fontSize: 13, color: accent, cursor: 'pointer', mb: 2, display: 'inline-block' }}
        >
          ← 回到时间线
        </Typography>
        <Typography sx={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, mb: 1 }}>{e?.name}</Typography>
        <Box onClickCapture={workClickCapture(t.key)}>
          <PagedList themeKey={t.key} era={era} avail={avail} accent={accent} />
        </Box>
      </>
    );
  }
  return (
    <Box onClickCapture={workClickCapture(t.key)} sx={{ position: 'relative', pl: { xs: 3, md: 4 } }}>
      {/* 竖线 */}
      <Box sx={{ position: 'absolute', left: { xs: 7, md: 11 }, top: 8, bottom: 8, width: 2, bgcolor: 'divider' }} />
      {eras.map((e) => (
        <Box key={e.key} sx={{ position: 'relative', mb: 4 }}>
          <Box
            sx={{
              position: 'absolute',
              left: { xs: -22, md: -27 },
              top: 6,
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: accent,
              boxShadow: (th) => `0 0 0 4px ${th.palette.background.default}`,
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700 }}>{e.name}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
              {e.poetry ? '诗词' : '作品'} {e.total.toLocaleString()}
            </Typography>
            {e.total > e.items.length && (
              <Typography
                onClick={() => {
                  setEra(e.key);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                sx={{ fontSize: 12, color: accent, cursor: 'pointer', ml: 'auto' }}
              >
                看这一段 →
              </Typography>
            )}
          </Box>
          <ItemGrid list={e.items} accent={accent} showType compact />
        </Box>
      ))}
      <Typography sx={{ fontSize: 11, color: 'text.disabled', lineHeight: 1.8 }}>
        诗词语料目前只有唐、宋两代;近现代作品按上映 / 发行年份分段,没有年份的作品不进时间线。
      </Typography>
    </Box>
  );
}

/** 可用性筛选:全部 / 本站可播 / 直接可看。数字是不筛时后端给的粗数。 */
export function AvailFilter({
  value,
  onChange,
  totals,
}: {
  value: InsightAvail;
  onChange: (v: InsightAvail) => void;
  totals?: { play: number; read: number };
}) {
  const opts: { v: InsightAvail; label: string; color?: string; n?: number }[] = [
    { v: '', label: '全部' },
    { v: 'play', label: AVAIL_META.play.label, color: AVAIL_META.play.color, n: totals?.play },
    { v: 'read', label: AVAIL_META.read.label, color: AVAIL_META.read.color, n: totals?.read },
  ];
  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {opts.map((o) => {
          const on = value === o.v;
          return (
            <Box
              key={o.v || 'all'}
              onClick={() => onChange(o.v)}
              sx={{
                px: 1.5,
                py: 0.5,
                borderRadius: 5,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                border: '1px solid',
                borderColor: on ? o.color || 'text.primary' : 'divider',
                color: on ? '#fff' : 'text.primary',
                bgcolor: on ? o.color || 'text.primary' : 'transparent',
                ...(on && !o.color && { color: 'background.default' }),
              }}
            >
              {o.color && !on && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: o.color }} />}
              {o.label}
              {typeof o.n === 'number' && <Box component="span" sx={{ opacity: 0.7, fontSize: 12 }}>{o.n.toLocaleString()}</Box>}
            </Box>
          );
        })}
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 1 }}>
        「可播」在本站就能看到画面，「可看」是诗词原文与站内有正文的文章；没有标记的作品站内只有资料，需要去原站看。
      </Typography>
    </Box>
  );
}
