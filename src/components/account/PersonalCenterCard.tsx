'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLikesPreview, getAccountStats } from '@/apis/dashboard';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import EditIcon from '@mui/icons-material/Edit';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import { useAuthority, useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { updateUser } from '@/apis/account';
import { gradient2, IMAGE_OVERLAY } from '@/constants/gradients';

// PROFILE 不再硬编码,昵称/统计从 currentUser 取(后端 /api/core/user/current)
// 我的喜欢预览完全由 /api/core/account/likes/preview 拉取,不再用任何静态 fallback。
interface Section {
  key: string;
  label: string;
  count?: string;
  icon: React.ReactNode;
  href: string;
}

// SECTIONS 改为"模板",count 在渲染时由 stats 实时注入(避免硬编码 '49'/'30天内'/'2'/'0' 跟实际不符)。
// 渲染函数 buildSections() 接收 stats,返回带 count 的 Section[]。
interface SectionTemplate {
  key: 'likes' | 'favorites' | 'history' | 'watchlater' | 'works' | 'reservation' | 'orders';
  label: string;
  icon: React.ReactNode;
  href: string;
  /** 取 stats 哪个字段;undefined 表示不展示 count */
  statKey?: 'likesCount' | 'favoritesCount' | 'historyCount' | 'watchlaterCount' | 'worksCount';
  /** 特殊文案(如"30天内"),不为空时直接覆盖数字 */
  display?: string;
}
const SECTION_TPLS: SectionTemplate[] = [
  { key: 'likes',      label: '我的喜欢', icon: <FavoriteRoundedIcon sx={{ fontSize: 18, color: 'error.main' }} />,       href: '/home/recommend?tab=me&mainTab=likes',     statKey: 'likesCount' },
  { key: 'favorites',  label: '我的收藏', icon: <StarRoundedIcon sx={{ fontSize: 18, color: 'warning.main' }} />,         href: '/home/recommend?tab=me&mainTab=collect',  statKey: 'favoritesCount' },
  { key: 'history',    label: '观看历史', icon: <HistoryRoundedIcon sx={{ fontSize: 18, color: 'secondary.main' }} />,      href: '/home/recommend?tab=me&mainTab=history',  statKey: 'historyCount', display: '30天内' },
  { key: 'watchlater', label: '稍后再看', icon: <WatchLaterIcon sx={{ fontSize: 18, color: '#8B5CF6' }} />,                href: '/home/recommend?tab=me&mainTab=later',    statKey: 'watchlaterCount' },
  { key: 'works',      label: '我的作品', icon: <VideoLibraryIcon sx={{ fontSize: 18, color: 'primary.main' }} />,         href: '/account/content',                         statKey: 'worksCount' },
  { key: 'reservation',label: '我的预约', icon: <EventNoteRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} />,     href: '/home/recommend?tab=me&mainTab=order' },
  { key: 'orders',     label: '我的订单', icon: <ReceiptLongIcon sx={{ fontSize: 18, color: '#5B8DEF' }} />,                href: '/account/orders' },
];

function buildSections(stats: { likesCount?: number; favoritesCount?: number; historyCount?: number; watchlaterCount?: number; worksCount?: number } | undefined): Section[] {
  return SECTION_TPLS.map((t) => {
    const out: Section = { key: t.key, label: t.label, icon: t.icon, href: t.href };
    if (t.statKey) {
      const n = stats?.[t.statKey];
      if (n != null) {
        // 0 不显示数字(避免视觉噪音);>0 才展示
        if (n > 0) {
          out.count = t.display ? t.display : String(n);
        } else if (t.display) {
          out.count = t.display;
        }
      }
    }
    return out;
  });
}

export interface PersonalCenterCardProps {
  compact?: boolean;
  onNavigate?: () => void;
}

export function PersonalCenterCard({ compact = false, onNavigate }: PersonalCenterCardProps) {
  const [saveLogin, setSaveLogin] = useState(true);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const router = useRouter();
  const { isAdmin, isSuperAdmin } = useAuthority();
  const { logout } = useAuth();
  const { currentUser } = useApp();

  // 真接口拉"我喜欢的预览"
  const { data: likesResp } = useQuery({
    queryKey: ['account-likes-preview'],
    queryFn: () => getLikesPreview(),
    staleTime: 30 * 1000,
  });
  // 真实计数:likes/favorites/history/watchlater/works —— 后端 GET /api/core/account/stats
  const { data: accountStats } = useQuery({
    queryKey: ['account-stats'],
    queryFn: () => getAccountStats(),
    staleTime: 30 * 1000,
    enabled: !!currentUser?.id,
  });
  const LIKES_PREVIEW = (likesResp?.records ?? likesResp?.list ?? []).map((l) => ({
    id: l.id, title: l.title, cover: l.cover || gradient2('#C8A882', '#8B6F47'),
  }));

  useEffect(() => {
    const saved = (currentUser as any)?.saveLoginInfo;
    if (typeof saved === 'boolean') {
      setSaveLogin(saved);
    }
  }, [(currentUser as any)?.saveLoginInfo]);

  const handleSaveLoginChange = async (checked: boolean) => {
    setSaveLogin(checked);
    if (!currentUser?.id) return;
    try {
      await updateUser({ saveLoginInfo: checked });
    } catch {
      // 同步失败时至少保留本地状态,不打扰用户
    }
  };

  const go = (href: string) => {
    onNavigate?.();
    router.push(href);
  };

  const handleLogout = () => {
    setLogoutOpen(false);
    onNavigate?.();
    logout();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* === 未登录:显示登录入口(取代下面所有需登录的 UI) === */}
      {!currentUser && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 3 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: (t: any) =>
                t.palette.mode === 'dark'
                  ? 'radial-gradient(circle at 35% 35%, #2a2a3a 0%, #0a0a0f 70%)'
                  : 'radial-gradient(circle at 35% 35%, #e8e8ee 0%, #b8b8c0 70%)',
              boxShadow: (t: any) =>
                t.palette.mode === 'dark' ? '0 0 0 1px rgba(255,255,255,0.05)' : '0 0 0 1px rgba(0,0,0,0.08)',
            }}
          />
          <Typography
            sx={{
              fontSize: 13,
              color: 'text.secondary',
            }}
          >
            未登录
          </Typography>
          <Button
            variant="contained"
            onClick={() => {
              onNavigate?.();
              const here = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/home/recommend';
              sessionStorage.setItem('login_redirect', here);
              router.push('/user/login');
            }}
            sx={{
              mt: 0.5,
              px: 4,
              py: 1,
              borderRadius: 2,
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'none',
              background: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 100%)',
              boxShadow: '0 4px 14px rgba(254, 44, 85, 0.4)',
              '&:hover': { background: 'linear-gradient(135deg, #FE2C55 0%, #8B5CF6 90%)' },
            }}
          >
            立即登录
          </Button>
        </Box>
      )}

      {/* === 已登录才显示下面的内容 === */}
      {currentUser && (
      <>
      {/* === 资料头 === */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          onClick={() => go('/home/recommend?tab=me')}
          sx={{
            width: compact ? 40 : 56,
            height: compact ? 40 : 56,
            borderRadius: '50%',
            flexShrink: 0,
            background: (t: any) =>
              t.palette.mode === 'dark'
                ? 'radial-gradient(circle at 35% 35%, #2a2a3a 0%, #0a0a0f 70%)'
                : 'radial-gradient(circle at 35% 35%, #e8e8ee 0%, #b8b8c0 70%)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: (t: any) =>
              t.palette.mode === 'dark' ? '0 0 0 1px rgba(255,255,255,0.05)' : '0 0 0 1px rgba(0,0,0,0.08)',
            cursor: 'pointer',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              width: '70%',
              height: '70%',
              top: '15%',
              left: '15%',
              borderRadius: '50%',
              background: (t: any) =>
                t.palette.mode === 'dark'
                  ? 'radial-gradient(circle at 30% 30%, #3a3a44 0%, #2a2a32 40%, #1c1c24 80%)'
                  : 'radial-gradient(circle at 30% 30%, #f5f5f0 0%, #d8d8d0 40%, #a8a8a0 80%)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              width: '62%',
              height: '62%',
              top: '18%',
              left: '26%',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 60% 40%, transparent 0%, rgba(10, 10, 15, 0.85) 60%)',
            }}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              onClick={() => go('/home/recommend?tab=me')}
              sx={{ fontSize: compact ? 14 : 17, fontWeight: 600, color: 'text.primary', lineHeight: 1.2, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
            >
              {(currentUser as any)?.nickname ?? (currentUser as any)?.username ?? (currentUser as any)?.name ?? '未登录'}
            </Typography>
            <IconButton
              size="small"
              onClick={() => go('/home/recommend?tab=me')}
              sx={{
                color: 'text.secondary',
                p: 0.25,
                '&:hover': { color: 'primary.main' },
              }}
              aria-label="编辑资料"
            >
              <EditIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mt: 0.5,
              fontSize: 12,
              color: 'text.secondary',
            }}
          >
            <Box component="span">关注 {(currentUser as any)?.following ?? 0}</Box>
            <Box
              component="span"
              sx={{
                width: 2,
                height: 2,
                borderRadius: '50%',
                bgcolor: 'text.disabled',
              }}
            />
            <Box component="span">粉丝 {(currentUser as any)?.followers ?? 0}</Box>
          </Box>
        </Box>
      </Box>

      {/* === 我的喜欢 === */}
      <Box>
        <Box
          onClick={() => go('/home/recommend?tab=me&mainTab=like')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 1,
            cursor: 'pointer',
            '&:hover .pc-likes-arrow': { color: 'text.primary' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
            <FavoriteRoundedIcon sx={{ fontSize: 14, color: 'primary.main' }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>我的喜欢</Typography>
          </Box>
          <Box
            className="pc-likes-arrow"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              color: 'text.secondary',
              fontSize: 11,
              transition: 'color 0.15s',
            }}
          >
            <span>{(currentUser as any)?.likes ?? (currentUser as any)?.totalLikes ?? 0}</span>
            <ChevronRightIcon sx={{ fontSize: 14 }} />
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
          {LIKES_PREVIEW.length === 0 && (
            <Box
              sx={{
                gridColumn: '1 / -1',
                py: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                color: 'text.secondary',
                bgcolor: 'rgba(0,0,0,0.03)',
                borderRadius: 1,
              }}
            >
              {String('暂无喜欢内容(后端真点赞机制未上线, 暂为空)')}
            </Box>
          )}
          {LIKES_PREVIEW.map((p) => (
            <Box
              key={p.id}
              onClick={() => go('/home/recommend?tab=me&mainTab=like')}
              sx={{
                position: 'relative',
                aspectRatio: '3/4',
                borderRadius: 1,
                background: p.cover,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                '&:hover': { transform: 'translateY(-2px)' },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  inset: 0,
                  background: IMAGE_OVERLAY.LIGHT,
                },
              }}
            >
              <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 0.5, zIndex: 1 }}>
                <Typography sx={{ fontSize: 10, color: 'text.primary', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title}
                </Typography>
              </Box>
              <Box sx={{ position: 'absolute', bottom: 4, right: 4, zIndex: 1, display: 'flex', alignItems: 'center', gap: 0.25, color: 'text.primary', fontSize: 9, fontFamily: 'monospace' }}>
                <PlayArrowRoundedIcon sx={{ fontSize: 10 }} />
                12.3w
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* === 折叠列表 === */}
      <Box>
        {buildSections(accountStats).map((s, idx) => (
          <Box
            key={s.key}
            onClick={() => go(s.href)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              py: 1.25,
              borderTop: idx === 0 ? '1px solid' : 'none', borderTopColor: 'divider',
              borderBottom: '1px solid', borderBottomColor: 'divider',
              cursor: 'pointer',
              transition: 'background 0.15s',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Box sx={{ width: 24, height: 24, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
              {s.icon}
            </Box>
            <Typography sx={{ fontSize: 13, color: 'text.primary', flex: 1 }}>{s.label}</Typography>
            {s.count && (
              <Typography
                sx={{
                  fontSize: 11,
                  color: 'text.secondary',
                }}
              >
                {s.count}
              </Typography>
            )}
            <ChevronRightIcon
              sx={{
                fontSize: 14,
                color: 'text.disabled',
              }}
            />
          </Box>
        ))}
      </Box>

      {/* === 管理后台(管理员可见) === */}
      {isAdmin && (
        <Box
          onClick={() => {
            onNavigate?.();
            const fullPath = window.location.pathname + window.location.search;
            sessionStorage.setItem('admin_entry_path', fullPath);
            router.push('/system/role');
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            py: 1.25,
            borderTop: '1px solid', borderTopColor: 'divider',
            borderBottom: '1px solid', borderBottomColor: 'divider',
            cursor: 'pointer',
            transition: 'background 0.15s',
            '&:hover': { bgcolor: 'rgba(254, 44, 85, 0.06)' },
          }}
        >
          <Box sx={{ width: 24, height: 24, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(254, 44, 85, 0.12)' }}>
            <AdminPanelSettingsRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          </Box>
          <Typography sx={{ fontSize: 13, color: 'primary.main', flex: 1, fontWeight: 500 }}>管理后台</Typography>
          <ChevronRightIcon sx={{ fontSize: 14, color: 'primary.main' }} />
        </Box>
      )}

      {/* === 退出登录 + 保存登录信息 === */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 1 }}>
        <Box
          onClick={() => setLogoutOpen(true)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, cursor: 'pointer', '&:hover .pc-logout-text': { color: '#FF8AA8' } }}
        >
          <LogoutRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
          <Typography className="pc-logout-text" sx={{ fontSize: 13, color: 'primary.main', fontWeight: 500, transition: 'color 0.15s' }}>
            退出登录
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            sx={{
              fontSize: 11,
              color: 'text.secondary',
            }}
          >
            保存登录信息
          </Typography>
          <Switch
            checked={saveLogin}
            onChange={(e) => handleSaveLoginChange(e.target.checked)}
            size="small"
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': { color: 'primary.main' },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'primary.main' },
            }}
          />
        </Box>
      </Box>

      {/* === 退出登录确认 === */}
      <Dialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 3,
              background: (t: any) =>
                t.palette.mode === 'dark'
                  ? 'linear-gradient(180deg, #15171F 0%, #0A0B14 100%)'
                  : 'background.paper',
              border: (t: any) =>
                t.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : (t.palette.divider || '1px solid rgba(0,0,0,0.12)'),
            },
          },
        }}
      >
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              mx: 'auto',
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(254, 44, 85, 0.12)',
            }}
          >
            <LogoutRoundedIcon sx={{ fontSize: 28, color: 'primary.main' }} />
          </Box>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary', mb: 1 }}>
            确认退出登录?
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 3, lineHeight: 1.6 }}>
            退出后需要重新输入账号密码,关闭浏览器后 {saveLogin ? '仍会' : '不会'}保留登录状态
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button fullWidth variant="outlined" onClick={() => setLogoutOpen(false)} sx={{ borderRadius: 2, textTransform: 'none' }}>
              取消
            </Button>
            <Button
              fullWidth
              variant="contained"
              onClick={handleLogout}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                background: 'linear-gradient(90deg, #FE2C55 0%, #FF6B8A 100%)',
                '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FF6B8A 100%)', filter: 'brightness(1.1)' },
              }}
            >
              确认退出
            </Button>
          </Box>
        </Box>
      </Dialog>
      </>
      )}
    </Box>
  );
}
