'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Fab from '@mui/material/Fab';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import ContactTalk from '@/components/ContactTalk';

export default function KfChatPage() {
  const [showContact, setShowContact] = useState(false);

  return (
    <Container maxWidth="lg">
      <Box sx={{ position: 'relative', py: { xs: 2, md: 4 } }}>
        <Typography variant="h4" sx={{ mb: 3 }}>客服聊天</Typography>
        <Typography color="text.secondary">点击右下角聊天图标开始对话</Typography>

        <Fab
          color="primary"
          aria-label={showContact ? '关闭客服' : '打开客服'}
          onClick={() => setShowContact((s) => !s)}
          sx={{
            position: 'fixed',
            right: { xs: 16, md: 32 },
            bottom: { xs: 16, md: 32 },
            zIndex: 1200,
          }}
        >
          {showContact ? <CloseIcon /> : <ChatIcon />}
        </Fab>
      </Box>
      <ContactTalk open={showContact} onClose={() => setShowContact(false)} />
    </Container>
  );
}
