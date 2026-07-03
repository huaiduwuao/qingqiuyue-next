'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ModeCommentIcon from '@mui/icons-material/ModeComment';
import { fallbackImg } from '@/lib/utils';

interface ContentItem {
  id: number;
  title: string;
  subtitle?: string;
  contentType: string;
  coverUrl?: string;
  status: string;
  agreeCount?: number;
  collectCount?: number;
  commentCount?: number;
  [key: string]: any;
}

interface ModuleContentCardProps {
  content: ContentItem;
  onClick?: () => void;
}

const CONTENT_TYPE_MAP: Record<string, string> = {
  NOVEL: '小说',
  VIDEO: '视频',
  MUSIC: '音乐',
  FILM: '电影',
  ARTICLE: '文章',
  ANIMATION: '动画',
  TELEPLAY: '电视剧',
  COMICS: '漫画',
  VSHOW: '综艺',
  LIVE: '直播',
  PAN: '网盘',
  WEBSITE: '网站',
  PICTURE_ALBUM: '图集',
};

function formatCount(num: number): string {
  if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
}

export default function ModuleContentCard({ content, onClick }: ModuleContentCardProps) {
  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: 4,
        },
      }}
      onClick={onClick}
    >
      <Box sx={{ display: 'flex', p: 1.5, gap: 2 }}>
        <CardMedia
          component="img"
          sx={{ width: 120, height: 160, borderRadius: 1, objectFit: 'cover' }}
          image={content.coverUrl || fallbackImg}
          alt={content.title}
        />
        <CardContent sx={{ flex: 1, p: '0 !important', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={CONTENT_TYPE_MAP[content.contentType] || content.contentType}
              size="small"
              color="primary"
              variant="outlined"
            />
            {content.status === 'PUBLISH' ? (
              <Chip label="已发布" size="small" color="success" variant="outlined" />
            ) : (
              <Chip label="未发布" size="small" color="default" variant="outlined" />
            )}
          </Box>
          <Typography variant="h6" noWrap>
            {content.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {content.subtitle || '暂无描述'}
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FavoriteBorderIcon fontSize="small" color="action" />
              <Typography variant="caption">{formatCount(content.agreeCount || 0)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <FavoriteBorderIcon fontSize="small" color="action" />
              <Typography variant="caption">{formatCount(content.collectCount || 0)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ModeCommentIcon fontSize="small" color="action" />
              <Typography variant="caption">{formatCount(content.commentCount || 0)}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Box>
    </Card>
  );
}