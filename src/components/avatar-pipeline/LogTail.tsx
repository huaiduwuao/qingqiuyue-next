'use client';

import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

export interface LogTailProps {
  logs: { stream: 'stdout' | 'stderr'; line: string; t: number }[];
  maxLines?: number;
}

export default function LogTail({ logs, maxLines = 200 }: LogTailProps) {
  const ref = useRef<HTMLDivElement>(null);

  // 自动滚到底
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  const shown = logs.slice(-maxLines);

  return (
    <Box
      ref={ref}
      sx={{
        height: 240,
        overflowY: 'auto',
        bgcolor: '#0a0a0a',
        color: '#d0d0d0',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        p: 1.5,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {shown.length === 0 ? (
        <Box sx={{ color: 'text.secondary', fontStyle: 'italic' }}>等待输出…</Box>
      ) : (
        shown.map((l, i) => (
          <Box
            key={i}
            sx={{
              color: l.stream === 'stderr' ? '#ff8888' : '#d0d0d0',
            }}
          >
            {l.line}
          </Box>
        ))
      )}
    </Box>
  );
}
