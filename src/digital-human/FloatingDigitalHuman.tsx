'use client';

/**
 * FloatingDigitalHuman —— 全站右下角的 Blender 写实数字人浮窗。
 *
 * 完全开源 · 浏览器本地驱动 · 0 GPU 服务器:
 *   - 资产:Blender 离线建模 + 绑骨架 + BlendShape + 动作,导出 GLB
 *   - 渲染:three.js + WebGPURenderer
 *   - LLM:/api/avatar/chat(Ollama 本地 qwen2.5 / 云 API)
 *   - TTS:Edge-TTS 公共接口,无需 key
 *   - viseme:文本音素序列 → 驱动 aa/ih/ou BlendShape
 *
 * 用户行为:
 *   - 拖动浮窗到任意位置
 *   - 输入文字 → LLM 回复 → 数字人说话(嘴型 + 表情 + 动作)
 *   - 切换服装(suit / casual / sports)
 *   - 切换场景(office / park)
 */

import React from 'react';
import { Box, IconButton, TextField, Typography, CircularProgress, Chip } from '@mui/material';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import CheckroomRoundedIcon from '@mui/icons-material/CheckroomRounded';
import ParkRoundedIcon from '@mui/icons-material/ParkRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import { alpha } from '@mui/material/styles';
import { useRouter, usePathname } from 'next/navigation';
import BlenderAvatar from './BlenderAvatar';

const FIG_W = 320;
const FIG_H = 480;

const HIDE_ON = ['/user/login', '/digital-human'];

const OUTFITS = [
  { name: 'suit', label: '西装', icon: <BusinessRoundedIcon sx={{ fontSize: 14 }} /> },
  { name: 'casual', label: '休闲', icon: <CheckroomRoundedIcon sx={{ fontSize: 14 }} /> },
  { name: 'sports', label: '运动', icon: <ParkRoundedIcon sx={{ fontSize: 14 }} /> },
];

const SCENES = [
  { name: 'office', label: '办公室' },
  { name: 'park', label: '户外' },
];

interface ChatResp {
  text: string;
  emotion: Record<string, number>;
  action: string;
  visemes: Array<{ t: number; shape: string; weight: number }>;
  audioUrl: string | null;
}

export default function FloatingDigitalHuman() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const hidden = HIDE_ON.some((p) => pathname.startsWith(p));

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });
  const [pos, setPos] = React.useState<{ right: number; bottom: number }>({ right: 24, bottom: 24 });
  const [open, setOpen] = React.useState(true);
  const [autoRotate, setAutoRotate] = React.useState(true);
  const [outfit, setOutfit] = React.useState('casual');
  const [scene, setScene] = React.useState<string | null>(null); // null = 浮窗不显示场景
  const [text, setText] = React.useState('');
  const [chatBusy, setChatBusy] = React.useState(false);
  const [chatLog, setChatLog] = React.useState<Array<{ who: 'user' | 'ai'; text: string }>>([]);
  const [emotion, setEmotion] = React.useState<Record<string, number>>({});
  // viseme 与 emotion 分两个命名空间:emotion 是长期状态(smile/angry/...),
  // viseme 是短期口型驱动(aa/ih/ou/...),不再混进同一份 dict,
  // 避免动画名(若叫 wave)和表情名撞车。
  const [viseme, setViseme] = React.useState<Record<string, number>>({});
  const [action, setAction] = React.useState('idle');
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const visemeTimelineRef = React.useRef<ChatResp['visemes']>([]);
  // viseme 时间基线:对齐到 <audio>.onplay 事件,不再用 fetch 解析瞬间
  const visemeStartRef = React.useRef<number>(0);
  const visemeActiveRef = React.useRef<boolean>(false); // 是否在播音

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    setPos({ right: 24, bottom: 24 });
  }, []);

  // 注意:必须在所有 hook 之后才能 return null,否则 React Rules of Hooks 报错
  // "Rendered fewer hooks than expected"(pathname 切换时 hidden 翻转会导致
  // 下方的 useEffect 被跳过,hook 数量变化 → 崩)
  // 改用 null || JSX 形式:return null 本身没问题,关键是所有 hook 之前不能 early return

  const onDown = (e: React.PointerEvent) => {
    // 只在拖动手柄区域才响应,避免点击输入框/按钮
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
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.active) return;
    setPos({
      right: Math.max(0, d.ox + (d.sx - e.clientX)),
      bottom: Math.max(0, d.oy + (d.sy - e.clientY)),
    });
  };
  const onUp = () => {
    dragRef.current.active = false;
    setTimeout(() => setAutoRotate(true), 1500);
  };

  // 发送消息
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
        body: JSON.stringify({ text: t, history: chatLog.map((m) => ({ role: m.who === 'user' ? 'user' : 'assistant', content: m.text })) }),
      });
      const j: ChatResp = await r.json();
      setChatLog((c) => [...c, { who: 'ai', text: j.text }]);
      // 驱动数字人
      setEmotion(j.emotion);
      setAction(j.action);
      // 清空上一段 viseme,避免残留
      setViseme({});
      // 播放 TTS + 同步 viseme 时间线
      visemeTimelineRef.current = j.visemes || [];
      if (j.audioUrl && audioRef.current) {
        const a = audioRef.current;
        // 把时间基线对齐到真正开始播音的瞬间(不是 fetch 解析瞬间)
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
          // autoplay 被浏览器拒绝时回退:仍然启动 viseme 驱动
          visemeStartRef.current = performance.now();
          visemeActiveRef.current = true;
        });
      } else {
        // 无音频(纯文本回复):也启动 viseme 时间线让数字人动嘴
        visemeStartRef.current = performance.now();
        visemeActiveRef.current = true;
      }
    } catch (err) {
      setChatLog((c) => [...c, { who: 'ai', text: '抱歉,服务暂时不可用。' }]);
    } finally {
      setChatBusy(false);
    }
  };

  // 实时 viseme 驱动(每帧 rAF,~60fps),写到独立的 viseme 命名空间
  React.useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visemeActiveRef.current) return;
      const timeline = visemeTimelineRef.current;
      if (timeline.length === 0) return;
      const elapsed = (performance.now() - visemeStartRef.current) / 1000;
      // 找到当前时间最近的 viseme(时间线按 t 升序)
      let current = timeline[0];
      for (const v of timeline) {
        if (v.t <= elapsed) current = v;
        else break;
      }
      // 不每帧 setState:只在 shape 切换时才更新(避免 ~60 次 re-render/秒)
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

  // 所有 hook 跑完之后,才能根据 hidden 决定渲染什么
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
      {/* 数字人本体(占据上半部分) */}
      <Box sx={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        '& canvas': { width: '100% !important', height: '100% !important' },
      }}>
        <BlenderAvatar
          modelUrl={`/avatars/outfits/${outfit}.glb`}
          currentAction={action}
          emotion={emotion}
          viseme={viseme}
          autoRotate={autoRotate}
          sx={{ borderRadius: 0 }}
        />
        {scene && (
          // 场景作为独立 GLB 渲染:不是 CSS 背景图(GLB 是二进制,url() 永远 404)
          // 用绝对定位 + 低透明度叠在主 avatar 后面,避免遮挡交互
          <Box sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: 0.35,
          }}>
            <BlenderAvatar
              modelUrl={`/avatars/scenes/${scene}.glb`}
              autoRotate={false}
              background="transparent"
              sx={{ width: '100%', height: '100%' }}
            />
          </Box>
        )}
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

      {/* 底部输入 + 切换 */}
      <Box data-no-drag sx={{
        p: 1,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
      }}>
        {/* 换装切换 */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {OUTFITS.map((o) => (
            <Chip
              key={o.name}
              size="small"
              icon={o.icon}
              label={o.label}
              data-no-drag
              onClick={(e) => {
                e.stopPropagation();
                setOutfit(o.name);
              }}
              sx={{
                height: 22,
                fontSize: 10,
                cursor: 'pointer',
                bgcolor: outfit === o.name
                  ? (t) => alpha(t.palette.primary.main, 0.6)
                  : 'rgba(255,255,255,0.08)',
                color: 'white',
                '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.4) },
              }}
            />
          ))}
        </Box>
        {/* 场景切换 */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Chip
            size="small"
            label="无场景"
            data-no-drag
            onClick={(e) => {
              e.stopPropagation();
              setScene(null);
            }}
            sx={{
              height: 22,
              fontSize: 10,
              cursor: 'pointer',
              bgcolor: scene === null ? (t) => alpha(t.palette.primary.main, 0.6) : 'rgba(255,255,255,0.08)',
              color: 'white',
            }}
          />
          {SCENES.map((s) => (
            <Chip
              key={s.name}
              size="small"
              label={s.label}
              data-no-drag
              onClick={(e) => {
                e.stopPropagation();
                setScene(s.name);
              }}
              sx={{
                height: 22,
                fontSize: 10,
                cursor: 'pointer',
                bgcolor: scene === s.name
                  ? (t) => alpha(t.palette.primary.main, 0.6)
                  : 'rgba(255,255,255,0.08)',
                color: 'white',
                '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.4) },
              }}
            />
          ))}
        </Box>

        {/* 聊天输入 */}
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <TextField
            size="small"
            fullWidth
            placeholder="跟数字人说点什么…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            disabled={chatBusy}
            onPointerDown={(e) => e.stopPropagation()}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: 'white',
                fontSize: 12,
                bgcolor: 'rgba(255,255,255,0.08)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              },
              '& .MuiOutlinedInput-input::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
            }}
          />
          <IconButton
            size="small"
            data-no-drag
            disabled={chatBusy || !text.trim()}
            onClick={(e) => {
              e.stopPropagation();
              send();
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

        {/* 聊天记录(最近 2 条,折叠显示) */}
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
      </Box>

      {/* TTS 音频 */}
      <audio ref={audioRef} hidden />
    </Box>
  );
}