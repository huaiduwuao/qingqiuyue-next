'use client';

/**
 * 成就中心页面
 * 展示用户已解锁和未解锁的成就
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import LockIcon from '@mui/icons-material/Lock';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { alpha } from '@mui/material/styles';
import { adminClient } from '@/lib/api/client';
import { useApp } from '@/contexts/AppContext';
import { ListLayout, LIST_ROW } from '@/components/common/ListLayout';

// 成就类型定义
interface Achievement {
  id: number;
  name: string;
  info: string;
  icon: string;
  unlocked: boolean;
  unlock_time?: number; // Unix 秒
  reward_point?: number;
}

// 我的成就(GET /api/core/point/achievements,后端按登录用户返回)。
// 成就由平台授予,用户不能自己点亮,所以这里只展示。
async function fetchAchievements(): Promise<Achievement[]> {
  const resp = await adminClient('/point/achievements');
  const data = resp?.data ?? resp;
  return Array.isArray(data) ? data : [];
}

// 成就图标映射
const ACHIEVEMENT_ICONS: Record<string, React.ReactNode> = {
  star: <StarIcon />,
  trophy: <EmojiEventsIcon />,
  check: <CheckCircleIcon />,
  default: <EmojiEventsIcon />,
};

export default function AchievementPage() {
  const { currentUser } = useApp();
  const currentUserId = currentUser?.id ?? 0;
  const { data: achievements = [], isLoading } = useQuery({
    queryKey: ['achievements', currentUserId],
    queryFn: fetchAchievements,
    enabled: !!currentUserId,
    staleTime: 60 * 1000,
  });

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const totalCount = achievements.length;
  const progressPercent = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  if (!currentUserId) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ color: 'text.secondary' }}>
          请先登录后查看成就
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* 成就概览卡片 */}
      <Box
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.16)} 0%, ${alpha(theme.palette.primary.main, 0.12)} 100%)`
              : `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.06)} 100%)`,
          border: '1px solid',
          borderColor: (theme) => alpha(theme.palette.warning.main, 0.3),
          p: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <EmojiEventsIcon sx={{ fontSize: 32, color: 'warning.main' }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              我的成就
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              已解锁 {unlockedCount} / {totalCount} 个成就
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={progressPercent}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': {
                  background: 'linear-gradient(90deg, #FFB400 0%, #FE2C55 100%)',
                  borderRadius: 4,
                },
              }}
            />
          </Box>
          <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'warning.main' }}>
            {progressPercent.toFixed(0)}%
          </Typography>
        </Box>
      </Box>

      {/* 成就网格 - 使用 Box grid 布局 */}
      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography sx={{ color: 'text.secondary' }}>加载中...</Typography>
        </Box>
      ) : achievements.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography sx={{ color: 'text.secondary' }}>暂无成就数据</Typography>
        </Box>
      ) : (
        <ListLayout minColumnWidth={280} gap={16}>
          {achievements.map((achievement) => (
            <Card
              key={achievement.id}
              sx={{
                opacity: achievement.unlocked ? 1 : 0.6,
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                },
              }}
            >
              <CardContent sx={{ [LIST_ROW]: { display: 'flex', alignItems: 'center', gap: 2 } }}>
                {/* 成就图标 */}
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                    bgcolor: achievement.unlocked
                      ? alpha('#FFB400', 0.15)
                      : 'action.hover',
                    color: achievement.unlocked ? 'warning.main' : 'text.disabled',
                    position: 'relative',
                    [LIST_ROW]: { mb: 0, flexShrink: 0 },
                  }}
                >
                  {ACHIEVEMENT_ICONS[achievement.icon] || ACHIEVEMENT_ICONS.default}
                  {!achievement.unlocked && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: -4,
                        right: -4,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        bgcolor: 'text.disabled',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <LockIcon sx={{ fontSize: 12, color: 'background.paper' }} />
                    </Box>
                  )}
                </Box>

                <Box sx={{ [LIST_ROW]: { flex: 1, minWidth: 0 } }}>
                  {/* 成就名称 */}
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {achievement.name}
                  </Typography>

                  {/* 成就描述 */}
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                    {achievement.info}
                  </Typography>

                  {/* 奖励和状态 */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {achievement.unlocked ? (
                      <Chip
                        icon={<CheckCircleIcon />}
                        label="已解锁"
                        size="small"
                        sx={{
                          bgcolor: alpha('#5DDB96', 0.15),
                          color: '#5DDB96',
                          '& .MuiChip-icon': { color: '#5DDB96' },
                        }}
                      />
                    ) : (
                      <Chip
                        icon={<StarIcon />}
                        label={`奖励 ${achievement.reward_point || 0} 积分`}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: 'warning.main', color: 'warning.main' }}
                      />
                    )}
                    {achievement.unlocked && achievement.unlock_time && (
                      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                        {new Date(achievement.unlock_time * 1000).toLocaleDateString('zh-CN')}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </ListLayout>
      )}
    </Box>
  );
}
