'use client';

import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { getCreatorTrend, type TrendPoint } from '@/apis/dashboard';

type Range = '7d' | '30d';

const METRICS = [
  { id: 'views', label: '播放量', color: 'primary.main' },
  { id: 'likes', label: '点赞', color: 'secondary.main' },
  { id: 'comments', label: '评论', color: 'warning.main' },
  { id: 'fans', label: '涨粉', color: '#8B5CF6' },
] as const;

type MetricId = (typeof METRICS)[number]['id'];

const WIDTH = 600;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

function buildPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}

function buildAreaPath(points: Array<{ x: number; y: number }>, baselineY: number) {
  if (points.length === 0) return '';
  const segs = points.map((p) => `L ${p.x} ${p.y}`).join(' ');
  return `M ${points[0].x} ${baselineY} ${segs} L ${points[points.length - 1].x} ${baselineY} Z`;
}

export default function TrendChart() {
  const [range, setRange] = useState<Range>('7d');
  const [metric, setMetric] = useState<MetricId>('views');

  const query = useQuery({
    queryKey: ['creator-trend', range],
    queryFn: () => getCreatorTrend({ range }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });

  const color = METRICS.find((m) => m.id === metric)!.color;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const baselineY = PAD.top + innerH;

  const { linePath, areaPath, points, yTicks, xLabelStep, isEmpty } = useMemo(() => {
    const list = ((query.data?.list ?? []) as TrendPoint[]);
    if (list.length === 0) {
      return { linePath: '', areaPath: '', points: [] as Array<{ x: number; y: number; raw: TrendPoint }>, yTicks: [], xLabelStep: 1, isEmpty: true };
    }
    const max = Math.max(...list.map((d) => d[metric]), 1);
    const stepX = list.length > 1 ? innerW / (list.length - 1) : 0;
    const pts = list.map((d, i) => ({
      x: PAD.left + i * stepX,
      y: baselineY - ((d[metric] - 0) / max) * innerH,
      raw: d,
    }));
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) ticks.push((max / 4) * i);
    const step = list.length > 7 ? Math.ceil(list.length / 6) : 1;
    return {
      linePath: buildPath(pts),
      areaPath: buildAreaPath(pts, baselineY),
      points: pts,
      yTicks: ticks,
      xLabelStep: step,
      isEmpty: false,
    };
  }, [query.data, metric, innerW, innerH, baselineY]);

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary' }}>数据趋势</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>查看核心指标近 7/30 日变化</Typography>
        </Box>
        <ButtonGroup size="small" sx={{ '& .MuiButton-root': { minWidth: 56, fontSize: 11, py: 0.25 } }}>
          {(['7d', '30d'] as const).map((r) => (
            <Button
              key={r}
              variant={range === r ? 'contained' : 'outlined'}
              onClick={() => setRange(r)}
              sx={{
                bgcolor: range === r ? 'primary.main' : 'transparent',
                borderColor: 'divider',
                color: range === r ? 'text.primary' : 'text.secondary',
                '&:hover': { bgcolor: range === r ? 'primary.dark' : 'action.hover'},
              }}
            >
              {r === '7d' ? '近 7 日' : '近 30 日'}
            </Button>
          ))}
        </ButtonGroup>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
        {METRICS.map((m) => (
          <Box
            key={m.id}
            onClick={() => setMetric(m.id)}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              bgcolor: metric === m.id ? `${m.color}1F` : 'transparent',
              color: metric === m.id ? m.color : 'text.secondary',
              border: '1px solid',
              borderColor: metric === m.id ? `${m.color}66` : 'transparent',
              transition: 'all 0.15s ease-in-out',
              '&:hover': { color: m.color },
            }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: m.color }} />
            {m.label}
          </Box>
        ))}
      </Box>

      {query.isLoading ? (
        <Skeleton variant="rounded" height={HEIGHT} sx={{ bgcolor: 'action.hover' }} />
      ) : query.isError ? (
        <Box sx={{ height: HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>数据加载失败,请稍后重试</Typography>
        </Box>
      ) : isEmpty ? (
        <Box sx={{ height: HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>近 {range === '7d' ? 7 : 30} 日暂无数据</Typography>
        </Box>
      ) : (
        <Box sx={{ width: '100%', overflow: 'hidden' }}>
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {yTicks.map((t, i) => {
              const y = baselineY - (t / yTicks[yTicks.length - 1] || 1) * innerH;
              return (
                <g key={i}>
                  <line
                    x1={PAD.left}
                    y1={y}
                    x2={WIDTH - PAD.right}
                    y2={y}
                    stroke="divider"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={PAD.left - 6}
                    y={y + 3}
                    fill="text.disabled"
                    fontSize="9"
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {t >= 10000 ? `${(t / 10000).toFixed(1)}w` : t.toFixed(0)}
                  </text>
                </g>
              );
            })}
            {points.map((p, i) =>
              i % xLabelStep === 0 || i === points.length - 1 ? (
                <text
                  key={i}
                  x={p.x}
                  y={HEIGHT - 8}
                  fill="text.disabled"
                  fontSize="9"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {p.raw.date}
                </text>
              ) : null
            )}
            <path d={areaPath} fill="url(#trendFill)" />
            <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="2.5"
                fill="background.default"
                stroke={color}
                strokeWidth="2"
              />
            ))}
          </svg>
        </Box>
      )}
    </Box>
  );
}