'use client';

/**
 * ImmersiveDigitalHuman —— /digital-human 沉浸式全屏页面
 *
 * 统一 VRM 渲染(从 /avatars/character.vrm)+ 共享 useChatAvatar hook
 * 跟 FloatingDigitalHuman 是同一套 chat + TTS + viseme 流程。
 */

import React from 'react';
import { Box, IconButton, TextField, Typography, CircularProgress } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import { useRouter } from 'next/navigation';
import { alpha } from '@mui/material/styles';
import BlenderAvatar from './BlenderAvatar';
import { useChatAvatar } from './useChatAvatar';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { VoiceIndicator, type VoiceIndicatorState } from '@/components/VoiceIndicator';
import { useThemeMode } from '@/contexts/ThemeContext';
import { logout } from '@/apis/user';

export default function ImmersiveDigitalHuman() {
  const router = useRouter();
  const { setTheme } = useThemeMode();
  const chat = useChatAvatar();
  const { chatBusy, chatLog, emotion, viseme, action, send, sendText, audioRef,
    text, setText } = chat;

  // system 意图: 音量/主题/全屏/刷新/登出等实际浏览器操作
  const preMuteVolumeRef = React.useRef<number | null>(null)
  React.useEffect(() => {
    const applySystem = (e: Event) => {
      const detail = (e as CustomEvent<import('@/lib/intent/types').Intent>).detail
      if (!detail || detail.type !== 'system') return
      const { action: sysAction, params } = detail
      const audio = audioRef.current

      switch (sysAction) {
        case 'volume-up': {
          if (audio) audio.volume = Math.min(1, (audio.volume || 0.5) + 0.1)
          break
        }
        case 'volume-down': {
          if (audio) audio.volume = Math.max(0, (audio.volume || 0.5) - 0.1)
          break
        }
        case 'volume-set': {
          const level = typeof params?.level === 'number' ? params.level : Number(params?.level)
          if (audio && !Number.isNaN(level)) audio.volume = Math.max(0, Math.min(1, level))
          break
        }
        case 'mute': {
          if (audio) {
            preMuteVolumeRef.current = audio.volume
            audio.volume = 0
          }
          break
        }
        case 'unmute': {
          if (audio) {
            const restored = preMuteVolumeRef.current ?? 0.5
            audio.volume = restored > 0 ? restored : 0.5
          }
          break
        }
        case 'theme-light':
          setTheme('light')
          break
        case 'theme-dark':
          setTheme('dark')
          break
        case 'fullscreen-on': {
          const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> }
          el.requestFullscreen?.().catch(() => {})
          break
        }
        case 'fullscreen-off': {
          const d = document as Document & { exitFullscreen?: () => Promise<void> }
          d.exitFullscreen?.().catch(() => {})
          break
        }
        case 'reload':
          window.location.reload()
          break
        case 'logout': {
          logout().catch(() => {}).finally(() => {
            router.push('/user/login')
          })
          break
        }
        default:
          break
      }
    }
    window.addEventListener('digital-human-system', applySystem)
    return () => window.removeEventListener('digital-human-system', applySystem)
  }, [audioRef, router, setTheme])

  // 语音唤醒: 点 mic 一次 → 一直监听 (说"小月"+ 命令 → barge-in 打断)
  const wakePhrases = React.useMemo(() => ['小月', '清秋月', '清秋'], [])
  const [voiceEnabled, setVoiceEnabled] = React.useState(false)
  const voice = useVoiceAgent({
    wakePhrases,
    asrGatewayUrl: typeof window !== 'undefined' ? `${window.location.origin}/api/audio` : '/api/audio',
    onCommand: async (text) => {
      if (chat.isSpeaking()) chat.cancel()
      await sendText(text)
    },
    isAvatarSpeaking: () => chat.isSpeaking(),
    onInterrupt: () => chat.cancel(),
  })

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1, background: '#05060B' }}>
      {/* 全屏 VRM 角色(与浮窗同一个 character.vrm) */}
      <BlenderAvatar
        modelUrl="/avatars/character.vrm"
        currentAction={action}
        emotion={emotion}
        viseme={viseme}
        autoRotate={false}
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
            placeholder={voiceEnabled ? (voice.state === 'recording' ? '我在听…' : '说"小月"唤醒') : '跟数字人说点什么…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            disabled={chatBusy}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(8px)',
                '& fieldset': { borderColor: voiceEnabled ? (voice.state === 'recording' ? '#3b82f6' : '#a855f7') : 'rgba(255,255,255,0.2)' },
              },
              '& .MuiOutlinedInput-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
            }}
          />
          <IconButton
            size="large"
            onClick={(e) => {
              e.stopPropagation();
              setVoiceEnabled(v => {
                const newVal = !v;
                // 直接在 click 里调 (保留 user gesture 上下文, AudioContext 才能创建)
                if (newVal) voice.start();
                else voice.stop();
                return newVal;
              });
            }}
            sx={{
              bgcolor: voiceEnabled ? '#a855f7' : (t) => alpha(t.palette.common.white, 0.1),
              color: voiceEnabled ? 'white' : 'rgba(255,255,255,0.7)',
              '&:hover': { bgcolor: voiceEnabled ? '#9333ea' : (t) => alpha(t.palette.common.white, 0.2) },
            }}
          >
            <MicRoundedIcon sx={{ fontSize: 26, animation: voiceEnabled ? 'pulse 1.2s infinite' : 'none' }} />
          </IconButton>
          <IconButton
            size="large"
            disabled={chatBusy || !text.trim()}
            onClick={send}
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
        {voice.error && (
          <Typography sx={{ fontSize: 10, color: 'error.main', mt: 0.5, textAlign: 'center' }}>
            {voice.error}
          </Typography>
        )}
      </Box>

      {voiceEnabled && (
        <VoiceIndicator
          state={voice.state as VoiceIndicatorState}
          transcript={voice.transcript}
          wakeWord={voice.wakeWord}
          error={voice.error}
          position="top-right"
          showTranscript
        />
      )}

      <audio ref={audioRef} hidden />
    </Box>
  );
}
