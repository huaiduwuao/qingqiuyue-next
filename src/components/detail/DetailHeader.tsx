'use client';

import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { alpha } from '@mui/material/styles';
import { useRouter } from 'next/navigation';

interface Props {
  title: string;
  rightActions?: React.ReactNode;
}

export default function DetailHeader({ title, rightActions }: Props) {
  const router = useRouter();
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.85),
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        px: { xs: 'max(env(safe-area-inset-left, 12px), 12px)', md: 1.5 },
        pr: { xs: 'max(env(safe-area-inset-right, 12px), 12px)', md: 1.5 },
        py: 1,
        // Safe Area 顶部适配
        paddingTop: 'max(env(safe-area-inset-top, 8px), 8px)',
      }}
    >
      <IconButton
        onClick={() => router.back()}
        aria-label="返回"
        sx={{
          color: 'text.tertiary',
          minWidth: 44,
          minHeight: 44,
          p: 1,
          borderRadius: 1.5,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <ArrowBackIcon />
      </IconButton>
      <Typography
        sx={{
          fontSize: { xs: 14, md: 15 },
          fontWeight: 600,
          color: 'text.primary',
          ml: 1,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        noWrap
      >
        {title}
      </Typography>
      {rightActions}
    </Box>
  );
}
