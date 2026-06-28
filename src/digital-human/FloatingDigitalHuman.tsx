'use client';

/**
 * FloatingDigitalHuman —— 全站右下角二次元浮窗
 *
 * 统一 VRM 渲染(从 /avatars/character.vrm)+ 共享 useChatAvatar hook
 * 跟 ImmersiveDigitalHuman 是同一套 chat + TTS + viseme 流程。
 */

import React from 'react';
import { Box, IconButton, TextField, Typography, CircularProgress, Chip } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import MicNoneRoundedIcon from '@mui/icons-material/MicNoneRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import { alpha } from '@mui/material/styles';
import { useRouter, usePathname } from 'next/navigation';
import BlenderAvatar from './BlenderAvatar';
import { useChatAvatar } from './useChatAvatar';

const FIG_W = 320;
const FIG_H = 480;

const HIDE_ON = ['/user/login', '/digital-human'];


export default function FloatingDigitalHuman() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const hidden = HIDE_ON.some((p) => pathname.startsWith(p));

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const [pos, setPos] = React.useState<{ right: number; bottom: number }>({ right: 24, bottom: 24 });
  const [open, setOpen] = React.useState(true);
  const [autoRotate, setAutoRotate] = React.useState(true);
  const [text, setText] = React.useState('');
  const chat = useChatAvatar();
  const { chatBusy, chatLog, emotion, viseme, action, send, audioRef,
    recording, recordingError, toggleRecording } = chat;

  // 注意:必须在所有 hook 之后才能 return null,否则 React Rules of Hooks 报错
  // "Rendered fewer hooks than expected"(pathname 切换时 hidden 翻转会导致
  // 下方的 useEffect 被跳过,hook 数量变化 → 崩)

  const onDown = React.useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-drag]')) return;
    dragRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      ox: pos.right,
      oy: pos.bottom,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setAutoRotate(false);
  }, [pos.right, pos.bottom]);
  const onMove = React.useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    setPos({
      right: Math.max(0, d.ox + (d.sx - e.clientX)),
      bottom: Math.max(0, d.oy + (d.sy - e.clientY)),
    });
  }, []);
  const onUp = React.useCallback(() => {
    dragRef.current.active = false;
    setTimeout(() => setAutoRotate(true), 1500);
  }, []);

  if (hidden) return null;

  return (
    <Box
      ref={wrapRef}
      sx={{
        position: 'fixed',
        right: `${pos.right}px`,
        bottom: `${pos.bottom}px`,
        width: FIG_W,
        height: FIG_H,
        borderRadius: 3,
        overflow: 'hidden',
        cursor: 'grab',
        touchAction: 'none',
        boxShadow: (t) => `0 8px 32px ${alpha(t.palette.common.black, 0.5)}`,
        border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.32)}`,
        background: '#05060B',
        zIndex: 1500,
        display: 'flex',
        flexDirection: 'column',
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* 数字人本体 */}
      <Box sx={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        '& canvas': { width: '100% !important', height: '100% !important' },
      }}>
        <BlenderAvatar
          modelUrl="/avatars/character.vrm"
          currentAction={action}
          emotion={emotion}
          viseme={viseme}
          autoRotate={autoRotate}
          sx={{ borderRadius: 0 }}
        />
      </Box>

      {/* 顶部按钮组 */}
      <Box data-no-drag sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        p: 0.75,
        display: 'flex',
        gap: 0.5,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
        zIndex: 2,
      }}>
        <IconButton
          size="small"
          aria-label="全屏"
          onClick={(e) => {
            e.stopPropagation();
            router.push('/digital-human');
          }}
          sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(0,0,0,0.4)' }}
        >
          <OpenInFullRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <IconButton
          size="small"
          aria-label="关闭"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
          sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(0,0,0,0.4)' }}
        >
          <CloseRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      {/* 底部:聊天输入 + 记录 */}
      <Box data-no-drag sx={{
        p: 1,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
      }}>
        {/* 聊天记录(最近 2 条) */}
        {chatLog.length > 0 && (
          <Box sx={{
            maxHeight: 80,
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.5)',
            borderRadius: 1,
            p: 0.75,
          }}>
            {chatLog.slice(-2).map((m, i) => (
              <Typography
                key={i}
                sx={{
                  fontSize: 10.5,
                  color: m.who === 'user' ? '#a0c4ff' : '#fff',
                  mb: 0.25,
                  wordBreak: 'break-word',
                }}
              >
                <strong>{m.who === 'user' ? '我' : 'AI'}:</strong> {m.text}
              </Typography>
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <TextField
            size="small"
            fullWidth
            placeholder={recording ? '正在录音…' : '跟数字人说点什么…'}
            value={chat.text}
            onChange={(e) => chat.setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), chat.send())}
            disabled={chatBusy || recording}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                fontSize: 12,
                bgcolor: 'rgba(255,255,255,0.08)',
                '& fieldset': { borderColor: recording ? '#ff5252' : 'rgba(255,255,255,0.2)' },
              },
              '& .MuiOutlinedInput-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
            }}
          />
          <IconButton
            size="small"
            data-no-drag
            disabled={chatBusy}
            onClick={(e) => {
              e.stopPropagation();
              toggleRecording();
            }}
            sx={{
              bgcolor: recording ? '#ff5252' : (t) => alpha(t.palette.common.white, 0.1),
              color: recording ? 'white' : 'rgba(255,255,255,0.7)',
              '&:hover': { bgcolor: recording ? '#ff1744' : (t) => alpha(t.palette.common.white, 0.2) },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
            }}
          >
            {recording ? <MicRoundedIcon sx={{ fontSize: 18, animation: 'pulse 1.2s infinite' }} /> : <MicNoneRoundedIcon sx={{ fontSize: 16 }} />}
          </IconButton>
          <IconButton
            size="small"
            data-no-drag
            disabled={chatBusy || !chat.text.trim()}
            onClick={(e) => {
              e.stopPropagation();
              chat.send();
            }}
            sx={{
              bgcolor: (t) => alpha(t.palette.primary.main, 0.8),
              color: 'white',
              '&:hover': { bgcolor: (t) => t.palette.primary.main },
              '&.Mui-disabled': { color: 'rgba(255,255,255,0.3)' },
            }}
          >
            {chatBusy ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <SendRoundedIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Box>
        {recordingError && (
          <Typography sx={{ fontSize: 9, color: 'error.main', mt: 0.5 }}>
            {recordingError}
          </Typography>
        )}
      </Box>

      <audio ref={audioRef} hidden />
    </Box>
  );
}
