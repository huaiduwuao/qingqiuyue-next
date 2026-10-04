'use client';

/**
 * PerfBlockScreen — 设备跑不动数字人世界时的拦截页(见 perfGate.ts)
 * 只给「返回首页」和「重新检测」,不提供强行进入 —— 进去也是一直卡。
 */

import * as React from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';

export function PerfBlockScreen({ reason, detail, onBack, onRetry }: { reason: string; detail?: string; onBack: () => void; onRetry: () => void }) {
  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1, bgcolor: '#05060B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Stack spacing={2.2} sx={{ maxWidth: 440, textAlign: 'center', alignItems: 'center' }}>
        <Box sx={{ fontSize: 44, lineHeight: 1 }}>🐢</Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>这台设备跑不动数字人世界</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>{reason}</Typography>
        {detail && <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>{detail}</Typography>}
        <Box component="ul" sx={{ textAlign: 'left', color: 'rgba(255,255,255,0.7)', fontSize: 14, pl: 2.5, m: 0, '& li': { mb: 0.6 } }}>
          <li>在浏览器设置里打开「使用硬件加速」,然后重启浏览器</li>
          <li>关掉其他占用显卡的程序和标签页(游戏、视频、设计软件)</li>
          <li>笔记本请接上电源,或在系统里切到「高性能」模式</li>
          <li>换一台电脑或较新的手机再来</li>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ pt: 1 }}>
          <Button variant="outlined" color="inherit" onClick={onBack}>返回首页</Button>
          <Button variant="contained" onClick={onRetry}>重新检测</Button>
        </Stack>
      </Stack>
    </Box>
  );
}
