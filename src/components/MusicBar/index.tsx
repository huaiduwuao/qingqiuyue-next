'use client';

import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import Slider from '@mui/material/Slider';

export default function MusicBar() {
  const [playing, setPlaying] = React.useState(false);

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        backgroundColor: 'grey.200',
        display: 'flex',
        alignItems: 'center',
        px: 2,
        zIndex: 1100,
      }}
    >
      <IconButton onClick={() => setPlaying(!playing)}>
        {playing ? <PauseIcon /> : <PlayArrowIcon />}
      </IconButton>
      <Box sx={{ flex: 1, mx: 2 }}>
        <Typography variant="body2">未播放</Typography>
      </Box>
      <Box sx={{ width: 200 }}>
        <Slider size="small" />
      </Box>
    </Box>
  );
}
