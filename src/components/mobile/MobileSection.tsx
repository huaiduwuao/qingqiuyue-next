'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';

/**
 * 手机端「一级页」(创作 / 悬赏 …)的统一分区卡片:同样的圆角、内边距、标题字号和右上角「更多 ›」。
 * 这些页面在手机上不是电脑版的响应式缩小,而是单独挑过的精简内容,用同一套卡片保证观感一致。
 */
export function MobileSection({
  title,
  extra,
  moreLabel = '更多',
  onMore,
  children,
  flush,
}: {
  title?: React.ReactNode;
  /** 标题右侧的小字(计数、说明) */
  extra?: React.ReactNode;
  moreLabel?: string;
  onMore?: () => void;
  children: React.ReactNode;
  /** 内容自己带内边距(列表行贴边) */
  flush?: boolean;
}) {
  return (
    <Box
      component="section"
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {(title || onMore) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, pt: 1.5, pb: flush ? 0.5 : 1 }}>
          {title && (
            <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>
              {title}
            </Typography>
          )}
          {extra && (
            <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
              {extra}
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          {onMore && <MoreLink label={moreLabel} onClick={onMore} />}
        </Box>
      )}
      <Box sx={flush ? undefined : { px: 1.75, pb: 1.75 }}>{children}</Box>
    </Box>
  );
}

export function MoreLink({ label = '更多', onClick }: { label?: string; onClick: () => void }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        all: 'unset',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 12,
        color: 'text.secondary',
        WebkitTapHighlightColor: 'transparent',
        '&:active': { opacity: 0.6 },
      }}
    >
      {label}
      <ChevronRightRoundedIcon sx={{ fontSize: 16, mr: -0.5 }} />
    </Box>
  );
}

/** 一行 3~4 个等宽数字:数字在上、名字在下。点一格可跳转。 */
export function MobileStatRow({
  items,
}: {
  items: { label: string; value: React.ReactNode; hint?: React.ReactNode; onClick?: () => void }[];
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((it) => (
        <Box
          key={it.label}
          onClick={it.onClick}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.25,
            minWidth: 0,
            cursor: it.onClick ? 'pointer' : 'default',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Typography noWrap sx={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2, maxWidth: '100%', color: 'text.primary' }}>
            {it.value}
          </Typography>
          <Typography noWrap sx={{ fontSize: 11, color: 'text.secondary' }}>
            {it.label}
          </Typography>
          {it.hint && (
            <Typography noWrap component="div" sx={{ fontSize: 10, lineHeight: 1.2 }}>
              {it.hint}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

/** 列表里的一行:左图标/缩略图,中间两行文字,右侧箭头或操作。 */
export function MobileListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  divider = true,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
  divider?: boolean;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        px: 1.75,
        py: 1.25,
        cursor: onClick ? 'pointer' : 'default',
        borderTop: divider ? '1px solid' : 0,
        borderColor: 'divider',
        WebkitTapHighlightColor: 'transparent',
        '&:active': onClick ? { bgcolor: 'action.hover' } : undefined,
      }}
    >
      {leading}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography noWrap component="div" sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {trailing ?? (onClick ? <ChevronRightRoundedIcon sx={{ fontSize: 20, color: 'text.disabled' }} /> : null)}
    </Box>
  );
}
