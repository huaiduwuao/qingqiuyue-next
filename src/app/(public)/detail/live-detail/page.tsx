'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import ShareIcon from '@mui/icons-material/Share';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AddIcon from '@mui/icons-material/Add';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EmojiEmotionsRoundedIcon from '@mui/icons-material/EmojiEmotionsRounded';
import SettingsIcon from '@mui/icons-material/Settings';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FlipIcon from '@mui/icons-material/Flip';
import Snackbar from '@mui/material/Snackbar';
import { useSearchParams, useRouter } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-live';
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

  const [followed, setFollowed] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chat, setChat] = useState<Array<{ id: number; user: string; avatar: string; text: string; time: string }>>([]);
  const [danmaku, setDanmaku] = useState<string[]>([]);
  const [giftPanelOpen, setGiftPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<LivePlayerSettingsState>(DEFAULT_LIVE_SETTINGS);
  const [snack, setSnack] = useState<string | null>(null);

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

  const sendChat = () => {
    if (!chatInput.trim()) return;
    setChat((c) => [
      ...c,
      { id: Date.now(), user: '我', avatar: '', text: chatInput, time: '刚刚' },
    ]);
    setChatInput('');
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
            <IconButton onClick={() => setFavorited((f) => !f)} sx={{ color: favorited ? 'primary.main' : 'text.tertiary' }} aria-label="收藏">
              {favorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
            <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: 'text.tertiary' }} aria-label="直播设置">
              <SettingsIcon />
            </IconButton>
            <IconButton sx={{ color: 'text.tertiary' }} aria-label="分享">
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
                  onClick={() => setFollowed((f) => !f)}
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
                    onClick={() => setGiftPanelOpen((o) => !o)}
                    sx={{
                      color: giftPanelOpen ? 'primary.main' : 'text.tertiary',
                      bgcolor: giftPanelOpen ? 'rgba(254,44,85,0.1)' : 'transparent',
                    }}
                  >
                    <CardGiftcardRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
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

                {/* 礼物面板 */}
                {giftPanelOpen && (
                  <Box sx={{ mt: 1.5, p: 1, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', flex: 1 }}>
                        送出礼物
                      </Typography>
                      <IconButton size="small" onClick={() => setGiftPanelOpen(false)}>
                        <CloseRoundedIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                    <Typography sx={{ p: 2, textAlign: 'center', color: 'text.secondary', fontSize: 12 }}>
                      暂无礼物数据
                    </Typography>
                  </Box>
                )}
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
        onReport={() => {
          setSettingsOpen(false);
          setSnack('已收到举报,我们会尽快处理');
        }}
        onHelp={() => {
          setSettingsOpen(false);
          setSnack('帮助中心:遇到问题可联系客服 400-xxx-xxxx');
        }}
        onLeave={() => {
          setSettingsOpen(false);
          router.back();
        }}
      />
      <Snackbar
        open={!!snack}
        autoHideDuration={2400}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
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
