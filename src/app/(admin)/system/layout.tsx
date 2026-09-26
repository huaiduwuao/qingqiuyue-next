'use client';

import { useState, useMemo, useCallback, useEffect, useRef, useTransition, type ReactNode } from 'react';
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
import LinearProgress from '@mui/material/LinearProgress';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MenuItem from '@mui/material/MenuItem';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import UnfoldLessRoundedIcon from '@mui/icons-material/UnfoldLessRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import InputBase from '@mui/material/InputBase';
import Collapse from '@mui/material/Collapse';
import { useAuth, useAuthority } from '@/contexts/AuthContext';
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

// 侧栏分组的展开/收起记在本机(每个浏览器各自一份),值是 { 分组标题: 是否展开 }。
// 没记过的分组默认只展开当前页面所在的那一组 —— 80 多个菜单全摊开根本找不到东西。
const NAV_OPEN_KEY = 'admin_nav_groups';

function loadNavOpen(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAV_OPEN_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function saveNavOpen(v: Record<string, boolean>) {
  try {
    localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(v));
  } catch {
    /* 隐私模式 / 存储被禁:只是记不住,不影响使用 */
  }
}

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
  const { status } = useAuth();
  const { currentUser, menuData } = useApp();
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  // 手机端抽屉菜单(< md 侧栏隐藏,之前后台在手机上根本没法切页面)
  const [navOpen, setNavOpen] = useState(false);
  // 侧栏分组展开状态(见 NAV_OPEN_KEY)与菜单搜索词
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(loadNavOpen);
  const [navQuery, setNavQuery] = useState('');

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
  // 菜单来源双轨(见下面的 dbGroups / staticGroups):数据库优先,给不出来时回落
  // 到 menu-config.tsx。activeItem 跟着真正渲染出来的那份走,放在 visibleGroups 之后。

  // 数据库分支:从 useApp().menuData(由 AuthContext.loadUser 写入)按 code 过滤、
  // 按 group 聚合。menu.code 为 NULL 的菜单视作公共,所有人都能看。
  //
  // 结果可能是空数组:菜单接口还没回来、请求失败,或者库里的菜单一条都没有 group
  // (线上 menu 表里那批只有 path 的旧行就是这样 —— 它们会被下面的 MENU_GROUP_ORDER
  // 过滤掉)。空数组时由 staticGroups 兜底,见 visibleGroups。
  const dbGroups = useMemo(() => {
    if (!USE_DB_MENU) return [] as Array<{ title: string; items: MenuItemDef[] }>;

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

  // 硬编码分支:既是 USE_DB_MENU=false 的行为,也是数据库那边给不出菜单时的兜底。
  const staticGroups = useMemo(() => {
    return MENU_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((it) => !it.permission || can(it.permission)) }))
      .filter((g) => g.items.length > 0);
  }, [can]);

  // 侧栏空白 = 后台没法用(每个菜单现在都是独立路由,点不到就只能背 URL)。
  // 所以数据库菜单一条都聚不出来时回到 menu-config.tsx 这份已知可用的清单,
  // 而不是渲染一个空侧栏 —— NEXT_PUBLIC_USE_DB_MENU 是构建期开关,线上出问题
  // 光靠它救不回来,得再发一次版。
  const visibleGroups = dbGroups.length > 0 ? dbGroups : staticGroups;

  const activeItem = useMemo(() => {
    if (!pathname) return null;
    let match: MenuItemDef | undefined;
    for (const group of visibleGroups) {
      for (const it of group.items) {
        const hit = it.path && (pathname === it.path || pathname.startsWith(it.path + '/'));
        if (hit && (!match || it.path.length > match.path.length)) match = it;
      }
    }
    return match ?? null;
  }, [pathname, visibleGroups]);

  // 搜索:按菜单名 / 路径 / 分组名过滤,命中的分组全部展开
  const q = navQuery.trim().toLowerCase();
  const shownGroups = useMemo(() => {
    if (!q) return visibleGroups;
    return visibleGroups
      .map((g) => ({
        ...g,
        items: g.title.toLowerCase().includes(q)
          ? g.items
          : g.items.filter((it) => it.label.toLowerCase().includes(q) || it.path.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [q, visibleGroups]);

  const activeGroupTitle = useMemo(
    () => visibleGroups.find((g) => g.items.some((it) => it.path === activeItem?.path))?.title ?? null,
    [visibleGroups, activeItem],
  );

  const isGroupOpen = (title: string) => (q ? true : groupOpen[title] ?? title === activeGroupTitle);

  const setGroups = useCallback((next: Record<string, boolean>) => {
    setGroupOpen(next);
    saveNavOpen(next);
  }, []);

  const toggleGroup = (title: string) => {
    if (q) return;
    setGroups({ ...groupOpen, [title]: !isGroupOpen(title) });
  };

  const allOpen = visibleGroups.length > 0 && visibleGroups.every((g) => isGroupOpen(g.title));
  const setAllGroups = (open: boolean) =>
    setGroups(Object.fromEntries(visibleGroups.map((g) => [g.title, open])));

  // 切菜单的卡顿:菜单项是普通 Box + router.push,没有任何预取,点下去要先拉目标页的
  // RSC 数据(.txt)再拉它的 JS 分块,两轮往返(外网每轮 0.4s 起)期间界面毫无反应,
  // 高亮、标题、内容全停在旧页。现在三件事:
  //   · 悬停 / 聚焦 / 按下时 router.prefetch,点击时数据多半已经在路上或到了;
  //   · 空闲时把展开分组里的菜单也预取掉(每个路由只预取一次);
  //   · 点击即切高亮和标题,内容区顶端出进度条,直到新页面真正提交。
  const [navPending, startNav] = useTransition();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const prefetched = useRef(new Set<string>());
  const prefetch = useCallback(
    (path?: string) => {
      if (!path || path === '#' || prefetched.current.has(path)) return;
      prefetched.current.add(path);
      router.prefetch(path);
    },
    [router],
  );

  // URL 变了(点菜单、前进后退、页面内跳转)就不再有"待切换"的目标。
  // 过渡结束却没换 URL(跳转失败)时也要清掉,别让高亮一直停在没去成的菜单上。
  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);
  useEffect(() => {
    if (!navPending) setPendingPath(null);
  }, [navPending]);

  const handleMenuClick = (item: MenuItemDef) => {
    if (pathname === item.path) return;
    setPendingPath(item.path);
    startNav(() => router.push(item.path));
  };

  const handleReturnToFront = () => {
    setUserMenuAnchor(null);
    const entry = sessionStorage.getItem('admin_entry_path');
    sessionStorage.removeItem('admin_entry_path');
    router.push(entry && entry !== '/system/role' ? entry : '/home/recommend');
  };

  // 空闲预取展开分组里的菜单(默认只展开当前页所在分组,量不大)。
  const openPaths = useMemo(
    () =>
      visibleGroups
        .filter((g) => (q ? false : groupOpen[g.title] ?? g.title === activeGroupTitle))
        .flatMap((g) => g.items.map((it) => it.path)),
    [visibleGroups, groupOpen, activeGroupTitle, q],
  );
  useEffect(() => {
    if (!isAdmin || openPaths.length === 0) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const run = () => openPaths.forEach((p) => prefetch(p));
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 3000 });
      return () => w.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(run, 1200);
    return () => window.clearTimeout(t);
  }, [isAdmin, openPaths, prefetch]);

  // 点下去还没切过去时,高亮 / 标题先跟着目标走
  const shownPath = pendingPath ?? activeItem?.path;
  const shownLabel = pendingPath
    ? visibleGroups.flatMap((g) => g.items).find((it) => it.path === pendingPath)?.label
    : activeItem?.label;

  // 会话/当前用户还在拉的时候给个骨架,避免闪一下"无访问权限"— 菜单和权限都还没到。
  //
  // 这里**不**再按 menuData 为空拦整页:菜单接口失败或库里没有带 group 的菜单时,
  // 上面的 visibleGroups 会回落到硬编码清单;按空拦整页会把人永远卡在转圈上,
  // 连直接敲 URL 都进不去。
  if (status === 'loading') {
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
        {/* 菜单搜索 + 全部展开/收起 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mx: 1.5, mb: 1 }}>
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              height: 32,
              borderRadius: 1.5,
              bgcolor: 'var(--bg-hover, rgba(127,127,127,0.08))',
              border: '1px solid transparent',
              '&:focus-within': { borderColor: 'var(--border-color, rgba(127,127,127,0.3))' },
            }}
          >
            <SearchRoundedIcon sx={{ fontSize: 16, color: 'var(--text-muted, currentColor)' }} />
            <InputBase
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setNavQuery('');
                // 回车直接进第一个命中的菜单
                if (e.key === 'Enter' && q && shownGroups[0]?.items[0]) {
                  handleMenuClick(shownGroups[0].items[0]);
                  setNavQuery('');
                  setNavOpen(false);
                }
              }}
              placeholder="搜索菜单"
              inputProps={{ 'aria-label': '搜索菜单' }}
              sx={{ flex: 1, fontSize: 12.5, color: 'var(--text-primary, currentColor)', '& input': { p: 0 } }}
            />
          </Box>
          <Tooltip title={allOpen ? '全部收起' : '全部展开'}>
            <span>
              <IconButton
                size="small"
                disabled={!!q}
                onClick={() => setAllGroups(!allOpen)}
                aria-label={allOpen ? '全部收起' : '全部展开'}
                sx={{ color: 'var(--text-muted, currentColor)', borderRadius: 1.5 }}
              >
                {allOpen ? <UnfoldLessRoundedIcon sx={{ fontSize: 18 }} /> : <UnfoldMoreRoundedIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        {q && shownGroups.length === 0 && (
          <Typography sx={{ px: 3, py: 2, fontSize: 12, color: 'var(--text-muted, currentColor)' }}>没有匹配的菜单</Typography>
        )}
        {shownGroups.map((group) => {
          const open = isGroupOpen(group.title);
          const holdsActive = group.title === activeGroupTitle;
          return (
          <Box key={group.title} sx={{ mb: 0.25 }}>
            <Box
              role="button"
              tabIndex={0}
              aria-expanded={open}
              onClick={() => toggleGroup(group.title)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleGroup(group.title);
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                mx: 1.5,
                px: 1.5,
                py: 0.75,
                borderRadius: 1.5,
                cursor: q ? 'default' : 'pointer',
                userSelect: 'none',
                color: holdsActive && !open ? 'var(--text-primary, currentColor)' : 'var(--text-muted, currentColor)',
                '&:hover': q ? undefined : { bgcolor: 'var(--bg-hover, transparent)', color: 'var(--text-primary, currentColor)' },
                '&:focus-visible': { outline: '2px solid var(--brand-color, #FE2C55)', outlineOffset: -2 },
              }}
            >
              <Typography sx={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'inherit' }}>
                {group.title}
              </Typography>
              {/* 收起时仍标出当前页面所在的分组 */}
              {holdsActive && !open && (
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'var(--brand-color, #FE2C55)' }} />
              )}
              <Typography sx={{ fontSize: 10.5, color: 'var(--text-muted, currentColor)', opacity: 0.8, minWidth: 14, textAlign: 'right' }}>
                {group.items.length}
              </Typography>
              <ExpandMoreRoundedIcon
                sx={{
                  fontSize: 16,
                  transition: 'transform 0.18s',
                  transform: open ? 'none' : 'rotate(-90deg)',
                  opacity: q ? 0.3 : 1,
                }}
              />
            </Box>
            <Collapse in={open} timeout={160} unmountOnExit>
            {group.items.map((item) => {
              const isActive = shownPath === item.path;
              return (
                <Box
                  key={item.id}
                  onMouseEnter={() => prefetch(item.path)}
                  onFocus={() => prefetch(item.path)}
                  onPointerDown={() => prefetch(item.path)}
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
                    pl: 2.25,
                    pr: 1.5,
                    py: 0.85,
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
            </Collapse>
          </Box>
          );
        })}
    </>
  );

  return (
    <Box
      // 定高应用壳:音乐底栏的占位由内容滚动区自己留(见 globals.css 的 [data-app-shell])
      data-app-shell
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
          {shownLabel || '控制台'}
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
        <Box component="main" sx={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {navPending && (
            <LinearProgress
              aria-label="页面切换中"
              sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 2 }}
            />
          )}
          <Box sx={{ flex: 1, overflow: 'auto', opacity: navPending ? 0.6 : 1, transition: 'opacity 0.15s', p: { xs: 1.5, md: 3 }, pb: { xs: 'calc(12px + var(--player-inset, 0px))', md: 'calc(24px + var(--player-inset, 0px))' }, WebkitOverflowScrolling: 'touch' }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
