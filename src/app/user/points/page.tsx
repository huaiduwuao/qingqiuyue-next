'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import StarsIcon from '@mui/icons-material/Stars';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import SummarizeRoundedIcon from '@mui/icons-material/SummarizeRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import {
  getUserPoint,
  listPointRecords,
  listAchievements,
  type AchievementInfo,
  type PointRecordInfo,
  type UserPointResp,
} from '@/apis/system-user-point';
import { PointsMallTab } from './PointsMallTab';
import { LoginGate } from '@/components/auth/LoginGate';
import { useApp } from '@/contexts/AppContext';

/** 积分流水类型的中文名,未知类型原样显示 */
const RECORD_TYPE_LABEL: Record<string, string> = {
  achievement: '成就奖励',
  admin_adjust: '平台调整',
  daily_task: '每日任务',
  mall_redeem: '商城兑换',
  sign: '签到',
};

const DAY_MS = 86_400_000;

export default function PointsPage() {
  const { currentUser } = useApp();
  const uid = currentUser?.id ?? 0;
  const [tab, setTab] = useState<'overview' | 'records' | 'achievements' | 'mall'>('overview');

  // 以下接口都按登录用户返回本人数据
  const pointQuery = useQuery({
    queryKey: ['user-point', uid],
    queryFn: () => getUserPoint().then((r: any) => (r?.data ?? null) as UserPointResp | null),
    enabled: !!uid,
  });
  const recordsQuery = useQuery({
    queryKey: ['user-point-records', uid],
    queryFn: () =>
      listPointRecords({ page: 1, pageSize: 100 }).then((r: any) => (r?.data?.records || r?.data?.list || []) as PointRecordInfo[]),
    enabled: !!uid,
  });
  const achievementsQuery = useQuery({
    queryKey: ['user-achievements', uid],
    queryFn: () =>
      listAchievements().then((r: any) => (Array.isArray(r?.data) ? r.data : r?.data?.list || []) as AchievementInfo[]),
    enabled: !!uid,
  });

  const available = pointQuery.data?.point ?? 0;
  const lifetime = pointQuery.data?.totalPoint ?? 0;
  const records = recordsQuery.data ?? [];
  const achievements = achievementsQuery.data ?? [];

  // 今日 / 近 7 天获得:由最近 100 条流水里的正数部分汇总
  const earned = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date(new Date().toDateString()).getTime();
    let today = 0;
    let week = 0;
    for (const r of records) {
      if (r.point <= 0 || !r.createTime) continue;
      const t = new Date(r.createTime).getTime();
      if (t >= startOfToday) today += r.point;
      if (now - t <= 7 * DAY_MS) week += r.point;
    }
    return { today, week };
  }, [records]);

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1400, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          我的积分
        </Typography>

        <LoginGate mode="replace" message="登录后查看我的积分">
          <Box sx={{ p: 3, borderRadius: 2, background: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)', color: '#fff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <StarsIcon />
              <Typography sx={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, opacity: 0.9 }}>
                可用积分
              </Typography>
            </Box>
            <Typography variant="h2" sx={{ fontWeight: 800 }}>
              {available.toLocaleString()}
            </Typography>
            <Typography sx={{ opacity: 0.85, fontSize: 13 }}>累计获得 {lifetime.toLocaleString()} 积分</Typography>
          </Box>

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
                sx={{ borderRadius: 2, textTransform: 'none' }}
              >
                {t.label}
              </Button>
            ))}
          </Box>

          {tab === 'overview' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
              {[
                { label: '今日获得', value: earned.today, color: 'success.main' },
                { label: '近 7 天获得', value: earned.week, color: 'secondary.main' },
                { label: '累计获得', value: lifetime, color: 'warning.main' },
              ].map((s) => (
                <Box key={s.label} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s.label}</Typography>
                  <Typography sx={{ fontSize: 28, fontWeight: 700, color: s.color, mt: 0.5 }}>{s.value.toLocaleString()}</Typography>
                </Box>
              ))}
            </Box>
          )}

          {tab === 'records' &&
            (records.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                还没有积分记录。完成奖励中心的每日任务即可获得积分。
              </Typography>
            ) : (
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
                      <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                        {r.info || RECORD_TYPE_LABEL[r.type] || r.type}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                        {r.createTime ? new Date(r.createTime).toLocaleString('zh-CN', { hour12: false }) : ''}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 18, fontWeight: 700, color: r.point < 0 ? 'primary.main' : 'success.main' }}>
                      {r.point > 0 ? '+' : ''}
                      {r.point}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ))}

          {tab === 'achievements' &&
            (achievements.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>平台还没有设置成就。</Typography>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                {achievements.map((a) => (
                  <Box
                    key={a.id}
                    sx={{
                      p: 2.5,
                      borderRadius: 2,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      opacity: a.unlocked ? 1 : 0.55,
                      textAlign: 'center',
                    }}
                  >
                    <EmojiEventsIcon sx={{ fontSize: 40, color: a.unlocked ? 'warning.main' : 'text.disabled' }} />
                    <Typography sx={{ fontSize: 14, fontWeight: 600, mt: 1 }}>{a.name}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>{a.info}</Typography>
                    <Chip
                      size="small"
                      sx={{ mt: 1.5, fontSize: 10 }}
                      color={a.unlocked ? 'success' : 'default'}
                      label={
                        a.unlocked && a.unlock_time
                          ? `已获得 · ${new Date(a.unlock_time * 1000).toLocaleDateString('zh-CN')}`
                          : `未获得 · 奖励 ${a.reward_point ?? 0} 积分`
                      }
                    />
                  </Box>
                ))}
              </Box>
            ))}

          {tab === 'mall' && <PointsMallTab initialPoints={available} />}
        </LoginGate>
      </Box>
    </Box>
  );
}
