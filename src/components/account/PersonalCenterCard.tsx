'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import { useAuthority } from '@/contexts/AuthContext';
import { gradient2, IMAGE_OVERLAY } from '@/constants/gradients';

export const PROFILE = {
  nickname: '怀独无傲',
  avatar: '',
  following: 131,
  followers: 23,
  likes: 2903,
};

const LIKES_PREVIEW = [
  { id: 'p1', title: '我哥就差这版', cover: gradient2('#C8A882', '#8B6F47') },
  { id: 'p2', title: '最近感觉发型', cover: gradient2('#A88B6F', '#5C4033') },
  { id: 'p3', title: '发现有几分辛', cover: gradient2('#D4B89A', '#8B5A3C') },
];

const SECTIONS = [
  { key: 'favorites', label: '我的收藏', count: '49', icon: <StarRoundedIcon sx={{ fontSize: 18, color: 'warning.main' }} /> },
  { key: 'history', label: '观看历史', count: '30天内', icon: <HistoryRoundedIcon sx={{ fontSize: 18, color: 'secondary.main' }} /> },
  { key: 'watchlater', label: '稍后再看', count: '2', icon: <WatchLaterIcon sx={{ fontSize: 18, color: '#8B5CF6' }} /> },
  { key: 'works', label: '我的作品', count: '0', icon: <VideoLibraryIcon sx={{ fontSize: 18, color: 'primary.main' }} /> },
  { key: 'reservation', label: '我的预约', icon: <EventNoteRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} /> },
  { key: 'orders', label: '我的订单', icon: <ReceiptLongIcon sx={{ fontSize: 18, color: '#5B8DEF' }} /> },
];

export interface PersonalCenterCardProps {
  compact?: boolean;
}

export function PersonalCenterCard({ compact = false }: PersonalCenterCardProps) {
  const [saveLogin, setSaveLogin] = useState(true);
  const router = useRouter();
  const { isAdmin } = useAuthority();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* === 资料头 === */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: compact ? 40 : 56,
            height: compact ? 40 : 56,
            borderRadius: '50%',
            flexShrink: 0,
            background: 'radial-gradient(circle at 35% 35%, #2a2a3a 0%, #0a0a0f 70%)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.05)',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              width: '70%',
              height: '70%',
              top: '15%',
              left: '15%',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #f5f5f0 0%, #d8d8d0 40%, #a8a8a0 80%)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              width: '62%',
              height: '62%',
              top: '18%',
              left: '26%',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 60% 40%, transparent 0%, rgba(10, 10, 15, 0.85) 60%)',
            }}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: compact ? 14 : 17, fontWeight: 600, color: 'text.primary', lineHeight: 1.2 }}>
              {PROFILE.nickname}
            </Typography>
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.5)', p: 0.25 }}>
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mt: 0.5,
              fontSize: 12,
              color: 'rgba(255, 255, 255, 0.6)',
            }}
          >
            <Box component="span">关注 {PROFILE.following}</Box>
            <Box component="span" sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.3)' }} />
            <Box component="span">粉丝 {PROFILE.followers}</Box>
          </Box>
        </Box>
      </Box>

      {/* === 我的喜欢 === */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
            <FavoriteRoundedIcon sx={{ fontSize: 14, color: 'primary.main' }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>我的喜欢</Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              fontSize: 11,
              '&:hover': { color: 'text.primary' },
            }}
          >
            <span>{PROFILE.likes}</span>
            <ChevronRightIcon sx={{ fontSize: 14 }} />
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
          {LIKES_PREVIEW.map((p) => (
            <Box
              key={p.id}
              sx={{
                position: 'relative',
                aspectRatio: '3/4',
                borderRadius: 1,
                background: p.cover,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-2px)' },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background: IMAGE_OVERLAY.LIGHT,
                },
              }}
            >
              <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 0.5, zIndex: 1 }}>
                <Typography sx={{ fontSize: 10, color: 'text.primary', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title}
                </Typography>
              </Box>
              <Box sx={{ position: 'absolute', bottom: 4, right: 4, zIndex: 1, display: 'flex', alignItems: 'center', gap: 0.25, color: 'text.primary', fontSize: 9, fontFamily: 'monospace' }}>
                <PlayArrowRoundedIcon sx={{ fontSize: 10 }} />
                12.3w
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* === 折叠列表 === */}
      <Box>
        {SECTIONS.map((s, idx) => (
          <Box
            key={s.key}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              py: 1.25,
              borderTop: idx === 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
              transition: 'background 0.15s',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
            }}
          >
            <Box sx={{ width: 24, height: 24, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.04)' }}>
              {s.icon}
            </Box>
            <Typography sx={{ fontSize: 13, color: 'text.primary', flex: 1 }}>{s.label}</Typography>
            {s.count && (
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{s.count}</Typography>
            )}
            <ChevronRightIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }} />
          </Box>
        ))}
      </Box>

      {/* === 管理后台(仅管理员) === */}
      {isAdmin && (
        <Box
          onClick={() => {
            const fullPath = window.location.pathname + window.location.search;
            sessionStorage.setItem('admin_entry_path', fullPath);
            router.push('/system/role');
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            py: 1.25,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer',
            transition: 'background 0.15s',
            '&:hover': { bgcolor: 'rgba(254, 44, 85, 0.06)' },
          }}
        >
          <Box sx={{ width: 24, height: 24, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(254, 44, 85, 0.12)' }}>
            <AdminPanelSettingsRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          </Box>
          <Typography sx={{ fontSize: 13, color: 'primary.main', flex: 1, fontWeight: 500 }}>管理后台</Typography>
          <ChevronRightIcon sx={{ fontSize: 14, color: 'primary.main' }} />
        </Box>
      )}

      {/* === 退出登录 + 保存登录信息 === */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 1 }}>
        <LogoutRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
        <Typography sx={{ fontSize: 13, color: 'primary.main', fontWeight: 500, flex: 1, cursor: 'pointer' }}>
          退出登录
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>保存登录信息</Typography>
          <Switch
            checked={saveLogin}
            onChange={(e) => setSaveLogin(e.target.checked)}
            size="small"
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'primary.main' },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
