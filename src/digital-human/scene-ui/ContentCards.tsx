'use client';

/**
 * ContentCards — 数字人界面里的作品卡片。
 *
 * 同一份数据两种摆法:
 *   - variant="panel":数字人身旁那块 3D 面板里的完整视图(网格 / 歌曲列表 + 选中项的操作条)
 *   - variant="chat" :对话流里的一条横向卡片带,补上原来只有文字气泡的聊天窗
 *
 * 卡片认得作品类型:歌能直接播、加队列、整批存成歌单;影视/小说/文章直接打开;
 * 所有操作都在前端完成,不用再绕一圈模型。只有「问问它」「找相似」才回到对话里。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PlaylistAddRoundedIcon from '@mui/icons-material/PlaylistAddRounded';
import QueueMusicRoundedIcon from '@mui/icons-material/QueueMusicRounded';
import LibraryAddRoundedIcon from '@mui/icons-material/LibraryAddRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlaylistPicker from '@/components/player/PlaylistPicker';
import { useContentInteraction } from '@/hooks/useContentInteraction';
import { mediaUrl } from '@/lib/media';
import { currentTrack, musicPlayer, useMusicPlayer } from '@/lib/player/musicPlayer';
import { playTracks, queueTracks, type TrackSeed } from '@/lib/player/playlist';
import { cardShape, contentHref, contentTypeLabel, isMusic, openVerb, type CardShape, type ContentRef } from './content';

const ACCENT = '#25F4EE';
const TEXT = 'rgba(255,255,255,0.92)';
const SUBTEXT = 'rgba(255,255,255,0.55)';
const TILE_BG = 'rgba(255,255,255,0.05)';
const TILE_BORDER = '1px solid rgba(255,255,255,0.09)';

const TYPE_ICON: Record<string, string> = {
  MUSIC: '🎵', FILM: '🎬', TELEPLAY: '📺', SHORT_DRAMA: '🎭', ANIMATION: '✨', COMICS: '📖', NOVEL: '📚',
  VIDEO: '▶️', VSHOW: '🎤', LIVE: '🔴', ARTICLE: '📝', NEWS: '📰', WALLPAPER: '🖼️', PERSON: '👤',
};

const RATIO: Record<CardShape, string> = { poster: '3 / 4', square: '1 / 1', wide: '16 / 9', text: '16 / 9', avatar: '1 / 1' };

export interface ContentCardsProps {
  items: ContentRef[];
  variant: 'panel' | 'chat';
  /** 这批作品叫什么(播放来源、新建歌单时的默认名) */
  label?: string;
  /** 打开作品详情。入口组件决定是当前页跳转还是新标签(全屏数字人页不能把对话丢了) */
  onOpen: (href: string) => void;
  /** 把一句话作为用户的下一轮输入发给数字人 */
  onSend?: (text: string) => void;
}

const seed = (r: ContentRef): TrackSeed => ({ id: r.id, title: r.title, artist: r.author, cover: r.cover });

export default function ContentCards({ items, variant, label, onOpen, onSend }: ContentCardsProps) {
  const songs = React.useMemo(() => items.filter(isMusic), [items]);
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const [picker, setPicker] = React.useState<string[] | null>(null);
  const [toast, setToast] = React.useState('');
  const playingId = useMusicPlayer((s) => (s.playing || s.buffering ? currentTrack(s)?.id : undefined));
  const focus = items.find((r) => r.id === focusId) ?? null;
  const source = { kind: 'assistant' as const, name: label || '小月找的歌' };

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const playSong = (r: ContentRef) => {
    if (playingId === r.id) return musicPlayer.toggle();
    // 从这首开始,同批的歌一起进队列 —— 放完这首自动接下一首
    playTracks(songs.map(seed), { startId: r.id, source });
  };

  const open = (r: ContentRef) => {
    const href = contentHref(r);
    if (href) onOpen(href);
    else setToast('这类内容暂时没有详情页');
  };

  const primary = (r: ContentRef) => {
    if (isMusic(r)) return playSong(r);
    if (variant === 'chat') return open(r);
    setFocusId((cur) => (cur === r.id ? null : r.id));
  };

  const songBar = songs.length > 0 && (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
      <Pill icon={<PlayArrowRoundedIcon sx={{ fontSize: 16 }} />} solid onClick={() => playTracks(songs.map(seed), { source })}>
        {songs.length > 1 ? `播放全部 ${songs.length} 首` : '播放'}
      </Pill>
      <Pill
        icon={<QueueMusicRoundedIcon sx={{ fontSize: 15 }} />}
        onClick={() => {
          const n = queueTracks(songs.map(seed));
          setToast(n > 0 ? `已加入播放队列 · ${n} 首` : '已经在播放队列里了');
        }}
      >
        加入队列
      </Pill>
      <Pill icon={<LibraryAddRoundedIcon sx={{ fontSize: 15 }} />} onClick={() => setPicker(songs.map((s) => s.id))}>
        存为歌单
      </Pill>
    </Box>
  );

  const extras = (
    <>
      {toast && (
        <Box role="status" sx={{ fontSize: 12, color: ACCENT, mt: 0.75 }}>
          {toast}
        </Box>
      )}
      <PlaylistPicker open={!!picker} onClose={() => setPicker(null)} contentIds={picker ?? []} suggestName={label} onDone={setToast} />
    </>
  );

  if (variant === 'chat') {
    return (
      <Box sx={{ alignSelf: 'stretch', minWidth: 0 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            overflowX: 'auto',
            pb: 0.75,
            scrollSnapType: 'x proximity',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.25) transparent',
          }}
        >
          {items.map((r) => (
            <Tile key={r.id} item={r} width={cardShape(r) === 'wide' || cardShape(r) === 'text' ? 176 : 112} playing={playingId === r.id} onPrimary={() => primary(r)} onOpen={() => open(r)} compact />
          ))}
        </Box>
        {songBar}
        {extras}
      </Box>
    );
  }

  const allSongs = songs.length === items.length;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: '100%' }}>
      {songBar}
      {allSongs ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {items.map((r, i) => (
            <SongRow
              key={r.id}
              index={i}
              item={r}
              playing={playingId === r.id}
              onPlay={() => playSong(r)}
              onQueue={() => setToast(queueTracks([seed(r)]) > 0 ? `「${r.title}」已加入队列` : '已经在播放队列里了')}
              onAdd={() => setPicker([r.id])}
              onOpen={() => open(r)}
            />
          ))}
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.25, alignItems: 'start' }}>
          {items.map((r) => (
            <Tile key={r.id} item={r} playing={playingId === r.id} selected={focusId === r.id} onPrimary={() => primary(r)} onOpen={() => open(r)} />
          ))}
        </Box>
      )}
      {extras}
      {focus && (
        <FocusBar
          item={focus}
          onClose={() => setFocusId(null)}
          onOpen={() => open(focus)}
          onSend={onSend}
          onToast={setToast}
        />
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------

function Cover({ item, ratio, round }: { item: ContentRef; ratio: string; round?: boolean }) {
  const [broken, setBroken] = React.useState(false);
  const src = mediaUrl(item.cover);
  return (
    <Box sx={{ width: '100%', aspectRatio: ratio, borderRadius: round ? '50%' : 0, overflow: 'hidden', bgcolor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
      {src && !broken ? (
        <Box component="img" src={src} alt="" loading="lazy" onError={() => setBroken(true)} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <span aria-hidden>{TYPE_ICON[item.contentType] || '🎬'}</span>
      )}
    </Box>
  );
}

function Tile({
  item, width, playing, selected, compact, onPrimary, onOpen,
}: {
  item: ContentRef;
  width?: number;
  playing: boolean;
  selected?: boolean;
  compact?: boolean;
  onPrimary: () => void;
  onOpen: () => void;
}) {
  const shape = cardShape(item);
  const song = isMusic(item);
  const typeLabel = contentTypeLabel(item);
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={song ? `${playing ? '暂停' : '播放'} ${item.title}` : `${item.title}${typeLabel ? `,${typeLabel}` : ''}`}
      onClick={onPrimary}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPrimary();
        }
      }}
      sx={{
        width,
        flexShrink: 0,
        scrollSnapAlign: 'start',
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        border: TILE_BORDER,
        borderColor: selected || playing ? ACCENT : undefined,
        background: TILE_BG,
        transition: 'border-color .15s, transform .15s',
        '&:hover': { borderColor: ACCENT, transform: 'translateY(-2px)' },
        '&:hover .ov, &:focus-visible .ov': { opacity: 1 },
        '&:focus-visible': { outline: `2px solid ${ACCENT}`, outlineOffset: 2 },
        '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
      }}
    >
      <Box sx={{ position: 'relative', p: shape === 'avatar' ? 1.25 : 0 }}>
        <Cover item={item} ratio={RATIO[shape]} round={shape === 'avatar'} />
        {song && (
          <Box className="ov" sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', opacity: playing ? 1 : { xs: 1, md: 0 }, transition: 'opacity .15s' }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: ACCENT, color: '#04121a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {playing ? <PauseRoundedIcon /> : <PlayArrowRoundedIcon />}
            </Box>
          </Box>
        )}
        {typeLabel && (
          <Box sx={{ position: 'absolute', top: 5, left: 5, px: 0.6, borderRadius: 0.75, fontSize: 10, lineHeight: '16px', color: item.contentType === 'LIVE' ? '#fff' : ACCENT, bgcolor: item.contentType === 'LIVE' ? '#FE2C55' : 'rgba(0,0,0,0.62)' }}>
            {typeLabel}
          </Box>
        )}
        {song && (
          <Tooltip title="歌曲页">
            <IconButton
              size="small"
              aria-label={`打开 ${item.title} 的歌曲页`}
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              sx={{ position: 'absolute', top: 2, right: 2, color: '#fff', bgcolor: 'rgba(0,0,0,0.45)', p: 0.4, '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
            >
              <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Box sx={{ p: compact ? 0.75 : 1 }}>
        <Typography sx={{ fontSize: compact ? 12 : 13, color: TEXT, fontWeight: 500, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: shape === 'text' || shape === 'wide' ? 2 : 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.title}
        </Typography>
        {(item.note || item.author) && (
          <Typography sx={{ fontSize: 11, color: SUBTEXT, mt: 0.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.note || item.author}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function SongRow({
  item, index, playing, onPlay, onQueue, onAdd, onOpen,
}: {
  item: ContentRef;
  index: number;
  playing: boolean;
  onPlay: () => void;
  onQueue: () => void;
  onAdd: () => void;
  onOpen: () => void;
}) {
  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25, p: 1, borderRadius: 2,
        border: TILE_BORDER, borderColor: playing ? ACCENT : undefined, background: playing ? 'rgba(37,244,238,0.08)' : TILE_BG,
        '&:hover': { borderColor: ACCENT },
      }}
    >
      <Box sx={{ width: 18, textAlign: 'center', fontSize: 12, color: playing ? ACCENT : SUBTEXT, fontVariantNumeric: 'tabular-nums' }}>{index + 1}</Box>
      <Box
        component="button"
        type="button"
        onClick={onPlay}
        aria-label={`${playing ? '暂停' : '播放'} ${item.title}`}
        sx={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 1.25, flex: 1, minWidth: 0, cursor: 'pointer', '&:focus-visible': { outline: `2px solid ${ACCENT}`, borderRadius: 1 } }}
      >
        <Box sx={{ width: 46, flexShrink: 0, borderRadius: 1.25, overflow: 'hidden', position: 'relative' }}>
          <Cover item={item} ratio="1 / 1" />
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'rgba(0,0,0,0.35)' }}>
            {playing ? <PauseRoundedIcon sx={{ fontSize: 22 }} /> : <PlayArrowRoundedIcon sx={{ fontSize: 22 }} />}
          </Box>
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 14, color: playing ? ACCENT : TEXT, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</Typography>
          <Typography sx={{ fontSize: 12, color: SUBTEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[item.author, item.note].filter(Boolean).join(' · ') || '未知歌手'}
          </Typography>
        </Box>
      </Box>
      <RowBtn title="加入播放队列" onClick={onQueue}><QueueMusicRoundedIcon sx={{ fontSize: 18 }} /></RowBtn>
      <RowBtn title="加入歌单" onClick={onAdd}><PlaylistAddRoundedIcon sx={{ fontSize: 19 }} /></RowBtn>
      <RowBtn title="歌曲页" onClick={onOpen}><OpenInNewRoundedIcon sx={{ fontSize: 16 }} /></RowBtn>
    </Box>
  );
}

function RowBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip title={title}>
      <IconButton size="small" aria-label={title} onClick={onClick} sx={{ color: SUBTEXT, '&:hover': { color: ACCENT } }}>
        {children}
      </IconButton>
    </Tooltip>
  );
}

/** 选中一张非音乐卡片后,面板底部出现的操作条 */
function FocusBar({
  item, onClose, onOpen, onSend, onToast,
}: {
  item: ContentRef;
  onClose: () => void;
  onOpen: () => void;
  onSend?: (t: string) => void;
  onToast: (m: string) => void;
}) {
  const it = useContentInteraction(item.id, { notify: (m: string) => onToast(m) });
  return (
    <Box
      sx={{
        position: 'sticky', bottom: -20, mt: 'auto', mx: -1, p: 1.5, borderRadius: 2.5,
        background: 'rgba(16,20,34,0.97)', border: `1px solid ${ACCENT}55`, boxShadow: '0 -8px 30px rgba(0,0,0,0.5)',
        display: 'flex', gap: 1.5,
      }}
    >
      <Box sx={{ width: 64, flexShrink: 0, borderRadius: 1.5, overflow: 'hidden', alignSelf: 'flex-start' }}>
        <Cover item={item} ratio={cardShape(item) === 'poster' ? '3 / 4' : '1 / 1'} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
          <Typography sx={{ flex: 1, fontSize: 15, fontWeight: 600, color: TEXT, lineHeight: 1.3 }}>{item.title}</Typography>
          <IconButton size="small" aria-label="收起" onClick={onClose} sx={{ color: SUBTEXT, mt: -0.5, mr: -0.5 }}>
            <CloseRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
        <Typography sx={{ fontSize: 12, color: SUBTEXT, mt: 0.25 }}>
          {[contentTypeLabel(item), item.author].filter(Boolean).join(' · ')}
        </Typography>
        {item.note && <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.78)', mt: 0.5 }}>{item.note}</Typography>}
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
          <Pill solid icon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />} onClick={onOpen}>
            {openVerb(item)}
          </Pill>
          <Pill
            icon={it.collectBusy ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : it.collected ? <StarRoundedIcon sx={{ fontSize: 15 }} /> : <StarBorderRoundedIcon sx={{ fontSize: 15 }} />}
            onClick={() => void it.toggleCollect()}
            active={it.collected}
          >
            {it.collected ? '已收藏' : '收藏'}
          </Pill>
          {onSend && (
            <>
              <Pill icon={<ChatBubbleOutlineRoundedIcon sx={{ fontSize: 14 }} />} onClick={() => onSend(`给我讲讲「${item.title}」`)}>
                问问它
              </Pill>
              <Pill icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} />} onClick={() => onSend(`再找几个和「${item.title}」类似的`)}>
                找相似
              </Pill>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export function Pill({
  children, icon, onClick, solid, active, disabled,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  onClick: () => void;
  solid?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      size="small"
      variant="text"
      disabled={disabled}
      onClick={onClick}
      startIcon={icon}
      sx={{
        minWidth: 0, px: 1.25, py: 0.35, borderRadius: 999, fontSize: 12, fontWeight: 600, textTransform: 'none', lineHeight: 1.6,
        color: solid ? '#04121a' : active ? ACCENT : TEXT,
        bgcolor: solid ? ACCENT : 'rgba(255,255,255,0.08)',
        border: solid ? 'none' : `1px solid ${active ? ACCENT : 'rgba(255,255,255,0.14)'}`,
        '&:hover': { bgcolor: solid ? '#5ff8f3' : 'rgba(37,244,238,0.14)' },
        '&.Mui-disabled': { color: 'rgba(255,255,255,0.5)' },
        '& .MuiButton-startIcon': { mr: 0.5 },
      }}
    >
      {children}
    </Button>
  );
}
