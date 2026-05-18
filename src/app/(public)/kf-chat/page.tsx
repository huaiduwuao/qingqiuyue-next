'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import ContactTalk from '@/components/ContactTalk';

export default function KfChatPage() {
  const [open, setOpen] = useState(true);

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>客服聊天</Typography>
        <Typography color="text.secondary">点击右下角聊天图标开始对话</Typography>
      </Box>
      <ContactTalk open={open} onClose={() => setOpen(false)} />
    </Container>
  );
}
