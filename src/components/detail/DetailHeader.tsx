'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface Props {
  title: string;
  rightActions?: React.ReactNode;
  /**
   * 'glass'（默认，行为/外观与今天完全一致） | 'transparent'（透明+白字，与彩色 Hero 融合）。
   * 现有 12 个兄弟调用方都使用默认 'glass'，零改动。
   */
  variant?: 'glass' | 'transparent';
  /**
   * 强制 solid 玻璃态覆盖 variant；通常由父组件用 IntersectionObserver/scrollY 驱动。
   * 默认 false（保持玻璃态，与今天一致）。
   */
  forceSolid?: boolean;
  /**
   * 覆盖默认 router.back()。topic-detail 用它做 history.length 兜底跳转。
   * 不传时维持原有 router.back() 行为。
   */
  onBack?: () => void;
}

export default function DetailHeader({ title, rightActions, variant = 'glass', forceSolid = false, onBack }: Props) {
  const router = useRouter();
  const isSolid = variant === 'glass' || forceSolid;
  const handleBack = onBack ?? (() => router.back());

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        bgcolor: isSolid ? (theme) => alpha(theme.palette.background.paper, 0.85) : 'transparent',
        backdropFilter: isSolid ? 'blur(8px)' : 'none',
        borderBottom: isSolid ? '1px solid' : 'none',
        borderColor: 'divider',
        px: { xs: 'max(var(--sal, 0px), 12px)', md: 1.5 },
        pr: { xs: 'max(var(--sar, 0px), 12px)', md: 1.5 },
        py: 1,
        // Safe Area 顶部适配:必须是「自身间距 + 安全区」相加。
        // 原来写的是 max(env(...t, 8px), 8px) —— env() 一旦被支持但算出 0(安卓无刘海机型),
        // 括号里的 8px 兜底值根本不会生效,结果恒等于 8px,等于没适配。
        paddingTop: 'calc(8px + var(--sat, 0px))',
        // transparent ↔ solid 切换淡入，避免硬切突兀
        transition: 'background-color .25s ease, backdrop-filter .25s ease, border-color .25s ease',
      }}
    >
      <IconButton
        onClick={handleBack}
        aria-label="返回"
        sx={{
          color: isSolid ? 'text.tertiary' : '#fff',
          minWidth: 44,
          minHeight: 44,
          p: 1,
          borderRadius: 1.5,
          '&:hover': { bgcolor: isSolid ? 'action.hover' : 'rgba(255,255,255,0.15)' },
        }}
      >
        <ArrowBackIcon />
      </IconButton>
      <Typography
        sx={{
          fontSize: { xs: 14, md: 15 },
          fontWeight: 600,
          color: isSolid ? 'text.primary' : '#fff',
          ml: 1,
          flex: 1,
          // 不写 minWidth:0 的话 flex 子项最小宽度=整段标题,长标题会把右侧按钮挤出屏幕、撑宽整页
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        noWrap
      >
        {title}
      </Typography>
      {rightActions && <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{rightActions}</Box>}
    </Box>
  );
}