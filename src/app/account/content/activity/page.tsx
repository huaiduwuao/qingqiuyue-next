'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { gradient2 } from '@/constants/gradients';

const ACTIVITIES = [
  { id: 1, title: '618 创作激励计划', tag: '进行中', heat: 9862, reward: '¥10w', end: '06/18', gradient: gradient2('#FE2C55', '#FFB400') },
  { id: 2, title: '夏日 vlog 挑战赛', tag: '报名中', heat: 7241, reward: 'iPhone 16 Pro', end: '07/01', gradient: gradient2('#25F4EE', '#5DF7F2') },
  { id: 3, title: '父亲节话题', tag: '进行中', heat: 4128, reward: '流量包', end: '06/21', gradient: gradient2('#8B5CF6', '#FE2C55') },
  { id: 4, title: '新星扶持计划', tag: '长期', heat: 5420, reward: '¥5,000', end: '长期', gradient: gradient2('#FFB400', '#FFD566') },
  { id: 5, title: '旅行打卡活动', tag: '报名中', heat: 3820, reward: '¥3,000', end: '07/15', gradient: gradient2('#5DDB96', '#25F4EE') },
  { id: 6, title: '美食探店计划', tag: '即将开始', heat: 2840, reward: '¥5,000', end: '07/10', gradient: gradient2('#FE2C55', '#8B5CF6') },
];

const TAG_COLORS: Record<string, string> = {
  进行中: 'primary.main',
  报名中: 'secondary.main',
  长期: 'warning.main',
  即将开始: '#8B5CF6',
};

export default function ActivityPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'signed'>('all');

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <EmojiEventsIcon sx={{ fontSize: 18, color: 'warning.main', mr: 1 }} />
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          活动管理
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 2 }}>
        浏览和参与平台官方活动，获取流量扶持与现金奖励
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        {([
          { id: 'all', label: '全部活动' },
          { id: 'active', label: '进行中' },
          { id: 'signed', label: '已报名' },
        ] as const).map((f) => (
          <Box
            key={f.id}
            onClick={() => setFilter(f.id)}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              bgcolor: filter === f.id ? 'rgba(254, 44, 85, 0.15)' : 'transparent',
              color: filter === f.id ? 'primary.main' : 'text.secondary',
              border: '1px solid',
              borderColor: filter === f.id ? 'rgba(254, 44, 85, 0.4)' : 'divider',
            }}
          >
            {f.label}
          </Box>
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        {ACTIVITIES.map((a) => (
          <Box
            key={a.id}
            sx={{
              borderRadius: 2,
              bgcolor: '#1E2030',
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': { transform: 'translateY(-2px)', borderColor: TAG_COLORS[a.tag] },
            }}
          >
            <Box
              sx={{
                height: 80,
                background: a.gradient,
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-end',
                p: 1.5,
              }}
            >
              <Chip
                label={a.tag}
                size="small"
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  height: 20,
                  bgcolor: 'rgba(255,255,255,0.95)',
                  color: TAG_COLORS[a.tag],
                  fontSize: 10,
                  fontWeight: 700,
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.75,
                  bgcolor: 'rgba(0, 0, 0, 0.4)',
                  color: 'text.primary',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                <LocalFireDepartmentIcon sx={{ fontSize: 11, color: 'warning.main' }} />
                {a.heat.toLocaleString()}
              </Box>
            </Box>
            <Box sx={{ p: 1.5 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                {a.title}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>截止 {a.end}</Typography>
                <Typography sx={{ fontSize: 11, color: 'warning.main', fontWeight: 700 }}>{a.reward}</Typography>
              </Box>
              <Button
                fullWidth
                size="small"
                variant={a.tag === '进行中' ? 'contained' : 'outlined'}
                sx={{
                  mt: 1.5,
                  bgcolor: a.tag === '进行中' ? 'primary.main' : 'transparent',
                  borderColor: 'divider',
                  color: a.tag === '进行中' ? 'text.primary' : 'text.tertiary',
                  fontSize: 11,
                  py: 0.5,
                  '&:hover': {
                    bgcolor: a.tag === '进行中' ? 'primary.dark' : 'rgba(255,255,255,0.05)',
                    borderColor: 'primary.main',
                  },
                }}
                endIcon={<ArrowForwardIosIcon sx={{ fontSize: 9 }} />}
              >
                {a.tag === '进行中' ? '立即参与' : '查看详情'}
              </Button>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
