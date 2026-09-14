'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import SendIcon from '@mui/icons-material/Send';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSessionList,
  getMessageList,
  sendMessage,
  markSessionRead,
  type DMSession,
  type DMMessage,
} from '@/apis/msg';
import { gradient2 } from '@/constants/gradients';
import { ACCENT } from '@/constants/accents';

interface ContactTalkProps {
  open: boolean;
  onClose: () => void;
}

interface OptimisticMsg extends DMMessage {
  pending?: boolean;
}

export default function ContactTalk({ open, onClose }: ContactTalkProps) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [sessions, setSessions] = useState<DMSession[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalUnread = sessions.reduce((s, x) => s + x.unread, 0);

  // 加载会话列表
  const { isLoading: sessionsLoading } = useQuery({
    queryKey: ['contact-sessions'],
    queryFn: async () => {
      const list = await getSessionList();
      setSessions(list);
      return list;
    },
    enabled: open,
    staleTime: 30_000,
  });

  // 默认选第一个会话
  useEffect(() => {
    if (sessions.length > 0 && selectedId === null) {
      setSelectedId(sessions[0].id);
    }
  }, [sessions, selectedId]);

  // 轮询新消息（选中了会话时）
  useEffect(() => {
    if (!open || selectedId === null) {
      if (pollTimer.current) clearInterval(pollTimer.current);
      return;
    }
    // 首次立即拉一次
    qc.invalidateQueries({ queryKey: ['contact-messages', selectedId] });
    pollTimer.current = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['contact-messages', selectedId] });
    }, 3000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [open, selectedId, qc]);

  // 加载选中会话的消息
  const { data: rawMessages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['contact-messages', selectedId],
    queryFn: () => getMessageList(selectedId!),
    enabled: selectedId !== null,
    staleTime: 0,
    refetchInterval: false,
  });

  // 合并乐观消息（发送中但后端还没返回的）
  const messages: OptimisticMsg[] = rawMessages as OptimisticMsg[];

  // 发送消息
  const sendMutation = useMutation({
    mutationFn: ({ content }: { content: string }) => sendMessage(selectedId!, content),
    onMutate: async ({ content }) => {
      // 乐观更新：先显示自己发的消息
      const optimistic: OptimisticMsg = {
        id: Date.now(), // 临时 id
        sessionId: selectedId!,
        fromUserId: -1, // 自己
        type: 'text',
        content,
        status: 'pending',
        time: new Date().toISOString(),
        pending: true,
      };
      await qc.cancelQueries({ queryKey: ['contact-messages', selectedId] });
      qc.setQueryData<OptimisticMsg[]>(['contact-messages', selectedId], (old = []) => [
        ...old,
        optimistic,
      ]);
      return { optimistic };
    },
    onSuccess: (newMsg) => {
      // 后端返回后：用真实消息替换乐观消息
      qc.setQueryData<OptimisticMsg[]>(['contact-messages', selectedId], (old = []) =>
        old.map((m) => (m.pending ? (newMsg as OptimisticMsg) : m)),
      );
      // 刷新会话列表（更新 lastMessage）
      qc.invalidateQueries({ queryKey: ['contact-sessions'] });
    },
    onError: (_err, _vars, ctx) => {
      // 发送失败：移除乐观消息
      qc.setQueryData<OptimisticMsg[]>(['contact-messages', selectedId], (old = []) =>
        (old || []).filter((m) => !m.pending),
      );
    },
  });

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !selectedId || sendMutation.isPending) return;
    setInput('');
    sendMutation.mutate({ content: text });
  }, [input, selectedId, sendMutation]);

  // 选中新会话时：标记已读
  useEffect(() => {
    if (selectedId !== null) {
      markSessionRead(selectedId).catch(() => {});
      // 刷新会话列表（更新未读数）
      qc.invalidateQueries({ queryKey: ['contact-sessions'] });
    }
  }, [selectedId, qc]);

  // 消息来了自动滚到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // 选中会话的对方头像/昵称
  const currentSession = sessions.find((s) => s.id === selectedId);
  const peerAvatar = currentSession?.avatar;
  const peerName = currentSession?.nickname || '客服';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            height: { xs: '90dvh', sm: '80dvh' },
            maxHeight: 700,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 3,
            overflow: 'hidden',
          },
        },
      }}
    >
      {/* 标题栏 */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexShrink: 0,
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 1.5,
          px: 2,
        }}
      >
        <Badge badgeContent={totalUnread} color="error" max={99}>
          <Avatar
            src={peerAvatar}
            sx={{
              width: 36,
              height: 36,
              background: gradient2('#FE2C55', ACCENT.purple.main),
              fontSize: 14,
            }}
          >
            客
          </Avatar>
        </Badge>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
            {peerName}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {sessionsLoading ? '加载中...' : `${sessions.length} 个会话 · 在线`}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* 主体：左侧会话列表 + 右侧消息 */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* 左侧会话列表 */}
        <Box
          sx={{
            width: { xs: 0, sm: 160 },
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            display: { xs: selectedId !== null ? 'none' : 'flex', sm: 'flex' },
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {sessionsLoading ? (
            <Box sx={{ p: 1 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 0.5, borderRadius: 1 }} />
              ))}
            </Box>
          ) : sessions.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <ChatIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>暂无会话</Typography>
            </Box>
          ) : (
            <Box sx={{ overflow: 'auto', flex: 1 }}>
              {sessions.map((s) => (
                <Box key={s.id}>
                  <ListItemButton
                    selected={s.id === selectedId}
                    onClick={() => setSelectedId(s.id)}
                    sx={{ px: 1.5, py: 1, borderRadius: 0 }}
                  >
                    <ListItemAvatar sx={{ minWidth: 44 }}>
                      <Badge
                        badgeContent={s.unread}
                        color="error"
                        overlap="circular"
                        invisible={s.unread === 0}
                      >
                        <Avatar
                          src={s.avatar}
                          sx={{
                            width: 36,
                            height: 36,
                            background: gradient2('#5DDB96', ACCENT.blue.main),
                            fontSize: 13,
                          }}
                        >
                          {s.nickname?.[0] || '?'}
                        </Avatar>
                      </Badge>
                    </ListItemAvatar>
                    <ListItemText
                      primary={s.nickname || '未知'}
                      secondary={s.lastMessage || '暂无消息'}
                      slotProps={{
                        primary: { sx: { fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
                        secondary: { sx: { fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
                      }}
                    />
                  </ListItemButton>
                  <Divider />
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* 右侧消息区域 */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            // 选中会话后移动端显示会话列表按钮
            // sm 以上两侧都显示
          }}
        >
          {selectedId === null ? (
            /* 未选会话：桌面端显示提示 */
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <ChatIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
              <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
                选择左侧会话开始聊天
              </Typography>
            </Box>
          ) : (
            <>
              {/* 消息列表 */}
              <Box sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5 }}>
                {messagesLoading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Box key={i} sx={{ display: 'flex', justifyContent: i % 2 === 0 ? 'flex-start' : 'flex-end' }}>
                        <Skeleton variant="rounded" width={160 + i * 30} height={36} sx={{ borderRadius: 2 }} />
                      </Box>
                    ))}
                  </Box>
                ) : messages.length === 0 ? (
                  <Box sx={{ textAlign: 'center', mt: 4 }}>
                    <ChatIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                    <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                      发送消息开始对话
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {messages.map((msg) => {
                      const isSelf = msg.fromUserId === -1 || msg.fromUserId === currentSession?.userId;
                      return (
                        <Box
                          key={msg.id}
                          sx={{
                            display: 'flex',
                            justifyContent: isSelf ? 'flex-end' : 'flex-start',
                            alignItems: 'flex-end',
                            gap: 0.75,
                          }}
                        >
                          {!isSelf && (
                            <Avatar
                              src={currentSession?.avatar}
                              sx={{ width: 28, height: 28, background: 'primary.main', fontSize: 11, flexShrink: 0 }}
                            >
                              {currentSession?.nickname?.[0] || '客'}
                            </Avatar>
                          )}
                          <Box
                            sx={{
                              maxWidth: '75%',
                              px: 1.5,
                              py: 0.75,
                              borderRadius: isSelf
                                ? '12px 12px 2px 12px'
                                : '12px 12px 12px 2px',
                              bgcolor: isSelf ? 'primary.main' : 'action.hover',
                              color: isSelf ? '#fff' : 'text.primary',
                              opacity: msg.pending ? 0.6 : 1,
                              fontSize: 13,
                              lineHeight: 1.5,
                              wordBreak: 'break-word',
                            }}
                          >
                            {msg.content}
                          </Box>
                          {isSelf && (
                            <SendIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
                          )}
                        </Box>
                      );
                    })}
                    <div ref={bottomRef} />
                  </Box>
                )}
              </Box>

              {/* 输入框 */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1.25,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  flexShrink: 0,
                }}
              >
                <Tooltip title="表情">
                  <IconButton size="small" sx={{ color: 'text.secondary' }}>
                    <EmojiEmotionsIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="输入消息..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  slotProps={{
                    htmlInput: { 'aria-label': '输入消息', style: { padding: '6px 10px' } },
                  }}
                  sx={{ '& fieldset': { borderColor: 'transparent' }, '&:hover fieldset': { borderColor: 'divider' } }}
                />
                <IconButton
                  color="primary"
                  onClick={handleSend}
                  disabled={!input.trim() || sendMutation.isPending}
                  sx={{
                    bgcolor: 'primary.main',
                    color: '#fff',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '&:disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
                    width: 34,
                    height: 34,
                  }}
                >
                  <SendIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
