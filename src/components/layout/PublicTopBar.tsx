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
import Container from '@mui/material/Container';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
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
  /** 标题左侧图标(默认 Collections)。 */
  icon?: React.ReactNode;
  /** 内容最大宽度(与下方内容容器对齐),默认 lg。 */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | false;
  /** 点击 Logo / 首页键去的地址,默认首页推荐流。 */
  homePath?: string;
}

/**
 * PublicTopBar —— C 端独立页的顶部导航(返回 + 标题 + 搜索 + 用户菜单)。
 *
 * 与首页 home/layout.tsx 的 TopBar 同一套视觉:sticky + 毛玻璃 + CSS 变量主题。
 * 内容用 Container 包住并与下方正文容器对齐(maxWidth 一致),导航与正文左右
 * 边缘齐平,不会再出现"导航通栏、正文居中、两边对不上"的违和感。
 */
export default function PublicTopBar({
  title,
  showBack = true,
  icon,
  maxWidth = 'lg',
  homePath = '/home/recommend?tab=home',
}: Props) {
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
        bgcolor: 'var(--bg-topbar, transparent)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color, transparent)',
        paddingTop: 'var(--sat)',
      }}
    >
      <Container maxWidth={maxWidth} disableGutters>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            height: { xs: 56, md: 64 },
            px: { xs: 'max(env(safe-area-inset-left, 12px), 12px)', sm: 2, md: 3 },
          }}
        >
          {/* 返回 */}
          {showBack && (
            <Tooltip title="返回">
              <IconButton
                onClick={() => {
                  // app/直接进该页时 history 里没有上一页,router.back() 会停在原地
                  // (尤其在 Tauri webview 里不存在浏览器历史),这时兜底回首页,
                  // 避免"返回键点了没反应"。
                  if (typeof window !== 'undefined' && window.history.length > 1) {
                    router.back();
                  } else {
                    router.push(homePath);
                  }
                }}
                aria-label="返回"
                sx={{
                  color: 'var(--text-secondary, currentColor)',
                  borderRadius: 1.5,
                  flexShrink: 0,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <ArrowBackRoundedIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* 回首页:无返回键时的固定入口,也作移动端的明确"回首页"按钮 */}
          {!showBack && (
            <Tooltip title="回到首页">
              <IconButton
                onClick={() => router.push(homePath)}
                aria-label="回到首页"
                sx={{
                  color: 'var(--text-secondary, currentColor)',
                  borderRadius: 1.5,
                  flexShrink: 0,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <HomeRoundedIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* Logo 图标 + 标题(点击回首页) */}
          <Box
            onClick={() => router.push(homePath)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              flexShrink: 0,
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 1.5,
                background: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)',
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(254,44,85,0.28)',
                flexShrink: 0,
              }}
            >
              {icon || <CollectionsRoundedIcon sx={{ fontSize: 19, color: '#fff' }} />}
            </Box>
            <Typography
              sx={{
                fontSize: { xs: 16, md: 17 },
                fontWeight: 700,
                color: 'var(--text-primary, currentColor)',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </Typography>
          </Box>

          {/* 搜索框:占满中间剩余空间,不再限制 480,网页版更宽 */}
          <Box sx={{ flex: 1, mx: { xs: 0.5, md: 2 }, minWidth: 0 }}>
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
                      <SearchIcon sx={{ fontSize: 17, color: 'var(--text-muted, currentColor)' }} />
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
                          px: 1.75,
                          borderRadius: 1,
                          background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                          color: '#fff',
                          fontSize: 12,
                          fontWeight: 600,
                          textTransform: 'none',
                          '&:hover': { opacity: 0.9 },
                        }}
                      >
                        搜索
                      </Button>
                    </InputAdornment>
                  ),
                  sx: {
                    height: { xs: 38, md: 42 },
                    borderRadius: 2,
                    bgcolor: 'var(--bg-input, transparent)',
                    color: 'var(--text-primary, currentColor)',
                    fontSize: { xs: 12, md: 13 },
                    '& input::placeholder': { color: 'var(--text-muted, currentColor)', opacity: 1 },
                    '& fieldset': { borderColor: 'var(--border-strong, transparent)' },
                    '&:hover fieldset': { borderColor: 'var(--text-disabled, currentColor)' },
                  },
                },
              }}
            />
          </Box>

          {/* 用户菜单 */}
          <Box sx={{ flexShrink: 0 }}>
            {currentUser ? (
              <AvatarHoverPopup
                anchor={
                  <IconButton size="small" sx={{ p: 0.5 }}>
                    <Avatar
                      src={currentUser.avatar}
                      sx={{
                        width: { xs: 30, md: 34 },
                        height: { xs: 30, md: 34 },
                        background: gradient2('#FE2C55', ACCENT.purple.main),
                        fontSize: { xs: 12, md: 13 },
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
                  px: 2,
                  background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                }}
              >
                登录
              </Button>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
