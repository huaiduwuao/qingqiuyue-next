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
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import SummarizeRoundedIcon from '@mui/icons-material/SummarizeRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import {
  getUserPoint,
  listPointRecords,
  listAchievements,
  unlockAchievement,
  AchievementInfo,
  PointRecordInfo,
  UserPointResp,
} from '@/apis/system-user-point';
import { PointsMallTab } from './PointsMallTab';
import { LoginGate } from '@/components/auth/LoginGate';

const USER_ID = 1001;

export default function PointsPage() {
  const [tab, setTab] = useState<'overview' | 'records' | 'achievements' | 'mall'>('overview');

  const pointQuery = useQuery({
    queryKey: ['user-point', USER_ID],
    queryFn: () => getUserPoint(USER_ID).then((r: any) => r.data as UserPointResp | undefined),
  });

  const recordsQuery = useQuery({
    queryKey: ['user-point-records', USER_ID],
    queryFn: () => listPointRecords({ userId: USER_ID, page: 1, pageSize: 20 }).then((r: any) => (r.data?.list || r.data?.records || []) as PointRecordInfo[]),
  });

  const achievementsQuery = useQuery({
    queryKey: ['user-achievements', USER_ID],
    queryFn: () => listAchievements(USER_ID).then((r: any) => (r.data?.list || []) as AchievementInfo[]),
  });

  const point: UserPointResp = pointQuery.data || { userId: USER_ID, points: 0 };
  const records: PointRecordInfo[] = recordsQuery.data || [];
  const achievements: AchievementInfo[] = achievementsQuery.data || [];

  const nextLevelPoints = 15000;
  const progress = Math.min(100, (point.points / nextLevelPoints) * 100);

  return (
    <Box sx={{ height: '100dvh', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1400, mx: 'auto' }}>
        {/* 页面标题 */}
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          我的积分
        </Typography>

      <LoginGate mode="replace" message="登录后查看我的积分">

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
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
              My Points
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
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {([
          { key: 'overview', label: '积分总览', icon: <SummarizeRoundedIcon sx={{ fontSize: 16 }} /> },
          { key: 'records', label: '积分明细', icon: <ReceiptLongRoundedIcon sx={{ fontSize: 16 }} /> },
          { key: 'achievements', label: '成就墙', icon: <EmojiEventsIcon sx={{ fontSize: 16 }} /> },
          { key: 'mall', label: '积分商城', icon: <StorefrontRoundedIcon sx={{ fontSize: 16 }} /> },
        ] as const).map((t) => (
          <Button
            key={t.key}
            variant={tab === t.key ? 'contained' : 'outlined'}
            startIcon={t.icon}
            onClick={() => setTab(t.key)}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              ...(tab === t.key && { bgcolor: 'primary.main', '&:hover': { bgcolor: '#E0264B' } }),
            }}
          >
            {t.label}
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
            <Box key={s.label} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s.label}</Typography>
              <Typography sx={{ fontSize: 28, fontWeight: 700, color: s.color, mt: 0.5 }}>
                {s.value.toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {tab === 'records' && (
        <Box sx={{ borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
          {records.map((r, idx) => (
            <Box
              key={r.id}
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: idx < records.length - 1 ? '1px solid' : 'none',
                borderColor: 'divider',
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
                border: '1px solid', borderColor: 'divider',
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

      {tab === 'mall' && <PointsMallTab initialPoints={point.points} />}
      </LoginGate>
      </Box>
    </Box>
  );
}
