'use client';

/**
 * AIGCBadge —— 国家网信办《人工智能生成合成内容标识办法》要求的「AI 生成」合规标识
 *
 * 用法:
 *   {isAIGenerated && <AIGCBadge variant="overlay" />}
 *   {isAIGenerated && <AIGCBadge variant="inline" />}
 *
 * variant:
 *   - inline  : 行内小 chip, 适合跟在标题/文本旁边
 *   - overlay : 半透明角标, 适合贴在视频/卡片左上角
 */

import React from 'react';
import Chip from '@mui/material/Chip';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';

export type AIGCBadgeVariant = 'inline' | 'overlay';

export interface AIGCBadgeProps {
  variant?: AIGCBadgeVariant;
  /** 默认 "AI 生成", 可改成 "AI 生成视频" 等 */
  label?: string;
  /** 角标离顶/左的距离 (overlay 模式) */
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  /** 自定义 sx (覆盖默认) */
  sx?: any;
}

const inlineSx = {
  height: 20,
  fontSize: 11,
  fontWeight: 600,
  bgcolor: 'rgba(168, 85, 247, 0.16)',
  color: '#a855f7',
  border: '1px solid rgba(168, 85, 247, 0.4)',
  '& .MuiChip-icon': { color: '#a855f7', fontSize: 13, ml: 0.5 },
  '& .MuiChip-label': { px: 0.75 },
};

const overlaySx = {
  position: 'absolute' as const,
  zIndex: 5,
  height: 22,
  fontSize: 11,
  fontWeight: 600,
  bgcolor: 'rgba(0, 0, 0, 0.55)',
  color: '#fff',
  backdropFilter: 'blur(6px)',
  border: '1px solid rgba(255,255,255,0.2)',
  '& .MuiChip-icon': { color: '#fcd34d', fontSize: 13, ml: 0.5 },
  '& .MuiChip-label': { px: 0.75 },
};

export function AIGCBadge({
  variant = 'inline',
  label = 'AI 生成',
  top,
  left,
  right,
  bottom,
  sx,
}: AIGCBadgeProps) {
  const base = variant === 'overlay' ? overlaySx : inlineSx;
  const pos =
    variant === 'overlay'
      ? {
          ...(top !== undefined ? { top } : { top: 8 }),
          ...(left !== undefined ? { left } : { left: 8 }),
          ...(right !== undefined ? { right } : {}),
          ...(bottom !== undefined ? { bottom } : {}),
        }
      : {};
  return (
    <Chip
      size="small"
      icon={<AutoAwesomeRoundedIcon />}
      label={label}
      aria-label="本内容由人工智能生成"
      sx={{ ...base, ...pos, ...sx }}
    />
  );
}

export default AIGCBadge;