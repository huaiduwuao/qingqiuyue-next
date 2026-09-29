'use client';

/**
 * scene-ui/GameHud.tsx — 广场的 HUD:等级/经验条、每日任务、小地图、地标提示卡、提示条、操作说明
 *
 * 全部是叠在画布上的普通 DOM(不进 3D),只在 VRM 形象 + 广场开着时出现。
 */

import React from 'react';
import { Box, ButtonBase, IconButton, LinearProgress, Tooltip, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import type { VrmStageHandle } from '../VrmStage';
import type { WorldGame } from './useWorldGame';
import { QUESTS, WORLD_RADIUS, WORLD_ZONES, ZONE_BY_ID } from '../vrm/world/worldLayout';

const CYAN = '#25F4EE';
const PINK = '#ff4fd8';
const GOLD = '#ffc93d';
const glass = {
  bgcolor: 'rgba(8,10,20,0.62)',
  backdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
} as const;

const popIn = keyframes`from { opacity: 0; transform: translate(-50%, 8px) scale(0.96); } to { opacity: 1; transform: translate(-50%, 0) scale(1); }`;
const slideDown = keyframes`from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); }`;

/** 顶部中间:等级徽章 + 经验条 + 星光数 + 任务进度 */
export function GameStatusBar({ game, compact, questsOpen, onToggleQuests }: { game: WorldGame; compact: boolean; questsOpen: boolean; onToggleQuests: () => void }) {
  const { level, state } = game;
  const done = state.done.length;
  return (
    <Box sx={{
      ...glass, display: 'flex', alignItems: 'center', gap: compact ? 1 : 1.5,
      borderRadius: 999, pl: 0.6, pr: compact ? 0.6 : 1, py: 0.5, pointerEvents: 'auto',
    }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
        background: `conic-gradient(${CYAN} ${(level.into / level.need) * 360}deg, rgba(255,255,255,0.12) 0deg)`,
      }}>
        <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#0b0e1a', display: 'grid', placeItems: 'center' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{level.level}</Typography>
        </Box>
      </Box>
      {!compact && (
        <Box sx={{ minWidth: 118 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{level.title}</Typography>
          <LinearProgress
            variant="determinate"
            value={(level.into / level.need) * 100}
            sx={{ mt: 0.4, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.12)', '& .MuiLinearProgress-bar': { borderRadius: 2, background: `linear-gradient(90deg, ${CYAN}, ${PINK})` } }}
          />
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', mt: 0.2 }}>{level.into} / {level.need} 经验</Typography>
        </Box>
      )}
      <Tooltip title="累计捡到的星光">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 999, bgcolor: 'rgba(255,201,61,0.12)' }}>
          <Box component="span" sx={{ fontSize: 14 }}>✨</Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: GOLD, fontVariantNumeric: 'tabular-nums' }}>{state.orbsTotal}</Typography>
        </Box>
      </Tooltip>
      <ButtonBase
        onClick={onToggleQuests}
        aria-expanded={questsOpen}
        aria-label="今日任务"
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.4, borderRadius: 999,
          bgcolor: questsOpen ? 'rgba(37,244,238,0.2)' : 'rgba(255,255,255,0.08)', color: questsOpen ? CYAN : '#fff',
          '&:hover': { bgcolor: 'rgba(37,244,238,0.18)' },
        }}
      >
        <FlagRoundedIcon sx={{ fontSize: 16 }} />
        <Typography sx={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{done}/{QUESTS.length}</Typography>
      </ButtonBase>
    </Box>
  );
}

/** 今日任务清单 */
export function QuestPanel({ game, children }: { game: WorldGame; children?: React.ReactNode }) {
  const { state } = game;
  return (
    <Box sx={{ ...glass, borderRadius: 3, p: 1.5, width: 280, maxWidth: 'calc(100vw - 24px)', pointerEvents: 'auto', animation: `${slideDown} .18s ease-out` }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>今日任务</Typography>
        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>每完成一项 +60 经验 · 每天刷新</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {QUESTS.map((q) => {
          const v = state.quests[q.id] ?? 0;
          const complete = state.done.includes(q.id);
          return (
            <Box key={q.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: complete ? 0.6 : 1 }}>
              <Box sx={{ width: 28, height: 28, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: complete ? 'rgba(157,255,203,0.15)' : 'rgba(255,255,255,0.06)', fontSize: 15, flexShrink: 0 }}>
                {complete ? '✅' : q.emoji}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography sx={{ fontSize: 12, color: '#fff', textDecoration: complete ? 'line-through' : 'none' }} noWrap>{q.label}</Typography>
                  <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{Math.min(v, q.target)}/{q.target}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(Math.min(v, q.target) / q.target) * 100}
                  sx={{ mt: 0.4, height: 3, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: complete ? '#9dffcb' : CYAN } }}
                />
              </Box>
            </Box>
          );
        })}
      </Box>
      {children}
    </Box>
  );
}

/**
 * 小地图:上方 = 舞台后方(远离默认机位),和默认视角一致。
 * 点地图上任意位置,角色就走过去;点地标图标走到那个地标。
 */
export function Minimap({ handle, size }: { handle: VrmStageHandle | null; size: number }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const handleRef = React.useRef(handle);
  handleRef.current = handle;
  const pad = 8;
  const scale = (size / 2 - pad) / (WORLD_RADIUS + 0.5);

  React.useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = size * dpr; cv.height = size * dpr;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    // 隐藏的标签页里 rAF 会停,用定时器画(10fps 足够)
    const id = window.setInterval(() => {
      const snap = handleRef.current?.getWorldSnapshot();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const c = size / 2;
      const P = (x: number, z: number) => [c + x * scale, c + z * scale] as const;
      // 底
      ctx.beginPath(); ctx.arc(c, c, WORLD_RADIUS * scale + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8,10,20,0.7)'; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(37,244,238,0.45)'; ctx.stroke();
      // 内环 + 小路
      ctx.beginPath(); ctx.arc(c, c, 5.2 * scale, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(37,244,238,0.22)'; ctx.lineWidth = 1; ctx.stroke();
      for (const z of WORLD_ZONES) {
        const d = Math.hypot(z.x, z.z) || 1;
        const [x0, y0] = P((z.x / d) * 5.2, (z.z / d) * 5.2);
        const [x1, y1] = P(z.x, z.z);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      // 舞台
      ctx.beginPath(); ctx.arc(c, c, 2.2 * scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,79,216,0.18)'; ctx.fill();
      // 星光
      for (const o of snap?.orbs ?? []) {
        const [x, y] = P(o.x, o.z);
        ctx.beginPath(); ctx.arc(x, y, o.golden ? 2.6 : 1.8, 0, Math.PI * 2);
        ctx.fillStyle = o.golden ? GOLD : '#fff6c8'; ctx.fill();
      }
      // 地标
      ctx.font = `${Math.round(size / 11)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const z of WORLD_ZONES) {
        const [x, y] = P(z.x, z.z);
        const active = snap?.zone === z.id;
        ctx.beginPath(); ctx.arc(x, y, size / 15, 0, Math.PI * 2);
        ctx.fillStyle = active ? `#${z.color.toString(16).padStart(6, '0')}55` : 'rgba(255,255,255,0.08)'; ctx.fill();
        ctx.fillText(z.emoji, x, y + 1);
      }
      if (!snap) return;
      // 广场里的其他人
      for (const p of snap.peers ?? []) {
        const [x, y] = P(p.x, p.z);
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = p.aura && p.aura !== 'rainbow' ? p.aura : '#c9a6ff'; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
      }
      const [ax, ay] = P(snap.x, snap.z);
      // 镜头视野扇形
      const camA = Math.atan2(Math.cos(snap.camYaw), Math.sin(snap.camYaw)); // 世界 (sin,cos) → 画布角度
      ctx.beginPath(); ctx.moveTo(ax, ay);
      ctx.arc(ax, ay, size * 0.2, camA - 0.4, camA + 0.4);
      ctx.closePath();
      const grd = ctx.createRadialGradient(ax, ay, 0, ax, ay, size * 0.2);
      grd.addColorStop(0, 'rgba(37,244,238,0.35)'); grd.addColorStop(1, 'rgba(37,244,238,0)');
      ctx.fillStyle = grd; ctx.fill();
      // 角色箭头
      const fa = Math.atan2(Math.cos(snap.yaw), Math.sin(snap.yaw));
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(fa);
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, 4.5); ctx.lineTo(-2.5, 0); ctx.lineTo(-5, -4.5); ctx.closePath();
      ctx.fillStyle = '#fff'; ctx.shadowColor = CYAN; ctx.shadowBlur = 6; ctx.fill();
      ctx.restore();
    }, 100);
    return () => window.clearInterval(id);
  }, [size, scale]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left - size / 2) / scale;
    const z = (e.clientY - r.top - size / 2) / scale;
    // 点在地标图标上:走到地标跟前
    const hit = WORLD_ZONES.find((zn) => Math.hypot(zn.x - x, zn.z - z) < (size / 15) / scale + 0.4);
    if (hit) {
      const d = Math.hypot(hit.x, hit.z) || 1;
      const stand = hit.solidRadius + 0.7;
      handle?.walkTo(hit.x - (hit.x / d) * stand, hit.z - (hit.z / d) * stand);
    } else {
      handle?.walkTo(x, z);
    }
  };

  return (
    <Tooltip title="小地图:点哪儿走到哪儿" placement="left">
      <Box component="canvas" ref={canvasRef} onClick={onClick} sx={{ width: size, height: size, display: 'block', cursor: 'crosshair', borderRadius: '50%', pointerEvents: 'auto', filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.5))' }} />
    </Tooltip>
  );
}

/** 小地图下面的一列圆按钮:俯瞰 / 回舞台 / 操作说明 */
export function WorldTools({ game, onHelp, onShop, shopOpen }: { game: WorldGame; onHelp: () => void; onShop?: () => void; shopOpen?: boolean }) {
  const btn = (active = false) => ({
    ...glass, width: 36, height: 36, color: active ? CYAN : 'rgba(255,255,255,0.85)',
    bgcolor: active ? 'rgba(37,244,238,0.18)' : glass.bgcolor, pointerEvents: 'auto' as const,
    '&:hover': { bgcolor: 'rgba(37,244,238,0.2)' },
  });
  return (
    <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center' }}>
      <Tooltip title={game.overview ? '回到角色身边' : '俯瞰整座广场'}>
        <IconButton aria-label="俯瞰" onClick={game.toggleOverview} sx={btn(game.overview)}><ExploreRoundedIcon sx={{ fontSize: 19 }} /></IconButton>
      </Tooltip>
      <Tooltip title="回到舞台中央">
        <IconButton aria-label="回舞台" onClick={game.goHome} sx={btn()}><HomeRoundedIcon sx={{ fontSize: 19 }} /></IconButton>
      </Tooltip>
      {onShop && (
        <Tooltip title="广场光环">
          <IconButton aria-label="广场光环" onClick={onShop} sx={btn(!!shopOpen)}><AutoAwesomeRoundedIcon sx={{ fontSize: 19 }} /></IconButton>
        </Tooltip>
      )}
      <Tooltip title="操作说明">
        <IconButton aria-label="操作说明" onClick={onHelp} sx={btn()}><HelpOutlineRoundedIcon sx={{ fontSize: 19 }} /></IconButton>
      </Tooltip>
    </Box>
  );
}

/** 走进地标时,画面下方弹出的互动卡 */
export function ZonePrompt({ game, bottom, touch }: { game: WorldGame; bottom: string; touch: boolean }) {
  const z = game.zone ? ZONE_BY_ID[game.zone] : null;
  if (!z) return null;
  const color = `#${z.color.toString(16).padStart(6, '0')}`;
  return (
    <Box key={z.id} sx={{
      position: 'absolute', left: '50%', bottom, zIndex: 4, transform: 'translateX(-50%)',
      animation: `${popIn} .22s ease-out`, pointerEvents: 'auto',
      ...glass, borderRadius: 3, border: `1px solid ${color}66`,
      display: 'flex', alignItems: 'center', gap: 1.5, pl: 1.5, pr: 1, py: 1, maxWidth: 'calc(100vw - 24px)',
    }}>
      <Box sx={{ fontSize: 26, lineHeight: 1 }}>{z.emoji}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{z.label}</Typography>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} noWrap>{z.hint}</Typography>
      </Box>
      <ButtonBase
        onClick={game.interact}
        sx={{
          ml: 0.5, px: 1.5, py: 0.9, borderRadius: 2, flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#0b0e1a',
          background: `linear-gradient(135deg, ${color}, #ffffff)`, boxShadow: `0 0 18px ${color}88`,
          '&:hover': { filter: 'brightness(1.08)' },
        }}
      >
        {z.actionLabel}
        {!touch && <Box component="kbd" sx={{ ml: 0.75, px: 0.6, borderRadius: 0.75, fontSize: 10, fontFamily: 'inherit', bgcolor: 'rgba(0,0,0,0.18)' }}>F</Box>}
      </ButtonBase>
    </Box>
  );
}

/** 顶部中间的提示条(任务完成、升级) */
export function GameToasts({ game }: { game: WorldGame }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
      {game.toasts.map((t) => (
        <Box key={t.id} role="status" sx={{
          ...glass, borderRadius: 999, px: 1.75, py: 0.75, display: 'flex', alignItems: 'center', gap: 1,
          animation: `${slideDown} .2s ease-out`,
          border: `1px solid ${t.tone === 'level' ? GOLD : t.tone === 'quest' ? '#9dffcb' : 'rgba(255,255,255,0.15)'}66`,
        }}>
          <Box component="span" sx={{ fontSize: 16 }}>{t.icon}</Box>
          <Typography sx={{ fontSize: 12.5, color: '#fff', fontWeight: 600 }}>{t.text}</Typography>
        </Box>
      ))}
    </Box>
  );
}

const HELP_KEY = 'dh_world_help_seen';

/** 第一次进来时的操作说明;之后从「?」按钮打开 */
export function useWorldHelp() {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    try { if (!localStorage.getItem(HELP_KEY)) setOpen(true); } catch { /* 隐私模式:不弹 */ }
  }, []);
  const close = React.useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(HELP_KEY, '1'); } catch { /* ignore */ }
  }, []);
  return { open, show: () => setOpen(true), close };
}

export function WorldHelp({ onClose, touch }: { onClose: () => void; touch: boolean }) {
  const rows: [string, string][] = touch
    ? [['点地面', '走过去'], ['点地标 / 小地图', '直接前往'], ['点她', '戳一戳'], ['双指 / 拖动', '转镜头、缩放'], ['走进地标', '弹出互动']]
    : [['W A S D / 方向键', '走动'], ['Shift', '奔跑'], ['点地面 / 小地图', '走过去'], ['点她', '戳一戳'], ['Q / E · 拖动 · 滚轮', '转镜头、缩放'], ['空格', '跳一下'], ['F', '和地标互动']];
  return (
    <Box
      onClick={onClose}
      sx={{ position: 'absolute', inset: 0, zIndex: 6, display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,0.35)', animation: `${slideDown} .2s ease-out` }}
    >
      <Box onClick={(e) => e.stopPropagation()} sx={{ ...glass, borderRadius: 4, p: 2.5, width: 340, maxWidth: 'calc(100vw - 32px)' }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>欢迎来到星光广场 ✨</Typography>
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', mt: 0.5, mb: 2 }}>
          带她四处逛逛:捡星光攒经验,去地标看电影、听歌、许愿。聊天随时都能继续。
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1, alignItems: 'center' }}>
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <Box component="kbd" sx={{ fontFamily: 'inherit', fontSize: 11, color: CYAN, px: 0.8, py: 0.3, borderRadius: 1, border: '1px solid rgba(37,244,238,0.35)', bgcolor: 'rgba(37,244,238,0.08)', whiteSpace: 'nowrap', justifySelf: 'start' }}>{k}</Box>
              <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>{v}</Typography>
            </React.Fragment>
          ))}
        </Box>
        <ButtonBase onClick={onClose} sx={{ mt: 2.5, width: '100%', py: 1.1, borderRadius: 2, fontSize: 14, fontWeight: 700, color: '#0b0e1a', background: `linear-gradient(135deg, ${CYAN}, ${PINK})` }}>
          出发
        </ButtonBase>
      </Box>
    </Box>
  );
}
