'use client';

/**
 * VrmPoseChips — 底部姿势 chip 条（6 个程序化姿势，点击 → setPose）
 */

import React from 'react';
import { Box, Chip, Stack } from '@mui/material';
import { POSE_NAMES, POSE_LABELS, type PoseName } from '@/digital-human/vrm/types';
import type { VrmStageHandle } from '@/digital-human/VrmStage';

interface Props {
  handle: VrmStageHandle | null;
}

export default function VrmPoseChips({ handle }: Props) {
  const [active, setActive] = React.useState<PoseName>('idle');
  const apply = (name: PoseName) => {
    if (!handle) { console.warn('[VrmPoseChips] handle=null, 跳过', name); return; }
    console.log('[VrmPoseChips] click', name);
    handle.setPose(name);
    setActive(name);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {POSE_NAMES.map((p) => {
          const isOn = active === p;
          return (
            <Chip
              key={p}
              size="small"
              label={POSE_LABELS[p]}
              onClick={() => apply(p)}
              variant={isOn ? 'filled' : 'outlined'}
              sx={{
                fontSize: 12, height: 28,
                bgcolor: isOn ? 'rgba(79,216,255,0.25)' : 'transparent',
                borderColor: isOn ? 'rgba(79,216,255,0.7)' : 'divider',
                color: isOn ? '#4fd8ff' : 'text.secondary',
                '&:hover': { borderColor: 'rgba(79,216,255,0.5)', bgcolor: 'rgba(79,216,255,0.1)' },
              }}
            />
          );
        })}
      </Stack>
    </Box>
  );
}
