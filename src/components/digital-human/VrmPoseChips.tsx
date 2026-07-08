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
  const apply = (name: PoseName) => { handle?.setPose(name); setActive(name); };

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
                bgcolor: isOn ? 'rgba(79,216,255,0.25)' : 'rgba(255,255,255,0.04)',
                borderColor: isOn ? 'rgba(79,216,255,0.7)' : 'rgba(255,255,255,0.1)',
                color: isOn ? '#4fd8ff' : 'rgba(255,255,255,0.85)',
                '&:hover': { borderColor: 'rgba(79,216,255,0.5)', bgcolor: 'rgba(79,216,255,0.1)' },
              }}
            />
          );
        })}
      </Stack>
    </Box>
  );
}
