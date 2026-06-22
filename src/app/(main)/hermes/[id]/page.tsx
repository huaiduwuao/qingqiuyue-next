'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import * as hermesApi from '@/apis/hermes';
import type { HermesAgentItem } from '@/beans/system';
import { AsyncState } from '@/components/common/AsyncState';
import { LoginGate } from '@/components/auth/LoginGate';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createTime?: string;
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
  const qc = useQueryClient();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  const detailQuery = useQuery<HermesAgentItem>({
    queryKey: ['hermes', 'detail', id],
    queryFn: () => hermesApi.clientDetail(id as any).then((r: any) => r.data),
    enabled: !!id,
  });

  const historyQuery = useQuery<ChatMessage[]>({
    queryKey: ['hermes', 'history', id],
    queryFn: () => hermesApi.clientHistory(id as any).then((r: any) => r.data?.messages || r.data || []),
    enabled: !!id,
  });

  // 初始化消息:历史为空则塞入 greeting;有历史则展示历史
  useEffect(() => {
    if (!historyQuery.data) return;
    if (historyQuery.data.length === 0) {
      const greeting = detailQuery.data?.greeting;
      if (greeting) {
        setMessages([{ role: 'assistant', content: greeting }]);
      }
    } else {
      setMessages(historyQuery.data as ChatMessage[]);
    }
  }, [historyQuery.data, detailQuery.data]);

  // 自动滚到底部
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: (text: string) => {
      const agent = detailQuery.data;
      if (!agent) throw new Error('智能体未加载');
      return hermesApi.chat(agent.agentId, text);
    },
    onSuccess: (res: any) => {
      const reply = res?.text ?? res?.data?.text ?? '';
      if (reply) {
        setMessages((cur) => [...cur, { role: 'assistant', content: reply }]);
      }
      qc.invalidateQueries({ queryKey: ['hermes', 'history', id] });
    },
  });

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setMessages((cur) => [...cur, { role: 'user', content: text }]);
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => router.push('/hermes')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6">Hermes 智能体</Typography>
        </Box>

        <AsyncState
          query={detailQuery as any}
          isEmpty={(d: any) => !d}
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
          ref={listRef as any}
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
              发送第一条消息开始对话
            </Typography>
          ) : (
            <List disablePadding>
              {messages.map((m, i) => {
                const isUser = m.role === 'user';
                return (
                  <ListItem
                    key={i}
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