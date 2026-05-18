'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

interface SendToSpiderProps {
  url?: string;
  onSend?: (url: string) => void;
}

export default function SendToSpider({ url, onSend }: SendToSpiderProps) {
  const [inputUrl, setInputUrl] = React.useState(url || '');

  const handleSend = () => {
    if (onSend && inputUrl) {
      onSend(inputUrl);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <TextField
        size="small"
        placeholder="输入URL"
        value={inputUrl}
        onChange={(e) => setInputUrl(e.target.value)}
      />
      <Button variant="contained" onClick={handleSend}>
        发送到爬虫
      </Button>
    </Box>
  );
}
