'use client';

import React, { useState, useCallback, useEffect } from 'react';
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { getComments, sendComment, commentAction } from '@/apis/home';
import { contentClient, formatApiError } from '@/lib/api/client';

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

const PAGE_SIZE = 20;
const REPLY_PAGE_SIZE = 50;

/**
 * 一条评论或回复。id 类字段一律是字符串:评论 id 是 1.78e18 量级的雪花 id,
 * 超过 JS 安全整数,转成 Number 再回传会指到另一条(不存在的)评论上。
 */
export interface CommentReply {
  id: string;
  content: string;
  createTime?: string;
  username?: string;
  avatar?: string;
  agreeNum?: number;
  userId?: string;
  replyId?: string;
  liked?: boolean;
  disliked?: boolean;
  collected?: boolean;
}

export interface CommentItem extends CommentReply {
  replyCount?: number;
}

interface Thread {
  open: boolean;
  loading: boolean;
  loaded: boolean;
  replies: CommentReply[];
}

/** 正在回复的目标。评论只有两级:回复楼中楼时仍挂在一级评论下,内容前带 @对方。 */
interface ReplyTarget {
  rootId: string;
  name: string;
  mention: boolean;
}

type CommentActionType = 'agree' | 'disagree' | 'collect';
type Severity = 'success' | 'error' | 'info';

interface DetailCommentsProps {
  contentId: string | number;
  initialCount?: number;
  compact?: boolean;
  commentCount?: number;
}

function unwrapPage<T>(res: unknown): { list: T[]; total: number; hasMore: boolean } {
  const payload = (res as { data?: { list?: T[]; total?: number; hasMore?: boolean } | T[] })?.data;
  if (Array.isArray(payload)) return { list: payload, total: payload.length, hasMore: false };
  const list = payload?.list ?? [];
  return { list, total: Number(payload?.total ?? list.length), hasMore: Boolean(payload?.hasMore) };
}

async function fetchReplies(commentId: string): Promise<CommentReply[]> {
  const res = await contentClient(`/module/content/comment/${commentId}/replies`, {
    params: { page: 1, page_size: REPLY_PAGE_SIZE },
  });
  return unwrapPage<CommentReply>(res).list;
}

function formatTime(t?: string): string {
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`;
  return d.toLocaleDateString('zh-CN');
}

/** 顶/踩互斥:顶会撤掉踩,踩会撤掉顶(与后端 toggleCommentAction 一致)。 */
function toggled<T extends CommentReply>(c: T, action: CommentActionType): T {
  if (action === 'collect') return { ...c, collected: !c.collected };
  const count = c.agreeNum ?? 0;
  if (action === 'agree') {
    const liked = !c.liked;
    return { ...c, liked, disliked: liked ? false : c.disliked, agreeNum: Math.max(0, count + (liked ? 1 : -1)) };
  }
  const disliked = !c.disliked;
  const dropLike = disliked && !!c.liked;
  return { ...c, disliked, liked: dropLike ? false : c.liked, agreeNum: dropLike ? Math.max(0, count - 1) : count };
}

const emptyThread: Thread = { open: false, loading: false, loaded: false, replies: [] };

export function DetailComments({ contentId, initialCount = 0, compact = false, commentCount }: DetailCommentsProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [total, setTotal] = useState(initialCount);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [picker, setPicker] = useState<{ kind: 'emoji' | 'gif'; anchor: HTMLElement; target: 'comment' | 'reply' } | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: Severity }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const notify = useCallback((message: string, severity: Severity = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  // 详情数据晚于组件挂载到达;评论列表加载后以列表接口的总数为准。
  useEffect(() => {
    if (!loaded) setTotal(initialCount);
  }, [initialCount, loaded]);

  const loadPage = useCallback(
    async (p: number) => unwrapPage<CommentItem>(await getComments(contentId, { page: p, page_size: PAGE_SIZE })),
    [contentId],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loadPage(1);
      setComments(res.list);
      setTotal(res.total);
      setHasMore(res.hasMore);
      setPage(1);
      setLoaded(true);
    } catch (err) {
      notify(formatApiError(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [loadPage, notify]);

  // 页面底部模式直接加载;紧凑模式在打开弹窗时加载。
  useEffect(() => {
    if (!compact) void reload();
  }, [compact, reload]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await loadPage(page + 1);
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...res.list.filter((c) => !seen.has(c.id))];
      });
      setHasMore(res.hasMore);
      setPage((p) => p + 1);
    } catch (err) {
      notify(formatApiError(err), 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpenDialog = () => {
    setDialogOpen(true);
    void reload();
  };

  const handleSendComment = async () => {
    const text = commentText.trim();
    if (!text || sendingComment) return;
    setSendingComment(true);
    try {
      await sendComment({ contentId, content: text });
      setCommentText('');
      notify('评论已发送');
      await reload();
    } catch (err) {
      notify(formatApiError(err), 'error');
    } finally {
      setSendingComment(false);
    }
  };

  const loadThread = useCallback(
    async (rootId: string) => {
      setThreads((t) => ({ ...t, [rootId]: { ...(t[rootId] ?? emptyThread), open: true, loading: true } }));
      try {
        const replies = await fetchReplies(rootId);
        setThreads((t) => ({ ...t, [rootId]: { open: true, loading: false, loaded: true, replies } }));
        setComments((prev) =>
          prev.map((c) => (c.id === rootId && replies.length > (c.replyCount ?? 0) ? { ...c, replyCount: replies.length } : c)),
        );
      } catch (err) {
        setThreads((t) => ({ ...t, [rootId]: { ...(t[rootId] ?? emptyThread), loading: false } }));
        notify(formatApiError(err), 'error');
      }
    },
    [notify],
  );

  const toggleThread = (rootId: string) => {
    const th = threads[rootId];
    if (th?.open) {
      setThreads((t) => ({ ...t, [rootId]: { ...th, open: false } }));
    } else if (th?.loaded) {
      setThreads((t) => ({ ...t, [rootId]: { ...th, open: true } }));
    } else {
      void loadThread(rootId);
    }
  };

  const startReply = (root: CommentItem, target?: CommentReply) => {
    setReplyTarget({ rootId: root.id, name: (target ?? root).username || '用户', mention: !!target });
    setReplyText('');
  };

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!replyTarget || !text || sendingReply) return;
    const { rootId, name, mention } = replyTarget;
    setSendingReply(true);
    try {
      await sendComment({ contentId, content: mention ? `回复 @${name}：${text}` : text, replyId: rootId });
      setReplyText('');
      setReplyTarget(null);
      setComments((prev) => prev.map((c) => (c.id === rootId ? { ...c, replyCount: (c.replyCount ?? 0) + 1 } : c)));
      notify('回复已发送');
      await loadThread(rootId);
    } catch (err) {
      notify(formatApiError(err), 'error');
    } finally {
      setSendingReply(false);
    }
  };

  /** 顶/踩/收藏,乐观更新;失败时把这一条恢复成操作前的样子。rootId 有值表示操作的是回复。 */
  const handleAction = async (id: string, action: CommentActionType, rootId?: string) => {
    if (busy[id]) return;
    setBusy((b) => ({ ...b, [id]: true }));
    let before: CommentReply | undefined;
    const patch = (fn: (c: CommentReply) => CommentReply) => {
      if (rootId) {
        setThreads((t) => {
          const th = t[rootId];
          if (!th) return t;
          return { ...t, [rootId]: { ...th, replies: th.replies.map((r) => (r.id === id ? fn(r) : r)) } };
        });
      } else {
        setComments((prev) => prev.map((c) => (c.id === id ? { ...c, ...fn(c) } : c)));
      }
    };
    patch((c) => {
      before = c;
      return toggled(c, action);
    });
    try {
      await commentAction({ commentId: id, action });
    } catch (err) {
      if (before) {
        const snapshot = before;
        patch(() => snapshot);
      }
      notify(formatApiError(err), 'error');
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const insertPicked = (text: string, target: 'comment' | 'reply') => {
    if (target === 'reply') setReplyText((prev) => prev + text);
    else setCommentText((prev) => prev + text);
    setPicker(null);
  };

  const list = (
    <CommentList
      comments={comments}
      loading={loading && !loaded}
      threads={threads}
      busy={busy}
      replyTarget={replyTarget}
      replyText={replyText}
      sendingReply={sendingReply}
      onReplyTextChange={setReplyText}
      onStartReply={startReply}
      onCancelReply={() => setReplyTarget(null)}
      onSendReply={() => void handleSendReply()}
      onToggleThread={toggleThread}
      onAction={(id, action, rootId) => void handleAction(id, action, rootId)}
      onReplyEmoji={(e) => setPicker({ kind: 'emoji', anchor: e.currentTarget, target: 'reply' })}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={() => void loadMore()}
      emptyText={compact ? '暂无评论' : '暂无评论，快来抢沙发'}
    />
  );

  const pickers = (
    <>
      <EmojiPicker
        anchor={picker?.kind === 'emoji' ? picker.anchor : null}
        onClose={() => setPicker(null)}
        onSelect={(emoji) => insertPicked(emoji, picker?.target ?? 'comment')}
      />
      <GifPicker
        anchor={picker?.kind === 'gif' ? picker.anchor : null}
        onClose={() => setPicker(null)}
        onSelect={(gif) => insertPicked(` ${gif}`, picker?.target ?? 'comment')}
      />
      <Snackbar open={snack.open} autoHideDuration={2500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snack.severity} variant="filled">{snack.message}</Alert>
      </Snackbar>
    </>
  );

  const input = (compactInput: boolean) => (
    <CommentInput
      value={commentText}
      onChange={setCommentText}
      onSend={() => void handleSendComment()}
      sending={sendingComment}
      onEmojiClick={(e) => setPicker({ kind: 'emoji', anchor: e.currentTarget, target: 'comment' })}
      onGifClick={(e) => setPicker({ kind: 'gif', anchor: e.currentTarget, target: 'comment' })}
      compact={compactInput}
    />
  );

  // 页面底部展开模式
  if (!compact) {
    return (
      <Box>
        <Divider sx={{ borderColor: 'divider', my: 3 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <ChatBubbleOutlineIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700 }}>
            评论 ({total})
          </Typography>
        </Box>
        {input(false)}
        {list}
        {pickers}
      </Box>
    );
  }

  // 紧凑模式
  return (
    <>
      <Box onClick={handleOpenDialog} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}>
        <ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />
        <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{(commentCount ?? total).toLocaleString('zh-CN')}</Typography>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 15, fontWeight: 600, pr: 2 }}>
          评论 ({total})
          <IconButton size="small" onClick={() => setDialogOpen(false)}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 300, maxHeight: 500 }}>
          {list}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5, '& > div': { mb: 0, width: '100%' } }}>
          {input(true)}
        </DialogActions>
      </Dialog>
      {pickers}
    </>
  );
}

// 评论列表(一级评论 + 各自的回复楼)
function CommentList({
  comments, loading, threads, busy, replyTarget, replyText, sendingReply,
  onReplyTextChange, onStartReply, onCancelReply, onSendReply, onToggleThread, onAction, onReplyEmoji,
  hasMore, loadingMore, onLoadMore, emptyText,
}: {
  comments: CommentItem[];
  loading: boolean;
  threads: Record<string, Thread>;
  busy: Record<string, boolean>;
  replyTarget: ReplyTarget | null;
  replyText: string;
  sendingReply: boolean;
  onReplyTextChange: (v: string) => void;
  onStartReply: (root: CommentItem, target?: CommentReply) => void;
  onCancelReply: () => void;
  onSendReply: () => void;
  onToggleThread: (rootId: string) => void;
  onAction: (id: string, action: CommentActionType, rootId?: string) => void;
  onReplyEmoji: (e: React.MouseEvent<HTMLElement>) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  emptyText: string;
}) {
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  if (comments.length === 0) {
    return <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>{emptyText}</Box>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {comments.map((c) => {
        const thread = threads[c.id];
        const count = Math.max(c.replyCount ?? 0, thread?.replies.length ?? 0);
        return (
          <Box key={c.id}>
            <CommentRow
              item={c}
              busy={!!busy[c.id]}
              onReply={() => onStartReply(c)}
              onAction={(action) => onAction(c.id, action)}
            />
            {count > 0 && (
              <Box sx={{ ml: 6, mt: 1, pl: 1.5, borderLeft: '2px solid', borderColor: 'divider' }}>
                <Collapse in={!!thread?.open} unmountOnExit>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 0.5 }}>
                    {thread?.replies.map((r) => (
                      <CommentRow
                        key={r.id}
                        item={r}
                        small
                        busy={!!busy[r.id]}
                        onReply={() => onStartReply(c, r)}
                        onAction={(action) => onAction(r.id, action, c.id)}
                      />
                    ))}
                  </Box>
                </Collapse>
                <Button
                  size="small"
                  onClick={() => onToggleThread(c.id)}
                  disabled={thread?.loading}
                  startIcon={
                    thread?.loading ? <CircularProgress size={12} /> : thread?.open ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />
                  }
                  sx={{ color: 'text.secondary', fontSize: 12, textTransform: 'none', px: 0.5, '&:hover': { color: 'primary.main' } }}
                >
                  {thread?.open ? '收起回复' : `展开 ${count} 条回复`}
                </Button>
              </Box>
            )}
            {replyTarget?.rootId === c.id && (
              <ReplyInput
                name={replyTarget.name}
                value={replyText}
                onChange={onReplyTextChange}
                onSend={onSendReply}
                sending={sendingReply}
                onCancel={onCancelReply}
                onEmojiClick={onReplyEmoji}
              />
            )}
          </Box>
        );
      })}
      {hasMore && (
        <Button onClick={onLoadMore} disabled={loadingMore} sx={{ alignSelf: 'center', color: 'text.secondary', fontSize: 13 }}>
          {loadingMore ? <CircularProgress size={16} /> : '加载更多评论'}
        </Button>
      )}
    </Box>
  );
}

const MENTION_RE = /^回复 @(.+?)：/;

// 一条评论/回复:头像、昵称、正文、时间与操作。small 用于回复楼。
function CommentRow({
  item, small = false, busy, onReply, onAction,
}: {
  item: CommentReply;
  small?: boolean;
  busy: boolean;
  onReply: () => void;
  onAction: (action: CommentActionType) => void;
}) {
  const icon = small ? 14 : 16;
  const mention = item.content.match(MENTION_RE);
  const body = mention ? item.content.slice(mention[0].length) : item.content;
  return (
    <Box sx={{ display: 'flex', gap: small ? 1 : 1.5, alignItems: 'flex-start' }}>
      <Avatar sx={{ width: small ? 26 : 36, height: small ? 26 : 36, fontSize: small ? 12 : 14 }} src={item.avatar || undefined}>
        {(item.username || '用').charAt(0)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: small ? 12 : 13, fontWeight: 600, color: 'text.secondary' }}>{item.username || '用户'}</Typography>
        <Typography sx={{ fontSize: small ? 13 : 14, color: 'text.primary', mt: 0.25, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          {mention && (
            <>
              回复{' '}
              <Box component="span" sx={{ color: 'primary.main' }}>@{mention[1]}</Box>
              ：
            </>
          )}
          {body}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{formatTime(item.createTime)}</Typography>
          <Button
            size="small"
            onClick={onReply}
            sx={{ minWidth: 0, p: 0, px: 0.5, fontSize: 11, color: 'text.secondary', textTransform: 'none', '&:hover': { color: 'primary.main', bgcolor: 'transparent' } }}
          >
            回复
          </Button>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="顶">
            <span>
              <IconButton size="small" onClick={() => onAction('agree')} disabled={busy} sx={{ p: 0.25, color: item.liked ? 'primary.main' : 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                {item.liked ? <ThumbUpIcon sx={{ fontSize: icon }} /> : <ThumbUpOutlinedIcon sx={{ fontSize: icon }} />}
              </IconButton>
            </span>
          </Tooltip>
          <Typography sx={{ fontSize: 11, color: item.liked ? 'primary.main' : 'text.secondary', minWidth: 14 }}>{item.agreeNum ?? 0}</Typography>
          <Tooltip title="踩">
            <span>
              <IconButton size="small" onClick={() => onAction('disagree')} disabled={busy} sx={{ p: 0.25, color: item.disliked ? 'error.main' : 'text.secondary', '&:hover': { color: 'error.main' } }}>
                {item.disliked ? <ThumbDownIcon sx={{ fontSize: icon }} /> : <ThumbDownOutlinedIcon sx={{ fontSize: icon }} />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="收藏">
            <span>
              <IconButton size="small" onClick={() => onAction('collect')} disabled={busy} sx={{ p: 0.25, color: item.collected ? 'warning.main' : 'text.secondary', '&:hover': { color: 'warning.main' } }}>
                {item.collected ? <BookmarkIcon sx={{ fontSize: icon }} /> : <BookmarkBorderIcon sx={{ fontSize: icon }} />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

// 回车发送;中文输入法选词时的回车(isComposing)不算。
function isSubmitEnter(e: React.KeyboardEvent) {
  return e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing;
}

// 评论输入框组件
function CommentInput({
  value, onChange, onSend, sending, onEmojiClick, onGifClick, compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  onEmojiClick: (e: React.MouseEvent<HTMLElement>) => void;
  onGifClick: (e: React.MouseEvent<HTMLElement>) => void;
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
        onKeyDown={(e) => {
          if (isSubmitEnter(e)) {
            e.preventDefault();
            onSend();
          }
        }}
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

// 回复输入框(挂在一级评论下方)
function ReplyInput({
  name, value, onChange, onSend, sending, onCancel, onEmojiClick,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  onCancel: () => void;
  onEmojiClick: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 1, ml: 6 }}>
      <TextField
        size="small"
        placeholder={`回复 @${name}...`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (isSubmitEnter(e)) {
            e.preventDefault();
            onSend();
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
        sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: 13, borderRadius: 2 } }}
        autoFocus
      />
      <IconButton size="small" onClick={onEmojiClick} sx={{ color: 'text.secondary' }}>
        <EmojiEmotionsOutlinedIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" onClick={onSend} disabled={!value.trim() || sending} sx={{ color: 'primary.main' }}>
        {sending ? <CircularProgress size={16} /> : <SendIcon fontSize="small" />}
      </IconButton>
      <IconButton size="small" onClick={onCancel} sx={{ color: 'text.secondary' }}>
        <CloseRoundedIcon fontSize="small" />
      </IconButton>
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
      </Box>
    </Popover>
  );
}

export default DetailComments;
