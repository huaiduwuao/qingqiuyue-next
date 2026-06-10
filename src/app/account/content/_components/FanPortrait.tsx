'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FemaleIcon from '@mui/icons-material/Female';
import MaleIcon from '@mui/icons-material/Male';

const GENDER = [
  { id: 'female', label: '女性', value: 68.4, color: 'primary.main' },
  { id: 'male', label: '男性', value: 31.6, color: 'secondary.main' },
];

const AGE = [
  { range: '<18', value: 6, color: 'secondary.light' },
  { range: '18-24', value: 38, color: 'secondary.main' },
  { range: '25-34', value: 34, color: 'primary.main' },
  { range: '35-44', value: 15, color: '#FF6B8A' },
  { range: '45+', value: 7, color: 'text.disabled' },
];

const REGION = [
  { name: '广东', value: 14.8 },
  { name: '江苏', value: 9.2 },
  { name: '浙江', value: 8.7 },
  { name: '山东', value: 7.5 },
  { name: '河南', value: 6.1 },
];

const SIZE = 140;
const RADIUS = 56;
const STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function FanPortrait() {
  const [tab, setTab] = useState<'gender' | 'age' | 'region'>('gender');
  const maxAge = Math.max(...AGE.map((a) => a.value));

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
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          粉丝画像
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>近 30 日</Typography>
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 2 }}>
        了解你的粉丝构成与分布
      </Typography>

      <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
        {([
          { id: 'gender', label: '性别' },
          { id: 'age', label: '年龄' },
          { id: 'region', label: '地域' },
        ] as const).map((t) => (
          <Box
            key={t.id}
            onClick={() => setTab(t.id)}
            sx={{
              flex: 1,
              textAlign: 'center',
              py: 0.5,
              borderRadius: 1,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              bgcolor: tab === t.id ? 'rgba(254, 44, 85, 0.15)' : 'transparent',
              color: tab === t.id ? 'primary.main' : 'text.secondary',
              border: '1px solid',
              borderColor: tab === t.id ? 'rgba(254, 44, 85, 0.4)' : 'divider',
              transition: 'all 0.15s ease-in-out',
            }}
          >
            {t.label}
          </Box>
        ))}
      </Box>

      {tab === 'gender' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          <Box sx={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
              {GENDER.map((g, i) => {
                const dash = (g.value / 100) * CIRCUMFERENCE;
                const gap = CIRCUMFERENCE - dash;
                return (
                  <circle
                    key={g.id}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="transparent"
                    stroke={g.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${dash} ${gap}`}
                    strokeDashoffset={-CIRCUMFERENCE * 0.25 * i}
                  />
                );
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
              }}
            >
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>12.8w</Typography>
              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>总粉丝</Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {GENDER.map((g) => (
              <Box key={g.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.75, borderRadius: 1, bgcolor: '#1E2030' }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 1,
                    bgcolor: `${g.color}1F`,
                    color: g.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {g.id === 'female' ? <FemaleIcon sx={{ fontSize: 16 }} /> : <MaleIcon sx={{ fontSize: 16 }} />}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{g.label}</Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>{g.value}%</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {tab === 'age' && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'center' }}>
          {AGE.map((a) => (
            <Box key={a.range} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', minWidth: 48, fontFamily: 'monospace' }}>
                {a.range}
              </Typography>
              <Box sx={{ flex: 1, height: 18, bgcolor: '#1E2030', borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
                <Box
                  sx={{
                    width: `${(a.value / maxAge) * 100}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${a.color}AA 0%, ${a.color} 100%)`,
                    borderRadius: 1,
                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    pr: 0.75,
                  }}
                >
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.primary' }}>{a.value}%</Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {tab === 'region' && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, justifyContent: 'center' }}>
          {REGION.map((r, i) => (
            <Box
              key={r.name}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1,
                borderRadius: 1,
                bgcolor: '#1E2030',
              }}
            >
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: 0.5,
                  bgcolor: i === 0 ? 'primary.main' : i < 3 ? '#FF6B8A' : 'divider',
                  color: 'text.primary',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {i + 1}
              </Box>
              <Typography sx={{ fontSize: 13, color: 'text.primary', flex: 1, fontWeight: 500 }}>
                {r.name}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', fontFamily: 'monospace' }}>
                {r.value}%
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
