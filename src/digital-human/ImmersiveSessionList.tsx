'use client';

/**
 * /digital-human 左侧会话列表(可折叠)。从 ImmersiveDigitalHuman.tsx 拆出,JSX 原样搬。
 * 故意不 memo:「刚刚 / N分钟前」靠父组件的常规重渲染刷新,memo 了会停在旧值。
 */
import React from 'react';
import { Box, Button, IconButton, ListItemButton, ListItemText, Typography } from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import type { ConversationItem } from './useConversationHistory';
import { relativeTime } from './immersiveUtils';
import { ConversationCheckpoints } from './ConversationCheckpoints';

export function ImmersiveSessionList({
  open,
  mounted,
  history,
  historyLoading,
  historyError,
  sessionError,
  creatingSession,
  conversationId,
  onNew,
  onRetry,
  onOpen,
  onCheckpointRestored,
}: {
  open: boolean;
  mounted: boolean;
  history: ConversationItem[];
  historyLoading: boolean;
  historyError: string | null;
  sessionError: string | null;
  creatingSession: boolean;
  conversationId: string | null;
  onNew: () => void;
  onRetry: () => void;
  onOpen: (cid: string) => void;
  /** 回到存档后分叉出的新会话 */
  onCheckpointRestored: (cid: string) => void;
}) {
  return (
    <Box sx={{
      position: 'absolute',
      // 让出顶部的退出/模型/会话按钮;底部让出聊天区(高 40vh,最多 400px)
      top: 'calc(64px + var(--sat, 0px))',
      left: { xs: 12, sm: 16 },
      width: { xs: 'calc(100vw - 24px)', sm: 260 },
      maxWidth: 260,
      maxHeight: 'calc(100vh - min(40vh, 400px) - 80px)',
      zIndex: 3,
      background: 'rgba(0,0,0,0.5)',
      borderRadius: 2,
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      display: open ? 'flex' : 'none',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
          会话
          <Box component="span" sx={{ ml: 0.75, fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>
            {mounted ? history.length : ''}
          </Box>
        </Typography>
        <Button size="small" disabled={creatingSession} onClick={onNew} sx={{ fontSize: 11, color: '#25F4EE', textTransform: 'none' }}>
          {creatingSession ? '创建中…' : '+ 新会话'}
        </Button>
      </Box>
      {(sessionError || historyError) && (
        <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography role="alert" sx={{ fontSize: 11, color: '#ff8a80', flex: 1 }}>
            {sessionError || `会话列表加载失败:${historyError}`}
          </Typography>
          <IconButton size="small" aria-label="重新加载会话" onClick={onRetry} sx={{ color: 'rgba(255,255,255,0.6)', p: 0.25 }}>
            <RefreshRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        {!mounted || (historyLoading && history.length === 0) ? (
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', p: 2, textAlign: 'center' }}>
            加载中…
          </Typography>
        ) : history.length === 0 ? (
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', p: 2, textAlign: 'center' }}>
            还没有会话,直接提问或点「新会话」开始
          </Typography>
        ) : (
          history.map((h) => {
            const isCurrent = conversationId === h.id;
            const timeStr = relativeTime(h.lastMessageAt || h.createTime);
            return (
            <ListItemButton
              key={h.id}
              selected={isCurrent}
              onClick={() => onOpen(h.id)}
              sx={{
                py: 1,
                px: 1.5,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                borderLeft: isCurrent ? '2px solid #25F4EE' : '2px solid transparent',
                '&.Mui-selected': { bgcolor: 'rgba(37,244,238,0.15)' },
              }}
            >
              <ListItemText
                primary={
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {h.title}
                    </Box>
                    {isCurrent && (
                      <Box component="span" sx={{ fontSize: 9, color: '#25F4EE', flexShrink: 0, border: '1px solid rgba(37,244,238,0.5)', borderRadius: 0.5, px: 0.5, lineHeight: 1.6 }}>
                        当前
                      </Box>
                    )}
                  </Box>
                }
                secondary={timeStr}
                slotProps={{
                  primary: { sx: { fontSize: 12, color: '#fff' }, component: 'div' },
                  secondary: { sx: { fontSize: 10, color: 'rgba(255,255,255,0.35)' } },
                }}
              />
            </ListItemButton>
            );
          })
        )}
      </Box>
      {mounted && <ConversationCheckpoints conversationId={conversationId} onRestored={onCheckpointRestored} />}
    </Box>
  );
}
