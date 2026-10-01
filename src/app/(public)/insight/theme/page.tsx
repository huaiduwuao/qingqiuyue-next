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
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import DetailHeader from '@/components/detail/DetailHeader';
import { EmptyState } from '@/components/common/AsyncState';
import {
  overview,
  theme as fetchTheme,
  pushRecentTheme,
  readNote,
  writeNote,
  type InsightAvail,
  type InsightTheme,
} from '@/apis/insight';
import { accentOf, EssayCard, Epigraph, StoryCard } from '@/components/insight/InsightCards';
import { AvailFilter, TimelineTab, WorksTab } from '@/components/insight/ThemeWorks';
import { list as fetchJourneys } from '@/apis/journey';
import { BranchStrip } from '@/components/insight/Branches';
import { useTopicOpen } from '@/lib/topicTrack';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';

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
  useTopicOpen(t?.key);

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

      {/* 此刻:这个主题上跟着热点 / 心事自动开出来的分支 */}
      <BranchStrip theme={t.key} title="此刻的分支" />

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
