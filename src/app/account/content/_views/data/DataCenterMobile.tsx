'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import { accountClient, isAuthError } from '@/lib/api/client';
import {
  getCreatorTrend,
  getCreatorFanPortrait,
  getCreatorContentDistribution,
  getTopPerformingContent,
  type TrendPoint,
  type FanStat,
  type ContentStat,
  type TopPerformingItem,
} from '@/apis/dashboard';
import { getDetailRoute } from '@/lib/contentRoute';
import { MobileSection, MobileStatRow, MobileListRow } from '@/components/mobile/MobileSection';
import { useActiveTab } from '../../ActiveTabContext';

type Overview = {
  totalWorks?: number;
  totalViews?: number;
  totalLikes?: number;
  totalComments?: number;
  viewsDelta?: number;
  likesDelta?: number;
  commentsDelta?: number;
  periodStart?: string;
  periodEnd?: string;
};

const fmt = (n?: number) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}w`;
  return v.toLocaleString();
};

function Delta({ v }: { v?: number }) {
  const n = Number(v) || 0;
  if (!n) return <Box component="span" sx={{ color: 'text.disabled' }}>持平</Box>;
  return (
    <Box component="span" sx={{ color: n > 0 ? 'success.main' : 'error.main' }}>
      {n > 0 ? '+' : ''}
      {fmt(n)}
    </Box>
  );
}

const RANGES = [
  { id: '7d', label: '7 日' },
  { id: '30d', label: '30 日' },
] as const;
type Range = (typeof RANGES)[number]['id'];
const METRICS = [
  { id: 'views', label: '播放' },
  { id: 'likes', label: '点赞' },
  { id: 'comments', label: '评论' },
  { id: 'fans', label: '涨粉' },
] as const;
type MetricId = (typeof METRICS)[number]['id'];

// 优质作品榜的 type 与详情路由的映射,和电脑版 TopPerformingContent 一致
const topTypeToContentType = (type: string): string =>
  type === 'video' ? 'VIDEO' : type === 'image' ? 'ARTICLE' : 'LIVE';

function Pill({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        all: 'unset',
        cursor: 'pointer',
        px: 1,
        py: 0.25,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: on ? 700 : 500,
        color: on ? 'primary.main' : 'text.secondary',
        bgcolor: on ? 'rgba(254,44,85,0.12)' : 'transparent',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {children}
    </Box>
  );
}

/** 紧凑折线图(约 160px 高),颜色从主题解析 —— SVG 属性里写 'primary.main' 是无效色。 */
function MiniTrend({ list, metric }: { list: TrendPoint[]; metric: MetricId }) {
  const theme = useTheme();
  const W = 340;
  const H = 150;
  const PAD = { top: 10, right: 8, bottom: 20, left: 8 };
  const color = theme.palette.primary.main;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const base = PAD.top + innerH;
  const max = Math.max(...list.map((d) => Number(d[metric]) || 0), 1);
  const step = list.length > 1 ? innerW / (list.length - 1) : 0;
  const pts = list.map((d, i) => ({ x: PAD.left + i * step, y: base - ((Number(d[metric]) || 0) / max) * innerH, d }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = pts.length ? `M ${pts[0].x} ${base} ${pts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')} L ${pts[pts.length - 1].x} ${base} Z` : '';
  const labelStep = list.length > 7 ? Math.ceil(list.length / 5) : 1;
  const last = pts[pts.length - 1];

  return (
    <Box sx={{ position: 'relative' }}>
      <Typography sx={{ position: 'absolute', top: 0, right: 0, fontSize: 11, color: 'text.disabled' }}>峰值 {fmt(max)}</Typography>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="mTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={PAD.left} x2={W - PAD.right} y1={base} y2={base} stroke={theme.palette.divider} strokeWidth="1" />
        <path d={area} fill="url(#mTrendFill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {last && <circle cx={last.x} cy={last.y} r="3" fill={color} />}
        {pts.map((p, i) =>
          i % labelStep === 0 || i === pts.length - 1 ? (
            <text
              key={i}
              x={p.x}
              y={H - 5}
              fill={theme.palette.text.disabled}
              fontSize="10"
              textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}
            >
              {p.d.date}
            </text>
          ) : null,
        )}
      </svg>
    </Box>
  );
}

/**
 * 手机上的数据中心。电脑版是 三张大数字卡 + 大趋势图 + 粉丝画像环图 + 内容分布环图 + 优质作品榜,
 * 手机上 2.4 屏。这里:四个数一行 → 一张紧凑趋势图(指标/时间段是小胶囊)→ 优质作品前 5
 * → 内容分布一行胶囊(点进作品管理对应类型)→ 粉丝画像三行文字。只保留一张图。
 */
export default function DataCenterMobile() {
  const router = useRouter();
  const { setActiveTab } = useActiveTab();
  const [range, setRange] = useState<Range>('7d');
  const [metric, setMetric] = useState<MetricId>('views');

  // 与电脑版组件同 queryKey,共用缓存
  const overviewQ = useQuery({
    queryKey: ['account', 'data', 'overview'],
    queryFn: () => accountClient.get<Overview>('/data/overview').then((r) => r),
  });
  const trendQ = useQuery({
    queryKey: ['creator-trend', range],
    queryFn: () => getCreatorTrend({ range }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  const topQ = useQuery({
    queryKey: ['creator-content-top-performing', 7],
    queryFn: () => getTopPerformingContent({ days: 7, pageSize: 5 }).then((r) => r.list || []),
    placeholderData: [],
  });
  const distQ = useQuery({
    queryKey: ['creator-content-distribution'],
    queryFn: () => getCreatorContentDistribution(),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  });
  const fansQ = useQuery({
    queryKey: ['creator-fan-portrait'],
    queryFn: () => getCreatorFanPortrait(),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  });

  const ov: Overview = overviewQ.data || {};
  const authGate = overviewQ.isError && isAuthError(overviewQ.error);
  const trend = (trendQ.data?.list ?? []) as TrendPoint[];
  const top = (topQ.data ?? []) as TopPerformingItem[];

  // 后端按原始类型值分组,NOVEL/novel 可能分成两行,和电脑版一样按 type 合并
  const dist = useMemo(() => {
    const records = (distQ.data?.records ?? distQ.data?.list ?? []) as ContentStat[];
    const by = new Map<string, ContentStat>();
    records.forEach((r) => {
      const e = by.get(r.type);
      by.set(r.type, e ? { ...e, count: e.count + r.count } : { ...r });
    });
    return Array.from(by.values()).sort((a, b) => b.count - a.count);
  }, [distQ.data]);

  const fanLines = useMemo(() => {
    const fans = (fansQ.data?.records ?? fansQ.data?.list ?? []) as FanStat[];
    const pick = (cat: FanStat['category']) => fans.filter((f) => f.category === cat).sort((a, b) => b.value - a.value);
    const g = pick('gender');
    const a = pick('age');
    const r = pick('region');
    return [
      { label: '性别', text: g.map((x) => `${x.label} ${x.value}%`).join(' · ') },
      { label: '年龄', text: a.slice(0, 3).map((x) => `${x.label} ${x.value}%`).join(' · ') },
      { label: '地域', text: r.slice(0, 3).map((x) => `${x.label} ${x.value}%`).join(' · ') },
    ].filter((l) => l.text);
  }, [fansQ.data]);

  const period = ov.periodStart && ov.periodEnd ? `${ov.periodStart.slice(5, 10).replace('-', '.')}–${ov.periodEnd.slice(5, 10).replace('-', '.')}` : '近 7 日';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {/* 总览:四个数一行,较前 7 日增量写在下面 */}
      <MobileSection title="总览" extra={authGate ? '登录后查看' : period}>
        {overviewQ.isLoading ? (
          <Skeleton variant="rounded" height={52} />
        ) : (
          <MobileStatRow
            items={[
              { label: '播放', value: fmt(ov.totalViews), hint: <Delta v={ov.viewsDelta} /> },
              { label: '点赞', value: fmt(ov.totalLikes), hint: <Delta v={ov.likesDelta} /> },
              { label: '评论', value: fmt(ov.totalComments), hint: <Delta v={ov.commentsDelta} /> },
              { label: '作品', value: fmt(ov.totalWorks), onClick: () => setActiveTab('works') },
            ]}
          />
        )}
      </MobileSection>

      {/* 趋势:唯一的一张图 */}
      <MobileSection title="数据趋势">
        <Box sx={{ display: 'flex', alignItems: 'center', mt: -0.5, mb: 1 }}>
          <Box sx={{ display: 'flex', gap: 0.25, flex: 1, minWidth: 0 }}>
            {METRICS.map((m) => (
              <Pill key={m.id} on={metric === m.id} onClick={() => setMetric(m.id)}>
                {m.label}
              </Pill>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
            {RANGES.map((r) => (
              <Pill key={r.id} on={range === r.id} onClick={() => setRange(r.id)}>
                {r.label}
              </Pill>
            ))}
          </Box>
        </Box>
        {trendQ.isLoading ? (
          <Skeleton variant="rounded" height={150} />
        ) : trendQ.isError ? (
          <Typography sx={{ py: 5, textAlign: 'center', fontSize: 12, color: 'text.disabled' }}>数据加载失败,请稍后重试</Typography>
        ) : trend.length === 0 ? (
          <Typography sx={{ py: 5, textAlign: 'center', fontSize: 12, color: 'text.disabled' }}>
            近 {range === '7d' ? 7 : 30} 日暂无数据
          </Typography>
        ) : (
          <MiniTrend list={trend} metric={metric} />
        )}
      </MobileSection>

      {/* 优质作品榜 */}
      <MobileSection title="优质作品" extra="近 7 日" flush>
        {top.length === 0 ? (
          <Typography sx={{ px: 1.75, pb: 1.75, pt: 0.5, fontSize: 12, color: 'text.disabled' }}>
            {topQ.isLoading ? '加载中…' : '暂无作品数据'}
          </Typography>
        ) : (
          top.map((it, i) => {
            const route = getDetailRoute(topTypeToContentType(it.type), it.id);
            return (
              <MobileListRow
                key={it.id}
                divider={i > 0}
                onClick={route ? () => router.push(route) : undefined}
                leading={
                  <Box
                    sx={{
                      width: 22,
                      flexShrink: 0,
                      textAlign: 'center',
                      fontSize: 15,
                      fontWeight: 800,
                      fontStyle: 'italic',
                      color: i < 3 ? 'primary.main' : 'text.disabled',
                    }}
                  >
                    {it.rank ?? i + 1}
                  </Box>
                }
                title={it.title}
                subtitle={
                  <>
                    播放 {fmt(it.views)} · 赞 {fmt(it.likes)} · 评 {fmt(it.comments)}
                    {typeof it.delta === 'number' && it.delta !== 0 && (
                      <Box component="span" sx={{ ml: 0.75, color: it.delta > 0 ? 'success.main' : 'error.main' }}>
                        {it.delta > 0 ? '+' : ''}
                        {it.delta}%
                      </Box>
                    )}
                  </>
                }
              />
            );
          })
        )}
      </MobileSection>

      {/* 内容分布:一行胶囊,点进作品管理的对应类型 */}
      {dist.length > 0 && (
        <MobileSection title="内容分布" extra={`共 ${dist.reduce((s, d) => s + d.count, 0)} 件`}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {dist.map((d) => (
              <Box
                key={d.type}
                component="button"
                type="button"
                onClick={() => setActiveTab('works', { type: d.type })}
                sx={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 999,
                  fontSize: 12,
                  color: 'text.primary',
                  bgcolor: 'action.hover',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color }} />
                {d.label}
                <Box component="span" sx={{ fontWeight: 700 }}>{d.count}</Box>
              </Box>
            ))}
          </Box>
        </MobileSection>
      )}

      {/* 粉丝画像:三行文字代替环图/柱条 */}
      {fanLines.length > 0 && (
        <MobileSection title="粉丝画像" extra="近 30 日">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {fanLines.map((l) => (
              <Box key={l.label} sx={{ display: 'flex', gap: 1.25, alignItems: 'baseline', minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', flexShrink: 0 }}>{l.label}</Typography>
                <Typography noWrap sx={{ fontSize: 13, color: 'text.primary', minWidth: 0 }}>
                  {l.text}
                </Typography>
              </Box>
            ))}
          </Box>
        </MobileSection>
      )}
    </Box>
  );
}
