'use client';

/**
 * /digital-human 的介绍页:第一次来的用户先知道这是什么、能帮什么忙、怎么用,
 * 再自己决定进不进入对话,以及要不要让小助手常驻在页面角落。
 * 不加载 3D 舞台 —— 只看介绍的人不该为 three.js 付流量。
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import FaceRetouchingNaturalIcon from '@mui/icons-material/FaceRetouchingNatural';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import NearMeRoundedIcon from '@mui/icons-material/NearMeRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { useAIPrefs } from '@/lib/aiPrefs';

const CYAN = '#25F4EE';
const PURPLE = '#8B5CF6';

const CAPABILITIES = [
  {
    icon: <TravelExploreRoundedIcon />,
    title: '帮你找作品',
    desc: '说一句"想看轻松的国产动画",它会在站内找出来,直接帮你打开。',
  },
  {
    icon: <NearMeRoundedIcon />,
    title: '带你逛站',
    desc: '说"打开排行榜""去我的收藏",它会带你过去,不用自己翻菜单。',
  },
  {
    icon: <EditNoteRoundedIcon />,
    title: '陪你创作',
    desc: '背后连着站内的创作智能体:起标题、写简介、构思短剧,都可以交给它。',
  },
];

const STEPS = [
  { n: 1, text: '点「开始对话」进入全屏形象(需要登录,聊天记录跟着账号走)' },
  { n: 2, text: '在底部输入框打字,或按麦克风直接说话' },
  { n: 3, text: '想换个擅长别的事的助手,在输入框上方切换智能体' },
];

export default function DigitalHumanIntro({ onStart }: { onStart: () => void }) {
  const router = useRouter();
  const { status } = useAuth();
  const [prefs, setPrefs] = useAIPrefs();
  const authed = status === 'authenticated';

  const start = () => {
    if (!authed) {
      // 登录回来直接进入对话,不再看一遍介绍
      router.push(loginHref('/digital-human?start=1'));
      return;
    }
    onStart();
  };

  const leave = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/home/recommend');
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        color: '#fff',
        background: `radial-gradient(circle at 50% 0%, #1a2350 0%, #05060B 60%)`,
        pt: 'var(--sat, 0px)',
        pb: 6,
      }}
    >
      <Box sx={{ maxWidth: 880, mx: 'auto', px: 2 }}>
        <IconButton onClick={leave} aria-label="返回" sx={{ mt: 1.5, color: 'rgba(255,255,255,0.85)' }}>
          <ArrowBackRoundedIcon />
        </IconButton>

        {/* 头图 */}
        <Box sx={{ textAlign: 'center', pt: { xs: 2, md: 4 }, pb: { xs: 3, md: 5 } }}>
          <Box
            aria-hidden
            sx={{
              width: 96,
              height: 96,
              mx: 'auto',
              mb: 2.5,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${CYAN} 0%, ${PURPLE} 100%)`,
              boxShadow: `0 0 0 8px rgba(37,244,238,0.08), 0 12px 40px rgba(139,92,246,0.45)`,
            }}
          >
            <FaceRetouchingNaturalIcon sx={{ fontSize: 52, color: '#fff' }} />
          </Box>
          <Typography component="h1" sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 800, mb: 1.25 }}>
            清秋月 AI 小助手
          </Typography>
          <Typography sx={{ fontSize: { xs: 14, md: 16 }, color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, maxWidth: 520, mx: 'auto' }}>
            一个会说话、会动的虚拟形象。你负责说想要什么,
            <br />
            它负责在站里帮你找、帮你去、帮你写。
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap', mt: 3.5 }}>
            <Button
              variant="contained"
              size="large"
              onClick={start}
              disabled={status === 'loading'}
              sx={{
                px: 4,
                borderRadius: 999,
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: CYAN,
                color: '#05060B',
                '&:hover': { bgcolor: '#1fd9d4' },
              }}
            >
              {authed || status === 'loading' ? '开始对话' : '登录后开始对话'}
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={leave}
              sx={{
                px: 3,
                borderRadius: 999,
                textTransform: 'none',
                color: 'rgba(255,255,255,0.75)',
                bgcolor: 'transparent',
                borderColor: 'rgba(255,255,255,0.18)',
                boxShadow: 'none',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.3)' },
              }}
            >
              暂时不用
            </Button>
          </Box>
        </Box>

        {/* 能做什么 */}
        <SectionTitle>它能帮你做什么</SectionTitle>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5, mb: 4 }}>
          {CAPABILITIES.map((c) => (
            <Box key={c.title} sx={card}>
              <Box sx={{ color: CYAN, mb: 1, '& svg': { fontSize: 26 } }}>{c.icon}</Box>
              <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 0.5 }}>{c.title}</Typography>
              <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.75 }}>{c.desc}</Typography>
            </Box>
          ))}
        </Box>

        {/* 怎么用 */}
        <SectionTitle>怎么用</SectionTitle>
        <Box sx={{ ...card, mb: 4 }}>
          {STEPS.map((s) => (
            <Box key={s.n} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 0.75 }}>
              <Box
                sx={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#05060B', bgcolor: CYAN,
                }}
              >
                {s.n}
              </Box>
              <Typography sx={{ fontSize: 13.5, color: 'rgba(255,255,255,0.8)', lineHeight: '24px' }}>{s.text}</Typography>
            </Box>
          ))}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, color: 'rgba(255,255,255,0.5)' }}>
            <MicRoundedIcon sx={{ fontSize: 15 }} />
            <Typography sx={{ fontSize: 12 }}>语音只在你按下麦克风时才会录音</Typography>
          </Box>
        </Box>

        {/* 你来决定 */}
        <SectionTitle>用不用,你来决定</SectionTitle>
        <Box sx={card}>
          <PrefRow
            label="下次直接进入对话"
            desc="跳过这个介绍页;想再看时从「我的 → 偏好设置 → AI 功能 → 小助手介绍」进来"
            checked={prefs.skipIntro}
            onChange={(v) => setPrefs({ skipIntro: v })}
          />
          <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', mt: 1.5 }}>
            这些选项也可以在「我的 → 偏好设置 → AI 功能」里随时修改。
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

const card = {
  p: 2.25,
  borderRadius: 3,
  bgcolor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700, mb: 1.25, color: 'rgba(255,255,255,0.92)' }}>
      {children}
    </Typography>
  );
}

function PrefRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{label}</Typography>
        <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', mt: 0.25 }}>{desc}</Typography>
      </Box>
      <Switch
        checked={checked}
        onChange={(_, v) => onChange(v)}
        sx={{ '& .Mui-checked': { color: `${CYAN} !important` }, '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${CYAN} !important` } }}
      />
    </Box>
  );
}
