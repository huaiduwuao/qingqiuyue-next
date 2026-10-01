'use client';

// 人生感悟 · 分支页(?key=)。
//
// 分支是从某个主题上自动长出来的一枝:(主题, 线索词),例如 (谋生之重, 外卖)。
// 为什么开着要摆在明面上 —— 哪几条热搜、多少人写下相近的心事、多少人搜过;
// 然后是「此刻」(热搜点名的作品 + 近几天站内带这个词的资讯与视频),
// 最后是和主题页同一套的作品区:诗词沿用父主题(古人怎么写这种心事),其余作品按线索词。
// 分支和凭据都是后端按字面规则算出来的,页面不写任何解读。

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
import {
  branch as fetchBranch,
  blockBranch,
  theme as fetchTheme,
  type InsightAvail,
  type InsightTheme,
} from '@/apis/insight';
import { accentOf, Epigraph } from '@/components/insight/InsightCards';
import { AvailFilter, ItemGrid, TimelineTab, WorksTab } from '@/components/insight/ThemeWorks';
import { ago, BranchStrip, branchSignals } from '@/components/insight/Branches';
import { useAuthority } from '@/contexts/AuthContext';

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif';

function BranchInner() {
  const router = useRouter();
  const qc = useQueryClient();
  const key = useSearchParams().get('key') || '';
  const [tab, setTab] = React.useState<'works' | 'timeline'>('works');
  const [avail, setAvail] = React.useState<InsightAvail>('');
  const { isAdmin, roles } = useAuthority();
  const isStaff = isAdmin || roles.includes('OPERATOR') || roles.includes('AUDITOR');

  const q = useQuery({
    queryKey: ['insight', 'branch', key],
    queryFn: () => fetchBranch(key),
    enabled: !!key,
    staleTime: 5 * 60_000,
    retry: false,
  });
  // 筛选数字在不筛的主题接口里(和「作品」页签默认那次请求是同一个缓存)
  const detail = useQuery({
    queryKey: ['insight', 'theme', key, ''],
    queryFn: () => fetchTheme(key, ''),
    enabled: !!q.data,
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
  if (!q.data) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <EmptyState text="这个分支不存在,或者已经收起很久了" />
        <Typography
          onClick={() => router.push('/insight')}
          sx={{ fontSize: 13, color: 'primary.main', cursor: 'pointer', textAlign: 'center', mt: 2 }}
        >
          回到人生感悟 →
        </Typography>
      </Container>
    );
  }

  const { branch: b, parent } = q.data;
  const evidence = q.data.evidence ?? [];
  const now = q.data.now ?? [];
  const accent = accentOf(b.group);
  // 作品区组件要一个主题:分支 key 就是主题 key
  const t: InsightTheme = { ...parent, key: b.key, name: b.cue };
  const signals = branchSignals(b);

  const toggleBlock = async () => {
    if (!window.confirm('封掉以后这个分支不再出现,之后再有热点也不会自动开。确定?')) return;
    await blockBranch(b.key, true);
    qc.invalidateQueries({ queryKey: ['insight'] });
    router.replace(`/insight/theme?key=${encodeURIComponent(parent.key)}`);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3, pb: 8 }}>
      {/* 分支头 */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 1, letterSpacing: '0.1em' }}>
          <Box component="span" onClick={() => router.push('/insight')} sx={{ cursor: 'pointer' }}>
            人生感悟
          </Box>
          {' · '}
          <Box
            component="span"
            onClick={() => router.push(`/insight/theme?key=${encodeURIComponent(parent.key)}`)}
            sx={{ cursor: 'pointer', color: accent }}
          >
            {parent.name}
          </Box>
          {' · 分支'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Typography
            sx={{
              fontFamily: SERIF,
              fontSize: { xs: 36, md: 44 },
              fontWeight: 700,
              color: accent,
              letterSpacing: '0.15em',
              lineHeight: 1.2,
            }}
          >
            {b.cue}
          </Typography>
          {b.status === 'closed' && (
            <Typography sx={{ fontSize: 12, color: 'text.disabled', border: '1px solid', borderColor: 'divider', px: 1, borderRadius: 1 }}>
              已收起 · 最近一次信号在 {ago(b.lastSignal)}
            </Typography>
          )}
        </Box>
        <Epigraph line={parent.line} src={parent.lineSrc} accent={accent} size={16} />
        {signals.length > 0 && (
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 2 }}>
            为什么开着:{signals.join(' · ')}
          </Typography>
        )}
      </Box>

      {/* 热搜原题:凭据,链到原处 */}
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

      {/* 此刻:站内与这件事相关的条目 */}
      {now.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap' }}>站内此刻</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>热点点名的作品,和近几天标题里带「{b.cue}」的资讯与视频</Typography>
          </Box>
          <ItemGrid list={now} accent={accent} showType />
        </Box>
      )}

      <Typography sx={{ fontSize: 14, color: 'text.secondary', lineHeight: 1.8, mb: 3 }}>
        <Box component="span" sx={{ color: accent, mr: 1 }}>
          问
        </Box>
        {parent.ask}
      </Typography>

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
        <BranchStrip theme={parent.key} exclude={b.key} title={`「${parent.name}」的其它分支`} />
      </Box>

      <Typography
        onClick={() => router.push(`/insight/theme?key=${encodeURIComponent(parent.key)}`)}
        sx={{ fontSize: 13, color: accent, cursor: 'pointer', display: 'inline-block' }}
      >
        回到「{parent.name}」看论与故事 →
      </Typography>

      {isStaff && (
        <Box sx={{ mt: 3 }}>
          <Button size="small" color="error" variant="outlined" onClick={toggleBlock}>
            封掉这个分支
          </Button>
        </Box>
      )}

      <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', mt: 6, lineHeight: 1.8 }}>
        分支按字面规则自动开启:热搜标题、大家写下的心事或搜索里出现「{b.cue}」,且站内有足够的相关作品。
        <br />
        时政、外交与涉及伤害的热点不进专题。诗词沿用「{parent.name}」的选法,其余作品按标签与标题相关收录。
      </Typography>
    </Container>
  );
}

export default function InsightBranchPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader title="人生感悟" />
      <Suspense fallback={null}>
        <BranchInner />
      </Suspense>
    </Box>
  );
}
