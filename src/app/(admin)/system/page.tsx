'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import { MENU_GROUPS as MENU_GROUPS_PUBLIC } from './menu-config';

export default function SystemIndexPage() {
  const router = useRouter();

  return (
    <Box>
      <Paper
        sx={{
          p: 4,
          mb: 3,
          background: 'linear-gradient(135deg, rgba(254, 44, 85, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%)',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2.5,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #25F4EE 0%, #FE2C55 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <AdminPanelSettingsRoundedIcon sx={{ fontSize: 32, color: 'background.default' }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
            系统管理控制台
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            管理平台用户、权限、资源与第三方集成配置。点击左侧菜单进入对应模块。
          </Typography>
        </Box>
      </Paper>

      {MENU_GROUPS_PUBLIC.map((group) => (
        <Box key={group.title} sx={{ mb: 3 }}>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              color: 'text.secondary',
              letterSpacing: 1,
              textTransform: 'uppercase',
              mb: 1.5,
            }}
          >
            {group.title}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            {group.items.map((item) => (
              <Paper
                key={item.id}
                variant="outlined"
                onClick={() => router.push(item.path)}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: item.accent, transform: 'translateY(-1px)' },
                }}
              >
                <Box sx={{ color: item.accent, display: 'flex', alignItems: 'center' }}>{item.icon}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }} noWrap>
                    {item.label}
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
