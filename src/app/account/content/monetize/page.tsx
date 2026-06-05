'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import EarningsOverview from '../components/EarningsOverview';

export default function MonetizePage() {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
      }}
    >
      <EarningsOverview />
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 3,
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
          提现记录
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 2 }}>近 30 天提现流水</Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
          {[
            { date: '06/01', amount: 1200, status: '已到账' },
            { date: '05/25', amount: 850, status: '已到账' },
            { date: '05/18', amount: 640, status: '处理中' },
            { date: '05/11', amount: 1200, status: '已到账' },
            { date: '05/04', amount: 980, status: '已到账' },
          ].map((r, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.25,
                borderRadius: 1,
                bgcolor: '#1E2030',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1,
                  bgcolor: 'rgba(254, 44, 85, 0.12)',
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                }}
              >
                {r.date}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
                  提现到支付宝
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{r.status}</Typography>
              </Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'success.main', fontFamily: 'monospace' }}>
                +¥{r.amount}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
