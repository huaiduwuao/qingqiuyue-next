'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import * as hermesApi from '@/apis/hermes';
import type { HermesAgentItem } from '@/beans/system';
import { AsyncState } from '@/components/common/AsyncState';
import { LoginGate } from '@/components/auth/LoginGate';

// 类型定义
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createTime?: string;
}

interface ChatApiResp {
  text?: string;
  conversationId?: string;
}

interface ErrorWithMessage {
  message?: string;
}

function formatTime(t?: string) {
  if (!t) return '';
  try {
    return new Date(t).toLocaleString();
  } catch {
    return t;
  }
}

export default function HermesChatPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const searchParams = useSearchParams();

  // conversationId: 从 URL 读取，undefined 表示新对话/legacy
  const [conversationId, setConversationId] = useState<string | undefined>(() =>
    searchParams.get('conversationId') || undefined,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // 新建会话:重置所有状态并清 URL
  const startNewConversation = useCallback(() => {
    setConversationId(undefined);
    setMessages([]);
    // conversationId 变会触发 initDoneRef 重置 + historyQuery 重新 fetch,无需手动 invalidate
    router.replace(`/hermes/${id}`);
  }, [id, router]);

  // 同步 conversationId 到 URL
  useEffect(() => {
    if (conversationId) {
      const url = new URL(window.location.href);
      url.searchParams.set('conversationId', conversationId);
      window.history.replaceState(null, '', url.toString());
    }
  }, [conversationId]);

  const detailQuery = useQuery<HermesAgentItem>({
    queryKey: ['hermes', 'detail', id],
    queryFn: () => hermesApi.clientDetail(id!).then((r) => (r as { data?: HermesAgentItem }).data!),
    enabled: !!id,
  });

  const historyQuery = useQuery<ChatMessage[]>({
    queryKey: ['hermes', 'history', id, conversationId ?? 'none'],
    queryFn: () =>
      hermesApi
        .clientHistory(id!, conversationId)
        .then((r) => {
          // r 可能是直接数组或包装对象 {messages} 或 {data: {messages}}
          const raw = r as { messages?: ChatMessage[] } | { data?: { messages?: ChatMessage[] } } | ChatMessage[];
          if (Array.isArray(raw)) return raw;
          if ('messages' in raw && raw.messages) return raw.messages;
          if ('data' in raw && raw.data?.messages) return raw.data.messages;
          return [];
        }),
    // 客户端专用:useSearchParams 在 SSR 返回空,避免 hydration 不匹配
    enabled: typeof window !== 'undefined' && !!id,
  });

  // 初始化消息:基于 historyQuery + detailQuery 计算初始消息(无 effect/cascading render)
  const initMessages = useMemo<ChatMessage[] | null>(() => {
    if (!historyQuery.data || !detailQuery.data) return null;
    if (historyQuery.data.length === 0) {
      const greeting = detailQuery.data?.greeting;
      return greeting ? [{ role: 'assistant', content: greeting }] : [];
    }
    return historyQuery.data as ChatMessage[];
  }, [historyQuery.data, detailQuery.data]);

  // initDone 用 useRef + conversationId 依赖驱动重初始化(新对话时 conversationId 变)
  const initDoneRef = useRef(false);
  useEffect(() => {
    // conversationId 变时重置
    initDoneRef.current = false;
  }, [conversationId]);

  // initMessages 变化时一次性同步到 messages state
  useEffect(() => {
    if (initMessages !== null && !initDoneRef.current) {
      initDoneRef.current = true;
      setMessages(initMessages);
    }
  }, [initMessages]);

  // 自动滚动:只在有追加消息时触发,用户手动滚动时避免打断
  const scrollRef = useRef(false);
  const handleScroll = useCallback(() => {
    if (listRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = listRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 80;
      scrollRef.current = atBottom;
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (text: string) => {
      const agent = detailQuery.data;
      if (!agent) throw new Error('智能体未加载');
      return hermesApi.chat(agent.agentId, text, conversationId);
    },
    onSuccess: (_res) => {
      // 响应可能是直接结构 {text, conversationId} 或包装 {data: {text, conversationId}}
      const res = _res as ChatApiResp & { data?: ChatApiResp };
      const reply = res.text ?? res.data?.text ?? '';
      const newConvId = res.conversationId ?? res.data?.conversationId;
      if (newConvId && !conversationId) {
        setConversationId(newConvId);
      }
      if (reply) {
        setMessages((cur) => [...cur, { role: 'assistant', content: reply }]);
      }
    },
    onError: (err: ErrorWithMessage) => {
      // 失败时追加错误消息提示
      setMessages((cur) => [
        ...cur,
        { role: 'assistant', content: `请求失败: ${err.message}` },
      ]);
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setInput('');
    sendMutation.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const agent = detailQuery.data;

  return (
    <Container maxWidth="md">
      <Box sx={{ py: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 顶部栏 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => router.push('/hermes')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1 }}>Hermes 智能体</Typography>
          <Tooltip title="新建对话">
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={startNewConversation}
            >
              新对话
            </Button>
          </Tooltip>
        </Box>

        {/* 会话 ID 标签(如果有) */}
        {conversationId && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={`会话: ${conversationId.substring(0, 8)}...`}
              size="small"
              variant="outlined"
              sx={{ fontFamily: 'monospace', fontSize: 11 }}
            />
          </Box>
        )}

        <AsyncState<HermesAgentItem>
          query={detailQuery}
          isEmpty={(d) => !d}
          emptyText="智能体不存在"
        >
          {(data) => {
            const d = data as HermesAgentItem;
            return (
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar
                    src={d.avatarUrl}
                    sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontSize: 22, fontWeight: 700 }}
                  >
                    {(d.name || d.agentId || '?')[0]?.toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h6" noWrap>{d.name}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {d.role || d.agentId}
                    </Typography>
                  </Box>
                </Box>
                {d.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    {d.description}
                  </Typography>
                )}
                {d.tags && d.tags.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 0.5, mt: 1.5 }}>
                    {d.tags.map((t, i) => (
                      <Chip key={i} label={t} size="small" variant="outlined" />
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
            );
          }}
        </AsyncState>

        <LoginGate mode="replace" message="登录后开始对话">

        <Paper
          ref={listRef}
          onScroll={handleScroll}
          sx={{
            flex: 1,
            minHeight: 360,
            maxHeight: 480,
            overflow: 'auto',
            p: 2,
            bgcolor: 'background.default',
          }}
        >
          {historyQuery.isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : messages.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              {conversationId ? '暂无消息' : '发送第一条消息开始对话'}
            </Typography>
          ) : (
            <List disablePadding>
              {messages.map((m) => {
                const isUser = m.role === 'user';
                const msgKey = `${m.createTime ?? ''}-${m.content.slice(0, 20)}`;
                return (
                  <ListItem
                    key={msgKey}
                    disableGutters
                    sx={{
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                      mb: 1.5,
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: isUser ? 'row-reverse' : 'row',
                        gap: 1,
                        maxWidth: '80%',
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 32,
                          height: 32,
                          bgcolor: isUser ? 'secondary.main' : 'primary.main',
                        }}
                      >
                        {isUser ? <PersonIcon sx={{ fontSize: 18 }} /> : <SmartToyIcon sx={{ fontSize: 18 }} />}
                      </Avatar>
                      <Box>
                        <Paper
                          sx={{
                            p: 1.5,
                            bgcolor: isUser ? 'primary.main' : 'background.paper',
                            color: isUser ? 'primary.contrastText' : 'text.primary',
                            borderRadius: 2,
                            borderTopLeftRadius: isUser ? 2 : 0.5,
                            borderTopRightRadius: isUser ? 0.5 : 2,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                            {m.content}
                          </Typography>
                        </Paper>
                        {m.createTime && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mt: 0.5, textAlign: isUser ? 'right' : 'left' }}
                          >
                            {formatTime(m.createTime)}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </ListItem>
                );
              })}
              {sendMutation.isPending && (
                <ListItem disableGutters sx={{ justifyContent: 'flex-start' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                      <SmartToyIcon sx={{ fontSize: 18 }} />
                    </Avatar>
                    <CircularProgress size={16} />
                  </Box>
                </ListItem>
              )}
            </List>
          )}
        </Paper>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={6}
            placeholder={agent ? `给 ${agent.name} 发消息…` : '发消息…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sendMutation.isPending}
          />
          <Button
            variant="contained"
            endIcon={<SendIcon />}
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending || !agent}
          >
            发送
          </Button>
        </Box>
        </LoginGate>
      </Box>
    </Container>
  );
}
