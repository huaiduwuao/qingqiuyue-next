'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import StarsIcon from '@mui/icons-material/Stars';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import {
  getUserPoint,
  listPointRecords,
  listAchievements,
  unlockAchievement,
  AchievementInfo,
  PointRecordInfo,
  UserPointResp,
} from '@/apis/system-user-point';

const MOCK_POINT: UserPointResp = { userId: 1001, points: 12580 };
const MOCK_RECORDS: PointRecordInfo[] = [
  { id: 1, userId: 1001, type: 'earn', points: 50, balance: 12580, description: '发布视频', createTime: '2026-06-04 10:23' },
  { id: 2, userId: 1001, type: 'earn', points: 30, balance: 12530, description: '收到点赞', createTime: '2026-06-04 09:15' },
  { id: 3, userId: 1001, type: 'consume', points: 100, balance: 12500, description: '兑换流量包', createTime: '2026-06-03 18:42' },
  { id: 4, userId: 1001, type: 'earn', points: 200, balance: 12600, description: '完成周任务', createTime: '2026-06-03 12:00' },
  { id: 5, userId: 1001, type: 'earn', points: 10, balance: 12400, description: '每日签到', createTime: '2026-06-02 08:30' },
];
const MOCK_ACHIEVEMENTS: AchievementInfo[] = [
  { id: 1, name: '新星创作者', description: '首次发布作品', icon: '⭐', unlocked: true, unlockedTime: '2026-01-10' },
  { id: 2, name: '百万播放', description: '单视频播放破百万', icon: '🏆', unlocked: true, unlockedTime: '2026-03-22' },
  { id: 3, name: '勤奋日更', description: '连续 30 天发布', icon: '🔥', unlocked: true, unlockedTime: '2026-05-01' },
  { id: 4, name: '话题制造机', description: '创作的话题上热搜', icon: '#️⃣', unlocked: false },
  { id: 5, name: '粉丝过万', description: '粉丝数突破 1 万', icon: '💎', unlocked: false },
  { id: 6, name: '原创大师', description: '原创作品超 100', icon: '🎨', unlocked: false },
];

const USER_ID = 1001;

export default function PointsPage() {
  const [tab, setTab] = useState<'overview' | 'records' | 'achievements'>('overview');

  const pointQuery = useQuery({
    queryKey: ['user-point', USER_ID],
    queryFn: () => getUserPoint(USER_ID).then((r: any) => r.data || MOCK_POINT),
    placeholderData: MOCK_POINT,
  });

  const recordsQuery = useQuery({
    queryKey: ['user-point-records', USER_ID],
    queryFn: () => listPointRecords({ userId: USER_ID, page: 1, pageSize: 20 }).then((r: any) => r.data?.list || r.data?.records || MOCK_RECORDS),
    placeholderData: MOCK_RECORDS,
  });

  const achievementsQuery = useQuery({
    queryKey: ['user-achievements', USER_ID],
    queryFn: () => listAchievements(USER_ID).then((r: any) => r.data?.list || MOCK_ACHIEVEMENTS),
    placeholderData: MOCK_ACHIEVEMENTS,
  });

  const point: UserPointResp = pointQuery.data || MOCK_POINT;
  const records: PointRecordInfo[] = recordsQuery.data || MOCK_RECORDS;
  const achievements: AchievementInfo[] = achievementsQuery.data || MOCK_ACHIEVEMENTS;

  const nextLevelPoints = 15000;
  const progress = Math.min(100, (point.points / nextLevelPoints) * 100);

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* 顶部概览卡 */}
      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          background: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
          color: 'text.primary',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StarsIcon />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              我的积分
            </Typography>
          </Box>
          <Chip
            label="Lv.5"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'text.primary', fontWeight: 700 }}
          />
        </Box>
        <Typography variant="h2" sx={{ fontWeight: 800 }}>
          {point.points.toLocaleString()}
        </Typography>
        <Typography sx={{ opacity: 0.85, fontSize: 13, mb: 1 }}>
          距离下一级还需 {(nextLevelPoints - point.points).toLocaleString()} 积分
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: 'rgba(255,255,255,0.2)',
            '& .MuiLinearProgress-bar': { bgcolor: 'text.primary' },
          }}
        />
      </Box>

      {/* Tab 切换 */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        {(['overview', 'records', 'achievements'] as const).map((t) => (
          <Button
            key={t}
            variant={tab === t ? 'contained' : 'outlined'}
            onClick={() => setTab(t)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              ...(tab === t && { bgcolor: 'primary.main', '&:hover': { bgcolor: '#E0264B' } }),
            }}
          >
            {t === 'overview' ? '积分总览' : t === 'records' ? '积分明细' : '成就墙'}
          </Button>
        ))}
      </Box>

      {tab === 'overview' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
          {[
            { label: '今日获得', value: 80, color: 'success.main' },
            { label: '本周获得', value: 580, color: 'secondary.main' },
            { label: '历史累计', value: 28420, color: 'warning.main' },
          ].map((s) => (
            <Box key={s.label} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid #252836' }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s.label}</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 700, color: s.color, mt: 0.5 }}>
                {s.value.toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {tab === 'records' && (
        <Box sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid #252836' }}>
          {records.map((r, idx) => (
            <Box
              key={r.id}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: idx < records.length - 1 ? '1px solid #252836' : 'none',
              }}
            >
              <Box>
                <Typography sx={{ fontSize: 14, fontWeight: 500, color: 'text.primary' }}>
                  {r.description || (r.type === 'earn' ? '获得积分' : '消耗积分')}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{r.createTime}</Typography>
              </Box>
              <Typography
                sx={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: r.type === 'consume' ? 'primary.main' : 'success.main',
                }}
              >
                {r.type === 'consume' ? '-' : '+'}
                {r.points}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {tab === 'achievements' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
          {achievements.map((a) => (
            <Box
              key={a.id}
              sx={{
                p: 2.5,
                borderRadius: 2,
                bgcolor: 'background.paper',
                border: '1px solid #252836',
                opacity: a.unlocked ? 1 : 0.55,
                textAlign: 'center',
              }}
            >
              <Typography sx={{ fontSize: 40 }}>{a.icon}</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', mt: 1 }}>
                {a.name}
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>{a.description}</Typography>
              {a.unlocked ? (
                <Chip
                  label={`已解锁 · ${a.unlockedTime}`}
                  size="small"
                  sx={{ mt: 1.5, bgcolor: 'rgba(93,219,150,0.15)', color: 'success.main', fontSize: 10 }}
                />
              ) : (
                <Button
                  size="small"
                  startIcon={<EmojiEventsIcon />}
                  onClick={() => unlockAchievement(USER_ID, a.id)}
                  sx={{ mt: 1.5, color: 'primary.main', fontSize: 11 }}
                >
                  解锁
                </Button>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
