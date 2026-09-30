'use client';

// 人生感悟专题首页。
//
// 结构:今日一悟(按日期轮换的主题 + 一首诗 + 一部作品)→ 你最近在想的(本机记录)
// → 五组主题(心脉受损 / 人生真相 / 爱情·友情·亲情 / 七情 / 六欲)。
// 「人生真相」用宽卡:露出编者论的开头,告诉读者这里是讲透规律的论述,不只是作品清单。
//
// 页面上的编辑文字只有两类:题记(原句 + 出处,后端 insight_themes.go 里逐条核对过)
// 和「一问」(编者按)。作品都是按字面命中取的真实条目,不生成解读。

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import DetailHeader from '@/components/detail/DetailHeader';
import { overview, daily, readRecentThemes, type InsightGroup, type InsightTheme } from '@/apis/insight';
import { accentOf, WorkCard } from '@/components/insight/InsightCards';
import { useContentNavigate } from '@/lib/contentRoute';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';

/** 人生真相的宽卡:主题名 + 论的开头 + 题记。 */
function ArgueTile({ t, onClick }: { t: InsightTheme; onClick: () => void }) {
  const accent = accentOf(t.group);
  return (
    <Box
      onClick={onClick}
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderTop: `3px solid ${accent}`,
        cursor: 'pointer',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color .15s, transform .15s',
        '&:hover': { borderColor: accent, transform: 'translateY(-2px)' },
      }}
    >
      <Typography sx={{ fontFamily: SERIF, fontSize: 21, fontWeight: 700, color: accent, letterSpacing: '0.12em' }}>
        {t.name}
      </Typography>
      {t.lead && (
        <Typography
          sx={{
            fontSize: 13,
            color: 'text.primary',
            lineHeight: 1.85,
            mt: 1,
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {t.lead}……
        </Typography>
      )}
      <Typography sx={{ fontSize: 11.5, color: 'text.disabled', mt: 1.25, fontFamily: SERIF }}>
        「{t.line}」—— {t.lineSrc}
      </Typography>
      <Typography sx={{ fontSize: 12, color: accent, mt: 1 }}>读论 · 看故事 →</Typography>
    </Box>
  );
}

function ThemeTile({ t, onClick }: { t: InsightTheme; onClick: () => void }) {
  const accent = accentOf(t.group);
  // 七情六欲是单字,放大做主体;其余两字主题正常字号
  const single = t.name.length === 1;
  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        minWidth: 0,
        transition: 'border-color .15s, transform .15s',
        '&:hover': { borderColor: accent, transform: 'translateY(-2px)' },
      }}
    >
      <Typography
        sx={{
          fontFamily: SERIF,
          fontSize: single ? 30 : 20,
          fontWeight: 700,
          color: accent,
          lineHeight: 1.2,
          letterSpacing: '0.1em',
        }}
      >
        {t.name}
      </Typography>
      <Typography
        sx={{
          fontSize: 12,
          color: 'text.secondary',
          mt: 1,
          lineHeight: 1.7,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {t.line}
      </Typography>
    </Box>
  );
}

function GroupBlock({ g, open }: { g: InsightGroup; open: (key: string) => void }) {
  const accent = accentOf(g.key);
  return (
    <Box sx={{ mb: 5 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
        <Typography sx={{ fontFamily: SERIF, fontSize: 22, fontWeight: 700, letterSpacing: '0.12em' }}>
          {g.name}
        </Typography>
        <Box sx={{ width: 24, height: 2, bgcolor: accent, borderRadius: 1 }} />
      </Box>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>{g.intro}</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 2, fontFamily: SERIF }}>
        「{g.line}」—— {g.lineSrc}
      </Typography>
      {g.key === 'truth' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          {g.themes.map((t) => (
            <ArgueTile key={t.key} t={t} onClick={() => open(t.key)} />
          ))}
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
            gap: 1.5,
          }}
        >
          {g.themes.map((t) => (
            <ThemeTile key={t.key} t={t} onClick={() => open(t.key)} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function DailyCard({ open }: { open: (key: string) => void }) {
  const q = useQuery({ queryKey: ['insight', 'daily'], queryFn: daily, staleTime: 30 * 60_000 });
  const go = useContentNavigate();
  if (q.isLoading) return <Skeleton variant="rounded" height={220} sx={{ mb: 5 }} />;
  const d = q.data;
  if (!d) return null;
  const accent = accentOf(d.theme.group);
  return (
    <Box
      sx={{
        mb: 5,
        p: { xs: 2.5, md: 3.5 },
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        background: (th) =>
          th.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${accent}22 0%, transparent 60%)`
            : `linear-gradient(135deg, ${accent}14 0%, transparent 60%)`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 12, color: 'text.disabled', letterSpacing: '0.1em' }}>今日一悟 · {d.date}</Typography>
        <Typography
          onClick={() => open(d.theme.key)}
          sx={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: accent, cursor: 'pointer' }}
        >
          {d.theme.name}
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: d.work ? 'minmax(0, 1fr) 160px' : '1fr' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {d.poem && (
            <Box onClick={() => go('POETRY', d.poem!.id)} sx={{ cursor: 'pointer', mb: 2.5 }}>
              <Typography
                sx={{
                  fontFamily: SERIF,
                  fontSize: { xs: 16, md: 18 },
                  lineHeight: 2,
                  letterSpacing: '0.08em',
                  whiteSpace: 'pre-line',
                }}
              >
                {d.poem.text}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 1 }}>
                —— {[d.poem.dynasty, d.poem.author].filter(Boolean).join(' · ')}《{d.poem.title}》
              </Typography>
            </Box>
          )}
          <Typography sx={{ fontSize: 14, color: 'text.secondary', lineHeight: 1.8 }}>
            <Box component="span" sx={{ color: accent, mr: 1 }}>
              问
            </Box>
            {d.theme.ask}
          </Typography>
          <Typography
            onClick={() => open(d.theme.key)}
            sx={{ fontSize: 13, color: accent, mt: 2, cursor: 'pointer', display: 'inline-block' }}
          >
            进入「{d.theme.name}」 →
          </Typography>
        </Box>
        {d.work && (
          <Box sx={{ width: { xs: 140, md: 160 } }}>
            <WorkCard item={d.work} showType />
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function InsightHomePage() {
  const router = useRouter();
  const ov = useQuery({ queryKey: ['insight', 'overview'], queryFn: overview, staleTime: 60 * 60_000 });
  const [recent, setRecent] = React.useState<string[]>([]);
  React.useEffect(() => setRecent(readRecentThemes()), []);

  const open = (key: string) => router.push(`/insight/theme?key=${encodeURIComponent(key)}`);
  const byKey = new Map<string, InsightTheme>();
  ov.data?.groups.forEach((g) => g.themes.forEach((t) => byKey.set(t.key, t)));
  const recentThemes = recent.map((k) => byKey.get(k)).filter(Boolean) as InsightTheme[];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader title="人生感悟" />
      <Container maxWidth="lg" sx={{ py: 3, pb: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 4, mt: 1 }}>
          <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 28, md: 34 }, fontWeight: 700, letterSpacing: '0.3em' }}>
            人生感悟
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1.5, lineHeight: 1.8 }}>
            爱恨离合、七情六欲、世道人心,从唐诗宋词到今天的电影与歌
            <br />
            同一种心事,换一种作品,再看一遍
          </Typography>
          <Typography
            onClick={() => router.push('/insight/path')}
            sx={{ fontSize: 13, color: 'primary.main', mt: 1.5, cursor: 'pointer', display: 'inline-block' }}
          >
            我的心路 →
          </Typography>
        </Box>

        <DailyCard open={open} />

        {recentThemes.length > 0 && (
          <Box sx={{ mb: 5 }}>
            <Typography sx={{ fontSize: 13, color: 'text.disabled', mb: 1 }}>你最近在想</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {recentThemes.map((t) => (
                <Box
                  key={t.key}
                  onClick={() => open(t.key)}
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 5,
                    fontSize: 13,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: accentOf(t.group),
                    color: accentOf(t.group),
                  }}
                >
                  {t.name}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {ov.isLoading
          ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} variant="rounded" height={260} sx={{ mb: 4 }} />)
          : (ov.data?.groups ?? []).map((g) => <GroupBlock key={g.key} g={g} open={open} />)}

        {/* 数据说明:用户该知道这些作品是怎么来的 */}
        <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', mt: 4, lineHeight: 1.8 }}>
          主题下的作品按字面相关收录:诗词看正文与诗题,影视、音乐、书看标签与标题。
          <br />
          诗词来自 chinese-poetry (CC-BY-SA-4.0);题记均注明出处。
        </Typography>
      </Container>
    </Box>
  );
}
