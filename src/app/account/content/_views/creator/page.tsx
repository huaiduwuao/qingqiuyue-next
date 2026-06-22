'use client';

import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import ModeCommentRoundedIcon from '@mui/icons-material/ModeCommentRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import { accountClient } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';
import { alpha } from '@mui/material/styles';

type CreatorStats = {
  totalWorks: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  followers: number;
  following: number;
  daysActive: number;
  level: string;
  nextLevel: string;
  progressPct: number;
  badges: string[];
};

export default function CreatorPage() {
  const query = useQuery({
    queryKey: ['account', 'creator', 'stats'],
    queryFn: () => accountClient.get<CreatorStats>('/creator/stats').then((r) => r.data),
  });

  return (
    <AsyncState query={query} skeletonCount={1} skeletonHeight={420}>
      {(data) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Hero card with level */}
          <Box
            sx={{
              p: 3,
              borderRadius: 2.5,
              // 跟随品牌主色,深浅模式自适应
              background: (theme) =>
                theme.palette.mode === 'dark'
                  ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.18)} 0%, ${alpha(theme.palette.secondary.main, 0.18)} 100%)`
                  : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.10)} 0%, ${alpha(theme.palette.secondary.main, 0.10)} 100%)`,
              border: (theme) => `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.32 : 0.22)}`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -80,
                right: -80,
                width: 240,
                height: 240,
                borderRadius: '50%',
                background: (theme) =>
                  `radial-gradient(circle, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.16)} 0%, transparent 70%)`,
                pointerEvents: 'none',
              }}
            />
            <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: 2,
                  background: (theme) =>
                    `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <WorkspacePremiumRoundedIcon sx={{ fontSize: 32, color: (theme) => theme.palette.primary.contrastText }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
                  {data.level}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  已创作 {data.daysActive} 天,继续加油向 {data.nextLevel} 冲刺
                </Typography>
              </Box>
            </Box>

            <Box sx={{ position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>距离下一等级</Typography>
                <Typography sx={{ fontSize: 11, color: 'primary.main', fontWeight: 600 }}>{data.progressPct}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={data.progressPct}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    background: (theme) =>
                      `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    borderRadius: 3,
                  },
                }}
              />
            </Box>

            {data.badges.length > 0 && (
              <Box sx={{ position: 'relative', display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 2 }}>
                {data.badges.map((b) => (
                  <Chip
                    key={b}
                    label={b}
                    size="small"
                    sx={{
                      bgcolor: 'rgba(255,180,0,0.12)',
                      color: 'warning.main',
                      border: '1px solid rgba(255,180,0,0.3)',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          {/* Stats grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            <StatCard icon={<VideoLibraryRounded />} label="作品数" value={data.totalWorks.toString()} color="primary.main" />
            <StatCard icon={<VisibilityRoundedIcon />} label="总播放" value={formatNum(data.totalViews)} color="secondary.main" />
            <StatCard icon={<FavoriteRoundedIcon />} label="总点赞" value={formatNum(data.totalLikes)} color="warning.main" />
            <StatCard icon={<ModeCommentRoundedIcon />} label="总评论" value={formatNum(data.totalComments)} color="#8B5CF6" />
            <StatCard icon={<ShareRoundedIcon />} label="总分享" value={formatNum(data.totalShares)} color="success.main" />
            <StatCard icon={<GroupsRoundedIcon />} label="粉丝" value={data.followers.toString()} color="primary.main" />
            <StatCard icon={<PersonAddRoundedIcon />} label="关注" value={data.following.toString()} color="secondary.main" />
          </Box>
        </Box>
      )}
    </AsyncState>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s',
        '&:hover': { borderColor: color, transform: 'translateY(-2px)' },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: 60,
          height: 60,
          background: `radial-gradient(circle at top right, ${color}20 0%, transparent 70%)`,
          pointerEvents: 'none',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ color, display: 'flex', alignItems: 'center' }}>{icon}</Box>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'text.primary' }}>{value}</Typography>
    </Box>
  );
}

function VideoLibraryRounded() {
  return <Box sx={{ width: 20, height: 20, borderRadius: 0.5, bgcolor: 'primary.main' }} />;
}

function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}
