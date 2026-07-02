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
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
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
  // 位置: 用 left/top + transform: translate() 做 GPU 加速动画
  // 数字人"在页面上走": 走的过程 transform 平滑过渡
  const [pos, setPos] = React.useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [open, setOpen] = React.useState(true);
  const [autoRotate, setAutoRotate] = React.useState(false);  // 默认不自动转圈, 数字人有自己的 idle 动画
  const [text, setText] = React.useState('');

  // 初始化位置: 右下角 (CSS 用 right/bottom 转为 left/top 计算)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window.innerWidth, h = window.innerHeight
    // 默认 320x520 浮窗, 放右下角
    setPos({ left: Math.max(0, w - 320 - 24), top: Math.max(0, h - 520 - 24) })
  }, [])

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
      const { intent, replyText, emotion: emo, action: act } = await routeIntent(text, {
        availableAgents: availableAgents.map((a) => ({
          id: a.agentId,
          displayName: a.name,
          description: a.role || '',
          tools: [],
        })),
      })

      // LLM 驱动的表情 + 动作: 让数字人有灵性, 不是傻站着
      if (emo) chat.setEmotion(emo)
      if (act) chat.setAction(act)

      if (intent.type === 'switch') {
        setActiveAgent(intent.agentId)
        chat.setText(replyText || `已切换到 ${availableAgents.find((a) => a.agentId === intent.agentId)?.name || intent.agentId}`)
        return
      }
      if (intent.type === 'return') {
        const prev = popAgent()
        if (prev) {
          chat.setText(replyText || `已返回 ${availableAgents.find((a) => a.agentId === app.activeAgentId)?.name || app.activeAgentId}`)
        }
        return
      }
      if (intent.type === 'delegate' || intent.type === 'navigate' || intent.type === 'open_external' || intent.type === 'walk_to' || intent.type === 'system' || intent.type === 'cron' || intent.type === 'query') {
        const res = await executeIntent(intent, { conversationId })
        chat.setText(replyText || res.message)
        return
      }

      // 普通聊天(LLM 返回的 chat intent)
      // 注意: router 返回的 replyText 给数字人朗读, 不需要再发到 /api/avatar/chat
      chat.setText(replyText || '让我想想...')
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

  // ExternalViewer: 监听 executor 的 'digital-human-open-external' 事件,
  // 弹 iframe 模态显示用户想看的外部 URL(百度/知乎等)
  const [externalViewer, setExternalViewer] = React.useState<{ url: string; label: string } | null>(null)
  React.useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ url: string; label: string; mode: string }>).detail
      if (!detail) return
      setExternalViewer({ url: detail.url, label: detail.label })
    }
    window.addEventListener('digital-human-open-external', onOpen)
    return () => window.removeEventListener('digital-human-open-external', onOpen)
  }, [])

  // 走路时播 walk 动作, 走完回 idle
  React.useEffect(() => {
    const onWalk = () => {
      chat.setAction('walk')
      setTimeout(() => chat.setAction('idle'), 1800)
    }
    window.addEventListener('digital-human-walk', onWalk)
    return () => window.removeEventListener('digital-human-walk', onWalk)
  }, [chat])

  // 拖动 offset (从当前 left/top 算)
  const onDown = React.useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-drag]')) return;
    dragRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      ox: pos.left,
      oy: pos.top,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setAutoRotate(false);
  }, [pos.left, pos.top]);
  const onMove = React.useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    setPos({
      left: Math.max(0, d.ox + (e.clientX - d.sx)),
      top: Math.max(0, d.oy + (e.clientY - d.sy)),
    });
  }, []);
  const onUp = React.useCallback(() => {
    dragRef.current.active = false;
  }, []);

  // 数字人"走路": 平滑移动到目标坐标
  // duration 默认 1500ms(像正常步速走 200-400px)
  const walkTo = React.useCallback((target: { left: number; top: number }, durationMs = 1500) => {
    if (typeof window === 'undefined') return
    const w = window.innerWidth, h = window.innerHeight
    const maxLeft = Math.max(0, w - 320)  // 浮窗宽 320
    const maxTop = Math.max(0, h - 520)   // 浮窗高 520
    const clamped = {
      left: Math.max(0, Math.min(maxLeft, target.left)),
      top: Math.max(0, Math.min(maxTop, target.top)),
    }
    // 触发动画: 设 CSS transition 后修改位置
    if (wrapRef.current) {
      wrapRef.current.style.transition = `left ${durationMs}ms ease-in-out, top ${durationMs}ms ease-in-out`
    }
    setPos(clamped)
    // 清除 transition(动画完后)
    setTimeout(() => {
      if (wrapRef.current) wrapRef.current.style.transition = ''
    }, durationMs + 50)
  }, [])

  // 暴露 walkTo 到 window (executor 派事件时调)
  React.useEffect(() => {
    (window as any).__qingqiuyueWalkTo = walkTo
    return () => { delete (window as any).__qingqiuyueWalkTo }
  }, [walkTo])

  // ⚠️ 所有 hooks 必须在 early return 前调用 (React Rules of Hooks)

  if (hidden) return null;

  return (
    <Box
      ref={wrapRef}
      sx={{
        position: 'fixed',
        left: `${pos.left}px`,
        top: `${pos.top}px`,
        // transition 在 walkTo() 里动态设(平滑动画), 这里默认无
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

      {/* ExternalViewer: 用户说"打开百度"等 → 弹 iframe 模态显示 */}
      {externalViewer && (
        <Box data-no-drag sx={{
          position: 'fixed', inset: 0, zIndex: 9999,
          bgcolor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          p: { xs: 1, md: 4 },
        }}>
          <Box sx={{
            width: '100%', maxWidth: 1200, height: '100%', maxHeight: 800,
            bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          }}>
            {/* 顶部工具栏 */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 1, p: 1, pl: 2,
              borderBottom: 1, borderColor: 'divider',
              bgcolor: 'grey.100',
            }}>
              <Box sx={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                🌐 {externalViewer.label}
              </Box>
              <IconButton size="small" onClick={() => window.open(externalViewer.url, '_blank', 'noopener,noreferrer')} title="新标签打开">
                <OpenInNewIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => setExternalViewer(null)} title="关闭">
                <CloseRoundedIcon />
              </IconButton>
            </Box>
            {/* iframe 内容 */}
            <Box sx={{ flex: 1, position: 'relative', bgcolor: '#fafafa' }}>
              <iframe
                src={externalViewer.url}
                title={externalViewer.label}
                style={{ width: '100%', height: '100%', border: 'none' }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                referrerPolicy="no-referrer"
              />
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
