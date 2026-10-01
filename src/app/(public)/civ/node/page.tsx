'use client';

// 文明图谱 · 节点页(?key=)。领域、门类、长出来的分支都用这一页。
//
//   领域:门类网格 + 最近长出的分支;
//   门类 / 分支:为什么开着 → 此刻的热点(原题,链到原处)→ 站内此刻 → 下面长出的枝
//   → 接一枝 → 作品 / 从古至今(和人生感悟同一套组件,节点 key 就是主题 key)。
//
// 静态导出不能用 [key] 动态段,所以用 ?key=,且 useSearchParams 必须包在 Suspense 里。

import React, { Suspense } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import DetailHeader from '@/components/detail/DetailHeader';
import { EmptyState } from '@/components/common/AsyncState';
import { blockCiv, civNode } from '@/apis/civ';
import { theme as fetchTheme, type InsightAvail, type InsightTheme } from '@/apis/insight';
import { AvailFilter, ItemGrid, TimelineTab, WorksTab } from '@/components/insight/ThemeWorks';
import { ago } from '@/components/insight/Branches';
import { civAccent, civHref, civSignals, GraftBox, GrownCard, ORIGIN_LABEL, SERIF } from '@/components/civ/CivParts';
import { useAuthority } from '@/contexts/AuthContext';

function NodeInner() {
  const router = useRouter();
  const qc = useQueryClient();
  const key = useSearchParams().get('key') || '';
  const [tab, setTab] = React.useState<'works' | 'timeline'>('works');
  const [avail, setAvail] = React.useState<InsightAvail>('');
  const { isAdmin, roles } = useAuthority();
  const isStaff = isAdmin || roles.includes('OPERATOR') || roles.includes('AUDITOR');

  const q = useQuery({
    queryKey: ['civ', 'node', key],
    queryFn: () => civNode(key),
    enabled: !!key,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const n = q.data?.node;
  // 筛选数字在不筛的主题接口里(和「作品」页签默认那次请求是同一个缓存)
  const detail = useQuery({
    queryKey: ['insight', 'theme', key, ''],
    queryFn: () => fetchTheme(key, ''),
    enabled: !!n && n.depth > 0 && n.cues.length > 0,
    staleTime: 10 * 60_000,
  });

  if (q.isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Skeleton variant="rounded" height={200} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={420} />
      </Container>
    );
  }
  if (!q.data || !n) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <EmptyState text="这个节点不存在,或者已经收起很久了" />
        <Typography
          onClick={() => router.push('/civ')}
          sx={{ fontSize: 13, color: 'primary.main', cursor: 'pointer', textAlign: 'center', mt: 2 }}
        >
          回到文明图谱 →
        </Typography>
      </Container>
    );
  }

  const { path, children } = q.data;
  const evidence = q.data.evidence ?? [];
  const now = q.data.now ?? [];
  const accent = civAccent(n.domain);
  const isDomain = n.depth === 0;
  const fields = isDomain ? children.filter((c) => c.origin === 'editorial') : [];
  const grown = children.filter((c) => c.origin !== 'editorial');
  const signals = civSignals(n);
  // 作品区组件要一个主题:节点 key 就是主题 key
  const t: InsightTheme = { key: n.key, name: n.name, group: n.domain, line: '', lineSrc: '', ask: '' };

  const block = async () => {
    if (!window.confirm('封掉以后这个节点和它下面的枝都不再出现,之后再有热点也不会自动开。确定?')) return;
    await blockCiv(n.key, true);
    qc.invalidateQueries({ queryKey: ['civ'] });
    router.replace(path.length ? civHref(path[path.length - 1].key) : '/civ');
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3, pb: 8 }}>
      {/* 路径 */}
      <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 1, letterSpacing: '0.05em' }}>
        <Box component="span" onClick={() => router.push('/civ')} sx={{ cursor: 'pointer' }}>
          文明图谱
        </Box>
        {path.map((p) => (
          <React.Fragment key={p.key}>
            {' › '}
            <Box component="span" onClick={() => router.push(civHref(p.key))} sx={{ cursor: 'pointer', color: p.depth === 0 ? accent : undefined }}>
              {p.name}
            </Box>
          </React.Fragment>
        ))}
      </Typography>

      {/* 节点头 */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
          <Typography
            sx={{ fontFamily: SERIF, fontSize: { xs: 34, md: 42 }, fontWeight: 700, color: accent, letterSpacing: '0.12em', lineHeight: 1.2 }}
          >
            {n.name}
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.disabled', border: '1px solid', borderColor: 'divider', px: 1, borderRadius: 1 }}>
            {isDomain ? '领域' : n.depth === 1 ? '门类' : ORIGIN_LABEL[n.origin]}
            {n.status === 'pending' && ' · 待长出'}
            {n.status === 'closed' && ` · 已收起(最近一次信号 ${ago(n.lastSignal)})`}
          </Typography>
        </Box>
        {n.intro && <Typography sx={{ fontSize: 14, color: 'text.secondary', lineHeight: 1.8, mb: 1.5 }}>{n.intro}</Typography>}
        {n.cues.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>线索词</Typography>
            {n.cues.map((c) => (
              <Box key={c} sx={{ px: 1, py: 0.25, borderRadius: 1, fontSize: 12, bgcolor: 'action.hover' }}>
                {c}
              </Box>
            ))}
          </Box>
        )}
        {!isDomain && (
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 1.5 }}>
            {[...signals, `站内相关作品 ${n.works.toLocaleString()}`].join(' · ')}
            {n.status === 'pending' && ' —— 不到 3 部时先挂着,内容进来了自己会开'}
          </Typography>
        )}
      </Box>

      {/* 领域:门类网格 */}
      {isDomain && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
            gap: 1.5,
            mb: 4,
          }}
        >
          {fields.map((f) => (
            <Box
              key={f.key}
              onClick={() => router.push(civHref(f.key))}
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                cursor: 'pointer',
                minWidth: 0,
                '&:hover': { borderColor: accent },
              }}
            >
              <Typography sx={{ fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: accent }}>{f.name}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
                作品 {f.works.toLocaleString()}
                {f.children ? ` · 长出 ${f.children} 枝` : ''}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.cues.join(' · ')}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* 此刻的热点 */}
      {evidence.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 600, mb: 1.5 }}>此刻的热点</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {evidence.map((e) => (
              <Box
                key={e.word}
                component="a"
                href={e.url || undefined}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  display: 'block',
                  p: 1.5,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  color: 'inherit',
                  textDecoration: 'none',
                  '&:hover': { borderColor: accent },
                }}
              >
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1, minWidth: 0 }}>{e.word}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.disabled', whiteSpace: 'nowrap' }}>
                    {e.source}
                    {e.rank ? ` 第 ${e.rank} 位` : ''} · {ago(e.at)}
                  </Typography>
                </Box>
                {e.desc && (
                  <Typography
                    sx={{
                      fontSize: 12.5,
                      color: 'text.secondary',
                      lineHeight: 1.7,
                      mt: 0.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {e.desc}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* 站内此刻 */}
      {now.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap' }}>站内此刻</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>热点点名的作品,和近几天标题里带线索词的资讯与视频</Typography>
          </Box>
          <ItemGrid list={now} accent={accent} showType />
        </Box>
      )}

      {/* 长出来的枝 */}
      {grown.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 600, mb: 1.5 }}>
            {isDomain ? '最近长出的分支' : '下面长出的枝'}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
            {grown.map((g) => (
              <GrownCard key={g.key} n={g} showParent={isDomain} />
            ))}
          </Box>
        </Box>
      )}

      {/* 接一枝 */}
      {!isDomain && n.status !== 'blocked' && (
        <Box sx={{ mb: 5, p: { xs: 2, md: 2.5 }, borderRadius: 2, border: '1px dashed', borderColor: 'divider' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, mb: 0.5 }}>在「{n.name}」下接一枝</Typography>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mb: 1.5 }}>
            觉得这里还缺一块?起个名字、给几个线索词,站内相关作品够 3 部就开;不够就先挂着,等内容长出来。
          </Typography>
          <GraftBox parent={n.key} accent={accent} />
        </Box>
      )}

      {/* 作品 */}
      {!isDomain && n.cues.length > 0 && (
        <>
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
        </>
      )}

      {isStaff && (
        <Box sx={{ mt: 4 }}>
          <Button size="small" color="error" variant="outlined" onClick={block}>
            封掉这个节点
          </Button>
        </Box>
      )}

      <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', mt: 6, lineHeight: 1.8 }}>
        作品按标签与标题里的线索词收录,相关不等于作品本身就在讲这个。
        <br />
        分支跟着百度实时热搜、站内搜索和用户嫁接长出来;热点只做归类与链接,不加评论。
      </Typography>
    </Container>
  );
}

export default function CivNodePage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader title="文明图谱" />
      <Suspense fallback={null}>
        <NodeInner />
      </Suspense>
    </Box>
  );
}
