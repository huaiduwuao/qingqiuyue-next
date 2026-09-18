'use client';

import React from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { useDecor, decorBackground } from '@/lib/decor';

/**
 * 头像框:把 children(头像)包进一圈装扮里。总尺寸仍是 size —— 有框时头像略缩,列表不会因为
 * 某个人戴了头像框而错位。没有头像框时原样返回 children。
 */
export function AvatarFrame({
  userId,
  size,
  children,
}: {
  userId?: string | number | null;
  size: number;
  children: (innerSize: number) => React.ReactNode;
}) {
  const decor = useDecor(userId);
  if (!decor?.frame) return <>{children(size)}</>;
  const ring = Math.max(2, Math.round(size * 0.075));
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        p: `${ring}px`,
        background: decorBackground(decor.frame),
        boxSizing: 'border-box',
        display: 'inline-flex',
      }}
    >
      {children(size - ring * 2)}
    </Box>
  );
}

/**
 * 昵称 + 名字颜色 + 等级 + 称号。评论区、动态、主页里显示用户名的地方用它替换纯文字。
 * 等级 Lv1 不显示(所有人都是),避免满屏徽章。
 */
export function UserNameDecor({
  userId,
  name,
  sx,
  hideLevel,
}: {
  userId?: string | number | null;
  name: React.ReactNode;
  sx?: SxProps<Theme>;
  hideLevel?: boolean;
}) {
  const decor = useDecor(userId);
  const colored = decor?.nameColor
    ? decor.nameColor.includes('gradient')
      ? { background: decor.nameColor, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
      : { color: decor.nameColor }
    : null;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0, maxWidth: '100%' }}>
      <Box component="span" sx={[{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, ...(Array.isArray(sx) ? sx : [sx]), colored]}>
        {name}
      </Box>
      {!hideLevel && decor && decor.level > 1 && (
        <Box
          component="span"
          title={decor.levelName}
          sx={{ flexShrink: 0, px: 0.5, borderRadius: 0.75, fontSize: 10, lineHeight: '16px', fontWeight: 700, color: 'warning.main', border: '1px solid', borderColor: 'warning.main' }}
        >
          Lv{decor.level}
        </Box>
      )}
      {decor?.creatorLevel && decor.creatorLevel >= 3 && (
        <Box
          component="span"
          title={`创作者 Lv${decor.creatorLevel}`}
          sx={{ flexShrink: 0, px: 0.5, borderRadius: 0.75, fontSize: 10, lineHeight: '16px', fontWeight: 700, color: '#fff', bgcolor: decor.creatorLevel >= 5 ? '#FFB400' : decor.creatorLevel >= 4 ? '#9C27B0' : '#2196F3' }}
        >
          创作者
        </Box>
      )}
      {decor?.title && (
        <Box
          component="span"
          sx={{ flexShrink: 0, px: 0.75, borderRadius: 0.75, fontSize: 10, lineHeight: '16px', fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, #8B5CF6 0%, #5B8DEF 100%)' }}
        >
          {decor.title}
        </Box>
      )}
    </Box>
  );
}
