'use client';

// 诗词频道。之前诗词只能靠搜索进,没有任何入口页 —— 这里补上。
//
// 两个页签:
//   作品:按朝代 / 体裁筛,点进诗词详情页
//   诗人:按朝代筛、按名字搜,点进诗人页
// 顶部是「名家」:存诗最多且有小传的诗人。

import React from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import Pagination from '@mui/material/Pagination';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import DetailHeader from '@/components/detail/DetailHeader';
import { overview, poems, poets, lifespanText, type PoetCard } from '@/apis/poetry';

const PAGE_SIZE = 24;

/** 诗人卡片。没有画像可用 —— 这批数据只有文字,所以用名字本身作视觉主体。 */
function PoetTile({ p, onClick }: { p: PoetCard; onClick: () => void }) {
  const life = lifespanText(p.birthYear, p.deathYear);
  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        cursor: 'pointer',
        transition: 'border-color .15s, background-color .15s',
        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography sx={{ fontSize: 17, fontWeight: 600, letterSpacing: '0.04em' }}>{p.name}</Typography>
        {p.dynasty && (
          <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{p.dynasty}</Typography>
        )}
      </Box>
      {life && (
        <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.25 }}>{life}</Typography>
      )}
      {p.brief && (
        <Typography
          sx={{
            fontSize: 12,
            color: 'text.secondary',
            mt: 0.75,
            lineHeight: 1.7,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {p.brief}
        </Typography>
      )}
      {typeof p.poemCount === 'number' && p.poemCount > 0 && (
        <Typography sx={{ fontSize: 11, color: 'primary.main', mt: 1 }}>存世 {p.poemCount} 首</Typography>
      )}
    </Box>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; count?: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
      <Typography sx={{ fontSize: 12, color: 'text.disabled', width: 32 }}>{label}</Typography>
      <Chip
        size="small"
        label="全部"
        variant={value === '' ? 'filled' : 'outlined'}
        color={value === '' ? 'primary' : 'default'}
        onClick={() => onChange('')}
      />
      {options.map((o) => (
        <Chip
          key={o.value}
          size="small"
          label={o.count ? `${o.value} ${o.count}` : o.value}
          variant={value === o.value ? 'filled' : 'outlined'}
          color={value === o.value ? 'primary' : 'default'}
          onClick={() => onChange(value === o.value ? '' : o.value)}
        />
      ))}
    </Box>
  );
}

export default function PoetryChannelPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState<'poems' | 'poets'>('poems');
  const [dynasty, setDynasty] = React.useState('');
  const [form, setForm] = React.useState('');
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);

  const ov = useQuery({ queryKey: ['poetry', 'overview'], queryFn: overview });

  const poemQuery = useQuery({
    queryKey: ['poetry', 'poems', dynasty, form, page],
    queryFn: () => poems({ dynasty: dynasty || undefined, form: form || undefined, page, size: PAGE_SIZE }),
    enabled: tab === 'poems',
    placeholderData: keepPreviousData,
  });

  const poetQuery = useQuery({
    queryKey: ['poetry', 'poets', dynasty, q, page],
    queryFn: () => poets({ dynasty: dynasty || undefined, q: q || undefined, page, size: PAGE_SIZE }),
    enabled: tab === 'poets',
    placeholderData: keepPreviousData,
  });

  const active = tab === 'poems' ? poemQuery : poetQuery;
  const total = active.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 换页签或换筛选都要回到第一页,否则会停在一个新结果集里不存在的页码上。
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader title="诗词" />
      <Container maxWidth="lg" sx={{ py: 3, pb: 8 }}>
        {/* 概览 */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography sx={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.12em' }}>诗词</Typography>
          {ov.data && (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1 }}>
              收录 {ov.data.total.toLocaleString()} 首 · {ov.data.poetTotal.toLocaleString()} 位诗人
            </Typography>
          )}
        </Box>

        {/* 名家 */}
        {(ov.data?.topPoets?.length ?? 0) > 0 && (
          <>
            <Typography sx={{ fontSize: 15, fontWeight: 600, mb: 1.5 }}>名家</Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
                gap: 1.5,
                mb: 4,
              }}
            >
              {ov.data!.topPoets.slice(0, 8).map((p) => (
                <PoetTile key={String(p.id)} p={p} onClick={() => router.push(`/poetry/poet?id=${p.id}`)} />
              ))}
            </Box>
          </>
        )}

        <Divider sx={{ mb: 2 }} />

        <Tabs
          value={tab}
          onChange={(_, v) => reset(() => setTab(v))}
          sx={{ mb: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontSize: 14 } }}
        >
          <Tab value="poems" label="作品" />
          <Tab value="poets" label="诗人" />
        </Tabs>

        <FilterRow
          label="朝代"
          options={(ov.data?.dynasties ?? []).map((d) => ({ value: d.value, count: d.count }))}
          value={dynasty}
          onChange={(v) => reset(() => setDynasty(v))}
        />
        {tab === 'poems' && (
          <FilterRow
            label="体裁"
            options={(ov.data?.forms ?? []).map((f) => ({ value: f.value, count: f.count }))}
            value={form}
            onChange={(v) => reset(() => setForm(v))}
          />
        )}
        {tab === 'poets' && (
          <TextField
            size="small"
            placeholder="搜诗人名字"
            value={q}
            onChange={(e) => reset(() => setQ(e.target.value))}
            sx={{ mb: 2, width: { xs: '100%', sm: 260 } }}
          />
        )}

        <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 1.5 }}>
          共 {total.toLocaleString()} 条
        </Typography>

        {active.isLoading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={84} />
            ))}
          </Box>
        ) : tab === 'poets' ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 1.5,
            }}
          >
            {(poetQuery.data?.list ?? []).map((p) => (
              <PoetTile key={String(p.id)} p={p} onClick={() => router.push(`/poetry/poet?id=${p.id}`)} />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 0 }}>
            {(poemQuery.data?.list ?? []).map((w) => (
              <Box
                key={String(w.id)}
                onClick={() => router.push(`/detail/poetry-detail?id=${w.id}`)}
                sx={{
                  py: 1.75,
                  px: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 500 }}>{w.title}</Typography>
                  {w.author && (
                    <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{w.author}</Typography>
                  )}
                </Box>
                {w.excerpt && (
                  <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>{w.excerpt}</Typography>
                )}
              </Box>
            ))}
          </Box>
        )}

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

        {ov.data?.sourceLabel && (
          <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', mt: 5 }}>
            内容来源:{ov.data.sourceLabel}
          </Typography>
        )}
      </Container>
    </Box>
  );
}
