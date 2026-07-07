'use client';

import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getCreatorContentDistribution, type ContentStat } from '@/apis/dashboard';

const SIZE = 200;
const RADIUS = 80;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ContentDistributionChart() {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const [dialogId, setDialogId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['creator-content-distribution'],
    queryFn: () => getCreatorContentDistribution(),
    staleTime: 60 * 1000,
    refetchOnMount: 'always',
  });

  const data = ((query.data?.records ?? query.data?.list ?? []) as ContentStat[]);
  const total = data.reduce((acc, d) => acc + d.count, 0);

  // 计算百分比(避免后端/前端不一致)
  const dataWithPercent = useMemo(
    () => data.map((d) => ({ ...d, percent: total > 0 ? (d.count / total) * 100 : 0 })),
    [data, total]
  );

  const hoveredItem = dataWithPercent.find((d) => d.type === hovered);
  const dialogItem = dataWithPercent.find((d) => d.type === dialogId);
  const centerLabel = hoveredItem
    ? { value: hoveredItem.percent.toFixed(1) + '%', name: hoveredItem.label }
    : { value: total.toString(), name: '总作品数' };

  const handleOpen = (id: string) => setDialogId(id);
  const handleClose = () => setDialogId(null);
  const handleNavigate = (id: string) => router.push(`/account/content/works?type=${id}`);

  const segments = useMemo(() => {
    return dataWithPercent.reduce<
      Array<{ id: string; color: string; dash: number; gap: number; offset: number }>
    >((acc, d) => {
      const dash = (d.percent / 100) * CIRCUMFERENCE;
      const gap = CIRCUMFERENCE - dash;
      const offset = acc.length === 0 ? 0 : acc[acc.length - 1].offset + acc[acc.length - 1].dash;
      acc.push({ id: d.type, color: d.color, dash, gap, offset });
      return acc;
    }, []);
  }, [dataWithPercent]);

  return (
    <>
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

        {query.isLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Skeleton variant="circular" width={SIZE} height={SIZE} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
          </Box>
        ) : query.isError ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>数据加载失败</Typography>
          </Box>
        ) : data.length === 0 ? (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>暂无作品数据</Typography>
          </Box>
        ) : (
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
                {segments.map((d) => (
                  <circle
                    key={d.id}
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="transparent"
                    stroke={d.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${d.dash} ${d.gap}`}
                    strokeDashoffset={-d.offset}
                    strokeLinecap="butt"
                    style={{
                      transition: 'opacity 0.2s ease-in-out, stroke-width 0.2s ease-in-out',
                      opacity: hovered && hovered !== d.id ? 0.3 : 1,
                      strokeWidth: hovered === d.id ? STROKE + 4 : STROKE,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={() => setHovered(d.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => handleOpen(d.id)}
                  />
                ))}
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
              {dataWithPercent.map((d) => (
                <Box
                  key={d.type}
                  onMouseEnter={() => setHovered(d.type)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleOpen(d.type)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 0.75,
                    borderRadius: 1,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease-in-out',
                    '&:hover': { bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover' },
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
                    {d.count}
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', minWidth: 48, textAlign: 'right' }}>
                    {d.percent.toFixed(1)}%
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>

      <Dialog open={!!dialogItem} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>{dialogItem?.label} 内容明细</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            {dialogItem?.label} 类内容共 {dialogItem?.count} 个,占比 {dialogItem?.percent.toFixed(1)}%。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>关闭</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (dialogId) handleNavigate(dialogId);
              handleClose();
            }}
          >
            查看列表
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}