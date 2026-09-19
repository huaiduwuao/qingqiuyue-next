'use client';

// 群组 / 团队 详情与聊天页 /group?id=...
//
// 用查询参数而不是 /group/[id] 动态段:站点是 output:'export' 静态导出,动态段必须有
// generateStaticParams() 把 id 全列出来,而群 id 是运行时才产生的,列不完(列不到的就 404)。
// 全站其它详情页(share/module-detail?moduleId=、playlist?id=)都是同样的原因用查询参数。
//
// - 左:消息列表(分页 before id 拉历史,新消息 WebSocket 推 realtime.EventGroup)
// - 右上:群名 + 在线人数 + 公开/私密标识 + 加入/退出/解散
// - 右下抽屉:成员列表 + (团队专属)分账面板

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import PublicTopBar from '@/components/layout/PublicTopBar';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import {
  getGroup,
  joinGroup,
  leaveGroup,
  listGroupMembers,
  listGroupMessages,
  sendGroupMessage,
  createGroupInvite,
  recallGroupMessage,
  dismissGroup,
  setGroupMemberRole,
  muteGroupMember,
  kickGroupMember,
  settleTeam,
  listTeamSettlements,
  type ChatGroup,
  type GroupMember,
  type GroupMessage,
  type GroupView,
  type TeamSettlement,
} from '@/apis/group';
import { coverBackground } from '@/lib/media';

function GroupDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gid = Number(searchParams.get('id') || 0);
  const { currentUser } = useAuth();
  const user = currentUser;
  const qc = useQueryClient();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const groupQ = useQuery({
    queryKey: ['group', gid],
    queryFn: () => getGroup(gid),
    enabled: gid > 0,
    refetchInterval: 15_000, // 兜底轮询:WebSocket 推不到时也能看到新消息
  });

  const messagesQ = useQuery({
    queryKey: ['group-messages', gid],
    queryFn: () => listGroupMessages(gid, { limit: 50 }),
    enabled: gid > 0 && !!groupQ.data?.isMember,
  });

  // 加入/退群
  const joinM = useMutation({
    mutationFn: () => joinGroup(gid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', gid] });
      setSnack('已加入');
    },
    onError: (e: any) => setSnack(e?.message || '加入失败'),
  });
  const leaveM = useMutation({
    mutationFn: () => leaveGroup(gid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['group', gid] });
      qc.invalidateQueries({ queryKey: ['group-messages', gid] });
      setSnack('已退出');
    },
    onError: (e: any) => setSnack(e?.message || '退群失败'),
  });
  const dismissM = useMutation({
    mutationFn: () => dismissGroup(gid),
    onSuccess: () => {
      setSnack('已解散');
      router.replace('/account/group');
    },
    onError: (e: any) => setSnack(e?.message || '解散失败'),
  });

  // 发消息
  const sendM = useMutation({
    mutationFn: (content: string) => sendGroupMessage(gid, { type: 'text', content }),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['group-messages', gid] });
      qc.invalidateQueries({ queryKey: ['group', gid] });
    },
    onError: (e: any) => setSnack(e?.message || '发送失败'),
  });

  const handleSend = () => {
    const t = draft.trim();
    if (!t) return;
    sendM.mutate(t);
  };

  const handleInvite = async () => {
    try {
      const inv = await createGroupInvite(gid, { maxUses: 50, ttlSec: 7 * 24 * 3600 });
      const link = `${window.location.origin}/group/invite?token=${inv.token}`;
      try {
        await navigator.clipboard.writeText(link);
        setSnack('邀请链接已复制,有效期 7 天,可用 50 次');
      } catch {
        setSnack(`链接: ${link}`);
      }
    } catch (e: any) {
      setSnack(e?.message || '邀请失败');
    }
  };

  if (groupQ.isLoading) {
    return (
      <Box>
        <PublicTopBar />
        <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress size={28} />
        </Container>
      </Box>
    );
  }
  if (groupQ.isError || !groupQ.data) {
    return (
      <Box>
        <PublicTopBar />
        <Container maxWidth="md" sx={{ py: 8 }}>
          <Alert severity="warning">群组不存在或已解散</Alert>
          <Button onClick={() => router.replace('/account/group')} sx={{ mt: 2, textTransform: 'none' }}>
            返回我的群组
          </Button>
        </Container>
      </Box>
    );
  }

  const g = groupQ.data as GroupView;
  const isMember = !!g.isMember;
  const isOwner = g.myRole === 'owner';
  const isAdmin = g.myRole === 'admin' || isOwner;

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <PublicTopBar />

      {/* Header */}
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 1.5,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <IconButton onClick={() => router.back()} size="small" aria-label="返回">
          <ArrowBackRoundedIcon />
        </IconButton>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 1.5,
            background: coverBackground(g.avatar, 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)'),
            flexShrink: 0,
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>
              {g.name}
            </Typography>
            {g.type === 'team' ? (
              <Chip size="small" color="secondary" label="团队" sx={{ height: 18, fontSize: 10 }} />
            ) : g.public ? (
              <PublicRoundedIcon sx={{ fontSize: 14, color: 'primary.main' }} />
            ) : (
              <LockOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            )}
          </Box>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {g.memberCount} 人 · 群主 {g.ownerName || `#${g.ownerUserId}`}
          </Typography>
        </Box>
        <Tooltip title="成员">
          <IconButton onClick={() => setDrawerOpen(true)} size="small">
            <GroupsRoundedIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Main: chat area */}
      <Container maxWidth="md" sx={{ flex: 1, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {!user ? (
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" onClick={() => router.push(loginHref(`/group/${gid}`))}>
                登录
              </Button>
            }
          >
            登录后可加入群组查看消息
          </Alert>
        ) : !isMember ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 2 }}>
              {g.public ? '这是一个公开群,可直接加入' : '这是一个私密群,需要邀请 token 才能加入'}
            </Typography>
            {g.public && (
              <Button
                variant="contained"
                onClick={() => joinM.mutate()}
                disabled={joinM.isPending}
                sx={{
                  textTransform: 'none',
                  background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                  '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
                }}
              >
                加入群组
              </Button>
            )}
          </Box>
        ) : (
          <>
            {/* 消息流 */}
            <Box
              sx={{
                flex: 1,
                minHeight: 320,
                maxHeight: '60vh',
                overflowY: 'auto',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                p: 2,
              }}
            >
              {messagesQ.isLoading ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={20} />
                </Box>
              ) : (messagesQ.data?.list ?? []).length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
                  <Typography sx={{ fontSize: 13 }}>还没有消息,说点什么吧</Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {(messagesQ.data!.list as GroupMessage[]).map((m) => (
                    <MessageRow
                      key={m.id}
                      m={m}
                      mine={m.fromUserId === user?.id}
                      isAdmin={isAdmin}
                      onRecall={() => {
                        recallGroupMessage(m.id).then(() => {
                          qc.invalidateQueries({ queryKey: ['group-messages', gid] });
                        });
                      }}
                    />
                  ))}
                </Stack>
              )}
            </Box>

            {/* 输入区 */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="说点什么..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={handleSend}
                          disabled={!draft.trim() || sendM.isPending}
                          color="primary"
                          size="small"
                          aria-label="发送"
                        >
                          <SendRoundedIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            {/* 操作条 */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<GroupAddRoundedIcon sx={{ fontSize: 14 }} />}
                onClick={handleInvite}
                sx={{ textTransform: 'none' }}
              >
                生成邀请链接
              </Button>
              {isOwner && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    if (confirm(`确定要解散「${g.name}」?所有消息将被删除,无法恢复`)) {
                      dismissM.mutate();
                    }
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  解散
                </Button>
              )}
              {!isOwner && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LogoutRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => {
                    if (confirm('确定要退出群组?')) leaveM.mutate();
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  退出
                </Button>
              )}
            </Box>
          </>
        )}
      </Container>

      {/* 成员 + (团队)分账抽屉 */}
      <GroupDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        group={g}
        myId={user?.id || 0}
        isAdmin={isAdmin}
        onAction={() => {
          qc.invalidateQueries({ queryKey: ['group', gid] });
          qc.invalidateQueries({ queryKey: ['group-members', gid] });
          qc.invalidateQueries({ queryKey: ['team-settlements', gid] });
        }}
      />

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

// ─── 消息行 ───
function MessageRow({
  m, mine, isAdmin, onRecall,
}: {
  m: GroupMessage;
  mine: boolean;
  isAdmin: boolean;
  onRecall: () => void;
}) {
  if (m.type === 'system') {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Chip size="small" label={m.content} sx={{ fontSize: 11, bgcolor: 'action.hover' }} />
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 1 }}>
      {!mine && <Avatar sx={{ width: 32, height: 32, fontSize: 12 }}>{m.fromUserId % 1000}</Avatar>}
      <Box
        sx={{
          maxWidth: '70%',
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor: mine ? 'primary.main' : 'action.hover',
          color: mine ? '#fff' : 'text.primary',
          fontSize: 13,
          wordBreak: 'break-word',
        }}
      >
        <Typography sx={{ fontSize: 11, color: mine ? 'rgba(255,255,255,0.7)' : 'text.secondary', mb: 0.25 }}>
          #{m.fromUserId}
        </Typography>
        <Typography sx={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
          {m.status === 'recalled' ? <em>(已撤回)</em> : m.content}
        </Typography>
        <Typography sx={{ fontSize: 10, color: mine ? 'rgba(255,255,255,0.6)' : 'text.disabled', mt: 0.5 }}>
          {m.time?.slice(11, 16) || ''}
          {(mine || isAdmin) && m.status === 'active' && (
            <Box component="span" onClick={onRecall} sx={{ ml: 1, cursor: 'pointer', textDecoration: 'underline' }}>
              撤回
            </Box>
          )}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── 成员 + 分账抽屉 ───
function GroupDrawer({
  open, onClose, group, myId, isAdmin, onAction,
}: {
  open: boolean;
  onClose: () => void;
  group: GroupView;
  myId: number;
  isAdmin: boolean;
  onAction: () => void;
}) {
  const [tab, setTab] = useState(0);
  const isTeam = group.type === 'team';

  const membersQ = useQuery({
    queryKey: ['group-members', group.id],
    queryFn: () => listGroupMembers(group.id),
    enabled: open && !!group.isMember,
  });

  const settlementsQ = useQuery({
    queryKey: ['team-settlements', group.id],
    queryFn: () => listTeamSettlements(group.id),
    enabled: open && isTeam,
  });

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 400 }, bgcolor: 'background.paper' } } }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>
          {group.name}
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
          {isTeam ? '团队管理' : '群成员'}
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label={`成员 ${group.memberCount}`} />
        {isTeam && <Tab label="分账" icon={<HandshakeRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" />}
      </Tabs>

      {/* 成员列表 */}
      {tab === 0 && (
        <List sx={{ flex: 1, overflowY: 'auto' }}>
          {(membersQ.data?.list ?? []).map((m) => (
            <MemberRow
              key={m.id}
              m={m as GroupMember}
              myId={myId}
              isAdmin={isAdmin}
              isTeam={isTeam}
              onAction={onAction}
            />
          ))}
        </List>
      )}

      {/* 分账面板 */}
      {tab === 1 && isTeam && (
        <SettlementPanel
          teamId={group.id}
          isOwner={group.myRole === 'owner'}
          settlements={(settlementsQ.data?.list ?? []) as TeamSettlement[]}
          onChanged={onAction}
        />
      )}
    </Drawer>
  );
}

function MemberRow({
  m, myId, isAdmin, isTeam, onAction,
}: {
  m: GroupMember;
  myId: number;
  isAdmin: boolean;
  isTeam: boolean;
  onAction: () => void;
}) {
  const isMe = m.userId === myId;
  const isOwnerRow = m.role === 'owner';
  return (
    <ListItem
      secondaryAction={
        isAdmin && !isOwnerRow && !isMe ? (
          <Stack direction="row" spacing={0.5}>
            {isTeam && (
              <Tooltip title="设置角色">
                <IconButton
                  size="small"
                  onClick={() => {
                    const role = prompt('新角色 (owner/admin/member)', m.role);
                    if (role && ['owner', 'admin', 'member'].includes(role)) {
                      setGroupMemberRole(m.groupId, m.userId, role as any).then(onAction);
                    }
                  }}
                >
                  <MoreVertRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={m.muted ? '解除禁言' : '禁言'}>
              <IconButton
                size="small"
                onClick={() => muteGroupMember(m.groupId, m.userId, !m.muted).then(onAction)}
              >
                {m.muted ? '🔇' : '🔊'}
              </IconButton>
            </Tooltip>
            <Tooltip title="踢出">
              <IconButton
                size="small"
                color="error"
                onClick={() => {
                  if (confirm(`确定踢出 #${m.userId}?`)) {
                    kickGroupMember(m.groupId, m.userId).then(onAction);
                  }
                }}
              >
                ✕
              </IconButton>
            </Tooltip>
          </Stack>
        ) : null
      }
    >
      <ListItemAvatar>
        <Avatar sx={{ width: 32, height: 32, fontSize: 12 }}>{(m.nickname || `用户${m.userId}`).slice(0, 1)}</Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: 13 }}>{m.nickname || `用户${m.userId}`}</Typography>
            {isMe && <Chip size="small" label="我" sx={{ height: 16, fontSize: 9 }} />}
            {m.role === 'owner' && <Chip size="small" color="primary" label="群主" sx={{ height: 16, fontSize: 9 }} />}
            {m.role === 'admin' && <Chip size="small" label="管理" sx={{ height: 16, fontSize: 9 }} />}
            {m.muted && <Chip size="small" color="warning" label="禁言" sx={{ height: 16, fontSize: 9 }} />}
            {isTeam && m.ratio ? (
              <Chip size="small" label={`${(m.ratio / 100).toFixed(1)}%`} sx={{ height: 16, fontSize: 9 }} />
            ) : null}
          </Box>
        }
        secondary={`#${m.userId}`}
      />
    </ListItem>
  );
}

// ─── 团队分账面板(F2) ───
function SettlementPanel({
  teamId, isOwner, settlements, onChanged,
}: {
  teamId: number;
  isOwner: boolean;
  settlements: TeamSettlement[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState('reward');
  const [totalYuan, setTotalYuan] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const cents = Math.round(Number(totalYuan) * 100);
    if (!cents || cents < 1) {
      setSnack('金额必须大于 0');
      return;
    }
    setBusy(true);
    try {
      await settleTeam(teamId, { sourceType, totalCents: cents, note });
      setOpen(false);
      setTotalYuan('');
      setNote('');
      onChanged();
      setSnack('已发起分账,按团队成员比例自动入账');
    } catch (e: any) {
      setSnack(e?.message || '分账失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>分账记录</Typography>
        {isOwner && (
          <Button
            size="small"
            variant="contained"
            startIcon={<HandshakeRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={() => setOpen(true)}
            sx={{
              textTransform: 'none',
              background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
              '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
            }}
          >
            发起分账
          </Button>
        )}
      </Stack>

      {settlements.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
          <Typography sx={{ fontSize: 13 }}>还没有分账记录</Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {settlements.map((s) => (
            <Box
              key={s.id}
              sx={{
                p: 1.5,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: 12, color: 'text.primary', fontWeight: 600 }}>
                  {(s.totalCents / 100).toFixed(2)} 钻石
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                  {s.sourceType} · {s.createTime?.slice(0, 16)}
                </Typography>
              </Box>
              {s.note && (
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                  {s.note}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {/* 发起分账对话框 */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: 'background.paper', backgroundImage: 'none' } } }}
      >
        <DialogTitle>发起团队分账</DialogTitle>
        <DialogContent dividers sx={{ borderColor: 'divider' }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="收入来源"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              fullWidth
              size="small"
              SelectProps={{ native: true }}
            >
              <option value="reward">悬赏分成</option>
              <option value="bounty">赏金</option>
              <option value="order">订单分成</option>
              <option value="other">其他</option>
            </TextField>
            <TextField
              label="分账总额(钻石)"
              type="number"
              value={totalYuan}
              onChange={(e) => setTotalYuan(e.target.value)}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
              helperText="按各成员比例自动拆分到钱包"
            />
            <TextField
              label="备注"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              fullWidth
              size="small"
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpen(false)} disabled={busy} sx={{ textTransform: 'none' }}>
            取消
          </Button>
          <Button
            variant="contained"
            onClick={submit}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : undefined}
            sx={{
              textTransform: 'none',
              background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
              '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
            }}
          >
            确认分账
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

// useSearchParams() 在静态导出下必须包在 Suspense 里,否则整页被迫退回客户端渲染并告警。
export default function GroupDetailPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      }
    >
      <GroupDetailContent />
    </Suspense>
  );
}
