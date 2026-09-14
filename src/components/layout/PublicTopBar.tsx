'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import Avatar from '@mui/material/Avatar';
import { useApp } from '@/contexts/AppContext';
import { AvatarHoverPopup } from '@/components/account/AvatarHoverPopup';
import { gradient2 } from '@/constants/gradients';
import { ACCENT } from '@/constants/accents';

interface Props {
  /** 页面标题(返回键右侧)。 */
  title: string;
  /** 是否显示返回键(默认 true)。 */
  showBack?: boolean;
}

/**
 * PublicTopBar —— C 端独立页的顶部导航(返回 + 搜索 + 用户菜单)。
 *
 * 与首页 home/layout.tsx 的 TopBar 同一套视觉:sticky + 毛玻璃 + CSS 变量主题。
 * 用于 /topic、/feed 这类不在 home 布局里的独立页,补上返回/搜索/账号入口。
 */
export default function PublicTopBar({ title, showBack = true }: Props) {
  const router = useRouter();
  const { currentUser } = useApp();
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');

  const submit = () => {
    const q = draftRef.current.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        height: { xs: 56, md: 60 },
        px: { xs: 'max(env(safe-area-inset-left, 12px), 12px)', sm: 2, md: 3 },
        bgcolor: 'var(--bg-topbar, transparent)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color, transparent)',
        flexShrink: 0,
        paddingTop: 'var(--sat)',
      }}
    >
      {/* 返回 */}
      {showBack && (
        <Tooltip title="返回">
          <IconButton
            onClick={() => router.back()}
            aria-label="返回"
            sx={{
              color: 'var(--text-secondary, currentColor)',
              borderRadius: 1.5,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <ArrowBackRoundedIcon />
          </IconButton>
        </Tooltip>
      )}

      {/* 标题 */}
      <Typography
        sx={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text-primary, currentColor)',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </Typography>

      {/* 搜索框 */}
      <Box sx={{ flex: 1, maxWidth: { xs: 'none', md: 480 }, mx: { xs: 0.5, md: 2 }, minWidth: 0 }}>
        <TextField
          fullWidth
          size="small"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            draftRef.current = e.target.value;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="搜索你感兴趣的内容、创作者或话题"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: 'var(--text-muted, currentColor)' }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    disableElevation
                    size="small"
                    onClick={submit}
                    sx={{
                      minWidth: 0,
                      px: 1.5,
                      fontSize: 12,
                      borderRadius: 1,
                      background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                      color: '#fff',
                      '&:hover': { opacity: 0.9 },
                    }}
                  >
                    搜索
                  </Button>
                </InputAdornment>
              ),
              sx: {
                borderRadius: 2,
                bgcolor: 'var(--bg-input, transparent)',
                fontSize: 13,
                '& fieldset': { border: 'none' },
              },
            },
          }}
        />
      </Box>

      {/* 首页入口 */}
      <Tooltip title="回到首页">
        <IconButton
          onClick={() => router.push('/home/recommend')}
          aria-label="首页"
          sx={{
            color: 'var(--text-secondary, currentColor)',
            borderRadius: 1.5,
            display: { xs: 'none', sm: 'flex' },
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <HomeRoundedIcon />
        </IconButton>
      </Tooltip>

      {/* 用户菜单 */}
      {currentUser ? (
        <AvatarHoverPopup
          anchor={
            <IconButton size="small" sx={{ p: 0.5 }}>
              <Avatar
                src={currentUser.avatar}
                sx={{
                  width: { xs: 28, md: 32 },
                  height: { xs: 28, md: 32 },
                  background: gradient2('#FE2C55', ACCENT.purple.main),
                  fontSize: { xs: 11, md: 13 },
                  fontWeight: 700,
                }}
              >
                {currentUser.name?.[0] || 'U'}
              </Avatar>
            </IconButton>
          }
        />
      ) : (
        <Button
          size="small"
          variant="contained"
          onClick={() => router.push('/user/login')}
          sx={{
            borderRadius: 2,
            fontSize: 12,
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
          }}
        >
          登录
        </Button>
      )}
    </Box>
  );
}
