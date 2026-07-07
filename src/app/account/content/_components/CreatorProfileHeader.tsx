'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import EditIcon from '@mui/icons-material/Edit';
import ShareIcon from '@mui/icons-material/Share';
import SettingsIcon from '@mui/icons-material/Settings';
import StarIcon from '@mui/icons-material/Star';
import { useQuery } from '@tanstack/react-query';
import { getCreatorProfile, type CreatorBadge } from '@/apis/dashboard';
import { gradient2, gradient3 } from '@/constants/gradients';
import { alpha } from '@mui/material/styles';
import { DARK_BG } from '@/constants/gradients';
import { useActiveTab } from '../ActiveTabContext';

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  return n.toLocaleString();
}

// 简单的图标映射(后端存 icon name,前端按名渲染)
const BadgeIcon = ({ id }: { id: string }) => {
  if (id === 'star') return <StarIcon sx={{ fontSize: 14 }} />;
  return <StarIcon sx={{ fontSize: 14 }} />;
};

export default function CreatorProfileHeader() {
  const router = useRouter();
  const { setActiveTab } = useActiveTab();
  const [snack, setSnack] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ['creator-profile'],
    queryFn: () => getCreatorProfile(),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });

  if (query.isLoading) {
    return (
      <Box sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Skeleton variant="circular" width={88} height={88} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="40%" height={32} />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="80%" />
          </Box>
        </Box>
      </Box>
    );
  }

  if (query.isError || !query.data?.profile) {
    return (
      <Box sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
        <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>档案加载失败</Typography>
      </Box>
    );
  }

  const profile = query.data.profile;
  const badges: CreatorBadge[] = query.data.badges ?? [];

  const STATS = [
    { id: 'works', label: '作品', value: profile.works },
    { id: 'fans', label: '粉丝', value: profile.fans },
    { id: 'likes', label: '获赞', value: profile.likes },
    { id: 'follows', label: '关注', value: profile.follows },
  ];

  const handleEdit = () => router.push('/account/settings');
  const handleCreatorSettings = () => router.push('/account/settings');
  const handleStats = () => setActiveTab('data');

  const handleShare = async () => {
    const url = `${window.location.origin}/u/${profile.userId}`;
    try {
      await navigator.clipboard.writeText(url);
      setSnack('主页链接已复制');
    } catch {
      setSnack('复制失败,请手动复制');
    }
    setTimeout(() => setSnack(null), 2200);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
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
      <Box sx={{ position: 'absolute', top: -80, right: -40, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(254, 44, 85, 0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <Box sx={{ position: 'absolute', bottom: -60, left: '40%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(37, 244, 238, 0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: { xs: 2, md: 3 }, flexWrap: 'wrap' }}>
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <Box sx={{ width: { xs: 72, md: 88 }, height: { xs: 72, md: 88 }, borderRadius: '50%', padding: '3px', background: gradient3('#FE2C55', '#FFB400', '#25F4EE') }}>
            <Box sx={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: { xs: 28, md: 36 }, fontWeight: 700, color: 'text.primary', background: profile.avatar ? `url(${profile.avatar}) center/cover` : gradient2('#FE2C55', '#25F4EE') }}>
              {!profile.avatar && (profile.nickname?.charAt(0) || '?')}
            </Box>
          </Box>
          <Box sx={{ position: 'absolute', bottom: 0, right: 0, minWidth: 28, height: 22, borderRadius: 11, background: gradient2('#FE2C55', '#FF6B8A'), color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.75, border: '2px solid', borderColor: (theme) => (theme.palette.mode === 'dark' ? '#0A0B14' : theme.palette.background.paper) }}>
            Lv{profile.level}
          </Box>
        </Box>

        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: { xs: 18, md: 22 }, fontWeight: 700, color: 'text.primary' }}>
              {profile.nickname || '未设置昵称'}
            </Typography>
            {profile.douyinId && (
              <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>抖音号: {profile.douyinId}</Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
            {badges.map((b) => (
              <Box key={b.id} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.25, borderRadius: 0.75, bgcolor: `${b.color}1F`, color: b.color, fontSize: 10, fontWeight: 600, border: '1px solid', borderColor: `${b.color}40` }}>
                <BadgeIcon id={b.id} />
                <span>{b.label}</span>
              </Box>
            ))}
            {profile.levelName && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.25, borderRadius: 0.75, bgcolor: 'rgba(255, 180, 0, 0.12)', color: 'warning.main', fontSize: 10, fontWeight: 600 }}>
                <StarIcon sx={{ fontSize: 12 }} />
                <span>{profile.levelName}</span>
              </Box>
            )}
          </Box>

          {profile.signature && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.5 }}>
              {profile.signature}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          <Box onClick={handleEdit} sx={{ display: { xs: 'none', sm: 'inline-flex' }, alignItems: 'center', gap: 0.5, px: 1.5, py: 0.75, borderRadius: 1, bgcolor: 'transparent', border: '1px solid', borderColor: 'divider', color: 'text.tertiary', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s ease-in-out', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}>
            <EditIcon sx={{ fontSize: 14 }} />
            <span>编辑资料</span>
          </Box>
          <Box onClick={handleShare} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.75, borderRadius: 1, bgcolor: 'transparent', border: '1px solid', borderColor: 'divider', color: 'text.tertiary', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s ease-in-out', '&:hover': { borderColor: 'secondary.main', color: 'secondary.main' } }}>
            <ShareIcon sx={{ fontSize: 14 }} />
            <span>分享主页</span>
          </Box>
          <Box onClick={handleCreatorSettings} sx={{ display: { xs: 'none', md: 'inline-flex' }, alignItems: 'center', gap: 0.5, px: 1.5, py: 0.75, borderRadius: 1, bgcolor: 'transparent', border: '1px solid', borderColor: 'divider', color: 'text.tertiary', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s ease-in-out', '&:hover': { borderColor: 'warning.main', color: 'warning.main' } }}>
            <SettingsIcon sx={{ fontSize: 14 }} />
            <span>创作者设置</span>
          </Box>
        </Box>
      </Box>

      <Box sx={{ position: 'relative', mt: { xs: 2, md: 2.5 }, pt: { xs: 2, md: 2.5 }, borderTop: '1px dashed', borderColor: 'divider', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: { xs: 1, md: 2 } }}>
        {STATS.map((s, i) => (
          <Box key={s.id} onClick={handleStats} sx={{ textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s ease-in-out', borderRight: { xs: i < 3 ? '1px solid' : 'none', md: i < 3 ? '1px solid' : 'none' }, borderColor: 'divider', '&:hover': { color: 'primary.main' } }}>
            <Typography sx={{ fontSize: { xs: 16, md: 22 }, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
              {formatCount(s.value)}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>

      {snack && (
        <Box sx={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', bgcolor: 'rgba(0,0,0,0.85)', color: 'text.primary', px: 2, py: 1, borderRadius: 1, fontSize: 12 }}>
          {snack}
        </Box>
      )}
    </Box>
  );
}