'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface MdViewerProps {
  value?: string;
}

export default function MdViewer({ value }: MdViewerProps) {
  return (
    <Box sx={{ whiteSpace: 'pre-wrap' }}>
      <Typography component="pre">{value}</Typography>
    </Box>
  );
}
