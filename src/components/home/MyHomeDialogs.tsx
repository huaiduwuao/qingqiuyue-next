'use client';

import React, { useState } from 'react';
import { useQrDataUrl } from '@/components/common/QrCodeImage';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { postShare } from '@/apis/behavior';
import type { MyItem } from './myHomeModel';

// ─── 子组件:二维码名片 Dialog ───
export function QrCodeDialog({
  open, onClose, profile, currentUser, onMessage,
}: {
  open: boolean;
  onClose: () => void;
  profile: any;
  currentUser: any;
  onMessage: (msg: string) => void;
}) {
  const user = profile?.user || currentUser;
  const nickname = user?.nickname || currentUser?.nickname || currentUser?.name || '我';
  // douyinId 没拉到时不伪造 ID,直接用 uid(后端有唯一性);不再使用硬编码 '84301022' 兜底
  const douyinId = user?.douyinId || user?.id || currentUser?.id || '';
  const avatarSrc = user?.avatar || currentUser?.avatar;
  // 主页路由是 /u?id=<uid>(静态导出没有动态段);二维码里编 uid 而不是抖音号
  const profileUrl = `https://qingqiuyue.com/u?id=${encodeURIComponent(String(user?.id || currentUser?.id || douyinId))}`;
  // 本地生成(不再把主页链接发给第三方 api.qrserver.com,大陆也常加载失败)
  const qrSrc = useQrDataUrl(profileUrl, 240, 2);
  const [refreshing, setRefreshing] = useState(false);
  const [qrKey, setQrKey] = useState(0);

  const handleRefresh = () => {
    setRefreshing(true);
    setQrKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleSave = async () => {
    if (!qrSrc) return;
    try {
      // qrSrc 已是本地 data URL,直接作为下载链接,无需再 fetch(CSP connect-src 不含 data:)
      const a = document.createElement('a');
      a.href = qrSrc;
      a.download = `清秋月-${nickname}-${douyinId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      onMessage('已保存到下载文件夹');
    } catch {
      onMessage('保存失败,请长按二维码图片保存');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      onMessage('主页链接已复制');
    } catch {
      onMessage('复制失败');
    }
  };

  const handleShare = async () => {
    // 分享主页:后端记录计数(供传播效果统计)
    const uid = profile?.user?.id;
    if (uid) postShare({ contentId: uid }).catch(() => {});
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title: `${nickname}的主页`, text: `来清秋月关注 ${nickname}`, url: profileUrl });
        return;
      } catch {
        // user cancelled or share failed, fall through
      }
    }
    handleCopyLink();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
              t.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : `1px solid ${t.palette.divider}`,
            overflow: 'hidden',
          },
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(254, 44, 85, 0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 50% at 50% 100%, rgba(139, 92, 246, 0.1) 0%, transparent 60%)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2, pb: 0 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>我的二维码名片</Typography>
          <IconButton size="small" onClick={onClose} aria-label="关闭">
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Stack spacing={2.5} sx={{ px: 3, pb: 3, pt: 1.5, alignItems: 'center' }}>
          {/* 头像 + 名字 */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%', p: 1.5, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid var(--border-color, transparent)' }}>
            <Avatar src={avatarSrc} sx={{ width: 48, height: 48, border: '2px solid', borderColor: 'warning.main' }}>
              {nickname[0]}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>{nickname}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>抖音号: {douyinId}</Typography>
            </Box>
            <Box sx={{ px: 0.75, py: 0.25, borderRadius: 0.5, bgcolor: 'warning.main', color: '#1a1a1a', fontSize: 9, fontWeight: 700 }}>
              {user?.level || '月亮'}
            </Box>
          </Stack>

          {/* QR Code */}
          <Box
            sx={{
              position: 'relative',
              p: 1.5,
              borderRadius: 2.5,
              bgcolor: '#fff',
              boxShadow: '0 8px 32px rgba(254, 44, 85, 0.2)',
            }}
          >
            <Box
              component="img"
              key={qrKey}
              src={qrSrc ?? undefined}
              alt={`${nickname} 的二维码`}
              sx={{ display: 'block', width: 220, height: 220, opacity: refreshing ? 0.3 : 1, transition: 'opacity 0.3s' }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 36,
                height: 36,
                borderRadius: 1.5,
                bgcolor: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <Avatar src={avatarSrc} sx={{ width: 30, height: 30, fontSize: 12, fontWeight: 700 }}>
                {nickname[0]}
              </Avatar>
            </Box>
            {refreshing && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={28} sx={{ color: 'primary.main' }} />
              </Box>
            )}
          </Box>

          <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center' }}>
            扫一扫,加我好友 · 关注后可在「我的-关注」中找到
          </Typography>

          {/* 操作按钮 */}
          <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={handleSave}
              sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, borderColor: 'action.selected', color: 'text.secondary' }}
            >
              保存图片
            </Button>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              startIcon={<LinkRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={handleCopyLink}
              sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, borderColor: 'action.selected', color: 'text.secondary' }}
            >
              复制链接
            </Button>
            <Button
              fullWidth
              variant="contained"
              size="small"
              startIcon={<ShareRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={handleShare}
              sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' } }}
            >
              分享
            </Button>
          </Stack>

          <Box
            onClick={handleRefresh}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: 10,
              color: 'text.disabled',
              cursor: 'pointer',
              '&:hover': { color: 'text.secondary' },
            }}
          >
            <RefreshRoundedIcon sx={{ fontSize: 11 }} />
            二维码失效?点击刷新
          </Box>
        </Stack>
      </Box>
    </Dialog>
  );
}

// ─── 子组件:取消预约确认 Dialog ───
export function CancelAppointmentDialog({
  cancelDialog,
  setCancelDialog,
  onConfirm,
  pending,
}: {
  cancelDialog: MyItem | null;
  setCancelDialog: (it: MyItem | null) => void;
  onConfirm: (it: MyItem) => void;
  pending: boolean;
}) {
  return (
    <Dialog open={!!cancelDialog} onClose={() => setCancelDialog(null)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 700 }}>取消预约</DialogTitle>
      <DialogContent sx={{ fontSize: 13, color: 'text.secondary' }}>
        确定要取消「{cancelDialog?.title || '该直播'}」的预约吗?
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => setCancelDialog(null)} size="small" sx={{ textTransform: 'none', fontSize: 12 }}>
          再想想
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={() => cancelDialog && onConfirm(cancelDialog)}
          disabled={pending}
          sx={{ textTransform: 'none', fontSize: 12 }}
        >
          {pending ? '取消中…' : '确认取消'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
