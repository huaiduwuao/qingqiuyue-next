'use client';

import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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
        bgcolor: 'rgba(10, 11, 20, 0.85)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #252836',
        px: 1.5,
        py: 1,
      }}
    >
      <IconButton onClick={() => router.back()} sx={{ color: 'text.tertiary' }}>
        <ArrowBackIcon />
      </IconButton>
      <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', ml: 1, flex: 1 }} noWrap>
        {title}
      </Typography>
      {rightActions}
    </Box>
  );
}
