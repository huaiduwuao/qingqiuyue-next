'use client';

import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import MicOffRoundedIcon from '@mui/icons-material/MicOffRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import { useRouter, usePathname } from 'next/navigation';

import type { AgentEvent, IAvatarStage } from './types';
import { CanvasStage } from './CanvasStage';
import { VideoStage } from './VideoStage';
import { SparkStage } from './SparkStage';
import { DynamicAvatarStage } from './DynamicAvatarStage';
import { ActionStateMachine } from './ActionStateMachine';
import { BrowserASR } from './voice/asr';
import { BrowserTTS, AnalyserTTS } from './voice/tts';
import { VAD } from './voice/vad';
import { buildTools } from './agent/tools';
import { MockIntentLLM, LLM } from './agent/llm';
import { AgentController } from './agent/AgentController';

const HIDE_ON = ['/user/login', '/digital-human'];
const FIG_W = 130, FIG_H = 190;

export default function FloatingDigitalHuman() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const hidden = HIDE_ON.some((p) => pathname.startsWith(p));

  const avatarRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<IAvatarStage | null>(null);
  const fsmRef = React.useRef<ActionStateMachine | null>(null);
  const agentRef = React.useRef<AgentController | null>(null);
  const vadRef = React.useRef<VAD | null>(null);
  const asrRef = React.useRef<BrowserASR | null>(null);

  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [walking, setWalking] = React.useState(true);
  const [text, setText] = React.useState('');
  const [voiceOn, setVoiceOn] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const [level, setLevel] = React.useState(0);
  const [log, setLog] = React.useState<string[]>([]);
  const [thinking, setThinking] = React.useState(false);
  const [lastReply, setLastReply] = React.useState('');

  const drag = React.useRef({ active: false, sx: 0, sy: 0, ol: 0, ot: 0, moved: 0 });
  const highlightRef = React.useRef<{ el: HTMLElement; prev: string } | null>(null);
  const pushLog = (s: string) => setLog((l) => [s, ...l].slice(0, 12));

  // 指向数据:移动到元素旁 + 高亮 + 伸手
  const pointAt = React.useCallback((textq: string): boolean => {
    const t = textq.trim();
    const els = Array.from(document.querySelectorAll<HTMLElement>('button,a,td,th,h1,h2,h3,h4,p,span,.MuiChip-root,.MuiTab-root,[role=row]'));
    const el = els.find((e) => (e.textContent || '').trim() === t) || els.find((e) => (e.textContent || '').includes(t));
    if (!el) return false;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const r = el.getBoundingClientRect();
    // 数字人站到目标右侧或左侧
    const onLeft = r.left > window.innerWidth - r.right;
    const left = onLeft ? Math.max(8, r.left - FIG_W - 8) : Math.min(window.innerWidth - FIG_W - 8, r.right + 8);
    const top = Math.min(window.innerHeight - FIG_H - 8, Math.max(8, r.top + r.height / 2 - FIG_H / 2));
    setWalking(true);
    setPos({ left, top });
    fsmRef.current?.enterWalking(1700);
    fsmRef.current?.playOneShot('point', 4000);
    // 高亮目标
    if (highlightRef.current) highlightRef.current.el.style.outline = highlightRef.current.prev;
    highlightRef.current = { el, prev: el.style.outline };
    el.style.outline = '2px solid #FFB400';
    el.style.outlineOffset = '2px';
    setTimeout(() => {
      if (highlightRef.current?.el === el) { el.style.outline = highlightRef.current.prev; highlightRef.current = null; }
    }, 4000);
    return true;
  }, []);

  // 初始化
  React.useEffect(() => {
    if (hidden || !avatarRef.current) return;
    // 初始位置:右下
    setPos({ left: window.innerWidth - FIG_W - 24, top: window.innerHeight - FIG_H - 24 });
    let disposed = false;
    const init = async () => {
      // 1) 优先 3D 路径:从 /api/realtime/config 读 assetUrl,优先用 SparkStage(WebGL + LBS 蒙皮),
      //    失败再退到 DynamicAvatarStage(mkkellogg 静态 .ply),都不行再 2D
      let stage: IAvatarStage | null = null;
      let disposed3d: IAvatarStage | null = null;
      try {
        const cfg = await fetch('/api/realtime/config').then((r) => r.json()).catch(() => null);
        const assetUrl: string | undefined = cfg?.data?.assetUrl;
        if (assetUrl) {
          // a) SparkStage:支持 LBS 蒙皮,真人 3DGS 可驱动(姿势+口型)
          try {
            const spark = new SparkStage();
            await spark.mount(avatarRef.current!);
            await spark.loadAvatar(assetUrl);
            stage = spark;
            console.log('[DH] SparkStage ready:', assetUrl);
          } catch (e) {
            console.warn('[DH] SparkStage 失败,试 DynamicAvatarStage:', e);
          }
          // b) DynamicAvatarStage:仅可视化 .ply,无 LBS
          if (!stage) {
            try {
              const dyn = new DynamicAvatarStage();
              await dyn.mount(avatarRef.current!);
              await dyn.loadAvatar(assetUrl);
              stage = dyn;
              disposed3d = dyn;
              console.log('[DH] DynamicAvatarStage ready:', assetUrl);
            } catch (e) {
              console.warn('[DH] DynamicAvatarStage 也失败,回退 2D:', e);
            }
          }
          void disposed3d;
        }
      } catch (e) {
        console.warn('[DH] 3D stage 初始化失败,回退 2D:', e);
      }

      // 2) 回退:真人视频片段 → 2D VideoStage,再不行 CanvasStage 占位
      if (!stage) {
        const manifest = await VideoStage.fromUrl('/avatar/clips.json');
        if (disposed || !avatarRef.current) return;
        stage = manifest ? new VideoStage(manifest) : new CanvasStage({ transparent: true });
        await stage.mount(avatarRef.current);
      }
      if (disposed) { try { stage.dispose(); } catch {} return; }
      stageRef.current = stage;
      const fsm = new ActionStateMachine(stage);
      fsmRef.current = fsm;
      const asr = new BrowserASR('zh-CN');
      asrRef.current = asr;
      // TTS:有服务端音频接口就用 AnalyserTTS(口型对真音频 RMS),否则用浏览器 SpeechSynthesis 兜底
      const ttsEndpoint = (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_TTS_AUDIO_URL) || '';
      const tts = ttsEndpoint
        ? new AnalyserTTS({ fetchAudio: async (text) => `${ttsEndpoint}?text=${encodeURIComponent(text)}` })
        : new BrowserTTS('zh-CN');
      const llm: LLM = new MockIntentLLM();
      const tools = buildTools({ navigate: (p) => router.push(p), pointAt });
      const onEvent = (e: AgentEvent) => {
        if (e.type === 'thinking') setThinking(true);
        if (e.type === 'done' || e.type === 'error') setThinking(false);
        if (e.type === 'asr') pushLog(`🎤 ${e.text}`);
        if (e.type === 'reply') { pushLog(`🤖 ${e.reply.text}`); setLastReply(e.reply.text); setTimeout(() => setLastReply(''), 6000); }
        if (e.type === 'tool') pushLog(`🔧 ${e.name} ${e.error ? '✗' + e.error : '✓'}`);
      };
      agentRef.current = new AgentController({ llm, tools, asr, tts, fsm, onEvent });
      // 如果 stage 加载好了资产,把关节数同步给状态机(让 pose 数组长度对齐)
      const stg = stageRef.current as any;
      if (stg?.asset?.meta?.jointCount) fsm.setJointCount(stg.asset.meta.jointCount);
      fsm.start();
    };
    init();
    return () => {
      disposed = true;
      fsmRef.current?.stop();
      stageRef.current?.dispose();
      vadRef.current?.stop();
    };
  }, [hidden, router, pointAt]);

  // 自己走动(闲时每 7s 换个位置)
  React.useEffect(() => {
    if (hidden) return;
    const t = setInterval(() => {
      if (open || thinking || highlightRef.current) return; // 对话/指向时不乱跑
      setWalking(true);
      fsmRef.current?.enterWalking(1700);
      setPos({
        left: 24 + Math.random() * Math.max(0, window.innerWidth - FIG_W - 48),
        top: 80 + Math.random() * Math.max(0, window.innerHeight - FIG_H - 140),
      });
    }, 7000);
    return () => clearInterval(t);
  }, [hidden, open, thinking]);

  if (hidden) return null;

  // VAD 持续听
  const toggleVoice = async () => {
    if (voiceOn) {
      vadRef.current?.stop();
      vadRef.current = null;
      asrRef.current?.stop();
      setVoiceOn(false);
      setSpeaking(false);
      return;
    }
    try {
      const vad = new VAD();
      vad.onLevel = (rms) => setLevel(rms);
      vad.onSpeechStart = () => { setSpeaking(true); asrRef.current?.start(); };
      vad.onSpeechEnd = () => { setSpeaking(false); asrRef.current?.stop(); };
      await vad.start();
      vadRef.current = vad;
      setVoiceOn(true);
    } catch (e: any) {
      pushLog(`⚠️ 麦克风不可用:${e?.message || e}`);
    }
  };

  const send = () => {
    const t = text.trim();
    if (!t) return;
    pushLog(`🧑 ${t}`);
    agentRef.current?.handle(t);
    setText('');
  };

  // 拖拽
  const onDown = (e: React.PointerEvent) => {
    drag.current = { active: true, sx: e.clientX, sy: e.clientY, ol: pos.left, ot: pos.top, moved: 0 };
    setWalking(false);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    d.moved = Math.max(d.moved, Math.abs(dx) + Math.abs(dy));
    setPos({ left: d.ol + dx, top: d.ot + dy });
  };
  const onUp = () => {
    const moved = drag.current.moved;
    drag.current.active = false;
    if (moved < 6) setOpen((v) => !v);
  };

  return (
    <Box data-dh-root sx={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 2000, transition: walking ? 'left 1.6s cubic-bezier(.4,0,.2,1), top 1.6s cubic-bezier(.4,0,.2,1)' : 'none' }}>
      {/* 气泡回复 */}
      {!open && lastReply && (
        <Box sx={{ position: 'absolute', bottom: FIG_H - 10, left: -70, width: 200, px: 1.5, py: 0.75, borderRadius: 2, bgcolor: 'rgba(15,17,26,0.96)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}>
          <Typography sx={{ fontSize: 11.5, color: 'text.primary' }}>{lastReply}</Typography>
        </Box>
      )}

      {/* 聊天面板 */}
      {open && (
        <Box sx={{ position: 'absolute', bottom: FIG_H - 6, left: -90, width: 300, borderRadius: 3, overflow: 'hidden', bgcolor: 'rgba(15,17,26,0.97)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}>
          <Box sx={{ px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>数字人助理</Typography>
            {voiceOn && <Chip size="small" label={speaking ? '聆听中' : '待命'} sx={{ height: 18, fontSize: 10, bgcolor: speaking ? 'rgba(93,219,150,0.3)' : 'rgba(255,255,255,0.08)', color: '#fff' }} />}
            {thinking && <Chip size="small" label="思考" sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(139,92,246,0.3)', color: '#fff' }} />}
            <IconButton size="small" onClick={() => router.push('/digital-human')} title="进入全屏数字人工作室"><OpenInFullRoundedIcon sx={{ fontSize: 14 }} /></IconButton>
            <IconButton size="small" onClick={() => setOpen(false)} title="收起聊天(数字人保留)"><CloseRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
          </Box>
          <Box sx={{ maxHeight: 190, overflowY: 'auto', p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {log.length === 0 && <Typography sx={{ fontSize: 11.5, color: 'text.disabled' }}>开麦克风后我会一直听你说话;也可打字。试试"点击新建""帮我填名称 测试""悬赏在哪""打开用户管理"。</Typography>}
            {log.map((l, i) => <Typography key={i} sx={{ fontSize: 11.5, color: 'text.secondary', fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>{l}</Typography>)}
          </Box>
          <Box sx={{ p: 1, display: 'flex', gap: 0.5, alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <IconButton size="small" onClick={toggleVoice} sx={{ bgcolor: voiceOn ? (speaking ? 'success.main' : 'primary.main') : 'rgba(255,255,255,0.06)', color: '#fff', position: 'relative' }}>
              {voiceOn ? <MicRoundedIcon sx={{ fontSize: 18 }} /> : <MicOffRoundedIcon sx={{ fontSize: 18 }} />}
              {voiceOn && <Box sx={{ position: 'absolute', inset: -2, borderRadius: '50%', border: '2px solid', borderColor: 'success.main', opacity: Math.min(1, level * 25), pointerEvents: 'none' }} />}
            </IconButton>
            <TextField size="small" fullWidth placeholder="对数字人说…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} sx={{ '& .MuiInputBase-input': { fontSize: 12.5 } }} />
            <IconButton size="small" onClick={send} sx={{ bgcolor: 'primary.main', color: '#fff' }}><SendRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
          </Box>
        </Box>
      )}

      {/* 数字人形象(透明、可拖拽、可走动)*/}
      <Box
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        sx={{ width: FIG_W, height: FIG_H, cursor: 'grab', touchAction: 'none', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.5))', position: 'relative' }}
      >
        <Box ref={avatarRef} sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} />
      </Box>
    </Box>
  );
}
