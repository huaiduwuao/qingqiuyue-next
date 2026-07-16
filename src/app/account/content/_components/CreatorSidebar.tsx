'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import EventIcon from '@mui/icons-material/Event';
import MovieIcon from '@mui/icons-material/Movie';
import CollectionsIcon from '@mui/icons-material/Collections';
import GroupsIcon from '@mui/icons-material/Groups';
import CopyrightIcon from '@mui/icons-material/Copyright';
import InsightsIcon from '@mui/icons-material/Insights';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import { useAuthority } from '@/contexts/AuthContext';

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  route: string;
  badge?: string;
  /**
   * If set, the entry is hidden unless the current user has at least one of these authorities.
   * Default: visible to everyone.
   */
  requireAuthority?: string[];
}

interface MenuGroup {
  id: string;
  title: string | null; // null = no header (used for the home item)
  items: MenuItem[];
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    id: 'home',
    title: null,
    items: [
      { id: 'content', label: '工作台', icon: <DashboardRoundedIcon />, route: 'content' },
    ],
  },
  {
    id: 'create',
    title: '创作',
    items: [
      { id: 'hd-publish', label: '发布', icon: <PublishRoundedIcon />, route: 'hd-publish' },
      { id: 'hd-review', label: '审核员工作台', icon: <RateReviewRoundedIcon />, route: 'hd-review', requireAuthority: ['REVIEWER', 'ADMIN', 'SUPER_ADMIN'] },
      { id: 'shortdrama-gen', label: '短剧生成工作流', icon: <VideoLibraryIcon />, route: 'shortdrama-gen', badge: 'NEW' },
      { id: 'activity', label: '活动管理', icon: <EventIcon />, route: 'activity' },
      { id: 'co-create', label: '共创中心', icon: <GroupsIcon />, route: 'co-create' },
      { id: 'collection', label: '合集管理', icon: <CollectionsIcon />, route: 'collection' },
    ],
  },
  {
    id: 'content',
    title: '内容',
    items: [
      { id: 'works', label: '作品管理', icon: <MovieIcon />, route: 'works' },
      { id: 'spider', label: '爬虫管理', icon: <TravelExploreIcon />, badge: 'NEW', route: 'spider' },
      { id: 'crawled', label: '抓取内容', icon: <CloudDownloadIcon />, badge: 'NEW', route: 'crawled' },
      { id: 'original', label: '原创保护', icon: <CopyrightIcon />, route: 'original' },
    ],
  },
  {
    id: 'analytics',
    title: '数据',
    items: [
      { id: 'data', label: '数据中心', icon: <InsightsIcon />, route: 'data' },
      { id: 'creator', label: '等级勋章', icon: <EmojiEventsRoundedIcon />, route: 'creator' },
    ],
  },
  {
    id: 'monetize',
    title: '变现',
    items: [
      { id: 'monetize', label: '变现中心', icon: <MonetizationOnIcon />, badge: '3', route: 'monetize' },
      { id: 'bot', label: '假人管理', icon: <SmartToyIcon />, route: 'bot', requireAuthority: ['ADMIN', 'SUPER_ADMIN'] },
    ],
  },
];

// Flat list kept for back-compat (some callers may import MENU_ITEMS).
export const MENU_ITEMS = MENU_GROUPS.flatMap((g) => g.items);

interface Props {
  selected?: string;
  onSelect?: (id: string) => void;
}

export default function CreatorSidebar({ selected = 'content', onSelect }: Props) {
  const { hasAuthority } = useAuthority();

  const isVisible = (item: MenuItem) =>
    !item.requireAuthority || item.requireAuthority.some((a) => hasAuthority(a));

  const handleClick = (id: string) => {
    // Tab switching is state-driven (see ActiveTabContext). The parent layout
    // owns the state and is responsible for rendering the matching view. We
    // deliberately do NOT call router.push here — that would push a new
    // history entry per click and break the top-app-bar back arrow.
    onSelect?.(id);
  };

  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        height: '100%',
        bgcolor: 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Logo / Title */}
      <Box sx={{ p: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              background: 'linear-gradient(135deg, #25F4EE 0%, #FE2C55 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 18,
              color: 'background.default',
            }}
          >
            清
          </Box>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>
            创作者中心
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'divider', mx: 2 }} />

      {/* Menu */}
      <List sx={{ flex: 1, py: 1, overflow: 'auto' }}>
        {MENU_GROUPS.map((group, gIdx) => {
          const visibleItems = group.items.filter(isVisible);
          if (visibleItems.length === 0) return null;
          return (
          <Box key={group.id}>
            {group.title && (
              <Typography
                sx={{
                  px: 2.5,
                  pt: gIdx === 0 ? 0 : 1.5,
                  pb: 0.5,
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'text.disabled',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                {group.title}
              </Typography>
            )}
            {visibleItems.map((item) => {
              const isSelected = selected === item.id;
              return (
                <ListItemButton
                  key={item.id}
                  onClick={() => handleClick(item.id)}
                  sx={{
                    mx: 1,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1,
                    position: 'relative',
                    bgcolor: isSelected ? 'rgba(254, 44, 85, 0.12)' : 'transparent',
                    color: isSelected ? 'primary.main' : 'text.tertiary',
                    '&:hover': {
                      bgcolor: isSelected ? 'rgba(254, 44, 85, 0.18)' : 'action.hover',
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
                          bgcolor: 'primary.main',
                        }
                      : {},
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 32,
                      color: isSelected ? 'primary.main' : 'text.secondary',
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
                  {item.badge && (
                    <Chip
                      label={item.badge}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: 10,
                        fontWeight: 700,
                        bgcolor: 'primary.main',
                        color: 'text.primary',
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                  )}
                </ListItemButton>
              );
            })}
          </Box>
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
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>系统运行中</Typography>
        </Box>
        <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.5 }}>
          v2.0.1 · 2026.06.01
        </Typography>
      </Box>
    </Box>
  );
}
