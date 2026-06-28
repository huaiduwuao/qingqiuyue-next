'use client';

/**
 * ImmersiveDigitalHuman —— /digital-human 沉浸式全屏页面
 *
 * 统一 VRM 渲染(从 /avatars/character.vrm)+ 共享 useChatAvatar hook
 * 跟 FloatingDigitalHuman 是同一套 chat + TTS + viseme 流程。
 */

import React from 'react';
import {
  Box, IconButton, TextField, Typography, CircularProgress, Chip,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import MicNoneRoundedIcon from '@mui/icons-material/MicNoneRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import { useRouter } from 'next/navigation';
import { alpha } from '@mui/material/styles';
import BlenderAvatar from './BlenderAvatar';
import { useChatAvatar } from './useChatAvatar';

export default function ImmersiveDigitalHuman() {
  const router = useRouter();
  const chat = useChatAvatar();
  const { chatBusy, chatLog, emotion, viseme, action, send, audioRef,
    recording, recordingError, toggleRecording } = chat;

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1, background: '#05060B' }}>
      {/* 全屏 VRM 角色(与浮窗同一个 character.vrm) */}
      <BlenderAvatar
        modelUrl="/avatars/character.vrm"
        currentAction={action}
        emotion={emotion}
        viseme={viseme}
        autoRotate
        sx={{ position: 'absolute', inset: 0 }}
      />

      {/* 顶部:退出按钮 */}
      <IconButton
        onClick={() => router.back()}
        size="medium"
        aria-label="退出"
        sx={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 3,
          color: 'rgba(255,255,255,0.85)',
          bgcolor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
        }}
      >
        <CloseRoundedIcon />
      </IconButton>

      {/* 底部:聊天输入 + 记录 */}
      <Box sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 3,
        p: 2,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
      }}>
        {chatLog.length > 0 && (
          <Box sx={{
            maxHeight: 140,
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.45)',
            borderRadius: 1,
            p: 1,
            backdropFilter: 'blur(8px)',
          }}>
            {chatLog.slice(-4).map((m, i) => (
              <Typography
                key={i}
                sx={{
                  fontSize: 13,
                  color: m.who === 'user' ? '#a0c4ff' : '#fff',
                  mb: 0.5,
                  wordBreak: 'break-word',
                }}
              >
                <strong>{m.who === 'user' ? '我' : 'AI'}:</strong> {m.text}
              </Typography>
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', maxWidth: 900, mx: 'auto', width: '100%' }}>
          <TextField
            fullWidth
            placeholder={recording ? '正在录音…点麦克风停止' : '跟数字人说点什么…'}
            value={chat.text}
            onChange={(e) => chat.setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), chat.send())}
            disabled={chatBusy || recording}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(8px)',
                '& fieldset': { borderColor: recording ? '#ff5252' : 'rgba(255,255,255,0.2)' },
              },
              '& .MuiOutlinedInput-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
            }}
          />
          <IconButton
            size="large"
            disabled={chatBusy}
            onClick={toggleRecording}
            sx={{
              bgcolor: recording ? '#ff5252' : (t) => alpha(t.palette.common.white, 0.1),
              color: recording ? 'white' : 'rgba(255,255,255,0.7)',
              '&:hover': { bgcolor: recording ? '#ff1744' : (t) => alpha(t.palette.common.white, 0.2) },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
            }}
          >
            {recording ? <MicRoundedIcon sx={{ animation: 'pulse 1.2s infinite' }} /> : <MicNoneRoundedIcon />}
          </IconButton>
          <IconButton
            size="large"
            disabled={chatBusy || !chat.text.trim()}
            onClick={chat.send}
            sx={{
              bgcolor: (t) => alpha(t.palette.primary.main, 0.8),
              color: 'white',
              '&:hover': { bgcolor: (t) => t.palette.primary.main },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
            }}
          >
            {chatBusy ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <SendRoundedIcon />}
          </IconButton>
        </Box>
        {recordingError && (
          <Typography sx={{ fontSize: 10, color: 'error.main', mt: 0.5, textAlign: 'center' }}>
            {recordingError}
          </Typography>
        )}
      </Box>

      <audio ref={audioRef} hidden />
    </Box>
  );
}
