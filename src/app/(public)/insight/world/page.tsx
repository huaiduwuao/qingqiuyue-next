'use client';

// 人生感悟 · 一个世界(?id=):作品解析引擎从很多部作品里拼出来的世界认知 —— 定律(几部作品说过)、地方、人群、
// 写到这个世界的作品、在这里活过的人。现实世界按地区 + 年代合在一起(很多作品写同一个年代)。
// 静态导出不能用动态段,所以用 ?id=。

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import DetailHeader from '@/components/detail/DetailHeader';
import { EmptyState } from '@/components/common/AsyncState';
import { DOMAIN_NAME, WORLD_KIND_NAME, cogWorld } from '@/apis/cog';
import { ByUser, ContributeBox, EndorseButton } from '@/components/cog/Cocreate';
import { getDetailRoute } from '@/lib/contentRoute';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', letterSpacing: '0.2em', mb: 1.2 }}>{title}</Typography>
      {children}
    </Box>
  );
}

function WorldInner() {
  const id = useSearchParams().get('id') || '';
  const q = useQuery({ queryKey: ['cog-world', id], queryFn: () => cogWorld(id), enabled: !!id, staleTime: 10 * 60_000, retry: false });
  if (!id || q.isError) return <EmptyState text="没有找到这个世界" />;
  if (!q.data) return <Skeleton variant="rounded" height={300} />;
  const { world: w, laws, places, groups, works, characters, briefs, universe } = q.data;
  const byDomain = new Map<string, typeof laws>();
  laws.forEach((l) => byDomain.set(l.domain, [...(byDomain.get(l.domain) || []), l]));
  return (
    <>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', letterSpacing: '0.2em' }}>
        {WORLD_KIND_NAME[w.kind] || w.kind}
        {w.region ? ` · ${w.region}` : ''}
        {w.era ? ` · ${w.era}` : ''}
      </Typography>
      <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 28, md: 34 }, fontWeight: 700, letterSpacing: '0.1em', my: 1 }}>{w.name}</Typography>
      {w.summary && <Typography sx={{ fontSize: 14.5, color: 'text.secondary', lineHeight: 2, mb: 1 }}>{w.summary}</Typography>}
      <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: universe ? 2 : 4 }}>
        {w.workCount} 部作品写到这里 · {w.lawCount} 条定律
      </Typography>
      {universe && (
        <Button component={Link} href={`/life?u=${universe}`} variant="outlined" sx={{ mb: 4 }}>
          到这个世界里活一世
        </Button>
      )}

      {(
        <Section title="这个世界怎么运转">
          {[...byDomain.entries()].map(([d, list]) => (
            <Box key={d} sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 0.5 }}>{DOMAIN_NAME[d] || d}</Typography>
              {list.map((l) => (
                <Typography key={l.id} sx={{ fontSize: 14.5, lineHeight: 1.9 }}>
                  {l.text}
                  <ByUser authorId={l.authorId} />
                  <EndorseButton kind="law" id={l.id} count={l.endorse} />
                  {l.support > 1 && (
                    <Box component="span" sx={{ fontSize: 11, color: 'text.disabled', ml: 1 }}>
                      {l.support} 部作品都这么写
                    </Box>
                  )}
                </Typography>
              ))}
            </Box>
          ))}
          <ContributeBox kind="law" worldId={w.id} invalidate={['cog-world', id]} />
        </Section>
      )}

      <Section title="地方与人群">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {[...places, ...groups].map((p) => (
            <Chip key={p.id} size="small" variant="outlined" label={p.name} title={p.description} />
          ))}
        </Box>
        <ContributeBox kind="place" worldId={w.id} invalidate={['cog-world', id]} />
        <ContributeBox kind="group" worldId={w.id} invalidate={['cog-world', id]} />
      </Section>

      {(
        <Section title="在这里活过的人">
          {characters.map((c) => (
            <Link key={c.id} href={`/insight/life?id=${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Box sx={{ py: 1.2, borderBottom: '1px solid', borderColor: 'divider', '&:hover': { color: 'primary.main' } }}>
                <Typography sx={{ fontSize: 15 }}>
                  {c.name}
                  <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', ml: 1 }}>
                    {c.identity}
                    {briefs[c.contentId] ? ` · 《${briefs[c.contentId].title}》` : ''}
                  </Box>
                </Typography>
                {c.arc && <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.3 }}>{c.arc}</Typography>}
              </Box>
            </Link>
          ))}
          <ContributeBox kind="character" worldId={w.id} invalidate={['cog-world', id]} />
        </Section>
      )}

      {works.length > 0 && (
        <Section title="写到这个世界的作品">
          {works.map((x) => {
            const b = briefs[x.contentId];
            if (!b) return null;
            return (
              <Link key={x.contentId} href={getDetailRoute(b.contentType, b.id) || "#"} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Box sx={{ py: 1.2, borderBottom: '1px solid', borderColor: 'divider', '&:hover': { color: 'primary.main' } }}>
                  <Typography sx={{ fontSize: 15 }}>《{b.title}》</Typography>
                  {x.logline && <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.3 }}>{x.logline}</Typography>}
                </Box>
              </Link>
            );
          })}
        </Section>
      )}
    </>
  );
}

export default function InsightWorldPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader title="世界" />
      <Container maxWidth="md" sx={{ py: 3, pb: 8 }}>
        <Suspense fallback={null}>
          <WorldInner />
        </Suspense>
      </Container>
    </Box>
  );
}
