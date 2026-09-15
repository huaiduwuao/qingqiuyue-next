'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import { homeClient, formatApiError } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';
import { FriendPanel } from './FriendPanel';

// 「动态」页签里「关注」「朋友」范围的周边:右侧推荐的人、我的关注列表、好友统计与管理入口。

export type Circle = 'follow' | 'friend';
type Severity = 'success' | 'error';

const FRIEND_BLUE = '#5B8DEF';

// 关注/加好友/取关之后,动态流和推荐都要跟着变
function useRefreshCircle() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['community', 'feed'] });
    qc.invalidateQueries({ queryKey: ['home', 'suggestions'] });
    qc.invalidateQueries({ queryKey: ['home', 'follow'] });
    qc.invalidateQueries({ queryKey: ['home', 'friend'] });
  };
}

function useSnack() {
  const [snack, setSnack] = useState<{ msg: string; severity: Severity } | null>(null);
  const node = (
    <Snackbar open={!!snack} autoHideDuration={2500} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
      <Alert severity={snack?.severity ?? 'success'} variant="filled" sx={{ width: '100%' }}>{snack?.msg}</Alert>
    </Snackbar>
  );
  return { notify: (msg: string, severity: Severity = 'success') => setSnack({ msg, severity }), node };
}

// ─── 右侧:推荐关注 / 你可能认识的人 ───

type SuggestUser = {
  id: number;
  name: string;
  avatar: string;
  douyinId: string;
  bio?: string;
  followers: number;
  verified?: boolean;
  region?: string;
};

export function CircleSuggestions({ circle }: { circle: Circle }) {
  const title = circle === 'friend' ? '你可能认识的人' : '推荐关注';
  const hint = circle === 'friend' ? '基于共同好友推荐' : '基于你的兴趣推荐';
  const { notify, node } = useSnack();
  const { data, isLoading } = useQuery({
    queryKey: ['home', 'suggestions', circle],
    queryFn: () => homeClient.get<{ list: SuggestUser[] }>(`/suggestions?type=${circle}&limit=8`).then((r) => r.data),
  });
  const list: (SuggestUser | undefined)[] = isLoading ? Array.from({ length: 4 }, () => undefined) : data?.list ?? [];

  return (
    <Box sx={sideCardSx}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>{title}</Typography>
      <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))', mt: 0.25, mb: 1.5 }}>{hint}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {list.length === 0 ? (
          <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>暂无推荐</Typography>
        ) : (
          list.map((u, i) => <SuggestUserRow key={u?.id ?? i} user={u} circle={circle} notify={notify} />)
        )}
      </Box>
      {node}
    </Box>
  );
}

function SuggestUserRow({ user, circle, notify }: { user?: SuggestUser; circle: Circle; notify: (m: string, s?: Severity) => void }) {
  const refresh = useRefreshCircle();
  const [busy, setBusy] = useState(false);
  const isFriend = circle === 'friend';

  const act = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await homeClient.post(isFriend ? `/friend/${user.id}` : `/follow/${user.id}`);
      notify(isFriend ? `好友申请已发送给 ${user.name}` : `已关注 ${user.name}`);
      refresh();
    } catch (err) {
      notify(formatApiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return <Box sx={{ height: 44, borderRadius: 1.5, bgcolor: 'var(--bg-input, rgba(255,255,255,0.04))' }} />;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Avatar src={user.avatar || undefined} sx={{ width: 36, height: 36, fontSize: 13, flexShrink: 0 }}>
        {user.name?.[0] ?? '?'}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.name}
          </Typography>
          {user.verified && (
            <Tooltip title="认证创作者">
              <CheckCircleRoundedIcon sx={{ fontSize: 12, color: 'primary.main' }} />
            </Tooltip>
          )}
        </Box>
        <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>
          {compactFollowers(user.followers)} 粉丝
        </Typography>
      </Box>
      <Button
        size="small"
        variant="contained"
        onClick={act}
        disabled={busy}
        startIcon={isFriend ? <PersonAddAlt1Icon sx={{ fontSize: 12 }} /> : <AddIcon sx={{ fontSize: 12 }} />}
        sx={{
          minWidth: 0,
          px: 1.25,
          py: 0.4,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'none',
          flexShrink: 0,
          bgcolor: isFriend ? FRIEND_BLUE : 'var(--brand-color, #FE2C55)',
          '&:hover': { bgcolor: isFriend ? '#4A7AD9' : '#E0274A' },
        }}
      >
        {isFriend ? '加好友' : '关注'}
      </Button>
    </Box>
  );
}

// ─── 「关注」范围头部右侧:我的关注(列表 + 取关) ───

type FollowedUser = {
  id: number;
  name: string;
  avatar: string;
  douyinId: string;
  bio?: string;
  followers: number;
  following: number;
  posts: number;
  isFriend: boolean;
};

export function FollowBar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<FavoriteRoundedIcon sx={{ fontSize: 14 }} />}
        onClick={() => setOpen(true)}
        sx={outlinedSx('var(--brand-color, #FE2C55)', 'rgba(254, 44, 85, 0.4)')}
      >
        我的关注
      </Button>
      <CircleDialog open={open} onClose={() => setOpen(false)} title="我的关注" icon={<FavoriteRoundedIcon sx={{ fontSize: 18, color: 'var(--brand-color, #FE2C55)', mr: 1 }} />}>
        <FollowList />
      </CircleDialog>
    </>
  );
}

function FollowList() {
  const refresh = useRefreshCircle();
  const { notify, node } = useSnack();
  const query = useQuery({
    queryKey: ['home', 'follow', 'list'],
    queryFn: () => homeClient.get<{ list: FollowedUser[]; total: number }>('/follow/list').then((r) => r.data),
  });

  const unfollow = async (user: FollowedUser) => {
    try {
      await homeClient.delete(`/follow/${user.id}`);
      refresh();
      notify(`已取消关注 ${user.name}`);
    } catch {
      notify('取关失败,请重试', 'error');
    }
  };

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <AsyncState query={query} skeletonCount={4} skeletonHeight={72} isEmpty={(d) => d.list.length === 0} emptyText="还没有关注任何人">
        {(data) => (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.5))', mb: 0.5 }}>
              共 {data.total} 位关注
            </Typography>
            {data.list.map((u) => (
              <FollowedRow key={u.id} user={u} onUnfollow={unfollow} />
            ))}
          </Box>
        )}
      </AsyncState>
      {node}
    </Box>
  );
}

function FollowedRow({ user, onUnfollow }: { user: FollowedUser; onUnfollow: (u: FollowedUser) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      await onUnfollow(user);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
          border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
          transition: 'border-color 0.2s',
          '&:hover': { borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' },
        }}
      >
        <Avatar src={user.avatar || undefined} sx={{ width: 48, height: 48, fontSize: 18 }}>
          {user.name?.[0] ?? '?'}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
              {user.name}
            </Typography>
            {user.isFriend && (
              <Tooltip title="互为朋友">
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.05, borderRadius: 0.5, bgcolor: 'rgba(91, 141, 239, 0.15)', color: FRIEND_BLUE, fontSize: 9, fontWeight: 600 }}>
                  <CheckCircleRoundedIcon sx={{ fontSize: 9 }} />
                  朋友
                </Box>
              </Tooltip>
            )}
          </Box>
          <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.bio || `抖音号: ${user.douyinId}`}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'var(--text-disabled, rgba(255,255,255,0.35))', mt: 0.25 }}>
            {compactFollowers(user.followers)} 粉丝 · {user.posts} 作品
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setConfirming(true)}
          disabled={busy}
          sx={{
            minWidth: 0,
            px: 1.5,
            py: 0.5,
            fontSize: 12,
            fontWeight: 500,
            textTransform: 'none',
            color: 'var(--text-secondary, rgba(255,255,255,0.7))',
            borderColor: 'var(--border-strong, rgba(255,255,255,0.16))',
            '&:hover': { borderColor: 'var(--brand-color, #FE2C55)', color: 'var(--brand-color, #FE2C55)', bgcolor: 'rgba(254, 44, 85, 0.06)' },
          }}
        >
          已关注
        </Button>
      </Box>

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="xs" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #fff)', mb: 1 }}>
            确认取消关注?
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>
            取消后将不再看到 <b style={{ color: 'var(--text-primary, #fff)' }}>{user.name}</b> 的动态更新。
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, p: 2, pt: 0, justifyContent: 'flex-end' }}>
          <Button onClick={() => setConfirming(false)} sx={{ color: 'var(--text-secondary, rgba(255,255,255,0.7))', textTransform: 'none' }}>
            再想想
          </Button>
          <Button
            onClick={handle}
            disabled={busy}
            variant="contained"
            sx={{ bgcolor: 'var(--brand-color, #FE2C55)', textTransform: 'none', '&:hover': { bgcolor: '#E0274A' } }}
          >
            确认取关
          </Button>
        </Box>
      </Dialog>
    </>
  );
}

// ─── 「朋友」范围头部右侧:好友统计 + 好友管理 ───

export function FriendBar() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['home', 'friend', 'stats'],
    queryFn: () => homeClient.get<{ friendCount: number; incomingCount: number; sentCount: number }>('/friend/stats').then((r) => r.data),
  });
  return (
    <>
      <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 2 }}>
        <FriendStat label="好友" value={data?.friendCount} />
        <FriendStat label="待处理" value={data?.incomingCount} accent={FRIEND_BLUE} />
      </Box>
      <Button
        size="small"
        variant="outlined"
        startIcon={<GroupsRoundedIcon sx={{ fontSize: 14 }} />}
        onClick={() => setOpen(true)}
        sx={outlinedSx(FRIEND_BLUE, 'rgba(91, 141, 239, 0.4)')}
      >
        好友管理
      </Button>
      <CircleDialog open={open} onClose={() => setOpen(false)} title="好友管理" icon={<GroupsRoundedIcon sx={{ fontSize: 18, color: FRIEND_BLUE, mr: 1 }} />}>
        <FriendPanel />
      </CircleDialog>
    </>
  );
}

function FriendStat({ label, value, accent }: { label: string; value: number | undefined; accent?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: accent || 'var(--text-primary, #ffffff)', fontVariantNumeric: 'tabular-nums' }}>
        {value ?? '—'}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>{label}</Typography>
    </Box>
  );
}

function CircleDialog({ open, onClose, title, icon, children }: { open: boolean; onClose: () => void; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'var(--bg-body, #F5F5F7)',
            backgroundImage: 'none',
            borderRadius: 3,
            height: 'min(820px, 90dvh)',
            overflow: 'hidden',
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))', flexShrink: 0 }}>
        {icon}
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #ffffff)', flex: 1 }}>{title}</Typography>
        <IconButton size="small" onClick={onClose} aria-label="关闭">
          <CloseRoundedIcon sx={{ fontSize: 18, color: 'var(--text-muted, rgba(255,255,255,0.5))' }} />
        </IconButton>
      </Box>
      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>{children}</DialogContent>
    </Dialog>
  );
}

function outlinedSx(color: string, border: string) {
  return {
    minWidth: 0,
    px: 1.5,
    py: 0.5,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'none',
    flexShrink: 0,
    color,
    borderColor: border,
    '&:hover': { borderColor: color, bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))' },
  } as const;
}

function compactFollowers(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}w` : String(n ?? 0);
}

export const sideCardSx = {
  p: 2,
  borderRadius: 2,
  bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
  border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
};
