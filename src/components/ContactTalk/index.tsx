'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import ChatIcon from '@mui/icons-material/Chat';

interface ContactTalkProps {
  open: boolean;
  onClose: () => void;
}

export default function ContactTalk({ open, onClose }: ContactTalkProps) {
  return (
    <>
      <IconButton
        onClick={onClose}
        sx={{ position: 'fixed', bottom: 80, right: 16, zIndex: 1000 }}
      >
        <ChatIcon />
      </IconButton>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            客服聊天
          </Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ height: 400, p: 2 }}>
          <Typography color="text.secondary">聊天内容</Typography>
        </Box>
      </Dialog>
    </>
  );
}
