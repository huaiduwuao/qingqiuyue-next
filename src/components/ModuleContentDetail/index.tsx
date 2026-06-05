'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ShareIcon from '@mui/icons-material/Share';
import ChatBubbleOutlineIcon from '@mui/icons-material/ModeCommentOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SendIcon from '@mui/icons-material/Send';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { gradient2, gradient3 } from '@/constants/gradients';

interface ModuleContentDetailProps {
  detail: {
    id?: string | number;
    name?: string;
    info?: string;
    cover?: string;
    content?: string;
    type?: string;
    author?: string;
    authorAvatar?: string;
    views?: number;
    likes?: number;
    comments?: number;
    collects?: number;
    tags?: string[];
  };
  onClose?: () => void;
}

const MOCK_COMMENTS = [
  {
    id: 'c1',
    user: '月下独酌',
    avatar: 'primary.main',
    text: '太精彩了，求更新！！！',
    likes: 128,
    time: '2 小时前',
  },
  {
    id: 'c2',
    user: '云中鹤',
    avatar: 'secondary.main',
    text: '作者的文笔真好，意境很美，收藏了。',
    likes: 86,
    time: '5 小时前',
  },
  {
    id: 'c3',
    user: '南方有暖阳',
    avatar: 'warning.main',
    text: '看完心里暖暖的，希望作者继续加油。',
    likes: 54,
    time: '昨天 18:23',
  },
];

export default function ModuleContentDetail({ detail, onClose }: ModuleContentDetailProps) {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [starred, setStarred] = useState(false);
  const [commentText, setCommentText] = useState('');

  const stats = {
    views: detail.views ?? 12384,
    likes: detail.likes ?? 1268,
    comments: detail.comments ?? 84,
    collects: detail.collects ?? 234,
  };

  return (
    <Box
      sx={{
        maxWidth: 880,
        mx: 'auto',
        my: { xs: 1, md: 3 },
        bgcolor: 'background.paper',
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}
    >
      {/* Cover area */}
      {detail.cover && (
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: { xs: '4/3', md: '16/9' },
            background: gradient3('#FE2C55', '#8B5CF6', '#25F4EE'),
            overflow: 'hidden',
          }}
        >
          <Box
            component="img"
            src={detail.cover}
            alt={detail.name}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e: any) => {
              e.target.style.display = 'none';
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              px: 1.25,
              py: 0.5,
              borderRadius: 1,
              bgcolor: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              color: 'text.primary',
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <VisibilityIcon sx={{ fontSize: 12 }} />
            {stats.views.toLocaleString('zh-CN')}
          </Box>
        </Box>
      )}

      <Box sx={{ p: { xs: 2, md: 3 } }}>
        {/* Title + Tags */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              fontSize: { xs: 18, md: 22 },
              lineHeight: 1.3,
              flex: 1,
              minWidth: 0,
            }}
          >
            {detail.name}
          </Typography>
          {detail.tags?.map((t) => (
            <Chip
              key={t}
              label={`#${t}`}
              size="small"
              sx={{
                bgcolor: 'rgba(254, 44, 85, 0.08)',
                color: 'primary.main',
                fontSize: 11,
                height: 22,
                '&:hover': { bgcolor: 'rgba(254, 44, 85, 0.15)' },
              }}
            />
          ))}
        </Box>

        {detail.info && (
          <Typography
            sx={{
              fontSize: 13,
              color: 'text.secondary',
              lineHeight: 1.6,
              mb: 2,
            }}
          >
            {detail.info}
          </Typography>
        )}

        {/* Author row */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: 'action.hover',
            mb: 2,
          }}
        >
          <Avatar
            sx={{
              width: 40,
              height: 40,
              background: gradient2('#FE2C55', '#8B5CF6'),
              fontWeight: 700,
            }}
          >
            {(detail.author || '清秋月').charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{detail.author || '清秋月'}</Typography>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>签约创作者 · 10.2w 粉丝</Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            sx={{
              borderRadius: 4,
              fontSize: 12,
              px: 2,
              background: gradient2('#FE2C55', '#FF6B8A'),
            }}
          >
            + 关注
          </Button>
        </Box>

        {/* Content body */}
        {detail.content && (
          <Box
            sx={{
              fontSize: 14,
              lineHeight: 1.85,
              color: 'text.primary',
              whiteSpace: 'pre-wrap',
              mb: 2,
              wordBreak: 'break-word',
            }}
          >
            {detail.content}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Action bar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 0.5, md: 2 },
            flexWrap: 'wrap',
          }}
        >
          <ActionButton
            active={liked}
            onClick={() => {
              setLiked(!liked);
              if (disliked) setDisliked(false);
            }}
            icon={
              liked ? (
                <FavoriteIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              ) : (
                <ThumbUpOutlinedIcon sx={{ fontSize: 18 }} />
              )
            }
            count={stats.likes + (liked ? 1 : 0)}
            activeColor="primary.main"
            label="点赞"
          />
          <ActionButton
            active={disliked}
            onClick={() => {
              setDisliked(!disliked);
              if (liked) setLiked(false);
            }}
            icon={
              disliked ? (
                <ThumbDownIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              ) : (
                <ThumbDownOutlinedIcon sx={{ fontSize: 18 }} />
              )
            }
            label="不喜欢"
          />
          <ActionButton
            active={starred}
            onClick={() => setStarred(!starred)}
            icon={
              starred ? (
                <StarIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              ) : (
                <StarBorderIcon sx={{ fontSize: 18 }} />
              )
            }
            count={stats.collects + (starred ? 1 : 0)}
            activeColor="warning.main"
            label="收藏"
          />
          <ActionButton
            icon={<ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />}
            count={stats.comments}
            label="评论"
          />
          <ActionButton
            icon={<ShareIcon sx={{ fontSize: 18 }} />}
            label="分享"
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Comments */}
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 1.5 }}>
            精选评论 ({MOCK_COMMENTS.length})
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
            {MOCK_COMMENTS.map((c) => (
              <Box key={c.id} sx={{ display: 'flex', gap: 1 }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: c.avatar, fontSize: 13, fontWeight: 700 }}>
                  {c.user.charAt(0)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
                      {c.user}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{c.time}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 13, mt: 0.25, lineHeight: 1.5 }}>{c.text}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, color: 'text.secondary' }}>
                    <IconButton size="small" sx={{ p: 0.25 }}>
                      <ThumbUpOutlinedIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                    <Typography sx={{ fontSize: 11 }}>{c.likes}</Typography>
                    <Typography sx={{ fontSize: 11, ml: 1, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}>
                      回复
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>

          <TextField
            fullWidth
            size="small"
            placeholder="发条友善的评论吧..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      disabled={!commentText.trim()}
                      sx={{ color: 'primary.main' }}
                    >
                      <SendIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'action.hover',
                fontSize: 13,
                borderRadius: 4,
              },
            }}
          />
        </Box>

        {onClose && (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 4, minWidth: 120 }}>
              关闭
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function ActionButton({
  active,
  onClick,
  icon,
  count,
  label,
  activeColor,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  count?: number;
  label: string;
  activeColor?: string;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: { xs: 1, md: 1.5 },
        py: 0.75,
        borderRadius: 4,
        cursor: 'pointer',
        bgcolor: active ? `${activeColor}1A` : 'transparent',
        color: active ? activeColor : 'text.secondary',
        transition: 'all 0.2s',
        '&:hover': { bgcolor: active ? `${activeColor}26` : 'action.hover', color: active ? activeColor : 'text.primary' },
      }}
    >
      {icon}
      {(count !== undefined || label) && (
        <Typography sx={{ fontSize: 12, fontWeight: 500 }}>
          {count !== undefined ? count.toLocaleString('zh-CN') : label}
        </Typography>
      )}
    </Box>
  );
}
