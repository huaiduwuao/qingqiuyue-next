'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import ModeCommentOutlinedIcon from '@mui/icons-material/ModeCommentOutlined';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { homeClient } from '@/lib/api/client';
import { AsyncState } from '@/components/common/AsyncState';
import { WerewolfPlayer } from './WerewolfPlayer';
import SendToSpider from '@/components/SendToSpider';
import { FriendPanel } from './FriendPanel';
import { useContentNavigate } from '@/lib/contentRoute';

type FeedItem = {
  id: number;
  authorId: number;
  authorName: string;
  authorAvatar: string;
  title: string;
  cover: string;
  durationSec: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  isLive?: boolean;
  liveViewers?: number;
  postedAgoMin: number;
  isFollowing?: boolean;
  isFriend?: boolean;
  category: 'video' | 'live' | 'image' | 'short';
  section: 'recommend' | 'live' | 'music' | 'anime' | 'news' | 'entertainment' | 'tech' | 'food' | 'game' | 'knowledge' | 'sports' | 'finance' | 'novel' | 'comics' | 'film' | 'teleplay';
};

type FeedResp = { list: FeedItem[]; total: number; page: number; size: number };

type SuggestUser = {
  id: number;
  name: string;
  avatar: string;
  douyinId: string;
  bio?: string;
  followers: number;
  verified?: boolean;
  region?: string;
};

const SECTIONS: { key: FeedItem['section']; label: string }[] = [
  { key: 'recommend', label: '推荐' },
  { key: 'novel', label: '小说' },
  { key: 'comics', label: '漫画' },
  { key: 'film', label: '影视' },
  { key: 'teleplay', label: '小剧场' },
  { key: 'entertainment', label: '综艺' },
  { key: 'music', label: '音乐' },
  { key: 'anime', label: '二次元' },
  { key: 'news', label: '资讯' },
  { key: 'tech', label: '科技' },
  { key: 'food', label: '美食' },
  { key: 'game', label: '游戏' },
  { key: 'knowledge', label: '知识' },
  { key: 'sports', label: '体育' },
  { key: 'finance', label: '财经' },
];

export function FeedPanel({ tab }: { tab: 'home' | 'follow' | 'friend' | 'recommend' }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSection = (searchParams.get('section') as FeedItem['section']) || 'recommend';
  const [section, setSectionState] = useState<FeedItem['section']>(urlSection);
  const setSection = (next: FeedItem['section']) => {
    setSectionState(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };
  useEffect(() => { setSectionState(urlSection); }, [urlSection]);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success',
  });
  const [manageOpen, setManageOpen] = useState(false);
  const [followSub, setFollowSub] = useState<'feed' | 'list'>('feed');
  const isFollow = tab === 'follow';

  const isPersonal = tab === 'follow' || tab === 'friend';
  const isFriend = tab === 'friend';

  const query = useQuery({
    queryKey: ['home', 'feed', tab, isPersonal ? 'all' : section],
    queryFn: () => {
      const params = new URLSearchParams({ tab });
      if (!isPersonal) {
        params.set('section', section);
      }
      return homeClient.get<FeedResp>(`/feed?${params.toString()}`).then((r) => r.data);
    },
    enabled: tab !== 'recommend',
  });

  // 所有 Hook 调用完毕后再做条件分支(遵守 Rules of Hooks:Hook 顺序在每次渲染必须一致)
  if (tab === 'recommend') {
    return <WerewolfPlayer />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {isFriend && (
        <FriendHeader onOpenManage={() => setManageOpen(true)} />
      )}
      {isFollow && (
        <FollowSubHeader value={followSub} onChange={setFollowSub} />
      )}
      {!isPersonal && (
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            bgcolor: 'var(--bg-topbar, rgba(10, 10, 15, 0.85))',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
            flexShrink: 0,
          }}
        >
          <Tabs
            value={section}
            onChange={(_, v) => setSection(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: 44,
              px: 1,
              '& .MuiTab-root': {
                minHeight: 44,
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-secondary, rgba(255,255,255,0.6))',
                textTransform: 'none',
                px: 1.75,
                py: 0,
                transition: 'color 0.15s',
                '&:hover': { color: 'var(--text-primary, #ffffff)' },
              },
              '& .Mui-selected': { color: 'var(--brand-color, #FE2C55) !important', fontWeight: 700 },
              '& .MuiTabs-indicator': { backgroundColor: 'var(--brand-color, #FE2C55)', height: 2.5, borderRadius: 1.25 },
              '& .MuiTabs-scrollButtons': { color: 'var(--text-secondary, rgba(255,255,255,0.55))' },
            }}
          >
            {SECTIONS.map((s) => (
              <Tab key={s.key} value={s.key} label={s.label} />
            ))}
          </Tabs>
        </Box>
      )}

      <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {isFollow && followSub === 'list' ? (
          <FollowList onSnack={(m, severity) => setSnack({ open: true, message: m, severity: severity || 'success' })} />
        ) : (
        <AsyncState query={query} skeletonCount={4} skeletonHeight={420} isEmpty={() => false}>
          {(data) => (
            <Box sx={{ p: 2 }}>
              {/* 仅 home 顶部抓取工具条 (follow 是个人页,不放;recommend 已被 WerewolfPlayer 接管) */}
              {tab === 'home' && !isPersonal && section === 'recommend' && (
                <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, border: '1px dashed rgba(255,255,255,0.12)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 12, color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>
                      没找到想看的?抓一个 URL 进来:
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <SendToSpider
                      label="抓取 URL"
                      defaultUrl="粘贴任意文章/视频 URL,自动入抓取队列"
                      variant="inline"
                      onSuccess={(m) => setSnack({ open: true, message: m, severity: 'success' })}
                      onError={(m) => setSnack({ open: true, message: m, severity: 'error' })}
                    />
                  </Box>
                </Box>
              )}

              {isPersonal ? (
                // 关注/朋友:中间是 feed(倒序),右侧是推荐用户(sticky,lg+ 才显示)
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {data.list.length > 0 ? (
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 2 }}>
                        {data.list.map((item) => (
                          <FeedCard key={item.id} item={item} tab={tab} />
                        ))}
                      </Box>
                    ) : (
                      <EmptyHint tab={tab} section={section} />
                    )}
                  </Box>
                  <Box
                    sx={{
                      width: 320,
                      flexShrink: 0,
                      position: { xs: 'static', lg: 'sticky' },
                      top: 0,
                      display: { xs: 'none', lg: 'block' },
                    }}
                  >
                    <RecommendSection tab={tab} />
                  </Box>
                </Box>
              ) : data.list.length > 0 ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 2 }}>
                  {data.list.map((item) => (
                    <FeedCard key={item.id} item={item} tab={tab} />
                  ))}
                </Box>
              ) : (
                <EmptyHint tab={tab} section={section} />
              )}
            </Box>
          )}
        </AsyncState>
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
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        fullWidth
        maxWidth="md"
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'var(--bg-body, #0a0a0f)',
              backgroundImage: 'none',
              borderRadius: 3,
              height: 'min(820px, 90dvh)',
              overflow: 'hidden',
            },
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))', flexShrink: 0 }}>
          <GroupsRoundedIcon sx={{ fontSize: 18, color: '#5B8DEF', mr: 1 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #ffffff)', flex: 1 }}>
            好友管理
          </Typography>
          <IconButton size="small" onClick={() => setManageOpen(false)} aria-label="关闭">
            <CloseRoundedIcon sx={{ fontSize: 18, color: 'var(--text-muted, rgba(255,255,255,0.5))' }} />
          </IconButton>
        </Box>
        <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
          <FriendPanel />
        </DialogContent>
      </Dialog>
    </Box>
  );
}

// ─── 卡片 ───
function FeedCard({ item, tab }: { item: FeedItem; tab: 'home' | 'follow' | 'friend' }) {
  const qc = useQueryClient();
  const navigate = useContentNavigate();
  const [busy, setBusy] = useState(false);

  const sectionToType: Record<string, string> = {
    novel: 'NOVEL', comics: 'COMICS', film: 'FILM', teleplay: 'TELEPLAY',
    music: 'MUSIC', anime: 'ANIMATION', news: 'NEWS', entertainment: 'VSHOW',
    knowledge: 'ARTICLE', tech: 'ARTICLE', food: 'VIDEO', game: 'VIDEO',
    sports: 'VIDEO', finance: 'ARTICLE',
  };
  const targetType = item.category === 'live'
    ? 'LIVE'
    : item.category === 'video' || item.category === 'short' || item.category === 'image'
    ? (sectionToType[item.section] || 'VIDEO')
    : null;

  const toggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (item.isFollowing) {
        await homeClient.delete(`/follow/${item.authorId}`);
      } else {
        await homeClient.post(`/follow/${item.authorId}`);
      }
      // 刷新 feed + suggestions
      qc.invalidateQueries({ queryKey: ['home', 'feed'] });
      qc.invalidateQueries({ queryKey: ['home', 'suggestions'] });
    } catch (err) {
      console.error('follow toggle failed', err);
    } finally {
      setBusy(false);
    }
  };

  const addAsFriend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await homeClient.post(`/friend/${item.authorId}`);
      qc.invalidateQueries({ queryKey: ['home', 'feed'] });
      qc.invalidateQueries({ queryKey: ['home', 'friend'] });
    } catch (err) {
      console.error('add friend failed', err);
    } finally {
      setBusy(false);
    }
  };

  // 关注/朋友 tab 显示状态徽章 + 按钮;home tab 也显示徽章但不显示按钮(简单)
  const showActions = tab === 'follow' || tab === 'friend';

  return (
    <Box
      onClick={() => {
        if (targetType) navigate(targetType, item.id);
      }}
      sx={{
        borderRadius: 2,
        bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        overflow: 'hidden',
        cursor: targetType ? 'pointer' : 'default',
        transition: 'transform 0.2s, border-color 0.2s',
        '&:hover': targetType ? { transform: 'translateY(-2px)', borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' } : {},
      }}
    >
      <Box sx={{ position: 'relative', aspectRatio: '16/9', bgcolor: 'var(--bg-input, rgba(255,255,255,0.04))', overflow: 'hidden' }}>
        <img src={item.cover || undefined} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        {item.isLive ? (
          <Chip
            icon={<LiveTvRoundedIcon sx={{ fontSize: 12, color: '#ffffff !important' }} />}
            label={`直播中 ${item.liveViewers}`}
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              left: 8,
              height: 20,
              bgcolor: 'var(--brand-color, #FE2C55)',
              color: 'var(--text-primary, #ffffff)',
              fontSize: 10,
              fontWeight: 600,
              '& .MuiChip-icon': { color: 'var(--text-primary, #ffffff)' },
            }}
          />
        ) : (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              px: 0.75,
              py: 0.125,
              borderRadius: 0.5,
              bgcolor: 'rgba(0,0,0,0.6)',
              color: 'var(--text-primary, #ffffff)',
              fontSize: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
            }}
          >
            <PlayArrowRoundedIcon sx={{ fontSize: 10 }} />
            {formatDuration(item.durationSec)}
          </Box>
        )}
        {item.category === 'image' && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              px: 0.75,
              py: 0.125,
              borderRadius: 0.5,
              bgcolor: 'rgba(91, 141, 239, 0.85)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            图文
          </Box>
        )}
      </Box>

      <Box sx={{ p: 1.5 }}>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary, #ffffff)',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            mb: 1,
            minHeight: 34,
          }}
        >
          {item.title}
        </Typography>

        {/* 作者行:头像 + 名字 + 状态徽章 + 关注/朋友按钮 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
          <Avatar src={item.authorAvatar || undefined} sx={{ width: 22, height: 22, fontSize: 10 }}>
            {item.authorName?.[0] ?? '?'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontSize: 11, color: 'var(--text-secondary, rgba(255,255,255,0.85))', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.authorName}
              </Typography>
              {item.isFriend ? (
                <Tooltip title="互相关注">
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.05, borderRadius: 0.5, bgcolor: 'rgba(93, 219, 150, 0.15)', color: 'success.main', fontSize: 9, fontWeight: 600, flexShrink: 0 }}>
                    <CheckCircleRoundedIcon sx={{ fontSize: 9 }} />
                    朋友
                  </Box>
                </Tooltip>
              ) : item.isFollowing ? (
                <Tooltip title="已关注">
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.05, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontSize: 9, fontWeight: 500, flexShrink: 0 }}>
                    关注
                  </Box>
                </Tooltip>
              ) : null}
            </Box>
          </Box>

          {showActions && (
            tab === 'friend' && item.isFollowing && !item.isFriend ? (
              <Button
                size="small"
                variant="contained"
                onClick={addAsFriend}
                disabled={busy}
                startIcon={<PersonAddAlt1Icon sx={{ fontSize: 12 }} />}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'none',
                  bgcolor: '#5B8DEF',
                  '&:hover': { bgcolor: '#4A7AD9' },
                }}
              >
                加为朋友
              </Button>
            ) : item.isFollowing ? (
              <Button
                size="small"
                variant="outlined"
                onClick={toggleFollow}
                disabled={busy}
                startIcon={<CheckIcon sx={{ fontSize: 12 }} />}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: 'none',
                  color: 'var(--text-secondary, rgba(255,255,255,0.7))',
                  borderColor: 'var(--border-strong, rgba(255,255,255,0.16))',
                  '&:hover': { borderColor: 'var(--border-strong, rgba(255,255,255,0.24))', bgcolor: 'var(--bg-hover, rgba(255,255,255,0.04))' },
                }}
              >
                已关注
              </Button>
            ) : (
              <Button
                size="small"
                variant="contained"
                onClick={toggleFollow}
                disabled={busy}
                startIcon={<AddIcon sx={{ fontSize: 12 }} />}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'none',
                  bgcolor: 'var(--brand-color, #FE2C55)',
                  '&:hover': { bgcolor: '#E0274A' },
                }}
              >
                关注
              </Button>
            )
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Stat icon={<FavoriteBorderRoundedIcon sx={{ fontSize: 12 }} />} value={item.likes} />
          <Stat icon={<ModeCommentOutlinedIcon sx={{ fontSize: 12 }} />} value={item.comments} />
          <Stat icon={<ShareOutlinedIcon sx={{ fontSize: 12 }} />} value={item.shares} />
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
            {formatViews(item.views)} 播放
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

// ─── 推荐区(空态 / 顶部插入) ───
function RecommendSection({ tab }: { tab: 'follow' | 'friend' }) {
  const type = tab === 'friend' ? 'friend' : 'follow';
  const title = tab === 'friend' ? '你可能认识的人' : '推荐关注';
  const hint = tab === 'friend' ? '基于共同好友推荐' : '基于你的兴趣推荐';

  const { data, isLoading } = useQuery({
    queryKey: ['home', 'suggestions', type],
    queryFn: () => homeClient.get<{ list: SuggestUser[] }>(`/suggestions?type=${type}&limit=8`).then((r) => r.data),
  });

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>{title}</Typography>
          <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))', mt: 0.25 }}>{hint}</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.5 }}>
        {((isLoading ? Array.from({ length: 4 }, () => undefined as SuggestUser | undefined) : (data?.list as SuggestUser[] | undefined) || [])).map((u, i) => (
          <SuggestUserCard key={u?.id || i} user={u} tab={tab} loading={isLoading} />
        ))}
      </Box>
    </Box>
  );
}

function SuggestUserCard({ user, tab, loading }: { user?: SuggestUser; tab: 'follow' | 'friend'; loading?: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const isFriend = tab === 'friend';

  const act = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || busy) return;
    setBusy(true);
    try {
      if (isFriend) {
        await homeClient.post(`/friend/${user.id}`);
        qc.invalidateQueries({ queryKey: ['home', 'friend'] });
      } else {
        await homeClient.post(`/follow/${user.id}`);
      }
      qc.invalidateQueries({ queryKey: ['home', 'feed'] });
      qc.invalidateQueries({ queryKey: ['home', 'suggestions'] });
    } catch (err) {
      console.error('action failed', err);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))', height: 88 }} />
    );
  }

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        transition: 'border-color 0.2s',
        '&:hover': { borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' },
      }}
    >
      <Avatar src={user.avatar || undefined} sx={{ width: 40, height: 40, fontSize: 14, flexShrink: 0 }}>
        {user.name?.[0] ?? '?'}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary, #fff)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.name}
          </Typography>
          {user.verified && (
            <Tooltip title="认证创作者">
              <CheckCircleRoundedIcon sx={{ fontSize: 12, color: 'primary.main' }} />
            </Tooltip>
          )}
        </Box>
        <Typography sx={{ fontSize: 10, color: 'var(--text-muted, rgba(255,255,255,0.5))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.followers >= 10000 ? `${(user.followers / 10000).toFixed(1)}w` : user.followers} 粉丝
        </Typography>
      </Box>
      <Button
        size="small"
        variant="contained"
        onClick={act}
        disabled={busy}
        startIcon={isFriend ? <PersonAddAlt1Icon sx={{ fontSize: 12 }} /> : <AddIcon sx={{ fontSize: 12 }} />}
        sx={{
          minWidth: 0,
          px: 1.25,
          py: 0.4,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'none',
          bgcolor: isFriend ? '#5B8DEF' : 'var(--brand-color, #FE2C55)',
          '&:hover': { bgcolor: isFriend ? '#4A7AD9' : '#E0274A' },
        }}
      >
        {isFriend ? '+加好友' : '+关注'}
      </Button>
    </Box>
  );
}

function Stat({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, color: 'var(--text-muted, rgba(255,255,255,0.55))' }}>
      {icon}
      <Typography sx={{ fontSize: 11 }}>{value}</Typography>
    </Box>
  );
}

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViews(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toString();
}

// ─── 空态文案(轻量) ───
function EmptyHint({ tab, section }: { tab: 'home' | 'follow' | 'friend'; section: FeedItem['section'] }) {
  const isRec = section === 'recommend';
  let title = '该分类暂无内容';
  let hint = '试试切换到其他分类';
  if (isRec) {
    if (tab === 'home') { title = '精选内容为空'; hint = '稍后再来看看'; }
    else if (tab === 'follow') { title = '还没有关注动态'; hint = '去下方推荐关注更多创作者'; }
    else if (tab === 'friend') { title = '朋友动态为空'; hint = '加几个朋友,看看他们的生活'; }
  }
  return (
    <Box
      sx={{
        py: 6,
        textAlign: 'center',
        borderRadius: 2,
        bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.3))',
        border: '1px dashed var(--border-color, rgba(255,255,255,0.1))',
        mb: 2,
      }}
    >
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{title}</Typography>
      <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>{hint}</Typography>
    </Box>
  );
}

// ─── 朋友 tab 头部(sticky,带统计 + 管理入口) ───
function FriendHeader({ onOpenManage }: { onOpenManage: () => void }) {
  const { data } = useQuery({
    queryKey: ['home', 'friend', 'stats'],
    queryFn: () => homeClient.get<{ friendCount: number; incoming: number; sent: number }>('/friend/stats').then((r) => r.data),
  });
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: 'var(--bg-topbar, rgba(10, 10, 15, 0.85))',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        flexShrink: 0,
        px: 2,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <GroupsRoundedIcon sx={{ fontSize: 18, color: '#5B8DEF' }} />
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>朋友动态</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, ml: 1 }}>
        <FriendStat label="好友" value={data?.friendCount} />
        <FriendStat label="收到的申请" value={data?.incoming} accent="#5B8DEF" />
        <FriendStat label="已发出" value={data?.sent} />
      </Box>
      <Box sx={{ flex: 1 }} />
      <Button
        size="small"
        variant="outlined"
        startIcon={<GroupsRoundedIcon sx={{ fontSize: 14 }} />}
        onClick={onOpenManage}
        sx={{
          minWidth: 0,
          px: 1.5,
          py: 0.5,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'none',
          color: '#5B8DEF',
          borderColor: 'rgba(91, 141, 239, 0.4)',
          '&:hover': { borderColor: '#5B8DEF', bgcolor: 'rgba(91, 141, 239, 0.08)' },
        }}
      >
        好友管理
      </Button>
    </Box>
  );
}

function FriendStat({ label, value, accent }: { label: string; value: number | undefined; accent?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: accent || 'var(--text-primary, #ffffff)', fontVariantNumeric: 'tabular-nums' }}>
        {value ?? '—'}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))' }}>{label}</Typography>
    </Box>
  );
}

// ─── 关注 tab 子头部:动态 / 我的关注 切换 ───
function FollowSubHeader({ value, onChange }: { value: 'feed' | 'list'; onChange: (v: 'feed' | 'list') => void }) {
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        bgcolor: 'var(--bg-topbar, rgba(10, 10, 15, 0.85))',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
        flexShrink: 0,
        px: 2,
      }}
    >
      <Tabs
        value={value}
        onChange={(_, v) => onChange(v)}
        sx={{
          minHeight: 40,
          '& .MuiTab-root': {
            minHeight: 40,
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-secondary, rgba(255,255,255,0.6))',
            textTransform: 'none',
            px: 2,
            py: 0,
            transition: 'color 0.15s',
            '&:hover': { color: 'var(--text-primary, #ffffff)' },
          },
          '& .Mui-selected': { color: 'var(--brand-color, #FE2C55) !important', fontWeight: 700 },
          '& .MuiTabs-indicator': { backgroundColor: 'var(--brand-color, #FE2C55)', height: 2.5, borderRadius: 1.25 },
        }}
      >
        <Tab value="feed" label="动态" />
        <Tab value="list" label="我的关注" />
      </Tabs>
    </Box>
  );
}

type FollowedUser = {
  id: number;
  name: string;
  avatar: string;
  douyinId: string;
  bio?: string;
  followers: number;
  following: number;
  posts: number;
  isFriend: boolean;
};

// ─── 关注列表(行 + 取关) ───
function FollowList({ onSnack }: { onSnack: (msg: string, severity?: 'success' | 'error') => void }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['home', 'follow', 'list'],
    queryFn: () => homeClient.get<{ list: FollowedUser[]; total: number }>('/follow/list').then((r) => r.data),
  });

  const unfollow = async (user: FollowedUser) => {
    try {
      await homeClient.delete(`/follow/${user.id}`);
      qc.invalidateQueries({ queryKey: ['home', 'follow', 'list'] });
      qc.invalidateQueries({ queryKey: ['home', 'feed'] });
      qc.invalidateQueries({ queryKey: ['home', 'suggestions'] });
      onSnack(`已取消关注 ${user.name}`, 'success');
    } catch {
      onSnack('取关失败,请重试', 'error');
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <AsyncState query={query} skeletonCount={4} skeletonHeight={72} isEmpty={(d) => d.list.length === 0}>
        {(data) => (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontSize: 12, color: 'var(--text-muted, rgba(255,255,255,0.5))', mb: 0.5 }}>
              共 {data.total} 位关注
            </Typography>
            {data.list.map((u) => (
              <FollowedRow key={u.id} user={u} onUnfollow={unfollow} />
            ))}
          </Box>
        )}
      </AsyncState>
    </Box>
  );
}

function FollowedRow({ user, onUnfollow }: { user: FollowedUser; onUnfollow: (u: FollowedUser) => void }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      await onUnfollow(user);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 1.5,
          borderRadius: 2,
          bgcolor: 'var(--bg-card, rgba(20, 22, 32, 0.6))',
          border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
          transition: 'border-color 0.2s',
          '&:hover': { borderColor: 'var(--border-strong, rgba(255,255,255,0.12))' },
        }}
      >
        <Avatar src={user.avatar || undefined} sx={{ width: 48, height: 48, fontSize: 18 }}>
          {user.name?.[0] ?? '?'}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
              {user.name}
            </Typography>
            {user.isFriend && (
              <Tooltip title="互为朋友">
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.05, borderRadius: 0.5, bgcolor: 'rgba(91, 141, 239, 0.15)', color: '#5B8DEF', fontSize: 9, fontWeight: 600 }}>
                  <CheckCircleRoundedIcon sx={{ fontSize: 9 }} />
                  朋友
                </Box>
              </Tooltip>
            )}
          </Box>
          <Typography sx={{ fontSize: 11, color: 'var(--text-muted, rgba(255,255,255,0.5))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.bio || `抖音号: ${user.douyinId}`}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'var(--text-disabled, rgba(255,255,255,0.35))', mt: 0.25 }}>
            {user.followers >= 10000 ? `${(user.followers / 10000).toFixed(1)}w` : user.followers} 粉丝 · {user.posts} 作品
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={() => setConfirming(true)}
          disabled={busy}
          sx={{
            minWidth: 0,
            px: 1.5,
            py: 0.5,
            fontSize: 12,
            fontWeight: 500,
            textTransform: 'none',
            color: 'var(--text-secondary, rgba(255,255,255,0.7))',
            borderColor: 'var(--border-strong, rgba(255,255,255,0.16))',
            '&:hover': { borderColor: 'var(--brand-color, #FE2C55)', color: 'var(--brand-color, #FE2C55)', bgcolor: 'rgba(254, 44, 85, 0.06)' },
          }}
        >
          已关注
        </Button>
      </Box>

      <Dialog open={confirming} onClose={() => setConfirming(false)} maxWidth="xs" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary, #fff)', mb: 1 }}>
            确认取消关注?
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'var(--text-secondary, rgba(255,255,255,0.6))' }}>
            取消后将不再看到 <b style={{ color: 'var(--text-primary, #fff)' }}>{user.name}</b> 的动态更新。
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, p: 2, pt: 0, justifyContent: 'flex-end' }}>
          <Button onClick={() => setConfirming(false)} sx={{ color: 'var(--text-secondary, rgba(255,255,255,0.7))', textTransform: 'none' }}>
            再想想
          </Button>
          <Button
            onClick={handle}
            disabled={busy}
            variant="contained"
            sx={{ bgcolor: 'var(--brand-color, #FE2C55)', textTransform: 'none', '&:hover': { bgcolor: '#E0274A' } }}
          >
            确认取关
          </Button>
        </Box>
      </Dialog>
    </>
  );
}
