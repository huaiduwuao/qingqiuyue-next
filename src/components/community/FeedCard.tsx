'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import AvatarGroup from '@mui/material/AvatarGroup';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import InputBase from '@mui/material/InputBase';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import ModeCommentOutlinedIcon from '@mui/icons-material/ModeCommentOutlined';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import { useAuth } from '@/contexts/AuthContext';
import { formatApiError } from '@/lib/api/client';
import { getDetailRoute } from '@/lib/contentRoute';
import { CoverImage } from '@/components/common/CoverImage';
import { UserAvatarLink } from '@/components/common/UserAvatarLink';
import {
  addComment,
  deleteComment,
  deleteFeed,
  fetchComments,
  setFeedLike,
  type CommunityUser,
  type FeedComment,
  type FeedItem,
  type Id,
  type Page,
} from '@/apis/community';
import { RichText } from './RichText';
import { UserName } from './UserLine';
import { CONTENT_TYPE_LABEL, FEED_VERB, compactCount, timeAgo, topicHref } from './format';

export type Notify = (msg: string, severity?: 'success' | 'error' | 'info') => void;

const cardSx = {
  borderRadius: 2,
  bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
  border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
};

export function FeedCard({
  item,
  notify,
  onDeleted,
  defaultOpenComments,
}: {
  item: FeedItem;
  notify: Notify;
  onDeleted?: (id: Id) => void;
  defaultOpenComments?: boolean;
}) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [liked, setLiked] = useState(item.liked);
  const [likeCount, setLikeCount] = useState(item.likeCount);
  const [commentCount, setCommentCount] = useState(item.commentCount);
  const [showComments, setShowComments] = useState(!!defaultOpenComments);
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);

  const needLogin = () => {
    notify('登录后才能参与互动', 'info');
    router.push('/user/login');
  };

  const toggleLike = async () => {
    if (!isAuthenticated) return needLogin();
    if (busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const r = await setFeedLike(item.id, next);
      setLiked(r.liked);
      setLikeCount(r.likeCount);
    } catch (e) {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
      notify(formatApiError(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/home/recommend?tab=feed&feedId=${item.id}`;
    try {
      await navigator.clipboard.writeText(url);
      notify('链接已复制');
    } catch {
      notify(url, 'info');
    }
  };

  const remove = async () => {
    setMenuEl(null);
    if (!window.confirm('确定删除这条动态?')) return;
    try {
      await deleteFeed(item.id);
      onDeleted?.(item.id);
      notify('已删除');
    } catch (e) {
      notify(formatApiError(e), 'error');
    }
  };

  const openTarget = () => {
    if (!item.target) return;
    const route = getDetailRoute(item.target.contentType, item.target.id);
    if (route) router.push(route);
  };

  const aggregated = (item.type === 'like' || item.type === 'collect') && item.actorCount > 1;
  const verb = item.type === 'post' ? '' : `${aggregated ? `等 ${item.actorCount} 人` : ''}${FEED_VERB[item.type] || ''}`;

  return (
    <Box sx={{ ...cardSx, p: 2 }}>
      {/* 头部:发起者 + 动作 + 时间 */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
        {aggregated ? (
          <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 32, height: 32, fontSize: 12 } }}>
            {[item.user, ...item.actors].map((u) => (
              <UserAvatarLink key={String(u.id)} userId={u.id} name={u.name} src={u.avatar} size={32} />
            ))}
          </AvatarGroup>
        ) : (
          <UserAvatarLink userId={item.user.id} name={item.user.name} src={item.user.avatar} size={40} />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <UserName user={item.user} size={14} />
            {verb && <Typography component="span" sx={{ fontSize: 13, color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>{verb}</Typography>}
            {item.targetUser && <UserName user={item.targetUser} />}
          </Box>
          <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))', mt: 0.25 }}>
            {timeAgo(item.createTime)}
          </Typography>
        </Box>
        {item.canDelete && (
          <>
            <IconButton size="small" aria-label="更多" onClick={(e) => setMenuEl(e.currentTarget)}>
              <MoreHorizRoundedIcon sx={{ fontSize: 18, color: 'var(--text-muted, rgba(255,255,255,0.5))' }} />
            </IconButton>
            <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)}>
              <MenuItem onClick={remove} sx={{ color: 'error.main', fontSize: 13 }}>删除</MenuItem>
            </Menu>
          </>
        )}
      </Box>

      {/* 正文 */}
      {item.text && (
        <Box sx={{ mt: 1.25, pl: { xs: 0, sm: 6.25 } }}>
          <RichText text={item.text} topics={item.topics} />
        </Box>
      )}

      {/* 关联作品 */}
      {item.target && (
        <Box
          onClick={openTarget}
          sx={{
            mt: 1.25,
            ml: { xs: 0, sm: 6.25 },
            display: 'flex',
            gap: 1.25,
            p: 1,
            borderRadius: 1.5,
            cursor: 'pointer',
            bgcolor: 'var(--bg-input, rgba(255,255,255,0.04))',
            border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            transition: 'border-color .15s',
            '&:hover': { borderColor: 'var(--border-strong, rgba(255,255,255,0.16))' },
          }}
        >
          <Box sx={{ width: 96, flexShrink: 0, aspectRatio: '16/10', borderRadius: 1, overflow: 'hidden' }}>
            <CoverImage src={item.target.cover} alt={item.target.title} sx={{ width: '100%', height: '100%' }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #fff)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {item.target.title}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))', mt: 0.5 }}>
              {CONTENT_TYPE_LABEL[item.target.contentType] || item.target.contentType} · {compactCount(item.target.views)} 播放 · {compactCount(item.target.likes)} 赞
            </Typography>
          </Box>
        </Box>
      )}

      {/* 话题(正文里没写成 #话题# 的也展示出来) */}
      {item.topics.length > 0 && (
        <Box sx={{ mt: 1, pl: { xs: 0, sm: 6.25 }, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {item.topics.map((t) => (
            <Chip
              key={String(t.id)}
              size="small"
              icon={<TagRoundedIcon sx={{ fontSize: 13 }} />}
              label={t.title}
              component={Link}
              href={topicHref(t.id)}
              clickable
              sx={{ height: 22, fontSize: 11, bgcolor: 'rgba(254,44,85,0.1)', color: 'var(--brand-color, #FE2C55)', '& .MuiChip-icon': { color: 'inherit' } }}
            />
          ))}
        </Box>
      )}

      {/* 互动 */}
      {item.interactive && (
        <Box sx={{ mt: 1.25, pl: { xs: 0, sm: 5.5 }, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ActionButton
            active={liked}
            onClick={toggleLike}
            icon={liked ? <FavoriteRoundedIcon sx={{ fontSize: 17 }} /> : <FavoriteBorderRoundedIcon sx={{ fontSize: 17 }} />}
            label={likeCount > 0 ? compactCount(likeCount) : '赞'}
          />
          <ActionButton
            active={showComments}
            onClick={() => setShowComments((v) => !v)}
            icon={<ModeCommentOutlinedIcon sx={{ fontSize: 16 }} />}
            label={commentCount > 0 ? compactCount(commentCount) : '评论'}
          />
          <ActionButton onClick={share} icon={<ShareOutlinedIcon sx={{ fontSize: 16 }} />} label="分享" />
        </Box>
      )}

      {showComments && item.interactive && (
        <Box sx={{ mt: 1, ml: { xs: 0, sm: 6.25 } }}>
          <FeedComments feedId={item.id} notify={notify} onCountChange={(d) => setCommentCount((c) => Math.max(0, c + d))} />
        </Box>
      )}
    </Box>
  );
}

function ActionButton({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <Button
      size="small"
      onClick={onClick}
      startIcon={icon}
      sx={{
        minWidth: 0,
        px: 1.25,
        fontSize: 12,
        textTransform: 'none',
        color: active ? 'var(--brand-color, #FE2C55)' : 'var(--text-secondary, rgba(255,255,255,0.6))',
        '& .MuiButton-startIcon': { mr: 0.5 },
      }}
    >
      {label}
    </Button>
  );
}

const COMMENT_PAGE = 50;

function FeedComments({ feedId, notify, onCountChange }: { feedId: Id; notify: Notify; onCountChange: (delta: number) => void }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const key = ['community', 'comments', String(feedId)];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => fetchComments(feedId, 1, COMMENT_PAGE) });
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommunityUser | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!isAuthenticated) {
      notify('登录后才能评论', 'info');
      router.push('/user/login');
      return;
    }
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      const c = await addComment(feedId, t, replyTo?.id);
      qc.setQueryData<Page<FeedComment>>(key, (old) => (old ? { ...old, list: [...old.list, c], total: old.total + 1 } : old));
      setText('');
      setReplyTo(null);
      onCountChange(1);
    } catch (e) {
      notify(formatApiError(e), 'error');
    } finally {
      setSending(false);
    }
  };

  const remove = async (c: FeedComment) => {
    if (!window.confirm('删除这条评论?')) return;
    try {
      await deleteComment(c.id);
      qc.setQueryData<Page<FeedComment>>(key, (old) => (old ? { ...old, list: old.list.filter((x) => x.id !== c.id), total: old.total - 1 } : old));
      onCountChange(-1);
    } catch (e) {
      notify(formatApiError(e), 'error');
    }
  };

  const list = data?.list ?? [];
  return (
    <Box sx={{ borderRadius: 1.5, bgcolor: 'var(--bg-input, rgba(255,255,255,0.03))', p: 1.25 }}>
      {isLoading ? (
        <Skeleton variant="text" width="60%" />
      ) : list.length === 0 ? (
        <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.45))', py: 0.5 }}>还没有评论,说两句吧</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {list.map((c) => (
            <Box key={String(c.id)} sx={{ display: 'flex', gap: 1 }}>
              <UserAvatarLink userId={c.user.id} name={c.user.name} src={c.user.avatar} size={26} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  <UserName user={c.user} size={12} />
                  {c.replyTo && (
                    <>
                      <Typography component="span" sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>回复</Typography>
                      <UserName user={c.replyTo} size={12} />
                    </>
                  )}
                </Box>
                <Typography sx={{ fontSize: 13, color: 'var(--text-primary, #fff)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 0.25 }}>{c.text}</Typography>
                <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25 }}>
                  <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>{timeAgo(c.createTime)}</Typography>
                  <Typography component="button" onClick={() => setReplyTo(c.user)} sx={linkBtnSx}>回复</Typography>
                  {c.canDelete && <Typography component="button" onClick={() => remove(c)} sx={linkBtnSx}>删除</Typography>}
                </Box>
              </Box>
            </Box>
          ))}
          {(data?.total ?? 0) > list.length && (
            <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.45))' }}>仅显示前 {COMMENT_PAGE} 条,共 {data?.total} 条</Typography>
          )}
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25 }}>
        <InputBase
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 300))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={replyTo ? `回复 @${replyTo.name}` : '说点什么…'}
          sx={{ flex: 1, fontSize: 13, px: 1.25, py: 0.5, borderRadius: 999, bgcolor: 'var(--bg-card, rgba(255,255,255,0.05))', color: 'var(--text-primary, #fff)' }}
        />
        {replyTo && (
          <Typography component="button" onClick={() => setReplyTo(null)} sx={linkBtnSx}>取消回复</Typography>
        )}
        <Button size="small" variant="contained" disabled={!text.trim() || sending} onClick={send} sx={{ borderRadius: 999, textTransform: 'none', fontSize: 12, bgcolor: 'var(--brand-color, #FE2C55)' }}>
          发送
        </Button>
      </Box>
    </Box>
  );
}

const linkBtnSx = {
  p: 0,
  border: 0,
  background: 'none',
  cursor: 'pointer',
  fontSize: 11,
  color: 'var(--text-muted, rgba(255,255,255,0.5))',
  '&:hover': { color: 'var(--text-primary, #fff)' },
};

export function FeedCardSkeleton() {
  return (
    <Box sx={{ ...cardSx, p: 2 }}>
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
        <Skeleton variant="circular" width={40} height={40} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="35%" />
          <Skeleton variant="text" width="20%" />
        </Box>
      </Box>
      <Skeleton variant="text" sx={{ mt: 1 }} />
      <Skeleton variant="text" width="80%" />
    </Box>
  );
}
