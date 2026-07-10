'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ModeCommentIcon from '@mui/icons-material/ModeComment';
import { CoverImage } from '@/components/common/CoverImage';
import { moduleContentAction } from '@/apis/home';
import { collectContent } from '@/apis/global';

interface ContentItem {
  id: number;
  title: string;
  subtitle?: string;
  contentType: string;
  cover?: string;
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
  const [liked, setLiked] = useState(false);
  const [collected, setCollected] = useState(false);
  const [agreeCount, setAgreeCount] = useState(content.agreeCount || 0);
  const [collectCount, setCollectCount] = useState(content.collectCount || 0);

  // 点赞:乐观切换 + 失败回滚;字段对齐后端 moduleContentAction({contentId, action})。
  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !liked;
    const prevLiked = liked;
    const prevCount = agreeCount;
    setLiked(next);
    setAgreeCount((c) => c + (next ? 1 : -1));
    try {
      await moduleContentAction({ contentId: content.id, action: next ? 'agree' : 'cancel_agree' });
    } catch {
      setLiked(prevLiked);
      setAgreeCount(prevCount);
    }
  };

  // 收藏:后端 toggle 不读 action;以响应 collected 校正布尔,计数乐观 + 回滚。
  const handleCollect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const prevCollected = collected;
    const prevCount = collectCount;
    setCollected(!collected);
    setCollectCount((c) => c + (collected ? -1 : 1));
    try {
      const res: any = await collectContent({ contentId: content.id });
      const server = res?.data?.collected;
      if (typeof server === 'boolean') setCollected(server);
    } catch {
      setCollected(prevCollected);
      setCollectCount(prevCount);
    }
  };

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
        <CoverImage
          src={content.cover || content.coverUrl}
          alt={content.title}
          sx={{ width: 120, height: 160, borderRadius: 1, flexShrink: 0 }}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              onClick={handleLike}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover': { color: 'error.main' } }}
            >
              {liked ? <FavoriteIcon fontSize="small" color="error" /> : <FavoriteBorderIcon fontSize="small" color="action" />}
              <Typography variant="caption">{formatCount(agreeCount)}</Typography>
            </Box>
            <Box
              onClick={handleCollect}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover': { color: 'warning.main' } }}
            >
              {collected ? <StarIcon fontSize="small" color="warning" /> : <StarBorderIcon fontSize="small" color="action" />}
              <Typography variant="caption">{formatCount(collectCount)}</Typography>
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
