'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import FiberNewRoundedIcon from '@mui/icons-material/FiberNewRounded';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import TheatersRoundedIcon from '@mui/icons-material/TheatersRounded';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import AnimationRoundedIcon from '@mui/icons-material/AnimationRounded';
import PodcastsRoundedIcon from '@mui/icons-material/PodcastsRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { PUBLISH_HUB_TYPE_LABEL, type PublishHubType } from '@/lib/contentRoute';

/**
 * hd-publish dispatcher 的"类型选择"落地页。
 *
 * 旧设计问题:点侧栏「发布」直接落到视频拖拽区,13 个类型 chip 被压在小条,
 * 新用户根本意识不到还有图文/文章/小说等其他 12 种内容。
 *
 * 新设计:进来先看到 13 张类型卡片(每张带图标 + 一句话说明 + 配色),
 * 点了才进入对应表单(VIDEO 内联、其他 Dialog)。PublishTypeChips 保留
 * 在顶部,作为已选后切换的快捷方式;附「← 重新选择」回到本落地页。
 */
export interface TypePickerProps {
  onPick: (type: PublishHubType) => void;
}

interface TypeCardDef {
  type: Exclude<PublishHubType, 'all'>;
  desc: string;
  icon: React.ReactElement;
  color: string;
  bg: string;
  badge?: 'NEW' | 'HOT';
}

const TYPE_CARDS: TypeCardDef[] = [
  { type: 'video',       desc: '4K / HDR / 多音轨字幕',         icon: <CloudUploadRoundedIcon />,   color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)',   badge: 'HOT' },
  { type: 'picture-album', desc: '多图 + 短文 + 标签',           icon: <ImageRoundedIcon />,          color: '#FF7AB6', bg: 'rgba(255, 122, 182, 0.14)' },
  { type: 'picture-mv',  desc: '多图配音乐 · 时间轴',           icon: <PhotoLibraryRoundedIcon />,   color: '#F472B6', bg: 'rgba(244, 114, 182, 0.14)' },
  { type: 'article',     desc: '长文 + 封面 + 分类',             icon: <ArticleRoundedIcon />,        color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.12)' },
  { type: 'novel',       desc: '章节结构 · 长文本',             icon: <MenuBookRoundedIcon />,       color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  { type: 'news',        desc: '实时性 · 时事标签',             icon: <FiberNewRoundedIcon />,       color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)' },
  { type: 'music',       desc: '音频 + LRC 歌词',                icon: <MusicNoteRoundedIcon />,      color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)' },
  { type: 'comics',      desc: '分镜 + 页面',                   icon: <AutoStoriesRoundedIcon />,    color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' },
  { type: 'vshow',       desc: '选集结构',                       icon: <MovieFilterRoundedIcon />,    color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
  { type: 'teleplay',    desc: '多集分集剧情',                   icon: <LiveTvRoundedIcon />,         color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
  { type: 'film',        desc: '长片 + 预告',                   icon: <MovieRoundedIcon />,          color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.12)' },
  { type: 'animation',   desc: '集数 + 制作信息',               icon: <AnimationRoundedIcon />,      color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  { type: 'live',        desc: '推流码 + 封面 + 预约',         icon: <PodcastsRoundedIcon />,       color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)' },
];

export function TypePicker({ onPick }: TypePickerProps) {
  return (
    <Box>
      {/* Hero header */}
      <Box
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          background: 'linear-gradient(135deg, rgba(254, 44, 85, 0.06) 0%, rgba(37, 244, 238, 0.06) 60%, rgba(139, 92, 246, 0.06) 100%)',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, #FE2C55 0%, #25F4EE 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <CloudUploadRoundedIcon sx={{ fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>
              选择要发布的内容类型
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
              支持 13 种内容形态 · 提交后进入审核队列
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* 13 类型卡片网格 */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
      >
        {TYPE_CARDS.map((c) => (
          <Box
            key={c.type}
            role="button"
            tabIndex={0}
            onClick={() => onPick(c.type)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onPick(c.type);
              }
            }}
            sx={{
              position: 'relative',
              p: 2,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              cursor: 'pointer',
              transition: 'all 0.18s',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.75,
              minHeight: 132,
              '&:hover': {
                borderColor: c.color,
                transform: 'translateY(-2px)',
                boxShadow: `0 6px 20px ${c.bg}`,
                '& .arrow': { opacity: 1, transform: 'translateX(0)' },
              },
              '&:focus-visible': {
                outline: `2px solid ${c.color}`,
                outlineOffset: 2,
              },
            }}
            aria-label={`发布 ${PUBLISH_HUB_TYPE_LABEL[c.type]}`}
          >
            {c.badge && (
              <Chip
                size="small"
                label={c.badge}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  height: 18,
                  fontSize: 10,
                  fontWeight: 700,
                  bgcolor: c.bg,
                  color: c.color,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            )}
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: c.bg,
                color: c.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '& .MuiSvgIcon-root': { fontSize: 22 },
              }}
            >
              {c.icon}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                {PUBLISH_HUB_TYPE_LABEL[c.type]}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25, lineHeight: 1.4 }}>
                {c.desc}
              </Typography>
            </Box>
            <Box
              className="arrow"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: 11,
                fontWeight: 600,
                color: c.color,
                opacity: 0.55,
                transform: 'translateX(-4px)',
                transition: 'all 0.18s',
              }}
            >
              立即发布
              <ArrowForwardRoundedIcon sx={{ fontSize: 13 }} />
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
