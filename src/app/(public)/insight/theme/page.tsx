'use client';

// 人生感悟 · 主题页(?key=)。
//
// 两个页签:
//   作品:诗词、电影、剧集、动画、短剧、书、音乐、视频、文章,各取几部;点类型看全部
//   时间线:唐 → 宋 → 1949 年以前 → … → 当下,同一种心事在每个年代的作品
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
  type InsightItem,
  type InsightSection,
  type InsightTheme,
} from '@/apis/insight';
import { accentOf, Epigraph, InsightCard } from '@/components/insight/InsightCards';
import { TYPE_LABEL } from '@/lib/contentRoute';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';
const PAGE_SIZE = 24;

const typeName = (t: string) => (t === 'POETRY' ? '诗词' : TYPE_LABEL[t] || t);

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
  accent,
}: {
  themeKey: string;
  type?: string;
  era?: string;
  accent: string;
}) {
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [type, era]);
  const q = useQuery({
    queryKey: ['insight', 'items', themeKey, type || '', era || '', page],
    queryFn: () => fetchItems({ key: themeKey, type, era, page, size: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const total = q.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (q.isLoading) return <Skeleton variant="rounded" height={320} />;
  if (!total) return <EmptyState text="这里还没有收录到相关作品" />;
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

function WorksTab({ t, accent }: { t: InsightTheme; accent: string }) {
  const [type, setType] = React.useState('');
  const q = useQuery({ queryKey: ['insight', 'theme', t.key], queryFn: () => fetchTheme(t.key), staleTime: 10 * 60_000 });
  const sections = q.data?.sections ?? [];
  if (q.isLoading) return <Skeleton variant="rounded" height={420} />;
  if (!sections.length) return <EmptyState text="这里还没有收录到相关作品" />;
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
        <PagedList themeKey={t.key} type={type} accent={accent} />
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

function TimelineTab({ t, accent }: { t: InsightTheme; accent: string }) {
  const [era, setEra] = React.useState('');
  const q = useQuery({
    queryKey: ['insight', 'timeline', t.key],
    queryFn: () => fetchTimeline(t.key),
    staleTime: 10 * 60_000,
  });
  const eras = q.data?.eras ?? [];
  if (q.isLoading) return <Skeleton variant="rounded" height={420} />;
  if (!eras.length) return <EmptyState text="这里还没有收录到相关作品" />;
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
        <PagedList themeKey={t.key} era={era} accent={accent} />
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

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontSize: 14 } }}
      >
        <Tab value="works" label="作品" />
        <Tab value="timeline" label="从古至今" />
      </Tabs>

      {tab === 'works' ? <WorksTab key={t.key} t={t} accent={accent} /> : <TimelineTab key={t.key} t={t} accent={accent} />}

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
