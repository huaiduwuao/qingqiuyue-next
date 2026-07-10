'use client';

/**
 * ExpressionPreview — 单个表情预设的实时预览 (3D mini avatar + 18 个情绪按钮)
 *
 * 让管理员在写 system prompt 时能立刻看到自己提到的"happy" 长什么样。
 */

import React from 'react';
import { Box, Grid, Chip, Typography, Stack } from '@mui/material';
import {
  EXPRESSION_PRESETS,
  EXPRESSION_PRESET_LABELS,
  type ExpressionTemplateName,
} from '@/digital-human/tools/expressions';
import BlenderAvatar from '@/digital-human/BlenderAvatar';

interface Props {
  /** 当前 preview 中的模板 */
  active?: ExpressionTemplateName;
  onChange?: (name: ExpressionTemplateName) => void;
  /** 暴露真实 emotion 给外部 (譬如 Preview 用) */
  onEmotionChange?: (blendshapes: Record<string, number>) => void;
}

const TONE_COLORS: Record<ExpressionTemplateName, string> = {
  neutral: '#888',
  happy: '#fbc02d',
  sad: '#42a5f5',
  angry: '#ef5350',
  surprised: '#ab47bc',
  shy: '#f06292',
  cry: '#5c6bc0',
  laugh: '#ffca28',
  love: '#ec407a',
  thinking: '#78909c',
  confused: '#90a4ae',
  fearful: '#7e57c2',
  disgusted: '#8d6e63',
  sleepy: '#78909c',
  sleepy_tired: '#546e7a',
  smug: '#ffb300',
  worried: '#8d6e63',
  excited: '#ff7043',
  bored: '#b0bec5',
  relaxed: '#80cbc4',
};

const PREVIEW_ORDER: ExpressionTemplateName[] = [
  'happy', 'sad', 'angry', 'surprised', 'shy',
  'cry', 'laugh', 'love', 'thinking', 'confused',
  'fearful', 'disgusted', 'sleepy_tired', 'smug', 'worried',
  'excited', 'bored', 'relaxed',
];

export default function ExpressionPreview({ active, onChange, onEmotionChange }: Props) {
  const [current, setCurrent] = React.useState<ExpressionTemplateName>(active || 'happy');
  const [emotion, setEmotion] = React.useState<Record<string, number>>(EXPRESSION_PRESETS[current]);

  const applyTemplate = React.useCallback((name: ExpressionTemplateName) => {
    setCurrent(name);
    const bs = EXPRESSION_PRESETS[name];
    setEmotion(bs);
    onChange?.(name);
    onEmotionChange?.(bs);
  }, [onChange, onEmotionChange]);

  React.useEffect(() => {
    if (active && active !== current) applyTemplate(active);
  }, [active]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{
        width: '100%', height: 220, borderRadius: 2, overflow: 'hidden',
        background: (t: any) =>
          t.palette.mode === 'dark'
            ? 'radial-gradient(ellipse at center, #2a1e3f 0%, #0a0815 100%)'
            : 'radial-gradient(ellipse at center, #f3eefb 0%, #e7e9f3 100%)',
      }}>
        <BlenderAvatar
          modelUrl="/avatars/character.vrm"
          currentAction="idle"
          emotion={emotion}
          autoRotate={true}
          background="transparent"
        />
      </Box>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {PREVIEW_ORDER.map((name) => (
          <Chip
            key={name}
            label={EXPRESSION_PRESET_LABELS[name] || name}
            size="small"
            onClick={() => applyTemplate(name)}
            variant={current === name ? 'filled' : 'outlined'}
            sx={{
              bgcolor: current === name ? TONE_COLORS[name] : 'transparent',
              borderColor: TONE_COLORS[name],
              color: current === name ? '#000' : TONE_COLORS[name],
              fontWeight: current === name ? 600 : 400,
            }}
          />
        ))}
      </Stack>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', fontSize: 11, color: 'text.secondary' }}>
        <Typography variant="caption">激活 blendshape ({Object.keys(EXPRESSION_PRESETS[current]).length} 个):</Typography>
        <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, monospace', flex: 1, wordBreak: 'break-all' }}>
          {Object.entries(EXPRESSION_PRESETS[current]).map(([k, v]) => `${k}:${(v as number).toFixed(2)}`).join(', ')}
        </Typography>
      </Box>
    </Box>
  );
}
