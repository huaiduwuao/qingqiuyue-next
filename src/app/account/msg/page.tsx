'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import SearchIcon from '@mui/icons-material/Search';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import EmojiEmotionsOutlinedIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import VerifiedIcon from '@mui/icons-material/Verified';
import { adminClient, homeClient, contentClient, formatApiError } from '@/lib/api/client';
import { getDetailRoute } from '@/lib/contentRoute';
import { fileUpload } from '@/apis/global';
import { useMsgUi } from './store';

interface Session {
  id: number;
  userId: number;
  nickname: string;
  avatar: string;
  bio?: string;
  isFollowed?: boolean;
  isOfficial?: boolean;
  unread: number;
  lastMessage: string;
  lastMessageType: 'text' | 'image' | 'system' | 'recall';
  lastTime: string;
  pinned: boolean;
}

interface Message {
  id: number;
  sessionId: number;
  fromUserId: number;
  type: 'text' | 'image' | 'system' | 'recall' | 'time';
  content: string;
  time: string;
  status?: 'sent' | 'delivered' | 'read';
}

const INTERACTION_SUB_TYPES = [
  { key: 'all', label: '最新' },
  { key: 'comment', label: '评论' },
  { key: 'mention', label: '@我的' },
  { key: 'like', label: '赞' },
  { key: 'follow', label: '粉丝' },
  { key: 'friend', label: '好友' },
];

const QUICK_EMOJI = ['😀', '😂', '🥰', '😍', '🤔', '😢', '👍', '👏', '🎉', '❤️', '🔥', '✨'];

function timeAgo(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return d.toLocaleDateString('zh-CN').replace(/\//g, '/');
}

function systemTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff < 7) return `${diff} 天前`;
  return d.toLocaleDateString('zh-CN').replace(/\//g, '/');
}

function mapNoticeTargetType(targetType?: string): string | null {
  if (!targetType) return null;
  const map: Record<string, string> = {
    video: 'VIDEO',
    novel: 'NOVEL',
    music: 'MUSIC',
    film: 'FILM',
    teleplay: 'TELEPLAY',
    animation: 'ANIMATION',
    comics: 'COMICS',
    vshow: 'VSHOW',
    live: 'LIVE',
    article: 'ARTICLE',
    news: 'NEWS',
    post: 'ARTICLE',
  };
  return map[targetType.toLowerCase()] || null;
}

export default function MsgPage() {
  const mainTab = useMsgUi((s) => s.mainTab);
  const setMainTab = useMsgUi((s) => s.setMainTab);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - var(--appbar-h, 66px))', bgcolor: 'background.default' }}>
      {/* 顶部 Tab 导航 */}
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'background.default', flexShrink: 0, px: 3 }}>
        <Tabs
          value={mainTab}
          onChange={(_, v) => setMainTab(v)}
          sx={{
            minHeight: 44,
            '& .MuiTabs-indicator': { bgcolor: 'primary.main', height: 2 },
            '& .MuiTab-root': {
              minHeight: 44,
              fontSize: 14,
              fontWeight: 500,
              color: 'text.secondary',
              textTransform: 'none',
              px: 2,
              '&.Mui-selected': { color: 'primary.main', fontWeight: 600 },
            },
          }}
        >
          <Tab value="interaction" label="互动消息" />
          <Tab value="system" label="系统消息" />
          <Tab value="dm" label="私信" />
        </Tabs>
      </Box>

      {/* 主体内容 */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {mainTab === 'interaction' && <InteractionPanel />}
        {mainTab === 'system' && <SystemPanel />}
        {mainTab === 'dm' && <DmPanel />}
      </Box>
    </Box>
  );
}

// ─── 互动消息面板 ───
function InteractionPanel() {
  const subType = useMsgUi((s) => s.subType);
  const setSubType = useMsgUi((s) => s.setSubType);
  const { data, isLoading } = useQuery({
    queryKey: ['notice-interaction-page', subType],
    queryFn: async () => (await adminClient('/notice/interaction/list', { params: { subType } })).data,
  });
  const records: any[] = data?.list || [];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', gap: 0.75, px: 3, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0, overflowX: 'auto', '&::-webkit-scrollbar': { display: 'none' } }}>
        {INTERACTION_SUB_TYPES.map((s) => (
          <Box
            key={s.key}
            onClick={() => setSubType(s.key)}
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              bgcolor: subType === s.key ? 'rgba(254, 44, 85, 0.18)' : 'action.hover',
              color: subType === s.key ? 'primary.main' : 'text.secondary',
              fontSize: 13,
              fontWeight: subType === s.key ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: subType === s.key ? 'rgba(254, 44, 85, 0.25)' : 'action.selected' },
            }}
          >
            {s.label}
          </Box>
        ))}
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={72} sx={{ bgcolor: 'action.hover' }} />
            ))}
          </Box>
        ) : records.length === 0 ? (
          <Box sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
            </Box>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>暂无互动消息</Typography>
          </Box>
        ) : (
          <Box sx={{ maxWidth: 900, mx: 'auto' }}>
            {records.map((item) => (
              <FullNoticeItem key={item.id} item={item} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function FullNoticeItem({ item }: { item: any }) {
  const router = useRouter();
  const [snack, setSnack] = useState<{ open: boolean; msg: string }>({ open: false, msg: '' });
  const typeIcon = (() => {
    if (item.type === 'comment') return <CommentOutlinedIcon sx={{ fontSize: 12, color: 'secondary.main' }} />;
    if (item.type === 'mention') return <AlternateEmailIcon sx={{ fontSize: 12, color: '#5B8DEF' }} />;
    if (item.type === 'like') return <FavoriteBorderIcon sx={{ fontSize: 12, color: 'primary.main' }} />;
    if (item.type === 'follow') return <PersonAddAlt1Icon sx={{ fontSize: 12, color: 'warning.main' }} />;
    return null;
  })();

  const handleClick = async () => {
    if (item.type === 'follow' && item.fromUserId) {
      const isFollowed = !!item.isFollowed;
      try {
        if (isFollowed) {
          await homeClient.delete(`/follow/${item.fromUserId}`);
        } else {
          await homeClient.post(`/follow/${item.fromUserId}`);
        }
        setSnack({ open: true, msg: isFollowed ? '已取关' : '已关注' });
      } catch (e) {
        setSnack({ open: true, msg: formatApiError(e) || '操作失败,请稍后重试' });
      }
      return;
    }
    const targetType = mapNoticeTargetType(item.targetType);
    if (targetType && item.targetId) {
      const route = getDetailRoute(targetType, item.targetId);
      if (route) {
        router.push(route);
        return;
      }
    }
    setSnack({ open: true, msg: '该通知没有可跳转的内容' });
  };

  return (
    <>
      <Box
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          px: 3,
          py: 1.75,
          cursor: 'pointer',
          transition: 'background 0.15s',
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        {item.unread && (
          <Box
            sx={{
              position: 'absolute',
              left: 12,
              top: 22,
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: 'primary.main',
            }}
          />
        )}
        <Box sx={{ position: 'relative', flexShrink: 0, ml: 1.5 }}>
          <img
            src={item.avatar}
            alt=""
            style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
            <Typography sx={{ fontSize: 14, fontWeight: item.unread ? 600 : 500, color: 'text.primary' }}>{item.nickname}</Typography>
            {typeIcon}
            <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 0.75, py: 0.125, borderRadius: 0.75, bgcolor: 'action.hover', color: 'text.secondary', fontSize: 10, fontWeight: 500 }}>
              {item.typeName}
            </Box>
            <Box sx={{ flex: 1 }} />
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{timeAgo(item.time)}</Typography>
          </Box>
          <Typography
            sx={{
              fontSize: 13,
              color: item.unread ? 'text.primary' : 'text.secondary',
              lineHeight: 1.6,
              mb: 0.5,
            }}
          >
            {item.title}
          </Typography>
          <Typography
            sx={{
              fontSize: 12,
              color: 'text.secondary',
              lineHeight: 1.6,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.content}
          </Typography>
        </Box>
        {item.targetCover && (
          <Box sx={{ flexShrink: 0 }}>
            <img
              src={item.targetCover}
              alt=""
              style={{ width: 56, height: 56, borderRadius: 6, objectFit: 'cover', display: 'block' }}
            />
          </Box>
        )}
      </Box>
      <Snackbar
        open={snack.open}
        autoHideDuration={2200}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        message={snack.msg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}

// ─── 系统消息面板 ───
function SystemPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['notice-system-page'],
    queryFn: async () => (await adminClient('/notice/system/list')).data,
  });
  const records: any[] = data?.list || [];

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      {isLoading ? (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={84} sx={{ bgcolor: 'action.hover' }} />
          ))}
        </Box>
      ) : records.length === 0 ? (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>暂无系统消息</Typography>
        </Box>
      ) : (
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          {records.map((item) => (
            <SystemNoticeItem key={item.id} item={item} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function SystemNoticeItem({ item }: { item: any }) {
  const [snack, setSnack] = useState<{ open: boolean; msg: string }>({ open: false, msg: '' });
  const config = (() => {
    if (item.level === 'success') return { color: 'success.main', bg: 'rgba(93, 219, 150, 0.12)', icon: <EventOutlinedIcon sx={{ fontSize: 18 }} /> };
    if (item.level === 'warning') return { color: 'warning.main', bg: 'rgba(255, 180, 0, 0.12)', icon: <ShieldOutlinedIcon sx={{ fontSize: 18 }} /> };
    if (item.level === 'error') return { color: 'primary.main', bg: 'rgba(254, 44, 85, 0.12)', icon: <ShieldOutlinedIcon sx={{ fontSize: 18 }} /> };
    return { color: '#5B8DEF', bg: 'rgba(91, 141, 239, 0.12)', icon: <CampaignOutlinedIcon sx={{ fontSize: 18 }} /> };
  })();

  const handleClick = () => {
    if (item.link) {
      window.open(item.link, '_blank');
      return;
    }
    setSnack({ open: true, msg: item.title || '系统消息' });
  };

  return (
    <>
      <Box
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1.5,
          px: 3,
          py: 2,
          cursor: 'pointer',
          transition: 'background 0.15s',
          borderBottom: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        {item.unread && (
          <Box sx={{ position: 'absolute', left: 12, top: 22, width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
        )}
        <Box
          sx={{
            width: 44,
            height: 44,
            ml: 1.5,
            borderRadius: 1.5,
            bgcolor: config.bg,
            color: config.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {config.icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 0.75, py: 0.125, borderRadius: 0.75, bgcolor: config.bg, color: config.color, fontSize: 10, fontWeight: 600 }}>
              {item.typeName}
            </Box>
            <Typography sx={{ fontSize: 14, fontWeight: item.unread ? 600 : 500, color: 'text.primary', flex: 1 }}>
              {item.title}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{systemTime(item.time)}</Typography>
          </Box>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.7 }}>
            {item.content}
          </Typography>
        </Box>
      </Box>
      <Snackbar
        open={snack.open}
        autoHideDuration={2200}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        message={snack.msg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}

// ─── 私信面板(原 私信 页内容) ───
function DmPanel() {
  const selectedId = useMsgUi((s) => s.selectedId);
  const setSelectedId = useMsgUi((s) => s.setSelectedId);
  const [keyword, setKeyword] = useState('');
  const [draft, setDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' });
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<null | HTMLElement>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();

  const { data: sessionData, isLoading: loadingSessions } = useQuery({
    queryKey: ['dm-sessions-page'],
    queryFn: async () => (await adminClient('/msg/session/list')).data,
  });
  const sessions: Session[] = sessionData?.list || [];

  const filteredSessions = useMemo(() => {
    if (!keyword.trim()) return sessions;
    const k = keyword.toLowerCase();
    return sessions.filter((s) => s.nickname.toLowerCase().includes(k) || (s.lastMessage || '').toLowerCase().includes(k));
  }, [sessions, keyword]);

  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
  }, [filteredSessions]);

  const selected = useMemo(() => sessions.find((s) => s.id === selectedId), [sessions, selectedId]);

  const { data: msgData, isLoading: loadingMsgs } = useQuery({
    queryKey: ['dm-messages-page', selectedId],
    queryFn: async () => (await adminClient('/msg/message/list', { params: { sessionId: selectedId } })).data,
    enabled: selectedId !== null,
  });
  const messages: Message[] = msgData?.list || [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, selectedId]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) =>
      (await adminClient('/msg/message/send', {
        method: 'POST',
        data: { sessionId: selectedId, content: text, type: 'text' },
      })).data,
    onSuccess: (_data, variables) => {
      qc.setQueryData(['dm-messages-page', selectedId], (old: any) => {
        const list = old?.list || [];
        const optimistic: Message = {
          id: Date.now(),
          sessionId: selectedId!,
          fromUserId: 2000,
          type: 'text',
          content: variables,
          time: new Date().toISOString(),
          status: 'sent',
        };
        return { ...old, list: [...list, optimistic] };
      });
      setDraft('');
      setShowEmoji(false);
      setSnack({ open: true, msg: '已发送', severity: 'success' });
    },
    onError: () => setSnack({ open: true, msg: '发送失败', severity: 'error' }),
  });

  const sendImageMutation = useMutation({
    mutationFn: async (url: string) =>
      (await adminClient('/msg/message/send', {
        method: 'POST',
        data: { sessionId: selectedId, content: url, type: 'image' },
      })).data,
    onSuccess: (_data, variables) => {
      qc.setQueryData(['dm-messages-page', selectedId], (old: any) => {
        const list = old?.list || [];
        const optimistic: Message = {
          id: Date.now(),
          sessionId: selectedId!,
          fromUserId: 2000,
          type: 'image',
          content: variables,
          time: new Date().toISOString(),
          status: 'sent',
        };
        return { ...old, list: [...list, optimistic] };
      });
      setSnack({ open: true, msg: '图片已发送', severity: 'success' });
    },
    onError: () => setSnack({ open: true, msg: '图片发送失败', severity: 'error' }),
  });

  const pinMutation = useMutation({
    mutationFn: async ({ sessionId, pinned }: { sessionId: number; pinned: boolean }) =>
      (await adminClient('/msg/session/pin', {
        method: 'POST',
        data: { sessionId, pinned },
      })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dm-sessions-page'] });
      setSnack({ open: true, msg: '置顶已更新', severity: 'success' });
    },
    onError: () => setSnack({ open: true, msg: '置顶更新失败', severity: 'error' }),
  });

  const clearMutation = useMutation({
    mutationFn: async () =>
      (await adminClient('/msg/session/clear', {
        method: 'POST',
        data: { sessionId: selectedId },
      })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dm-messages-page', selectedId] });
      setSnack({ open: true, msg: '聊天记录已清空', severity: 'success' });
    },
    onError: () => setSnack({ open: true, msg: '清空失败', severity: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () =>
      (await adminClient('/msg/session/delete', {
        method: 'POST',
        data: { sessionId: selectedId },
      })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dm-sessions-page'] });
      setSelectedId(null);
      setMobileShowDetail(false);
      setSnack({ open: true, msg: '会话已删除', severity: 'success' });
    },
    onError: () => setSnack({ open: true, msg: '删除失败', severity: 'error' }),
  });

  const recallMutation = useMutation({
    mutationFn: async (msgId: number) =>
      (await adminClient('/msg/message/recall', { method: 'POST', data: { msgId } })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dm-messages-page', selectedId] });
      setSnack({ open: true, msg: '已撤回', severity: 'success' });
    },
  });

  const followMutation = useMutation({
    mutationFn: async () => (await adminClient('/msg/session/follow', { method: 'POST' })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dm-sessions-page'] });
      setSnack({ open: true, msg: '已关注', severity: 'success' });
    },
  });

  const handleSend = () => {
    const text = draft.trim();
    if (!text || !selectedId) return;
    sendMutation.mutate(text);
  };

  const handleReport = async () => {
    const reason = reportReason.trim();
    if (!reason) {
      setSnack({ open: true, msg: '请输入举报原因', severity: 'error' });
      return;
    }
    if (!selected?.userId) {
      setSnack({ open: true, msg: '举报已提交', severity: 'success' });
      setReportOpen(false);
      setReportReason('');
      return;
    }
    setReporting(true);
    try {
      await contentClient.post('/report', {
        contentId: selected.userId,
        type: 'user',
        reason,
      });
      setSnack({ open: true, msg: '举报已提交', severity: 'success' });
    } catch (e) {
      setSnack({ open: true, msg: formatApiError(e) || '举报提交失败', severity: 'error' });
    } finally {
      setReporting(false);
      setReportOpen(false);
      setReportReason('');
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = (await fileUpload(formData as any)) as { data?: { url?: string } };
      const url = res?.data?.url;
      if (url) {
        sendImageMutation.mutate(url);
      } else {
        setSnack({ open: true, msg: '上传失败,未返回图片地址', severity: 'error' });
      }
    } catch {
      setSnack({ open: true, msg: '文件上传失败', severity: 'error' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          height: '100%',
          maxWidth: 1200,
          mx: 'auto',
          width: '100%',
          bgcolor: 'background.default',
        }}
      >
        {/* 左侧会话列表 */}
        <Box
          sx={{
            width: { xs: '100%', md: 320 },
            flexShrink: 0,
            display: { xs: mobileShowDetail ? 'none' : 'flex', md: 'flex' },
            flexDirection: 'column',
            borderRight: { md: '1px solid' },
            borderColor: 'divider',
            bgcolor: 'background.default',
          }}
        >
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="搜索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'action.hover',
                  color: 'text.primary',
                  fontSize: 13,
                  borderRadius: 1.5,
                  '& fieldset': { borderColor: 'transparent' },
                  '&:hover fieldset': { borderColor: 'divider' },
                  '&.Mui-focused fieldset': { borderColor: 'primary.main' },
                  '& input::placeholder': { color: 'text.disabled', opacity: 1 },
                },
              }}
            />
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {loadingSessions ? (
              <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={64} sx={{ bgcolor: 'action.hover' }} />
                ))}
              </Box>
            ) : sortedSessions.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>暂无会话</Typography>
              </Box>
            ) : (
              sortedSessions.map((s) => (
                <SessionItem
                  key={s.id}
                  session={s}
                  active={s.id === selectedId}
                  onClick={() => {
                    setSelectedId(s.id);
                    setMobileShowDetail(true);
                  }}
                />
              ))
            )}
          </Box>
        </Box>

        {/* 右侧详情 */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: { xs: mobileShowDetail ? 'flex' : 'none', md: 'flex' },
            flexDirection: 'column',
            bgcolor: 'background.paper',
          }}
        >
          {selected ? (
            <>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  borderBottom: '1px solid', borderColor: 'divider',
                  bgcolor: 'background.default',
                }}
              >
                <IconButton
                  size="small"
                  sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'text.primary' }}
                  onClick={() => setMobileShowDetail(false)}
                >
                  <ArrowBackIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <img src={selected.avatar || undefined} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>{selected.nickname}</Typography>
                    {selected.isOfficial && <VerifiedIcon sx={{ fontSize: 14, color: 'secondary.main' }} />}
                  </Box>
                  {selected.bio && (
                    <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selected.bio}
                    </Typography>
                  )}
                </Box>
                <Tooltip title={selected.isFollowed ? '已关注' : '关注'}>
                  <Box
                    onClick={() => followMutation.mutate()}
                    sx={{
                      px: 1.25,
                      py: 0.4,
                      borderRadius: 1,
                      bgcolor: selected.isFollowed ? 'action.hover' : 'primary.main',
                      color: selected.isFollowed ? 'text.secondary' : 'text.primary',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: selected.isFollowed ? 'action.selected' : 'primary.dark' },
                    }}
                  >
                    {selected.isFollowed ? '已关注' : '关注'}
                  </Box>
                </Tooltip>
                <Tooltip title={selected.pinned ? '取消置顶' : '置顶'}>
                  <IconButton
                    size="small"
                    sx={{ color: selected.pinned ? 'primary.main' : 'text.secondary' }}
                    onClick={() => pinMutation.mutate({ sessionId: selected.id, pinned: !selected.pinned })}
                  >
                    <PushPinOutlinedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="更多">
                  <IconButton
                    size="small"
                    sx={{ color: 'text.secondary' }}
                    onClick={(e) => setMoreAnchor(e.currentTarget)}
                  >
                    <MoreHorizIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Menu
                  anchorEl={moreAnchor}
                  open={!!moreAnchor}
                  onClose={() => setMoreAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                  <MenuItem
                    onClick={() => { setMoreAnchor(null); clearMutation.mutate(); }}
                    sx={{ fontSize: 13, minWidth: 140 }}
                  >
                    清空聊天记录
                  </MenuItem>
                  <MenuItem
                    onClick={() => { setMoreAnchor(null); deleteMutation.mutate(); }}
                    sx={{ fontSize: 13, minWidth: 140, color: 'error.main' }}
                  >
                    删除会话
                  </MenuItem>
                  <MenuItem
                    onClick={() => { setMoreAnchor(null); setReportOpen(true); }}
                    sx={{ fontSize: 13, minWidth: 140 }}
                  >
                    举报
                  </MenuItem>
                </Menu>
              </Box>

              <Box
                ref={scrollRef}
                sx={{
                  flex: 1,
                  overflowY: 'auto',
                  py: 3,
                  px: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  bgcolor: 'background.paper',
                }}
              >
                {loadingMsgs ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center', py: 4 }}>
                    <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: 'action.hover' }} />
                    <Skeleton variant="rounded" width={200} height={60} sx={{ bgcolor: 'action.hover' }} />
                    <Skeleton variant="rounded" width={280} height={80} sx={{ bgcolor: 'action.hover' }} />
                  </Box>
                ) : (
                  messages.map((m) => (
                    <MessageBubble
                      key={m.id}
                      message={m}
                      avatar={selected.avatar}
                      isMine={m.fromUserId === 2000}
                      onRecall={() => recallMutation.mutate(m.id)}
                    />
                  ))
                )}
              </Box>

              <Box sx={{ px: 2, py: 1.5, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 1,
                    bgcolor: 'action.hover',
                    borderRadius: 2,
                    border: '1px solid transparent',
                    transition: 'border-color 0.15s',
                    '&:focus-within': { borderColor: 'primary.main' },
                  }}
                >
                  <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    placeholder="发送消息"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    variant="standard"
                    slotProps={{
                      input: {
                        disableUnderline: true,
                        sx: { color: 'text.primary', fontSize: 13, px: 1.5, py: 1, '& textarea::placeholder': { color: 'text.disabled', opacity: 1 } },
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', pr: 0.5, pb: 0.5 }}>
                    <Tooltip title="表情">
                      <IconButton size="small" onClick={() => setShowEmoji((v) => !v)} sx={{ color: 'text.secondary' }}>
                        <EmojiEmotionsOutlinedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="文件">
                      <IconButton
                        size="small"
                        sx={{ color: 'text.secondary' }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <FolderOpenOutlinedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                    <Box
                      onClick={handleSend}
                      sx={{
                        ml: 0.5,
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: draft.trim() ? 'primary.main' : 'action.hover',
                        color: 'text.primary',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: draft.trim() ? 'pointer' : 'not-allowed',
                        transition: 'all 0.15s',
                        '&:hover': { bgcolor: draft.trim() ? 'primary.dark' : 'action.selected' },
                      }}
                    >
                      <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                    </Box>
                  </Box>
                </Box>
                {showEmoji && (
                  <Box sx={{ mt: 1, p: 1.5, bgcolor: 'action.hover', borderRadius: 2, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0.5 }}>
                    {QUICK_EMOJI.map((e) => (
                      <Box
                        key={e}
                        onClick={() => setDraft((d) => d + e)}
                        sx={{ fontSize: 22, textAlign: 'center', cursor: 'pointer', borderRadius: 1, py: 0.5, '&:hover': { bgcolor: 'action.hover' } }}
                      >
                        {e}
                      </Box>
                    ))}
                  </Box>
                )}
                <Typography sx={{ fontSize: 10, color: 'text.disabled', mt: 0.75, textAlign: 'right' }}>
                  按 Enter 发送,Shift + Enter 换行
                </Typography>
              </Box>
            </>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: 14, color: 'text.disabled' }}>选择一个会话开始聊天</Typography>
            </Box>
          )}
        </Box>
      </Box>
      <Dialog
        open={reportOpen}
        onClose={() => !reporting && setReportOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>举报</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={3}
            label="举报原因"
            placeholder="请填写举报原因"
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportOpen(false)} disabled={reporting}>取消</Button>
          <Button variant="contained" onClick={handleReport} disabled={reporting}>
            提交
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={2000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}

function SessionItem({ session, active, onClick }: { session: Session; active: boolean; onClick: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1.5,
        py: 1.25,
        cursor: 'pointer',
        bgcolor: active ? 'rgba(254, 44, 85, 0.08)' : 'transparent',
        borderLeft: active ? '2px solid #FE2C55' : '2px solid transparent',
        transition: 'background 0.15s',
        '&:hover': { bgcolor: active ? 'rgba(254, 44, 85, 0.1)' : 'action.hover' },
      }}
    >
      <Box sx={{ position: 'relative', flexShrink: 0 }}>
        <img src={session.avatar || undefined} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
        {session.unread > 0 && (
          <Box sx={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, bgcolor: 'primary.main', color: 'text.primary', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5, border: '2px solid', borderColor: 'background.paper' }}>
            {session.unread > 99 ? '99+' : session.unread}
          </Box>
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
          {session.pinned && <PushPinOutlinedIcon sx={{ fontSize: 10, color: 'text.disabled' }} />}
          <Typography sx={{ fontSize: 13, fontWeight: session.unread > 0 ? 600 : 500, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {session.nickname}
          </Typography>
          {session.isOfficial && <VerifiedIcon sx={{ fontSize: 12, color: 'secondary.main' }} />}
          <Typography sx={{ fontSize: 10, color: 'text.disabled', flexShrink: 0 }}>{session.lastTime}</Typography>
        </Box>
        <Typography sx={{ fontSize: 12, color: session.unread > 0 ? 'text.primary' : 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
          {session.lastMessageType === 'image' ? '[图片]' : session.lastMessageType === 'recall' ? '你撤回了一条消息' : session.lastMessage}
        </Typography>
      </Box>
    </Box>
  );
}

function MessageBubble({ message, avatar, isMine, onRecall }: { message: Message; avatar: string; isMine: boolean; onRecall: () => void }) {
  if (message.type === 'time') {
    return (
      <Box sx={{ alignSelf: 'center', py: 0.5 }}>
        <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{message.content}</Typography>
      </Box>
    );
  }
  if (message.type === 'system') {
    return (
      <Box sx={{ alignSelf: 'center', maxWidth: 480, py: 1.25, px: 2, bgcolor: 'action.hover', borderRadius: 1.5, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.6 }}>{message.content}</Typography>
      </Box>
    );
  }
  if (message.type === 'recall') {
    return (
      <Box sx={{ alignSelf: 'center', py: 0.5 }}>
        <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{message.content}</Typography>
      </Box>
    );
  }
  if (message.type === 'image') {
    return (
      <Box sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: 1, alignItems: 'flex-end' }}>
        {!isMine && <img src={avatar || undefined} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />}
        <Box sx={{ maxWidth: 240, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
          <img src={message.content || undefined} alt="" style={{ width: '100%', display: 'block' }} />
        </Box>
        {isMine && <img src={avatar || undefined} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />}
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: 1, alignItems: 'flex-end' }}>
      {!isMine && <img src={avatar || undefined} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', display: 'block', flexShrink: 0 }} />}
      <Box
        sx={{
          maxWidth: '70%',
          px: 1.75,
          py: 1,
          borderRadius: 2,
          bgcolor: isMine ? 'primary.main' : 'action.hover',
          color: 'text.primary',
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (isMine) onRecall();
        }}
      >
        {message.content}
      </Box>
      {isMine && <img src={avatar || undefined} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', display: 'block', flexShrink: 0 }} />}
    </Box>
  );
}
