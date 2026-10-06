'use client';

// 详情页里「这部作品里的世界与一生」:作品解析引擎拆出来的世界、定律、人物的一生、感悟(internal/cognition)。
// 还没解析过的作品整块不显示 —— 不放占位、不说「正在解析」。
// 感悟是改写过的话,不是原文;只有诗词带一句原句。

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { DOMAIN_NAME, LAYER_NAME, WORLD_KIND_NAME, cogWork, type CogInsight } from '@/apis/cog';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';

export const AXIS_NAME: Record<string, string> = { heart: '本心', spine: '底气', edge: '棱角', silence: '沉默', smile: '微笑' };

export function InsightLine({ x }: { x: CogInsight }) {
  return (
    <Box sx={{ py: 1.2, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.9 }}>{x.text}</Typography>
      {x.quote && <Typography sx={{ fontFamily: SERIF, fontSize: 13, color: 'text.secondary', mt: 0.3 }}>「{x.quote}」</Typography>}
      {x.axis && (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.3 }}>
          {AXIS_NAME[x.axis]}
          {x.stance === 'question' ? ' · 作品在追问' : x.stance === 'contrast' ? ' · 作品从反面写' : ''}
        </Typography>
      )}
    </Box>
  );
}

export function WorkCognition({ contentId }: { contentId: string | number }) {
  const id = String(contentId);
  const q = useQuery({ queryKey: ['cog-work', id], queryFn: () => cogWork(id), staleTime: 10 * 60_000, retry: false });
  const d = q.data;
  if (!d || !d.analyzed) return null;
  const leads = [...d.characters].sort((a, b) => (a.role === 'lead' ? 0 : 1) - (b.role === 'lead' ? 0 : 1)).slice(0, 6);
  const byLayer = [1, 2, 3].map((l) => d.insights.filter((x) => x.layer === l)).filter((g) => g.length > 0);
  return (
    <Box sx={{ my: 4, px: { xs: 0.5, md: 0 } }}>
      <Typography sx={{ fontFamily: SERIF, fontSize: 20, fontWeight: 700, letterSpacing: '0.1em', mb: 1 }}>这部作品里的世界与一生</Typography>
      {d.work.logline && <Typography sx={{ fontSize: 14, color: 'text.secondary', lineHeight: 1.9, mb: 2 }}>{d.work.logline}</Typography>}

      {d.world?.id && (
        <Box sx={{ mb: 2.5 }}>
          <Link href={`/insight/world?id=${d.world.id}`} style={{ textDecoration: 'none' }}>
            <Chip
              clickable
              size="small"
              label={`${WORLD_KIND_NAME[d.world.kind] || ''} · ${d.world.name}${d.world.era ? ' · ' + d.world.era : ''}${d.world.workCount > 1 ? ` · ${d.world.workCount} 部作品` : ''}`}
              sx={{ mb: 1.2 }}
            />
          </Link>
          {d.laws.slice(0, 5).map((l) => (
            <Typography key={l.id} sx={{ fontSize: 14, lineHeight: 1.9 }}>
              <Box component="span" sx={{ fontSize: 11, color: 'text.disabled', mr: 1 }}>
                {DOMAIN_NAME[l.domain] || l.domain}
              </Box>
              {l.text}
            </Typography>
          ))}
        </Box>
      )}

      {leads.length > 0 && (
        <Box sx={{ mb: 2.5 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>人物的一生</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.2 }}>
            {leads.map((c) => (
              <Link key={c.id} href={`/insight/life?id=${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <Box sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid', borderColor: 'divider', height: '100%', '&:hover': { borderColor: 'primary.main' } }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
                    {c.name}
                    {c.identity && (
                      <Box component="span" sx={{ fontSize: 12, fontWeight: 400, color: 'text.secondary', ml: 1 }}>
                        {c.identity}
                      </Box>
                    )}
                  </Typography>
                  {c.arc && <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.8, mt: 0.5 }}>{c.arc}</Typography>}
                </Box>
              </Link>
            ))}
          </Box>
        </Box>
      )}

      {byLayer.map((g) => (
        <Box key={g[0].layer} sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.5 }}>{LAYER_NAME[g[0].layer]}</Typography>
          {g.map((x) => (
            <InsightLine key={x.id} x={x} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

export default WorkCognition;
