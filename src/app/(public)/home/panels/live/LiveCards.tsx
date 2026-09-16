'use client';

// 直播页的卡片:直播间卡、焦点大卡、分区卡、往期高光卡。封面统一 16:9(源站直播封面就是横图)。

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { CoverImage } from '@/components/common/CoverImage';
import { IMAGE_OVERLAY } from '@/constants/gradients';
import {
  type LiveClassic,
  type LiveFacet,
  type LiveRoom,
  externalLink,
  formatDayTime,
  formatDuration,
  formatLiveFor,
  formatViewers,
} from './liveApi';
import { Clickable, HostAvatar, LiveDot, OfflineTag, PlatformBadge } from './LiveBits';

const hoverLift = {
  transition: 'transform .2s ease, box-shadow .2s ease',
  '&:hover': { transform: 'translateY(-2px)' },
  '&:hover .live-cover img': { transform: 'scale(1.04)' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
};

function Cover({ src, alt, children, radius = 2 }: { src: string; alt: string; children?: React.ReactNode; radius?: number }) {
  return (
    <Box
      className="live-cover"
      sx={{
        position: 'relative',
        aspectRatio: '16/9',
        borderRadius: radius,
        overflow: 'hidden',
        bgcolor: 'var(--bg-input)',
        '& img': { transition: 'transform .35s ease' },
      }}
    >
      <CoverImage src={src} alt={alt} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <Box sx={{ position: 'absolute', inset: 0, background: IMAGE_OVERLAY.TOP_BAR, pointerEvents: 'none' }} />
      {children}
    </Box>
  );
}

function ViewerCount({ n, prefix }: { n: number; prefix?: string }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.375, fontSize: 12, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
      <VisibilityRoundedIcon sx={{ fontSize: 14 }} />
      {prefix}
      {formatViewers(n)}
    </Box>
  );
}

/** 普通直播间卡。 */
export function RoomCard({ room, now, onOpen }: { room: LiveRoom; now: number; onOpen: () => void }) {
  const sub = [room.hostName, room.isLive ? formatLiveFor(room.startedAt, now) : ''].filter(Boolean).join(' · ');
  return (
    <Clickable onClick={onOpen} label={`${room.hostName || ''} ${room.title}`} sx={{ borderRadius: 2, ...hoverLift }}>
      <Cover src={room.cover} alt={room.title}>
        <Box sx={{ position: 'absolute', top: 8, left: 8 }}>{room.isLive ? <LiveDot overlay /> : <OfflineTag />}</Box>
        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
          <PlatformBadge platform={room.platform} label={room.platformLabel} solid />
        </Box>
        <Box sx={{ position: 'absolute', left: 8, right: 8, bottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          {room.isLive && room.viewers > 0 ? <ViewerCount n={room.viewers} /> : <span />}
          {room.area && (
            <Typography noWrap sx={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', maxWidth: '55%' }}>
              {room.area}
            </Typography>
          )}
        </Box>
      </Cover>
      <Box sx={{ display: 'flex', gap: 1, pt: 1, alignItems: 'flex-start' }}>
        <HostAvatar name={room.hostName} src={room.hostAvatar} size={30} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap title={room.title} sx={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.35 }}>
            {room.title}
          </Typography>
          <Typography noWrap sx={{ fontSize: 12, color: 'var(--text-muted)', mt: 0.25 }}>
            {sub || ' '}
          </Typography>
        </Box>
      </Box>
    </Clickable>
  );
}

/** 焦点大卡:此刻人气第一;ranked=false 时只是「正在直播」,不排名。 */
export function SpotlightCard({ room, now, ranked, onOpen }: { room: LiveRoom; now: number; ranked: boolean; onOpen: () => void }) {
  const link = externalLink(room.sourceUrl);
  return (
    <Clickable onClick={onOpen} label={`${room.hostName} ${room.title}`} sx={{ borderRadius: 3, ...hoverLift }}>
      <Cover src={room.cover} alt={room.title} radius={3}>
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.88) 100%)' }} />
        <Box sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 0.75, alignItems: 'center' }}>
          {ranked && (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, borderRadius: 999, bgcolor: 'rgba(0,0,0,0.55)', color: '#FFC53D', fontSize: 12, fontWeight: 800 }}>
              <TrendingUpRoundedIcon sx={{ fontSize: 15 }} />
              此刻人气 No.1
            </Box>
          )}
          <LiveDot overlay />
        </Box>
        <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
          <PlatformBadge platform={room.platform} label={room.platformLabel} solid />
        </Box>
        <Box sx={{ position: 'absolute', left: { xs: 12, md: 20 }, right: { xs: 12, md: 20 }, bottom: { xs: 12, md: 18 }, color: '#fff' }}>
          <Typography sx={{ fontSize: { xs: 17, md: 24 }, fontWeight: 800, lineHeight: 1.25, mb: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
            {room.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
            <HostAvatar name={room.hostName} src={room.hostAvatar} size={28} />
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{room.hostName}</Typography>
            <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)' }}>
              {[room.area || room.categoryLabel, formatLiveFor(room.startedAt, now)].filter(Boolean).join(' · ')}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Box sx={{ display: room.viewers > 0 ? 'inline-flex' : 'none', alignItems: 'baseline', gap: 0.5, fontVariantNumeric: 'tabular-nums' }}>
              <Typography component="span" sx={{ fontSize: { xs: 18, md: 22 }, fontWeight: 800 }}>{formatViewers(room.viewers)}</Typography>
              <Typography component="span" sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>人气</Typography>
            </Box>
            {link && (
              <Button
                size="small"
                variant="contained"
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
                sx={{ borderRadius: 999, bgcolor: 'var(--brand-color, #FE2C55)', fontWeight: 700, boxShadow: 'none', display: { xs: 'none', sm: 'inline-flex' } }}
              >
                去{room.platformLabel}看
              </Button>
            )}
          </Box>
        </Box>
      </Cover>
    </Clickable>
  );
}

/** 焦点区下方的小卡(No.2–No.5)。 */
export function RunnerUpCard({ room, onOpen }: { room: LiveRoom; onOpen: () => void }) {
  return (
    <Clickable onClick={onOpen} label={`${room.hostName} ${room.title}`} sx={{ borderRadius: 2, minWidth: 0, ...hoverLift }}>
      <Cover src={room.cover} alt={room.title}>
        {room.hotRank > 0 ? (
          <Box sx={{ position: 'absolute', top: 6, left: 6, minWidth: 22, height: 22, px: 0.5, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {room.hotRank}
          </Box>
        ) : (
          <Box sx={{ position: 'absolute', top: 6, left: 6 }}>
            <LiveDot overlay />
          </Box>
        )}
        {room.viewers > 0 && (
          <Box sx={{ position: 'absolute', left: 6, bottom: 4 }}>
            <ViewerCount n={room.viewers} />
          </Box>
        )}
      </Cover>
      <Typography noWrap sx={{ mt: 0.75, fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{room.hostName || room.title}</Typography>
      <Typography noWrap sx={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
        {room.platformLabel} · {room.area || room.categoryLabel}
      </Typography>
    </Clickable>
  );
}

/** 分区卡:用该分区此刻最热房间的封面做底,点击切到该分区。 */
export function CategoryCard({ facet, active, onSelect }: { facet: LiveFacet; active: boolean; onSelect: () => void }) {
  const top = facet.top;
  return (
    <Clickable onClick={onSelect} label={`${facet.label} 分区`} sx={{ borderRadius: 2, ...hoverLift }}>
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16/9',
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: 'var(--bg-input)',
          outline: active ? '2px solid var(--brand-color, #FE2C55)' : 'none',
          outlineOffset: 2,
        }}
      >
        {top?.cover && <CoverImage src={top.cover} alt={facet.label} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.8) 100%)' }} />
        <Box sx={{ position: 'absolute', left: 10, right: 10, bottom: 8, color: '#fff' }}>
          <Typography sx={{ fontSize: 17, fontWeight: 800, lineHeight: 1.2 }}>{facet.label}</Typography>
          <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', mt: 0.25 }}>
            {facet.live > 0 ? `${facet.live} 间在播` : `收录 ${facet.total} 间 · 暂无在播`}
          </Typography>
          {top && (
            <Typography noWrap sx={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', mt: 0.25 }}>
              最热:{top.hostName}
              {top.viewers > 0 ? ` · ${formatViewers(top.viewers)}` : ''}
            </Typography>
          )}
        </Box>
      </Box>
    </Clickable>
  );
}

/** 往期高光卡:一场已结束的直播。 */
export function ClassicCard({ item, onOpen }: { item: LiveClassic; onOpen: () => void }) {
  const duration = formatDuration(item.startedAt, item.endedAt);
  return (
    <Clickable onClick={onOpen} label={`${item.hostName} ${item.title}`} sx={{ borderRadius: 2, ...hoverLift }}>
      <Cover src={item.cover} alt={item.title}>
        <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'inline-flex', alignItems: 'center', gap: 0.375, px: 0.875, py: 0.25, borderRadius: 999, bgcolor: 'rgba(0,0,0,0.6)', color: '#FFC53D', fontSize: 11.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
          <TrendingUpRoundedIcon sx={{ fontSize: 14 }} />
          峰值 {formatViewers(item.peakOnline)}
        </Box>
        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
          <PlatformBadge platform={item.platform} label={item.platformLabel} solid />
        </Box>
        <Box sx={{ position: 'absolute', left: 8, right: 8, bottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Typography noWrap sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.9)', fontVariantNumeric: 'tabular-nums' }}>
            {formatDayTime(item.startedAt)}
            {duration ? ` · ${duration}` : ''}
          </Typography>
          {item.isLive && <LiveDot overlay label="正在播" />}
        </Box>
      </Cover>
      <Box sx={{ display: 'flex', gap: 1, pt: 1, alignItems: 'flex-start' }}>
        <HostAvatar name={item.hostName} src={item.hostAvatar} size={30} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap title={item.title} sx={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>
            {item.title}
          </Typography>
          <Typography noWrap sx={{ fontSize: 12, color: 'var(--text-muted)', mt: 0.25 }}>
            {[item.hostName, item.area || item.categoryLabel].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      </Box>
    </Clickable>
  );
}
