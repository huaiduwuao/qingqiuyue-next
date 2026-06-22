'use client';

import React from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { useRouter } from 'next/navigation';

import type { AgentEvent, AvatarAction, IAvatarStage } from './types';
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

const QUICK: { label: string; action: AvatarAction }[] = [
  { label: '打招呼', action: 'greet' },
  { label: '挥手', action: 'wave' },
  { label: '跳舞', action: 'dance' },
  { label: '唱歌', action: 'sing' },
  { label: '坐下', action: 'sit' },
  { label: '离场', action: 'leave' },
];

export default function DigitalHumanStage() {
  const router = useRouter();
  const stageRef = React.useRef<HTMLDivElement>(null);
  const aholoRef = React.useRef<HTMLDivElement>(null);
  const canvasStageRef = React.useRef<IAvatarStage | null>(null);
  const fsmRef = React.useRef<ActionStateMachine | null>(null);
  const agentRef = React.useRef<AgentController | null>(null);

  const [text, setText] = React.useState('');
  const [listening, setListening] = React.useState(false);
  const [useRemote, setUseRemote] = React.useState(false);
  const [aholoOn, setAholoOn] = React.useState(false);
  const [log, setLog] = React.useState<string[]>([]);
  const [thinking, setThinking] = React.useState(false);
  const [stageKind, setStageKind] = React.useState<'placeholder' | 'real'>('placeholder');

  const pushLog = (s: string) => setLog((l) => [s, ...l].slice(0, 20));

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
        if (e.type === 'asr') pushLog(`🎤 ${e.final ? '' : '…'}${e.text}`);
        if (e.type === 'reply') pushLog(`🤖 ${e.reply.text}`);
        if (e.type === 'tool') pushLog(`🔧 ${e.name}(${JSON.stringify(e.args)})${e.error ? ' ✗ ' + e.error : ' ✓'}`);
        if (e.type === 'error') pushLog(`⚠️ ${e.message}`);
      };
      agentRef.current = new AgentController({ llm, tools, asr, tts, fsm, onEvent });
      fsm.start();
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
    pushLog(`🧑 ${t}`);
    agentRef.current?.handle(t);
    setText('');
  };

  const toggleMic = () => {
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

  const toggleAholo = async () => {
    if (aholoOn || !aholoRef.current) return;
    const stage = new AholoStage();
    try {
      await stage.mount(aholoRef.current);
      await stage.loadScene();
      setAholoOn(true);
      pushLog('🟢 aholo 高斯场景已加载');
    } catch (e: any) {
      pushLog(`⚠️ aholo 加载失败:${e?.message || e}(已用占位数字人)`);
    }
  };

  // 3D 高斯人:SparkStage(支持 LBS)优先,失败回退 DynamicAvatarStage(纯可视化)
  const dynStageRef = React.useRef<IAvatarStage | null>(null);
  const load3DAvatar = async () => {
    if (dynStageRef.current || !stageRef.current) return;
    pushLog('⏳ 加载 3D 高斯人…');
    let stage: IAvatarStage | null = null;
    try {
      const cfg = await fetch('/api/realtime/config').then((r) => r.json()).catch(() => null);
      const assetUrl = cfg?.data?.assetUrl;
      if (!assetUrl) {
        pushLog('ℹ️ 未配置 assetUrl(AVATAR_ASSET_URL)。训练出资产后填入即可。');
        return;
      }
      // a) SparkStage(支持 LBS 蒙皮,可驱动姿势/口型)
      try {
        const s = new SparkStage();
        await s.mount(stageRef.current);
        await s.loadAvatar(assetUrl);
        stage = s;
        pushLog('🟢 3D 高斯人(Spark + LBS)已加载并接入驱动');
      } catch (e: any) {
        pushLog(`⚠️ SparkStage 失败,试 mkkellogg:${e?.message || e}`);
      }
      // b) DynamicAvatarStage(纯 .ply 可视化,无 LBS)
      if (!stage) {
        try {
          const s = new DynamicAvatarStage();
          await s.mount(stageRef.current);
          await s.loadAvatar(assetUrl);
          stage = s;
          pushLog('🟢 3D 高斯人(mkkellogg 静态)已加载');
        } catch (e: any) {
          pushLog(`⚠️ 3D 高斯人失败:${e?.message || e}(需 WebGL + 资产)`);
        }
      }
      if (stage) {
        // 让动作状态机改驱动 3D 人(替换之前的 2D 舞台)
        canvasStageRef.current?.dispose();
        canvasStageRef.current = stage;
        // 同步给 FSM
        const fsm = fsmRef.current;
        if (fsm) {
          // ActionStateMachine 内部 stage 是 private 的;让它接收新 stage 需要扩展。
          // 简单做法:重建 FSM。stage 已挂载,fsm 切换到它只是改内部引用。
          (fsm as any).stage = stage;
        }
        dynStageRef.current = stage;
      }
    } catch (e: any) {
      pushLog(`⚠️ 加载失败:${e?.message || e}`);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 520, gap: 1.5 }}>
      <Box sx={{ display: 'flex', gap: 1.5, flex: 1, minHeight: 0 }}>
        {/* 舞台 — 主题感知:dark 模式近黑、light 模式近白,但始终比卡片深一档,
             让数字人形象有"舞台"感 */}
        <Box sx={{
          position: 'relative',
          flex: 1,
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          // 舞台背景需要始终比文字浅(深)以保证数字人形象可见;跟主题的 paper 区分
          bgcolor: (theme) => theme.palette.mode === 'dark' ? '#05060B' : '#0F1018',
        }}>
          <Box ref={aholoRef} sx={{ position: 'absolute', inset: 0, zIndex: 0 }} />
          <Box ref={stageRef} sx={{ position: 'absolute', inset: 0, zIndex: 1 }} />
          {thinking && (
            <Chip size="small" label="思考中…" sx={{
              position: 'absolute', top: 12, left: 12, zIndex: 2,
              bgcolor: 'rgba(139,92,246,0.85)', color: '#fff',
              fontWeight: 600,
            }} />
          )}
          {stageKind === 'placeholder' && (
            <Box sx={{
              position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 2,
              p: 1, borderRadius: 2,
              bgcolor: 'rgba(15,17,26,0.75)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
                当前为占位形象。放入真人视频片段即变真人:把 <code>public/avatar/clips.example.json</code> 复制为 <code>clips.json</code> 并填入你的片段地址(待机/讲话/打招呼/跳舞…),刷新即可。
              </Typography>
            </Box>
          )}
          <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 2, display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" onClick={toggleAholo} disabled={aholoOn} sx={{
              fontSize: 11,
              borderColor: 'rgba(255,255,255,0.3)',
              color: '#fff',
              bgcolor: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(6px)',
              '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(0,0,0,0.55)' },
            }}>
              {aholoOn ? '高斯场景已开' : '加载高斯场景'}
            </Button>
            <Button size="small" variant="outlined" onClick={load3DAvatar} sx={{
              fontSize: 11,
              borderColor: 'rgba(255,255,255,0.3)',
              color: '#fff',
              bgcolor: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(6px)',
              '&:hover': { borderColor: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(0,0,0,0.55)' },
            }}>
              3D 高斯人
            </Button>
            <Button size="small" variant={useRemote ? 'contained' : 'outlined'} onClick={() => setUseRemote((v) => !v)} sx={{ fontSize: 11 }}>
              {useRemote ? '真·LLM' : 'Mock LLM'}
            </Button>
          </Box>
        </Box>

        {/* 事件日志 */}
        <Box sx={{
          width: 280,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          p: 1.5,
          bgcolor: 'background.paper',
        }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, mb: 1, color: 'text.secondary' }}>交互日志</Typography>
          <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {log.map((l, i) => (
              <Typography key={i} sx={{ fontSize: 12, color: 'text.primary', fontFamily: 'ui-monospace, monospace', lineHeight: 1.4, wordBreak: 'break-all' }}>
                {l}
              </Typography>
            ))}
          </Box>
        </Box>
      </Box>

      {/* 快捷动作 */}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {QUICK.map((q) => (
          <Chip key={q.action} label={q.label} size="small" onClick={() => fsmRef.current?.playOneShot(q.action)} sx={{ cursor: 'pointer' }} />
        ))}
      </Box>

      {/* 输入栏 */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <IconButton onClick={toggleMic} sx={{
          bgcolor: listening ? 'primary.main' : 'action.hover',
          color: listening ? '#fff' : 'text.primary',
          '&:hover': { bgcolor: listening ? 'primary.dark' : 'action.selected' },
        }}>
          {listening ? <MicRoundedIcon /> : <MicOffRoundedIcon />}
        </IconButton>
        <TextField
          fullWidth
          size="small"
          placeholder='对数字人说点什么,如"打开悬赏中心""搜索 清秋月""跳个舞"'
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <IconButton onClick={send} sx={{
          bgcolor: 'primary.main',
          color: '#fff',
          '&:hover': { bgcolor: 'primary.dark' },
        }}>
          <SendRoundedIcon />
        </IconButton>
      </Box>
    </Box>
  );
}
