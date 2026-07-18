'use client';

/**
 * 沙盒管理中心
 * 镜像管理和任务执行
 */

import React, { Suspense, lazy, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Skeleton from '@mui/material/Skeleton';
import { useTheme, alpha } from '@mui/material/styles';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import PsychologyAltRoundedIcon from '@mui/icons-material/PsychologyAltRounded';

const ImagesPage = lazy(() => import('./images/page'));
const TasksPage = lazy(() => import('./tasks/page'));

export type SandboxTabKey = 'images' | 'tasks';

interface SandboxTabConfig {
  key: SandboxTabKey;
  label: string;
  icon: React.ReactNode;
}

const SANDBOX_TABS: SandboxTabConfig[] = [
  { key: 'images', label: '镜像管理', icon: <TerminalRoundedIcon fontSize="small" /> },
  { key: 'tasks', label: '任务管理', icon: <PsychologyAltRoundedIcon fontSize="small" /> },
];

const componentMap: Record<string, React.ComponentType<any>> = {
  images: ImagesPage,
  tasks: TasksPage,
};

export default function SandboxAdminPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [tab, setTab] = useState(0);
  const currentType = SANDBOX_TABS[tab];
  const ContentComponent = componentMap[currentType?.key];

  const accent = '#25F4EE'; // 青色主题
  const secondary = '#8B5CF6'; // 紫色

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 1400, mx: 'auto', width: '100%' }}>
      {/* Hero banner */}
      <Paper
        sx={{
          position: 'relative',
          overflow: 'hidden',
          p: { xs: 2.5, md: 3.5 },
          borderRadius: 2,
          border: '1px solid',
          borderColor: isDark ? alpha(theme.palette.text.primary, 0.06) : alpha('#000000', 0.06),
          background: isDark
            ? `linear-gradient(135deg, ${alpha(accent, 0.18)} 0%, ${alpha(secondary, 0.10)} 60%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`
            : `linear-gradient(135deg, ${alpha(accent, 0.10)} 0%, ${alpha(secondary, 0.08)} 60%, ${alpha(theme.palette.text.primary, 0.6)} 100%)`,
        }}
      >
        {/* Decorative orbs */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: -60,
            right: -60,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(accent, 0.25)} 0%, transparent 70%)`,
            filter: 'blur(20px)',
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            bottom: -80,
            left: '40%',
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(secondary, 0.18)} 0%, transparent 70%)`,
            filter: 'blur(24px)',
          }}
        />

        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            alignItems: { md: 'center' },
            justifyContent: 'space-between',
          }}
        >
          {/* Left: title + subtitle */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${accent} 0%, ${secondary} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 8px 24px ${alpha(accent, 0.35)}`,
                flexShrink: 0,
              }}
            >
              <TerminalRoundedIcon sx={{ color: 'text.primary', fontSize: 32 }} />
            </Box>
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, fontSize: { xs: '1.25rem', md: '1.5rem' } }}
              >
                沙盒管理中心
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                镜像管理与在线代码执行 · 支持自定义 Dockerfile 与多语言运行时
              </Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: isDark ? alpha(theme.palette.text.primary, 0.06) : alpha('#000000', 0.06),
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            px: 1,
            minHeight: 52,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 52,
              fontWeight: 600,
              fontSize: 14,
              color: 'text.secondary',
              textTransform: 'none',
              px: 2.5,
              '&.Mui-selected': { color: accent },
            },
            '& .MuiTabs-indicator': {
              height: 3,
              borderRadius: '3px 3px 0 0',
              bgcolor: accent,
            },
          }}
        >
          {SANDBOX_TABS.map((type) => (
            <Tab key={type.key} label={type.label} icon={type.icon} iconPosition="start" />
          ))}
        </Tabs>
      </Paper>

      {/* Content */}
      <Box>
        {ContentComponent ? (
          <Suspense
            fallback={
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Skeleton variant="rounded" height={120} />
                <Skeleton variant="rounded" height={320} />
              </Box>
            }
          >
            <ContentComponent />
          </Suspense>
        ) : (
          <Typography color="text.secondary">内容类型: {currentType?.label}</Typography>
        )}
      </Box>
    </Box>
  );
}
