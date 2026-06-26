'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Skeleton from '@mui/material/Skeleton';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import ModeCommentOutlinedIcon from '@mui/icons-material/ModeCommentOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { adminClient } from '@/lib/api/client';

const SUB_TYPES = [
  { key: 'all', label: '最新' },
  { key: 'comment', label: '评论' },
  { key: 'mention', label: '@我的' },
  { key: 'like', label: '赞' },
  { key: 'follow', label: '粉丝' },
  { key: 'friend', label: '好友' },
];

function timeAgo(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return d.toLocaleDateString('zh-CN').replace(/\//g, '/');
}

export default function NoticeIconView() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [tab, setTab] = useState<'interaction' | 'system'>('interaction');
  const [subType, setSubType] = useState('all');

  // 从后端拉未读数(用于 badge)—— 未登录不发请求(否则会 401 刷屏)
  const { data: countData } = useQuery({
    queryKey: ['notice-count'],
    queryFn: async () => (await adminClient('/notice/count')).data,
    refetchInterval: 30000,
    enabled: isAuthenticated,
  });

  const { data: interactionData, isLoading: loadingInter } = useQuery({
    queryKey: ['notice-interaction', subType],
    queryFn: async () => (await adminClient('/notice/interaction/list', { params: { subType } })).data,
    enabled: tab === 'interaction' && Boolean(anchorEl),
  });

  const { data: systemData, isLoading: loadingSystem } = useQuery({
    queryKey: ['notice-system'],
    queryFn: async () => (await adminClient('/notice/system/list')).data,
    enabled: tab === 'system' && Boolean(anchorEl),
  });

  const list = tab === 'interaction' ? interactionData?.list || [] : systemData?.list || [];
  const loading = tab === 'interaction' ? loadingInter : loadingSystem;
  const unread = countData?.total || 0;
  const interactionUnread = countData?.interaction || 0;
  const systemUnread = countData?.system || 0;

  const filteredList = useMemo(() => list, [list]);

  const open = Boolean(anchorEl);
  const id = open ? 'notice-popover' : undefined;

  return (
    <>
      <Tooltip title="通知">
        <IconButton size="small" sx={{ color: 'text.secondary' }} onClick={(e) => setAnchorEl(e.currentTarget)}>
          <Badge
            badgeContent={unread}
            color="error"
            sx={{ '& .MuiBadge-badge': { fontSize: 9, height: 14, minWidth: 14 } }}
          >
            <NotificationsNoneIcon sx={{ fontSize: 18 }} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: 380,
              maxHeight: 540,
              bgcolor: 'background.paper',
              border: '1px solid var(--border-color, transparent)',
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              backgroundImage: 'none',
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: 540 }}>
          {/* 标题栏 */}
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1.5, pb: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary', flex: 1 }}>
              消息中心
            </Typography>
            <IconButton size="small" onClick={() => setAnchorEl(null)} sx={{ color: 'text.secondary' }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          {/* Tab 切换 */}
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              minHeight: 32,
              px: 1.5,
              '& .MuiTabs-indicator': { bgcolor: 'primary.main', height: 2 },
              '& .MuiTab-root': {
                minHeight: 32,
                py: 0.5,
                fontSize: 13,
                fontWeight: 500,
                color: 'text.secondary',
                textTransform: 'none',
                '&.Mui-selected': { color: 'primary.main' },
              },
            }}
          >
            <Tab
              value="interaction"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <span>互动消息</span>
                  {interactionUnread > 0 && (
                    <Box sx={{ minWidth: 16, height: 16, borderRadius: 8, bgcolor: 'primary.main', color: '#FFF', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
                      {interactionUnread > 99 ? '99+' : interactionUnread}
                    </Box>
                  )}
                </Box>
              }
            />
            <Tab
              value="system"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <span>系统消息</span>
                  {systemUnread > 0 && (
                    <Box sx={{ minWidth: 16, height: 16, borderRadius: 8, bgcolor: 'primary.main', color: '#FFF', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
                      {systemUnread > 99 ? '99+' : systemUnread}
                    </Box>
                  )}
                </Box>
              }
            />
          </Tabs>

          {/* 互动消息子分类按钮(仅 interaction tab) */}
          {tab === 'interaction' && (
            <Box sx={{ display: 'flex', gap: 0.75, px: 1.5, py: 1, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
              {SUB_TYPES.map((s) => (
                <Box
                  key={s.key}
                  onClick={() => setSubType(s.key)}
                  sx={{
                    px: 1.25,
                    py: 0.4,
                    borderRadius: 1,
                    bgcolor: subType === s.key ? 'rgba(254, 44, 85, 0.18)' : 'action.hover',
                    color: subType === s.key ? 'primary.main' : 'text.secondary',
                    fontSize: 12,
                    fontWeight: subType === s.key ? 600 : 400,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: subType === s.key ? 'rgba(254, 44, 85, 0.25)' : 'action.selected' },
                  }}
                >
                  {s.label}
                </Box>
              ))}
            </Box>
          )}

          {/* 列表 */}
          <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {loading ? (
              <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={64} sx={{ bgcolor: 'action.hover' }} />
                ))}
              </Box>
            ) : filteredList.length === 0 ? (
              <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    bgcolor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircleOutlineIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
                </Box>
                <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>暂无消息</Typography>
              </Box>
            ) : (
              filteredList.map((item: any) => (
                <InteractionItem key={item.id} item={item} onClose={() => setAnchorEl(null)} />
              ))
            )}
          </Box>

          {/* 底部页脚 */}
          <Box
            onClick={() => {
              setAnchorEl(null);
              router.push('/account/msg');
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              py: 1.25,
              borderTop: '1px solid var(--border-color, transparent)',
              color: 'primary.main',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.15s',
              '&:hover': { bgcolor: 'rgba(254, 44, 85, 0.06)' },
            }}
          >
            <span>查看全部消息</span>
            <OpenInNewIcon sx={{ fontSize: 12 }} />
          </Box>
        </Box>
      </Popover>
    </>
  );
}

function InteractionItem({ item, onClose }: { item: any; onClose: () => void }) {
  const typeIcon = (() => {
    if (item.type === 'comment') return <CommentOutlinedIcon sx={{ fontSize: 12, color: 'secondary.main' }} />;
    if (item.type === 'mention') return <AlternateEmailIcon sx={{ fontSize: 12, color: '#5B8DEF' }} />;
    if (item.type === 'like') return <FavoriteBorderIcon sx={{ fontSize: 12, color: 'primary.main' }} />;
    if (item.type === 'follow') return <PersonAddAlt1Icon sx={{ fontSize: 12, color: 'warning.main' }} />;
    return null;
  })();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.25,
        px: 1.5,
        py: 1.25,
        cursor: 'pointer',
        transition: 'background 0.15s',
        borderBottom: '1px solid var(--border-color, transparent)',
        '&:hover': { bgcolor: 'action.hover' },
        position: 'relative',
      }}
    >
      {item.unread && (
        <Box
          sx={{
            position: 'absolute',
            left: 6,
            top: 18,
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: 'primary.main',
          }}
        />
      )}
      <Box sx={{ position: 'relative', flexShrink: 0, ml: 1 }}>
        <img
          src={item.avatar}
          alt=""
          style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
          <Typography sx={{ fontSize: 13, fontWeight: item.unread ? 600 : 500, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.nickname || item.title}
          </Typography>
          {typeIcon && <Box sx={{ display: 'flex', alignItems: 'center' }}>{typeIcon}</Box>}
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 10, color: 'text.disabled', flexShrink: 0 }}>
            {timeAgo(item.time)}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: 12,
            color: item.unread ? 'text.primary' : 'text.secondary',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {item.content}
        </Typography>
      </Box>
      {item.targetCover && (
        <Box sx={{ flexShrink: 0, ml: 0.5 }}>
          <img
            src={item.targetCover}
            alt=""
            style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover', display: 'block' }}
          />
        </Box>
      )}
    </Box>
  );
}

// 私信图标(DM 入口) — 走 useQuery 拿未读数
export function DmIconView() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { data: sessions } = useQuery({
    queryKey: ['dm-sessions-badge'],
    queryFn: async () => (await adminClient('/msg/session/list')).data,
    enabled: isAuthenticated,  // 未登录不发请求(否则 401 刷屏)
  });
  const unread = useMemo(() => {
    const list = sessions?.list || [];
    return list.reduce((sum: number, s: any) => sum + (s.unread || 0), 0);
  }, [sessions]);

  return (
    <Tooltip title="私信">
      <IconButton size="small" sx={{ color: 'text.secondary' }} onClick={() => router.push('/account/msg')}>
        <Badge
          badgeContent={unread}
          color="error"
          sx={{ '& .MuiBadge-badge': { fontSize: 9, height: 14, minWidth: 14 } }}
        >
          <ModeCommentOutlinedIcon sx={{ fontSize: 18 }} />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
