'use client';

/**
 * 浮窗小助手的「用不用由你」部分:
 * - AssistantIntroHint:第一次看到气泡时旁边的小卡片,说明它是什么,给出 聊两句 / 了解 / 不需要
 * - HideAssistantButton:展开窗里的隐藏按钮,点两下才生效,并说明去哪儿重新打开
 */

import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { setAIPrefs } from '@/lib/aiPrefs';

const HINT_W = 232;

export function AssistantIntroHint({
  side,
  onChat,
  onLearn,
}: {
  /** 卡片出现在气泡哪一侧(气泡靠右时放左边) */
  side: 'left' | 'right';
  onChat: () => void;
  onLearn: () => void;
}) {
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <Box
      data-no-drag
      role="dialog"
      aria-label="AI 小助手介绍"
      onPointerDown={stop}
      sx={{
        position: 'absolute',
        bottom: 0,
        [side === 'left' ? 'right' : 'left']: 'calc(100% + 10px)',
        width: HINT_W,
        maxWidth: 'calc(100vw - 80px)',
        p: 1.5,
        borderRadius: 2.5,
        bgcolor: 'background.paper',
        color: 'text.primary',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        cursor: 'default',
        animation: 'none',
      }}
    >
      <IconButton
        size="small"
        aria-label="知道了"
        onClick={() => setAIPrefs({ introSeen: true })}
        sx={{ position: 'absolute', top: 4, right: 4, color: 'text.secondary' }}
      >
        <CloseRoundedIcon sx={{ fontSize: 14 }} />
      </IconButton>
      <Typography sx={{ fontSize: 13.5, fontWeight: 700, mb: 0.5, pr: 2.5 }}>嗨,我是 AI 小助手</Typography>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.7, mb: 1.25 }}>
        可以帮你找作品、带你去想去的页面、陪你构思创作。点气泡随时找我。
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="contained"
          disableElevation
          onClick={() => {
            setAIPrefs({ introSeen: true });
            onChat();
          }}
          sx={{ textTransform: 'none', borderRadius: 999, fontSize: 12, py: 0.25 }}
        >
          聊两句
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={() => {
            setAIPrefs({ introSeen: true });
            onLearn();
          }}
          sx={{ textTransform: 'none', borderRadius: 999, fontSize: 12, py: 0.25 }}
        >
          了解更多
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={() => setAIPrefs({ introSeen: true, assistant: false })}
          sx={{ textTransform: 'none', borderRadius: 999, fontSize: 12, py: 0.25, color: 'text.secondary' }}
        >
          不需要
        </Button>
      </Box>
    </Box>
  );
}

export function HideAssistantButton() {
  const [confirming, setConfirming] = React.useState(false);
  React.useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  if (confirming) {
    return (
      <Button
        variant="text"
        size="small"
        title="隐藏后可在「我的 → 偏好设置 → AI 功能」重新打开"
        onClick={(e) => {
          e.stopPropagation();
          setAIPrefs({ introSeen: true, assistant: false });
        }}
        sx={{
          minWidth: 0, px: 1, py: 0, height: 28, borderRadius: 999, textTransform: 'none', fontSize: 11,
          color: '#fff', bgcolor: 'rgba(254,44,85,0.75)', '&:hover': { bgcolor: 'rgba(254,44,85,0.9)' },
        }}
      >
        确认隐藏(可在设置里恢复)
      </Button>
    );
  }
  return (
    <IconButton
      size="small"
      aria-label="隐藏小助手"
      title="不再在页面角落显示小助手"
      onClick={(e) => {
        e.stopPropagation();
        setConfirming(true);
      }}
      sx={{ color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(0,0,0,0.4)' }}
    >
      <VisibilityOffRoundedIcon sx={{ fontSize: 14 }} />
    </IconButton>
  );
}
