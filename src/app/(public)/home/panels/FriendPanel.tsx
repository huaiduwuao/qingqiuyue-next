'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded';
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import { homeClient } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';

type FriendRequest = {
  id: number;
  fromId: number;
  fromName: string;
  fromAvatar: string;
  message: string;
  time: string;
};

type SentRequest = {
  id: number;
  toId: number;
  toName: string;
  toAvatar: string;
  message: string;
  time: string;
};

type Friend = {
  id: number;
  name: string;
  avatar: string;
  douyinId: string;
  bio?: string;
  followers: number;
  verified?: boolean;
  region?: string;
};

type Suggestion = Friend;

type Stats = {
  friendCount: number;
  incomingCount: number;
  sentCount: number;
};

type TabKey = 'incoming' | 'suggestions' | 'friends' | 'sent';

const FRIEND_BLUE = '#5B8DEF';

export function FriendPanel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('incoming');
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'success',
  });
  const notify = (message: string, severity: 'success' | 'error' | 'info' = 'success') =>
    setSnack({ open: true, message, severity });

  const incomingQ = useQuery({
    queryKey: ['home', 'friend', 'requests'],
    queryFn: () => homeClient.get<{ list: FriendRequest[]; total: number }>('/friend/requests').then((r) => r.data),
  });
  const sentQ = useQuery({
    queryKey: ['home', 'friend', 'requests', 'sent'],
    queryFn: () => homeClient.get<{ list: SentRequest[]; total: number }>('/friend/requests/sent').then((r) => r.data),
  });
  const friendsQ = useQuery({
    queryKey: ['home', 'friend', 'list'],
    queryFn: () => homeClient.get<{ list: Friend[]; total: number }>('/friend/list').then((r) => r.data),
  });
  const suggestionsQ = useQuery({
    queryKey: ['home', 'suggestions', 'friend'],
    queryFn: () => homeClient.get<{ list: Suggestion[] }>('/suggestions?type=friend&limit=24').then((r) => r.data),
  });
  const statsQ = useQuery({
    queryKey: ['home', 'friend', 'stats'],
    queryFn: () => homeClient.get<Stats>('/friend/stats').then((r) => r.data),
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['home', 'friend'] });
    qc.invalidateQueries({ queryKey: ['home', 'suggestions'] });
    qc.invalidateQueries({ queryKey: ['home', 'feed'] });
  };

  const acceptOne = async (req: FriendRequest) => {
    try {
      await homeClient.post(`/friend/requests/${req.id}/accept`);
      notify(`已和 ${req.fromName} 成为好友`);
      refreshAll();
    } catch {
      notify('操作失败,请稍后再试', 'error');
    }
  };
  const rejectOne = async (req: FriendRequest) => {
    try {
      await homeClient.post(`/friend/requests/${req.id}/reject`);
      notify(`已忽略 ${req.fromName} 的申请`);
      refreshAll();
    } catch {
      notify('操作失败,请稍后再试', 'error');
    }
  };
  const acceptAll = async () => {
    const list = incomingQ.data?.list ?? [];
    if (list.length === 0) return;
    try {
      await Promise.all(list.map((r) => homeClient.post(`/friend/requests/${r.id}/accept`)));
      notify(`已全部接受 (${list.length} 人)`);
      refreshAll();
    } catch {
      notify('部分操作失败', 'error');
      refreshAll();
    }
  };

  const cancelSent = async (req: SentRequest) => {
    try {
      await homeClient.post(`/friend/requests/sent/${req.id}/cancel`);
      notify(`已撤回给 ${req.toName} 的申请`);
      refreshAll();
    } catch {
      notify('操作失败,请稍后再试', 'error');
    }
  };

  const addFriend = async (u: { id: number; name: string }) => {
    try {
      await homeClient.post(`/friend/${u.id}`);
      notify(`好友申请已发送给 ${u.name}`);
      refreshAll();
    } catch {
      notify('发送失败,请稍后再试', 'error');
    }
  };

  const [removeTarget, setRemoveTarget] = useState<Friend | null>(null);
  const removeFriend = async (u: Friend) => {
    try {
      await homeClient.delete(`/friend/${u.id}`);
      notify(`已解除和 ${u.name} 的好友关系`);
      setRemoveTarget(null);
      refreshAll();
    } catch {
      notify('操作失败,请稍后再试', 'error');
    }
  };

  const tabs: { key: TabKey; label: string; count?: number; icon: React.ReactNode }[] = [
    { key: 'incoming', label: '申请', count: statsQ.data?.incomingCount, icon: <GroupAddRoundedIcon sx={{ fontSize: 14 }} /> },
    { key: 'suggestions', label: '推荐', icon: <PersonAddAlt1RoundedIcon sx={{ fontSize: 14 }} /> },
    { key: 'friends', label: '我的好友', count: statsQ.data?.friendCount, icon: <GroupRoundedIcon sx={{ fontSize: 14 }} /> },
    { key: 'sent', label: '已发出', count: statsQ.data?.sentCount, icon: <SendRoundedIcon sx={{ fontSize: 14 }} /> },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Hero stats */}
          <StatsRow stats={statsQ.data} />

          {/* Tabs */}
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 5,
              bgcolor: 'var(--bg-topbar, rgba(10, 10, 15, 0.85))',
              backdropFilter: 'blur(12px)',
              borderRadius: 2,
              border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            }}
          >
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{
                minHeight: 48,
                px: 1,
                '& .MuiTab-root': {
                  minHeight: 48,
                  minWidth: 0,
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-secondary, rgba(255,255,255,0.6))',
                  textTransform: 'none',
                  px: 2,
                  '&:hover': { color: 'var(--text-primary, #ffffff)' },
                },
                '& .Mui-selected': { color: `${FRIEND_BLUE} !important`, fontWeight: 700 },
                '& .MuiTabs-indicator': { backgroundColor: FRIEND_BLUE, height: 2.5, borderRadius: 1.25 },
                '& .MuiTabs-scrollButtons': { color: 'var(--text-secondary, rgba(255,255,255,0.55))' },
              }}
            >
              {tabs.map((t) => (
                <Tab
                  key={t.key}
                  value={t.key}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      {t.icon}
                      {t.label}
                      {t.count !== undefined && t.count > 0 && (
                        <Chip
                          label={t.count}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: 10,
                            fontWeight: 700,
                            bgcolor: 'rgba(91, 141, 239, 0.2)',
                            color: FRIEND_BLUE,
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                      )}
                    </Box>
                  }
                />
              ))}
            </Tabs>
          </Box>

          {/* Tab content */}
          {tab === 'incoming' && (
            <IncomingTab
              query={incomingQ}
              onAccept={acceptOne}
              onReject={rejectOne}
              onAcceptAll={acceptAll}
            />
          )}
          {tab === 'suggestions' && (
            <SuggestionsTab
              query={suggestionsQ}
              onAdd={addFriend}
              sentIds={new Set((sentQ.data?.list ?? []).map((r) => r.toId))}
              friendIds={new Set((friendsQ.data?.list ?? []).map((f) => f.id))}
            />
          )}
          {tab === 'friends' && (
            <FriendsTab
              query={friendsQ}
              onRemove={(f) => setRemoveTarget(f)}
            />
          )}
          {tab === 'sent' && (
            <SentTab
              query={sentQ}
              onCancel={cancelSent}
            />
          )}
        </Box>
      </Box>

      <Dialog open={!!removeTarget} onClose={() => setRemoveTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 600 }}>解除好友关系</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'var(--text-secondary, rgba(255,255,255,0.7))' }}>
            确认要将 <b style={{ color: 'var(--text-primary, #fff)' }}>{removeTarget?.name}</b> 从你的好友列表中移除吗?对方不会收到通知。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRemoveTarget(null)} size="small" sx={{ textTransform: 'none' }}>取消</Button>
          <Button
            variant="contained"
            color="error"
            size="small"
            onClick={() => removeTarget && removeFriend(removeTarget)}
            sx={{ textTransform: 'none' }}
          >
            确认解除
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ─── Stats row ───
function StatsRow({ stats }: { stats?: Stats }) {
  const items: { label: string; value: number; color: string; icon: React.ReactNode }[] = [
    { label: '我的好友', value: stats?.friendCount ?? 0, color: FRIEND_BLUE, icon: <GroupRoundedIcon sx={{ fontSize: 18 }} /> },
    { label: '收到的申请', value: stats?.incomingCount ?? 0, color: 'var(--brand-color, #FE2C55)', icon: <GroupAddRoundedIcon sx={{ fontSize: 18 }} /> },
    { label: '已发出', value: stats?.sentCount ?? 0, color: '#FFB400', icon: <HourglassTopRoundedIcon sx={{ fontSize: 18 }} /> },
  ];
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(3, 220px)' },
        gap: 1.5,
        justifyContent: 'flex-start',
      }}
    >
      {items.map((s) => (
        <Box
          key={s.label}
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
            border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: `${s.color}1A`,
              color: s.color,
              flexShrink: 0,
            }}
          >
            {s.icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary, #fff)', lineHeight: 1.1 }}>
              {s.value}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))', mt: 0.25 }}>
              {s.label}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// ─── 申请 (incoming) ───
function IncomingTab({
  query,
  onAccept,
  onReject,
  onAcceptAll,
}: {
  query: ReturnType<typeof useQuery<{ list: FriendRequest[]; total: number }>>;
  onAccept: (r: FriendRequest) => void;
  onReject: (r: FriendRequest) => void;
  onAcceptAll: () => void;
}) {
  return (
    <AsyncState query={query} skeletonCount={3} skeletonHeight={88}>
      {(data) =>
        data.list.length === 0 ? (
          <EmptyTab
            icon={<CheckCircleRoundedIcon sx={{ fontSize: 36, color: 'var(--text-muted, rgba(255,255,255,0.3))' }} />}
            title="暂无待处理的申请"
            hint="收到的好友申请会出现在这里"
          />
        ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {data.list.length > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CheckRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={onAcceptAll}
                sx={{
                  textTransform: 'none',
                  fontSize: 12,
                  borderColor: 'rgba(91, 141, 239, 0.4)',
                  color: FRIEND_BLUE,
                  '&:hover': { borderColor: FRIEND_BLUE, bgcolor: 'rgba(91, 141, 239, 0.08)' },
                }}
              >
                全部接受 ({data.list.length})
              </Button>
            </Box>
          )}
          {data.list.map((req) => (
            <RequestRow key={req.id} req={req} onAccept={() => onAccept(req)} onReject={() => onReject(req)} />
          ))}
        </Box>
        )
      }
    </AsyncState>
  );
}

function RequestRow({
  req,
  onAccept,
  onReject,
}: {
  req: FriendRequest;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        transition: 'border-color 0.2s',
        '&:hover': { borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' },
      }}
    >
      <Avatar src={req.fromAvatar} sx={{ width: 48, height: 48, fontSize: 16, flexShrink: 0 }}>
        {req.fromName[0]}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
            {req.fromName}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: 12,
            color: 'var(--text-secondary, rgba(255,255,255,0.7))',
            mt: 0.25,
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {req.message}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))', mt: 0.5 }}>
          {req.time}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <Tooltip title="忽略">
          <IconButton
            size="small"
            onClick={onReject}
            sx={{
              color: 'var(--text-secondary, rgba(255,255,255,0.55))',
              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
              borderRadius: 1.5,
              '&:hover': { color: 'var(--text-primary, #fff)', borderColor: 'var(--border-strong, rgba(255,255,255,0.2))' },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Button
          size="small"
          variant="contained"
          onClick={onAccept}
          startIcon={<CheckRoundedIcon sx={{ fontSize: 14 }} />}
          sx={{
            textTransform: 'none',
            fontSize: 12,
            fontWeight: 600,
            bgcolor: FRIEND_BLUE,
            '&:hover': { bgcolor: '#4A7AD8' },
          }}
        >
          同意
        </Button>
      </Box>
    </Box>
  );
}

// ─── 推荐 (suggestions) ───
function SuggestionsTab({
  query,
  onAdd,
  sentIds,
  friendIds,
}: {
  query: ReturnType<typeof useQuery<{ list: Suggestion[] }>>;
  onAdd: (u: { id: number; name: string }) => void;
  sentIds: Set<number>;
  friendIds: Set<number>;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const list = query.data?.list ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((u) => u.name.toLowerCase().includes(q) || u.douyinId.toLowerCase().includes(q));
  }, [query.data, search]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField
        size="small"
        placeholder="搜索用户名 / 抖音号"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 16, color: 'var(--text-muted, rgba(255,255,255,0.4))' }} />
              </InputAdornment>
            ),
          },
        }}
        sx={{
          '& .MuiInputBase-root': { fontSize: 13, bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))' },
        }}
      />

      <AsyncState query={query} skeletonCount={6} skeletonHeight={88}>
        {(data) => {
          if (data.list.length === 0) {
            return (
              <EmptyTab
                icon={<GroupsRoundedIcon sx={{ fontSize: 36, color: 'var(--text-muted, rgba(255,255,255,0.3))' }} />}
                title="暂无可推荐的人"
                hint="后续会基于你的兴趣推荐更多创作者"
              />
            );
          }
          if (filtered.length === 0) {
            return (
              <EmptyTab
                icon={<SearchRoundedIcon sx={{ fontSize: 32, color: 'var(--text-muted, rgba(255,255,255,0.3))' }} />}
                title="没有匹配的结果"
                hint="试试其他关键词"
              />
            );
          }
          return (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
              {filtered.map((u) => (
                <SuggestionCard
                  key={u.id}
                  user={u}
                  isSent={sentIds.has(u.id)}
                  isFriend={friendIds.has(u.id)}
                  onAdd={() => onAdd(u)}
                />
              ))}
            </Box>
          );
        }}
      </AsyncState>
    </Box>
  );
}

function SuggestionCard({
  user,
  isSent,
  isFriend,
  onAdd,
}: {
  user: Suggestion;
  isSent: boolean;
  isFriend: boolean;
  onAdd: () => void;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        transition: 'border-color 0.2s',
        '&:hover': { borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' },
      }}
    >
      <Avatar src={user.avatar} sx={{ width: 44, height: 44, fontSize: 15, flexShrink: 0 }}>
        {user.name[0]}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary, #fff)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user.name}
          </Typography>
          {user.verified && (
            <Tooltip title="认证创作者">
              <VerifiedRoundedIcon sx={{ fontSize: 12, color: 'var(--brand-color, #FE2C55)' }} />
            </Tooltip>
          )}
        </Box>
        <Typography
          sx={{
            fontSize: 10,
            color: 'var(--text-muted, rgba(255,255,255,0.5))',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {user.douyinId} · {user.followers >= 10000 ? `${(user.followers / 10000).toFixed(1)}w` : user.followers} 粉丝
        </Typography>
      </Box>
      {isFriend ? (
        <Chip
          icon={<CheckRoundedIcon sx={{ fontSize: '12px !important', color: `${FRIEND_BLUE} !important` }} />}
          label="已是好友"
          size="small"
          sx={{
            bgcolor: 'rgba(91, 141, 239, 0.15)',
            color: FRIEND_BLUE,
            fontSize: 10,
            fontWeight: 600,
            height: 24,
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      ) : isSent ? (
        <Chip
          icon={<HourglassTopRoundedIcon sx={{ fontSize: '12px !important' }} />}
          label="已发送"
          size="small"
          sx={{
            bgcolor: 'rgba(255,255,255,0.06)',
            color: 'var(--text-secondary, rgba(255,255,255,0.6))',
            fontSize: 10,
            fontWeight: 500,
            height: 24,
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      ) : (
        <Button
          size="small"
          variant="contained"
          onClick={onAdd}
          startIcon={<PersonAddAlt1RoundedIcon sx={{ fontSize: 14 }} />}
          sx={{
            minWidth: 0,
            px: 1.25,
            py: 0.4,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'none',
            bgcolor: FRIEND_BLUE,
            '&:hover': { bgcolor: '#4A7AD8' },
          }}
        >
          加好友
        </Button>
      )}
    </Box>
  );
}

// ─── 我的好友 (friends) ───
function FriendsTab({
  query,
  onRemove,
}: {
  query: ReturnType<typeof useQuery<{ list: Friend[]; total: number }>>;
  onRemove: (f: Friend) => void;
}) {
  return (
    <AsyncState query={query} skeletonCount={6} skeletonHeight={96}>
      {(data) =>
        data.list.length === 0 ? (
          <EmptyTab
            icon={<GroupRoundedIcon sx={{ fontSize: 36, color: 'var(--text-muted, rgba(255,255,255,0.3))' }} />}
            title="还没有好友"
            hint="去「推荐」里加几个朋友,开启聊天吧"
          />
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
            {data.list.map((f) => (
              <FriendCard key={f.id} friend={f} onRemove={() => onRemove(f)} />
            ))}
          </Box>
        )
      }
    </AsyncState>
  );
}

function FriendCard({ friend, onRemove }: { friend: Friend; onRemove: () => void }) {
  const router = useRouter();
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        transition: 'border-color 0.2s',
        '&:hover': { borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' },
      }}
    >
      <Avatar src={friend.avatar} sx={{ width: 48, height: 48, fontSize: 16, flexShrink: 0 }}>
        {friend.name[0]}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary, #fff)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {friend.name}
          </Typography>
          {friend.verified && (
            <Tooltip title="认证创作者">
              <VerifiedRoundedIcon sx={{ fontSize: 12, color: 'var(--brand-color, #FE2C55)' }} />
            </Tooltip>
          )}
        </Box>
        {friend.bio && (
          <Typography
            sx={{
              fontSize: 11,
              color: 'var(--text-secondary, rgba(255,255,255,0.65))',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              mt: 0.25,
            }}
          >
            {friend.bio}
          </Typography>
        )}
        <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))', mt: 0.5 }}>
          {friend.douyinId} · {friend.region || '未知地区'}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
        <Tooltip title="发消息">
          <IconButton
            size="small"
            onClick={() => router.push('/account/msg')}
            sx={{
              color: 'var(--text-secondary, rgba(255,255,255,0.65))',
              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
              borderRadius: 1.5,
              '&:hover': { color: FRIEND_BLUE, borderColor: 'rgba(91, 141, 239, 0.4)' },
            }}
          >
            <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="解除好友">
          <IconButton
            size="small"
            onClick={onRemove}
            sx={{
              color: 'var(--text-secondary, rgba(255,255,255,0.55))',
              border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
              borderRadius: 1.5,
              '&:hover': { color: 'error.main', borderColor: 'rgba(255, 80, 80, 0.4)' },
            }}
          >
            <PersonRemoveRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

// ─── 已发出 (sent) ───
function SentTab({
  query,
  onCancel,
}: {
  query: ReturnType<typeof useQuery<{ list: SentRequest[]; total: number }>>;
  onCancel: (r: SentRequest) => void;
}) {
  return (
    <AsyncState query={query} skeletonCount={2} skeletonHeight={88}>
      {(data) =>
        data.list.length === 0 ? (
          <EmptyTab
            icon={<SendRoundedIcon sx={{ fontSize: 36, color: 'var(--text-muted, rgba(255,255,255,0.3))' }} />}
            title="没有已发出的申请"
            hint="去「推荐」里找你想加的人吧"
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {data.list.map((req) => (
              <SentRow key={req.id} req={req} onCancel={() => onCancel(req)} />
            ))}
          </Box>
        )
      }
    </AsyncState>
  );
}

function SentRow({ req, onCancel }: { req: SentRequest; onCancel: () => void }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Avatar src={req.toAvatar} sx={{ width: 48, height: 48, fontSize: 16, flexShrink: 0 }}>
        {req.toName[0]}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
            {req.toName}
          </Typography>
          <Chip
            icon={<HourglassTopRoundedIcon sx={{ fontSize: '12px !important' }} />}
            label="等待通过"
            size="small"
            sx={{
              height: 18,
              fontSize: 10,
              fontWeight: 500,
              bgcolor: 'rgba(255, 180, 0, 0.15)',
              color: '#FFB400',
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Box>
        <Typography sx={{ fontSize: 12, color: 'var(--text-secondary, rgba(255,255,255,0.7))', mt: 0.25 }}>
          {req.message}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))', mt: 0.5 }}>
          {req.time}
        </Typography>
      </Box>
      <Button
        size="small"
        variant="outlined"
        onClick={onCancel}
        sx={{
          textTransform: 'none',
          fontSize: 12,
          borderColor: 'var(--border-strong, rgba(255,255,255,0.16))',
          color: 'var(--text-secondary, rgba(255,255,255,0.7))',
          '&:hover': { borderColor: 'error.main', color: 'error.main' },
        }}
      >
        撤回
      </Button>
    </Box>
  );
}

// ─── Empty state ───
function EmptyTab({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <Box
      sx={{
        py: 8,
        textAlign: 'center',
        borderRadius: 2,
        bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.3))',
        border: '1px dashed var(--border-color, rgba(255,255,255,0.1))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {icon}
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, rgba(255,255,255,0.7))' }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>{hint}</Typography>
    </Box>
  );
}
