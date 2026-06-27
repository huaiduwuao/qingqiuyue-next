'use client';

/**
 * ImmersiveDigitalHuman —— /digital-human 沉浸式页面。
 *
 * 用 BlenderAvatar 渲染 Blender 离线训练的写实数字人(完全开源)。
 * LLM 通过 emotion / viseme / action props 实时驱动表情 + 口型 + 动作。
 *
 * 与 FloatingDigitalHuman 共用同一套驱动协议(LLM → emotion/viseme/action + TTS audio),
 * 只是把浮窗扩展为全屏。
 */

import React from 'react';
import {
  Box, IconButton, TextField, Typography, CircularProgress, Chip,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { useRouter } from 'next/navigation';
import { alpha } from '@mui/material/styles';
import BlenderAvatar from './BlenderAvatar';

interface ChatResp {
  text: string;
  emotion: Record<string, number>;
  action: string;
  visemes: Array<{ t: number; shape: string; weight: number }>;
  audioUrl: string | null;
}

const OUTFITS = [
  { name: 'vrm', label: 'VRM 角色(默认)', modelUrl: '/avatars/character.vrm' },
  { name: 'casual', label: '休闲', modelUrl: '/avatars/outfits/casual.glb' },
  { name: 'suit', label: '西装', modelUrl: '/avatars/outfits/suit.glb' },
  { name: 'sports', label: '运动', modelUrl: '/avatars/outfits/sports.glb' },
];

export default function ImmersiveDigitalHuman() {
  const router = useRouter();
  // outfit 是 modelUrl 字符串(.vrm 或 .glb),BlenderAvatar 自动判断
  const [outfit, setOutfit] = React.useState('/avatars/character.vrm');
  const [autoRotate, setAutoRotate] = React.useState(true);
  const [text, setText] = React.useState('');
  const [chatBusy, setChatBusy] = React.useState(false);
  const [chatLog, setChatLog] = React.useState<Array<{ who: 'user' | 'ai'; text: string }>>([]);
  const [emotion, setEmotion] = React.useState<Record<string, number>>({});
  const [viseme, setViseme] = React.useState<Record<string, number>>({});
  const [action, setAction] = React.useState('idle');
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const visemeTimelineRef = React.useRef<ChatResp['visemes']>([]);
  const visemeStartRef = React.useRef<number>(0);
  const visemeActiveRef = React.useRef<boolean>(false);

  const send = async () => {
    const t = text.trim();
    if (!t || chatBusy) return;
    setChatBusy(true);
    setChatLog((c) => [...c, { who: 'user', text: t }]);
    setText('');
    try {
      const r = await fetch('/api/avatar/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: t,
          history: chatLog.map((m) => ({ role: m.who === 'user' ? 'user' : 'assistant', content: m.text })),
        }),
      });
      const j: ChatResp = await r.json();
      setChatLog((c) => [...c, { who: 'ai', text: j.text }]);
      setEmotion(j.emotion);
      setAction(j.action);
      setViseme({});
      visemeTimelineRef.current = j.visemes || [];
      if (j.audioUrl && audioRef.current) {
        const a = audioRef.current;
        a.onplay = () => {
          visemeStartRef.current = performance.now();
          visemeActiveRef.current = true;
        };
        a.onended = () => {
          visemeActiveRef.current = false;
          setViseme({});
        };
        a.src = j.audioUrl;
        a.play().catch(() => {
          visemeStartRef.current = performance.now();
          visemeActiveRef.current = true;
        });
      } else {
        visemeStartRef.current = performance.now();
        visemeActiveRef.current = true;
      }
    } catch (err) {
      setChatLog((c) => [...c, { who: 'ai', text: '抱歉,服务暂时不可用。' }]);
    } finally {
      setChatBusy(false);
    }
  };

  // viseme 驱动 rAF(与 FloatingDigitalHuman 同款)
  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visemeActiveRef.current) return;
      const timeline = visemeTimelineRef.current;
      if (timeline.length === 0) return;
      const elapsed = (performance.now() - visemeStartRef.current) / 1000;
      let current = timeline[0];
      for (const v of timeline) {
        if (v.t <= elapsed) current = v;
        else break;
      }
      const next = { [current.shape]: current.weight };
      setViseme((prev) => {
        const k = Object.keys(next)[0];
        if (prev[k] === next[k]) return prev;
        return next;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1, background: '#05060B' }}>
      {/* 全屏数字人 */}
      <BlenderAvatar
        modelUrl={outfit}
        currentAction={action}
        emotion={emotion}
        viseme={viseme}
        autoRotate={autoRotate}
        sx={{ position: 'absolute', inset: 0 }}
      />

      {/* 顶部:退出 + 换装 */}
      <Box sx={{
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pointerEvents: 'none',
      }}>
        <IconButton
          onClick={() => router.back()}
          size="medium"
          aria-label="退出"
          sx={{
            pointerEvents: 'auto',
            color: 'rgba(255,255,255,0.85)',
            bgcolor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
          }}
        >
          <CloseRoundedIcon />
        </IconButton>
        <Box sx={{ display: 'flex', gap: 0.75, pointerEvents: 'auto' }}>
          {OUTFITS.map((o) => (
            <Chip
              key={o.modelUrl}
              label={o.label}
              size="small"
              onClick={() => setOutfit(o.modelUrl)}
              sx={{
                bgcolor: outfit === o.name
                  ? (t) => alpha(t.palette.primary.main, 0.7)
                  : 'rgba(0,0,0,0.4)',
                color: 'white',
                backdropFilter: 'blur(8px)',
                fontSize: 12,
                '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.4) },
              }}
            />
          ))}
        </Box>
        <Box sx={{ flex: 1 }} />
      </Box>

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
            placeholder="跟数字人说点什么…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            disabled={chatBusy}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                bgcolor: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(8px)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              },
              '& .MuiOutlinedInput-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
            }}
          />
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
      </Box>

      <audio ref={audioRef} hidden />
    </Box>
  );
}