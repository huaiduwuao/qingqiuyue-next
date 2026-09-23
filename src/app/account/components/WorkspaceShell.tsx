'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';

export interface WorkspaceNavItem {
  id: string;
  label: string;
  /** 一句话说明这个入口做什么,给第一次来的用户看。 */
  description?: string;
  icon: React.ReactNode;
}

export interface WorkspaceNavGroup {
  id: string;
  title?: string;
  items: WorkspaceNavItem[];
}

interface WorkspaceShellProps {
  title: string;
  logo: React.ReactNode;
  groups: WorkspaceNavGroup[];
  selected: string;
  onSelect: (id: string) => void;
  /** 附属信息栏:大屏显示在右侧,小屏排在主内容之后。 */
  aside?: React.ReactNode;
  children: React.ReactNode;
}

const SIDEBAR_WIDTH = 232;

function NavList({ groups, selected, onSelect }: Pick<WorkspaceShellProps, 'groups' | 'selected' | 'onSelect'>) {
  return (
    <Box component="nav" aria-label="工作台导航" sx={{ flex: 1, overflow: 'auto', py: 1 }}>
      {groups.map((group) => (
        <List
          key={group.id}
          dense
          disablePadding
          subheader={
            group.title ? (
              <Typography
                component="div"
                sx={{ px: 2.5, pt: 1.5, pb: 0.5, fontSize: 11, fontWeight: 700, color: 'text.disabled', letterSpacing: 1 }}
              >
                {group.title}
              </Typography>
            ) : undefined
          }
        >
          {group.items.map((item) => {
            const active = item.id === selected;
            return (
              <ListItemButton
                key={item.id}
                selected={active}
                aria-current={active ? 'page' : undefined}
                onClick={() => onSelect(item.id)}
                sx={{
                  mx: 1,
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  color: active ? 'primary.main' : 'text.primary',
                  '&.Mui-selected, &.Mui-selected:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.12) },
                }}
              >
                <ListItemIcon
                  sx={{ minWidth: 32, color: active ? 'primary.main' : 'text.secondary', '& svg': { fontSize: 20 } }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={item.description}
                  slotProps={{
                    primary: { sx: { fontSize: 13, fontWeight: active ? 600 : 500 } },
                    secondary: {
                      sx: { fontSize: 11, color: 'text.disabled', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
                    },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      ))}
    </Box>
  );
}

/**
 * 账号工作台(创作者中心、奖励中心)共用的外壳:左侧分组导航 + 主内容区 + 可选附属栏;
 * 小屏时导航收进抽屉,顶部显示当前页面名。
 */
export function WorkspaceShell({ title, logo, groups, selected, onSelect, aside, children }: WorkspaceShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const current = groups.flatMap((g) => g.items).find((i) => i.id === selected);

  const select = (id: string) => {
    onSelect(id);
    setDrawerOpen(false);
  };

  const sidebar = (
    <Box sx={{ width: SIDEBAR_WIDTH, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 2 }}>
        {logo}
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{title}</Typography>
      </Box>
      <Divider sx={{ mx: 2 }} />
      <NavList groups={groups} selected={selected} onSelect={select} />
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        height: 'calc(100dvh - var(--appbar-h, 66px))',
        minHeight: 0,
        bgcolor: 'background.default',
        color: 'text.primary',
      }}
    >
      <Box sx={{ display: { xs: 'none', md: 'block' }, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider' }}>
        {sidebar}
      </Box>
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} sx={{ display: { md: 'none' } }}>
        {sidebar}
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* 窄屏目录入口。这条是移动端打开工作台导航(赏金广场/工作台/看板…)的唯一入口 ——
            外层 AccountLayout 的汉堡开的是另一套(个人中心/内容管理/设置),不能互相替代。
            这里只放汉堡不放标题:页面名外层 AppBar 已经显示了,重复一行会白占几十像素。 */}
        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
            alignItems: 'center',
            flexShrink: 0,
            px: 0.5,
            py: 0.25,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <IconButton size="small" onClick={() => setDrawerOpen(true)} aria-label="打开工作台导航">
            <MenuIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <Box
            component="main"
            sx={{
              flex: 1,
              minWidth: 0,
              overflow: 'auto',
              overscrollBehavior: 'contain',
              // 底部内距留出底部导航 / 音乐底栏(md 以下才有底部导航)。
              // 与 /home/recommend 的 main 一致 —— 否则滚动到最后几条悬赏会被底部导航盖住,
              // 而且 main 的可视高度扣少了底部导航,长列表可滚动范围比应该的小。
              pb: 'calc(12px + var(--bottom-nav-inset, 0px) + var(--player-inset, 0px))',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {children}
            {aside && <Box sx={{ display: { lg: 'none' } }}>{aside}</Box>}
          </Box>
          {aside && (
            <Box component="aside" sx={{ display: { xs: 'none', lg: 'block' }, flexShrink: 0, overflow: 'auto', p: 3, pl: 0 }}>
              {aside}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default WorkspaceShell;
