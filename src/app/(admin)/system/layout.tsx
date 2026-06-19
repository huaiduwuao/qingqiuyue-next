'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import VpnKeyRoundedIcon from '@mui/icons-material/VpnKeyRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import MilitaryTechRoundedIcon from '@mui/icons-material/MilitaryTechRounded';
import StarsRoundedIcon from '@mui/icons-material/StarsRounded';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import SettingsApplicationsRoundedIcon from '@mui/icons-material/SettingsApplicationsRounded';
import DnsRoundedIcon from '@mui/icons-material/DnsRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import { useAuthority } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { PERMISSIONS } from '@/lib/permissions';

interface MenuItemDef {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  accent: string;
  /** 查看该菜单所需的权限码,缺省则不限制 */
  permission?: string;
}

export type { MenuItemDef };

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: '超级管理员', color: 'primary.main' },
  ADMIN: { label: '管理员', color: 'primary.main' },
  OPERATOR: { label: '运营', color: '#8B5CF6' },
  AUDITOR: { label: '审核员', color: 'warning.main' },
  USER: { label: '用户', color: '#5B8DEF' },
};

const ROLE_PRIORITY = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'AUDITOR', 'USER'];

function getPrimaryRole(authorities?: string[]): { label: string; color: string } | null {
  if (!authorities?.length) return null;
  for (const r of ROLE_PRIORITY) {
    if (authorities.includes(r)) return ROLE_LABEL[r];
  }
  return { label: authorities[0], color: 'text.secondary' };
}

const MENU_GROUPS: { title: string; items: MenuItemDef[] }[] = [
  {
    title: '认证授权',
    items: [
      { id: 'role', label: '角色管理', path: '/system/role', icon: <AdminPanelSettingsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main', permission: PERMISSIONS.SYSTEM_ROLE.VIEW },
      { id: 'menu', label: '菜单管理', path: '/system/menu', icon: <AccountTreeRoundedIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main', permission: PERMISSIONS.SYSTEM_MENU.VIEW },
      { id: 'permission', label: '权限管理', path: '/system/permission', icon: <LockRoundedIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6', permission: PERMISSIONS.SYSTEM_PERMISSION.VIEW },
      { id: 'data-permission', label: '数据权限', path: '/system/data-permission', icon: <VpnKeyRoundedIcon sx={{ fontSize: 18 }} />, accent: 'warning.main', permission: PERMISSIONS.SYSTEM_DATA_PERMISSION.VIEW },
    ],
  },
  {
    title: '用户管理',
    items: [
      { id: 'user', label: '用户列表', path: '/system/user', icon: <PeopleRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF', permission: PERMISSIONS.SYSTEM_USER.VIEW },
      { id: 'bot', label: '假人管理', path: '/system/bot', icon: <SmartToyRoundedIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6', permission: PERMISSIONS.SYSTEM_BOT.VIEW },
      { id: 'hermes', label: 'Hermes 智能体', path: '/system/hermes', icon: <SmartToyRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160', permission: PERMISSIONS.SYSTEM_HERMES.VIEW },
      { id: 'user-level', label: '用户等级', path: '/system/user-level', icon: <MilitaryTechRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FF8A3D', permission: PERMISSIONS.SYSTEM_USER_LEVEL.VIEW },
      { id: 'user-point', label: '用户积分', path: '/system/user-point', icon: <StarsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'success.main', permission: PERMISSIONS.SYSTEM_USER_POINT.VIEW },
    ],
  },
  {
    title: '资源管理',
    items: [
      { id: 'app', label: '应用管理', path: '/system/app', icon: <AppsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'primary.main', permission: PERMISSIONS.SYSTEM_APP.VIEW },
      { id: 'app-config', label: '应用配置', path: '/system/app-config', icon: <SettingsApplicationsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'secondary.main', permission: PERMISSIONS.SYSTEM_APP_CONFIG.VIEW },
      { id: 'app-service', label: '应用服务', path: '/system/app-service', icon: <DnsRoundedIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6', permission: PERMISSIONS.SYSTEM_APP_SERVICE.VIEW },
      { id: 'resource', label: '资源管理', path: '/system/resource', icon: <StorageRoundedIcon sx={{ fontSize: 18 }} />, accent: 'warning.main', permission: PERMISSIONS.SYSTEM_RESOURCE.VIEW },
    ],
  },
  {
    title: '基础数据',
    items: [
      { id: 'dict', label: '字典管理', path: '/system/dict/dict-type', icon: <MenuBookRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF', permission: PERMISSIONS.SYSTEM_DICT.VIEW },
      { id: 'website-dict', label: '网站字典', path: '/system/website-dict', icon: <LanguageRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FF8A3D', permission: PERMISSIONS.SYSTEM_WEBSITE_DICT.VIEW },
      { id: 'address', label: '地址管理', path: '/system/address/province', icon: <LocationOnRoundedIcon sx={{ fontSize: 18 }} />, accent: 'success.main', permission: PERMISSIONS.SYSTEM_ADDRESS.VIEW },
      { id: 'wx-config', label: '微信配置', path: '/system/wx-config', icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
    ],
  },
  {
    title: '微信公众号',
    items: [
      { id: 'wx-mp-menu', label: '公众号菜单', path: '/wx/mp/menu', icon: <MenuBookRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
      { id: 'wx-mp-auto-reply', label: '自动回复', path: '/wx/mp/auto-reply', icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
      { id: 'wx-mp-msg', label: '消息管理', path: '/wx/mp/msg', icon: <DnsRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
      { id: 'wx-mp-user', label: '公众号用户', path: '/wx/mp/user', icon: <PeopleRoundedIcon sx={{ fontSize: 18 }} />, accent: '#07C160' },
    ],
  },
  {
    title: '数据看板',
    items: [
      { id: 'dash-analysis', label: '分析页', path: '/dashboard/analysis', icon: <AccountTreeRoundedIcon sx={{ fontSize: 18 }} />, accent: '#5B8DEF' },
      { id: 'dash-monitor', label: '监控页', path: '/dashboard/monitor', icon: <StorageRoundedIcon sx={{ fontSize: 18 }} />, accent: '#FF8A3D' },
      { id: 'dash-workplace', label: '工作台', path: '/dashboard/workplace', icon: <AppsRoundedIcon sx={{ fontSize: 18 }} />, accent: 'success.main' },
    ],
  },
  {
    title: '数字人',
    items: [
      { id: 'dh-studio', label: '数字人工作台', path: '/system/digital-human', icon: <StarsRoundedIcon sx={{ fontSize: 18 }} />, accent: '#8B5CF6' },
    ],
  },
  {
    title: '运维监控',
    items: [
      { id: 'log', label: '服务日志', path: '/system/log', icon: <TerminalRoundedIcon sx={{ fontSize: 18 }} />, accent: '#25F4EE' },
    ],
  },
];

export { MENU_GROUPS };

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, can } = useAuthority();
  const { currentUser } = useApp();
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  if (!isAdmin) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'var(--bg-body, #0A0B14)' }}>
        <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
          <AdminPanelSettingsRoundedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontSize: 14, color: 'text.tertiary' }}>无访问权限</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 0.5 }}>该页面仅对管理员开放</Typography>
        </Box>
      </Box>
    );
  }

  const activeItem = MENU_GROUPS.flatMap((g) => g.items).find(
    (it) => pathname === it.path || pathname?.startsWith(it.path + '/'),
  );

  const visibleGroups = MENU_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => !it.permission || can(it.permission)) }))
    .filter((g) => g.items.length > 0);

  const handleReturnToFront = () => {
    setUserMenuAnchor(null);
    const entry = sessionStorage.getItem('admin_entry_path');
    sessionStorage.removeItem('admin_entry_path');
    router.push(entry && entry !== '/system/role' ? entry : '/home/recommend');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'var(--bg-body, #0A0B14)',
        color: 'var(--text-primary, #ffffff)',
      }}
    >
      {/* 顶部条 — 与 home TopBar 同一套(60px / rgba 背景 / blur / 细白边) */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          height: 60,
          px: 3,
          bgcolor: 'var(--bg-topbar, rgba(10, 10, 15, 0.85))',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 180 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              background: 'linear-gradient(135deg, #25F4EE 0%, #FE2C55 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AdminPanelSettingsRoundedIcon sx={{ fontSize: 18, color: 'background.default' }} />
          </Box>
          <Box sx={{ minWidth: 0, lineHeight: 1.1 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
              系统管理
            </Typography>
            <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))', mt: 0.25 }}>
              Admin Console
            </Typography>
          </Box>
        </Box>

        <Typography sx={{ fontSize: 13, color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>
          /
        </Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary, #ffffff)' }}>
          {activeItem?.label || '控制台'}
        </Typography>

        <Box sx={{ flex: 1 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="返回首页">
            <IconButton
              size="small"
              onClick={() => router.push('/home/recommend')}
              sx={{
                color: 'var(--text-secondary, rgba(255,255,255,0.75))',
                borderRadius: 2,
                '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.06))', color: 'var(--text-primary, #ffffff)' },
              }}
            >
              <HomeRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Box
            onClick={(e) => setUserMenuAnchor(e.currentTarget)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              ml: 1,
              px: 1,
              py: 0.5,
              borderRadius: 2,
              cursor: 'pointer',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.06))' },
            }}
          >
            <Avatar
              src={currentUser?.avatar}
              sx={{
                width: 30,
                height: 30,
                background: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {(currentUser?.nickname || currentUser?.name)?.[0]?.toUpperCase() || 'U'}
            </Avatar>
            <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              <Typography sx={{ fontSize: 12.5, color: 'var(--text-primary, #ffffff)', fontWeight: 500 }}>
                {currentUser?.nickname || currentUser?.name || '未登录'}
              </Typography>
              {(() => {
                const role = getPrimaryRole(currentUser?.authorities);
                return role ? (
                  <Typography sx={{ fontSize: 10, color: role.color, fontWeight: 600, mt: 0.25 }}>
                    {role.label}
                  </Typography>
                ) : null;
              })()}
            </Box>
          </Box>

          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={() => setUserMenuAnchor(null)}
            slotProps={{
              paper: {
                sx: {
                  bgcolor: 'var(--bg-elevated, rgba(20, 22, 32, 0.98))',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                  backdropFilter: 'blur(12px)',
                  color: 'text.primary',
                  mt: 1,
                  minWidth: 180,
                  borderRadius: 2,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                },
              },
            }}
          >
            <MenuItem
              onClick={handleReturnToFront}
              sx={{ fontSize: 13, borderRadius: 1.5, mx: 0.5, my: 0.25, '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.06))' } }}
            >
              <ListItemIcon sx={{ minWidth: 30, color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>
                <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
              </ListItemIcon>
              返回前台
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* 主体:侧栏 + 内容 */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 左侧导航 — 与 home LeftSidebar 同一套(220px / rgba 半透明 / 细白边) */}
        <Box
          component="nav"
          sx={{
            width: 220,
            flexShrink: 0,
            bgcolor: 'var(--bg-sidebar, rgba(10, 10, 15, 0.5))',
            borderRight: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            height: 'calc(100vh - 60px)',
            position: 'sticky',
            top: 60,
          }}
        >
          <Box sx={{ flex: 1, py: 1.5, overflow: 'auto' }}>
            {visibleGroups.map((group) => (
              <Box key={group.title} sx={{ mb: 0.5 }}>
                <Box sx={{ px: 3, pt: 1.5, pb: 0.5 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted, rgba(255,255,255,0.4))', letterSpacing: 1, textTransform: 'uppercase' }}>
                    {group.title}
                  </Typography>
                </Box>
                {group.items.map((item) => {
                  const isActive = pathname === item.path || pathname?.startsWith(item.path + '/');
                  return (
                    <Box
                      key={item.id}
                      onClick={() => router.push(item.path)}
                      sx={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        mx: 1.5,
                        px: 1.5,
                        py: 1,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        color: isActive ? 'var(--text-primary, #ffffff)' : 'var(--text-secondary, rgba(255,255,255,0.65))',
                        bgcolor: isActive ? 'var(--border-color, rgba(255,255,255,0.06))' : 'transparent',
                        transition: 'all 0.15s',
                        '&:hover': { bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))', color: 'var(--text-primary, #ffffff)' },
                      }}
                    >
                      {isActive && (
                        <Box
                          sx={{
                            position: 'absolute',
                            right: 6,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            bgcolor: 'var(--brand-color, #FE2C55)',
                            boxShadow: '0 0 6px var(--brand-color, #FE2C55)',
                          }}
                        />
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', color: isActive ? item.accent : 'inherit' }}>
                        {item.icon}
                      </Box>
                      <Typography sx={{ fontSize: 13, fontWeight: isActive ? 600 : 400, flex: 1 }}>
                        {item.label}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            ))}
          </Box>

          {/* 底部状态 */}
          <Box sx={{ p: 1.5, borderTop: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  boxShadow: '0 0 6px rgba(93, 219, 150, 0.6)',
                }}
              />
              <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>服务运行中 · v2.0.1</Typography>
            </Box>
          </Box>
        </Box>

        {/* 内容 */}
        <Box component="main" sx={{ flex: 1, minWidth: 0, overflow: 'auto', p: 3, bgcolor: 'var(--bg-body, #0A0B14)' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
