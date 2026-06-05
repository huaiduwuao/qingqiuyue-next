'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import HomeIcon from '@mui/icons-material/Home';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HandshakeIcon from '@mui/icons-material/Handshake';
import FolderIcon from '@mui/icons-material/Folder';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GroupsIcon from '@mui/icons-material/Groups';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';

const menuItems = [
  { key: '1', label: '赏金广场', icon: <HomeIcon sx={{ fontSize: 20 }} />, accent: 'primary.main' },
  { key: '2', label: '需求管理', icon: <AssignmentIcon sx={{ fontSize: 20 }} />, accent: 'warning.main' },
  { key: '3', label: '实现管理', icon: <HandshakeIcon sx={{ fontSize: 20 }} />, accent: 'secondary.main' },
  { key: '4', label: '项目管理', icon: <FolderIcon sx={{ fontSize: 20 }} />, accent: '#8B5CF6' },
  { key: '5', label: '意境管理', icon: <AutoAwesomeIcon sx={{ fontSize: 20 }} />, accent: 'success.main' },
  { key: '6', label: '团队管理', icon: <GroupsIcon sx={{ fontSize: 20 }} />, accent: '#F59E0B' },
  { key: '7', label: '协作看板', icon: <ViewKanbanIcon sx={{ fontSize: 20 }} />, accent: '#06B6D4' },
];

const componentMap: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  '1': React.lazy(() => import('./components/dashboard/page')),
  '2': React.lazy(() => import('./components/demand/page')),
  '3': React.lazy(() => import('./components/realization/page')),
  '4': React.lazy(() => import('./components/project/page')),
  '5': React.lazy(() => import('./components/conception/page')),
  '6': React.lazy(() => import('./components/group/page')),
  '7': React.lazy(() => import('./components/taskboard/page')),
};

export default function AccountRewardPage() {
  const [tabKey, setTabKey] = useState('1');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [taskboardProjectId, setTaskboardProjectId] = useState<number | null>(null);
  const [taskboardGroupId, setTaskboardGroupId] = useState<number | null>(null);
  const [taskboardDemandId, setTaskboardDemandId] = useState<number | null>(null);
  const [conceptionDemandId, setConceptionDemandId] = useState<number | null>(null);
  const [realizationDemandId, setRealizationDemandId] = useState<number | null>(null);

  const ContentComponent = componentMap[tabKey];
  const activeItem = menuItems.find((m) => m.key === tabKey) || menuItems[0];

  const openTaskboardFor = (projectId: number) => {
    setTaskboardProjectId(projectId);
    setTaskboardGroupId(null);
    setTaskboardDemandId(null);
    setTabKey('7');
  };

  const openTaskboardForGroup = (groupId: number) => {
    setTaskboardGroupId(groupId);
    setTaskboardProjectId(null);
    setTaskboardDemandId(null);
    setTabKey('7');
  };

  const openTaskboardForDemand = (demandId: number) => {
    setTaskboardDemandId(demandId);
    setTaskboardProjectId(null);
    setTaskboardGroupId(null);
    setTabKey('7');
  };

  const openConceptionForDemand = (demandId: number) => {
    setConceptionDemandId(demandId);
    setTabKey('5');
  };

  const openRealizationForDemand = (demandId: number) => {
    setRealizationDemandId(demandId);
    setTabKey('3');
  };

  const SidebarContent = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, bgcolor: 'background.paper', borderRight: '1px solid #252836' }}>
      {/* Logo / Title */}
      <Box sx={{ p: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              background: 'linear-gradient(135deg, #FFB400 0%, #FE2C55 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'background.default',
            }}
          >
            <LocalFireDepartmentIcon sx={{ fontSize: 18 }} />
          </Box>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>
            悬赏创作者中心
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'divider', mx: 2 }} />

      {/* Menu */}
      <List sx={{ flex: 1, py: 1 }}>
        {menuItems.map((item) => {
          const isSelected = tabKey === item.key;
          return (
            <ListItemButton
              key={item.key}
              onClick={() => {
                setTabKey(item.key);
                setDrawerOpen(false);
              }}
              sx={{
                mx: 1,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                position: 'relative',
                bgcolor: isSelected ? `${item.accent}1F` : 'transparent',
                color: isSelected ? 'text.primary' : 'text.tertiary',
                '&:hover': {
                  bgcolor: isSelected ? `${item.accent}2A` : 'rgba(255, 255, 255, 0.05)',
                },
                '&::before': isSelected
                  ? {
                      content: '""',
                      position: 'absolute',
                      left: -8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: 18,
                      borderRadius: 2,
                      bgcolor: item.accent,
                    }
                  : {},
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 32,
                  color: isSelected ? item.accent : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{
                  primary: {
                    sx: {
                      fontSize: 13,
                      fontWeight: isSelected ? 600 : 400,
                    },
                  },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* Bottom status */}
      <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: 'success.main',
              boxShadow: '0 0 8px rgba(93, 219, 150, 0.6)',
            }}
          />
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>悬赏池运行中</Typography>
        </Box>
        <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.5 }}>
          v2.0.1 · 2026.06.01
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: 'calc(100dvh - var(--appbar-h, 66px))', minHeight: 0, minWidth: 0 }}>
      {/* Mobile drawer for sidebar */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: 220, bgcolor: 'background.paper' },
        }}
      >
        <Box sx={{ position: 'absolute', right: 8, top: 8, zIndex: 1 }}>
          <IconButton size="small" onClick={() => setDrawerOpen(false)} sx={{ color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <SidebarContent />
      </Drawer>

      {/* Desktop sidebar */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          width: 220,
          flexShrink: 0,
          height: 'calc(100dvh - var(--appbar-h, 66px))',
        }}
      >
        <SidebarContent />
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, height: 'calc(100dvh - var(--appbar-h, 66px))', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto', overscrollBehavior: 'contain' }}>
        {/* Mobile-only sidebar trigger + page header */}
        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderBottom: '1px solid #252836',
            bgcolor: '#0F1018',
            flexShrink: 0,
          }}
        >
          <IconButton
            onClick={() => setDrawerOpen(true)}
            sx={{
              color: 'text.primary',
              border: '1px solid #252836',
              borderRadius: 1.5,
              p: 0.75,
            }}
            aria-label="打开菜单"
          >
            <MenuIcon fontSize="small" />
          </IconButton>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              flex: 1,
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: 0.75,
                background: `linear-gradient(135deg, ${activeItem.accent} 0%, ${activeItem.accent}AA 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'text.primary',
              }}
            >
              {activeItem.icon}
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
              {activeItem.label}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ p: { xs: 1.5, md: 3 } }}>
          {ContentComponent ? (
            <React.Suspense
              fallback={
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>加载中...</Typography>
                </Box>
              }
            >
              <ContentComponent
                groupId=""
                groupData={[]}
                onOpenTaskboard={
                  tabKey === '4' ? openTaskboardFor :
                  tabKey === '6' ? openTaskboardForGroup :
                  tabKey === '2' ? openTaskboardForDemand :
                  undefined
                }
                onOpenDemandDetail={
                  tabKey === '7' ? openTaskboardForDemand :
                  tabKey === '3' ? openTaskboardForDemand :
                  tabKey === '5' ? openTaskboardForDemand :
                  undefined
                }
                onOpenConceptionForDemand={tabKey === '2' ? openConceptionForDemand : undefined}
                initialProjectId={tabKey === '7' ? taskboardProjectId : null}
                initialGroupId={tabKey === '7' ? taskboardGroupId : null}
                initialDemandId={tabKey === '7' ? taskboardDemandId : tabKey === '5' ? conceptionDemandId : tabKey === '3' ? realizationDemandId : null}
              />
            </React.Suspense>
          ) : (
            <Typography sx={{ color: 'text.secondary' }}>奖励中心</Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
