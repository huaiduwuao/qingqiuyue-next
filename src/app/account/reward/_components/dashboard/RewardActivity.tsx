'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HistoryIcon from '@mui/icons-material/History';

interface Activity {
  id: string;
  type: 'publish' | 'accept' | 'earn' | 'levelup';
  text: string;
  amount?: number;
  time: string;
}

const ACTIVITIES: Activity[] = [
  { id: 'a1', type: 'earn', text: '《夏日海岛》短视频已被采纳', amount: 5000, time: '2 小时前' },
  { id: 'a2', type: 'levelup', text: '恭喜升级到 Lv 5 赏金达人', time: '昨天 18:32' },
  { id: 'a3', type: 'accept', text: '已接受《城市夜景》悬赏任务', time: '昨天 14:20' },
  { id: 'a4', type: 'publish', text: '你发布了《寻国风插画师》悬赏', time: '2 天前' },
  { id: 'a5', type: 'earn', text: '《云端恋人》小说稿费到账', amount: 1200, time: '3 天前' },
  { id: 'a6', type: 'accept', text: '已接受《校园BGM》音乐悬赏', time: '5 天前' },
];

const TYPE_ICON: Record<string, React.ReactElement> = {
  publish: <HistoryIcon sx={{ fontSize: 12 }} />,
  accept: <HistoryIcon sx={{ fontSize: 12 }} />,
  earn: <TrendingUpIcon sx={{ fontSize: 12 }} />,
  levelup: <TrendingUpIcon sx={{ fontSize: 12 }} />,
};

const TYPE_COLOR: Record<string, string> = {
  publish: 'warning.main',
  accept: 'secondary.main',
  earn: 'success.main',
  levelup: 'primary.main',
};

export default function RewardActivity() {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid #252836',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          最近动态
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>共 {ACTIVITIES.length} 条</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {ACTIVITIES.map((a) => (
          <Box
            key={a.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1,
              borderRadius: 1,
              transition: 'all 0.2s',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
            }}
          >
            <Box
              sx={{
                width: 22,
                height: 22,
                borderRadius: 0.5,
                bgcolor: `${TYPE_COLOR[a.type]}1F`,
                color: TYPE_COLOR[a.type],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {TYPE_ICON[a.type]}
            </Box>
            <Typography sx={{ fontSize: 12, color: 'text.tertiary', flex: 1 }}>{a.text}</Typography>
            {a.amount !== undefined && (
              <Typography sx={{ fontSize: 12, color: 'success.main', fontWeight: 700, fontFamily: 'monospace' }}>
                +¥{a.amount.toLocaleString('zh-CN')}
              </Typography>
            )}
            <Typography sx={{ fontSize: 10, color: 'text.disabled', minWidth: 60, textAlign: 'right' }}>
              {a.time}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
