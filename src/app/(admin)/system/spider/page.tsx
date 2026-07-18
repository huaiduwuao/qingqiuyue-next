'use client';

/**
 * 管理平台爬虫管理中心
 */

import React, { Suspense, lazy, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import { useTheme, alpha } from '@mui/material/styles';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import SettingsEthernetRoundedIcon from '@mui/icons-material/SettingsEthernetRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import { useSpiderWebSocket } from '@/hooks/useSpiderWebSocket';

const DashboardPage = lazy(() => import('./dashboard/page'));
const BatchPage = lazy(() => import('./batch/page'));
const WorkersPage = lazy(() => import('./workers/page'));
const SitesPage = lazy(() => import('./sites/page'));
const SourcesPage = lazy(() => import('./sources/page'));
const TemplatesPage = lazy(() => import('./templates/page'));
const TasksPage = lazy(() => import('./tasks/page'));
const ProxiesPage = lazy(() => import('./proxies/page'));

export type SpiderTabKey = 'dashboard' | 'batch' | 'workers' | 'sites' | 'sources' | 'templates' | 'tasks' | 'proxies';

interface SpiderTabConfig {
  key: SpiderTabKey;
  label: string;
  icon?: React.ReactElement;
}

const SPIDER_TABS: SpiderTabConfig[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <TravelExploreIcon fontSize="small" /> },
  { key: 'batch', label: '批量任务', icon: <AccountTreeRoundedIcon fontSize="small" /> },
  { key: 'workers', label: 'Worker 池', icon: <DnsRoundedIcon fontSize="small" /> },
  { key: 'sites', label: '站点调度', icon: <StorageRoundedIcon fontSize="small" /> },
  { key: 'sources', label: '源管理', icon: <MenuBookRoundedIcon fontSize="small" /> },
  { key: 'templates', label: '模板管理', icon: <ListAltRoundedIcon fontSize="small" /> },
  { key: 'tasks', label: '单任务', icon: <SettingsEthernetRoundedIcon fontSize="small" /> },
  { key: 'proxies', label: '代理池', icon: <SmartToyRoundedIcon fontSize="small" /> },
];

const componentMap: Record<string, React.ComponentType<any>> = {
  dashboard: DashboardPage,
  batch: BatchPage,
  workers: WorkersPage,
  sites: SitesPage,
  sources: SourcesPage,
  templates: TemplatesPage,
  tasks: TasksPage,
  proxies: ProxiesPage,
};

export default function SpiderAdminPage() {
  return <SpiderPageInner />;
}

function SpiderPageInner() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [tab, setTab] = useState(0);
  const currentType = SPIDER_TABS[tab];
  const ContentComponent = componentMap[currentType?.key];

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
                爬虫管理中心
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                统一调度抓取任务、模板规则、代理池 · 实时监控引擎健康
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
          {SPIDER_TABS.map((type) => (
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
