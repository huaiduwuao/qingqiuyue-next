'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import HomeIcon from '@mui/icons-material/Home';
import AssignmentIcon from '@mui/icons-material/Assignment';
import HandshakeIcon from '@mui/icons-material/Handshake';
import FolderIcon from '@mui/icons-material/Folder';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GroupsIcon from '@mui/icons-material/Groups';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { listGroups, type GroupInfo } from '@/apis/reward-group';

const menuItems = [
  { key: '1', label: '赏金广场', icon: <HomeIcon sx={{ fontSize: 20 }} />, accent: 'primary.main' },
  { key: '2', label: '我的工作台', icon: <DashboardIcon sx={{ fontSize: 20 }} />, accent: 'primary.main' },
  { key: '3', label: '需求管理', icon: <AssignmentIcon sx={{ fontSize: 20 }} />, accent: 'warning.main' },
  { key: '4', label: '实现管理', icon: <HandshakeIcon sx={{ fontSize: 20 }} />, accent: 'secondary.main' },
  { key: '5', label: '项目管理', icon: <FolderIcon sx={{ fontSize: 20 }} />, accent: '#8B5CF6' },
  { key: '6', label: '意境管理', icon: <AutoAwesomeIcon sx={{ fontSize: 20 }} />, accent: 'success.main' },
  { key: '7', label: '团队管理', icon: <GroupsIcon sx={{ fontSize: 20 }} />, accent: '#F59E0B' },
  { key: '8', label: '协作看板', icon: <ViewKanbanIcon sx={{ fontSize: 20 }} />, accent: '#06B6D4' },
];

const componentMap: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  '1': React.lazy(() => import('./_components/dashboard/page')),
  '2': React.lazy(() => import('./_components/personal/page')),
  '3': React.lazy(() => import('./_components/demand/page')),
  '4': React.lazy(() => import('./_components/realization/page')),
  '5': React.lazy(() => import('./_components/project/page')),
  '6': React.lazy(() => import('./_components/conception/page')),
  '7': React.lazy(() => import('./_components/group/page')),
  '8': React.lazy(() => import('./_components/taskboard/page')),
};

// 已有对应子路由时走 router.push,否则保持原 tab 状态切换
const keyToPath: Record<string, string> = {};

export default function AccountRewardPage() {
  const router = useRouter();
  const [tabKey, setTabKey] = useState('1');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [taskboardProjectId, setTaskboardProjectId] = useState<number | null>(null);
  const [taskboardGroupId, setTaskboardGroupId] = useState<number | null>(null);
  const [taskboardDemandId, setTaskboardDemandId] = useState<number | null>(null);
  const [conceptionDemandId, setConceptionDemandId] = useState<number | null>(null);
  const [realizationDemandId, setRealizationDemandId] = useState<number | null>(null);
  // 子模块(需求/项目/意境/实现)的列表查询与创建都强依赖 groupId,
  // 旧代码传 '' 导致列表不加载、创建 400。这里拉取当前用户团队并默认选中第一个;
  // tab 切换时重新拉取,保证「团队管理」里新建的团队能即时生效。
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | ''>('');

  useEffect(() => {
    let alive = true;
    listGroups({ pageSize: 50 })
      .then((res: any) => {
        if (!alive) return;
        // rewardClient 拦截器返回完整 body { code, msg, data:{ records, total } }
        const payload = res?.data ?? res;
        const list: GroupInfo[] = payload?.records || payload?.list || (Array.isArray(payload) ? payload : []);
        setGroups(list);
        setSelectedGroupId((prev) => {
          if (prev && list.some((g) => g.id === prev)) return prev;
          return list[0]?.id ?? '';
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tabKey]);

  const ContentComponent = componentMap[tabKey];
  // 我的工作台单独懒加载(因为它接的 props 与其它页不同,放 componentMap 里类型对不上)
  const PersonalWorkspaceLazy = React.lazy(() => import('./_components/personal/page'));
  const activeItem = menuItems.find((m) => m.key === tabKey) || menuItems[0];

  const openTaskboardFor = (projectId: number) => {
    setTaskboardProjectId(projectId);
    setTaskboardGroupId(null);
    setTaskboardDemandId(null);
    setTabKey('8');
  };

  const openTaskboardForGroup = (groupId: number) => {
    setTaskboardGroupId(groupId);
    setTaskboardProjectId(null);
    setTaskboardDemandId(null);
    setTabKey('8');
  };

  const openTaskboardForDemand = (demandId: number) => {
    setTaskboardDemandId(demandId);
    setTaskboardProjectId(null);
    setTaskboardGroupId(null);
    setTabKey('8');
  };

  const openConceptionForDemand = (demandId: number) => {
    setConceptionDemandId(demandId);
    setTabKey('6');
  };

  // 我的工作台 -> 其它模块跳转(切 tabKey + 同步 selectedGroupId)
  const jumpToTabWithGroup = (tab: string, groupId: number) => {
    if (groupId && typeof groupId === 'number') setSelectedGroupId(groupId);
    setTabKey(tab);
  };
  const openDemandTab = (groupId: number) => jumpToTabWithGroup('3', groupId);
  const openRealizationTab = (groupId: number) => jumpToTabWithGroup('4', groupId);
  const openProjectTab = (groupId: number) => jumpToTabWithGroup('5', groupId);
  const openGroupTab = (groupId: number) => jumpToTabWithGroup('7', groupId);
  const openTaskboardTab = (groupId: number) => {
    if (groupId && typeof groupId === 'number') setSelectedGroupId(groupId);
    setTaskboardGroupId(groupId);
    setTaskboardProjectId(null);
    setTaskboardDemandId(null);
    setTabKey('8');
  };

  const SidebarContent = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, bgcolor: 'background.paper', borderRight: '1px solid', borderColor: 'divider' }}>
      {/* Logo / Title */}
      <Box sx={{ p: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              background: (theme) => `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.primary.main} 100%)`,
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
                const path = keyToPath[item.key];
                if (path) {
                  router.push(path);
                } else {
                  setTabKey(item.key);
                }
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
                  bgcolor: isSelected
                    ? `${item.accent}2A`
                    : 'action.hover',
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
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0F1018' : '#FFFFFF',
            flexShrink: 0,
          }}
        >
          <IconButton
            onClick={() => setDrawerOpen(true)}
            sx={{
              color: 'text.primary',
              border: '1px solid',
              borderColor: 'divider',
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
          {/* 团队切换器:仅需求/项目/意境/实现 tab 需要(数据按 teamId 隔离);
              赏金广场(tabKey='1')与协作看板(tabKey='8')不依赖当前团队,故隐藏。 */}
          {groups.length > 0 && tabKey !== '1' && tabKey !== '8' ? (
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>当前团队</Typography>
              <TextField
                select
                size="small"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(Number(e.target.value))}
                sx={{ minWidth: 200 }}
                slotProps={{ input: { 'aria-label': '当前团队' } as any }}
              >
                {groups.map((g) => (
                  <MenuItem key={g.id} value={g.id}>
                    {g.name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          ) : (
            tabKey !== '1' && tabKey !== '7' && tabKey !== '8' && (
              <Typography sx={{ fontSize: 12, color: 'text.disabled', mb: 2 }}>
                还没有团队,请先在「团队管理」中创建,需求/项目/意境/实现模块需要归属团队。
              </Typography>
            )
          )}
          {tabKey === '2' ? (
            <React.Suspense
              fallback={
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>加载中...</Typography>
                </Box>
              }
            >
              <PersonalWorkspaceLazy
                groups={groups}
                selectedGroupId={selectedGroupId}
                onOpenDemandTab={openDemandTab}
                onOpenDemandDetail={(gid: number, did: number) => { jumpToTabWithGroup('3', gid); setTaskboardDemandId(did); setTaskboardProjectId(null); setTaskboardGroupId(null); setTabKey('8'); }}
                onOpenRealizationTab={openRealizationTab}
                onOpenProjectTab={openProjectTab}
                onOpenTaskboardTab={openTaskboardTab}
                onOpenGroupTab={openGroupTab}
              />
            </React.Suspense>
          ) : ContentComponent ? (
            <React.Suspense
              fallback={
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>加载中...</Typography>
                </Box>
              }
            >
              <ContentComponent
                groupId={selectedGroupId}
                groupData={groups}
                onOpenTaskboard={
                  tabKey === '5' ? openTaskboardFor :
                  tabKey === '7' ? openTaskboardForGroup :
                  tabKey === '3' ? openTaskboardForDemand :
                  undefined
                }
                onOpenDemandDetail={
                  tabKey === '8' ? openTaskboardForDemand :
                  tabKey === '4' ? openTaskboardForDemand :
                  tabKey === '6' ? openTaskboardForDemand :
                  undefined
                }
                onOpenConceptionForDemand={tabKey === '3' ? openConceptionForDemand : undefined}
                initialProjectId={tabKey === '8' ? taskboardProjectId : null}
                initialGroupId={tabKey === '8' ? taskboardGroupId : null}
                initialDemandId={tabKey === '8' ? taskboardDemandId : tabKey === '6' ? conceptionDemandId : tabKey === '4' ? realizationDemandId : null}
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
