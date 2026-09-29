'use client';

// 人生感悟 · 主题页(?key=)。
//
// 两个页签:
//   作品:诗词、电影、剧集、动画、短剧、书、音乐、视频、文章,各取几部;点类型看全部
//   时间线:唐 → 宋 → 1949 年以前 → … → 当下,同一种心事在每个年代的作品
// 页签上方是「论」(编者观点)和「不同角度」的故事(史书原典的白话转述,标出处),
// 以及可用性筛选:全部 / 本站可播 / 直接可看 —— 两个页签共用,作品卡上也打同样的标。
// 底部是「写给自己」(只存在本机)和同组的其它主题。
//
// 静态导出不能用 [key] 动态段,所以用 ?key=,且 useSearchParams 必须包在 Suspense 里。

import React, { Suspense } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Pagination from '@mui/material/Pagination';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import DetailHeader from '@/components/detail/DetailHeader';
import { EmptyState } from '@/components/common/AsyncState';
import {
  overview,
  theme as fetchTheme,
  timeline as fetchTimeline,
  items as fetchItems,
  pushRecentTheme,
  readNote,
  writeNote,
  type InsightAvail,
  type InsightItem,
  type InsightSection,
  type InsightTheme,
} from '@/apis/insight';
import { accentOf, AVAIL_META, EssayCard, Epigraph, InsightCard, StoryCard } from '@/components/insight/InsightCards';
import { TYPE_LABEL } from '@/lib/contentRoute';
import { list as fetchJourneys } from '@/apis/journey';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';
const PAGE_SIZE = 24;

const typeName = (t: string) => (t === 'POETRY' ? '诗词' : TYPE_LABEL[t] || t);

/** 筛选后为空时的说法:要说清楚是「站内暂时没有」,不是「没有相关作品」。 */
const emptyText = (avail: InsightAvail) =>
  avail === 'play'
    ? '这里暂时没有本站能直接播放的作品'
    : avail === 'read'
      ? '这里暂时没有站内能直接看的作品'
      : '这里还没有收录到相关作品';

/** 诗词两列文字卡,其余作品封面网格。 */
function ItemGrid({
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

function SectionRow({ s, accent, onMore }: { s: InsightSection; accent: string; onMore: () => void }) {
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
function PagedList({
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

function WorksTab({ t, avail, accent }: { t: InsightTheme; avail: InsightAvail; accent: string }) {
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
    <>
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
        sections.map((s) => (
          <SectionRow
            key={s.contentType}
            s={s}
            accent={accent}
            onMore={() => {
              setType(s.contentType);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ))
      )}
    </>
  );
}

function TimelineTab({ t, avail, accent }: { t: InsightTheme; avail: InsightAvail; accent: string }) {
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
        <PagedList themeKey={t.key} era={era} avail={avail} accent={accent} />
      </>
    );
  }
  return (
    <Box sx={{ position: 'relative', pl: { xs: 3, md: 4 } }}>
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
function AvailFilter({
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

/** 写给自己。只存在本机 —— 不上传,换设备不跟着走,页面上要说清楚。 */
function NoteBox({ t, accent }: { t: InsightTheme; accent: string }) {
  const [text, setText] = React.useState('');
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => {
    setText(readNote(t.key));
    setSaved(false);
  }, [t.key]);
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, border: '1px dashed', borderColor: 'divider', mb: 5 }}>
      <Typography sx={{ fontSize: 15, fontWeight: 600, mb: 0.5 }}>写给自己</Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5, lineHeight: 1.8 }}>
        <Box component="span" sx={{ color: accent, mr: 1 }}>
          问
        </Box>
        {t.ask}
      </Typography>
      <TextField
        multiline
        minRows={3}
        fullWidth
        size="small"
        placeholder="想到什么就写什么"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        onBlur={() => {
          writeNote(t.key, text);
          setSaved(true);
        }}
        slotProps={{ htmlInput: { maxLength: 2000 } }}
      />
      <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 1 }}>
        {saved ? '已保存在这台设备上。' : '只保存在这台设备上,不会上传,也没有别人能看到。'}
      </Typography>
    </Box>
  );
}

function ThemeInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const key = sp.get('key') || '';
  const [tab, setTab] = React.useState<'works' | 'timeline'>(sp.get('tab') === 'timeline' ? 'timeline' : 'works');
  const initAvail = sp.get('avail');
  const [avail, setAvail] = React.useState<InsightAvail>(initAvail === 'play' || initAvail === 'read' ? initAvail : '');
  // 编者论、故事和筛选数字都在不筛的主题接口里(和「作品」页签默认那次请求是同一个缓存)
  const detail = useQuery({
    queryKey: ['insight', 'theme', key, ''],
    queryFn: () => fetchTheme(key, ''),
    enabled: !!key,
    staleTime: 10 * 60_000,
  });

  const journeys = useQuery({
    queryKey: ['journey', 'list', key],
    queryFn: () => fetchJourneys(key),
    enabled: !!key,
    staleTime: 10 * 60_000,
  });

  const ov = useQuery({ queryKey: ['insight', 'overview'], queryFn: overview, staleTime: 60 * 60_000 });
  const groups = ov.data?.groups ?? [];
  const group = groups.find((g) => g.themes.some((x) => x.key === key));
  const t = group?.themes.find((x) => x.key === key);

  React.useEffect(() => {
    if (t) pushRecentTheme(t.key);
  }, [t]);

  if (ov.isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Skeleton variant="rounded" height={180} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={420} />
      </Container>
    );
  }
  if (!t || !group) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <EmptyState text="没有这个主题" />
      </Container>
    );
  }

  const accent = accentOf(t.group);
  const siblings = group.themes.filter((x) => x.key !== t.key);
  const go = (k: string) => router.replace(`/insight/theme?key=${encodeURIComponent(k)}`);

  return (
    <Container maxWidth="lg" sx={{ py: 3, pb: 8 }}>
      {/* 主题头 */}
      <Box sx={{ mb: 4 }}>
        <Typography
          onClick={() => router.push('/insight')}
          sx={{ fontSize: 12, color: 'text.disabled', cursor: 'pointer', mb: 1, letterSpacing: '0.1em' }}
        >
          人生感悟 · {group.name}
        </Typography>
        <Typography
          sx={{
            fontFamily: SERIF,
            fontSize: t.name.length === 1 ? { xs: 56, md: 72 } : { xs: 36, md: 44 },
            fontWeight: 700,
            color: accent,
            letterSpacing: '0.15em',
            lineHeight: 1.2,
            mb: 2,
          }}
        >
          {t.name}
        </Typography>
        <Epigraph line={t.line} src={t.lineSrc} accent={accent} size={17} />
      </Box>

      {/* 回廊:同一个主题,换一种走进去的方式 */}
      {(journeys.data?.list ?? []).map((j) => (
        <Box
          key={j.key}
          onClick={() => router.push(`/insight/journey?key=${encodeURIComponent(j.key)}`)}
          sx={{
            mb: 4,
            p: { xs: 2.25, md: 3 },
            borderRadius: 2.5,
            cursor: 'pointer',
            color: '#fff',
            // 底色是实色混出来的,不用半透明:浅色主题下半透明会透出页面的白底
            background: `linear-gradient(135deg, #15151b 55%, color-mix(in srgb, ${accent} 40%, #15151b) 100%)`,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            transition: 'filter .15s',
            '&:hover': { filter: 'brightness(1.12)' },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 11, color: accent, letterSpacing: '0.2em', mb: 0.5 }}>
              回廊{j.minutes ? ` · 约 ${j.minutes} 分钟` : ''} · {j.endings} 个结局
            </Typography>
            <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 20, md: 24 }, fontWeight: 700, letterSpacing: '0.1em' }}>
              {j.title}
            </Typography>
            <Typography
              sx={{
                fontSize: 13,
                lineHeight: 1.8,
                color: 'rgba(255,255,255,0.7)',
                mt: 0.75,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {j.situation}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 13, color: '#fff', flexShrink: 0 }}>走进去 ›</Typography>
        </Box>
      ))}

      {/* 论:编者观点 */}
      {(detail.data?.theme.essay?.length ?? 0) > 0 && (
        <Box sx={{ mb: 4 }}>
          <EssayCard paras={detail.data!.theme.essay!} accent={accent} />
        </Box>
      )}

      {/* 不同角度的故事:史书原典的白话转述 */}
      {(detail.data?.theme.stories?.length ?? 0) > 0 && (
        <Box sx={{ mb: 5 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 600 }}>不同角度</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>史书与诗文里的真事，白话转述，均注出处</Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.5,
              alignItems: 'start',
            }}
          >
            {detail.data!.theme.stories!.map((st) => (
              <StoryCard key={st.title} story={st} accent={accent} />
            ))}
          </Box>
        </Box>
      )}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontSize: 14 } }}
      >
        <Tab value="works" label="作品" />
        <Tab value="timeline" label="从古至今" />
      </Tabs>

      <AvailFilter value={avail} onChange={setAvail} totals={detail.data?.availTotals} />

      {tab === 'works' ? (
        <WorksTab key={t.key} t={t} avail={avail} accent={accent} />
      ) : (
        <TimelineTab key={t.key} t={t} avail={avail} accent={accent} />
      )}

      <Box sx={{ mt: 5 }}>
        <NoteBox t={t} accent={accent} />
      </Box>

      {siblings.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: 13, color: 'text.disabled', mb: 1.5 }}>同在「{group.name}」</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {siblings.map((s) => (
              <Box
                key={s.key}
                onClick={() => go(s.key)}
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 5,
                  cursor: 'pointer',
                  fontFamily: SERIF,
                  fontSize: 15,
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { borderColor: accent, color: accent },
                }}
              >
                {s.name}
              </Box>
            ))}
            <Box
              onClick={() => router.push('/insight')}
              sx={{ px: 2, py: 0.75, fontSize: 13, color: 'text.secondary', cursor: 'pointer' }}
            >
              全部主题 →
            </Box>
          </Box>
        </Box>
      )}

      <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', mt: 6, lineHeight: 1.8 }}>
        作品按字面相关收录(诗词看正文与诗题,其余看标签与标题),相关不等于作品本身就在讲这个。
        <br />
        诗词来自 chinese-poetry (CC-BY-SA-4.0)。
      </Typography>
    </Container>
  );
}

export default function InsightThemePage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader title="人生感悟" />
      <Suspense fallback={null}>
        <ThemeInner />
      </Suspense>
    </Box>
  );
}
