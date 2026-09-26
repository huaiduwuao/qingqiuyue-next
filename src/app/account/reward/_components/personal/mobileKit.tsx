'use client';

/**
 * 奖励中心各子页手机版共用的小零件(MobileSection 之外的):
 * 横滑筛选胶囊、右下角主操作 Fab、分区里的空态 / 加载行、小状态标签。
 * 只给 reward/_components 下的手机版用,电脑版不引用。
 */

import React from 'react';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import AddRoundedIcon from '@mui/icons-material/AddRounded';

/** 一行横滑胶囊(同赏金广场的分类行);右侧可以挂 1~2 个图标按钮。 */
export function MobileChipRow<T extends string | number>({
  items,
  value,
  onChange,
  trailing,
  sticky,
}: {
  items: { value: T; label: React.ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  trailing?: React.ReactNode;
  /** 吸顶(贴着 WorkspaceShell 的 12px 内边距) */
  sticky?: boolean;
}) {
  const row = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          gap: 0.75,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {items.map((it) => {
          const on = it.value === value;
          return (
            <Box
              key={String(it.value)}
              component="button"
              type="button"
              onClick={() => onChange(it.value)}
              sx={{
                all: 'unset',
                flexShrink: 0,
                cursor: 'pointer',
                px: 1.5,
                py: 0.6,
                borderRadius: 999,
                fontSize: 13,
                fontWeight: on ? 700 : 500,
                color: on ? '#fff' : 'text.secondary',
                bgcolor: on ? 'primary.main' : 'background.paper',
                border: '1px solid',
                borderColor: on ? 'primary.main' : 'divider',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {it.label}
              {it.count != null && (
                <Box component="span" sx={{ ml: 0.5, fontSize: 11, opacity: on ? 0.85 : 0.7 }}>
                  {it.count}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
      {trailing}
    </Box>
  );
  if (!sticky) return row;
  return (
    <Box sx={{ position: 'sticky', top: -12, zIndex: 5, mx: -1.5, px: 1.5, py: 0.75, bgcolor: 'background.default' }}>
      {row}
    </Box>
  );
}

/** 页面唯一的主操作:右下角悬浮,让开底部导航和迷你播放器。 */
export function MobileFab({ label, onClick, icon, disabled }: { label: string; onClick: () => void; icon?: React.ReactNode; disabled?: boolean }) {
  return (
    <Fab
      variant="extended"
      color="primary"
      onClick={onClick}
      disabled={disabled}
      sx={{
        position: 'fixed',
        right: 16,
        bottom: 'calc(16px + var(--bottom-nav-inset, 0px) + var(--player-inset, 0px))',
        zIndex: 10,
        fontWeight: 700,
        boxShadow: '0 8px 20px rgba(254,44,85,0.35)',
      }}
    >
      {icon ?? <AddRoundedIcon sx={{ mr: 0.5 }} />}
      {label}
    </Fab>
  );
}

/** 分区里的空态 / 提示一行 */
export function MobileEmpty({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ py: 4, px: 1.75, textAlign: 'center', fontSize: 13, color: 'text.disabled' }}>{children}</Typography>;
}

/** 分区里的加载骨架 */
export function MobileSkeletonRows({ count = 4, height = 52 }: { count?: number; height?: number }) {
  return (
    <Box sx={{ p: 1.75, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="rounded" height={height} />
      ))}
    </Box>
  );
}

/** 小状态标签(行标题后 / 行尾) */
export function StatusTag({ label, color, bg }: { label: React.ReactNode; color: string; bg?: string }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        px: 0.75,
        height: 18,
        borderRadius: 1,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1,
        color,
        bgcolor: bg ?? 'action.hover',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  );
}

/** 行首的圆角方块图标 */
export function RowIcon({ children, color, bg, size = 36 }: { children: React.ReactNode; color: string; bg: string; size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 2,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        bgcolor: bg,
        '& svg': { fontSize: Math.round(size * 0.55) },
      }}
    >
      {children}
    </Box>
  );
}

/** 列表底部的「没有更多了」/「加载中」 */
export function ListFooter({ loading, done }: { loading?: boolean; done?: boolean }) {
  if (loading)
    return (
      <Box sx={{ px: 1.75, pb: 1.5 }}>
        <Skeleton variant="rounded" height={52} />
      </Box>
    );
  if (done)
    return (
      <Typography sx={{ textAlign: 'center', py: 1.5, fontSize: 12, color: 'text.disabled', borderTop: '1px solid', borderColor: 'divider' }}>
        没有更多了
      </Typography>
    );
  return null;
}
