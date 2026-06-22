'use client';

/**
 * ImmersiveDigitalHuman —— 全屏沉浸式数字人视频通话风格
 *
 * 跟 DigitalHumanStage 的区别:
 * - 数字人占满全屏(像视频通话里看对方)
 * - 输入条 / 聊天记录 / 状态都是半透明悬浮玻璃面板
 * - 没有「打招呼 / 挥手 / 跳舞」这些快捷按钮(那是工坊模式才用的)
 * - 顶部只有一个「退出」按钮,不显示页面标题
 *
 * 复用 DigitalHumanStage 的 stage / agent 基础设施(Canvas / Video / Spark / FSM /
 * ASR / TTS / AgentController),只重做外层布局。
 */
import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CircleIcon from '@mui/icons-material/Circle';

import type { AgentEvent, IAvatarStage } from './types';
import { CanvasStage } from './CanvasStage';
import { VideoStage } from './VideoStage';
import { AholoStage } from './AholoStage';
import { DynamicAvatarStage } from './DynamicAvatarStage';
import { SparkStage } from './SparkStage';
import { ActionStateMachine } from './ActionStateMachine';
import { BrowserASR } from './voice/asr';
import { BrowserTTS } from './voice/tts';
import { buildTools } from './agent/tools';
import { MockIntentLLM, RemoteLLM, LLM } from './agent/llm';
import { AgentController } from './agent/AgentController';

const FIG_W_MOBILE = '70vw';
const FIG_W_DESKTOP = '55vh';
const FIG_MAX_W = 480;

export default function ImmersiveDigitalHuman() {
  const router = useRouter();
  const stageRef = React.useRef<HTMLDivElement>(null);
  const canvasStageRef = React.useRef<IAvatarStage | null>(null);
  const fsmRef = React.useRef<ActionStateMachine | null>(null);
  const agentRef = React.useRef<AgentController | null>(null);

  const [text, setText] = React.useState('');
  const [listening, setListening] = React.useState(false);
  const [useRemote, setUseRemote] = React.useState(false);
  const [thinking, setThinking] = React.useState(false);
  const [stageKind, setStageKind] = React.useState<'placeholder' | 'real'>('placeholder');
  const [connected, setConnected] = React.useState<'connecting' | 'ready' | 'tts'>('connecting');
  // 聊天记录(只显示最近 6 条,保持面板不爆)
  const [chat, setChat] = React.useState<{ who: 'user' | 'ai'; text: string }[]>([]);
  // 日志详情面板(可展开 / 收起,默认收起)
  const [logOpen, setLogOpen] = React.useState(false);
  const [log, setLog] = React.useState<string[]>([]);

  const pushLog = (s: string) => setLog((l) => [s, ...l].slice(0, 30));
  const pushChat = (who: 'user' | 'ai', text: string) =>
    setChat((c) => [...c, { who, text }].slice(-6));

  React.useEffect(() => {
    if (!stageRef.current) return;
    let disposed = false;

    const init = async () => {
      // 优先真人视频(public/avatar/clips.json),否则占位
      const manifest = await VideoStage.fromUrl('/avatar/clips.json');
      if (disposed || !stageRef.current) return;
      const stage: IAvatarStage = manifest ? new VideoStage(manifest) : new CanvasStage();
      setStageKind(manifest ? 'real' : 'placeholder');
      canvasStageRef.current = stage;
      await stage.mount(stageRef.current);
      if (disposed) return;
      const fsm = new ActionStateMachine(stage);
      fsmRef.current = fsm;
      const asr = new BrowserASR('zh-CN');
      const tts = new BrowserTTS('zh-CN');
      asr.onEnd = () => setListening(false);
      const llm: LLM = useRemote ? new RemoteLLM('/api/realtime/chat') : new MockIntentLLM();
      const tools = buildTools({ navigate: (p) => router.push(p) });
      const onEvent = (e: AgentEvent) => {
        if (e.type === 'thinking') setThinking(true);
        if (e.type === 'done' || e.type === 'error') setThinking(false);
        if (e.type === 'asr') {
          pushLog(`🎤 ${e.text}`);
          pushChat('user', e.text);
        }
        if (e.type === 'reply') {
          pushLog(`🤖 ${e.reply.text}`);
          pushChat('ai', e.reply.text);
        }
        if (e.type === 'tool') pushLog(`🔧 ${e.name}(${JSON.stringify(e.args)})${e.error ? ' ✗ ' + e.error : ' ✓'}`);
        if (e.type === 'speaking') setConnected('tts');
        if (e.type === 'done') setConnected('ready');
        if (e.type === 'error') setConnected('ready');
      };
      agentRef.current = new AgentController({ llm, tools, asr, tts, fsm, onEvent });
      fsm.start();
      setConnected('ready');
    };
    init();

    return () => {
      disposed = true;
      fsmRef.current?.stop();
      canvasStageRef.current?.dispose();
    };
    // useRemote 变化时重建 agent
  }, [router, useRemote]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    pushChat('user', t);
    agentRef.current?.handle(t);
    setText('');
  };

  const toggleMic = async () => {
    const agent = agentRef.current;
    if (!agent) return;
    if (listening) {
      agent.stopListening();
      setListening(false);
    } else {
      agent.startListening();
      setListening(true);
    }
  };

  // 全屏沉浸容器:fixed 铺满整个 viewport,数字人占中央
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        // 始终深色舞台(数字人形象需要深背景才好看,跟全局 light/dark 解耦)
        bgcolor: '#05060B',
        overflow: 'hidden',
      }}
    >
      {/* 数字人形象(占屏幕中央,宽高自适应) */}
      <Box
        ref={stageRef}
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: FIG_W_MOBILE, md: FIG_W_DESKTOP },
          maxWidth: `${FIG_MAX_W}px`,
          aspectRatio: '3/4',
          // 让 canvas / 3D 模型本身铺满,容器透明
          '& canvas, & video': { width: '100%', height: '100%', objectFit: 'contain' },
        }}
      />

      {/* 顶部状态栏:左 = 退出,中 = 角色名,右 = 连接状态指示 + LLM 切换 */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 3,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
        }}
      >
        <IconButton
          onClick={() => router.back()}
          size="small"
          aria-label="退出"
          sx={{ color: 'rgba(255,255,255,0.9)' }}
        >
          <CloseRoundedIcon />
        </IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircleIcon sx={{ fontSize: 8, color: connected === 'ready' ? '#5DDB96' : connected === 'tts' ? '#FE2C55' : '#FFB400' }} />
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
            {connected === 'ready' ? '已连接' : connected === 'tts' ? '正在回应…' : '连接中…'}
          </Typography>
        </Box>
        <IconButton
          onClick={() => setUseRemote((v) => !v)}
          size="small"
          aria-label="切换 LLM"
          sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, px: 1.5, borderRadius: 1 }}
        >
          <Typography sx={{ fontSize: 11, fontWeight: 600 }}>
            {useRemote ? '真·LLM' : 'Mock'}
          </Typography>
        </IconButton>
      </Box>

      {/* 占位提示(浮在数字人脚下,仅 placeholder 时显示) */}
      {stageKind === 'placeholder' && (
        <Box
          sx={{
            position: 'absolute',
            bottom: { xs: 100, md: 130 },
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2,
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: 'rgba(15,17,26,0.75)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            maxWidth: 480,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
            占位形象 · 放入真人视频片段即变真人：把 <code>public/avatar/clips.example.json</code> 复制为 <code>clips.json</code> 填入你的片段地址(待机 / 讲话 / 表情…),刷新即可。
          </Typography>
        </Box>
      )}

      {/* 思考中提示(顶部状态条下) */}
      {thinking && (
        <Box
          sx={{
            position: 'absolute',
            top: 56,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 3,
            px: 1.5,
            py: 0.5,
            borderRadius: 999,
            bgcolor: 'rgba(139,92,246,0.85)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            backdropFilter: 'blur(8px)',
          }}
        >
          思考中…
        </Box>
      )}

      {/* 聊天记录面板(浮在数字人左侧 / 下方,玻璃半透明,可折叠日志详情) */}
      {(chat.length > 0 || log.length > 0) && (
        <Box
          sx={{
            position: 'absolute',
            left: { xs: 12, md: 24 },
            bottom: { xs: 96, md: 120 },
            width: { xs: 'calc(100% - 24px)', md: 320 },
            maxWidth: 360,
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
            pointerEvents: 'auto',
            // 玻璃面板
            bgcolor: 'rgba(15, 17, 26, 0.55)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 2,
            p: 1.25,
            maxHeight: { xs: 180, md: 240 },
          }}
        >
          {/* 聊天流 */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, overflowY: 'auto', flex: 1 }}>
            {chat.slice(-5).map((c, i) => (
              <Box
                key={i}
                sx={{
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: c.who === 'user' ? 'rgba(91,141,239,0.95)' : 'rgba(255,255,255,0.92)',
                  textAlign: c.who === 'user' ? 'right' : 'left',
                  wordBreak: 'break-word',
                }}
              >
                <Box component="span" sx={{ opacity: 0.6, fontSize: 10, mr: 0.5 }}>
                  {c.who === 'user' ? '我' : 'AI'}
                </Box>
                {c.text}
              </Box>
            ))}
          </Box>
          {/* 日志详情(可折叠) */}
          {log.length > 0 && (
            <>
              <Box
                onClick={() => setLogOpen((v) => !v)}
                sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', userSelect: 'none', textAlign: 'center', pt: 0.25, borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                {logOpen ? '▾ 收起日志' : `▴ 展开日志(${log.length})`}
              </Box>
              {logOpen && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, maxHeight: 120, overflowY: 'auto', pt: 0.25 }}>
                  {log.slice(0, 10).map((l, i) => (
                    <Box key={i} sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', fontFamily: 'ui-monospace, monospace', lineHeight: 1.4 }}>
                      {l}
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
        </Box>
      )}

      {/* 底部输入条(全宽半透明玻璃,固定在最下面) */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 3,
          px: { xs: 2, md: 4 },
          py: { xs: 1.5, md: 2 },
          // 从下往上渐变深色蒙版,让输入条与数字人之间有视觉层次
          background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            maxWidth: 640,
            mx: 'auto',
            px: 1.5,
            py: 0.5,
            borderRadius: 999,
            bgcolor: 'rgba(20, 22, 32, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <IconButton
            onClick={toggleMic}
            size="small"
            sx={{
              color: listening ? '#FE2C55' : 'rgba(255,255,255,0.85)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
            }}
            aria-label={listening ? '停止聆听' : '开始语音'}
          >
            {listening ? <MicRoundedIcon /> : <MicOffRoundedIcon />}
          </IconButton>
          <TextField
            fullWidth
            variant="standard"
            placeholder="对数字人说点什么…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            slotProps={{
              input: { disableUnderline: true, sx: { color: '#fff', fontSize: 14, py: 0.5 } },
            }}
            sx={{ '& input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 } }}
          />
          <IconButton
            onClick={send}
            size="small"
            sx={{
              color: text.trim() ? '#FE2C55' : 'rgba(255,255,255,0.4)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' },
            }}
            aria-label="发送"
          >
            <SendRoundedIcon />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}