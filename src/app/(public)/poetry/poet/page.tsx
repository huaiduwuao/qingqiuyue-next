'use client';

// 诗人页。
//
// 页面上每一块都是有出处的:
//   - 小传:chinese-poetry 仓的原文(文言,繁体),原样展示,不改写不生成
//   - 生卒年:从小传开头的括号里解析出来的,只有约 5% 的诗人有 —— 没有就不显示
//   - 体裁 / 词牌 / 意象:对他本人作品的统计
//   - 生平时间线:中文维基 REST 抓的诗人生平事件(见 internal/crawler/poet_timeline.go),
//     写进 metadata.timeline;没爬到的诗人整块不渲染
//   - 心境解读:LLM 基于诗人作品/时代背景生成的创作心路总结,标「AI 生成」,
//     写进 metadata.mood,永久缓存(见 internal/handler/poetry_mood.go)
//     ⚠️ 必须和原小传在视觉上分开 —— 用户得一眼看清哪些是仓里原话、哪些是 AI 生成。

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Pagination from '@mui/material/Pagination';
import Tooltip from '@mui/material/Tooltip';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { poet as fetchPoet, lifespanText, type FacetItem } from '@/apis/poetry';
import PoetTimeline from '@/components/poetry/PoetTimeline';
import PoetMoodSummary from '@/components/poetry/PoetMoodSummary';
import { track, recordHistory } from '@/lib/track';

const PAGE_SIZE = 20;

/** 统计条。value 是标签,count 是数量,max 用来算条宽。 */
function FacetBar({ items, max, accent }: { items: FacetItem[]; max: number; accent: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {items.map((it) => (
        <Box key={it.value} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 13, width: 48, flexShrink: 0, color: 'text.secondary' }}>
            {it.value}
          </Typography>
          <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}>
            <Box
              sx={{
                width: `${max > 0 ? Math.max(2, (it.count / max) * 100) : 0}%`,
                height: '100%',
                borderRadius: 3,
                bgcolor: accent,
              }}
            />
          </Box>
          <Typography sx={{ fontSize: 12, width: 44, textAlign: 'right', color: 'text.disabled' }}>
            {it.count}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5, mt: 4 }}>
      <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{children}</Typography>
      {hint && (
        <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{hint}</Typography>
      )}
    </Box>
  );
}

function PoetPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const name = searchParams.get('name');
  const [page, setPage] = React.useState(1);

  const query = useQuery({
    queryKey: ['poetry', 'poet', id, name, page],
    queryFn: () => fetchPoet({ id: id ?? undefined, name: name ?? undefined, page, size: PAGE_SIZE }),
    enabled: !!(id || name),
  });

  React.useEffect(() => {
    if (id) {
      track(id, 'view', 'PERSON');
      recordHistory(id);
    }
  }, [id]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader title={query.data?.name || '诗人'} />
      <AsyncState query={query}>
        {(data) => {
          const life = lifespanText(data.birthYear, data.deathYear);
          const forms = data.forms ?? [];
          const rhythmics = data.rhythmics ?? [];
          const imagery = data.imagery?.items ?? [];
          const pageCount = Math.max(1, Math.ceil((data.worksTotal || 0) / (data.pageSize || PAGE_SIZE)));

          return (
            <Container maxWidth="md" sx={{ py: 3, pb: 8 }}>
              {/* 抬头:名字 + 朝代 + 生卒 */}
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography sx={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.08em' }}>
                  {data.name}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                  {data.dynasty && <Chip size="small" label={data.dynasty} />}
                  {/* 生卒年只有解析得出来才显示 —— 唐代诗人的小传用年号纪年,一位都没有 */}
                  {life && <Chip size="small" variant="outlined" label={life} />}
                  <Chip size="small" variant="outlined" label={`存世 ${data.worksTotal} 首`} />
                </Box>
              </Box>

              {/* 小传原文 */}
              {data.bio && (
                <>
                  <SectionTitle hint="chinese-poetry 收录原文">生平</SectionTitle>
                  <Box
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      bgcolor: 'action.hover',
                      fontSize: 15,
                      lineHeight: 2.1,
                      letterSpacing: '0.02em',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {data.bio}
                  </Box>
                </>
              )}

              {/* 版本校勘:同样是原文,但不是生平,默认收起 */}
              {data.bioNotes && (
                <Accordion
                  disableGutters
                  elevation={0}
                  sx={{ mt: 1, bgcolor: 'transparent', '&:before': { display: 'none' } }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 0, minHeight: 40 }}>
                    <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>版本校勘</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 0 }}>
                    <Typography
                      sx={{ fontSize: 12.5, lineHeight: 2, color: 'text.secondary', whiteSpace: 'pre-line' }}
                    >
                      {data.bioNotes}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* 生平时间线 —— 中文维基 REST 抓的诗人生平事件;无数据不渲染 */}
              <PoetTimeline items={data.timeline} />

              {/* 诗人心境 —— LLM 生成,永久缓存,标题已明示「AI 解读」+ 角标 */}
              <PoetMoodSummary periods={data.mood} />

              {/* 体裁 / 词牌 */}
              {(forms.length > 0 || rhythmics.length > 0) && (
                <>
                  <SectionTitle hint={`基于其名下 ${data.worksTotal} 首作品`}>创作</SectionTitle>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: rhythmics.length ? '1fr 1fr' : '1fr' }, gap: 3 }}>
                    {forms.length > 0 && (
                      <Box>
                        <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 1 }}>体裁</Typography>
                        <FacetBar items={forms} max={Math.max(...forms.map((f) => f.count))} accent="primary.main" />
                      </Box>
                    )}
                    {rhythmics.length > 0 && (
                      <Box>
                        <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 1 }}>常用词牌</Typography>
                        <FacetBar items={rhythmics} max={Math.max(...rhythmics.map((f) => f.count))} accent="#7C3AED" />
                      </Box>
                    )}
                  </Box>
                </>
              )}

              {/* 意象词频 —— 这是统计,不是解读,脚注必须说清楚 */}
              {imagery.length > 0 && (
                <>
                  <SectionTitle hint="词频统计,非文学评价">常写的意象</SectionTitle>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {imagery.map((it) => (
                      <Tooltip
                        key={it.value}
                        title={`「${it.value}」出现在其 ${it.count} 首作品中`}
                        arrow
                      >
                        <Chip
                          label={`${it.value} ${it.count}`}
                          size="small"
                          sx={{
                            bgcolor: 'rgba(124, 58, 237, 0.10)',
                            color: 'text.primary',
                            fontWeight: 500,
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                  <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 1.5 }}>
                    统计「该字出现在他多少首作品里」，分母为其名下 {data.imagery?.total ?? data.worksTotal} 首。
                    这是用字频次，不代表对诗人心境的判断。
                  </Typography>
                </>
              )}

              {/* 作品 */}
              <SectionTitle hint={`共 ${data.worksTotal} 首`}>作品</SectionTitle>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {data.works.map((w) => (
                  <Box
                    key={String(w.id)}
                    onClick={() => router.push(`/detail/poetry-detail?id=${w.id}`)}
                    sx={{
                      py: 1.75,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{w.title}</Typography>
                    {w.excerpt && (
                      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
                        {w.excerpt}
                      </Typography>
                    )}
                    {w.subtitle && (
                      <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.5 }}>
                        {w.subtitle}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>

              {pageCount > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                  <Pagination
                    count={pageCount}
                    page={page}
                    onChange={(_, p) => {
                      setPage(p);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    size="small"
                  />
                </Box>
              )}

              {/* CC-BY-SA-4.0 合规:小传与作品都来自 chinese-poetry,署名不可省略 */}
              {data.sourceLabel && (
                <>
                  <Divider sx={{ mt: 5, mb: 2 }} />
                  <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center' }}>
                    内容来源:{data.sourceLabel}
                  </Typography>
                </>
              )}
            </Container>
          );
        }}
      </AsyncState>
    </Box>
  );
}

export default function PoetPage() {
  // useSearchParams 需要 Suspense 边界,静态导出时尤其如此。
  return (
    <React.Suspense fallback={null}>
      <PoetPageContent />
    </React.Suspense>
  );
}
