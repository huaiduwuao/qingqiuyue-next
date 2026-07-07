'use client';

export const dynamic = "force-dynamic";

// 该页依赖 client context + 后端实时数据,SSR/pre-render 时 TIERS/orders 等未就绪 →
// 报 "Cannot read properties of undefined"。强制 dynamic 跳过预渲染。

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getGiftList, type GiftItem as ApiGift } from '@/apis/dashboard';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Drawer from '@mui/material/Drawer';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AddIcon from '@mui/icons-material/Add';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import EmojiEmotionsRoundedIcon from '@mui/icons-material/EmojiEmotionsRounded';
import SettingsIcon from '@mui/icons-material/Settings';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FlipIcon from '@mui/icons-material/Flip';
import { useSearchParams, useRouter } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-live';
import { sendComment } from '@/apis/home';
import { collectContent, reportContent } from '@/apis/global';
import { homeClient, accountClient, formatApiError, isNetworkError } from '@/lib/api/client';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { LivePlayerSettings, DEFAULT_LIVE_SETTINGS, type LivePlayerSettingsState } from '@/components/detail/LivePlayerSettings';

interface Live {
  id: number;
  title: string;
  subtitle?: string;
  cover: string;
  author: string;
  hostId: number;
  hostName: string;
  hostAvatar: string;
  description: string;
  isLive: boolean;
  viewers: number;
  category: string;
  region: string;
  startedAt: number;
  hotRank: number;
  isTop: boolean;
  tags: string[];
  views: number;
  likes: number;
}

interface GiftItem {
  id: string;
  name: string;
  emoji: string;
  price: number;
  desc: string;
}

// 后端 /api/core/live/gifts 真接口拉礼物列表(uid 不限,公共数据)
const FALLBACK_GIFTS: GiftItem[] = [
  { id: 'rose', name: '玫瑰', emoji: '🌹', price: 1, desc: '表达心意' },
  { id: 'rocket', name: '火箭', emoji: '🚀', price: 99, desc: '冲人气' },
  { id: 'car', name: '跑车', emoji: '🏎️', price: 199, desc: '豪华座驾' },
  { id: 'medal', name: '金牌', emoji: '🏅', price: 299, desc: '实力认证' },
  { id: 'ring', name: '钻戒', emoji: '💍', price: 999, desc: '真爱之选' },
  { id: 'castle', name: '城堡', emoji: '🏰', price: 9999, desc: '壕气冲天' },
];

function LiveDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get('id');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const query = useQuery({
    queryKey: ['detail', 'live', id],
    queryFn: () => contentDetail({ id: Number(id) }).then((r) => r.data as Partial<Live>),
    enabled: !!id,
  });

  // 礼物列表:真接口拉,失败 fallback 到 FALLBACK_GIFTS
  const { data: giftResp } = useQuery({
    queryKey: ['live-gifts'],
    queryFn: () => getGiftList(),
    staleTime: 5 * 60 * 1000,
  });
  const apiGifts: GiftItem[] = (giftResp?.records ?? giftResp?.list ?? []).map((g: ApiGift) => ({
    id: g.id, name: g.name, emoji: g.icon, price: g.price / 100, desc: g.effect,
  }));
  const GIFT_CATALOG: GiftItem[] = apiGifts.length ? apiGifts : FALLBACK_GIFTS;

  const [followed, setFollowed] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [collectBusy, setCollectBusy] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chat, setChat] = useState<Array<{ id: number; user: string; avatar: string; text: string; time: string }>>([]);
  const [chatSending, setChatSending] = useState(false);
  const [danmaku, setDanmaku] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<LivePlayerSettingsState>(DEFAULT_LIVE_SETTINGS);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [pickingGift, setPickingGift] = useState<GiftItem | null>(null);
  const [giftSending, setGiftSending] = useState(false);
  const [sendCount, setSendCount] = useState(0);

  const notify = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  const updateSettings = (patch: Partial<LivePlayerSettingsState>) =>
    setSettings((s) => ({ ...s, ...patch }));

  // 模拟观看人数实时上涨
  const [viewersLive, setViewersLive] = useState(0);
  useEffect(() => {
    if (query.data?.viewers) setViewersLive(query.data.viewers);
  }, [query.data?.viewers]);
  useEffect(() => {
    if (!query.data?.isLive) return;
    const t = setInterval(() => {
      setViewersLive((v) => v + Math.floor(Math.random() * 11) - 3);
    }, 3000);
    return () => clearInterval(t);
  }, [query.data?.isLive]);

  const elapsed = query.data?.startedAt
    ? formatElapsed(Date.now() - query.data.startedAt)
    : '00:00:00';
  // 每分钟重算 elapsed
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChat((c) => [
      ...c,
      { id: Date.now(), user: '我', avatar: '', text, time: '刚刚' },
    ]);
    setChatInput('');
    if (!id) return;
    setChatSending(true);
    try {
      await sendComment({ contentId: Number(id), content: text });
    } catch (err) {
      notify(formatApiError(err), 'error');
    } finally {
      setChatSending(false);
    }
  };

  const handleCollect = async () => {
    if (!id) {
      notify('内容 ID 缺失', 'error');
      return;
    }
    if (collectBusy) return;
    setCollectBusy(true);
    const next = !favorited;
    setFavorited(next);
    try {
      await collectContent({ contentId: Number(id), action: next ? 'collect' : 'cancel_collect' });
    } catch (err) {
      setFavorited(!next);
      notify(formatApiError(err), 'error');
    } finally {
      setCollectBusy(false);
    }
  };

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const title = query.data?.title || '直播详情';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        notify('链接已复制到剪贴板');
      } else {
        notify('当前环境不支持分享', 'info');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        notify('分享失败', 'error');
      }
    }
  };

  const handleFollow = async () => {
    const userId = query.data?.hostId;
    if (!userId) {
      notify('无法获取主播信息', 'error');
      return;
    }
    if (followBusy) return;
    setFollowBusy(true);
    const wasFollowing = followed;
    setFollowed(!wasFollowing);
    try {
      if (wasFollowing) {
        await homeClient.delete(`/follow/${userId}`);
        notify('已取消关注');
      } else {
        await homeClient.post(`/follow/${userId}`);
        notify('关注成功');
      }
    } catch (err) {
      setFollowed(wasFollowing);
      notify(formatApiError(err), 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleGift = () => {
    if (!id) {
      notify('内容 ID 缺失', 'error');
      return;
    }
    setPickingGift(null);
    setGiftOpen(true);
  };

  const confirmSendGift = async (gift: GiftItem) => {
    if (!id) return;
    setGiftSending(true);
    try {
      await accountClient('/account/gift/send', {
        method: 'POST',
        data: { liveId: Number(id), giftId: gift.id, count: 1 },
      });
      setSendCount((n) => n + 1);
      setPickingGift(null);
      setGiftOpen(false);
      notify(`已送出 ${gift.name} × 1`);
    } catch (err) {
      // 网络错时 fallback 到 mock:保留本地 sendCount++ 让 UI 不阻塞
      if (isNetworkError(err)) {
        setSendCount((n) => n + 1);
        setPickingGift(null);
        setGiftOpen(false);
        notify(`已送出 ${gift.name} × 1 (离线)`);
      } else {
        notify(formatApiError(err), 'error');
      }
    } finally {
      setGiftSending(false);
    }
  };

  const handleOpenReport = () => {
    setSettingsOpen(false);
    setReportOpen(true);
  };

  const handleSubmitReport = async () => {
    if (!id) {
      notify('内容 ID 缺失', 'error');
      return;
    }
    const reason = reportReason.trim();
    if (!reason) {
      notify('请填写举报原因', 'error');
      return;
    }
    setReportBusy(true);
    try {
      await reportContent({ contentId: Number(id), reason });
      setReportOpen(false);
      setReportReason('');
      notify('举报已提交，我们会尽快处理');
    } catch (err) {
      notify(formatApiError(err), 'error');
    } finally {
      setReportBusy(false);
    }
  };

  // 自动滚动聊天到底部
  useEffect(() => {
    if (!settings.autoScrollChat) return;
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, settings.autoScrollChat]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title?.replace(/【直播中】/, '') || '直播'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton disabled={collectBusy} onClick={handleCollect} sx={{ color: favorited ? 'primary.main' : 'text.tertiary' }} aria-label="收藏">
              {favorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
            <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: 'text.tertiary' }} aria-label="直播设置">
              <SettingsIcon />
            </IconButton>
            <IconButton onClick={handleShare} sx={{ color: 'text.tertiary' }} aria-label="分享">
              <ShareIcon />
            </IconButton>
          </Box>
        }
      />

      <AsyncState query={query} isEmpty={(d) => !d}>
        {(data) => (
          <>
            {/* 直播播放器区 */}
            <Box sx={{ position: 'relative', bgcolor: '#000' }}>
              <Container maxWidth="lg" sx={{ py: 0 }}>
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: settings.aspect === '4:3' ? '4/3' : settings.aspect === 'fill' ? '21/9' : '16/9',
                    backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.2)), url(${data.cover})`,
                    backgroundSize: settings.aspect === 'fill' ? 'cover' : 'cover',
                    backgroundPosition: 'center',
                    borderRadius: 0,
                    overflow: 'hidden',
                    transform: settings.mirror ? 'scaleX(-1)' : 'none',
                    transition: 'aspect-ratio 0.3s',
                  }}
                >
                  {/* LIVE 徽章 + 房间号 + 清晰度 */}
                  <Box sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 1, alignItems: 'center', zIndex: 2 }}>
                    {data.isLive && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 0.75, bgcolor: 'primary.main' }}>
                        <LiveTvRoundedIcon sx={{ fontSize: 12, color: '#fff' }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>LIVE</Typography>
                      </Box>
                    )}
                    <Box sx={{ px: 1, py: 0.5, borderRadius: 0.75, bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                      <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>房间号 {data.id}</Typography>
                    </Box>
                    <Box sx={{ px: 1, py: 0.5, borderRadius: 0.75, bgcolor: 'rgba(254,44,85,0.85)' }}>
                      <Typography sx={{ fontSize: 10, color: '#fff', fontWeight: 700, fontFamily: 'monospace' }}>
                        {settings.quality}
                      </Typography>
                    </Box>
                  </Box>

                  {/* 顶部右侧:观看人数 + 时长 + 静音/镜像状态 */}
                  <Box sx={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 1, alignItems: 'center', zIndex: 2 }}>
                    {settings.muted && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 0.75, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                        <VolumeOffIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                      </Box>
                    )}
                    {settings.mirror && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 0.75, bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                        <FlipIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 0.75, bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                      <VisibilityRoundedIcon sx={{ fontSize: 12, color: '#fff' }} />
                      <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>{formatViewers(viewersLive)}</Typography>
                    </Box>
                    <Box sx={{ px: 1, py: 0.5, borderRadius: 0.75, bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                      <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}>已播 {elapsed}</Typography>
                    </Box>
                  </Box>

                  {/* 弹幕飘过 */}
                  {settings.danmakuOn && (
                    <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', opacity: settings.danmakuOpacity / 100 }}>
                      {danmaku.slice(-6).map((t, i) => (
                        <Box
                          key={`${i}-${t}`}
                          sx={{
                            position: 'absolute',
                            right: 16,
                            top: 80 + i * 40,
                            px: 1.25,
                            py: 0.5,
                            borderRadius: 0.75,
                            bgcolor: 'rgba(0,0,0,0.45)',
                            backdropFilter: 'blur(2px)',
                            animation: `dmScroll ${settings.danmakuSpeed}s linear forwards`,
                            '@keyframes dmScroll': {
                              '0%': { opacity: 0, transform: 'translateX(20px)' },
                              '10%': { opacity: 1, transform: 'translateX(0)' },
                              '85%': { opacity: 1 },
                              '100%': { opacity: 0 },
                            },
                          }}
                        >
                          <Typography sx={{ fontSize: settings.danmakuFontSize, color: '#fff', whiteSpace: 'nowrap' }}>{t}</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* 底部渐变 + 直播结束遮罩 */}
                  {!data.isLive && (
                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
                      <Typography sx={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>主播已下播,看看回放?</Typography>
                    </Box>
                  )}
                </Box>
              </Container>
            </Box>

            <Container maxWidth="lg" sx={{ py: 3 }}>
              {/* 标题 + 标签 */}
              <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mb: 1, lineHeight: 1.4 }}>
                {data.title}
              </Typography>
              {data.subtitle && (
                <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5, lineHeight: 1.5 }}>
                  {data.subtitle}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                <Chip label={data.category} size="small" sx={{ bgcolor: 'rgba(254, 44, 85, 0.12)', color: 'primary.main', fontWeight: 600 }} />
                <Chip label={data.region} size="small" variant="outlined" sx={{ borderColor: 'divider', color: 'text.secondary' }} />
                {data.isTop && (
                  <Chip label="🔥 推荐" size="small" sx={{ bgcolor: 'warning.main', color: '#1a1a1a', fontWeight: 700 }} />
                )}
                {(data.tags || []).map((t) => (
                  <Chip key={t} label={`#${t}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: 'text.tertiary' }} />
                ))}
              </Box>

              {/* 主播卡片 */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  mb: 2,
                }}
              >
                <Avatar src={data.hostAvatar} sx={{ width: 48, height: 48, border: '2px solid', borderColor: 'primary.main' }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>{data.hostName}</Typography>
                    {data.isLive && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                      </Box>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>粉丝 {((data.views || 0) / 10000).toFixed(1)}万 · 累计 {((data.likes || 0) / 10000).toFixed(1)}万 赞</Typography>
                </Box>
                <Chip
                  icon={followed ? <CheckRoundedIcon sx={{ fontSize: 14 }} /> : <AddIcon sx={{ fontSize: 14 }} />}
                  label={followed ? '已关注' : '关注'}
                  onClick={handleFollow}
                  disabled={followBusy || !query.data?.hostId}
                  sx={{
                    bgcolor: followed ? 'transparent' : 'primary.main',
                    color: followed ? 'text.secondary' : '#fff',
                    border: followed ? '1px solid' : 'none',
                    borderColor: 'divider',
                    fontWeight: 700,
                    '&:hover': { bgcolor: followed ? 'transparent' : '#E0264B' },
                  }}
                />
              </Box>

              {/* 直播间简介 */}
              <Typography variant="h6" sx={{ color: 'text.primary', mb: 1.5, fontWeight: 700 }}>
                直播简介
              </Typography>
              <Typography sx={{ color: 'text.tertiary', fontSize: 14, lineHeight: 1.8, mb: 2, whiteSpace: 'pre-wrap' }}>
                {data.description}
              </Typography>

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

              {/* 互动区:礼物 + 实时聊天 */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700 }}>
                  实时互动
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>· {chat.length} 条消息</Typography>
              </Box>

              <Box
                sx={{
                  p: 1.5,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  mb: 3,
                }}
              >
                <Box
                  ref={chatScrollRef}
                  sx={{ maxHeight: 280, overflow: 'auto', mb: 1.5, pr: 1 }}
                >
                  {chat.map((c) => (
                    <Box key={c.id} sx={{ display: 'flex', gap: 1, mb: 1.25, alignItems: 'flex-start' }}>
                      <Avatar src={c.avatar} sx={{ width: 28, height: 28 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 600, color: c.user === '我' ? 'primary.main' : 'text.primary' }}>
                            {c.user}
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{c.time}</Typography>
                        </Box>
                        <Typography sx={{ fontSize: 13, color: 'text.tertiary', lineHeight: 1.5, mt: 0.25 }}>
                          {c.text}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <IconButton size="small" sx={{ color: 'text.tertiary' }}>
                    <EmojiEmotionsRoundedIcon fontSize="small" />
                  </IconButton>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="说点什么…"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 4 } }}
                  />
                  <IconButton
                    onClick={handleGift}
                    sx={{
                      color: 'text.tertiary',
                    }}
                  >
                    <CardGiftcardRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    disabled={chatSending || !chatInput.trim()}
                    onClick={sendChat}
                    sx={{
                      bgcolor: 'primary.main',
                      color: '#fff',
                      '&:hover': { bgcolor: '#E0264B' },
                    }}
                  >
                    <SendRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

              {/* 直播数据 */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 3 }}>
                <StatBox label="累计观看" value={formatViewers(data.views || 0)} />
                <StatBox label="本场点赞" value={formatViewers(data.likes || 0)} />
                <StatBox label="人气榜" value={`#${data.hotRank || 0}`} />
              </Box>
            </Container>
          </>
        )}
      </AsyncState>

      <LivePlayerSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={updateSettings}
        headerInfo={
          query.data && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
              <Avatar src={query.data.hostAvatar} sx={{ width: 24, height: 24 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', lineHeight: 1.2 }} noWrap>
                  {query.data.hostName}
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.2 }} noWrap>
                  {query.data.isLive ? `直播中 · ${formatViewers(viewersLive)}` : '已下播'}
                </Typography>
              </Box>
            </Box>
          )
        }
        onReport={handleOpenReport}
        onHelp={() => {
          setSettingsOpen(false);
          router.push('/kf-chat');
        }}
        onLeave={() => {
          setSettingsOpen(false);
          router.back();
        }}
      />

      <Dialog
        open={reportOpen}
        onClose={() => {
          setReportOpen(false);
          setReportReason('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: 15, fontWeight: 600 }}>举报直播间</DialogTitle>
        <DialogContent dividers>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="举报原因"
            placeholder="请简要描述举报原因..."
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button
            onClick={() => {
              setReportOpen(false);
              setReportReason('');
            }}
            sx={{ color: 'text.secondary' }}
          >
            取消
          </Button>
          <Button
            variant="contained"
            disabled={reportBusy || !reportReason.trim()}
            onClick={handleSubmitReport}
          >
            提交举报
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor="bottom"
        open={giftOpen}
        onClose={() => {
          if (giftSending) return;
          setGiftOpen(false);
          setPickingGift(null);
        }}
        slotProps={{
          paper: {
            sx: {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              bgcolor: 'background.paper',
              maxHeight: '85vh',
            },
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary' }}>
                送出礼物
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
                本场已送出 {sendCount} 个礼物 · 给主播加油打气
              </Typography>
            </Box>
            <Button
              size="small"
              onClick={() => {
                setGiftOpen(false);
                setPickingGift(null);
              }}
              sx={{ color: 'text.secondary', minWidth: 0 }}
              disabled={giftSending}
            >
              关闭
            </Button>
          </Box>

          {!pickingGift ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 1.25,
              }}
            >
              {GIFT_CATALOG.map((g) => (
                <Box
                  key={g.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPickingGift(g)}
                  sx={{
                    p: 1.25,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                    textAlign: 'center',
                    cursor: 'pointer',
                    bgcolor: 'background.default',
                    transition: 'all 0.15s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <Typography sx={{ fontSize: 32, lineHeight: 1 }}>{g.emoji}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary', mt: 0.5 }}>
                    {g.name}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: 'text.tertiary', mt: 0.25 }}>
                    {g.desc}
                  </Typography>
                  <Box
                    sx={{
                      mt: 0.75,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.25,
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1,
                      bgcolor: 'rgba(254, 44, 85, 0.1)',
                    }}
                  >
                    <Typography sx={{ fontSize: 10, color: 'primary.main', fontWeight: 700 }}>
                      💎 {g.price}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'primary.main',
                  borderRadius: 2,
                  bgcolor: 'rgba(254, 44, 85, 0.04)',
                  mb: 2,
                }}
              >
                <Typography sx={{ fontSize: 48, lineHeight: 1 }}>{pickingGift.emoji}</Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary' }}>
                    {pickingGift.name}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>
                    {pickingGift.desc}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'primary.main', fontWeight: 700, mt: 0.5 }}>
                    💎 {pickingGift.price} 钻石 × 1
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setPickingGift(null)}
                  disabled={giftSending}
                  sx={{ color: 'text.secondary', borderColor: 'divider' }}
                >
                  返回选择
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  disabled={giftSending}
                  onClick={() => confirmSendGift(pickingGift)}
                >
                  {giftSending ? '送出中…' : `确认送出 (💎${pickingGift.price})`}
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Drawer>

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

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        p: 1.5,
        textAlign: 'center',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Typography sx={{ fontSize: 18, fontWeight: 800, color: 'primary.main', fontFamily: 'monospace' }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.25 }}>{label}</Typography>
    </Box>
  );
}

function formatViewers(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function formatElapsed(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function LiveDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <LiveDetailContent />
    </React.Suspense>
  );
}
