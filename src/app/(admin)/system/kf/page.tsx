'use client';

/**
 * 客服工作台。
 *
 * /api/core/kf/sessions、/kf/reply 这几个接口早就写好了,但整个前端没有一处调用 ——
 * 用户在 /kf-chat 发出来的消息落进 kf_message 表就没了下文。这里把坐席侧补上:
 * 左边待处理会话(未读优先),右边对话与回复。
 *
 * 新消息走长连接推(RealtimeProvider 收到 kf 事件会 invalidate 这几个 key),
 * 断线时退回轮询。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { formatApiError } from '@/lib/api/client';
import { usePollFallback } from '@/lib/realtime';
import {
  closeKfSession,
  getKfSessions,
  getKfThread,
  markKfStaffRead,
  replyKf,
  type KfMessage,
  type KfSession,
} from '@/apis/kf';

/** 常用话术。客服台最耗时间的是重复打字,不是判断。 */
const QUICK_REPLIES = [
  '你好,这边已经收到,我看一下。',
  '麻烦提供一下订单号或截图,我帮你查。',
  '已经反馈给技术同学,处理好第一时间回复你。',
  '这个问题已经修复,麻烦刷新页面再试一次。',
  '还有其它可以帮到你的吗?',
];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return d.toDateString() === now.toDateString() ? hm : `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

export default function KfConsolePage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const [activeUser, setActiveUser] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false,
    msg: '',
    severity: 'success',
  });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const listPoll = usePollFallback(20_000);
  const threadPoll = usePollFallback(8_000);

  const { data: sessions = [], isLoading: loadingList } = useQuery({
    queryKey: ['kf-sessions', status],
    queryFn: () => getKfSessions(status),
    refetchInterval: listPoll,
    staleTime: 5_000,
  });

  const { data: thread = [], isLoading: loadingThread } = useQuery({
    queryKey: ['kf-thread', activeUser],
    queryFn: () => getKfThread(activeUser as number),
    enabled: activeUser !== null,
    refetchInterval: threadPoll,
    staleTime: 2_000,
  });

  const active = useMemo(() => sessions.find((s) => s.userId === activeUser), [sessions, activeUser]);
  const totalUnread = useMemo(() => sessions.reduce((n, s) => n + (s.unreadStaff || 0), 0), [sessions]);

  // 打开会话就算处理过了
  useEffect(() => {
    if (activeUser === null) return;
    markKfStaffRead(activeUser)
      .then(() => qc.invalidateQueries({ queryKey: ['kf-sessions'] }))
      .catch(() => {});
  }, [activeUser, thread.length, qc]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length, activeUser]);

  const reply = useMutation({
    mutationFn: (content: string) => replyKf(activeUser as number, content),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['kf-thread', activeUser] });
      qc.invalidateQueries({ queryKey: ['kf-sessions'] });
    },
    onError: (e) => setSnack({ open: true, msg: formatApiError(e) || '回复失败', severity: 'error' }),
  });

  const close = useMutation({
    mutationFn: () => closeKfSession(activeUser as number),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kf-sessions'] });
      setSnack({ open: true, msg: '会话已结束', severity: 'success' });
    },
    onError: (e) => setSnack({ open: true, msg: formatApiError(e) || '操作失败', severity: 'error' }),
  });

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || activeUser === null || reply.isPending) return;
    reply.mutate(text);
  }, [draft, activeUser, reply]);

  return (
    <Box sx={{ p: { xs: 1, sm: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700 }}>客服工作台</Typography>
        {totalUnread > 0 && <Chip size="small" color="error" label={`${totalUnread} 条待处理`} />}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, height: 'calc(100dvh - 200px)', minHeight: 420 }}>
        {/* 会话列表 */}
        <Paper variant="outlined" sx={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Tabs
            value={status}
            onChange={(_, v) => {
              setStatus(v);
              setActiveUser(null);
            }}
            sx={{ minHeight: 38, flexShrink: 0, '& .MuiTab-root': { minHeight: 38, fontSize: 13, textTransform: 'none' } }}
          >
            <Tab value="open" label="进行中" />
            <Tab value="closed" label="已结束" />
          </Tabs>
          <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {loadingList ? (
              <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={56} />
                ))}
              </Box>
            ) : sessions.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>没有会话</Typography>
              </Box>
            ) : (
              sessions.map((s) => <SessionRow key={s.id} s={s} active={s.userId === activeUser} onPick={() => setActiveUser(s.userId)} />)
            )}
          </Box>
        </Paper>

        {/* 对话 */}
        <Paper variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          {activeUser === null ? (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>选择左侧会话开始处理</Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
                <Avatar src={active?.avatar} sx={{ width: 32, height: 32 }}>
                  {active?.nickname?.[0] || '?'}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>
                    {active?.nickname || `用户 ${activeUser}`}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>user #{activeUser}</Typography>
                </Box>
                <Tooltip title="打开 TA 的主页">
                  <IconButton size="small" href={`/u/${activeUser}`} target="_blank">
                    <OpenInNewIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Button
                  size="small"
                  variant="text"
                  startIcon={<DoneAllIcon sx={{ fontSize: 16 }} />}
                  onClick={() => close.mutate()}
                  disabled={close.isPending || active?.status === 'closed'}
                  sx={{ textTransform: 'none' }}
                >
                  结束会话
                </Button>
              </Box>

              <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', minHeight: 0, px: 2, py: 2 }}>
                {loadingThread ? (
                  <Skeleton variant="rounded" height={120} />
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {thread.map((m) => (
                      <StaffBubble key={m.id} msg={m} />
                    ))}
                  </Box>
                )}
              </Box>

              <Box sx={{ px: 1.5, pt: 1, flexShrink: 0, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {QUICK_REPLIES.map((q) => (
                  <Chip
                    key={q}
                    size="small"
                    label={q}
                    onClick={() => setDraft((d) => (d ? `${d} ${q}` : q))}
                    sx={{ fontSize: 11 }}
                  />
                ))}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, px: 1.5, py: 1.25, flexShrink: 0 }}>
                <TextField
                  fullWidth
                  size="small"
                  multiline
                  maxRows={4}
                  placeholder="回复…(Enter 发送,Shift + Enter 换行)"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <IconButton
                  onClick={send}
                  disabled={!draft.trim() || reply.isPending}
                  sx={{
                    bgcolor: 'primary.main',
                    color: '#fff',
                    width: 36,
                    height: 36,
                    '&:hover': { bgcolor: 'primary.dark' },
                    '&:disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
                  }}
                >
                  <ArrowUpwardIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            </>
          )}
        </Paper>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function SessionRow({ s, active, onPick }: { s: KfSession; active: boolean; onPick: () => void }) {
  return (
    <Box
      onClick={onPick}
      sx={{
        display: 'flex',
        gap: 1.25,
        px: 1.5,
        py: 1.25,
        cursor: 'pointer',
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: active ? 'action.selected' : 'transparent',
        '&:hover': { bgcolor: active ? 'action.selected' : 'action.hover' },
      }}
    >
      <Badge badgeContent={s.unreadStaff} color="error" overlap="circular" invisible={!s.unreadStaff}>
        <Avatar src={s.avatar} sx={{ width: 36, height: 36 }}>
          {s.nickname?.[0] || '?'}
        </Avatar>
      </Badge>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography noWrap sx={{ fontSize: 13, fontWeight: s.unreadStaff ? 700 : 500, flex: 1 }}>
            {s.nickname || `用户 ${s.userId}`}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.disabled', flexShrink: 0 }}>{fmtTime(s.lastTime)}</Typography>
        </Box>
        <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>
          {s.lastMessage || '暂无消息'}
        </Typography>
      </Box>
    </Box>
  );
}

function StaffBubble({ msg }: { msg: KfMessage }) {
  if (msg.fromRole === 'system') {
    return (
      <Box sx={{ alignSelf: 'center', maxWidth: 520, px: 2, py: 1, bgcolor: 'action.hover', borderRadius: 1.5 }}>
        <Typography sx={{ fontSize: 11.5, color: 'text.secondary', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          自动回执:{msg.content}
        </Typography>
      </Box>
    );
  }
  // 客服说的话放右边(这里是坐席视角,和用户那一侧正好相反)
  const mine = msg.fromRole === 'staff';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 0.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, maxWidth: '78%' }}>
        {mine && <HeadsetMicIcon sx={{ fontSize: 14, color: 'text.disabled', mb: 0.5 }} />}
        {msg.type === 'image' ? (
          <Box sx={{ maxWidth: 220, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
            <img src={msg.content} alt="" style={{ width: '100%', display: 'block' }} />
          </Box>
        ) : (
          <Box
            sx={{
              px: 1.5,
              py: 0.9,
              borderRadius: 2,
              bgcolor: mine ? 'primary.main' : 'action.hover',
              color: mine ? '#fff' : 'text.primary',
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {msg.content}
          </Box>
        )}
      </Box>
      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{fmtTime(msg.createTime)}</Typography>
    </Box>
  );
}
