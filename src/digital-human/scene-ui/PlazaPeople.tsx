'use client';

/**
 * scene-ui/PlazaPeople.tsx — 广场里的人物与场景
 *
 *   CharacterPanel  和人物说话:
 *     - 诗人:只念他自己写过的、这个主题的句子(/insight/voice),小传是诗词语料原文(/poetry/poet)。
 *       没有 LLM 参与;想听解读就「请她讲讲」—— 交给数字人,在对话里说,和史料分开。
 *     - 引路人:运营写的台词;挂了感悟分组的,先念分组题记(原句 + 出处)。
 *   ScenePicker     换场景:星光广场、四座感悟庭院,以及运营后来加的。
 */

import React from 'react';
import { Box, ButtonBase, CircularProgress, IconButton, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { overview as insightOverview, voice as insightVoice, type InsightVoiceLine } from '@/apis/insight';
import { poet as fetchPoet, type PoetDetail } from '@/apis/poetry';
import type { WorldCharacter, WorldDef } from '../vrm/world/worldLayout';
import type { DisplaySlot } from '../vrm/sceneDisplays';
import { contentHref } from './content';

const glass = {
  bgcolor: 'rgba(14,10,22,0.8)',
  backdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.1)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
} as const;
const slideIn = keyframes`from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); }`;
const serif = '"Noto Serif SC","Songti SC","STSong",serif';
const hexOf = (c: number | undefined, fallback: string) => (c === undefined ? fallback : `#${c.toString(16).padStart(6, '0')}`);

/**
 * 语料里有的小传是同一段话重复了好几遍(合并多个来源时留下的),原样展示会刷屏。
 * 只去掉整段的重复,不改动任何一个字。
 */
export function dedupeBio(text: string): string {
  const head = text.slice(0, 24);
  if (head.length < 12) return text;
  const again = text.indexOf(head, head.length);
  return again > 0 ? text.slice(0, again).trim() : text;
}

// 感悟分组的题记:整页只拉一次
let groupsCache: Promise<Record<string, { name: string; line: string; lineSrc: string }>> | null = null;
function loadGroups() {
  if (!groupsCache) {
    groupsCache = insightOverview()
      .then((r) => Object.fromEntries((r?.groups ?? []).map((g) => [g.key, { name: g.name, line: g.line, lineSrc: g.lineSrc }])))
      .catch(() => { groupsCache = null; return {}; });
  }
  return groupsCache;
}

export interface CharacterPanelProps {
  character: WorldCharacter;
  /** 感悟主题的中文名(诗人面板标题用) */
  themeName?: string;
  width: number | string;
  onClose: () => void;
  onOpen: (href: string, slot?: DisplaySlot) => void;
  /** 请数字人讲讲(走正常对话) */
  onAskHer: (text: string) => void;
  /** 让场景里的人物开口(头顶冒字) */
  onSay: (text: string) => void;
  onOpenScenes: () => void;
}

export function CharacterPanel(props: CharacterPanelProps) {
  return props.character.kind === 'poet' ? <PoetPanel {...props} /> : <GuidePanel {...props} />;
}

function Shell({ c, subtitle, onClose, width, children, footnote }: { c: WorldCharacter; subtitle?: string; onClose: () => void; width: number | string; children: React.ReactNode; footnote?: string }) {
  const accent = hexOf(c.color, c.kind === 'poet' ? '#b9a6ff' : '#25F4EE');
  return (
    <Box sx={{ ...glass, borderRadius: 3, width, maxWidth: 'calc(100vw - 24px)', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: `2px solid ${accent}`, animation: `${slideIn} .2s ease-out`, pointerEvents: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, pt: 1.25, pb: 0.75 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: `${accent}26`, color: accent, fontFamily: serif, fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
          {(c.name || '…').slice(0, 1)}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: serif }} noWrap>{c.name || '…'}</Typography>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} noWrap>{[c.title, subtitle].filter(Boolean).join(' · ')}</Typography>
        </Box>
        <IconButton size="small" aria-label="收起" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)' }}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>
      <Box sx={{ overflowY: 'auto', px: 1.5, pb: 1.25, minHeight: 0 }}>{children}</Box>
      {footnote && <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', px: 1.5, pb: 1 }}>{footnote}</Typography>}
    </Box>
  );
}

function Btn({ children, onClick, primary, accent }: { children: React.ReactNode; onClick: () => void; primary?: boolean; accent: string }) {
  return (
    <ButtonBase onClick={onClick} sx={{
      flex: primary ? 1 : undefined, px: 1.4, py: 0.85, borderRadius: 2, fontSize: 12.5, fontWeight: 700,
      color: primary ? '#140e1a' : '#fff', background: primary ? `linear-gradient(135deg, ${accent}, #fff)` : 'rgba(255,255,255,0.08)',
    }}>{children}</ButtonBase>
  );
}

function PoetPanel({ character: c, themeName, width, onClose, onOpen, onAskHer, onSay }: CharacterPanelProps) {
  const name = c.poet || c.name;
  const accent = hexOf(c.color, '#b9a6ff');
  const [lines, setLines] = React.useState<InsightVoiceLine[] | null>(null);
  const [bio, setBio] = React.useState<PoetDetail | null>(null);
  const [idx, setIdx] = React.useState(0);
  const saidRef = React.useRef(false);

  React.useEffect(() => {
    if (!name || !c.themeKey) return;
    let alive = true;
    setLines(null);
    insightVoice(c.themeKey, name, 5)
      .then((r) => { if (alive) setLines(Array.isArray(r?.lines) ? r.lines : []); })
      .catch(() => { if (alive) setLines([]); });
    fetchPoet({ name, size: 1 })
      .then((p) => { if (alive && p && typeof p === 'object' && 'name' in p) setBio(p); })
      .catch(() => {});
    return () => { alive = false; };
  }, [name, c.themeKey]);

  // 一打开就念第一句(人物头顶冒字)
  React.useEffect(() => {
    if (!lines?.length || saidRef.current) return;
    saidRef.current = true;
    onSay(lines[0].line);
  }, [lines, onSay]);

  const cur = lines?.[idx];
  const years = bio?.birthYear || bio?.deathYear ? `${bio?.birthYear ?? '?'}–${bio?.deathYear ?? '?'}` : '';
  const bioText = dedupeBio((bio?.bio ?? '').replace(/\s+/g, ' ').trim());

  return (
    <Shell c={c} subtitle={[bio?.dynasty, years, themeName && `说「${themeName}」`].filter(Boolean).join(' · ')} onClose={onClose} width={width}
      footnote="句子与小传均为诗词语料原文(chinese-poetry,CC BY-SA 4.0),未经改写;解读请她来讲。">
      {!name && <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', py: 1 }}>正在找写这个主题最多的诗人…</Typography>}
      {name && lines === null && <Box sx={{ py: 2, display: 'grid', placeItems: 'center' }}><CircularProgress size={18} sx={{ color: accent }} /></Box>}
      {cur && (
        <ButtonBase
          onClick={() => { const h = contentHref({ id: cur.poemId, contentType: 'POETRY', title: cur.title }); if (h) onOpen(h, 'kiosk'); }}
          sx={{ display: 'block', width: '100%', textAlign: 'left', p: 1.5, mb: 1, borderRadius: 2, bgcolor: `${accent}14`, border: `1px solid ${accent}33` }}
        >
          <Typography sx={{ fontSize: 17, color: '#fff', lineHeight: 1.7, fontFamily: serif, letterSpacing: 1 }}>{cur.line}</Typography>
          <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', mt: 0.5, textAlign: 'right' }}>—— {cur.author}《{cur.title}》</Typography>
        </ButtonBase>
      )}
      {lines && lines.length === 0 && name && (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', py: 1 }}>
          语料里没找到{name}写「{themeName || '这个主题'}」的句子。
        </Typography>
      )}
      {bioText && (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, mb: 1, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {bioText}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {cur && (
          <Btn primary accent={accent} onClick={() => onAskHer(`给我讲讲${cur.author}的《${cur.title}》,尤其是「${cur.line}」这一句`)}>✨ 请她讲讲这首</Btn>
        )}
        {lines && lines.length > 1 && (
          <Btn accent={accent} onClick={() => { const n = (idx + 1) % lines.length; setIdx(n); onSay(lines[n].line); }}>再听一句</Btn>
        )}
        {name && <Btn accent={accent} onClick={() => onOpen(`/poetry/poet?name=${encodeURIComponent(name)}`, 'kiosk')}>读他的诗</Btn>}
        {c.themeKey && <Btn accent={accent} onClick={() => onOpen(`/insight/theme?key=${encodeURIComponent(c.themeKey!)}`, 'kiosk')}>这份感悟</Btn>}
      </Box>
    </Shell>
  );
}

function GuidePanel({ character: c, width, onClose, onSay, onOpenScenes, onOpen }: CharacterPanelProps) {
  const accent = hexOf(c.color, '#25F4EE');
  const [group, setGroup] = React.useState<{ name: string; line: string; lineSrc: string } | null>(null);
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    if (!c.groupKey) return;
    let alive = true;
    loadGroups().then((g) => { if (alive) setGroup(g[c.groupKey!] ?? null); });
    return () => { alive = false; };
  }, [c.groupKey]);
  const lines = c.lines ?? [];
  // 开口先念题记(有的话),再念运营写的台词
  const said = React.useRef(false);
  React.useEffect(() => {
    if (said.current) return;
    if (c.groupKey && !group) return; // 等题记到了再开口
    said.current = true;
    const first = group?.line || lines[0];
    if (first) onSay(first);
  }, [group, c.groupKey, lines, onSay]);

  return (
    <Shell c={c} subtitle={group?.name} onClose={onClose} width={width}>
      {group && (
        <Box sx={{ p: 1.5, mb: 1, borderRadius: 2, bgcolor: `${accent}14`, border: `1px solid ${accent}33` }}>
          <Typography sx={{ fontSize: 15, color: '#fff', lineHeight: 1.7, fontFamily: serif }}>「{group.line}」</Typography>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', mt: 0.5, textAlign: 'right' }}>—— {group.lineSrc}</Typography>
        </Box>
      )}
      {lines.length > 0 && (
        <Typography sx={{ fontSize: 13.5, color: 'rgba(255,255,255,0.88)', lineHeight: 1.7, mb: 1 }}>{lines[idx % lines.length]}</Typography>
      )}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        {lines.length > 1 && (
          <Btn accent={accent} onClick={() => { const n = (idx + 1) % lines.length; setIdx(n); onSay(lines[n]); }}>下一句</Btn>
        )}
        <Btn primary accent={accent} onClick={onOpenScenes}>🧭 去别的场景</Btn>
        {c.groupKey && <Btn accent={accent} onClick={() => onOpen('/insight', 'kiosk')}>人生感悟专题</Btn>}
      </Box>
    </Shell>
  );
}

// ==================== 场景选择 ====================

const GROUP_EMOJI: Record<string, string> = { wound: '🌙', bond: '🏮', qiqing: '🎐', liuyu: '🌱' };

/** extra:列表下面再放一块(创世的「房间 / 串门」);房间不在上面的网格里重复出现 */
export function ScenePicker({ defs, current, onPick, onClose, extra }: { defs: WorldDef[]; current: string; onPick: (key: string) => void; onClose: () => void; extra?: React.ReactNode }) {
  return (
    <Box onClick={onClose} sx={{ position: 'absolute', inset: 0, zIndex: 6, display: 'grid', placeItems: 'center', bgcolor: 'rgba(0,0,0,0.4)' }}>
      <Box onClick={(e) => e.stopPropagation()} sx={{ ...glass, borderRadius: 4, p: 2, width: 560, maxWidth: 'calc(100vw - 24px)', maxHeight: 'calc(100vh - 48px)', overflowY: 'auto', animation: `${slideIn} .2s ease-out` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: '#fff', flex: 1 }}>去哪儿走走</Typography>
          <IconButton size="small" aria-label="关闭" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)' }}><CloseRoundedIcon /></IconButton>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25 }}>
          {defs.filter((d) => d.kind !== 'room').map((d) => {
            const active = d.key === current;
            const accent = hexOf(d.palette?.accent, d.kind === 'insight' ? '#b9a6ff' : '#25F4EE');
            return (
              <ButtonBase
                key={d.key}
                onClick={() => onPick(d.key)}
                sx={{
                  display: 'block', textAlign: 'left', p: 1.5, borderRadius: 3,
                  bgcolor: active ? `${accent}22` : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? accent : 'transparent'}`,
                  '&:hover': { bgcolor: `${accent}1a` },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Box sx={{ fontSize: 22 }}>{d.kind === 'insight' ? GROUP_EMOJI[d.group ?? ''] ?? '🌙' : '✨'}</Box>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: d.kind === 'insight' ? serif : undefined }}>{d.name}</Typography>
                  {d.kind === 'insight' && <Typography sx={{ fontSize: 10, color: accent, border: `1px solid ${accent}66`, borderRadius: 1, px: 0.5 }}>人生感悟</Typography>}
                  {active && <Typography sx={{ fontSize: 10, color: '#9dffcb', ml: 'auto' }}>当前</Typography>}
                </Box>
                {d.intro && <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{d.intro}</Typography>}
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>{d.zones.map((z) => z.label).join(' · ')}</Typography>
              </ButtonBase>
            );
          })}
        </Box>
        {extra}
      </Box>
    </Box>
  );
}
