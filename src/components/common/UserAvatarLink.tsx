'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Avatar, { type AvatarProps } from '@mui/material/Avatar';
import { userProfileHref, type UserId } from '@/lib/userRoute';
import { AvatarFrame } from './UserDecor';

/**
 * 点击跳用户主页的头像。所有动态/私信/好友列表里的头像都用它,
 * 这样"点头像 = 看主页"在全站一致;点击会 stopPropagation,
 * 不触发外层卡片/消息行自己的 onClick(标记已读、打开详情等)。
 * 用户戴着头像框(商城兑换 / 成就奖励)时自动画出来,总尺寸不变。
 */
export function UserAvatarLink({
  userId,
  name,
  src,
  size = 40,
  sx,
  ...rest
}: {
  userId?: UserId | null;
  name?: string;
  src?: string | null;
  size?: number;
} & Omit<AvatarProps, 'src'>) {
  const router = useRouter();
  const href = userProfileHref(userId);
  const go = (e: React.SyntheticEvent) => {
    if (!href) return;
    e.stopPropagation();
    e.preventDefault();
    router.push(href);
  };
  return (
    <AvatarFrame userId={userId} size={size}>
      {(inner) => (
    <Avatar
      src={src || undefined}
      alt={name || ''}
      role={href ? 'link' : undefined}
      tabIndex={href ? 0 : undefined}
      aria-label={href ? `查看 ${name || '用户'} 的主页` : undefined}
      onClick={go}
      onKeyDown={(e) => e.key === 'Enter' && go(e)}
      sx={{
        width: inner,
        height: inner,
        fontSize: Math.max(10, Math.round(inner * 0.4)),
        flexShrink: 0,
        cursor: href ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s',
        ...(href ? { '&:hover': { boxShadow: '0 0 0 2px var(--brand-color, #FE2C55)' } } : {}),
        ...sx,
      }}
      {...rest}
    >
      {name?.[0] ?? '?'}
    </Avatar>
      )}
    </AvatarFrame>
  );
}
