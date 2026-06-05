'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const DATA = [
  { id: 'video', label: '短视频', value: 156, percent: 63.2, color: 'primary.main' },
  { id: 'image', label: '图文', value: 48, percent: 19.4, color: 'secondary.main' },
  { id: 'live', label: '直播', value: 28, percent: 11.3, color: 'warning.main' },
  { id: 'article', label: '长文', value: 11, percent: 4.5, color: '#8B5CF6' },
  { id: 'other', label: '其他', value: 4, percent: 1.6, color: 'text.disabled' },
];

const SIZE = 200;
const RADIUS = 80;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ContentDistributionChart() {
  const [hovered, setHovered] = useState<string | null>(null);
  const total = DATA.reduce((acc, d) => acc + d.value, 0);
  const hoveredItem = DATA.find((d) => d.id === hovered);
  const centerLabel = hoveredItem
    ? { value: hoveredItem.percent.toFixed(1) + '%', name: hoveredItem.label }
    : { value: total.toString(), name: '总作品数' };

  let offset = 0;
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
      <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
        内容分布
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 2 }}>
        各类内容数量占比
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1 }}>
        {/* Donut */}
        <Box sx={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="transparent"
              stroke="#1E2030"
              strokeWidth={STROKE}
            />
            {DATA.map((d) => {
              const dash = (d.percent / 100) * CIRCUMFERENCE;
              const gap = CIRCUMFERENCE - dash;
              const segment = (
                <circle
                  key={d.id}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="transparent"
                  stroke={d.color}
                  strokeWidth={STROKE}
                  strokeDasharray={`${dash} ${gap}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  style={{
                    transition: 'opacity 0.2s ease-in-out, stroke-width 0.2s ease-in-out',
                    opacity: hovered && hovered !== d.id ? 0.3 : 1,
                    strokeWidth: hovered === d.id ? STROKE + 4 : STROKE,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setHovered(d.id)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
              offset += dash;
              return segment;
            })}
          </svg>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <Typography sx={{ fontSize: 26, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
              {centerLabel.value}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{centerLabel.name}</Typography>
          </Box>
        </Box>

        {/* Legend */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          {DATA.map((d) => (
            <Box
              key={d.id}
              onMouseEnter={() => setHovered(d.id)}
              onMouseLeave={() => setHovered(null)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 0.75,
                borderRadius: 1,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease-in-out',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: 0.5,
                  bgcolor: d.color,
                  flexShrink: 0,
                }}
              />
              <Typography sx={{ fontSize: 12, color: 'text.tertiary', flex: 1 }} noWrap>
                {d.label}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.disabled', fontFamily: 'monospace' }}>
                {d.value}
              </Typography>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', minWidth: 48, textAlign: 'right' }}>
                {d.percent.toFixed(1)}%
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
