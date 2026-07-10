'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Dialog from '@mui/material/Dialog';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Slider from '@mui/material/Slider';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import FolderSharedRoundedIcon from '@mui/icons-material/FolderSharedRounded';
import TopicRoundedIcon from '@mui/icons-material/TopicRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import { gradient2 } from '@/constants/gradients';
import {
  getCoCreateCollabs,
  getCoCreateInvites,
  getRecommendedCoCreatePartners,
  acceptCoCreateInvite,
  rejectCoCreateInvite,
  cancelCoCreateInvite,
  finishCoCreate,
  sendCoCreateInvite,
  type CoCreateCollab as ApiCollab,
  type CoCreateInvite as ApiInvite,
  type CoCreatePartner as ApiPartner,
} from '@/apis/dashboard';
import { RelativeTime } from '@/components/common/RelativeTime';

type CollabType = 'jointPost' | 'assetShare' | 'topicCollab';
type CollabStatus = 'active' | 'pending' | 'completed' | 'declined';
type InviteDirection = 'incoming' | 'outgoing';

type Partner = ApiPartner;
type Collaboration = ApiCollab;
type Invite = ApiInvite;

const TYPE_META: Record<CollabType, { label: string; icon: React.ReactNode; color: string; bg: string; desc: string }> = {
  jointPost: { label: '联合投稿', icon: <MovieRoundedIcon sx={{ fontSize: 14 }} />, color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)', desc: '双方账号同时发布同一作品,流量与收益按分成比例分配' },
  assetShare: { label: '素材协作', icon: <FolderSharedRoundedIcon sx={{ fontSize: 14 }} />, color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.12)', desc: '共享原始素材库,各自剪辑发布,适合系列内容' },
  topicCollab: { label: '话题联合', icon: <TopicRoundedIcon sx={{ fontSize: 14 }} />, color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)', desc: '共同发起话题挑战,带动粉丝互动' },
};

const STATUS_META: Record<CollabStatus, { label: string; color: string; bg: string }> = {
  active: { label: '进行中', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)' },
  pending: { label: '待响应', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)' },
  completed: { label: '已完成', color: '#5B8DEF', bg: 'rgba(91, 141, 239, 0.12)' },
  declined: { label: '已拒绝', color: 'text.disabled', bg: 'action.hover' },
};

function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function relativeTime(_ts: number): string {
  // 已废弃:直接调用会引发 SSR/CSR hydration mismatch。
  // 改用 <RelativeTime ts={...} /> 组件,在 mount 后才计算显示。
  if (typeof window === 'undefined') return '';
  return '';
}

function PartnerAvatar({ partner, size = 40 }: { partner: Partner; size?: number }) {
  return (
    <Box sx={{ position: 'relative', flexShrink: 0 }}>
      <Avatar sx={{ width: size, height: size, background: partner.avatar, fontSize: size * 0.4, fontWeight: 700 }}>
        {partner.name[0]}
      </Avatar>
      {partner.verified && (
        <VerifiedRoundedIcon sx={{
          position: 'absolute', bottom: -2, right: -2,
          fontSize: size * 0.35, color: '#1DA1F2',
          background: 'background.paper', borderRadius: '50%',
        }} />
      )}
    </Box>
  );
}

export default function CoCreatePage() {
  const [tab, setTab] = useState<0 | 1 | 2 | 3>(0);
  const [snack, setSnack] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<Partner | null>(null);
  const [keyword, setKeyword] = useState('');
  const [detailCollab, setDetailCollab] = useState<Collaboration | null>(null);
  const router = useRouter();
  const qc = useQueryClient();

  // 真实 API
  const collabsQuery = useQuery({
    queryKey: ['co-create-collabs'],
    queryFn: () => getCoCreateCollabs().then((r) => r.records || r.list || []),
    placeholderData: [],
  });
  const collabs: Collaboration[] = collabsQuery.data ?? [];

  const incomingQuery = useQuery({
    queryKey: ['co-create-invites', 'incoming'],
    queryFn: () => getCoCreateInvites('incoming').then((r) => r.records || r.list || []),
    placeholderData: [],
  });
  const incoming: Invite[] = incomingQuery.data ?? [];

  const outgoingQuery = useQuery({
    queryKey: ['co-create-invites', 'outgoing'],
    queryFn: () => getCoCreateInvites('outgoing').then((r) => r.records || r.list || []),
    placeholderData: [],
  });
  const outgoing: Invite[] = outgoingQuery.data ?? [];

  const recQuery = useQuery({
    queryKey: ['co-create-recommend', keyword],
    queryFn: () => getRecommendedCoCreatePartners({ keyword: keyword || undefined }).then((r) => r.records || r.list || []),
    placeholderData: [],
  });
  const recommended: Partner[] = recQuery.data ?? [];

  const handleMessage = () => {
    router.push('/account/msg');
  };

  const handleViewProfile = (name: string) => {
    router.push(`/u/${encodeURIComponent(name)}`);
  };

  const totals = useMemo(() => ({
    active: collabs.length,
    earnings: collabs.reduce((s, c) => s + c.totalEarnings, 0),
    views: collabs.reduce((s, c) => s + c.jointViews, 0),
    pendingInvites: incoming.length,
  }), [collabs, incoming]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['co-create-collabs'] });
    qc.invalidateQueries({ queryKey: ['co-create-invites'] });
  };

  const handleAcceptInvite = async (id: number) => {
    try {
      await acceptCoCreateInvite(id);
      setSnack('已接受共创邀请');
      invalidateAll();
    } catch (e) {
      setSnack(`接受邀请失败:${e instanceof Error ? e.message : '网络异常'}`);
    }
  };

  const handleDeclineInvite = async (id: number) => {
    try {
      await rejectCoCreateInvite(id);
      setSnack('已拒绝邀请');
      invalidateAll();
    } catch (e) {
      setSnack(`拒绝邀请失败:${e instanceof Error ? e.message : '网络异常'}`);
    }
  };

  const handleCancelOutgoing = async (id: number) => {
    try {
      await cancelCoCreateInvite(id);
      setSnack('已撤回邀请');
      invalidateAll();
    } catch (e) {
      setSnack(`撤回失败:${e instanceof Error ? e.message : '网络异常'}`);
    }
  };

  const handleEndCollab = async (id: number) => {
    try {
      await finishCoCreate(id);
      setSnack('共创已结算并标记完成');
      setDetailCollab(null);
      invalidateAll();
    } catch (e) {
      setSnack(`结束共创失败:${e instanceof Error ? e.message : '网络异常'}`);
    }
  };

  const handleSendInvite = async (partner: Partner, type: CollabType, split: number, message: string, projectId: string, role: string) => {
    try {
      await sendCoCreateInvite({ projectId, userId: partner.id, role, type, revenueSplit: split, message });
      setSnack(`已向 @${partner.name} 发送共创邀请`);
      setInviteTarget(null);
      invalidateAll();
    } catch (e) {
      setSnack(`发送邀请失败:${e instanceof Error ? e.message : '网络异常'}`);
    }
  };

  const recFiltered = useMemo(() => {
    if (!keyword) return recommended;
    return recommended.filter((p) => p.name.includes(keyword) || p.niche.includes(keyword));
  }, [keyword, recommended]);

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
        {/* 标题 */}
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-end' }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary' }}>共创中心</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
              与匹配的创作者联合产出内容,共享流量与收益分成
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setTab(3)}
            sx={{
              textTransform: 'none', borderRadius: 1.5,
              background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
              '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
            }}
          >
            发起共创
          </Button>
        </Box>

        {/* 概览 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5, mb: 3 }}>
          {[
            { label: '进行中共创', value: totals.active, color: '#5DDB96' },
            { label: '累计联合播放', value: formatNum(totals.views), color: '#25F4EE' },
            { label: '共创收益(钻)', value: formatNum(totals.earnings), color: '#FFB400' },
            { label: '待响应邀请', value: totals.pendingInvites, color: '#FE2C55' },
          ].map((s) => (
            <Box key={s.label} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>{s.label}</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</Typography>
            </Box>
          ))}
        </Box>

        {/* Tabs */}
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', fontSize: 13, minHeight: 40 } }}
        >
          <Tab label={`我的共创 ${collabs.length}`} />
          <Tab label={`邀请我的 ${incoming.length}`} />
          <Tab label={`我邀请的 ${outgoing.length}`} />
          <Tab label="推荐合作" />
        </Tabs>

        {/* 我的共创 */}
        {tab === 0 && (
          collabs.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <HandshakeRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography sx={{ fontSize: 14, color: 'text.disabled' }}>暂无进行中的共创</Typography>
              <Button onClick={() => setTab(3)} sx={{ mt: 1, textTransform: 'none', fontSize: 13 }}>去推荐合作中寻找</Button>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {collabs.map((c) => {
                const tm = TYPE_META[c.type];
                const sm = STATUS_META[c.status];
                return (
                  <Box key={c.id} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                      <PartnerAvatar partner={c.partner} size={44} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>@{c.partner.name}</Typography>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: tm.bg, color: tm.color, fontSize: 10, fontWeight: 700 }}>
                            {tm.icon}{tm.label}
                          </Box>
                          <Box sx={{ px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: c.status === 'declined' ? 'action.hover': sm.bg, color: c.status === 'declined' ? 'text.disabled' : sm.color, fontSize: 10, fontWeight: 700 }}>{sm.label}</Box>
                        </Box>
                        <Typography sx={{ fontSize: 11, color: 'text.disabled' }} suppressHydrationWarning>
                          {c.partner.niche} · {formatNum(c.partner.fans)} 粉丝 · 最近 <RelativeTime ts={c.lastActivityAt} fallback="" />
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>我的分成</Typography>
                        <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'primary.main' }}>{c.revenueSplit}%</Typography>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: 13, color: 'text.primary', mb: 1.5 }}>{c.topic}</Typography>
                    <Box sx={{ mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>项目进度</Typography>
                        <Box sx={{ flex: 1 }} />
                        <Typography sx={{ fontSize: 11, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>{c.progress}%</Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={c.progress}
                        sx={{ height: 4, borderRadius: 1, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)' } }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, mb: 1.5, fontSize: 11, color: 'text.disabled' }}>
                      <Box>联合播放: <strong style={{ color: '#25F4EE' }}>{formatNum(c.jointViews)}</strong></Box>
                      <Box>累计收益: <strong style={{ color: '#FFB400' }}>{c.totalEarnings.toLocaleString()} 钻</strong></Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => setDetailCollab(c)} sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, borderColor: 'divider', color: 'text.secondary' }}>
                        查看详情
                      </Button>
                      <Button size="small" variant="outlined" startIcon={<ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />} onClick={handleMessage} sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, borderColor: 'divider', color: 'text.secondary' }}>
                        私信
                      </Button>
                      <Box sx={{ flex: 1 }} />
                      {c.status === 'active' && (
                        <Button size="small" onClick={() => handleEndCollab(c.id)} sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>
                          结束共创
                        </Button>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )
        )}

        {/* 邀请我的 */}
        {tab === 1 && (
          incoming.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled', fontSize: 13 }}>暂无收到的邀请</Box>
          ) : (
            <Stack spacing={1.5}>
              {incoming.map((inv) => {
                const tm = TYPE_META[inv.type];
                return (
                  <Box key={inv.id} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <PartnerAvatar partner={inv.partner} size={44} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>@{inv.partner.name}</Typography>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: tm.bg, color: tm.color, fontSize: 10, fontWeight: 700 }}>
                            {tm.icon}{tm.label}
                          </Box>
                          <Tooltip title="匹配度">
                            <Box sx={{ px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(93, 219, 150, 0.12)', color: '#5DDB96', fontSize: 10, fontWeight: 700 }}>
                              匹配 {inv.partner.matchScore}%
                            </Box>
                          </Tooltip>
                          <Typography sx={{ fontSize: 11, color: 'text.disabled', ml: 'auto' }} suppressHydrationWarning>
                            <RelativeTime ts={inv.createdAt} fallback="" />
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 11, color: 'text.disabled', mb: 1 }}>
                          {inv.partner.niche} · {formatNum(inv.partner.fans)} 粉丝
                        </Typography>
                        <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: 'action.hover', mb: 1.5 }}>
                          <Typography sx={{ fontSize: 12, color: 'text.primary', lineHeight: 1.5 }}>{inv.message}</Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.disabled', mt: 0.5 }}>
                            提议分成: 我 <strong style={{ color: '#FFB400' }}>{inv.revenueSplit}%</strong> / 对方 {100 - inv.revenueSplit}%
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small" variant="contained" startIcon={<CheckCircleRoundedIcon sx={{ fontSize: 14 }} />}
                            onClick={() => handleAcceptInvite(inv.id)}
                            sx={{
                              textTransform: 'none', fontSize: 12, borderRadius: 1.5,
                              background: 'linear-gradient(90deg, #5DDB96 0%, #25F4EE 100%)',
                              '&:hover': { background: 'linear-gradient(90deg, #5DDB96 0%, #25F4EE 100%)', filter: 'brightness(1.1)' },
                            }}
                          >
                            接受
                          </Button>
                          <Button
                            size="small" variant="outlined" startIcon={<CancelRoundedIcon sx={{ fontSize: 14 }} />}
                            onClick={() => handleDeclineInvite(inv.id)}
                            sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, borderColor: 'divider', color: 'text.secondary' }}
                          >
                            拒绝
                          </Button>
                          <Button size="small" onClick={() => handleViewProfile(inv.partner.name)} sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>
                            查看主页
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )
        )}

        {/* 我邀请的 */}
        {tab === 2 && (
          outgoing.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: 'text.disabled', fontSize: 13 }}>暂无发出的邀请</Box>
          ) : (
            <Stack spacing={1.5}>
              {outgoing.map((inv) => {
                const tm = TYPE_META[inv.type];
                return (
                  <Box key={inv.id} sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <PartnerAvatar partner={inv.partner} size={40} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>@{inv.partner.name}</Typography>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: tm.bg, color: tm.color, fontSize: 10, fontWeight: 700 }}>
                            {tm.icon}{tm.label}
                          </Box>
                          <Box sx={{ px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: 'rgba(255, 180, 0, 0.12)', color: '#FFB400', fontSize: 10, fontWeight: 700 }}>等待回复</Box>
                        </Box>
                        <Typography sx={{ fontSize: 11, color: 'text.disabled' }} suppressHydrationWarning>{inv.message.slice(0, 60)} · 发送于 <RelativeTime ts={inv.createdAt} fallback="" /></Typography>
                      </Box>
                      <Button size="small" onClick={() => handleCancelOutgoing(inv.id)} sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>撤回</Button>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )
        )}

        {/* 推荐合作 */}
        {tab === 3 && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TextField
                size="small"
                placeholder="搜索创作者名称或领域"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                      </InputAdornment>
                    ),
                  },
                }}
                sx={{ width: 280, '& .MuiOutlinedInput-root': { fontSize: 13 } }}
              />
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                基于你的内容方向与受众重合度推荐
              </Typography>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 1.5 }}>
              {recFiltered.map((p) => (
                <Box
                  key={p.id}
                  sx={{
                    p: 2, borderRadius: 2, bgcolor: 'background.paper',
                    border: '1px solid', borderColor: 'divider',
                    transition: 'border-color 0.15s, transform 0.15s',
                    '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <PartnerAvatar partner={p} size={48} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        @{p.name}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{p.niche}</Typography>
                    </Box>
                    <Tooltip title="基于受众/内容方向匹配度">
                      <Chip
                        label={`匹配 ${p.matchScore}%`}
                        size="small"
                        sx={{
                          fontSize: 10, fontWeight: 700, height: 20,
                          bgcolor: p.matchScore >= 85 ? 'rgba(93, 219, 150, 0.12)' : 'rgba(255, 180, 0, 0.12)',
                          color: p.matchScore >= 85 ? '#5DDB96' : '#FFB400',
                        }}
                      />
                    </Tooltip>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, fontSize: 11, color: 'text.secondary', mb: 1.5 }}>
                    <Box>{formatNum(p.fans)} 粉丝</Box>
                    {p.verified && <Box sx={{ color: '#1DA1F2' }}>✓ 已认证</Box>}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    <Button
                      size="small" variant="contained" fullWidth
                      startIcon={<HandshakeRoundedIcon sx={{ fontSize: 14 }} />}
                      onClick={() => setInviteTarget(p)}
                      sx={{
                        textTransform: 'none', fontSize: 12, borderRadius: 1.5,
                        background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                        '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
                      }}
                    >
                      邀请共创
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleViewProfile(p.name)} sx={{ textTransform: 'none', fontSize: 12, borderRadius: 1.5, borderColor: 'divider', color: 'text.secondary' }}>
                      主页
                    </Button>
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}

        {/* 邀请对话框 */}
        <InviteDialog partner={inviteTarget} onClose={() => setInviteTarget(null)} onSend={handleSendInvite} />

        {/* 共创详情 Drawer */}
        <CollabDetailDrawer collab={detailCollab} onClose={() => setDetailCollab(null)} onEnd={handleEndCollab} />

        <Snackbar
          open={!!snack}
          autoHideDuration={2200}
          onClose={() => setSnack(null)}
          message={snack}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        />
      </Box>
    </Box>
  );
}

function InviteDialog({
  partner, onClose, onSend,
}: {
  partner: Partner | null;
  onClose: () => void;
  onSend: (partner: Partner, type: CollabType, split: number, message: string, projectId: string, role: string) => void;
}) {
  const [type, setType] = useState<CollabType>('jointPost');
  const [split, setSplit] = useState(50);
  const [message, setMessage] = useState('');
  const [projectId, setProjectId] = useState('');
  const [role, setRole] = useState('');

  React.useEffect(() => {
    if (partner) {
      setType('jointPost');
      setSplit(50);
      setMessage('');
      setProjectId('');
      setRole('');
    }
  }, [partner?.id]);

  if (!partner) return null;
  const tm = TYPE_META[type];

  return (
    <Dialog
      open={!!partner}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: { sx: { bgcolor: 'background.paper', backgroundImage: 'none' } } }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>邀请共创</Typography>
        <IconButton size="small" onClick={onClose}><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', mb: 2.5 }}>
          <PartnerAvatar partner={partner} size={44} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>@{partner.name}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
              {partner.niche} · {formatNum(partner.fans)} 粉丝 · 匹配 {partner.matchScore}%
            </Typography>
          </Box>
        </Box>

        <Stack spacing={2.5}>
          <Box>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>共创类型</Typography>
            <Stack direction="row" spacing={1}>
              {(['jointPost', 'assetShare', 'topicCollab'] as CollabType[]).map((t) => {
                const m = TYPE_META[t];
                return (
                  <Box
                    key={t}
                    onClick={() => setType(t)}
                    sx={{
                      flex: 1, p: 1.25, borderRadius: 1, cursor: 'pointer', textAlign: 'center',
                      bgcolor: type === t ? m.bg : 'action.hover',
                      color: type === t ? m.color : 'text.secondary',
                      border: '1px solid', borderColor: type === t ? m.color : 'transparent',
                    }}
                  >
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12, fontWeight: 600 }}>
                      {m.icon}{m.label}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
            <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.75 }}>{tm.desc}</Typography>
          </Box>

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>收益分成 (我的占比)</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'primary.main' }}>
                {split}% / {100 - split}%
              </Typography>
            </Box>
            <Slider
              value={split} onChange={(_, v) => setSplit(v as number)}
              min={20} max={80} step={5} marks
              sx={{ color: 'primary.main' }}
            />
          </Box>

          <TextField
            label="项目 ID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            fullWidth
            placeholder="例如: 2026-summer-collab"
            sx={{ '& .MuiInputBase-root': { fontSize: 13 } }}
          />

          <TextField
            label="角色"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            fullWidth
            placeholder="例如: 拍摄 / 剪辑 / 文案"
            sx={{ '& .MuiInputBase-root': { fontSize: 13 } }}
          />

          <TextField
            label="共创说明 / 合作意向"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 200))}
            fullWidth multiline minRows={3} maxRows={5}
            placeholder="例如:想合拍一期户外骑行 vlog,我负责拍摄,你负责剪辑..."
            slotProps={{ htmlInput: { maxLength: 200 }, formHelperText: { sx: { fontSize: 10 } } }}
            helperText={`${message.length}/200`}
          />
        </Stack>
      </Box>
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none', borderRadius: 1.5 }}>取消</Button>
        <Button
          variant="contained" disabled={!message.trim() || !projectId.trim() || !role.trim()}
          onClick={() => onSend(partner, type, split, message.trim(), projectId.trim(), role.trim())}
          sx={{
            textTransform: 'none', borderRadius: 1.5,
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
            '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
          }}
        >
          发送邀请
        </Button>
      </Box>
    </Dialog>
  );
}

function CollabDetailDrawer({
  collab, onClose, onEnd,
}: {
  collab: Collaboration | null;
  onClose: () => void;
  onEnd: (id: number) => void;
}) {
  if (!collab) return null;
  const tm = TYPE_META[collab.type];

  return (
    <Drawer
      anchor="right"
      open={!!collab}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 480 }, bgcolor: 'background.paper' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>共创详情</Typography>
        <IconButton onClick={onClose} size="small"><CloseRoundedIcon sx={{ fontSize: 18 }} /></IconButton>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PartnerAvatar partner={collab.partner} size={56} />
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700 }}>@{collab.partner.name}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{collab.partner.niche} · {formatNum(collab.partner.fans)} 粉丝</Typography>
            </Box>
          </Box>

          <Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>共创主题</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{collab.topic}</Typography>
          </Box>

          <Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1 }}>类型 & 分成</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ flex: 1, p: 1.5, borderRadius: 1.5, bgcolor: tm.bg, color: tm.color }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 13, fontWeight: 700 }}>{tm.icon}{tm.label}</Box>
              </Box>
              <Box sx={{ flex: 1, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>我的分成</Typography>
                <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'primary.main' }}>{collab.revenueSplit}%</Typography>
              </Box>
            </Box>
          </Box>

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>项目进度</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{collab.progress}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate" value={collab.progress}
              sx={{ height: 6, borderRadius: 1, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)' } }}
            />
          </Box>

          <Divider />

          <Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1 }}>累计数据</Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>联合作品播放量</Typography>
                <Typography sx={{ fontWeight: 700, color: '#25F4EE' }}>{formatNum(collab.jointViews)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>我的累计收益</Typography>
                <Typography sx={{ fontWeight: 700, color: '#FFB400' }}>{collab.totalEarnings.toLocaleString()} 钻</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>合作天数</Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  {Math.floor((Date.now() - collab.startedAt) / 86400000)} 天
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Box>
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5 }}>
        <Button color="error" onClick={() => onEnd(collab.id)} sx={{ textTransform: 'none' }}>结算并结束</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" onClick={onClose} sx={{ textTransform: 'none', borderRadius: 1.5 }}>关闭</Button>
      </Box>
    </Drawer>
  );
}
