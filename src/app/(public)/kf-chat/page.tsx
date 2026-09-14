'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ContactTalk from '@/components/ContactTalk';

export default function KfChatPage() {
  const [open, setOpen] = useState(false);

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 56px))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
      {/* 进入即打开聊天，无需额外页面 UI */}
      <ContactTalk open={open} onClose={() => setOpen(false)} />
    </Box>
  );
}
