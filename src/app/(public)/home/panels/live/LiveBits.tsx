'use client';

// 直播页共用的小部件:平台徽标、在播标记、主播头像、分区标题、可点击卡片外壳、空状态。

import type { KeyboardEvent, ReactNode } from 'react';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import { keyframes, type SxProps, type Theme } from '@mui/material/styles';
import { mediaUrl } from '@/lib/media';
import { PLATFORM_COLOR } from './liveApi';

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(254, 44, 85, 0.6); }
  70% { box-shadow: 0 0 0 6px rgba(254, 44, 85, 0); }
  100% { box-shadow: 0 0 0 0 rgba(254, 44, 85, 0); }
`;

/** 红点呼吸 + 「直播中」;overlay=true 时用于封面之上(深底白字)。 */
export function LiveDot({ label = '直播中', overlay = false }: { label?: string; overlay?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.625,
        px: overlay ? 0.875 : 0,
        py: overlay ? 0.25 : 0,
        borderRadius: 999,
        bgcolor: overlay ? 'var(--brand-color, #FE2C55)' : 'transparent',
        color: overlay ? '#fff' : 'var(--brand-color, #FE2C55)',
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
      }}
    >
      <Box
        component="span"
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: overlay ? '#fff' : 'var(--brand-color, #FE2C55)',
          animation: `${pulse} 1.8s ease-out infinite`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }}
      />
      {label}
    </Box>
  );
}

/** 「未开播」灰标,封面上用。 */
export function OfflineTag() {
  return (
    <Box
      component="span"
      sx={{
        px: 0.875,
        py: 0.25,
        borderRadius: 999,
        bgcolor: 'rgba(0,0,0,0.55)',
        color: 'rgba(255,255,255,0.85)',
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.6,
        whiteSpace: 'nowrap',
      }}
    >
      未开播
    </Box>
  );
}

/** 平台徽标:品牌色圆点 + 平台名。solid=true 时是封面上的实底小牌。 */
export function PlatformBadge({ platform, label, solid = false }: { platform: string; label: string; solid?: boolean }) {
  const color = PLATFORM_COLOR[platform] || PLATFORM_COLOR.other;
  if (solid) {
    return (
      <Box
        component="span"
        sx={{
          px: 0.75,
          py: 0.2,
          borderRadius: 1,
          bgcolor: color,
          color: '#fff',
          fontSize: 10.5,
          fontWeight: 700,
          lineHeight: 1.6,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </Box>
    );
  }
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}>
      <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
      {label}
    </Box>
  );
}

export function HostAvatar({ name, src, size = 28 }: { name: string; src?: string; size?: number }) {
  return (
    <Avatar
      src={mediaUrl(src) || undefined}
      alt={name}
      slotProps={{ img: { referrerPolicy: 'no-referrer', loading: 'lazy' } }}
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        fontWeight: 700,
        bgcolor: 'var(--bg-active, rgba(127,127,127,0.2))',
        color: 'var(--text-secondary)',
        flexShrink: 0,
      }}
    >
      {(name || '?').slice(0, 1)}
    </Avatar>
  );
}

/** 分区标题:标题 + 副标题 + 右侧操作区。 */
export function SectionHeader({ title, hint, icon, action }: { title: string; hint?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 1.5, mb: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, minWidth: 0, flexWrap: 'wrap' }}>
        <Typography component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
          {icon}
          {title}
        </Typography>
        {hint && <Typography sx={{ fontSize: 12, color: 'var(--text-muted)' }}>{hint}</Typography>}
      </Box>
      {action}
    </Box>
  );
}

/** 可点击的卡片外壳:键盘可达(Enter / 空格)。 */
export function Clickable({ onClick, label, sx, children }: { onClick: () => void; label: string; sx?: SxProps<Theme>; children: ReactNode }) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
  return (
    <Box
      role="link"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={onKeyDown}
      sx={[
        {
          cursor: 'pointer',
          outline: 'none',
          '&:focus-visible': { boxShadow: '0 0 0 2px var(--brand-color, #FE2C55)' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

/** 分段切换(平台 / 榜单 / 时间范围)。 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  ariaLabel,
}: {
  value: T;
  options: { key: T; label: ReactNode; disabled?: boolean }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  ariaLabel: string;
}) {
  return (
    <Box
      role="tablist"
      aria-label={ariaLabel}
      sx={{
        display: 'inline-flex',
        p: 0.375,
        gap: 0.25,
        borderRadius: 999,
        bgcolor: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        maxWidth: '100%',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Box
            key={o.key}
            component="button"
            type="button"
            role="tab"
            aria-selected={active}
            disabled={o.disabled}
            onClick={() => onChange(o.key)}
            sx={{
              all: 'unset',
              boxSizing: 'border-box',
              cursor: o.disabled ? 'not-allowed' : 'pointer',
              opacity: o.disabled ? 0.4 : 1,
              px: size === 'sm' ? 1.25 : 1.75,
              py: size === 'sm' ? 0.375 : 0.625,
              borderRadius: 999,
              fontSize: size === 'sm' ? 12 : 13,
              fontWeight: active ? 700 : 500,
              whiteSpace: 'nowrap',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              bgcolor: active ? 'var(--bg-elevated)' : 'transparent',
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'background-color .15s, color .15s',
              '&:hover': { color: 'var(--text-primary)' },
              '&:focus-visible': { boxShadow: '0 0 0 2px var(--brand-color, #FE2C55)' },
            }}
          >
            {o.label}
          </Box>
        );
      })}
    </Box>
  );
}

export function EmptyNote({ children, minHeight = 120 }: { children: ReactNode; minHeight?: number }) {
  return (
    <Box
      sx={{
        minHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        px: 3,
        py: 2,
        borderRadius: 2,
        border: '1px dashed var(--border-strong)',
        color: 'var(--text-muted)',
        fontSize: 13,
        lineHeight: 1.7,
      }}
    >
      <Box>{children}</Box>
    </Box>
  );
}

/** 封面占位骨架。 */
export function CoverSkeleton({ ratio = '16/9' }: { ratio?: string }) {
  return <Box sx={{ aspectRatio: ratio, borderRadius: 2, bgcolor: 'var(--bg-input)' }} />;
}
