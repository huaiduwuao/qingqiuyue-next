/**
 * scene-ui/LifeSceneCards.tsx — 人生场景的两张卡(规则效果 choose / insight,go worldrules/choice.go)
 *
 * 题卡:规则给我出的一道选择,放在下方,不挡住场景;限时的有一条慢慢变短的线,
 * 到点没选由服务端按作者定的默认算(「不选」也是一种选择),这里只是收起。选项不标维度 —— 标了就成了答题。
 * 感悟卡:选完之后的一句话,安静地浮在上方;登录的人记到了心路上,给一个去心路看看的口子。
 */

import React from 'react';
import { Box, ButtonBase, Typography } from '@mui/material';
import type { SceneInsight, SceneQuestion } from './useRoomSocket';

/** 心路的五个维度(go journey.AxisNames) */
export const AXIS_NAMES: Record<string, string> = { heart: '本心', spine: '底气', edge: '棱角', silence: '沉默', smile: '微笑' };

const glass = { bgcolor: 'rgba(12,14,24,0.78)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' } as const;

export function ChoiceCard({ q, onAnswer, narrow }: { q: SceneQuestion & { at: number }; onAnswer: (index: number) => void; narrow?: boolean }) {
  // 还剩多久(刷新页面后补发的题,倒计时从收到那一刻接着走)
  const [left] = React.useState(() => (q.wait > 0 ? Math.max(0, q.wait - (Date.now() - q.at)) : 0));
  return (
    <Box role="dialog" aria-label="抉择" sx={{
      ...glass, position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: narrow ? 150 : 120, zIndex: 45,
      width: narrow ? 'calc(100% - 32px)' : 520, maxWidth: 'calc(100% - 32px)', borderRadius: 3, p: 2, boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      animation: 'dhChoiceIn 0.5s ease', '@keyframes dhChoiceIn': { from: { opacity: 0, transform: 'translate(-50%, 12px)' }, to: { opacity: 1, transform: 'translate(-50%, 0)' } },
    }}>
      <Typography sx={{ fontSize: 15, lineHeight: 1.8, mb: 1.25, whiteSpace: 'pre-wrap' }}>{q.text}</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {q.options.map((o, i) => (
          <ButtonBase key={i} onClick={() => onAnswer(i)} sx={{
            justifyContent: 'flex-start', textAlign: 'left', px: 1.5, py: 1, borderRadius: 2, fontSize: 14, lineHeight: 1.6,
            bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,226,168,0.5)' },
          }}>
            {o.label}
          </ButtonBase>
        ))}
      </Box>
      {q.wait > 0 && (
        <Box sx={{ mt: 1.25 }}>
          <Box sx={{ height: 2, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <Box key={q.id} sx={{
              height: '100%', bgcolor: 'rgba(255,226,168,0.7)', width: `${(left / q.wait) * 100}%`,
              animation: `dhChoiceLeft ${left}ms linear forwards`, '@keyframes dhChoiceLeft': { to: { width: '0%' } },
            }} />
          </Box>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mt: 0.5 }}>不选,也是一种选择。</Typography>
        </Box>
      )}
    </Box>
  );
}

export function InsightCard({ insight, onClose }: { insight: SceneInsight; onClose: () => void }) {
  React.useEffect(() => {
    const t = window.setTimeout(onClose, 20000);
    return () => window.clearTimeout(t);
  }, [insight, onClose]);
  const axis = AXIS_NAMES[insight.axis];
  return (
    <Box role="status" aria-label="感悟" sx={{
      ...glass, position: 'absolute', left: '50%', top: 96, transform: 'translateX(-50%)', zIndex: 46,
      width: 460, maxWidth: 'calc(100% - 32px)', borderRadius: 3, px: 3, py: 2.5, textAlign: 'center',
      animation: 'dhInsightIn 1.2s ease', '@keyframes dhInsightIn': { from: { opacity: 0 }, to: { opacity: 1 } },
    }}>
      <ButtonBase onClick={onClose} aria-label="收起" sx={{ position: 'absolute', top: 6, right: 10, fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>✕</ButtonBase>
      <Typography sx={{ fontSize: 17, lineHeight: 1.9, letterSpacing: 0.5, fontFamily: '"Noto Serif SC", "Songti SC", serif' }}>{insight.text}</Typography>
      {(insight.feel || axis) && (
        <Typography sx={{ fontSize: 12, color: 'rgba(255,226,168,0.75)', mt: 1 }}>
          {[insight.feel, axis && `偏向${axis}`].filter(Boolean).join(' · ')}
        </Typography>
      )}
      {insight.path && (
        <Typography component="a" href="/insight/path" target="_blank" rel="noopener" sx={{ display: 'inline-block', fontSize: 12, color: 'rgba(255,255,255,0.55)', mt: 1, textDecoration: 'none', '&:hover': { color: '#fff' } }}>
          已记在你的心路上 →
        </Typography>
      )}
    </Box>
  );
}
