'use client';

import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import Collapse from '@mui/material/Collapse';
import SendIcon from '@mui/icons-material/Send';
import ChatBubbleOutlineIcon from '@mui/icons-material/ModeCommentOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbDownOutlinedIcon from '@mui/icons-material/ThumbDownOutlined';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import EmojiEmotionsOutlinedIcon from '@mui/icons-material/EmojiEmotionsOutlined';
import ReplyIcon from '@mui/icons-material/Reply';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { getComments, sendComment, commentAction } from '@/apis/home';
import { formatApiError } from '@/lib/api/client';
import { contentClient } from '@/lib/api/client';

// 常用表情/动图列表
const EMOJI_LIST = ['😀', '😄', '😎', '🤔', '😅', '😂', '🤣', '😍', '🥰', '😘',
  '👍', '👎', '❤️', '💯', '🔥', '✨', '🎉', '🎊', '👏', '🙌',
  '😱', '😮', '🤯', '😤', '🥳', '😴', '🤢', '😵', '🤡', '💀'];

const GIF_CATEGORIES = [
  { name: '鼓掌', gifs: ['👏👏', '👍👍', '🎉🎉'] },
  { name: '开心', gifs: ['😂', '🤣', '😄', '🥰', '😍'] },
  { name: '惊讶', gifs: ['😮', '😱', '🤯', '❓'] },
  { name: '爱心', gifs: ['❤️', '💕', '💖', '💗', '💓'] },
];

export interface CommentReply {
  id: number;
  content: string;
  createTime?: string;
  username?: string;
  avatar?: string;
  agreeNum?: number;
  userId?: string | number;
  liked?: boolean;
  disliked?: boolean;
  collected?: boolean;
}

export interface CommentItem {
  id: number;
  content: string;
  createTime?: string;
  username?: string;
  avatar?: string;
  agreeNum?: number;
  userId?: string | number;
  liked?: boolean;
  disliked?: boolean;
  collected?: boolean;
  replies?: CommentReply[];
  replyCount?: number;
  repliesExpanded?: boolean;
}

interface DetailCommentsProps {
  contentId: string | number;
  initialCount?: number;
  compact?: boolean;
  commentCount?: number;
}

// 获取评论回复
async function fetchCommentReplies(replyId: number): Promise<CommentReply[]> {
  const res = await contentClient(`/module/content/comment/${replyId}/replies`) as any;
  const payload = res?.data;
  if (!payload) return [];
  const list: CommentReply[] = Array.isArray(payload) ? payload : payload.list ?? [];
  return list;
}

export function DetailComments({ contentId, initialCount = 0, compact = false, commentCount }: DetailCommentsProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: number; name: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' as const });
  const [displayCount, setDisplayCount] = useState(initialCount);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const [gifAnchor, setGifAnchor] = useState<HTMLElement | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const notify = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const res = await getComments(contentId as string | number);
      const payload = (res as { data?: { list?: CommentItem[] } | CommentItem[] })?.data;
      const list: CommentItem[] = Array.isArray(payload) ? payload : payload?.list ?? [];
      setComments(list.map(c => ({ ...c, repliesExpanded: false, replies: [], replyCount: 0 })));
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

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      await sendComment({ contentId: contentId as string | number, content: commentText.trim() });
      setCommentText('');
      setDisplayCount(c => c + 1);
      notify('评论已发送');
      await fetchComments();
    } catch (err) {
      notify(formatApiError(err), 'error');
    } finally {
      setSendingComment(false);
    }
  };

  // 发送回复
  const handleSendReply = async (parentCommentId: number) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      await sendComment({
        contentId: contentId as string | number,
        content: replyText.trim(),
        replyId: parentCommentId,
      });
      setReplyText('');
      setReplyingTo(null);
      notify('回复已发送');
      await fetchComments();
      // 重新加载回复
      const replies = await fetchCommentReplies(parentCommentId);
      setComments(prev => prev.map(c => {
        if (c.id === parentCommentId) {
          return { ...c, replies, replyCount: replies.length };
        }
        return c;
      }));
    } catch (err) {
      notify(formatApiError(err), 'error');
    } finally {
      setSendingReply(false);
    }
  };

  // 评论顶踩
  const handleCommentAction = async (commentId: number, action: 'agree' | 'disagree') => {
    if (actionLoading === commentId) return;
    setActionLoading(commentId);
    const prevComments = [...comments];
    try {
      setComments(prev => prev.map(c => {
        if (c.id !== commentId) return c;
        if (action === 'agree') {
          const willLike = !c.liked;
          return {
            ...c,
            liked: willLike,
            disliked: false,
            agreeNum: (c.agreeNum ?? 0) + (willLike ? 1 : -1),
          };
        } else {
          return { ...c, disliked: !c.disliked, liked: false };
        }
      }));
      await commentAction({ commentId, action });
    } catch (err) {
      setComments(prevComments);
      notify(formatApiError(err), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 回复顶踩
  const handleReplyAction = async (parentId: number, replyId: number, action: 'agree' | 'disagree') => {
    if (actionLoading === replyId) return;
    setActionLoading(replyId);
    const prevComments = [...comments];
    try {
      setComments(prev => prev.map(c => {
        if (c.id !== parentId) return c;
        return {
          ...c,
          replies: c.replies?.map(r => {
            if (r.id !== replyId) return r;
            if (action === 'agree') {
              const willLike = !r.liked;
              return {
                ...r,
                liked: willLike,
                disliked: false,
                agreeNum: (r.agreeNum ?? 0) + (willLike ? 1 : -1),
              };
            } else {
              return { ...r, disliked: !r.disliked, liked: false };
            }
          }),
        };
      }));
      await commentAction({ commentId: replyId, action });
    } catch (err) {
      setComments(prevComments);
      notify(formatApiError(err), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 切换回复展开
  const toggleReplies = async (commentId: number) => {
    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c;
      if (c.repliesExpanded) {
        return { ...c, repliesExpanded: false };
      }
      return { ...c, repliesExpanded: true };
    }));
    // 加载回复
    const comment = comments.find(c => c.id === commentId);
    if (comment && (!comment.replies || comment.replies.length === 0)) {
      const replies = await fetchCommentReplies(commentId);
      setComments(prev => prev.map(c => {
        if (c.id === commentId) {
          return { ...c, replies, replyCount: replies.length };
        }
        return c;
      }));
    }
  };

  // 评论收藏
  const handleCommentCollect = async (commentId: number) => {
    if (actionLoading === commentId) return;
    setActionLoading(commentId);
    const prevComments = [...comments];
    try {
      setComments(prev => prev.map(c => {
        if (c.id !== commentId) return c;
        return { ...c, collected: !c.collected };
      }));
      await commentAction({ commentId, action: 'collect' });
    } catch (err) {
      setComments(prevComments);
      notify(formatApiError(err), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 回复收藏
  const handleReplyCollect = async (parentId: number, replyId: number) => {
    if (actionLoading === replyId) return;
    setActionLoading(replyId);
    const prevComments = [...comments];
    try {
      setComments(prev => prev.map(c => {
        if (c.id !== parentId) return c;
        return {
          ...c,
          replies: c.replies?.map(r =>
            r.id === replyId ? { ...r, collected: !r.collected } : r
          ),
        };
      }));
      await commentAction({ commentId: replyId, action: 'collect' });
    } catch (err) {
      setComments(prevComments);
      notify(formatApiError(err), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    if (replyingTo) {
      setReplyText(prev => prev + emoji);
    } else {
      setCommentText(prev => prev + emoji);
    }
    setEmojiAnchor(null);
  };

  const handleSelectGif = (gif: string) => {
    if (replyingTo) {
      setReplyText(prev => prev + ' ' + gif);
    } else {
      setCommentText(prev => prev + ' ' + gif);
    }
    setGifAnchor(null);
  };

  // 页面底部展开模式
  if (!compact) {
    return (
      <Box>
        <Divider sx={{ borderColor: 'divider', my: 3 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <ChatBubbleOutlineIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700 }}>
            评论 ({displayCount})
          </Typography>
        </Box>

        {/* 主评论输入框 */}
        <CommentInput
          value={commentText}
          onChange={setCommentText}
          onSend={handleSendComment}
          sending={sendingComment}
          onEmojiClick={(e) => setEmojiAnchor(e.currentTarget)}
          onGifClick={(e) => setGifAnchor(e.currentTarget)}
        />

        <EmojiPicker anchor={emojiAnchor} onClose={() => setEmojiAnchor(null)} onSelect={handleSelectEmoji} />
        <GifPicker anchor={gifAnchor} onClose={() => setGifAnchor(null)} onSelect={handleSelectGif} />

        {commentsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : comments.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>
            暂无评论，快来抢沙发
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {comments.map((c) => (
              <CommentItemView
                key={c.id}
                comment={c}
                replyingTo={replyingTo}
                replyText={replyText}
                onReplyingToChange={setReplyingTo}
                onReplyTextChange={setReplyText}
                onSendReply={() => handleSendReply(c.id)}
                sendingReply={sendingReply}
                onLike={() => void handleCommentAction(Number(c.id), 'agree')}
                onDislike={() => void handleCommentAction(Number(c.id), 'disagree')}
                onCollect={() => void handleCommentCollect(Number(c.id))}
                onToggleReplies={() => void toggleReplies(Number(c.id))}
                onReplyLike={(replyId) => void handleReplyAction(Number(c.id), replyId, 'agree')}
                onReplyDislike={(replyId) => void handleReplyAction(Number(c.id), replyId, 'disagree')}
                onReplyCollect={(replyId) => void handleReplyCollect(Number(c.id), replyId)}
                loading={actionLoading === Number(c.id)}
              />
            ))}
          </Box>
        )}

        <Snackbar open={snack.open} autoHideDuration={2500} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
          <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
        </Snackbar>
      </Box>
    );
  }

  // 紧凑模式
  return (
    <>
      <Box onClick={handleOpenComments} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}>
        <ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />
        <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{(commentCount ?? displayCount).toLocaleString('zh-CN')}</Typography>
      </Box>

      <Dialog open={commentDialogOpen} onClose={() => setCommentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 15, fontWeight: 600, pr: 2 }}>
          评论 ({comments.length})
          <IconButton size="small" onClick={() => setCommentDialogOpen(false)}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 300, maxHeight: 500 }}>
          {commentsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : comments.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>暂无评论</Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {comments.map((c) => (
                <CommentItemView
                  key={c.id}
                  comment={c}
                  replyingTo={replyingTo}
                  replyText={replyText}
                  onReplyingToChange={setReplyingTo}
                  onReplyTextChange={setReplyText}
                  onSendReply={() => handleSendReply(c.id)}
                  sendingReply={sendingReply}
                  onLike={() => void handleCommentAction(Number(c.id), 'agree')}
                  onDislike={() => void handleCommentAction(Number(c.id), 'disagree')}
                  onCollect={() => void handleCommentCollect(Number(c.id))}
                  onToggleReplies={() => void toggleReplies(Number(c.id))}
                  onReplyLike={(replyId) => void handleReplyAction(Number(c.id), replyId, 'agree')}
                  onReplyDislike={(replyId) => void handleReplyAction(Number(c.id), replyId, 'disagree')}
                  onReplyCollect={(replyId) => void handleReplyCollect(Number(c.id), replyId)}
                  loading={actionLoading === Number(c.id)}
                />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <CommentInput
            value={commentText}
            onChange={setCommentText}
            onSend={handleSendComment}
            sending={sendingComment}
            onEmojiClick={(e) => setEmojiAnchor(e.currentTarget)}
            onGifClick={(e) => setGifAnchor(e.currentTarget)}
            compact
          />
        </DialogActions>
      </Dialog>

      <EmojiPicker anchor={emojiAnchor} onClose={() => setEmojiAnchor(null)} onSelect={handleSelectEmoji} />
      <GifPicker anchor={gifAnchor} onClose={() => setGifAnchor(null)} onSelect={handleSelectGif} />

      <Snackbar open={snack.open} autoHideDuration={2500} onClose={() => setSnack(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </>
  );
}

// 评论输入框组件
function CommentInput({
  value, onChange, onSend, sending, onEmojiClick, onGifClick, compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  onEmojiClick: (e: React.MouseEvent) => void;
  onGifClick: (e: React.MouseEvent) => void;
  compact?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
      <TextField
        fullWidth
        size="small"
        placeholder="说点什么..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) onSend(); }}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <Tooltip title="表情"><IconButton size="small" onClick={onEmojiClick} sx={{ color: 'text.secondary' }}><EmojiEmotionsOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="动图"><IconButton size="small" onClick={onGifClick} sx={{ color: 'text.secondary' }}><Box component="span" sx={{ fontSize: 14 }}>GIF</Box></IconButton></Tooltip>
                  <IconButton size="small" disabled={!value.trim() || sending} onClick={onSend} sx={{ color: 'primary.main' }}>
                    {sending ? <CircularProgress size={16} /> : <SendIcon fontSize="small" />}
                  </IconButton>
                </Box>
              </InputAdornment>
            ),
          },
        }}
        sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'action.hover', fontSize: compact ? 13 : 14, borderRadius: 4 } }}
      />
    </Box>
  );
}

// 表情选择器
function EmojiPicker({ anchor, onClose, onSelect }: { anchor: HTMLElement | null; onClose: () => void; onSelect: (emoji: string) => void }) {
  return (
    <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }}>
      <Box sx={{ p: 1, maxWidth: 280 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', px: 0.5, display: 'block', mb: 0.5 }}>常用表情</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {EMOJI_LIST.map((emoji, idx) => (
            <Button key={idx} onClick={() => onSelect(emoji)} sx={{ minWidth: 'auto', width: 32, height: 32, fontSize: 18, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}>{emoji}</Button>
          ))}
        </Box>
      </Box>
    </Popover>
  );
}

// GIF 选择器
function GifPicker({ anchor, onClose, onSelect }: { anchor: HTMLElement | null; onClose: () => void; onSelect: (gif: string) => void }) {
  return (
    <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }} transformOrigin={{ vertical: 'top', horizontal: 'left' }}>
      <Box sx={{ p: 1.5, maxWidth: 320 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', px: 0.5, display: 'block', mb: 1 }}>热门动图</Typography>
        {GIF_CATEGORIES.map((cat) => (
          <Box key={cat.name} sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>{cat.name}</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {cat.gifs.map((gif, idx) => (
                <Button key={idx} onClick={() => onSelect(gif)} sx={{ minWidth: 'auto', px: 1, py: 0.5, fontSize: 16, borderRadius: 1, bgcolor: 'action.hover', '&:hover': { bgcolor: 'action.selected' } }}>{gif}</Button>
              ))}
            </Box>
          </Box>
        ))}
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 1 }}>完整动图库接入中...</Typography>
      </Box>
    </Popover>
  );
}

// 回复输入框
function ReplyInput({
  replyingTo, replyText, onReplyingToChange, onReplyTextChange, onSend, sending, onCancel,
}: {
  replyingTo: { id: number; name: string } | null;
  replyText: string;
  onReplyingToChange: (v: { id: number; name: string } | null) => void;
  onReplyTextChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  onCancel: () => void;
}) {
  if (!replyingTo) return null;
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1, pl: 4 }}>
      <TextField
        size="small"
        placeholder={`回复 ${replyingTo.name}...`}
        value={replyText}
        onChange={(e) => onReplyTextChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
        sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: 12, borderRadius: 2 } }}
        autoFocus
      />
      <IconButton size="small" onClick={onSend} disabled={!replyText.trim() || sending} sx={{ color: 'primary.main' }}>
        {sending ? <CircularProgress size={16} /> : <SendIcon fontSize="small" />}
      </IconButton>
      <IconButton size="small" onClick={onCancel} sx={{ color: 'text.secondary' }}>
        <CloseRoundedIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

// 评论项视图
function CommentItemView({
  comment, replyingTo, replyText, onReplyingToChange, onReplyTextChange, onSendReply, sendingReply,
  onLike, onDislike, onCollect, onToggleReplies,
  onReplyLike, onReplyDislike, onReplyCollect, loading,
}: {
  comment: CommentItem;
  replyingTo: { id: number; name: string } | null;
  replyText: string;
  onReplyingToChange: (v: { id: number; name: string } | null) => void;
  onReplyTextChange: (v: string) => void;
  onSendReply: () => void;
  sendingReply: boolean;
  onLike: () => void;
  onDislike: () => void;
  onCollect: () => void;
  onToggleReplies: () => void;
  onReplyLike: (replyId: number) => void;
  onReplyDislike: (replyId: number) => void;
  onReplyCollect: (replyId: number) => void;
  loading: boolean;
}) {
  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Avatar sx={{ width: 36, height: 36, fontSize: 14 }} src={comment.avatar}>{(comment.username || '用').charAt(0)}</Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>{comment.username || '用户'}</Typography>
          <Typography sx={{ fontSize: 14, color: 'text.primary', mt: 0.25, wordBreak: 'break-word' }}>{comment.content}</Typography>

          {/* 操作栏 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{comment.createTime}</Typography>
            <Box sx={{ flex: 1 }} />
            {/* 回复按钮 */}
            <Tooltip title="回复">
              <IconButton size="small" onClick={() => onReplyingToChange({ id: comment.id, name: comment.username || '用户' })} sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                <ReplyIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            {/* 点赞 */}
            <Tooltip title="顶"><IconButton size="small" onClick={onLike} disabled={loading} sx={{ p: 0.25, color: comment.liked ? 'primary.main' : 'text.secondary', '&:hover': { color: 'primary.main' } }}>{comment.liked ? <ThumbUpIcon sx={{ fontSize: 16 }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: 16 }} />}</IconButton></Tooltip>
            <Typography sx={{ fontSize: 11, color: comment.liked ? 'primary.main' : 'text.secondary', minWidth: 16 }}>{comment.agreeNum ?? 0}</Typography>
            {/* 点踩 */}
            <Tooltip title="踩"><IconButton size="small" onClick={onDislike} disabled={loading} sx={{ p: 0.25, color: comment.disliked ? 'error.main' : 'text.secondary', '&:hover': { color: 'error.main' } }}>{comment.disliked ? <ThumbDownIcon sx={{ fontSize: 16 }} /> : <ThumbDownOutlinedIcon sx={{ fontSize: 16 }} />}</IconButton></Tooltip>
            {/* 收藏 */}
            <Tooltip title="收藏"><IconButton size="small" onClick={onCollect} disabled={loading} sx={{ p: 0.25, color: comment.collected ? 'warning.main' : 'text.secondary', '&:hover': { color: 'warning.main' } }}>{comment.collected ? <BookmarkIcon sx={{ fontSize: 16 }} /> : <BookmarkBorderIcon sx={{ fontSize: 16 }} />}</IconButton></Tooltip>
          </Box>

          {/* 回复输入框 */}
          <ReplyInput
            replyingTo={replyingTo?.id === comment.id ? replyingTo : null}
            replyText={replyText}
            onReplyingToChange={onReplyingToChange}
            onReplyTextChange={onReplyTextChange}
            onSend={onSendReply}
            sending={sendingReply}
            onCancel={() => onReplyingToChange(null)}
          />
        </Box>
      </Box>

      {/* 回复列表 */}
      {comment.replyCount !== undefined && comment.replyCount > 0 && (
        <Box sx={{ pl: 7, mt: 1 }}>
          <Button
            size="small"
            onClick={onToggleReplies}
            startIcon={comment.repliesExpanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
            sx={{ color: 'text.secondary', fontSize: 12, textTransform: 'none', '&:hover': { color: 'primary.main' } }}
          >
            {comment.repliesExpanded ? '收起回复' : `展开 ${comment.replyCount} 条回复`}
          </Button>
          <Collapse in={comment.repliesExpanded}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
              {comment.replies?.map((reply) => (
                <ReplyItemView
                  key={reply.id}
                  reply={reply}
                  onLike={() => onReplyLike(reply.id)}
                  onDislike={() => onReplyDislike(reply.id)}
                  onCollect={() => onReplyCollect(reply.id)}
                  loading={loading}
                />
              ))}
            </Box>
          </Collapse>
        </Box>
      )}
    </Box>
  );
}

// 回复项视图
function ReplyItemView({
  reply, onLike, onDislike, onCollect, loading,
}: {
  reply: CommentReply;
  onLike: () => void;
  onDislike: () => void;
  onCollect: () => void;
  loading: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <Avatar sx={{ width: 24, height: 24, fontSize: 11 }} src={reply.avatar}>{(reply.username || 'U').charAt(0)}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>{reply.username || '用户'}</Typography>
        <Typography sx={{ fontSize: 12, color: 'text.primary', mt: 0.25, wordBreak: 'break-word' }}>{reply.content}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
          <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{reply.createTime}</Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="顶"><IconButton size="small" onClick={onLike} disabled={loading} sx={{ p: 0.125, color: reply.liked ? 'primary.main' : 'text.secondary', '&:hover': { color: 'primary.main' } }}>{reply.liked ? <ThumbUpIcon sx={{ fontSize: 12 }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: 12 }} />}</IconButton></Tooltip>
          <Typography sx={{ fontSize: 10, color: reply.liked ? 'primary.main' : 'text.secondary', minWidth: 12 }}>{reply.agreeNum ?? 0}</Typography>
          <Tooltip title="踩"><IconButton size="small" onClick={onDislike} disabled={loading} sx={{ p: 0.125, color: reply.disliked ? 'error.main' : 'text.secondary', '&:hover': { color: 'error.main' } }}>{reply.disliked ? <ThumbDownIcon sx={{ fontSize: 12 }} /> : <ThumbDownOutlinedIcon sx={{ fontSize: 12 }} />}</IconButton></Tooltip>
          <Tooltip title="收藏"><IconButton size="small" onClick={onCollect} disabled={loading} sx={{ p: 0.125, color: reply.collected ? 'warning.main' : 'text.secondary', '&:hover': { color: 'warning.main' } }}>{reply.collected ? <BookmarkIcon sx={{ fontSize: 12 }} /> : <BookmarkBorderIcon sx={{ fontSize: 12 }} />}</IconButton></Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

export default DetailComments;
