'use client';

/**
 * /digital-human 画面上的两块小浮层:憋气条、换场景过场。从 ImmersiveDigitalHuman.tsx 拆出,JSX 原样搬。
 */
import React from 'react';
import { Box } from '@mui/material';

/** 憋气:头泡在会憋气的液体里,还能憋几秒 */
export const BreathMeter = React.memo(function BreathMeter({ left, max }: { left: number; max: number }) {
  return (
    <Box sx={{ position: 'absolute', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 40, pointerEvents: 'none', px: 1.5, py: 0.75, borderRadius: 3, bgcolor: 'rgba(10,30,60,0.7)', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', gap: 1 }}>
      <span>🫧 憋气 {left} 秒</span>
      <Box sx={{ width: 90, height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
        <Box sx={{ width: Math.max(0, Math.min(100, (left / Math.max(1, max)) * 100)) + '%', height: '100%', bgcolor: left <= 3 ? '#ff7b7b' : '#7fd3ff', transition: 'width 0.9s linear' }} />
      </Box>
    </Box>
  );
});

/** 换场景的过场:黑底淡入「前往 X」,新场景建好后淡出 */
export const TravelOverlay = React.memo(function TravelOverlay({ travel }: { travel: string | null }) {
  return (
    <Box sx={{
      position: 'absolute', inset: 0, zIndex: 50, pointerEvents: travel ? 'auto' : 'none',
      bgcolor: '#05060B', opacity: travel ? 1 : 0, transition: 'opacity 0.6s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1.5,
    }}>
      <Box sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 22, letterSpacing: 6 }}>{travel ? `前往 · ${travel}` : ''}</Box>
      <Box sx={{ width: 160, height: 2, bgcolor: 'rgba(255,255,255,0.12)', overflow: 'hidden', borderRadius: 1 }}>
        <Box sx={{ width: '40%', height: '100%', bgcolor: 'rgba(255,220,160,0.8)', animation: travel ? 'dhTravel 1.2s ease-in-out infinite' : 'none',
          '@keyframes dhTravel': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(250%)' } } }} />
      </Box>
    </Box>
  );
});
