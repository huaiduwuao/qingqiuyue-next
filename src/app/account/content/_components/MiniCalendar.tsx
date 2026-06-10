'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

interface Props {
  highlightDays?: number[];
}

export default function MiniCalendar({ highlightDays = [1, 2, 3, 4, 5, 6] }: Props) {
  const [year] = useState(2026);
  const [month, setMonth] = useState(6); // June = 6

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

  const today = 1;

  return (
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
  );
}
