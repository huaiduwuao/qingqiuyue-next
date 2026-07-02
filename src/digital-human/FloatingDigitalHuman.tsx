'use client';

/**
 * FloatingDigitalHuman —— 全站右下角二次元浮窗
 *
 * 统一 VRM 渲染(从 /avatars/character.vrm)+ 共享 useChatAvatar hook
 * 跟 ImmersiveDigitalHuman 是同一套 chat + TTS + viseme 流程。
 */

import React from 'react';
import { Box, IconButton, TextField, Typography, CircularProgress, Chip, Collapse } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import MicNoneRoundedIcon from '@mui/icons-material/MicNoneRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { alpha } from '@mui/material/styles';
import { useRouter, usePathname } from 'next/navigation';
import BlenderAvatar from './BlenderAvatar';
import { useChatAvatar } from './useChatAvatar';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { VoiceIndicator, type VoiceIndicatorState } from '@/components/VoiceIndicator';
import { MicTestButton } from '@/components/MicTestButton';
import AIGCBadge from '@/components/AIGCBadge';
import { AgentSelector } from '@/components/hermes/AgentSelector';
import { useApp } from '@/contexts/AppContext';
import { routeIntent } from '@/lib/intent/router';
import { executeIntent } from '@/lib/intent/executor';
import type { VoiceLogEntry } from '@/lib/voice/logger';
import type { HermesAgentItem } from '@/beans/system';

const FIG_W = 320;
const FIG_H = 480;

const HIDE_ON = ['/user/login', '/digital-human'];  // /digital-human 是沉浸式大窗口, 不显示浮窗


export default function FloatingDigitalHuman() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const hidden = HIDE_ON.some((p) => pathname.startsWith(p));

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const [pos, setPos] = React.useState<{ right: number; bottom: number }>({ right: 24, bottom: 24 });
  const [open, setOpen] = React.useState(true);
  const [autoRotate, setAutoRotate] = React.useState(false);  // 默认不自动转圈, 数字人有自己的 idle 动画
  const [text, setText] = React.useState('');

  const app = useApp();
  const { activeAgentId, agentStack, setActiveAgent, popAgent } = app;
  const [availableAgents, setAvailableAgents] = React.useState<HermesAgentItem[]>([]);

  React.useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((data) => {
        const agents = (data.agents || []).map((a: any) => ({
          agentId: a.agentId,
          name: a.name,
          role: a.description || a.agentId,
        })) as HermesAgentItem[];
        setAvailableAgents(agents);
        if (!activeAgentId && agents.length > 0) {
          setActiveAgent(agents[0].agentId);
        }
      })
      .catch((e) => console.error('[FloatingDigitalHuman] 加载 agents 失败:', e));
  }, [activeAgentId, setActiveAgent]);

  const chat = useChatAvatar(activeAgentId || 'digital_human');
  const { chatBusy, chatLog, emotion, viseme, action, send, audioRef,
    cancel, isSpeaking, isAIGenerated } = chat;

  // 语音唤醒词: 文本匹配模式 (ASR 后看文本里是否含 "小月")
  const wakePhrases = React.useMemo(() => ['小月', '清秋月', '清秋'], [])
  // 语音 agent: 一直跑 (点 mic 启动, 启动后无需再点)
  const [voiceEnabled, setVoiceEnabled] = React.useState(false)
  const [voiceLogs, setVoiceLogs] = React.useState<VoiceLogEntry[]>([])
  const [showVoiceLogs, setShowVoiceLogs] = React.useState(false)

  React.useEffect(() => {
    const onLog = (e: Event) => {
      const entry = (e as CustomEvent<VoiceLogEntry>).detail
      if (!entry) return
      setVoiceLogs((prev) => [...prev.slice(-99), entry])
    }
    window.addEventListener('voice-log', onLog)
    return () => window.removeEventListener('voice-log', onLog)
  }, [])

  const voice = useVoiceAgent({
    wakePhrases,
    asrGatewayUrl: typeof window !== 'undefined' ? `${window.location.origin}/api/audio` : '/api/audio',
    onCommand: async (text) => {
      // 数字人正在说? 打断
      if (chat.isSpeaking()) chat.cancel()

      // 意图路由: 切换角色 / 委派任务 / 普通聊天
      const conversationId = app.activeConversationId || 'default'
      const { intent } = await routeIntent(text, {
        availableAgents: availableAgents.map((a) => ({
          id: a.agentId,
          displayName: a.name,
          description: a.role || '',
          tools: [],
        })),
      })

      if (intent.type === 'switch') {
        setActiveAgent(intent.agentId)
        chat.setText(`已切换到 ${availableAgents.find((a) => a.agentId === intent.agentId)?.name || intent.agentId}`)
        return
      }
      if (intent.type === 'return') {
        const prev = popAgent()
        if (prev) {
          chat.setText(`已返回 ${availableAgents.find((a) => a.agentId === app.activeAgentId)?.name || app.activeAgentId}`)
        }
        return
      }
      if (intent.type === 'delegate' || intent.type === 'navigate' || intent.type === 'system' || intent.type === 'cron' || intent.type === 'query') {
        const res = await executeIntent(intent, { conversationId })
        chat.setText(res.message)
        return
      }

      // 普通聊天
      await chat.sendText(text)
    },
    isAvatarSpeaking: () => chat.isSpeaking(),
    onInterrupt: () => chat.cancel(),
  })
  // 启动/停止 (点 mic 切换)
  React.useEffect(() => {
    if (voiceEnabled) voice.start()
    else voice.stop()
  }, [voiceEnabled])

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
    // 不恢复 autoRotate — 数字人有自己的 idle 动画, 用户拖完保持静止
  }, []);

  // ⚠️ 所有 hooks 必须在 early return 前调用 (React Rules of Hooks)

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
        {/* AIGC 合规角标:贴数字人画布左上,只遮住一小块,符合网信办最小可见标识要求 */}
        {isAIGenerated && <AIGCBadge variant="overlay" top={6} left={6} />}
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
        <MicTestButton />
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
        <AgentSelector
          activeAgentId={activeAgentId}
          agentStack={agentStack}
          availableAgents={availableAgents}
          onSwitch={(id) => {
            setActiveAgent(id);
            chat.setText('');
          }}
          onReturn={() => popAgent()}
          size="small"
        />

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
            placeholder={voiceEnabled ? (voice.state === 'recording' ? '我在听...' : '说"小月"唤醒') : '跟数字人说点什么…'}
            value={chat.text}
            onChange={(e) => chat.setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), chat.send())}
            disabled={chatBusy}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                fontSize: 12,
                bgcolor: 'rgba(255,255,255,0.08)',
                '& fieldset': { borderColor: voiceEnabled ? (voice.state === 'recording' ? '#3b82f6' : '#a855f7') : 'rgba(255,255,255,0.2)' },
              },
              '& .MuiOutlinedInput-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
            }}
          />
          <IconButton
            size="small"
            data-no-drag
            onClick={(e) => {
              e.stopPropagation();
              setVoiceEnabled(v => {
                const newVal = !v
                // 直接在 click handler 里调 (保留 user gesture 上下文)
                // 否则 useEffect 异步触发时, AudioContext 会被浏览器 suspended
                if (newVal) voice.start()
                else voice.stop()
                return newVal
              })
            }}
            sx={{
              bgcolor: voiceEnabled ? '#a855f7' : (t) => alpha(t.palette.common.white, 0.1),
              color: voiceEnabled ? 'white' : 'rgba(255,255,255,0.7)',
              '&:hover': { bgcolor: voiceEnabled ? '#9333ea' : (t) => alpha(t.palette.common.white, 0.2) },
            }}
          >
            <MicRoundedIcon sx={{
              fontSize: 18,
              animation: voiceEnabled ? 'pulse 1.2s infinite' : 'none',
            }} />
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
        {voice.error && (
          <Typography sx={{ fontSize: 9, color: 'error.main', mt: 0.5 }}>
            {voice.error}
          </Typography>
        )}

        {/* 语音调试日志面板 */}
        {voiceLogs.length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            <Box
              data-no-drag
              onClick={(e) => { e.stopPropagation(); setShowVoiceLogs(v => !v) }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                bgcolor: 'rgba(255,255,255,0.08)',
                borderRadius: 1,
                px: 0.75,
                py: 0.25,
              }}
            >
              <Typography variant="caption" sx={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                语音日志 ({voiceLogs.length})
              </Typography>
              <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.6)', p: 0.25 }}>
                {showVoiceLogs ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Box>
            <Collapse in={showVoiceLogs}>
              <Box sx={{
                mt: 0.5,
                maxHeight: 120,
                overflowY: 'auto',
                bgcolor: 'rgba(0,0,0,0.6)',
                borderRadius: 1,
                p: 0.75,
                fontFamily: 'monospace',
                fontSize: 9,
              }}>
                {voiceLogs.slice(-30).map((log, i) => (
                  <Box key={i} sx={{
                    color: log.level === 'error' ? '#fca5a5' : log.level === 'warn' ? '#fcd34d' : 'rgba(255,255,255,0.85)',
                    mb: 0.25,
                    wordBreak: 'break-word',
                    lineHeight: 1.3,
                  }}>
                    <span style={{ opacity: 0.5 }}>{new Date(log.ts).toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>{' '}
                    [{log.tag}] {log.message}
                  </Box>
                ))}
              </Box>
            </Collapse>
          </Box>
        )}
      </Box>

      <audio ref={audioRef} hidden />

      {/* 语音指示器 (浮窗顶部, 一直显示状态) */}
      <Box data-no-drag sx={{
        position: 'absolute',
        top: 4, right: 36, zIndex: 3,
        pointerEvents: 'none',
      }}>
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
      </Box>
    </Box>
  );
}
