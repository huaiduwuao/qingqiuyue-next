'use client';

/**
 * VrmEmotionChips — 底部情绪 chip 条（10 个情绪预设，点击 → setEmotion）
 *
 * 通过 props 接收 handle + 当前 emotion dict（用于同步 chip 选中态）。
 */

import React from 'react';
import { Box, Chip, Stack, Tooltip } from '@mui/material';
import { EMOTION_PRESETS } from '@/digital-human/vrm/types';
import { buildExpressionFromPreset, EXPRESSION_PRESETS, type ExpressionTemplateName } from '@/digital-human/tools/expressions';
import type { VrmStageHandle } from '@/digital-human/VrmStage';

interface Props {
  handle: VrmStageHandle | null;
  /** 当前激活的 template（外部计算后传入，让 chip 高亮） */
  activeTemplate?: ExpressionTemplateName;
}

export default function VrmEmotionChips({ handle, activeTemplate }: Props) {
  const [active, setActive] = React.useState<ExpressionTemplateName | undefined>(activeTemplate);

  React.useEffect(() => { setActive(activeTemplate); }, [activeTemplate]);

  const apply = (template: string, intensity: number) => {
    if (!handle) return;
    const name = template as ExpressionTemplateName;
    const dict = buildExpressionFromPreset(name, intensity, {});
    handle.setEmotion(dict);
    setActive(name);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {EMOTION_PRESETS.map((p) => {
          const isOn = active === p.template;
          return (
            <Tooltip key={p.template} title={EXPRESSION_PRESETS[p.template as ExpressionTemplateName] ? p.label : p.label} arrow>
              <Chip
                size="small"
                label={`${p.emoji} ${p.label}`}
                onClick={() => apply(p.template, p.intensity)}
                variant={isOn ? 'filled' : 'outlined'}
                sx={{
                  fontSize: 12, height: 28,
                  bgcolor: isOn ? 'rgba(255,79,216,0.25)' : 'rgba(255,255,255,0.04)',
                  borderColor: isOn ? 'rgba(255,79,216,0.7)' : 'rgba(255,255,255,0.1)',
                  color: isOn ? '#ff4fd8' : 'rgba(255,255,255,0.85)',
                  '&:hover': { borderColor: 'rgba(255,79,216,0.5)', bgcolor: 'rgba(255,79,216,0.1)' },
                }}
              />
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
}
