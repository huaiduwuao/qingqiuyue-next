'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import Link from 'next/link';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';

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
  /**
   * 侧栏底部「去另一个中心」的入口(电脑端)。创作中心 ⇄ 悬赏中心以前互不相通,
   * 这里互相放一个带一句说明的跳转。手机上两个中心本来就是底部导航的两个 tab,不重复放。
   */
  crossLinks?: { label: string; description?: string; href: string; icon?: React.ReactNode }[];
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
 * 小屏时导航变成顶部一条横滑页签(不再是抽屉:全站只有首页那一个侧边栏)。
 */
export function WorkspaceShell({ title, logo, groups, selected, onSelect, aside, crossLinks, children }: WorkspaceShellProps) {
  const items = groups.flatMap((g) => g.items);
  const select = onSelect;

  const sidebar = (
    <Box sx={{ width: SIDEBAR_WIDTH, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 2 }}>
        {logo}
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{title}</Typography>
      </Box>
      <Divider sx={{ mx: 2 }} />
      <NavList groups={groups} selected={selected} onSelect={select} />
      {!!crossLinks?.length && (
        <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {crossLinks.map((l) => (
            <Box
              key={l.href}
              component={Link}
              href={l.href}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                p: 1.25,
                borderRadius: 1.5,
                textDecoration: 'none',
                color: 'text.primary',
                border: '1px solid',
                borderColor: 'divider',
                transition: 'border-color .2s, background-color .2s',
                '&:hover': { borderColor: 'primary.main', bgcolor: (t) => alpha(t.palette.primary.main, 0.06) },
              }}
            >
              {l.icon && <Box sx={{ display: 'flex', color: 'primary.main', '& svg': { fontSize: 20 } }}>{l.icon}</Box>}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{l.label}</Typography>
                {l.description && (
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.description}
                  </Typography>
                )}
              </Box>
              <ChevronRightRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            </Box>
          ))}
        </Box>
      )}
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

      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* 窄屏:工作台导航是顶栏下一条横滑页签(和 App 里的二级页签一样),不再是第二个 ≡ 抽屉 ——
            左上角的 ≡ 全站只有一个(首页侧边栏,见 MobileMenuButton)。 */}
        <Box
          component="nav"
          aria-label="工作台导航"
          sx={{
            display: { xs: 'flex', md: 'none' },
            flexShrink: 0,
            gap: 0.5,
            px: 1,
            py: 0.75,
            overflowX: 'auto',
            borderBottom: '1px solid',
            borderColor: 'divider',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {items.map((item) => {
            const active = item.id === selected;
            return (
              <Box
                key={item.id}
                component="button"
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={active ? 'page' : undefined}
                // 选中项横向滚进可视区(深链进来时可能在最右边)
                ref={active ? (el: HTMLButtonElement | null) => {
                  const bar = el?.parentElement;
                  if (!el || !bar) return;
                  const left = el.offsetLeft - bar.offsetLeft;
                  if (left + el.offsetWidth > bar.scrollLeft + bar.clientWidth || left < bar.scrollLeft) {
                    bar.scrollLeft = left - 16;
                  }
                } : undefined}
                sx={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.25,
                  py: 0.6,
                  border: 0,
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  whiteSpace: 'nowrap',
                  color: active ? 'primary.main' : 'text.secondary',
                  bgcolor: (t) => (active ? alpha(t.palette.primary.main, 0.12) : 'transparent'),
                  WebkitTapHighlightColor: 'transparent',
                  '& svg': { fontSize: 16 },
                }}
              >
                {item.icon}
                {item.label}
              </Box>
            );
          })}
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <Box
            component="main"
            sx={{
              flex: 1,
              minWidth: 0,
              overflow: 'auto',
              overscrollBehavior: 'contain',
              // 横向 + 顶 padding 给内容留呼吸空间;底部内距留出底部导航 / 音乐底栏
              // (md 以下才有底部导航)。与 /home/recommend 的 main 一致 —— 否则滚动到
              // 最后几条悬赏会被底部导航盖住,而且 main 的可视高度扣少了底部导航,
              // 长列表可滚动范围比应该的小。
              p: { xs: 1.5, md: 3 },
              pb: 'calc(12px + var(--bottom-nav-inset, 0px) + var(--player-inset, 0px))',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {children}
            {/* 附属栏:大屏在右侧;平板排在正文之后;手机不显示(手机的一级页各自单独设计,不堆电脑版的附属信息) */}
            {aside && <Box sx={{ display: { xs: 'none', md: 'block', lg: 'none' } }}>{aside}</Box>}
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
