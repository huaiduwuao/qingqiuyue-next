'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ListItemIcon from '@mui/material/ListItemIcon';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import Drawer from '@mui/material/Drawer';
import CircularProgress from '@mui/material/CircularProgress';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MenuItem from '@mui/material/MenuItem';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useAuthority } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { MENU_GROUPS, type MenuItemDef } from './menu-config';
import { resolveMenuIcon } from '@/lib/menuIcons';
import { MENU_GROUP_LABELS, MENU_GROUP_ORDER } from '@/lib/menuGroups';

// 双轨开关:默认走数据库(后端 MigrateMenu 已 seed 50+ 条);
// 设成 'false' 即回退到 menu-config.tsx 硬编码分支,用于线上出问题时热切。
const USE_DB_MENU = process.env.NEXT_PUBLIC_USE_DB_MENU !== 'false';

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

export default function SystemLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin, can } = useAuthority();
  const { currentUser, menuData } = useApp();
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  // 手机端抽屉菜单(< md 侧栏隐藏,之前后台在手机上根本没法切页面)
  const [navOpen, setNavOpen] = useState(false);

  // 当前菜单项 = 按 URL 最长前缀匹配出来的那一项(/system/role/detail → 角色管理)。
  // 之前这里是一份「标签页」状态 + 一张 PageComponents 注册表:点菜单只改状态、不改 URL,
  // 内容区按 activeTab 去注册表里取组件。后果有三个 ——
  //   · 注册表里漏登记的菜单(筛选配置)取不到组件,回落去渲染 children,
  //     也就是 URL 那一页,于是「点哪个菜单都是同一个界面」;
  //   · URL 永远停在进后台时的那条路径(比如 /system/moderation/reports),
  //     刷新 / 收藏 / 前进后退全都回到那一页;
  //   · 在子路由上点菜单会 router.push('/system'),URL 一变又把 activeTab 同步回默认项。
  // 现在菜单就是普通导航:点它跳 item.path,每个菜单都有自己的 URL。
  //
  // 双轨:
  //   - 硬编码分支(USE_DB_MENU=false):从 MENU_GROUPS 找;保持旧行为
  //   - 数据库分支(默认):从 menuData 找;菜单项的 id/label/path 跟数据库一致
  const activeItem = useMemo(() => {
    if (!pathname) return null;
    const source: Array<{ id: string; path: string; label: string }> = USE_DB_MENU
      ? menuData.map((m) => ({ id: String(m.id), path: m.path ?? '', label: m.name ?? '' }))
      : MENU_GROUPS.flatMap((g) => g.items).map((it) => ({ id: it.id, path: it.path, label: it.label }));
    let match: { id: string; path: string; label: string } | undefined;
    for (const it of source) {
      const hit = it.path && (pathname === it.path || pathname.startsWith(it.path + '/'));
      if (hit && (!match || it.path.length > match.path.length)) match = it;
    }
    return match ?? null;
  }, [pathname, menuData]);

  // 过滤有权限的菜单项,并按 MENU_GROUP_ORDER 排序分组。
  //
  // 双轨:
  //   - USE_DB_MENU=false:保持原 menu-config.tsx 行为(防御性 fallback)
  //   - 默认:从 useApp().menuData(由 AuthContext.loadUser 写入)按 code 过滤、按 group 聚合
  //
  // menu.code 为 NULL 的菜单视作公共,所有人都能看。
  const visibleGroups = useMemo(() => {
    if (!USE_DB_MENU) {
      return MENU_GROUPS
        .map((g) => ({ ...g, items: g.items.filter((it) => !it.permission || can(it.permission)) }))
        .filter((g) => g.items.length > 0);
    }

    const visible = menuData.filter((m) => !m.code || can(m.code));
    const map = new Map<string, MenuItemDef[]>();
    for (const m of visible) {
      const g = m.group ?? 'default';
      if (!map.has(g)) map.set(g, []);
      const Icon = resolveMenuIcon(m.icon);
      map.get(g)!.push({
        id: String(m.id),
        label: m.name ?? '',
        path: m.path ?? '#',
        icon: <Icon sx={{ fontSize: 18 }} />,
        accent: m.accent ?? 'inherit',
        permission: m.code ?? undefined,
      });
    }
    // 按 MENU_GROUP_ORDER 排;缺失的 group 自动跳过,数据库返回顺序不影响侧栏。
    return MENU_GROUP_ORDER
      .filter((g) => map.has(g))
      .map((g) => ({ title: MENU_GROUP_LABELS[g] ?? g, items: map.get(g)! }));
  }, [menuData, can]);

  const handleMenuClick = (item: MenuItemDef) => {
    if (pathname !== item.path) router.push(item.path);
  };

  const handleReturnToFront = () => {
    setUserMenuAnchor(null);
    const entry = sessionStorage.getItem('admin_entry_path');
    sessionStorage.removeItem('admin_entry_path');
    router.push(entry && entry !== '/system/role' ? entry : '/home/recommend');
  };

  // 数据库分支下,menuData 还没回来(首次登录 / 刷新 / 接口失败)时给个骨架,
  // 避免渲染出"无访问权限"的占位 — menuData 空 ≠ 没权限。
  if (USE_DB_MENU && !menuData.length) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'var(--bg-body, transparent)' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

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

  // 菜单分组:桌面端侧栏和手机端抽屉共用一份
  const navGroups = (
    <>
        {visibleGroups.map((group) => (
          <Box key={group.title} sx={{ mb: 0.5 }}>
            <Box sx={{ px: 3, pt: 1.5, pb: 0.5 }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted, currentColor)', letterSpacing: 1, textTransform: 'uppercase' }}>
                {group.title}
              </Typography>
            </Box>
            {group.items.map((item) => {
              const isActive = activeItem?.path === item.path;
              return (
                <Box
                  key={item.id}
                  onClick={() => {
                    handleMenuClick(item);
                    setNavOpen(false);
                  }}
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
    </>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'var(--app-height, 100vh)',
        overflow: 'hidden',
        bgcolor: 'var(--bg-body, transparent)',
        color: 'var(--text-primary, currentColor)',
      }}
    >
      {/* 顶部条 */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: { xs: 1, md: 2 },
          minHeight: 60,
          pt: 'var(--sat, 0px)',
          px: { xs: 1.5, md: 3 },
          bgcolor: 'var(--bg-topbar, transparent)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-color, transparent)',
          flexShrink: 0,
        }}
      >
        <IconButton
          size="small"
          aria-label="打开菜单"
          onClick={() => setNavOpen(true)}
          sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'var(--text-secondary, currentColor)' }}
        >
          <MenuRoundedIcon />
        </IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: { xs: 0, md: 180 } }}>
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
            <Typography sx={{ fontSize: 10, color: 'var(--text-muted, currentColor)', mt: 0.25, display: { xs: 'none', sm: 'block' } }}>
              Admin Console
            </Typography>
          </Box>
        </Box>

        <Typography sx={{ fontSize: 13, color: 'var(--text-muted, currentColor)', display: { xs: 'none', sm: 'block' } }}>/</Typography>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary, currentColor)', minWidth: 0 }}>
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
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column', lineHeight: 1.15 }}>
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
        {/* 手机端抽屉 */}
        <Drawer
          anchor="left"
          open={navOpen}
          onClose={() => setNavOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' } }}
          slotProps={{
            paper: {
              sx: {
                width: 272,
                bgcolor: 'var(--bg-elevated, #111)',
                color: 'var(--text-primary, currentColor)',
                pt: 'var(--sat, 0px)',
                pb: 'var(--sab, 0px)',
              },
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid var(--border-color, transparent)' }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, flex: 1 }}>系统管理</Typography>
            <IconButton size="small" onClick={() => setNavOpen(false)} aria-label="关闭菜单">
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, py: 1, overflow: 'auto' }}>{navGroups}</Box>
        </Drawer>

        {/* 左侧导航 */}
        <Box
          component="nav"
          sx={{
            width: 220,
            flexShrink: 0,
            bgcolor: 'var(--bg-sidebar, transparent)',
            borderRight: '1px solid var(--border-color, transparent)',
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            height: '100%',
          }}
        >
          <Box sx={{ flex: 1, py: 1.5, overflow: 'auto' }}>
            {navGroups}
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
        <Box component="main" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1.5, md: 3 }, WebkitOverflowScrolling: 'touch' }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
