/**
 * scene-ui/ExploreCards.tsx — 留给人推理(go worldapp/lifeexplore.go,docs/WORLD-MODEL.md §11 场景规范)
 *
 * 计数:这个空间藏着几样、你找到了几样 —— 只给数,不说在哪、是什么,让人自己去找。
 * 发现:找到一样时,一句只描写不评价的话浮一会儿(进了线索本,心路页能翻)。
 * 反问:场景问一个开放的问题,自己写一句(不想写就收起);写下的进心路,场景还会接着回应。
 */

import React from 'react';
import { Box, Button, ButtonBase, TextField, Typography } from '@mui/material';

const glass = { bgcolor: 'rgba(12,14,24,0.78)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' } as const;

export function FoundCounter({ count, total }: { count: number; total: number }) {
  const all = count >= total;
  return (
    <Box aria-label="这里藏着的" sx={{
      ...glass, position: 'absolute', top: 72, left: 16, zIndex: 40, pointerEvents: 'none', px: 1.25, py: 0.5, borderRadius: 3, fontSize: 12.5,
      color: all ? '#ffe2a8' : 'rgba(255,255,255,0.8)',
    }}>
      🔍 {all ? `都找到了 · ${total}` : `已发现 ${count} / ${total}`}
    </Box>
  );
}

export function FoundCard({ text, onClose }: { text: string; onClose: () => void }) {
  React.useEffect(() => {
    const t = window.setTimeout(onClose, 7000);
    return () => window.clearTimeout(t);
  }, [text, onClose]);
  return (
    <Box role="status" aria-label="发现" sx={{
      ...glass, position: 'absolute', left: '50%', top: 132, transform: 'translateX(-50%)', zIndex: 46, width: 420, maxWidth: 'calc(100% - 32px)',
      borderRadius: 3, px: 2.5, py: 1.5, textAlign: 'center',
      animation: 'dhFoundIn 0.8s ease', '@keyframes dhFoundIn': { from: { opacity: 0, transform: 'translate(-50%, -6px)' }, to: { opacity: 1, transform: 'translate(-50%, 0)' } },
    }}>
      <Typography sx={{ fontSize: 11, color: 'rgba(255,226,168,0.8)', mb: 0.5 }}>你发现了</Typography>
      <Typography sx={{ fontSize: 15, lineHeight: 1.8, fontFamily: '"Noto Serif SC", "Songti SC", serif' }}>{text || '一样东西'}</Typography>
    </Box>
  );
}

export function ReflectCard({ q, onAnswer, onClose, narrow }: { q: { id: string; text: string }; onAnswer: (text: string) => void; onClose: () => void; narrow?: boolean }) {
  const [v, setV] = React.useState('');
  const send = () => { const t = v.trim(); if (t) onAnswer(t); };
  return (
    <Box role="dialog" aria-label="反问" sx={{
      ...glass, position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: narrow ? 150 : 120, zIndex: 45,
      width: narrow ? 'calc(100% - 32px)' : 480, maxWidth: 'calc(100% - 32px)', borderRadius: 3, p: 2,
    }}>
      <Typography sx={{ fontSize: 15.5, lineHeight: 1.8, mb: 1.25, fontFamily: '"Noto Serif SC", "Songti SC", serif' }}>{q.text}</Typography>
      <TextField multiline minRows={2} maxRows={5} fullWidth value={v} onChange={(e) => setV(e.target.value.slice(0, 300))} placeholder="写下你自己的那句话(没有标准答案)"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); e.stopPropagation(); }}
        sx={{ '& .MuiInputBase-root': { color: '#fff', fontSize: 14 }, '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' } }} />
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 1 }}>
        <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', flex: 1 }}>写下的会记在你的心路上,只有你看得到</Typography>
        <ButtonBase onClick={onClose} sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', px: 1 }}>先不写</ButtonBase>
        <Button size="small" variant="contained" disabled={!v.trim()} onClick={send}>写下</Button>
      </Box>
    </Box>
  );
}
