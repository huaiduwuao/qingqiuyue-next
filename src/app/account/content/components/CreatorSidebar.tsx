'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import HdIcon from '@mui/icons-material/Hd';
import EventIcon from '@mui/icons-material/Event';
import ArticleIcon from '@mui/icons-material/Article';
import MovieIcon from '@mui/icons-material/Movie';
import CollectionsIcon from '@mui/icons-material/Collections';
import GroupsIcon from '@mui/icons-material/Groups';
import CopyrightIcon from '@mui/icons-material/Copyright';
import ForumIcon from '@mui/icons-material/Forum';
import InsightsIcon from '@mui/icons-material/Insights';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import CreateIcon from '@mui/icons-material/Create';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import StarsIcon from '@mui/icons-material/Stars';
import NotificationsIcon from '@mui/icons-material/Notifications';

export const MENU_ITEMS = [
  { id: 'hd-publish', label: '高清发布', icon: <HdIcon />, route: 'hd-publish' },
  { id: 'activity', label: '活动管理', icon: <EventIcon />, route: 'activity' },
  { id: 'content', label: '内容管理', icon: <ArticleIcon />, badge: 'NEW', route: 'content' },
  { id: 'spider', label: '爬虫管理', icon: <TravelExploreIcon />, badge: 'NEW', route: 'spider' },
  { id: 'crawled', label: '抓取内容', icon: <CloudDownloadIcon />, badge: 'NEW', route: 'crawled' },
  { id: 'works', label: '作品管理', icon: <MovieIcon />, route: 'works' },
  { id: 'collection', label: '合集管理', icon: <CollectionsIcon />, route: 'collection' },
  { id: 'co-create', label: '共创中心', icon: <GroupsIcon />, route: 'co-create' },
  { id: 'original', label: '原创保护中心', icon: <CopyrightIcon />, route: 'original' },
  { id: 'interaction', label: '互动管理', icon: <ForumIcon />, badge: '99+', route: 'interaction' },
  { id: 'data', label: '数据中心', icon: <InsightsIcon />, route: 'data' },
  { id: 'monetize', label: '变现中心', icon: <MonetizationOnIcon />, badge: '3', route: 'monetize' },
  { id: 'points', label: '积分中心', icon: <StarsIcon />, badge: 'NEW', route: 'points' },
  { id: 'notifications', label: '通知中心', icon: <NotificationsIcon />, badge: 'NEW', route: 'notifications' },
  { id: 'creator', label: '创作中心', icon: <CreateIcon />, route: 'creator' },
];

interface Props {
  selected?: string;
  onSelect?: (id: string) => void;
}

export default function CreatorSidebar({ selected = 'content', onSelect }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const handleClick = (id: string, route: string) => {
    onSelect?.(id);
    router.push(id === 'content' ? '/account/content' : `/account/content/${route}`);
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
            清秋月创作者中心
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'divider', mx: 2 }} />

      {/* Menu */}
      <List sx={{ flex: 1, py: 1, overflow: 'auto' }}>
        {MENU_ITEMS.map((item) => {
          const isSelected = selected === item.id || pathname?.endsWith(`/${item.route}`);
          return (
            <ListItemButton
              key={item.id}
              onClick={() => handleClick(item.id, item.route)}
              sx={{
                mx: 1,
                px: 1.5,
                py: 1,
                borderRadius: 1,
                position: 'relative',
                bgcolor: isSelected ? 'rgba(254, 44, 85, 0.12)' : 'transparent',
                color: isSelected ? 'primary.main' : 'text.tertiary',
                '&:hover': {
                  bgcolor: isSelected ? 'rgba(254, 44, 85, 0.18)' : 'rgba(255, 255, 255, 0.05)',
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
