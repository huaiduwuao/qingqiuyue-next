'use client';

// 文明图谱首页。
//
// 结构:标题 → 全站统计(领域、门类、开着的分支、关联作品、本轮热搜归位情况)
// → 八个领域(门类 + 作品数 + 最近长出的分支)→ 本轮没地方挂的热搜(谁都可以接到图谱上)。
// 支架(领域、门类)是编辑搭的;分支是热点、搜索和用户长出来的 —— 页面只做聚合,不写评论。

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DetailHeader from '@/components/detail/DetailHeader';
import { civMap, type CivMap } from '@/apis/civ';
import type { InsightBranchEvidence } from '@/apis/insight';
import { civAccent, civHref, GraftBox, GrownCard, SERIF } from '@/components/civ/CivParts';
import { ago } from '@/components/insight/Branches';
import { useTopicImpressions } from '@/lib/topicTrack';
import { useAuthority } from '@/contexts/AuthContext';

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
        {typeof n === 'number' ? n.toLocaleString() : n}
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{label}</Typography>
    </Box>
  );
}

function DomainBlock({ d }: { d: CivMap['domains'][number] }) {
  const router = useRouter();
  const accent = civAccent(d.domain);
  return (
    <Box
      sx={{
        p: { xs: 2, md: 2.5 },
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderTop: `3px solid ${accent}`,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography
          onClick={() => router.push(civHref(d.key))}
          sx={{ fontFamily: SERIF, fontSize: 26, fontWeight: 700, color: accent, letterSpacing: '0.15em', cursor: 'pointer' }}
        >
          {d.name}
        </Typography>
        <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>作品 {d.works.toLocaleString()}</Typography>
      </Box>
      <Typography sx={{ fontSize: 12.5, color: 'text.secondary', lineHeight: 1.7, mt: 0.5, mb: 1.5 }}>{d.intro}</Typography>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: d.branches.length ? 1.5 : 0 }}>
        {d.fields.map((f) => (
          <Box
            key={f.key}
            onClick={() => router.push(civHref(f.key))}
            sx={{
              px: 1.25,
              py: 0.4,
              borderRadius: 5,
              fontSize: 12.5,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: f.branches ? accent : 'divider',
              color: f.branches ? accent : 'text.primary',
              '&:hover': { borderColor: accent, color: accent },
            }}
          >
            {f.name}
            <Box component="span" sx={{ opacity: 0.55, ml: 0.5, fontSize: 11 }}>
              {f.works.toLocaleString()}
            </Box>
            {!!f.branches && (
              <Box component="span" sx={{ ml: 0.5, fontSize: 11, fontWeight: 700 }}>
                +{f.branches}
              </Box>
            )}
          </Box>
        ))}
      </Box>
      {d.branches.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1, mt: 'auto' }}>
          {d.branches.map((b) => (
            <GrownCard key={b.key} n={b} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function Unplaced({ list, data }: { list: InsightBranchEvidence[]; data: CivMap }) {
  const [pick, setPick] = React.useState<InsightBranchEvidence | null>(null);
  const parents = data.domains.flatMap((d) => d.fields.map((f) => ({ key: f.key, label: `${d.name} · ${f.name}` })));
  if (!list.length) return null;
  return (
    <Box sx={{ mt: 5 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
        <Typography sx={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, letterSpacing: '0.1em' }}>还没地方挂的热点</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>图谱里没有词认得它们。觉得该有,就把它接上去</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {list.map((e) => (
          <Box
            key={e.word}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: 1.5, border: '1px dashed', borderColor: 'divider' }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                component="a"
                href={e.url || undefined}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontSize: 14, color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                {e.word}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                {e.source}
                {e.rank ? ` 第 ${e.rank} 位` : ''} · {ago(e.at)}
                {e.suggestName ? ` · 可能属于「${e.suggestName}」` : ''}
              </Typography>
            </Box>
            <Typography onClick={() => setPick(e)} sx={{ fontSize: 13, color: 'primary.main', cursor: 'pointer', flexShrink: 0 }}>
              接到图谱上
            </Typography>
          </Box>
        ))}
      </Box>
      <Dialog open={!!pick} onClose={() => setPick(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontSize: 16 }}>把「{pick?.word}」接到图谱上</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          {pick && (
            <GraftBox parents={parents} initialName={pick.word} accent="#2E86AB" onDone={() => setPick(null)} />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default function CivPage() {
  const router = useRouter();
  const { isAdmin, roles } = useAuthority();
  const isStaff = isAdmin || roles.includes('OPERATOR') || roles.includes('AUDITOR');
  const q = useQuery({ queryKey: ['civ', 'map'], queryFn: civMap, staleTime: 5 * 60_000 });
  const d = q.data;
  // 曝光:领域、门类、分支卡都算(行为闭环的分母,见 lib/topicTrack)
  useTopicImpressions(
    (d?.domains ?? []).flatMap((dm) => [dm.key, ...dm.fields.map((f) => f.key), ...dm.branches.map((b) => b.key)]),
  );
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <DetailHeader title="文明图谱" />
      <Container maxWidth="lg" sx={{ py: 3, pb: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 4, mt: 1 }}>
          <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 28, md: 34 }, fontWeight: 700, letterSpacing: '0.3em' }}>
            文明图谱
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1.5, lineHeight: 1.8 }}>
            社会、文化、科技、政治、军事、民生、经济、历史 —— 把人类文明拆开,让每一部作品都有地方挂
            <br />
            支架是搭好的;上面长什么,由此刻的热点、大家的搜索和你自己决定
          </Typography>
          {isStaff && (
            <Typography onClick={() => router.push('/civ/insights')} sx={{ fontSize: 13, color: 'primary.main', mt: 1, cursor: 'pointer' }}>
              专题看板:哪里吸引用户 →
            </Typography>
          )}
          {d?.personalized && (
            <Typography sx={{ fontSize: 12, color: 'primary.main', mt: 1 }}>按你常看的领域和兴趣排了顺序</Typography>
          )}
        </Box>

        {q.isLoading || !d ? (
          <>
            <Skeleton variant="rounded" height={90} sx={{ mb: 3 }} />
            <Skeleton variant="rounded" height={420} />
          </>
        ) : (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', md: 'repeat(6, minmax(0, 1fr))' },
                gap: 2,
                p: { xs: 2, md: 2.5 },
                mb: 4,
                borderRadius: 2,
                bgcolor: 'action.hover',
              }}
            >
              <Stat n={d.stats.domains} label="领域" />
              <Stat n={d.stats.fields} label="门类" />
              <Stat n={d.stats.open} label="开着的分支" />
              <Stat n={d.stats.grafted} label="用户嫁接" />
              <Stat n={d.stats.works} label="关联作品" />
              <Stat n={d.round.total ? `${d.round.placed}/${d.round.total}` : '—'} label={`本轮热搜归位${d.round.at ? ` · ${ago(d.round.at)}` : ''}`} />
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              {d.domains.map((dm) => (
                <DomainBlock key={dm.key} d={dm} />
              ))}
            </Box>

            <Unplaced list={d.round.unplaced ?? []} data={d} />
          </>
        )}

        <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', mt: 6, lineHeight: 1.8 }}>
          作品按标签与标题里的线索词归入门类,相关不等于作品本身就在讲这个;一部作品可以挂在好几处。
          <br />
          「关联作品」按门类相加,有重复。热点来自百度实时热搜,只做归类与链接,不加评论。
        </Typography>
      </Container>
    </Box>
  );
}
