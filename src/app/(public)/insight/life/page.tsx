'use client';

// 人生感悟 · 一个人的一生(?id=,cog_character):作品解析引擎拆出来的人生事件 ——
// 那时多大、什么处境、他怎么选、本可以怎么选、后来怎样,以及这一生让人看见的感悟。
// 不评对错:「本可以」只是摆出来,让读的人自己想。

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import DetailHeader from '@/components/detail/DetailHeader';
import { EmptyState } from '@/components/common/AsyncState';
import { InsightLine, AXIS_NAME } from '@/components/cog/WorkCognition';
import { ContributeBox } from '@/components/cog/Cocreate';
import { STAGE_NAME, alternativesOf, cogCharacter } from '@/apis/cog';
import { getDetailRoute } from '@/lib/contentRoute';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';

function LifeInner() {
  const id = useSearchParams().get('id') || '';
  const q = useQuery({ queryKey: ['cog-life', id], queryFn: () => cogCharacter(id), enabled: !!id, staleTime: 10 * 60_000, retry: false });
  if (!id || q.isError) return <EmptyState text="没有找到这个人" />;
  if (!q.data) return <Skeleton variant="rounded" height={300} />;
  const { character: c, events, insights, work } = q.data;
  const byID = new Map(events.map((e) => [e.id, e]));
  return (
    <>
      <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 28, md: 34 }, fontWeight: 700, letterSpacing: '0.1em' }}>{c.name}</Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
        {c.identity}
        {work && (
          <>
            {c.identity ? ' · ' : ''}
            <Link href={getDetailRoute(work.contentType, work.id) || "#"} style={{ color: 'inherit' }}>
              《{work.title}》
            </Link>
          </>
        )}
      </Typography>
      {c.persona && <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 1.5, lineHeight: 1.9 }}>{c.persona}</Typography>}
      {c.arc && <Typography sx={{ fontFamily: SERIF, fontSize: 16, mt: 1.5, mb: 4, lineHeight: 1.9 }}>{c.arc}</Typography>}

      <Box sx={{ borderLeft: '1px solid', borderColor: 'divider', pl: 2.5, mb: 4 }}>
        {events.map((e) => {
          const alts = alternativesOf(e);
          const back = e.returnsTo && e.returnsTo !== '0' ? byID.get(e.returnsTo) : undefined;
          return (
            <Box key={e.id} sx={{ mb: 3, position: 'relative' }}>
              <Box sx={{ position: 'absolute', left: -25, top: 7, width: 9, height: 9, borderRadius: '50%', bgcolor: 'primary.main' }} />
              <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
                {STAGE_NAME[e.stage] || ''}
                {e.ageHint ? ` · ${e.ageHint}` : ''}
                {e.axis ? ` · ${AXIS_NAME[e.axis]}` : ''}
                {e.feel ? ` · ${e.feel}` : ''}
              </Typography>
              <Typography sx={{ fontSize: 15, lineHeight: 1.9 }}>{e.situation}</Typography>
              {e.choice && <Typography sx={{ fontSize: 14, lineHeight: 1.9 }}>他选了:{e.choice}</Typography>}
              {alts.length > 0 && <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.9 }}>本可以:{alts.join(';')}</Typography>}
              {e.consequence && <Typography sx={{ fontSize: 14, color: 'text.secondary', lineHeight: 1.9 }}>后来:{e.consequence}</Typography>}
              {back && <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 0.3 }}>这件事后来在「{back.situation.slice(0, 18)}…」时回来了</Typography>}
            </Box>
          );
        })}
      </Box>
      <ContributeBox kind="event" worldId={c.worldId} characterId={c.id} invalidate={['cog-life', id]} />
      <Box sx={{ mb: 4 }} />

      {insights.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', letterSpacing: '0.2em', mb: 1 }}>这一生让人看见的</Typography>
          {insights.map((x) => (
            <InsightLine key={x.id} x={x} />
          ))}
          <ContributeBox kind="insight" worldId={c.worldId} characterId={c.id} contentId={c.contentId !== '0' ? c.contentId : undefined} invalidate={['cog-life', id]} />
        </Box>
      )}
    </>
  );
}

export default function InsightLifePage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader title="一生" />
      <Container maxWidth="md" sx={{ py: 3, pb: 8 }}>
        <Suspense fallback={null}>
          <LifeInner />
        </Suspense>
      </Container>
    </Box>
  );
}
