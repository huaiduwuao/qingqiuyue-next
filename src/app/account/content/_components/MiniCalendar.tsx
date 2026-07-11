'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useActiveTab } from '../ActiveTabContext';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

interface Props {
  highlightDays?: number[];
}

export default function MiniCalendar({ highlightDays = [1, 2, 3, 4, 5, 6] }: Props) {
  // works 是 tab 而非路由:切 tab + 透传 date,不 router.push
  const { setActiveTab } = useActiveTab();
  const [year] = useState(2026);
  const [month, setMonth] = useState(6); // June = 6
  const [dialogDate, setDialogDate] = useState<string | null>(null);

  const firstDay = new Date(year, month - 1, 1).getDay();
  // Convert Sunday=0 to Monday=0 system
  const firstDayMon = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDayMon; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const handlePrev = () => {
    if (month === 1) setMonth(12);
    else setMonth(month - 1);
  };
  const handleNext = () => {
    if (month === 12) setMonth(1);
    else setMonth(month + 1);
  };

  const handleDateClick = (d: number) => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (highlightDays.includes(d)) {
      setDialogDate(dateStr);
    } else {
      setActiveTab('works', { date: dateStr });
    }
  };

  const today = 1;

  return (
    <>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary', flex: 1 }}>
            {`${year}年${month}月`}
          </Typography>
          <IconButton size="small" onClick={handlePrev} sx={{ color: 'text.secondary', p: 0.25 }}>
            <ChevronLeftIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" onClick={handleNext} sx={{ color: 'text.secondary', p: 0.25 }}>
            <ChevronRightIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* Weekday header */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.5 }}>
          {WEEKDAYS.map((w) => (
            <Box key={w} sx={{ textAlign: 'center', py: 0.5 }}>
              <Typography sx={{ fontSize: 10, color: 'text.disabled', fontWeight: 500 }}>
                {w}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Days grid */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.25 }}>
          {cells.map((d, idx) => {
            if (d === null) return <Box key={idx} sx={{ aspectRatio: '1' }} />;
            const isHighlight = highlightDays.includes(d);
            const isToday = d === today;
            return (
              <Box
                key={idx}
                onClick={() => handleDateClick(d)}
                sx={{
                  aspectRatio: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 0.75,
                  position: 'relative',
                  bgcolor: isToday ? 'primary.main' : isHighlight ? 'rgba(254, 44, 85, 0.15)' : 'transparent',
                  color: isToday ? 'text.primary' : isHighlight ? 'primary.main' : 'text.tertiary',
                  fontSize: { xs: 10, md: 12 },
                  fontWeight: isToday || isHighlight ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                  '&:hover': {
                    bgcolor: isToday ? 'primary.main' : 'rgba(255, 255, 255, 0.08)',
                  },
                }}
              >
                {d}
                {isHighlight && !isToday && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 2,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 3,
                      height: 3,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                    }}
                  />
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      <Dialog open={!!dialogDate} onClose={() => setDialogDate(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{dialogDate} 排期</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            该日期有已安排发布的内容。可前往作品管理查看详情。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogDate(null)}>关闭</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (dialogDate) setActiveTab('works', { date: dialogDate });
              setDialogDate(null);
            }}
          >
            查看作品
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
