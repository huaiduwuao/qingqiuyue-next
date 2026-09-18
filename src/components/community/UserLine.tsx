'use client';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import type { CommunityUser } from '@/apis/community';
import { UserNameDecor } from '@/components/common/UserDecor';

/** 平台运营的 AI 虚拟用户:名字旁一个低调的小标记,悬停可见说明。不让它们冒充真人。 */
export function BotBadge() {
  return (
    <Tooltip title="AI 虚拟用户,由平台运营">
      <AutoAwesomeRoundedIcon
        aria-label="AI 虚拟用户"
        sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.35))', flexShrink: 0, cursor: 'help' }}
      />
    </Tooltip>
  );
}

export function UserName({ user, size = 13 }: { user: CommunityUser; size?: number }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      {/* 名字颜色、等级、称号来自成长体系(lib/decor 批量加载) */}
      <UserNameDecor userId={user.id} name={user.name} sx={{ fontSize: size, fontWeight: 600, color: 'var(--text-primary, #fff)' }} />
      {user.isBot && <BotBadge />}
    </Box>
  );
}
