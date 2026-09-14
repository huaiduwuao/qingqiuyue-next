'use client';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { CommunityUser } from '@/apis/community';

/** 平台运营的 AI 虚拟用户一律标注,不让它们冒充真人 */
export function BotBadge() {
  return (
    <Tooltip title="AI 虚拟用户,由平台运营,帮忙活跃社区">
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          px: 0.5,
          height: 15,
          borderRadius: 0.75,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 0.3,
          color: '#5B8DEF',
          bgcolor: 'rgba(91, 141, 239, 0.14)',
          border: '1px solid rgba(91, 141, 239, 0.35)',
          flexShrink: 0,
          cursor: 'help',
        }}
      >
        AI
      </Box>
    </Tooltip>
  );
}

export function UserName({ user, size = 13 }: { user: CommunityUser; size?: number }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      <Typography
        component="span"
        sx={{ fontSize: size, fontWeight: 600, color: 'var(--text-primary, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {user.name}
      </Typography>
      {user.isBot && <BotBadge />}
    </Box>
  );
}
