'use client';

import React, { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ListItemIcon from '@mui/material/ListItemIcon';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
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
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { useAuthority } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { PERMISSIONS } from '@/lib/permissions';
import { MENU_GROUPS, type MenuItemDef } from './menu-config';

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

export default function SystemLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin, can } = useAuthority();
  const { currentUser } = useApp();
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  if (!isAdmin) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'var(--bg-body, transparent)' }}>
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
        bgcolor: 'var(--bg-body, transparent)',
        color: 'var(--text-primary, currentColor)',
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
          bgcolor: 'var(--bg-topbar, transparent)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-color, transparent)',
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
            <Typography sx={{ fontSize: 10, color: 'var(--text-muted, currentColor)', mt: 0.25 }}>
              Admin Console
            </Typography>
          </Box>
        </Box>

        <Typography sx={{ fontSize: 13, color: 'var(--text-muted, currentColor)' }}>
          /
        </Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary, currentColor)' }}>
          {activeItem?.label || '控制台'}
        </Typography>

        <Box sx={{ flex: 1 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="返回首页">
            <IconButton
              size="small"
              onClick={() => router.push('/home/recommend')}
              sx={{
                color: 'var(--text-secondary, currentColor)',
                borderRadius: 2,
                '&:hover': { bgcolor: 'var(--bg-hover, transparent)', color: 'var(--text-primary, currentColor)' },
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
              '&:hover': { bgcolor: 'var(--bg-hover, transparent)' },
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
              <Typography sx={{ fontSize: 12.5, color: 'var(--text-primary, currentColor)', fontWeight: 500 }}>
                {currentUser?.nickname || currentUser?.name || '未登录'}
              </Typography>
              {(() => {
                const role = getPrimaryRole((currentUser as { roles?: string[] } | undefined)?.roles ?? currentUser?.authorities);
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
                  bgcolor: 'var(--bg-elevated, transparent)',
                  border: '1px solid var(--border-color, transparent)',
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
              sx={{ fontSize: 13, borderRadius: 1.5, mx: 0.5, my: 0.25, '&:hover': { bgcolor: 'var(--bg-hover, transparent)' } }}
            >
              <ListItemIcon sx={{ minWidth: 30, color: 'var(--text-secondary, currentColor)' }}>
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
            bgcolor: 'var(--bg-sidebar, transparent)',
            borderRight: '1px solid var(--border-color, transparent)',
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
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted, currentColor)', letterSpacing: 1, textTransform: 'uppercase' }}>
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
                        color: isActive ? 'var(--text-primary, currentColor)' : 'var(--text-secondary, currentColor)',
                        bgcolor: isActive ? 'var(--border-color, transparent)' : 'transparent',
                        transition: 'all 0.15s',
                        '&:hover': { bgcolor: 'var(--bg-hover, transparent)', color: 'var(--text-primary, currentColor)' },
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
          <Box sx={{ p: 1.5, borderTop: '1px solid var(--border-color, transparent)' }}>
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
              <Typography sx={{ fontSize: 11, color: 'var(--text-muted, currentColor)' }}>服务运行中 · v2.0.1</Typography>
            </Box>
          </Box>
        </Box>

        {/* 内容 */}
        <Box component="main" sx={{ flex: 1, minWidth: 0, overflow: 'auto', p: 3, bgcolor: 'var(--bg-body, transparent)' }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
