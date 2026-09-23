'use client';

import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ChatBubbleOutlineIcon from '@mui/icons-material/ModeCommentOutlined';
import { CoverImage } from '@/components/common/CoverImage';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SendIcon from '@mui/icons-material/Send';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { gradient2, gradient3 } from '@/constants/gradients';
import { sendComment, getComments } from '@/apis/home';
import { postShare } from '@/apis/behavior';
import { useContentInteraction } from '@/hooks/useContentInteraction';
import { homeClient, formatApiError } from '@/lib/api/client';
import { toEntityId } from '@/lib/id';
import ShareButtons from '@/components/share/ShareButtons';

interface CommentItem {
  id: number;
  content: string;
  createTime?: string;
  username?: string;
  avatar?: string;
  agreeNum?: number;
}

interface ModuleContentDetailProps {
  detail: {
    id?: string | number;
    name?: string;
    title?: string;
    info?: string;
    cover?: string;
    content?: string;
    type?: string;
    contentType?: string;
    author?: string;
    username?: string;
    authorAvatar?: string;
    authorId?: string | number;
    userId?: string | number;
    isFollowing?: boolean;
    views?: number;
    readNum?: number;
    likes?: number;
    agreeNum?: number;
    comments?: number;
    commentNum?: number;
    collects?: number;
    collectNum?: number;
    tags?: string[];
  };
  onClose?: () => void;
}

export default function ModuleContentDetail({ detail, onClose }: ModuleContentDetailProps) {
  const contentId = detail.id;
  const contentName = detail.name ?? detail.title ?? '';
  const contentInfo = detail.info ?? '';
  const authorName = detail.author ?? detail.username ?? '清秋月';
  const authorId = detail.authorId ?? detail.userId;
  // 计数缺失时显示 0。此前兜底成 12384 / 1268 / 84 / 234 这样的假数字,冒充真实热度。
  const baseViews = Number(detail.views ?? detail.readNum ?? 0) || 0;
  const baseLikes = Number(detail.likes ?? detail.agreeNum ?? 0) || 0;
  const baseComments = Number(detail.comments ?? detail.commentNum ?? 0) || 0;
  const baseCollects = Number(detail.collects ?? detail.collectNum ?? 0) || 0;

  const [following, setFollowing] = useState(() => !!detail.isFollowing);
  const [followBusy, setFollowBusy] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const notify = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  // 赞 / 踩 / 收藏:真实状态从 /interaction 读,操作后以服务端为准并给出提示(见 hooks/useContentInteraction)
  const interaction = useContentInteraction(contentId, { notify, baseLikes, baseCollects });
  const { liked, disliked, collected: starred } = interaction;

  const stats = {
    views: baseViews,
    likes: Math.max(0, baseLikes + interaction.likeDelta),
    comments: baseComments,
    collects: Math.max(0, baseCollects + interaction.collectDelta),
  };

  const fetchComments = useCallback(async () => {
    if (!contentId) return;
    setCommentsLoading(true);
    try {
      const res = await getComments(contentId);
      const payload = (res as { data?: { list?: CommentItem[] } | CommentItem[] })?.data;
      const list = Array.isArray(payload) ? payload : payload?.list ?? [];
      setComments(list);
    } catch (err) {
      console.error('load comments failed', err);
    } finally {
      setCommentsLoading(false);
    }
  }, [contentId]);

  const handleOpenComments = () => {
    setCommentDialogOpen(true);
    void fetchComments();
  };

  const handleFollow = async () => {
    if (!authorId) {
      notify('无法获取作者信息', 'error');
      return;
    }
    if (followBusy) return;
    setFollowBusy(true);
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    try {
      if (wasFollowing) {
        await homeClient.delete(`/follow/${authorId}`);
        notify('已取消关注');
      } else {
        await homeClient.post(`/follow/${authorId}`);
        notify('关注成功');
      }
    } catch (err) {
      setFollowing(wasFollowing);
      notify(formatApiError(err), 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleLike = () => interaction.toggleLike();
  const handleDislike = () => interaction.toggleDislike();
  const handleStar = () => interaction.toggleCollect();

  const handleSendComment = async () => {
    if (!contentId || !commentText.trim()) return;
    setSendingComment(true);
    try {
      await sendComment({ contentId: toEntityId(contentId), content: commentText.trim() });
      setCommentText('');
      notify('评论已发送');
      await fetchComments();
    } catch (err) {
      notify(formatApiError(err), 'error');
    } finally {
      setSendingComment(false);
    }
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
          {/* 分享/外链详情首图:走 CoverImage → mediaUrl 统一代理改写 + 失败兜底,
              避免外链图防盗链 / MinIO 内网直链在公网打不开。原 onError display:none
              会让占位都没了。 */}
          <CoverImage
            src={detail.cover}
            alt={contentName}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
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
            {Number(stats.views).toLocaleString('zh-CN')}
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
            {contentName}
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

        {contentInfo && (
          <Typography
            sx={{
              fontSize: 13,
              color: 'text.secondary',
              lineHeight: 1.6,
              mb: 2,
            }}
          >
            {contentInfo}
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
            src={detail.authorAvatar}
          >
            {(authorName || '清秋月').charAt(0)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{authorName}</Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            disabled={followBusy || !authorId}
            onClick={handleFollow}
            sx={{
              borderRadius: 4,
              fontSize: 12,
              px: 2,
              background: following ? 'action.hover' : gradient2('#FE2C55', '#FF6B8A'),
              color: following ? 'text.secondary' : 'text.primary',
              '&:hover': {
                background: following ? 'action.selected' : gradient2('#FE2C55', '#FF6B8A'),
                opacity: 0.92,
              },
            }}
          >
            {following ? '已关注' : '+ 关注'}
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
            onClick={handleLike}
            icon={
              liked ? (
                <FavoriteIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              ) : (
                <ThumbUpOutlinedIcon sx={{ fontSize: 18 }} />
              )
            }
            count={stats.likes}
            activeColor="primary.main"
            label="点赞"
          />
          <ActionButton
            active={disliked}
            onClick={handleDislike}
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
            onClick={handleStar}
            icon={
              starred ? (
                <StarIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              ) : (
                <StarBorderIcon sx={{ fontSize: 18 }} />
              )
            }
            count={stats.collects}
            activeColor="warning.main"
            label="收藏"
          />
          <ActionButton
            icon={<ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />}
            count={stats.comments}
            label="评论"
            onClick={handleOpenComments}
          />
        </Box>

        <Box sx={{ mt: 2 }}>
          <ShareButtons
            contentType={(detail as any)?.contentType || 'work'}
            contentId={toEntityId((detail as any)?.id) ?? 0}
            title={contentName || '清秋月内容'}
            url={typeof window !== 'undefined' ? window.location.href : ''}
            cover={(detail as any)?.cover}
            desc={(detail as any)?.desc || (detail as any)?.intro}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Comments */}
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 1.5 }}>
            精选评论 ({comments.length})
          </Typography>

          {comments.length === 0 ? (
            <Typography sx={{ p: 3, textAlign: 'center', color: 'text.secondary', fontSize: 12, mb: 2 }}>
              暂无评论
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
              {comments.map((c) => (
                <Box key={c.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Avatar sx={{ width: 32, height: 32, fontSize: 13 }} src={c.avatar}>
                    {(c.username || '用').charAt(0)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
                      {c.username || '用户'}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.primary', mt: 0.25, wordBreak: 'break-word' }}>
                      {c.content}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.25 }}>
                      {c.createTime}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          <TextField
            fullWidth
            size="small"
            placeholder="发条友善的评论吧..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && commentText.trim()) {
                handleSendComment();
              }
            }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      disabled={!commentText.trim() || sendingComment}
                      onClick={handleSendComment}
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

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ width: '100%' }}>
          {snack.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={commentDialogOpen}
        onClose={() => setCommentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 15,
            fontWeight: 600,
            pr: 2,
          }}
        >
          评论 ({comments.length})
          <IconButton size="small" onClick={() => setCommentDialogOpen(false)}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 200 }}>
          {commentsLoading ? (
            <Typography sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 13, py: 4 }}>
              加载中...
            </Typography>
          ) : comments.length === 0 ? (
            <Typography sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 13, py: 4 }}>
              暂无评论，来说两句吧
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {comments.map((c) => (
                <Box key={c.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Avatar sx={{ width: 36, height: 36, fontSize: 14 }} src={c.avatar}>
                    {(c.username || '用').charAt(0)}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
                      {c.username || '用户'}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.primary', mt: 0.25, wordBreak: 'break-word' }}>
                      {c.content}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.25 }}>
                      {c.createTime}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="发条友善的评论吧..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && commentText.trim()) {
                handleSendComment();
              }
            }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!commentText.trim() || sendingComment}
                      onClick={handleSendComment}
                      sx={{ borderRadius: 4, textTransform: 'none', minWidth: 0, px: 1.5 }}
                    >
                      发送
                    </Button>
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
        </DialogActions>
      </Dialog>
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
