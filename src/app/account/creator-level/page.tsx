'use client';


import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import { LoginGate } from '@/components/auth/LoginGate';
import { getCreatorLevelInfo, getScoreHistory, LEVEL_CONFIG, type CreatorLevelInfo, type ScoreHistory } from '@/apis/creator-level';

// 等级图标颜色
const LEVEL_COLORS: Record<number, string> = {
  1: '#90A4AE',
  2: '#4CAF50',
  3: '#2196F3',
  4: '#9C27B0',
  5: '#FFD700',
};

function LevelBadge({ level, size = 40 }: { level: number; size?: number }) {
  const config = LEVEL_CONFIG.find(l => l.level === level) || LEVEL_CONFIG[0];
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: LEVEL_COLORS[level] || '#90A4AE',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
        color: '#fff',
        fontWeight: 700,
        boxShadow: `0 0 12px ${LEVEL_COLORS[level]}40`,
      }}
    >
      {config.icon}
    </Box>
  );
}

function LevelCard({ info }: { info: CreatorLevelInfo }) {
  const config = LEVEL_CONFIG.find(l => l.level === info.level) || LEVEL_CONFIG[0];
  const nextConfig = info.nextLevel ? LEVEL_CONFIG.find(l => l.level === info.nextLevel?.level) : null;

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', mb: 2 }}>
      {/* 等级信息 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <LevelBadge level={info.level} size={64} />
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {info.levelName}
            </Typography>
            <Chip
              size="small"
              label={`Lv.${info.level}`}
              sx={{
                bgcolor: LEVEL_COLORS[info.level],
                color: '#fff',
                fontWeight: 700,
                fontSize: 11,
              }}
            />
          </Box>
          <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
            当前积分: <strong>{info.score}</strong>
          </Typography>
        </Box>
      </Box>

      {/* 升级进度 */}
      {nextConfig && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              距离 {nextConfig.name} ({nextConfig.minScore}分)
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'primary.main', fontWeight: 600 }}>
              {info.progress.toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(info.progress, 100)}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                bgcolor: LEVEL_COLORS[info.level],
                borderRadius: 4,
              },
            }}
          />
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* 统计数据 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
        {[
          { label: '发布', value: info.totalPublished },
          { label: '获赞', value: info.totalLikes },
          { label: '收藏', value: info.totalFavorites },
        ].map(stat => (
          <Box key={stat.label} sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'primary.main' }}>
              {stat.value.toLocaleString()}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              {stat.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

function PrivilegeCard({ info }: { info: CreatorLevelInfo }) {
  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        我的特权
      </Typography>
      <Stack spacing={1}>
        {info.privileges.map((p, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'action.hover',
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: LEVEL_COLORS[info.level],
              }}
            />
            <Typography sx={{ fontSize: 13 }}>{p}</Typography>
          </Box>
        ))}
      </Stack>

      {/* 下一等级特权预览 */}
      {info.nextLevel && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
            升级到 {info.nextLevel.name} 可解锁
          </Typography>
          <Stack spacing={0.5}>
            {info.nextLevel.privileges
              .filter(p => !info.privileges.includes(p))
              .slice(0, 3)
              .map((p, i) => (
                <Box
                  key={i}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    borderRadius: 1,
                    opacity: 0.6,
                  }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      bgcolor: 'action.disabled',
                    }}
                  />
                  <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{p}</Typography>
                </Box>
              ))}
          </Stack>
        </>
      )}
    </Paper>
  );
}

function LevelTable() {
  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        等级一览
      </Typography>
      <Stack spacing={1}>
        {LEVEL_CONFIG.map(l => (
          <Box
            key={l.level}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'action.hover',
            }}
          >
            <LevelBadge level={l.level} size={32} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 13 }}>
                Lv.{l.level} {l.name}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                {l.minScore} - {l.maxScore === 0 ? '∞' : l.maxScore} 分
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </Paper>
  );
}

function HistoryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['creator-level-history'],
    queryFn: () => getScoreHistory({ page: 1, pageSize: 50 }),
  });

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      publish: '发布内容',
      like: '获得点赞',
      favorite: '获得收藏',
      share: '获得分享',
      view: '获得阅读',
      violation: '违规扣分',
    };
    return map[type] || type;
  };

  const getTypeColor = (type: string, delta: number) => {
    if (delta < 0) return '#FE2C55';
    if (type === 'publish') return '#2196F3';
    if (type === 'like') return '#FE2C55';
    if (type === 'favorite') return '#FFB400';
    if (type === 'share') return '#5DDB96';
    return '#8B5CF6';
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper' }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        积分明细
      </Typography>
      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>加载中...</Box>
      ) : (
        <Stack spacing={1}>
          {data?.records?.map((record: ScoreHistory) => (
            <Box
              key={record.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'action.hover',
              }}
            >
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: getTypeColor(record.type, record.delta) + '20',
                  color: getTypeColor(record.type, record.delta),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {record.delta > 0 ? '+' : ''}{record.delta}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                  {getTypeLabel(record.type)}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {record.reason || new Date(record.createdAt).toLocaleDateString()}
                </Typography>
              </Box>
            </Box>
          ))}
          {(!data?.records || data.records.length === 0) && (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              暂无记录
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
}

export default function CreatorLevelPage() {
  const [tab, setTab] = useState(0);

  const { data: levelInfo, isLoading } = useQuery({
    queryKey: ['creator-level-info'],
    queryFn: getCreatorLevelInfo,
    staleTime: 60 * 1000,
  });

  return (
    <Box
      sx={{
        height: 'calc(100dvh - var(--appbar-h, 66px))',
        overflow: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      <Box sx={{ maxWidth: 600, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <LoginGate mode="replace" message="登录后查看创作者等级">
          {isLoading ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>加载中...</Box>
          ) : levelInfo ? (
            <>
              <LevelCard info={levelInfo} />
              <PrivilegeCard info={levelInfo} />

              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                sx={{ mb: 2 }}
              >
                <Tab label="等级一览" />
                <Tab label="积分明细" />
              </Tabs>

              {tab === 0 && <LevelTable />}
              {tab === 1 && <HistoryTab />}
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
              暂无数据
            </Box>
          )}
        </LoginGate>
      </Box>
    </Box>
  );
}
