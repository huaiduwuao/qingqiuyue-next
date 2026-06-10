'use client';

import React, { useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CampaignIcon from '@mui/icons-material/Campaign';
import { gradient2, gradient3 } from '@/constants/gradients';

interface Topic {
  id: number;
  title: string;
  desc: string;
  heat: number;
  tag: '活动' | '热点' | '挑战' | '话题';
  reward: string;
  participants: string;
  color: string;
  bgGradient: string;
}

const TOPICS: Topic[] = [
  {
    id: 1,
    title: '618 创作激励计划',
    desc: '瓜分千万流量，最高奖 10w',
    heat: 9862,
    tag: '活动',
    reward: '¥100,000',
    participants: '12.3w 创作者参与',
    color: 'primary.main',
    bgGradient: gradient3('#FE2C55', '#FF6B8A', '#FFB400', 60),
  },
  {
    id: 2,
    title: '夏日 vlog 挑战赛',
    desc: '上传夏日作品即可参与抽奖',
    heat: 7241,
    tag: '挑战',
    reward: 'iPhone 16 Pro',
    participants: '8.6w 创作者参与',
    color: 'secondary.main',
    bgGradient: gradient3('#25F4EE', '#5DF7F2', '#FFB400', 60),
  },
  {
    id: 3,
    title: '新星扶持计划',
    desc: '新人创作者专属流量包',
    heat: 5420,
    tag: '活动',
    reward: '¥5,000 流量包',
    participants: '4.2w 新人参与',
    color: 'warning.main',
    bgGradient: gradient3('#FFB400', '#FFD566', '#FE2C55', 60),
  },
  {
    id: 4,
    title: '高考加油',
    desc: '为考生送上祝福',
    heat: 4128,
    tag: '话题',
    reward: '话题热度榜',
    participants: '23.5w 作品参与',
    color: '#8B5CF6',
    bgGradient: gradient3('#8B5CF6', '#C4B5FD', '#25F4EE', 60),
  },
  {
    id: 5,
    title: '父亲节短视频',
    desc: '记录与父亲的温馨时刻',
    heat: 3820,
    tag: '话题',
    reward: '官方推荐',
    participants: '6.8w 作品参与',
    color: 'success.main',
    bgGradient: gradient2('#5DDB96', '#25F4EE'),
  },
];

const TAG_COLORS: Record<Topic['tag'], string> = {
  活动: 'primary.main',
  热点: 'warning.main',
  挑战: 'secondary.main',
  话题: '#8B5CF6',
};

const TagIcon = ({ tag }: { tag: Topic['tag'] }) => {
  if (tag === '活动') return <EmojiEventsIcon sx={{ fontSize: 12 }} />;
  if (tag === '热点') return <LocalFireDepartmentIcon sx={{ fontSize: 12 }} />;
  return <CampaignIcon sx={{ fontSize: 12 }} />;
};

export default function HotTopicsCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 1 | -1) => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    el.scrollBy({ left: dir * 280, behavior: 'smooth' });
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: 3,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <LocalFireDepartmentIcon sx={{ fontSize: 18, color: 'primary.main', mr: 1 }} />
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary', flex: 1 }}>
          实时热点
        </Typography>
        <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => scroll(-1)}
            sx={{
              color: 'text.secondary',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 0.5,
              '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
            }}
          >
            <ArrowBackIosNewIcon sx={{ fontSize: 12 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => scroll(1)}
            sx={{
              color: 'text.secondary',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 0.5,
              '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
            }}
          >
            <ArrowForwardIosIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Box>
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 2 }}>热门活动与话题，助你获取更多流量</Typography>

      <Box
        ref={scrollRef}
        sx={{
          display: 'flex',
          gap: 1.5,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          pb: 1,
          mx: -3,
          px: 3,
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 2 },
        }}
      >
        {TOPICS.map((t) => (
          <Box
            key={t.id}
            sx={{
              flex: '0 0 240px',
              minWidth: 240,
              scrollSnapAlign: 'start',
              borderRadius: 2,
              bgcolor: '#1E2030',
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'all 0.25s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                borderColor: t.color,
                boxShadow: `0 8px 24px ${t.color}33`,
              },
            }}
          >
            <Box
              sx={{
                height: 80,
                background: t.bgGradient,
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-end',
                p: 1.5,
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.75,
                  bgcolor: 'rgba(0, 0, 0, 0.4)',
                  color: 'text.primary',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                <LocalFireDepartmentIcon sx={{ fontSize: 11, color: 'warning.main' }} />
                <span style={{ fontFamily: 'monospace' }}>{t.heat.toLocaleString()}</span>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.75,
                  bgcolor: 'rgba(255, 255, 255, 0.95)',
                  color: TAG_COLORS[t.tag],
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                <TagIcon tag={t.tag} />
                {t.tag}
              </Box>
            </Box>
            <Box sx={{ p: 1.5 }}>
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'text.primary',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {t.title}
              </Typography>
              <Typography
                sx={{
                  fontSize: 11,
                  color: 'text.secondary',
                  mt: 0.25,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {t.desc}
              </Typography>
              <Box
                sx={{
                  mt: 1,
                  pt: 1,
                  borderTop: '1px dashed',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography sx={{ fontSize: 10, color: t.color, fontWeight: 600 }}>
                  {t.reward}
                </Typography>
                <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>{t.participants}</Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
