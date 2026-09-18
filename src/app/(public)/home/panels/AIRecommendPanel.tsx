'use client';

/**
 * 首页「AI 助手」页签:站内智能能力的总入口。
 * 上半是 AI 搜索(一句话找作品),下半是虚拟形象和创作智能体的介绍卡,
 * 每项都能在这里直接开关 —— 用不用由用户自己决定。
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import FaceRetouchingNaturalIcon from '@mui/icons-material/FaceRetouchingNatural';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { ACCENT } from '@/constants/accents';
import { AISearchResults, AI_GRADIENT, AI_SEARCH_EXAMPLES } from '@/components/ai/AISearchResults';
import { useAIPrefs } from '@/lib/aiPrefs';

export function AIRecommendPanel() {
  const router = useRouter();
  const [prefs, setPrefs] = useAIPrefs();
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState('');

  const submit = (raw: string) => {
    const kw = raw.trim();
    if (!kw) return;
    setDraft(kw);
    setSubmitted(kw);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 880, mx: 'auto' }}>
      {/* AI 搜索 */}
      <Box
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: 3,
          border: `1px solid ${ACCENT.blue.border30}`,
          background: `linear-gradient(135deg, ${ACCENT.blue.soft12} 0%, ${ACCENT.purple.soft12} 100%)`,
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: 1.5, background: AI_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AutoAwesomeIcon sx={{ fontSize: 16, color: '#fff' }} />
          </Box>
          <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            AI 搜索
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 12.5, color: 'var(--text-secondary)', mb: 1.75, lineHeight: 1.7 }}>
          不用想关键词,像跟朋友说话一样描述你想看的。AI 会拆成检索条件,并告诉你每个结果为什么合适。
        </Typography>

        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
          sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={3}
            size="small"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(draft);
              }
            }}
            placeholder="比如:周末想看点轻松的国产动画"
            slotProps={{
              htmlInput: { maxLength: 200, 'aria-label': '描述你想找的内容' },
              input: {
                sx: {
                  bgcolor: 'var(--bg-body)',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  borderRadius: 2,
                  '& textarea::placeholder': { color: 'var(--text-muted)', opacity: 1 },
                  '& fieldset': { borderColor: ACCENT.blue.border30 },
                  '&.Mui-focused fieldset': { borderColor: ACCENT.blue.main },
                },
              },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={!draft.trim()}
            startIcon={<SendIcon sx={{ fontSize: 16 }} />}
            sx={{
              flexShrink: 0,
              height: 40,
              px: 2,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              color: '#fff',
              backgroundImage: AI_GRADIENT,
              boxShadow: 'none',
              '&.Mui-disabled': { backgroundImage: 'none', bgcolor: 'var(--bg-active)', color: 'var(--text-disabled)' },
            }}
          >
            问 AI
          </Button>
        </Box>

        {!submitted && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
            {AI_SEARCH_EXAMPLES.map((s) => (
              <Box
                key={s}
                component="button"
                onClick={() => submit(s)}
                sx={{
                  px: 1.25, py: 0.5, borderRadius: 999, cursor: 'pointer', font: 'inherit', fontSize: 12,
                  color: 'var(--text-secondary)', bgcolor: 'var(--bg-body)',
                  border: '1px solid var(--border-color)',
                  '&:hover': { color: ACCENT.blue.main, borderColor: ACCENT.blue.border30 },
                }}
              >
                {s}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {submitted && (
        <Box sx={{ mb: 4 }}>
          <AISearchResults query={submitted} />
        </Box>
      )}

      {/* 其他智能能力 */}
      <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', mb: 0.5 }}>
        更多智能助手
      </Typography>
      <Typography sx={{ fontSize: 12, color: 'var(--text-muted)', mb: 1.5 }}>
        都是可选的,不需要的可以随时关掉
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
        <CapabilityCard
          icon={<FaceRetouchingNaturalIcon />}
          accent={ACCENT.purple.main}
          title="虚拟形象小助手"
          desc="会说话的 3D 形象。帮你找作品、讲讲某部剧、带你去对应页面,也能打字或语音聊天。"
          action={{ label: '了解并开始', onClick: () => router.push('/digital-human') }}
        />
        <CapabilityCard
          icon={<MovieFilterRoundedIcon />}
          accent={ACCENT.orange.main}
          title="创作智能体"
          desc="一组分工协作的 AI:从一句创意写出剧本、拆分镜、生成画面,产出的短剧可直接发布成作品。"
          action={{ label: '打开 AI 短剧工作台', onClick: () => router.push('/account/content?tab=shortdrama-gen') }}
        />
      </Box>

      <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 0.5 }}>
        <Typography sx={{ fontSize: 12, color: 'var(--text-muted)' }}>
          不想在侧栏和搜索页看到 AI 入口?关掉后可在「我的 → 偏好设置 → AI 功能」重新打开。
        </Typography>
        <Switch
          size="small"
          checked={prefs.aiEntry}
          onChange={(_, v) => setPrefs({ aiEntry: v })}
          slotProps={{ input: { 'aria-label': '显示 AI 搜索入口' } }}
        />
      </Box>
    </Box>
  );
}

function CapabilityCard({
  icon,
  accent,
  title,
  desc,
  action,
  toggle,
}: {
  icon: React.ReactNode;
  accent: string;
  title: string;
  desc: string;
  action: { label: string; onClick: () => void };
  toggle?: { label: string; checked: boolean; onChange: (v: boolean) => void };
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2.5,
        bgcolor: 'var(--bg-hover)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ color: accent, display: 'flex', '& svg': { fontSize: 22 } }}>{icon}</Box>
        <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</Typography>
      </Box>
      <Typography sx={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7, flex: 1 }}>{desc}</Typography>
      {toggle && (
        <Box component="label" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
          <Typography sx={{ fontSize: 12, color: 'var(--text-secondary)' }}>{toggle.label}</Typography>
          <Switch size="small" checked={toggle.checked} onChange={(_, v) => toggle.onChange(v)} />
        </Box>
      )}
      <Button
        variant="text"
        onClick={action.onClick}
        endIcon={<ArrowForwardRoundedIcon />}
        sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 600, color: accent, px: 0, minWidth: 0 }}
      >
        {action.label}
      </Button>
    </Box>
  );
}
