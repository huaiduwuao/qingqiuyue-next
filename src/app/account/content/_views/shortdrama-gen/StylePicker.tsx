'use client';

/** 画风卡片网格:示例图 + 名称(+ 说明)。新建短剧和工作台「全局设定」共用。 */

import React from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import type { DramaStyle } from '@/apis/shortdrama';
import { coverBackgroundImage } from '@/lib/media';

/** 没有示例图的风格卡片用的底色 */
const SWATCHES = [
  'linear-gradient(135deg,#3a2a1f,#a0714f)',
  'linear-gradient(135deg,#1f3a35,#6fb3a0)',
  'linear-gradient(135deg,#2b2350,#e07bb4)',
  'linear-gradient(135deg,#102a43,#4fa3e0)',
  'linear-gradient(135deg,#402030,#f2a07b)',
  'linear-gradient(135deg,#222,#999)',
  'linear-gradient(135deg,#120c2e,#ff2bd6)',
  'linear-gradient(135deg,#1e3a1e,#f6d743)',
];

export const styleKey = (s: DramaStyle) => (s.id ? `id:${s.id}` : `name:${s.name}`);

export default function StylePicker({
  styles,
  loading,
  selected,
  onPick,
  columns = { xs: 2, sm: 4 },
  compact,
  disabled,
}: {
  styles: DramaStyle[];
  loading?: boolean;
  /** styleKey() of the picked one */
  selected?: string;
  onPick: (s: DramaStyle) => void;
  columns?: { xs: number; sm: number };
  /** 窄面板里:只显示名称,不显示说明 */
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: `repeat(${columns.xs}, 1fr)`, sm: `repeat(${columns.sm}, 1fr)` }, gap: compact ? 0.75 : 1.25 }}>
      {loading
        ? Array.from({ length: 8 }, (_, i) => <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '3 / 4', height: 'auto' }} />)
        : styles.map((s, i) => {
            const on = selected === styleKey(s);
            return (
              <ButtonBase
                key={styleKey(s)}
                onClick={() => onPick(s)}
                disabled={disabled}
                aria-pressed={on}
                title={s.description || s.name}
                sx={{
                  position: 'relative',
                  aspectRatio: '3 / 4',
                  borderRadius: compact ? 1.5 : 2,
                  overflow: 'hidden',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  outline: on ? '2px solid' : '1px solid',
                  outlineColor: on ? 'primary.main' : 'divider',
                  outlineOffset: on ? -2 : -1,
                  backgroundImage: s.cover_url ? coverBackgroundImage(s.cover_url) : SWATCHES[i % SWATCHES.length],
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {on && <CheckCircleRoundedIcon color="primary" sx={{ position: 'absolute', top: 4, right: 4, fontSize: compact ? 16 : 22, bgcolor: 'background.paper', borderRadius: '50%' }} />}
                <Box sx={{ width: '100%', p: compact ? 0.5 : 1, pt: compact ? 2 : 3, background: 'linear-gradient(transparent, rgba(0,0,0,.75))', color: '#fff' }}>
                  <Typography variant={compact ? 'caption' : 'body2'} sx={{ fontWeight: 700, display: 'block', lineHeight: 1.3 }} noWrap>
                    {s.name}
                  </Typography>
                  {!compact && s.description && (
                    <Typography variant="caption" sx={{ opacity: 0.85, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {s.description}
                    </Typography>
                  )}
                </Box>
              </ButtonBase>
            );
          })}
    </Box>
  );
}
