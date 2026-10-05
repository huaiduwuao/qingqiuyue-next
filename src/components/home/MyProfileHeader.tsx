'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { toEntityId } from '@/lib/id';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import QrCodeRoundedIcon from '@mui/icons-material/QrCodeRounded';
import ShareButtons from '@/components/share/ShareButtons';
import { ACCENT } from '@/constants/accents';

/** 「我的」页顶部资料卡:头像、昵称、关注/粉丝/获赞、编辑资料 / 分享 / 二维码。memo:列表翻页、输入搜索词时不重渲染。 */
export const MyProfileHeader = React.memo(function MyProfileHeader({
  profile,
  currentUser,
  setEditOpen,
  setQrOpen,
}: {
  profile: any;
  currentUser: any;
  setEditOpen: (open: boolean) => void;
  setQrOpen: (open: boolean) => void;
}) {
  const router = useRouter();
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        // 手机上头像在左、资料在右一行排开(以前竖排,头像卡要占小半屏)
        flexDirection: 'row',
        gap: { xs: 1.5, sm: 2.5 },
        alignItems: 'flex-start',
        p: { xs: 1.5, sm: 2.5 },
        borderRadius: 2.5,
        bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
        border: '1px solid var(--border-color, transparent)',
        backdropFilter: 'blur(8px)',
        mb: { xs: 1, md: 2 },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: { xs: 60, sm: 80 },
          height: { xs: 60, sm: 80 },
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '1px solid',
              borderColor: 'rgba(212, 175, 55, 0.4)',
              animation: `moon-ripple 3.6s ease-out ${i * 1.2}s infinite`,
              '@keyframes moon-ripple': {
                '0%': { transform: 'scale(0.4)', opacity: 0.8 },
                '100%': { transform: 'scale(1.6)', opacity: 0 },
              },
            }}
          />
        ))}
        <Avatar
          src={profile?.user?.avatar || currentUser?.avatar}
          sx={{ width: { xs: 52, sm: 56 }, height: { xs: 52, sm: 56 }, position: 'relative', zIndex: 1, border: '2px solid', borderColor: 'warning.main' }}
        >
          {(profile?.user?.nickname || currentUser?.nickname || '我')[0]}
        </Avatar>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: { xs: 0.5, sm: 0.75 } }}>
          <Typography noWrap sx={{ fontSize: { xs: 17, sm: 20 }, fontWeight: 700, color: 'var(--text-primary, currentColor)', minWidth: 0 }}>
            {profile?.user?.nickname || currentUser?.nickname || currentUser?.name || '—'}
          </Typography>
          <Box sx={{ width: 16, height: 16, borderRadius: 0.5, bgcolor: 'rgba(255,180,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
          </Box>
        </Box>

        {/* 统计行:关注/粉丝/获赞 统一成 数字在上、标签在下 的抖音式列,窄屏不折行 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2.25, sm: 3 }, mb: { xs: 0, sm: 1 } }}>
          {[
            { label: '关注', value: profile?.stats?.following, href: '/account/center?section=following' },
            { label: '粉丝', value: profile?.stats?.followers, href: '/account/center?section=followers' },
            { label: '获赞', value: profile?.stats?.likes ?? 0, href: '/home/recommend?tab=me&mainTab=like' },
          ].map((s) => (
            <Box
              key={s.label}
              onClick={() => router.push(s.href)}
              sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25, cursor: 'pointer' }}
            >
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary, currentColor)', lineHeight: 1.1 }}>
                {s.value ?? '—'}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'var(--text-muted, currentColor)' }}>{s.label}</Typography>
            </Box>
          ))}
          <Box
            onClick={() => router.push('/home/recommend?tab=me&mainTab=live')}
            sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.5, ml: 'auto', cursor: 'pointer' }}
          >
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', animation: 'pulse 1.6s ease-in-out infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
            <Typography sx={{ fontSize: 11, color: 'primary.main', fontWeight: 600 }}>{profile?.stats?.lives ?? 0}人正在直播</Typography>
          </Box>
        </Box>

        {/* 手机上收起账号号码/年龄/地区这一行,头像卡只留名字、数据和按钮 */}
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 12, color: 'var(--text-secondary, currentColor)' }}>抖音号: {profile?.user?.douyinId ?? '—'}</Typography>
          {profile?.user?.age != null && (
            <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.75, bgcolor: 'rgba(91, 141, 239, 0.15)', border: '1px solid rgba(91, 141, 239, 0.3)' }}>
              <Typography sx={{ fontSize: 10, color: ACCENT.blue.main, fontWeight: 600 }}>{profile.user.age}岁</Typography>
            </Box>
          )}
          {profile?.user?.region && (
            <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.75, bgcolor: ACCENT.gold.soft12, border: `1px solid ${ACCENT.gold.border30}` }}>
              <Typography sx={{ fontSize: 10, color: ACCENT.gold.main, fontWeight: 600 }}>{profile.user.region}</Typography>
            </Box>
          )}
        </Box>

        {profile?.user?.bio && (
          <Typography noWrap sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 12, color: 'var(--text-secondary, currentColor)', mt: 0.5 }}>
            {profile.user.bio}
          </Typography>
        )}

        {/* Quick action buttons:窄屏三个等宽按钮独占一行,不再挤在名字下面乱折行 */}
        <Box sx={{ display: 'flex', gap: 1, mt: { xs: 1, sm: 1.5 }, '& .MuiButton-root': { minHeight: { xs: 30, sm: 'auto' }, py: { xs: 0.25, sm: undefined }, whiteSpace: 'nowrap', minWidth: 0 }, '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={() => setEditOpen(true)}
            sx={{ flex: 1, textTransform: 'none', fontSize: 12, borderRadius: 2, borderColor: 'var(--border-strong, transparent)', color: 'text.secondary' }}
          >
            编辑资料
          </Button>
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', '& > *': { flex: 1 } }}>
            <ShareButtons
              compact
              contentType="user"
              contentId={toEntityId(profile?.user?.id) ?? 0}
              title={profile?.user?.nickname || '我的主页'}
              url={typeof window !== 'undefined' ? window.location.href : ''}
              cover={profile?.user?.avatar}
              desc={profile?.user?.bio}
            />
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<QrCodeRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={() => setQrOpen(true)}
            sx={{ flex: 1, textTransform: 'none', fontSize: 12, borderRadius: 2, borderColor: 'var(--border-strong, transparent)', color: 'text.secondary' }}
          >
            二维码
          </Button>
        </Box>
      </Box>
    </Box>
  );
});
