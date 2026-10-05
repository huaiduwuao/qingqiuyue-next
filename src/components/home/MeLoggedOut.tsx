'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import { loginHref } from '@/lib/auth/redirect';
import { HomeSettingsDrawer } from '@/components/home/HomeSettingsDrawer';

export function MeLoggedOut() {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <>
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1.5,
        px: 3,
        py: 10,
        textAlign: 'center',
      }}
    >
      <Avatar sx={{ width: 72, height: 72, bgcolor: 'action.hover', color: 'text.secondary' }}>
        <PersonRoundedIcon sx={{ fontSize: 36 }} />
      </Avatar>
      <Typography sx={{ fontSize: 17, fontWeight: 700, color: 'text.primary', mt: 0.5 }}>
        登录后查看「我的」
      </Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.7, maxWidth: 320 }}>
        作品、收藏、书架、歌单、观看历史和稍后再看都在这里,换设备也跟着走。
      </Typography>
      <Button
        variant="contained"
        onClick={() => router.push(loginHref('/home/recommend?tab=me'))}
        sx={{ mt: 1.5, px: 4, borderRadius: 999, textTransform: 'none', fontWeight: 600 }}
      >
        登录 / 注册
      </Button>
      <Button
        variant="text"
        startIcon={<SettingsRoundedIcon />}
        onClick={() => setSettingsOpen(true)}
        sx={{ mt: 0.5, textTransform: 'none', color: 'text.secondary' }}
      >
        设置
      </Button>
    </Box>
    <HomeSettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
