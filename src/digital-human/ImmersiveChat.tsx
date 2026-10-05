'use client';

/**
 * /digital-human 底部聊天区的两块:消息列表(含思考面板)和输入区(形象 / 背景 / 数字员工选择 + 输入框 + 麦克风 + 发送)。
 * 从 ImmersiveDigitalHuman.tsx 拆出,JSX 原样搬。
 */
import React from 'react';
import { Box, CircularProgress, IconButton, TextField, Typography } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import { ToolCallCard, ThoughtBubble } from './scene-ui/ChatOpsEntry';
import ChatRichItem, { isRichItem } from './scene-ui/ChatRichItem';
import type { ChatLogItem } from './useChatAvatar';
import type { AvatarMode, GsAssetItem } from './immersiveUtils';

export const ChatMessageList = React.memo(function ChatMessageList({
  thinkingLog,
  chatLog,
  chatBusy,
  lastChoicesIndex,
  mounted,
  conversationId,
  scrollRef,
  onSend,
  onOpen,
}: {
  thinkingLog: string;
  chatLog: ChatLogItem[];
  chatBusy: boolean;
  lastChoicesIndex: number;
  mounted: boolean;
  conversationId: string | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSend: (text: string) => void;
  onOpen: (href: string) => void;
}) {
  return (
    <>
      {/* 思考面板 */}
      {thinkingLog && (
        <Box sx={{
          mx: 2,
          mb: 1,
          p: 1.5,
          background: 'rgba(100,100,255,0.12)',
          borderRadius: 2,
          border: '1px solid rgba(100,100,255,0.25)',
        }}>
          <Typography sx={{ fontSize: 12, color: 'rgba(200,200,255,0.95)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
            💭 {thinkingLog.replace(/<think>|<\/think>/g, '').trim()}
          </Typography>
        </Box>
      )}

      {/* 聊天消息区 */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 2,
          pb: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {chatLog.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', mt: 4 }}>
            {mounted ? (conversationId ? '这个会话还没有消息，说点什么开始吧~' : '发条消息创建新会话吧~') : '加载中…'}
          </Typography>
        ) : (
          chatLog.map((m, i) => (
            m.who === 'tool' && m.tool ? (
              <ToolCallCard key={m.tool.id || i} entry={m.tool} />
            ) : m.who === 'thought' ? (
              <ThoughtBubble key={`t-${i}`} text={m.text} />
            ) : m.who === 'cards' || m.who === 'choices' ? (
              isRichItem(m) ? (
                <ChatRichItem
                  key={`r-${i}`}
                  item={m}
                  active={!chatBusy && i === lastChoicesIndex}
                  onSend={onSend}
                  onOpen={onOpen}
                />
              ) : null
            ) : (
            <Box
              key={i}
              sx={{
                alignSelf: m.who === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: { xs: '86%', md: '70%' },
                p: 1.5,
                borderRadius: m.who === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.who === 'user' ? 'rgba(37,244,238,0.2)' : 'rgba(255,255,255,0.12)',
                border: m.who === 'user' ? '1px solid rgba(37,244,238,0.3)' : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Typography sx={{ fontSize: 13, color: '#fff', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {m.text}
              </Typography>
            </Box>
            )
          ))
        )}
        {/* AI 思考中 */}
        {chatBusy && (
          <Box sx={{ alignSelf: 'flex-start', p: 1.5, borderRadius: '16px 16px 16px 4px', background: 'rgba(255,255,255,0.1)' }}>
            <CircularProgress size={16} sx={{ color: 'rgba(255,255,255,0.7)' }} />
          </Box>
        )}
      </Box>
    </>
  );
});

const SELECT_STYLE = { background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '8px 6px', fontSize: 12 } as const;

export const ChatInputBar = React.memo(function ChatInputBar({
  narrow,
  avatarMode,
  onAvatarMode,
  gsAssets,
  clipsProblem,
  gsBackdrop,
  onGsBackdrop,
  gsAsset,
  onGsAsset,
  aguiAgent,
  onAguiAgent,
  staffList,
  voiceEnabled,
  voiceState,
  text,
  onText,
  onSend,
  chatBusy,
  onMicClick,
}: {
  narrow: boolean;
  avatarMode: AvatarMode;
  onAvatarMode: (m: AvatarMode) => void;
  gsAssets: GsAssetItem[];
  clipsProblem: string | null;
  gsBackdrop: string;
  onGsBackdrop: (v: string) => void;
  gsAsset: string;
  onGsAsset: (v: string) => void;
  aguiAgent: string;
  onAguiAgent: (v: string) => void;
  staffList: { agentId: string; name: string; description: string }[];
  voiceEnabled: boolean;
  voiceState: string;
  text: string;
  onText: (v: string) => void;
  onSend: () => void;
  chatBusy: boolean;
  onMicClick: (e: React.MouseEvent) => void;
}) {
  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, pb: 'calc(16px + var(--sab, 0px))', display: 'flex', flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: 1, alignItems: 'center' }}>
      {/* 形象 / 背景 / 数字员工:手机上独占一行(以前和输入框挤一行,输入框被挤成一条缝) */}
      <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', md: 'auto' }, minWidth: 0, flexShrink: 0, '& select': { flex: { xs: '1 1 0', md: '0 0 auto' }, minWidth: 0 } }}>
      <select
        aria-label="形象"
        title="形象:VRM 骨骼模型 / 3DGS 高斯资产 / 2D 片段"
        value={avatarMode}
        onChange={(e) => onAvatarMode(e.target.value as AvatarMode)}
        style={{ ...SELECT_STYLE, maxWidth: narrow ? undefined : 96 }}
      >
        <option value="vrm">VRM</option>
        <option value="3dgs" disabled={gsAssets.length === 0}>3DGS{gsAssets.length === 0 ? '(无资产)' : ''}</option>
        <option value="2d" disabled={!!clipsProblem} title={clipsProblem || ''}>2D{clipsProblem ? '(无片段)' : ''}</option>
      </select>
      {avatarMode === 'vrm' && gsAssets.length > 0 && (
        <select
          aria-label="背景"
          title="背景:场景预设,或用一份 3DGS 场景资产垫在角色后面"
          value={gsBackdrop}
          onChange={(e) => onGsBackdrop(e.target.value)}
          style={{ ...SELECT_STYLE, maxWidth: narrow ? undefined : 110 }}
        >
          <option value="">预设场景</option>
          {gsAssets.map((a) => <option key={a.id} value={a.assetUrl}>GS · {a.name}</option>)}
        </select>
      )}
      {avatarMode === '3dgs' && gsAssets.length > 1 && (
        <select aria-label="3DGS 资产" value={gsAsset} onChange={(e) => onGsAsset(e.target.value)} style={{ ...SELECT_STYLE, maxWidth: narrow ? undefined : 110 }}>
          {gsAssets.map((a) => <option key={a.id} value={a.assetUrl}>{a.name}</option>)}
        </select>
      )}
      <select
        aria-label="数字员工"
        value={aguiAgent}
        onChange={(e) => onAguiAgent(e.target.value)}
        style={{ ...SELECT_STYLE, maxWidth: narrow ? undefined : 120 }}
      >
        {(staffList.length ? staffList : [{ agentId: 'worker', name: '全能数字员工', description: '' }]).map((st) => (
          <option key={st.agentId} value={st.agentId}>{st.name}</option>
        ))}
      </select>
      </Box>
      <TextField
        fullWidth
        placeholder={voiceEnabled ? (voiceState === 'recording' ? '我在听…' : '说"小月"唤醒') : '跟数字人说点什么…'}
        value={text}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onSend())}
        disabled={chatBusy}
        size="small"
        sx={{
          flex: 1,
          minWidth: 0,
          width: 'auto',
          '& .MuiOutlinedInput-root': {
            color: 'white',
            bgcolor: 'rgba(255,255,255,0.1)',
            borderRadius: 2,
            '& fieldset': { borderColor: voiceEnabled ? (voiceState === 'recording' ? '#3b82f6' : '#a855f7') : 'rgba(255,255,255,0.2)' },
          },
          '& .MuiOutlinedInput-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
        }}
      />
      <IconButton
        onClick={onMicClick}
        sx={{
          bgcolor: voiceEnabled ? '#a855f7' : 'rgba(255,255,255,0.1)',
          color: voiceEnabled ? 'white' : 'rgba(255,255,255,0.7)',
          '&:hover': { bgcolor: voiceEnabled ? '#9333ea' : 'rgba(255,255,255,0.2)' },
        }}
      >
        <MicRoundedIcon sx={{ fontSize: 22, animation: voiceEnabled ? 'pulse 1.2s infinite' : 'none' }} />
      </IconButton>
      <IconButton
        onClick={onSend}
        disabled={chatBusy || !text.trim()}
        sx={{
          bgcolor: 'rgba(37,244,238,0.2)',
          color: '#25F4EE',
          '&:hover': { bgcolor: 'rgba(37,244,238,0.3)' },
          '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.05)' },
        }}
      >
        {chatBusy ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <SendRoundedIcon />}
      </IconButton>
    </Box>
  );
});
