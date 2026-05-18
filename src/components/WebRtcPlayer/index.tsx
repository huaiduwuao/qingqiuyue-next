'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface WebRtcPlayerProps {
  src?: string;
}

export default function WebRtcPlayer({ src }: WebRtcPlayerProps) {
  return (
    <Box>
      {src ? (
        <video src={src} controls style={{ width: '100%' }} />
      ) : (
        <Typography color="text.secondary">无可用视频源</Typography>
      )}
    </Box>
  );
}
