'use client';

import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FemaleIcon from '@mui/icons-material/Female';
import MaleIcon from '@mui/icons-material/Male';
import Skeleton from '@mui/material/Skeleton';
import { useQuery } from '@tanstack/react-query';
import { getCreatorFanPortrait, type FanStat } from '@/apis/dashboard';

const SIZE = 140;
const RADIUS = 56;
const STROKE = 16;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function FanPortrait() {
  const [tab, setTab] = useState<'gender' | 'age' | 'region'>('gender');

  const query = useQuery({
    queryKey: ['creator-fan-portrait'],
    queryFn: () => getCreatorFanPortrait(),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  });

  const all = ((query.data?.records ?? query.data?.list ?? []) as FanStat[]);
  const genderData = useMemo(() => all.filter((s) => s.category === 'gender'), [all]);
  const ageData = useMemo(() => all.filter((s) => s.category === 'age'), [all]);
  const regionData = useMemo(() => all.filter((s) => s.category === 'region'), [all]);
  const maxAge = Math.max(...ageData.map((a) => a.value), 1);
  const totalFans = genderData.reduce((acc, g) => acc + g.value, 0); // 百分比求和即总粉(%)

  const isLoading = query.isLoading;
  const isError = query.isError;
  const isEmpty = !isLoading && !isError && all.length === 0;

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

      {isLoading ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Skeleton variant="rounded" width={SIZE + 100} height={SIZE} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
        </Box>
      ) : isError ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>数据加载失败</Typography>
        </Box>
      ) : isEmpty ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>暂无粉丝数据</Typography>
        </Box>
      ) : (
        <>
          {tab === 'gender' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
              <Box sx={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
                <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)' }}>
                  {genderData.map((g, i) => {
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
                  <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary' }}>
                    {totalFans > 0 ? totalFans.toFixed(1) + '%' : '—'}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>总占比</Typography>
                </Box>
              </Box>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {genderData.map((g) => (
                  <Box key={g.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.75, borderRadius: 1, bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF' }}>
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
                      {g.label === '女性' ? <FemaleIcon sx={{ fontSize: 16 }} /> : <MaleIcon sx={{ fontSize: 16 }} />}
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
              {ageData.map((a) => (
                <Box key={a.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', minWidth: 48, fontFamily: 'monospace' }}>
                    {a.label}
                  </Typography>
                  <Box sx={{ flex: 1, height: 18, bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF', borderRadius: 1, overflow: 'hidden', position: 'relative' }}>
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
              {regionData.map((r, i) => (
                <Box
                  key={r.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
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
                    {r.label}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', fontFamily: 'monospace' }}>
                    {r.value}%
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}