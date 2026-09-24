'use client';

/**
 * 爬虫总览(/system/spider)
 *
 * 以前这里是「爬虫管理中心」:一个页面里 8 个标签页(Dashboard / 批量任务 / Worker 池 / 站点调度 /
 * 源管理 / 模板管理 / 单任务 / 代理池)。2026-09-25 拆成侧栏「爬虫运营」分组下的独立菜单,
 * 每个都是自己的路由,能刷新、能收藏、能单独授权;这里只保留总览。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import { useTheme, alpha } from '@mui/material/styles';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useSpiderWebSocket } from '@/hooks/useSpiderWebSocket';
import DashboardPage from './dashboard/page';

export default function SpiderAdminPage() {
  return <SpiderPageInner />;
}

function SpiderPageInner() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const { health, stats, connected } = useSpiderWebSocket();

  const isHealthy = health?.status === 'healthy';
  const accent = theme.palette.primary.main;
  const cyan = theme.palette.secondary.main;

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
            ? `linear-gradient(135deg, ${alpha(accent, 0.18)} 0%, ${alpha(cyan, 0.10)} 60%, ${alpha(theme.palette.background.paper, 0.6)} 100%)`
            : `linear-gradient(135deg, ${alpha(accent, 0.10)} 0%, ${alpha(cyan, 0.08)} 60%, ${alpha(theme.palette.text.primary, 0.6)} 100%)`,
        }}
      >
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
            background: `radial-gradient(circle, ${alpha(cyan, 0.18)} 0%, transparent 70%)`,
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
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                background: `linear-gradient(135deg, ${accent} 0%, ${cyan} 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 8px 24px ${alpha(accent, 0.35)}`,
                flexShrink: 0,
              }}
            >
              <TravelExploreIcon sx={{ color: 'text.primary', fontSize: 32 }} />
            </Box>
            <Box>
              <Typography
                variant="h4"
                sx={{ fontWeight: 700, color: 'text.primary', mb: 0.5, fontSize: { xs: '1.25rem', md: '1.5rem' } }}
              >
                爬虫总览
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                源、模板、任务队列、Worker、站点调度都在左侧「爬虫运营」里 · 这里看整体运行状况
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: { xs: 'flex-start', md: 'flex-end' },
              gap: 1,
            }}
          >
            <Chip
              size="small"
              icon={
                <FiberManualRecordIcon
                  sx={{
                    fontSize: '14px !important',
                    color: isHealthy ? 'success.main' : 'primary.main',
                    animation: 'pulse-dot 1.8s ease-in-out infinite',
                  }}
                />
              }
              label={
                !connected
                  ? '连接中…'
                  : isHealthy
                  ? `服务健康 · ${health?.engines ?? 0} 引擎运行中`
                  : '服务异常'
              }
              sx={{
                bgcolor: isHealthy ? alpha(theme.palette.success.main, 0.15) : alpha(accent, 0.15),
                color: isHealthy ? 'success.main' : 'primary.main',
                border: '1px solid',
                borderColor: isHealthy ? alpha(theme.palette.success.main, 0.3) : alpha(accent, 0.3),
                fontWeight: 600,
                fontSize: 12,
              }}
            />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {!stats ? (
                <>
                  <Skeleton variant="text" width={60} sx={{ fontSize: 12 }} />
                  <Skeleton variant="text" width={60} sx={{ fontSize: 12 }} />
                  <Skeleton variant="text" width={60} sx={{ fontSize: 12 }} />
                </>
              ) : (
                <>
                  <MiniStat label="抓取页" value={stats?.totalPages} />
                  <MiniStat label="发现链接" value={stats?.totalLinks} />
                  <MiniStat label="入库条目" value={stats?.totalItems} />
                </>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      <DashboardPage />
    </Box>
  );
}

function MiniStat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary' }}>
        {value != null ? value.toLocaleString('zh-CN') : '—'}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{label}</Typography>
    </Box>
  );
}
