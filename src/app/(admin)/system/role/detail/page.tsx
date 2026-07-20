'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

export default function RoleDetailClient() {
  const searchParams = useSearchParams();
  const roleId = searchParams.get('id');

  return (
    <Box sx={{ p: 3 }}>
      <Typography>角色配置详情: {roleId}</Typography>
    </Box>
  );
}
