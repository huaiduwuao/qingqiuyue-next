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
import SendIcon from '@mui/icons-material/Send';
import ChatBubbleOutlineIcon from '@mui/icons-material/ModeCommentOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { getComments, sendComment } from '@/apis/home';
import { formatApiError } from '@/lib/api/client';

export interface CommentItem {
  id: number;
  content: string;
  createTime?: string;
  username?: string;
  avatar?: string;
  agreeNum?: number;
  userId?: string | number;
}

interface DetailCommentsProps {
  contentId: string | number;
  initialCount?: number;
  /** 默认 false = 展开在页面底部；true = 只显示触发按钮 */
  compact?: boolean;
  /** 替换默认的 commentCount 显示 */
  commentCount?: number;
}

export function DetailComments({ contentId, initialCount = 0, compact = false, commentCount }: DetailCommentsProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [displayCount, setDisplayCount] = useState(initialCount);

  const notify = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const res = await getComments(Number(contentId));
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

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      await sendComment({ contentId: Number(contentId), content: commentText.trim() });
      setCommentText('');
      setDisplayCount((c) => c + 1);
      notify('评论已发送');
      await fetchComments();
    } catch (err) {
      notify(formatApiError(err), 'error');
    } finally {
      setSendingComment(false);
    }
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

        <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="说点什么..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && commentText.trim()) {
                void handleSendComment();
              }
            }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      disabled={!commentText.trim() || sendingComment}
                      onClick={() => void handleSendComment()}
                      sx={{ color: 'primary.main' }}
                    >
                      {sendingComment ? <CircularProgress size={16} /> : <SendIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'action.hover',
                fontSize: 14,
                borderRadius: 4,
              },
            }}
          />
        </Box>

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
              <CommentItemView key={c.id} comment={c} />
            ))}
          </Box>
        )}

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
      </Box>
    );
  }

  // 紧凑模式：只显示触发按钮
  return (
    <>
      <Box
        onClick={handleOpenComments}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          '&:hover': { opacity: 0.8 },
        }}
      >
        <ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />
        <Typography sx={{ fontSize: 12, fontWeight: 500 }}>
          {(commentCount ?? displayCount).toLocaleString('zh-CN')}
        </Typography>
      </Box>

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
        <DialogContent dividers sx={{ minHeight: 300, maxHeight: 500 }}>
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
                <CommentItemView key={c.id} comment={c} />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="说点什么..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && commentText.trim()) {
                void handleSendComment();
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
                      onClick={() => void handleSendComment()}
                      sx={{ borderRadius: 4, textTransform: 'none', minWidth: 0, px: 1.5 }}
                    >
                      {sendingComment ? <CircularProgress size={14} color="inherit" /> : '发送'}
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
    </>
  );
}

function CommentItemView({ comment }: { comment: CommentItem }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Avatar sx={{ width: 36, height: 36, fontSize: 14 }} src={comment.avatar}>
        {(comment.username || '用').charAt(0)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary' }}>
          {comment.username || '用户'}
        </Typography>
        <Typography sx={{ fontSize: 14, color: 'text.primary', mt: 0.25, wordBreak: 'break-word' }}>
          {comment.content}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.25 }}>
          {comment.createTime}
        </Typography>
      </Box>
    </Box>
  );
}

export default DetailComments;
