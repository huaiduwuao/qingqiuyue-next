'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

interface Props {
  title: string;
  description: string;
  features: string[];
  cta?: string;
}

export default function SectionPlaceholder({ title, description, features, cta = '申请内测' }: Props) {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: { xs: 3, md: 5 },
        border: '1px solid',
        borderColor: 'divider',
        position: 'relative',
        overflow: 'hidden',
        minHeight: 480,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      {/* Decorative gradient */}
      <Box
        sx={{
          position: 'absolute',
          top: -120,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 480,
          height: 240,
          background: 'radial-gradient(ellipse, rgba(254, 44, 85, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -80,
          right: -80,
          width: 240,
          height: 240,
          background: 'radial-gradient(circle, rgba(37, 244, 238, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          width: 96,
          height: 96,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #FE2C55 0%, #25F4EE 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 3,
          position: 'relative',
        }}
      >
        <RocketLaunchIcon sx={{ fontSize: 48, color: 'text.primary' }} />
      </Box>

      <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 700, color: 'text.primary', mb: 1 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', maxWidth: 480, mb: 4, lineHeight: 1.6 }}>
        {description}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 1.5,
          mb: 4,
          maxWidth: 600,
          width: '100%',
        }}
      >
        {features.map((f, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF'),
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: 'rgba(254, 44, 85, 0.15)',
                color: 'primary.main',
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {i + 1}
            </Box>
            <Typography sx={{ fontSize: 12, color: 'text.tertiary', textAlign: 'left' }}>{f}</Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button
          variant="contained"
          startIcon={<RocketLaunchIcon />}
          sx={{
            bgcolor: 'primary.main',
            color: 'text.primary',
            fontWeight: 600,
            px: 3,
            '&:hover': { bgcolor: 'primary.dark', transform: 'translateY(-1px)' },
          }}
        >
          {cta}
        </Button>
        <Button
          variant="outlined"
          sx={{
            borderColor: 'divider',
            color: 'text.tertiary',
            px: 3,
            '&:hover': { borderColor: 'secondary.main', color: 'secondary.main' },
          }}
        >
          查看教程
        </Button>
      </Box>
    </Box>
  );
}
