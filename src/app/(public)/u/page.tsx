'use client';

// 用户主页 /u?id= —— 每个用户都有一个。动态、私信、好友列表里点头像都到这里。
//
// 这里是关注/取关、加好友/解除好友、拉黑/取消拉黑的落点:
// 消息列表里点一条消息只标记已读,不再顺手把人关注了;要关注就来主页点按钮。
// 拉黑即断开:双向关注/好友一并解除,对方也不能再关注/加好友/私信我。

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from '@/contexts/AuthContext';
import { formatApiError } from '@/lib/api/client';
import { TYPE_LABEL, useContentNavigate } from '@/lib/contentRoute';
import { CoverImage } from '@/components/common/CoverImage';
import { BotBadge } from '@/components/community/UserLine';
import {
  addFriend,
  blockUser,
  fetchUserProfile,
  fetchUserWorks,
  followUser,
  openDmSession,
  removeFriend,
  unblockUser,
  unfollowUser,
} from '@/apis/social';

function compact(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, '')}w`;
  return String(n);
}

export default function UserProfilePage() {
  const params = useSearchParams();
  const id = params.get('id') || '';
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const navigate = useContentNavigate();
  const [toast, setToast] = useState<string | null>(null);
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const [confirm, setConfirm] = useState<'block' | 'unfriend' | null>(null);

  const profileQ = useQuery({
    queryKey: ['user-profile', id, isAuthenticated],
    queryFn: () => fetchUserProfile(id),
    enabled: !!id,
  });
  const worksQ = useQuery({
    queryKey: ['user-works', id, isAuthenticated],
    queryFn: () => fetchUserWorks(id),
    enabled: !!id,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['user-profile', id] });
    qc.invalidateQueries({ queryKey: ['user-works', id] });
    // 首页关注/好友圈、私信会话列表、互动消息里的关注态都从 user_contact 派生,一起刷新
    qc.invalidateQueries({ queryKey: ['home'] });
    qc.invalidateQueries({ queryKey: ['dm-sessions-page'] });
    qc.invalidateQueries({ queryKey: ['notice-interaction'] });
    qc.invalidateQueries({ queryKey: ['notice-interaction-page'] });
  };

  const requireLogin = () => {
    setToast('登录后才能操作');
    router.push('/user/login');
  };

  const act = useMutation({
    mutationFn: async (kind: 'follow' | 'unfollow' | 'friend' | 'unfriend' | 'block' | 'unblock') => {
      if (kind === 'follow') await followUser(id);
      else if (kind === 'unfollow') await unfollowUser(id);
      else if (kind === 'friend') await addFriend(id);
      else if (kind === 'unfriend') await removeFriend(id);
      else if (kind === 'block') await blockUser(id);
      else await unblockUser(id);
      return kind;
    },
    onSuccess: (kind) => {
      const msg: Record<typeof kind, string> = {
        follow: '已关注',
        unfollow: '已取消关注',
        friend: '好友申请已发送',
        unfriend: '已解除好友关系',
        block: '已拉黑,对方无法再关注、加好友或私信你',
        unblock: '已取消拉黑',
      };
      setToast(msg[kind]);
      setConfirm(null);
      refresh();
    },
    onError: (e) => setToast(formatApiError(e) || '操作失败,请稍后再试'),
  });

  const dm = useMutation({
    mutationFn: () => openDmSession(id),
    onSuccess: (s) => router.push(`/account/msg?tab=dm&session=${s.id}`),
    onError: (e) => setToast(formatApiError(e) || '暂时无法私信'),
  });

  const guard = (fn: () => void) => () => (isAuthenticated ? fn() : requireLogin());

  if (!id) {
    return <Empty text="缺少用户 id" />;
  }
  if (profileQ.isError) {
    return <Empty text={formatApiError(profileQ.error) || '用户不存在'} />;
  }

  const p = profileQ.data;
  const rel = p?.relation;

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'center', sm: 'flex-start' },
          gap: { xs: 2, sm: 3 },
          p: { xs: 2, md: 3 },
          borderRadius: 3,
          bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
          border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        }}
      >
        {p ? (
          <Avatar src={p.user.avatar || undefined} sx={{ width: 96, height: 96, fontSize: 36 }}>
            {p.user.nickname?.[0] ?? '?'}
          </Avatar>
        ) : (
          <Skeleton variant="circular" width={96} height={96} />
        )}
        <Box sx={{ flex: 1, minWidth: 0, textAlign: { xs: 'center', sm: 'left' }, width: '100%' }}>
          {p ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: { xs: 'center', sm: 'flex-start' }, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: 'text.primary' }}>{p.user.nickname}</Typography>
                {p.user.isBot && <BotBadge />}
                {p.user.isPrivate && (
                  <Tooltip title="私密账号,作品仅本人可见">
                    <LockOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  </Tooltip>
                )}
                {rel?.isFollowedBy && !rel.isMe && (
                  <Box sx={{ px: 0.75, py: 0.125, borderRadius: 0.75, bgcolor: 'action.hover', color: 'text.secondary', fontSize: 11 }}>
                    {rel.isFollowing ? '互相关注' : '关注了你'}
                  </Box>
                )}
              </Box>
              <Typography sx={{ fontSize: 12, color: 'text.disabled', mt: 0.25 }}>ID {p.user.id}</Typography>
              {p.user.bio && (
                <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1, whiteSpace: 'pre-wrap' }}>{p.user.bio}</Typography>
              )}
              <Box sx={{ display: 'flex', gap: 3, mt: 1.5, justifyContent: { xs: 'center', sm: 'flex-start' } }}>
                <Stat label="关注" value={p.stats.following} />
                <Stat label="粉丝" value={p.stats.followers} />
                <Stat label="获赞" value={p.stats.likes} />
                <Stat label="作品" value={p.stats.works} />
              </Box>
            </>
          ) : (
            <>
              <Skeleton width={160} height={32} />
              <Skeleton width={240} height={20} />
              <Skeleton width={280} height={24} sx={{ mt: 1 }} />
            </>
          )}
        </Box>

        {/* 关系按钮:关注/已关注(取关)、加好友/好友(解除)、私信、更多(拉黑) */}
        {p && rel && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'center' }}>
            {rel.isMe ? (
              <Button variant="outlined" size="small" onClick={() => router.push('/home?tab=me')} sx={{ borderRadius: 999, textTransform: 'none' }}>
                我的主页
              </Button>
            ) : rel.isBlocked ? (
              <Button
                variant="outlined"
                size="small"
                color="inherit"
                disabled={act.isPending}
                onClick={() => act.mutate('unblock')}
                sx={{ borderRadius: 999, textTransform: 'none' }}
              >
                已拉黑 · 取消
              </Button>
            ) : !isAuthenticated || rel.canInteract ? (
              <>
                {rel.isFollowing ? (
                  <Button
                    variant="outlined"
                    size="small"
                    color="inherit"
                    disabled={act.isPending}
                    onClick={guard(() => act.mutate('unfollow'))}
                    sx={{ borderRadius: 999, textTransform: 'none', minWidth: 88 }}
                  >
                    已关注
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    size="small"
                    disabled={act.isPending}
                    onClick={guard(() => act.mutate('follow'))}
                    sx={{ borderRadius: 999, textTransform: 'none', minWidth: 88, bgcolor: 'var(--brand-color, #FE2C55)' }}
                  >
                    {rel.isFollowedBy ? '回关' : '关注'}
                  </Button>
                )}
                {rel.isFriend ? (
                  <Button variant="outlined" size="small" color="inherit" onClick={() => setConfirm('unfriend')} sx={{ borderRadius: 999, textTransform: 'none' }}>
                    好友
                  </Button>
                ) : rel.friendPending ? (
                  <Button variant="outlined" size="small" color="inherit" disabled sx={{ borderRadius: 999, textTransform: 'none' }}>
                    已申请
                  </Button>
                ) : rel.friendIncoming ? (
                  <Button variant="outlined" size="small" onClick={() => router.push('/home?tab=feed&circle=friend')} sx={{ borderRadius: 999, textTransform: 'none' }}>
                    TA 想加你好友
                  </Button>
                ) : (
                  <Button variant="outlined" size="small" disabled={act.isPending} onClick={guard(() => act.mutate('friend'))} sx={{ borderRadius: 999, textTransform: 'none' }}>
                    加好友
                  </Button>
                )}
                <Tooltip title="私信">
                  <IconButton size="small" disabled={dm.isPending} onClick={guard(() => dm.mutate())} sx={{ border: '1px solid', borderColor: 'divider' }}>
                    <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="更多">
                  <IconButton size="small" onClick={(e) => setMenuEl(e.currentTarget)} sx={{ border: '1px solid', borderColor: 'divider' }}>
                    <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
                  <MenuItem
                    onClick={() => { setMenuEl(null); guard(() => setConfirm('block'))(); }}
                    sx={{ fontSize: 13, color: 'error.main', minWidth: 140 }}
                  >
                    拉黑
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>暂时无法与该用户互动</Typography>
            )}
          </Box>
        )}
      </Box>

      {/* 作品 */}
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary', mt: 3, mb: 1.5 }}>
        作品{worksQ.data ? ` · ${worksQ.data.total}` : ''}
      </Typography>
      {worksQ.isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" height={140} />)}
        </Box>
      ) : !worksQ.data || worksQ.data.list.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: 'text.disabled', py: 4, textAlign: 'center' }}>
          {worksQ.isError ? '作品加载失败,请稍后再试' : p?.user.isPrivate && !rel?.isMe ? '私密账号,作品仅本人可见' : '还没有发布作品'}
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
          {worksQ.data.list.map((w) => (
            <Box
              key={String(w.id)}
              role="button"
              tabIndex={0}
              onClick={() => navigate(w.contentType, w.id)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(w.contentType, w.id)}
              sx={{
                cursor: 'pointer',
                borderRadius: 2,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                transition: 'border-color 0.15s',
                '&:hover': { borderColor: 'primary.main' },
              }}
            >
              <Box sx={{ position: 'relative', aspectRatio: '16 / 9', bgcolor: 'action.hover' }}>
                <CoverImage src={w.cover || ''} alt={w.title} sx={{ width: '100%', height: '100%' }} />
                <Box sx={{ position: 'absolute', bottom: 6, right: 6, px: 0.75, py: 0.25, borderRadius: 0.75, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 600 }}>
                  {TYPE_LABEL[w.contentType] || w.contentType}
                </Box>
              </Box>
              <Typography sx={{ fontSize: 13, color: 'text.primary', p: 1 }} noWrap>{w.title}</Typography>
            </Box>
          ))}
        </Box>
      )}

      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 600 }}>{confirm === 'block' ? '拉黑该用户' : '解除好友关系'}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            {confirm === 'block'
              ? `拉黑后会解除你和 ${p?.user.nickname ?? '对方'} 之间的关注和好友关系,对方将无法关注你、加你好友或给你发私信。可在主页随时取消。`
              : `确认要将 ${p?.user.nickname ?? '对方'} 从好友列表中移除吗?对方不会收到通知。`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setConfirm(null)} sx={{ textTransform: 'none' }}>取消</Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            disabled={act.isPending}
            onClick={() => act.mutate(confirm === 'block' ? 'block' : 'unfriend')}
            sx={{ textTransform: 'none' }}
          >
            {confirm === 'block' ? '确认拉黑' : '确认解除'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={2400} onClose={() => setToast(null)} message={toast} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>{compact(value || 0)}</Typography>
      <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{label}</Typography>
    </Box>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Box sx={{ py: 10, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{text}</Typography>
    </Box>
  );
}
