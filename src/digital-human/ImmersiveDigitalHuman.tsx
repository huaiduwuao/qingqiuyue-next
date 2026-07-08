'use client';

/**
 * ImmersiveDigitalHuman —— /digital-human 沉浸式全屏页面
 *
 * 2026-07 升级：用 VrmStage 替代 BlenderAvatar。
 *   - 全身取景（camera 0,1.1,4.5 FOV 30）
 *   - 5 个场景预设、6 个相机视角预设
 *   - 12 表情滑杆 + 10 情绪 chip + 6 姿势 chip
 *   - 保留 chat / voice / wake-up / system 全部功能
 *   - 兼容 useChatAvatarWS（emotion/viseme/action 直传）
 *   - 通过 VrmStageHandle 暴露 sinks，给 V2 sinks 模式或
 *     未来从 chat WS 解析 tool_calls 预留入口
 */

import React from 'react';
import { Box, IconButton, TextField, Typography, CircularProgress } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { useRouter } from 'next/navigation';
import { alpha } from '@mui/material/styles';
import { VrmStage, type VrmStageHandle } from './VrmStage';
import { useChatAvatarWS } from './useChatAvatarWS';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { VoiceIndicator, type VoiceIndicatorState } from '@/components/VoiceIndicator';
import { useThemeMode } from '@/contexts/ThemeContext';
import { logout } from '@/apis/user';
import VrmControlPanel from '@/components/digital-human/VrmControlPanel';
import VrmEmotionChips from '@/components/digital-human/VrmEmotionChips';
import VrmPoseChips from '@/components/digital-human/VrmPoseChips';
import type { ScenePresetName, CameraPresetName, DanceStyle } from './vrm/types';

// ── 调试：排查 runtime.lastError 来源 ──
// 操作步骤:
//   1. 打开 http://localhost:3000/digital-human
//   2. 先记下控制台错误出现频率
//   3. 按 1 → 刷新页面 → 看错误是否停止 (排除 Three.js)
//   4. 按 2 → 刷新页面 → 点麦克风 → 看错误是否出现 (排除 VAD)
//   5. 按 3 → 刷新页面 → 点麦克风 → 看错误是否出现 (排除 ONNX wake-word)
//   "开关状态" 会打印在控制台，切换后需手动刷新页面生效
//   按 0 清除所有开关
const STORAGE_KEY = 'dh_debug_flags';
const loadFlags = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
};
const saveFlags = (f: Record<string, boolean>) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  console.log('[debug] flags saved:', f, '(刷新页面生效)');
};
if (typeof window !== 'undefined') {
  const flags = loadFlags();
  (window as any).__DIGITAL_HUMAN_DEBUG = { noThree: !!flags.noThree, noVoice: !!flags.noVoice, noWake: !!flags.noWake };
  console.log('[debug] current flags:', (window as any).__DIGITAL_HUMAN_DEBUG, '| 按 1/2/3 切换, 0 清除, 需刷新生效');

  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; // 不在输入框里触发
    const f = loadFlags();
    switch (e.key) {
      case '1': f.noThree = !f.noThree; saveFlags(f); break;
      case '2': f.noVoice = !f.noVoice; saveFlags(f); break;
      case '3': f.noWake  = !f.noWake;  saveFlags(f); break;
      case '0': localStorage.removeItem(STORAGE_KEY); console.log('[debug] all flags cleared'); break;
    }
  });

  // 每 2 秒采样一次，统计 rAF / audio 帧率
  let rAFCount = 0, audioFrameCount = 0;
  const origRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb: FrameRequestCallback) => origRAF(() => { rAFCount++; cb(performance.now()); });
  const timer = setInterval(() => {
    if (rAFCount > 0 || audioFrameCount > 0) {
      console.log(`[debug] rAF=${rAFCount}/2s (~${Math.round(rAFCount/2)}fps) audioFrame=${audioFrameCount}/2s`);
      rAFCount = 0; audioFrameCount = 0;
    }
  }, 2000);
  (window as any).__DEBUG_audioFrameInc = () => { audioFrameCount++; };
}

export default function ImmersiveDigitalHuman() {
  const router = useRouter();
  const { setTheme } = useThemeMode();
  const chat = useChatAvatarWS();
  const { chatBusy, chatLog, emotion, viseme, action, send, sendText, audioRef,
    text, setText } = chat;

  // VrmStage sinks 引用（用 state 而非 ref，避免首次渲染时 ref.current 还没填的坑）
  const [stageHandle, setStageHandle] = React.useState<VrmStageHandle | null>(null);
  // 诊断：监听 stageHandle 变化
  React.useEffect(() => { console.log('[Immersive] stageHandle 变化:', stageHandle); }, [stageHandle]);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [stageState, setStageState] = React.useState({
    dancing: false,
    danceStyle: 'groove' as DanceStyle,
    bpm: 120,
    danceAmp: 1,
    scene: 'concert' as ScenePresetName,
    camera: 'front' as CameraPresetName,
    confetti: false,
    autoBlink: true,
    lookAtCamera: true,
    fov: 30,
    songOn: false,
    micOn: false,
    yOffset: 0,
  });
  const updateStageState = React.useCallback((patch: Partial<typeof stageState>) => {
    setStageState((prev) => ({ ...prev, ...patch }));
  }, []);

  // 把 UI state 推到 VrmStage.handle（每条都打日志，方便排查哪条没生效）
  React.useEffect(() => { console.log('[Immersive→handle] setScene', stageState.scene, '| handle:', !!stageHandle); stageHandle?.setScene(stageState.scene); }, [stageHandle, stageState.scene]);
  React.useEffect(() => { console.log('[Immersive→handle] setCameraPreset', stageState.camera, '| handle:', !!stageHandle); stageHandle?.setCameraPreset(stageState.camera); }, [stageHandle, stageState.camera]);
  React.useEffect(() => { console.log('[Immersive→handle] setDanceStyle', stageState.danceStyle, '| handle:', !!stageHandle); stageHandle?.setDanceStyle(stageState.danceStyle); }, [stageHandle, stageState.danceStyle]);
  React.useEffect(() => { console.log('[Immersive→handle] setDancing', stageState.dancing, '| handle:', !!stageHandle); stageHandle?.setDancing(stageState.dancing); }, [stageHandle, stageState.dancing]);
  React.useEffect(() => { console.log('[Immersive→handle] setBpm', stageState.bpm, '| handle:', !!stageHandle); stageHandle?.setBpm(stageState.bpm); }, [stageHandle, stageState.bpm]);
  React.useEffect(() => { console.log('[Immersive→handle] setDanceAmp', stageState.danceAmp, '| handle:', !!stageHandle); stageHandle?.setDanceAmp(stageState.danceAmp); }, [stageHandle, stageState.danceAmp]);
  React.useEffect(() => { console.log('[Immersive→handle] setConfetti', stageState.confetti, '| handle:', !!stageHandle); stageHandle?.setConfetti(stageState.confetti); }, [stageHandle, stageState.confetti]);
  React.useEffect(() => { stageHandle?.setYOffset(stageState.yOffset); }, [stageHandle, stageState.yOffset]);
  React.useEffect(() => { console.log('[Immersive→handle] setAutoBlink', stageState.autoBlink); }, [stageState.autoBlink]);  // autoBlink 走 prop，不走 handle
  React.useEffect(() => { console.log('[Immersive→handle] setLookAtCamera', stageState.lookAtCamera); }, [stageState.lookAtCamera]);  // lookAtCamera 走 prop
  // 唱歌/麦克风：on 触发 start，off 触发 stop
  React.useEffect(() => { console.log('[Immersive→handle] songOn', stageState.songOn, '| handle:', !!stageHandle); if (stageHandle) stageState.songOn ? stageHandle.startSong() : stageHandle.stopSong(); }, [stageHandle, stageState.songOn]);
  React.useEffect(() => { console.log('[Immersive→handle] micOn', stageState.micOn, '| handle:', !!stageHandle); if (stageHandle) stageState.micOn ? stageHandle.startMic() : stageHandle.stopMic(); }, [stageHandle, stageState.micOn]);

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
      {/* 全屏 VRM 角色（与浮窗同一个 character.vrm） — 用 VrmStage 替代 BlenderAvatar */}
      <VrmStage
        onReady={(h) => { console.log('[Immersive] onReady 被调用, h=', h); setStageHandle(h); }}
        modelUrl="/avatars/character.vrm"
        currentAction={action}
        emotion={emotion}
        viseme={viseme}
        autoBlink={stageState.autoBlink}
        lookAtCamera={stageState.lookAtCamera}
        sx={{ position: 'absolute', inset: 0 }}
      />

      {/* 顶部:退出按钮 + 控制台切换 */}
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
      <IconButton
        onClick={() => setPanelOpen((o) => !o)}
        size="medium"
        aria-label="舞台控制台"
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          zIndex: 3,
          color: panelOpen ? '#ff4fd8' : 'rgba(255,255,255,0.85)',
          bgcolor: panelOpen ? 'rgba(255,79,216,0.15)' : 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          '&:hover': { bgcolor: 'rgba(255,79,216,0.2)' },
        }}
      >
        <TuneRoundedIcon />
      </IconButton>

      {/* 底部 chip 条：情绪 + 姿势（移动端隐藏，腾位置给 chat） */}
      <Box sx={{
        position: 'absolute', left: 16, right: { xs: 16, md: 540 }, bottom: { xs: 100, md: 100 },
        zIndex: 3, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 0.5,
      }}>
        <VrmEmotionChips handle={stageHandle} />
        <VrmPoseChips handle={stageHandle} />
      </Box>

      {/* 右侧控制面板 */}
      <VrmControlPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        handle={stageHandle}
        state={stageState}
        onChange={updateStageState}
      />

      {/* 右下角:聊天输入 + 记录(不再用底部全宽遮挡 avatar) */}
      <Box sx={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        left: { xs: 16, md: 'auto' },     // 移动端也到边
        width: { xs: 'auto', md: 480 },
        maxWidth: '100%',
        zIndex: 3,
        p: 1.5,
        background: 'rgba(0,0,0,0.65)',
        borderRadius: 2,
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        {chatLog.length > 0 && (
          <Box sx={{
            maxHeight: 120,
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.35)',
            borderRadius: 1,
            p: 0.75,
          }}>
            {chatLog.slice(-4).map((m, i) => (
              <Typography
                key={i}
                sx={{
                  fontSize: 12,
                  color: m.who === 'user' ? '#a0c4ff' : '#fff',
                  mb: 0.25,
                  wordBreak: 'break-word',
                  lineHeight: 1.4,
                }}
              >
                <strong>{m.who === 'user' ? '我' : 'AI'}:</strong> {m.text}
              </Typography>
            ))}
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
