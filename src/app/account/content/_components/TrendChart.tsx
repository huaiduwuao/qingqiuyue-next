'use client';

import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonGroup from '@mui/material/ButtonGroup';
import Button from '@mui/material/Button';

type Range = '7d' | '30d';

const DATA: Record<Range, Array<{ date: string; views: number; likes: number; comments: number; fans: number }>> = {
  '7d': [
    { date: '05/26', views: 18420, likes: 1230, comments: 89, fans: 156 },
    { date: '05/27', views: 21350, likes: 1456, comments: 102, fans: 203 },
    { date: '05/28', views: 38920, likes: 2890, comments: 234, fans: 412 },
    { date: '05/29', views: 42180, likes: 3120, comments: 287, fans: 489 },
    { date: '05/30', views: 67540, likes: 5430, comments: 412, fans: 821 },
    { date: '05/31', views: 89230, likes: 7891, comments: 567, fans: 1240 },
    { date: '06/01', views: 128450, likes: 11240, comments: 823, fans: 1890 },
  ],
  '30d': Array.from({ length: 30 }, (_, i) => {
    const day = i + 1;
    const base = 20000 + Math.sin(i * 0.4) * 12000 + i * 1800;
    return {
      date: day < 10 ? `0${day}/06` : `${day}/06`,
      views: Math.max(8000, Math.floor(base + Math.random() * 8000)),
      likes: Math.max(500, Math.floor(base * 0.08 + Math.random() * 800)),
      comments: Math.max(20, Math.floor(base * 0.005 + Math.random() * 80)),
      fans: Math.max(50, Math.floor(base * 0.012 + Math.random() * 200)),
    };
  }),
};

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

export default function TrendChart() {
  const [range, setRange] = useState<Range>('7d');
  const [metric, setMetric] = useState<MetricId>('views');

  const data = DATA[range];
  const color = METRICS.find((m) => m.id === metric)!.color;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const max = Math.max(...data.map((d) => d[metric]));
  const min = 0;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = PAD.left + i * stepX;
    const y = PAD.top + innerH - ((d[metric] - min) / (max - min)) * innerH;
    return { x, y, raw: d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath =
    `M ${points[0].x} ${PAD.top + innerH} ` +
    points.map((p) => `L ${p.x} ${p.y}`).join(' ') +
    ` L ${points[points.length - 1].x} ${PAD.top + innerH} Z`;

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) {
      ticks.push((max / 4) * i);
    }
    return ticks;
  }, [max]);

  const xLabelStep = data.length > 7 ? Math.ceil(data.length / 6) : 1;

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
                '&:hover': { bgcolor: range === r ? 'primary.dark' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover' },
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

      <Box sx={{ width: '100%', overflow: 'hidden' }}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((t, i) => {
            const y = PAD.top + innerH - (t / max) * innerH;
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
          {data.map((d, i) =>
            i % xLabelStep === 0 || i === data.length - 1 ? (
              <text
                key={i}
                x={PAD.left + i * stepX}
                y={HEIGHT - 8}
                fill="text.disabled"
                fontSize="9"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {d.date}
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
    </Box>
  );
}
