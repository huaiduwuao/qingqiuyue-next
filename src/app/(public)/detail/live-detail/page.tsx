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
import { useSearchParams } from 'next/navigation';
import { detail as contentDetail } from '@/apis/content-live';
import { withDefaults } from '@/utils/withDefaults';
import DetailHeader from '@/components/detail/DetailHeader';
import { AsyncState } from '@/components/common/AsyncState';
import { useContentNavigate } from '@/lib/contentRoute';

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

const MOCK_LIVE: Live = {
  id: 1,
  title: '【直播中】月下旅人 · 深夜书斋与慢生活',
  subtitle: '夜读《浮生六记》,聊聊最近的阅读与生活',
  cover: 'https://picsum.photos/seed/lv-cover/1280/720',
  author: '月下旅人',
  hostId: 1001,
  hostName: '月下旅人',
  hostAvatar: 'https://picsum.photos/seed/host-1/120/120',
  description: '今晚继续连麦,聊聊最近书单里让我印象最深的几本。书斋灯下,一杯热茶,一段慢时光,直播间见~',
  isLive: true,
  viewers: 12480,
  category: '知识',
  region: '杭州',
  startedAt: Date.now() - 1000 * 60 * 35,
  hotRank: 1,
  isTop: true,
  tags: ['夜读', '书斋', '慢生活', '浮生六记'],
  views: 28_5600,
  likes: 12_400,
};

const SAMPLE_GIFTS = [
  { id: 1, name: '小星星', icon: '⭐', price: 1 },
  { id: 2, name: '玫瑰', icon: '🌹', price: 10 },
  { id: 3, name: '跑车', icon: '🏎️', price: 100 },
  { id: 4, name: '城堡', icon: '🏰', price: 1000 },
  { id: 5, name: '火箭', icon: '🚀', price: 5000 },
];

const SAMPLE_CHAT = [
  { id: 1, user: '青衣', avatar: 'https://picsum.photos/seed/u1/60/60', text: '主播声音真好听,深夜陪伴', time: '刚刚' },
  { id: 2, user: '南风', avatar: 'https://picsum.photos/seed/u2/60/60', text: '《浮生六记》我也很喜欢!', time: '1 分钟前' },
  { id: 3, user: '小满', avatar: 'https://picsum.photos/seed/u3/60/60', text: '今天这泡茶真香,什么茶?', time: '2 分钟前' },
  { id: 4, user: '鹿野', avatar: 'https://picsum.photos/seed/u4/60/60', text: '刚下班就赶过来了', time: '3 分钟前' },
  { id: 5, user: '光影', avatar: 'https://picsum.photos/seed/u5/60/60', text: '听说今晚会连麦,期待!', time: '4 分钟前' },
];

const SAMPLE_DANMAKU = ['666', '主播加油', '好看', '前排', '🍵', '深夜陪伴', '好听', '❤️', '🎉', '💰', '前排打卡', '主播晚安'];

const MOCK_RECOMMEND = [
  { id: 2, title: '【直播中】光影捕手 · 城市夜景漫步', cover: 'https://picsum.photos/seed/lv2/300/400', hostName: '光影捕手', viewers: 8930, category: '户外' },
  { id: 3, title: '【直播中】青衣 · 古典吉他弹唱', cover: 'https://picsum.photos/seed/lv3/300/400', hostName: '青衣', viewers: 5621, category: '音乐' },
  { id: 4, title: '【直播中】南风 · 周末厨房日记', cover: 'https://picsum.photos/seed/lv4/300/400', hostName: '南风', viewers: 4203, category: '美食' },
  { id: 5, title: '【直播中】小满 · 代码时间', cover: 'https://picsum.photos/seed/lv5/300/400', hostName: '小满', viewers: 3112, category: '知识' },
];

function LiveDetailContent() {
  const searchParams = useSearchParams();
  const navigate = useContentNavigate();
  const id = searchParams.get('id');

  const query = useQuery({
    queryKey: ['detail', 'live', id],
    queryFn: () => contentDetail({ id: Number(id) }).then((r) => r.data as Partial<Live>),
    enabled: !!id,
    placeholderData: MOCK_LIVE,
    select: (data) => withDefaults(MOCK_LIVE, data),
  });

  const [followed, setFollowed] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chat, setChat] = useState(SAMPLE_CHAT);
  const [danmaku, setDanmaku] = useState<string[]>([]);
  const [giftPanelOpen, setGiftPanelOpen] = useState(false);

  // 模拟观看人数实时上涨
  const [viewersLive, setViewersLive] = useState(MOCK_LIVE.viewers);
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

  // 模拟弹幕飘过
  useEffect(() => {
    if (!query.data?.isLive) return;
    const t = setInterval(() => {
      const text = SAMPLE_DANMAKU[Math.floor(Math.random() * SAMPLE_DANMAKU.length)];
      setDanmaku((d) => [...d.slice(-12), text]);
    }, 1800);
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
      { id: Date.now(), user: '我', avatar: 'https://picsum.photos/seed/me/60/60', text: chatInput, time: '刚刚' },
    ]);
    setChatInput('');
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <DetailHeader
        title={query.data?.title?.replace(/【直播中】/, '') || '直播'}
        rightActions={
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton onClick={() => setFavorited((f) => !f)} sx={{ color: favorited ? 'primary.main' : 'text.tertiary' }}>
              {favorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
            </IconButton>
            <IconButton sx={{ color: 'text.tertiary' }}>
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
                    aspectRatio: '16/9',
                    backgroundImage: `linear-gradient(135deg, rgba(0,0,0,0.4), rgba(0,0,0,0.2)), url(${data.cover})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: 0,
                    overflow: 'hidden',
                  }}
                >
                  {/* LIVE 徽章 + 房间号 */}
                  <Box sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 1, alignItems: 'center' }}>
                    {data.isLive && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 0.75, bgcolor: 'primary.main' }}>
                        <LiveTvRoundedIcon sx={{ fontSize: 12, color: '#fff' }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 0.5 }}>LIVE</Typography>
                      </Box>
                    )}
                    <Box sx={{ px: 1, py: 0.5, borderRadius: 0.75, bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                      <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>房间号 {data.id}</Typography>
                    </Box>
                  </Box>

                  {/* 顶部右侧:观看人数 + 时长 */}
                  <Box sx={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 0.75, bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                      <VisibilityRoundedIcon sx={{ fontSize: 12, color: '#fff' }} />
                      <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>{formatViewers(viewersLive)}</Typography>
                    </Box>
                    <Box sx={{ px: 1, py: 0.5, borderRadius: 0.75, bgcolor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                      <Typography sx={{ fontSize: 11, color: '#fff', fontWeight: 600, fontFamily: 'monospace' }}>已播 {elapsed}</Typography>
                    </Box>
                  </Box>

                  {/* 弹幕飘过 */}
                  <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                    {danmaku.slice(-6).map((t, i) => (
                      <Box
                        key={`${i}-${t}`}
                        sx={{
                          position: 'absolute',
                          right: 16,
                          top: 80 + i * 36,
                          px: 1.25,
                          py: 0.5,
                          borderRadius: 0.75,
                          bgcolor: 'rgba(0,0,0,0.45)',
                          backdropFilter: 'blur(2px)',
                          animation: 'fadeOut 4s ease-in forwards',
                          '@keyframes fadeOut': {
                            '0%': { opacity: 0, transform: 'translateX(20px)' },
                            '10%': { opacity: 1, transform: 'translateX(0)' },
                            '85%': { opacity: 1 },
                            '100%': { opacity: 0 },
                          },
                        }}
                      >
                        <Typography sx={{ fontSize: 12, color: '#fff' }}>{t}</Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* 底部渐变 + 直播结束遮罩 */}
                  {!data.isLive && (
                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                {data.tags.map((t) => (
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
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>粉丝 {(data.views / 10000).toFixed(1)}万 · 累计 {(data.likes / 10000).toFixed(1)}万 赞</Typography>
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
                <Box sx={{ maxHeight: 280, overflow: 'auto', mb: 1.5, pr: 1 }}>
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
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1 }}>
                      {SAMPLE_GIFTS.map((g) => (
                        <Box
                          key={g.id}
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            py: 1,
                            borderRadius: 1.5,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            '&:hover': { bgcolor: 'rgba(254,44,85,0.08)' },
                          }}
                        >
                          <Typography sx={{ fontSize: 26, mb: 0.25 }}>{g.icon}</Typography>
                          <Typography sx={{ fontSize: 11, color: 'text.primary', fontWeight: 600 }}>{g.name}</Typography>
                          <Typography sx={{ fontSize: 10, color: 'primary.main' }}>¥{g.price}</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>

              <Divider sx={{ borderColor: 'divider', my: 3 }} />

              {/* 直播数据 */}
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 3 }}>
                <StatBox label="累计观看" value={formatViewers(data.views)} />
                <StatBox label="本场点赞" value={formatViewers(data.likes)} />
                <StatBox label="人气榜" value={`#${data.hotRank}`} />
              </Box>

              {/* 相关推荐 */}
              <Typography variant="h6" sx={{ color: 'text.primary', mb: 2, fontWeight: 700 }}>
                更多直播
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
                {MOCK_RECOMMEND.map((r) => (
                  <Box
                    key={r.id}
                    onClick={() => navigate('LIVE', r.id)}
                    sx={{ cursor: 'pointer', '&:hover': { transform: 'translateY(-2px)' }, transition: 'all 0.15s' }}
                  >
                    <Box sx={{ position: 'relative' }}>
                      <Box
                        component="img"
                        src={r.cover}
                        alt={r.title}
                        sx={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 1.5 }}
                      />
                      <Box sx={{ position: 'absolute', top: 6, left: 6, display: 'flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.25, borderRadius: 0.5, bgcolor: 'primary.main' }}>
                        <LiveTvRoundedIcon sx={{ fontSize: 10, color: '#fff' }} />
                        <Typography sx={{ fontSize: 9, fontWeight: 800, color: '#fff' }}>LIVE</Typography>
                      </Box>
                      <Box sx={{ position: 'absolute', bottom: 6, right: 6, display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.25, borderRadius: 0.5, bgcolor: 'rgba(0,0,0,0.55)' }}>
                        <VisibilityRoundedIcon sx={{ fontSize: 10, color: '#fff' }} />
                        <Typography sx={{ fontSize: 9, color: '#fff' }}>{formatViewers(r.viewers)}</Typography>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', mt: 0.75 }} noWrap>
                      {r.title}
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: 'text.secondary' }} noWrap>
                      {r.hostName} · {r.category}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Container>
          </>
        )}
      </AsyncState>
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
