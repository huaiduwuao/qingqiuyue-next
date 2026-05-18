'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface RtViewerProps {
  value?: string;
}

export default function RtViewer({ value }: RtViewerProps) {
  return (
    <Box>
      <Typography component="div" dangerouslySetInnerHTML={{ __html: value || '' }} />
    </Box>
  );
}
