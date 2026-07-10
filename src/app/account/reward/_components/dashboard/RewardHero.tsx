'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import { alpha } from '@mui/material/styles';
import { DARK_BG } from '@/constants/gradients';

interface RewardHeroProps {
  totalPoint: number;
  level: number;
  levelName: string;
  needPoint: number;
}

export default function RewardHero({ totalPoint, level, levelName, needPoint }: RewardHeroProps) {
  const target = totalPoint + needPoint;
  const percent = target > 0 ? (totalPoint / target) * 100 : 0;

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        // 深色模式保留原深沉紫蓝;浅色模式用 primary.main 淡 tint 渐变,
        // 跟全局主题色一致,不再"浅色下也黑乎乎"
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? DARK_BG.PURPLE_BLUE
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.10)} 0%, ${alpha(theme.palette.secondary.main, 0.10)} 100%)`,
        border: '1px solid',
        borderColor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.18),
        p: { xs: 2, md: 3 },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          right: -40,
          top: -40,
          width: 220,
          height: 220,
          borderRadius: '50%',
          // 右上光晕:跟随主品牌色
          background: (theme) =>
            `radial-gradient(circle, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.25 : 0.16)} 0%, transparent 70%)`,
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          left: -30,
          bottom: -30,
          width: 180,
          height: 180,
          borderRadius: '50%',
          // 左下光晕:青色是平台视觉识别色,保留
          background: 'radial-gradient(circle, rgba(37, 244, 238, 0.18) 0%, transparent 70%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ position: 'relative', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'center' }, gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <CardGiftcardIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography sx={{ fontSize: 11, color: 'text.secondary', letterSpacing: 1 }}>赏金猎人中心</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 14, color: 'text.tertiary' }}>{levelName || '赏金新手'}</Typography>
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1,
                // 等级徽章:主品牌色 + warning 黄(黄是平台视觉识别色,保留)
                background: (theme) => `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.warning.main} 100%)`,
                color: (theme) => theme.palette.primary.contrastText,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: 'monospace',
              }}
            >
              Lv {level || 0}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 1.5 }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>当前灵气</Typography>
            <Typography sx={{ fontSize: 30, fontWeight: 700, color: 'text.primary', fontFamily: 'monospace', lineHeight: 1 }}>
              {(totalPoint || 0).toLocaleString('zh-CN')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
            <Box sx={{ flex: 1, maxWidth: 360 }}>
              <LinearProgress
                variant="determinate"
                value={percent}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    // 主品牌色 → warning 黄(黄是平台识别色)
                    background: (theme) => `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.warning.main} 100%)`,
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
            <Typography sx={{ fontSize: 10, color: 'text.secondary', fontFamily: 'monospace' }}>
              {(totalPoint || 0).toLocaleString()} / {target.toLocaleString()}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.75 }}>
            距离 Lv {(level || 0) + 1} 还需 <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>{(needPoint || 0).toLocaleString()}</Box> 灵气
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 1.5,
            minWidth: { md: 320 },
          }}
        >
          {[
            { icon: <WhatshotIcon sx={{ fontSize: 18 }} />, label: '今日赏金', value: '¥1,280', color: 'primary.main' },
            { icon: <StarIcon sx={{ fontSize: 18 }} />, label: '已采纳', value: '24', color: 'warning.main' },
            { icon: <EmojiEventsIcon sx={{ fontSize: 18 }} />, label: '排行榜', value: '#18', color: 'secondary.main' },
            { icon: <TrendingUpIcon sx={{ fontSize: 18 }} />, label: '累计收入', value: '¥12,460', color: 'success.main' },
          ].map((s) => (
            <Box
              key={s.label}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1,
                  bgcolor: `${s.color}1F`,
                  color: s.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.icon}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.1 }}>{s.label}</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary', fontFamily: 'monospace' }}>
                  {s.value}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
