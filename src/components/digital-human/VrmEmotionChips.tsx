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

  const apply = (p: typeof EMOTION_PRESETS[number]) => {
    if (!handle) return;
    const name = p.template as ExpressionTemplateName;
    const dict = buildExpressionFromPreset(name, p.intensity, {});
    // 眨眼等带额外通道的预设，merge 进去
    if (p.blinkLeft) dict.blinkLeft = p.blinkLeft;
    handle.setEmotion(dict);
    setActive(name);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {EMOTION_PRESETS.map((p) => {
          const isOn = active === p.template;
          return (
            <Tooltip key={p.id} title={p.label} arrow>
              <Chip
                size="small"
                label={`${p.emoji} ${p.label}`}
                onClick={() => apply(p)}
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
