'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { alpha } from '@mui/material/styles';
import VerifiedIcon from '@mui/icons-material/Verified';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import StarIcon from '@mui/icons-material/Star';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import SettingsIcon from '@mui/icons-material/Settings';
import { gradient2, gradient3, DARK_BG } from '@/constants/gradients';

const PROFILE = {
  nickname: '清秋月月鸟',
  douyinId: 'qingqiuyue',
  avatar: '',
  level: 6,
  levelName: '王牌创作者',
  fans: 128493,
  follows: 218,
  likes: 1842093,
  works: 247,
  signature: '记录日常，分享生活。合作请私信',
  badges: [
    { id: 'verified', icon: <VerifiedIcon sx={{ fontSize: 14 }} />, color: 'secondary.main', label: '官方认证' },
    { id: 'hot', icon: <WhatshotIcon sx={{ fontSize: 14 }} />, color: 'primary.main', label: '本月热门' },
    { id: 'star', icon: <StarIcon sx={{ fontSize: 14 }} />, color: 'warning.main', label: '优质创作者' },
  ],
};

const STATS = [
  { id: 'works', label: '作品', value: PROFILE.works },
  { id: 'fans', label: '粉丝', value: PROFILE.fans },
  { id: 'likes', label: '获赞', value: PROFILE.likes },
  { id: 'follows', label: '关注', value: PROFILE.follows },
];

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toLocaleString();
}

export default function CreatorProfileHeader() {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        // 深色模式保留原深沉渐变;浅色模式用品牌色淡 tint + 浅背景,跟随主题色
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? DARK_BG.DEEP_NIGHT
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.10)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 50%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
        borderRadius: 2,
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.18),
        p: { xs: 2, md: 3 },
      }}
    >
      {/* Decorative gradient blobs */}
      <Box
        sx={{
          position: 'absolute',
          top: -80,
          right: -40,
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(254, 44, 85, 0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -60,
          left: '40%',
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37, 244, 238, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: { xs: 2, md: 3 }, flexWrap: 'wrap' }}>
        {/* Avatar with level ring */}
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Box
            sx={{
              width: { xs: 72, md: 88 },
              height: { xs: 72, md: 88 },
              borderRadius: '50%',
              padding: '3px',
              background: gradient3('#FE2C55', '#FFB400', '#25F4EE'),
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                bgcolor: (theme) => (theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: { xs: 28, md: 36 },
                fontWeight: 700,
                color: 'text.primary',
                background: PROFILE.avatar
                  ? `url(${PROFILE.avatar}) center/cover`
                  : gradient2('#FE2C55', '#25F4EE'),
              }}
            >
              {!PROFILE.avatar && PROFILE.nickname.charAt(0)}
            </Box>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              minWidth: 28,
              height: 22,
              borderRadius: 11,
              background: gradient2('#FE2C55', '#FF6B8A'),
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 0.75,
              // 边框跟当前卡片背景一致,浅色模式下不再是突兀的深色描边
              border: '2px solid',
              borderColor: (theme) => theme.palette.mode === 'dark' ? '#0A0B14' : theme.palette.background.paper,
            }}
          >
            Lv{PROFILE.level}
          </Box>
        </Box>

        {/* Info */}
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: { xs: 18, md: 22 }, fontWeight: 700, color: 'text.primary' }}>
              {PROFILE.nickname}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>抖音号: {PROFILE.douyinId}</Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
            {PROFILE.badges.map((b) => (
              <Tooltip key={b.id} title={b.label}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.25,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.75,
                    bgcolor: `${b.color}1F`,
                    color: b.color,
                    fontSize: 10,
                    fontWeight: 600,
                    border: '1px solid',
                    borderColor: `${b.color}40`,
                  }}
                >
                  {b.icon}
                  <span>{b.label}</span>
                </Box>
              </Tooltip>
            ))}
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                px: 0.75,
                py: 0.25,
                borderRadius: 0.75,
                bgcolor: 'rgba(255, 180, 0, 0.12)',
                color: 'warning.main',
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              <StarIcon sx={{ fontSize: 12 }} />
              <span>{PROFILE.levelName}</span>
            </Box>
          </Box>

          <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
            {PROFILE.signature}
          </Typography>
        </Box>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Box
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.75,
              borderRadius: 1,
              bgcolor: 'transparent',
              border: '1px solid',
              borderColor: 'divider',
              color: 'text.tertiary',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
            }}
          >
            <EditIcon sx={{ fontSize: 14 }} />
            <span>编辑资料</span>
          </Box>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.75,
              borderRadius: 1,
              bgcolor: 'transparent',
              border: '1px solid',
              borderColor: 'divider',
              color: 'text.tertiary',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': { borderColor: 'secondary.main', color: 'secondary.main' },
            }}
          >
            <ShareIcon sx={{ fontSize: 14 }} />
            <span>分享主页</span>
          </Box>
          <Box
            sx={{
              display: { xs: 'none', md: 'inline-flex' },
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.75,
              borderRadius: 1,
              bgcolor: 'transparent',
              border: '1px solid',
              borderColor: 'divider',
              color: 'text.tertiary',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': { borderColor: 'warning.main', color: 'warning.main' },
            }}
          >
            <SettingsIcon sx={{ fontSize: 14 }} />
            <span>创作者设置</span>
          </Box>
        </Box>
      </Box>

      {/* Stats row */}
      <Box
        sx={{
          position: 'relative',
          mt: { xs: 2, md: 2.5 },
          pt: { xs: 2, md: 2.5 },
          borderTop: '1px dashed',
          borderColor: 'divider',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: { xs: 1, md: 2 },
        }}
      >
        {STATS.map((s, i) => (
          <Box
            key={s.id}
            sx={{
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              borderRight: { xs: i < 3 ? '1px solid' : 'none', md: i < 3 ? '1px solid' : 'none' },
              borderColor: 'divider',
              '&:hover': { color: 'primary.main' },
            }}
          >
            <Typography sx={{ fontSize: { xs: 16, md: 22 }, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
              {formatCount(s.value)}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
