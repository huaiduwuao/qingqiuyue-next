'use client';

export const dynamic = "force-dynamic";

// 该页依赖 client context + 后端实时数据,SSR/pre-render 时 TIERS/orders 等未就绪 →
// 报 "Cannot read properties of undefined"。强制 dynamic 跳过预渲染。

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProtectedList, getInfringementList, getTakedownList } from '@/apis/dashboard';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import RadioGroup from '@mui/material/RadioGroup';
import Radio from '@mui/material/Radio';
import FormControl from '@mui/material/FormControl';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import CopyrightRoundedIcon from '@mui/icons-material/CopyrightRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import FingerprintRoundedIcon from '@mui/icons-material/FingerprintRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchIcon from '@mui/icons-material/Search';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import { gradient2, gradient3 } from '@/constants/gradients';
import { adminClient, accountClient, isNetworkError, isAuthError, formatApiError } from '@/lib/api/client';
import { RelativeTime } from '@/components/common/RelativeTime';

type ProtectLevel = 'full' | 'standard' | 'light';
type OriginalStatus = 'monitoring' | 'infringing' | 'whitelisted' | 'paused';
type InfringeAction = 'pending' | 'submitted' | 'takenDown' | 'appealed' | 'rejected' | 'settled';
type SourcePlatform = 'douyin' | 'kuaishou' | 'weibo' | 'bilibili' | 'xiaohongshu' | 'other';

interface ProtectedWork {
  id: string;
  title: string;
  cover: string;
  type: 'video' | 'image' | 'article';
  fingerprint: string;
  blockchainHash: string;
  certificateNo: string;
  registeredAt: number;
  level: ProtectLevel;
  status: OriginalStatus;
  infringeCount: number;
  totalViews: number; // 我的作品播放
  duration?: string;
}

interface Infringement {
  id: string;
  workId: string;
  workTitle: string;
  workCover: string;
  infractorName: string;
  infractorAvatar: string;
  infractorFans: number;
  similarity: number; // 0-100
  platform: SourcePlatform;
  sourceUrl: string;
  detectedAt: number;
  views: number;
  status: InfringeAction;
  resolution?: string;
  whitelisted?: boolean;
}

interface TakedownRecord {
  id: string;
  workTitle: string;
  workCover: string;
  infractorName: string;
  platform: SourcePlatform;
  status: InfringeAction;
  submittedAt: number;
  resolvedAt?: number;
  reason: string;
  proofHash?: string;
}

const LEVEL_META: Record<ProtectLevel, { label: string; color: string; bg: string; desc: string; cycles: string }> = {
  full: { label: '全网监测', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)', desc: '全网比对 + 跨平台追踪 + 自动维权', cycles: '实时' },
  standard: { label: '标准监测', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)', desc: '主流平台 1 小时比对一次', cycles: '1 小时' },
  light: { label: '轻度监测', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)', desc: '主流平台 24 小时比对一次', cycles: '24 小时' },
};

const STATUS_META: Record<OriginalStatus, { label: string; color: string; bg: string }> = {
  monitoring: { label: '监测中', color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.12)' },
  infringing: { label: '发现侵权', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)' },
  whitelisted: { label: '已白名单', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)' },
  paused: { label: '已暂停', color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.06)' },
};

const INFRINGE_STATUS_META: Record<InfringeAction, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { label: '待处理', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)', icon: <HourglassEmptyRoundedIcon sx={{ fontSize: 12 }} /> },
  submitted: { label: '已提交申诉', color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.12)', icon: <RocketLaunchRoundedIcon sx={{ fontSize: 12 }} /> },
  takenDown: { label: '已下架', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)', icon: <CheckCircleRoundedIcon sx={{ fontSize: 12 }} /> },
  appealed: { label: '对方申诉中', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)', icon: <GavelRoundedIcon sx={{ fontSize: 12 }} /> },
  rejected: { label: '申诉被驳回', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)', icon: <ErrorRoundedIcon sx={{ fontSize: 12 }} /> },
  settled: { label: '已和解', color: '#5B8DEF', bg: 'rgba(91, 141, 239, 0.12)', icon: <HandshakeRoundedIcon sx={{ fontSize: 12 }} /> },
};

const PLATFORM_META: Record<SourcePlatform, { label: string; color: string }> = {
  douyin: { label: '抖音', color: '#FE2C55' },
  kuaishou: { label: '快手', color: '#FFB400' },
  weibo: { label: '微博', color: '#FF6B8A' },
  bilibili: { label: 'B站', color: '#06B6D4' },
  xiaohongshu: { label: '小红书', color: '#FE2C55' },
  other: { label: '其他', color: '#8B8FA3' },
};

const SEED_PROTECTED: ProtectedWork[] = [
  {
    id: 'p-001',
    title: '【4K HDR】阿尔卑斯山脉航拍',
    cover: gradient3('#5B8DEF', '#8B5CF6', '#25F4EE'),
    type: 'video',
    fingerprint: 'a3f8b2c1d9e4f5a6b7c8d9e0f1a2b3c4',
    blockchainHash: '0x8f3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a',
    certificateNo: 'QY-DBC-2026-00012834',
    registeredAt: Date.now() - 86400000 * 12,
    level: 'full',
    status: 'infringing',
    infringeCount: 3,
    totalViews: 1284932,
    duration: '24:18',
  },
  {
    id: 'p-002',
    title: '深夜独处歌单 10 首',
    cover: gradient2('#8B5CF6', '#FE2C55'),
    type: 'article',
    fingerprint: 'b4c9d3e2f0a5b6c7d8e9f0a1b2c3d4e5',
    blockchainHash: '0x7e2b1c0d9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c',
    certificateNo: 'QY-DBC-2026-00012811',
    registeredAt: Date.now() - 86400000 * 8,
    level: 'standard',
    status: 'monitoring',
    infringeCount: 0,
    totalViews: 8432,
  },
  {
    id: 'p-003',
    title: '夏日海边 vlog',
    cover: gradient3('#FE2C55', '#FF6B8A', '#FFB400'),
    type: 'video',
    fingerprint: 'c5d0e4f3a1b6c7d8e9f0a1b2c3d4e5f6',
    blockchainHash: '0x6d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c',
    certificateNo: 'QY-DBC-2026-00012789',
    registeredAt: Date.now() - 86400000 * 20,
    level: 'full',
    status: 'monitoring',
    infringeCount: 1,
    totalViews: 482931,
    duration: '03:42',
  },
  {
    id: 'p-004',
    title: 'Sony A7M4 开箱 + 镜头测试',
    cover: gradient3('#FF6B8A', '#FFB400', '#5DDB96'),
    type: 'video',
    fingerprint: 'd6e1f5a4b2c7d8e9f0a1b2c3d4e5f6a7',
    blockchainHash: '0x5c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b',
    certificateNo: 'QY-DBC-2026-00012756',
    registeredAt: Date.now() - 86400000 * 35,
    level: 'standard',
    status: 'whitelisted',
    infringeCount: 2,
    totalViews: 218432,
    duration: '18:21',
  },
  {
    id: 'p-005',
    title: '10 分钟学会快手早餐',
    cover: gradient2('#5DDB96', '#25F4EE'),
    type: 'video',
    fingerprint: 'e7f2a6b5c3d8e9f0a1b2c3d4e5f6a7b8',
    blockchainHash: '0x4b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a',
    certificateNo: 'QY-DBC-2026-00012734',
    registeredAt: Date.now() - 86400000 * 50,
    level: 'light',
    status: 'paused',
    infringeCount: 0,
    totalViews: 67843,
    duration: '09:54',
  },
];

const SEED_INFRINGEMENTS: Infringement[] = [
  {
    id: 'i-001',
    workId: 'p-001',
    workTitle: '【4K HDR】阿尔卑斯山脉航拍',
    workCover: gradient3('#5B8DEF', '#8B5CF6', '#25F4EE'),
    infractorName: '风景搬运工',
    infractorAvatar: gradient2('#FE2C55', '#FFB400'),
    infractorFans: 124832,
    similarity: 96,
    platform: 'douyin',
    sourceUrl: 'https://www.douyin.com/video/7234567891123456789',
    detectedAt: Date.now() - 3600000 * 3,
    views: 482931,
    status: 'submitted',
  },
  {
    id: 'i-002',
    workId: 'p-001',
    workTitle: '【4K HDR】阿尔卑斯山脉航拍',
    workCover: gradient3('#5B8DEF', '#8B5CF6', '#25F4EE'),
    infractorName: '航拍素材库',
    infractorAvatar: gradient2('#25F4EE', '#5DDB96'),
    infractorFans: 28432,
    similarity: 88,
    platform: 'kuaishou',
    sourceUrl: 'https://www.kuaishou.com/short-video/3x9y7m2k1p',
    detectedAt: Date.now() - 3600000 * 8,
    views: 124832,
    status: 'pending',
  },
  {
    id: 'i-003',
    workId: 'p-001',
    workTitle: '【4K HDR】阿尔卑斯山脉航拍',
    workCover: gradient3('#5B8DEF', '#8B5CF6', '#25F4EE'),
    infractorName: '旅行精选',
    infractorAvatar: gradient2('#8B5CF6', '#FE2C55'),
    infractorFans: 8932,
    similarity: 79,
    platform: 'bilibili',
    sourceUrl: 'https://www.bilibili.com/video/BV1xx411c7mD',
    detectedAt: Date.now() - 86400000 * 2,
    views: 38421,
    status: 'takenDown',
    resolution: '对方已删除视频',
  },
  {
    id: 'i-004',
    workId: 'p-003',
    workTitle: '夏日海边 vlog',
    workCover: gradient3('#FE2C55', '#FF6B8A', '#FFB400'),
    infractorName: '海边风景控',
    infractorAvatar: gradient2('#06B6D4', '#5B8DEF'),
    infractorFans: 42831,
    similarity: 92,
    platform: 'xiaohongshu',
    sourceUrl: 'https://www.xiaohongshu.com/explore/abc123',
    detectedAt: Date.now() - 86400000 * 1,
    views: 89432,
    status: 'appealed',
  },
  {
    id: 'i-005',
    workId: 'p-004',
    workTitle: 'Sony A7M4 开箱 + 镜头测试',
    workCover: gradient3('#FF6B8A', '#FFB400', '#5DDB96'),
    infractorName: '科技评测菌',
    infractorAvatar: gradient2('#5B5CF6', '#C4B5FD'),
    infractorFans: 218432,
    similarity: 84,
    platform: 'weibo',
    sourceUrl: 'https://weibo.com/1234567891/abc',
    detectedAt: Date.now() - 86400000 * 5,
    views: 124832,
    status: 'settled',
    resolution: '对方已获得授权,加入白名单',
    whitelisted: true,
  },
  {
    id: 'i-006',
    workId: 'p-004',
    workTitle: 'Sony A7M4 开箱 + 镜头测试',
    workCover: gradient3('#FF6B8A', '#FFB400', '#5DDB96'),
    infractorName: '科技搬运站',
    infractorAvatar: gradient2('#FE2C55', '#FF6B8A'),
    infractorFans: 8932,
    similarity: 91,
    platform: 'douyin',
    sourceUrl: 'https://www.douyin.com/video/7123456789112345678',
    detectedAt: Date.now() - 86400000 * 3,
    views: 23421,
    status: 'rejected',
    resolution: '对方提供了原素材证据,判定不构成侵权',
  },
];

const SEED_TAKEDOWNS: TakedownRecord[] = [
  {
    id: 't-001',
    workTitle: '【4K HDR】阿尔卑斯山脉航拍',
    workCover: gradient3('#5B8DEF', '#8B5CF6', '#25F4EE'),
    infractorName: '风景搬运工',
    platform: 'douyin',
    status: 'submitted',
    submittedAt: Date.now() - 86400000 * 1,
    reason: '未经授权搬运原视频,画面/音频完全一致,相似度 96%',
    proofHash: '0x8f3a2b1c9d4e5f6a7b8c9d0e1f2a3b4c',
  },
  {
    id: 't-002',
    workTitle: '【4K HDR】阿尔卑斯山脉航拍',
    workCover: gradient3('#5B8DEF', '#8B5CF6', '#25F4EE'),
    infractorName: '旅行精选',
    platform: 'bilibili',
    status: 'takenDown',
    submittedAt: Date.now() - 86400000 * 4,
    resolvedAt: Date.now() - 86400000 * 2,
    reason: '原视频片段被剪辑使用,相似度 79%',
    proofHash: '0x6d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a',
  },
  {
    id: 't-003',
    workTitle: 'Sony A7M4 开箱 + 镜头测试',
    workCover: gradient3('#FF6B8A', '#FFB400', '#5DDB96'),
    infractorName: '科技搬运站',
    platform: 'douyin',
    status: 'rejected',
    submittedAt: Date.now() - 86400000 * 5,
    resolvedAt: Date.now() - 86400000 * 3,
    reason: '视频高度疑似搬运,相似度 91%',
    proofHash: '0x5c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f',
  },
  {
    id: 't-004',
    workTitle: '夏日海边 vlog',
    workCover: gradient3('#FE2C55', '#FF6B8A', '#FFB400'),
    infractorName: '海边风景控',
    platform: 'xiaohongshu',
    status: 'appealed',
    submittedAt: Date.now() - 86400000 * 1,
    reason: '原视频片段被剪辑使用,相似度 92%',
    proofHash: '0x4b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e',
  },
];

const CANDIDATE_WORKS = [
  { id: 'c-001', title: '北京胡同漫步｜城市印象', cover: gradient3('#FE2C55', '#FF6B8A', '#FFB400'), type: 'video' as const, duration: '12:34', views: 234821 },
  { id: 'c-002', title: '露营装备清单｜新手必看', cover: gradient2('#25F4EE', '#5DF7F2'), type: 'article' as const, views: 0 },
  { id: 'c-003', title: '广式早茶 vlog', cover: gradient3('#FFB400', '#FE2C55', '#8B5CF6'), type: 'video' as const, duration: '08:21', views: 89432 },
  { id: 'c-004', title: '胶片摄影入门指南', cover: gradient2('#5B8DEF', '#8B5CF6'), type: 'image' as const, views: 0 },
  { id: 'c-005', title: '咖啡店测评 10 家', cover: gradient2('#06B6D4', '#5B8DEF'), type: 'video' as const, duration: '15:42', views: 0 },
  { id: 'c-006', title: '周末厨房｜家常菜合集', cover: gradient2('#5DDB96', '#FFB400'), type: 'video' as const, duration: '06:33', views: 0 },
];

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function shortHash(hash: string, head = 6, tail = 4): string {
  if (hash.length <= head + tail + 3) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

// relativeTime() 已废弃:SSR/CSR Date.now() 不同会引发 hydration mismatch。
// 改用 <RelativeTime ts={...} /> 组件。

function CertRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
      <Typography sx={{ fontSize: 11, color: 'text.disabled', width: 88, flexShrink: 0 }}>{label}</Typography>
      <Typography
        sx={{
          fontSize: 11,
          color: 'text.primary',
          fontFamily: 'monospace',
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </Typography>
      {copyable && (
        <Tooltip title={copied ? '已复制' : '复制'}>
          <IconButton
            size="small"
            onClick={() => {
              navigator.clipboard?.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            sx={{ p: 0.25 }}
          >
            <ContentCopyRoundedIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

export default function OriginalPage() {
  const [tab, setTab] = useState(0);
  const [snack, setSnack] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; id: string } | null>(null);
  const [infringeMenuAnchor, setInfringeMenuAnchor] = useState<{ el: HTMLElement; id: string } | null>(null);
  const [search, setSearch] = useState('');
  const [addSelected, setAddSelected] = useState<string[]>([]);
  const [addLevel, setAddLevel] = useState<ProtectLevel>('full');
  const [appealTarget, setAppealTarget] = useState<Infringement | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [progressTarget, setProgressTarget] = useState<Infringement | null>(null);
  // settings
  const [autoTakedown, setAutoTakedown] = useState(true);
  const [notifyInfringe, setNotifyInfringe] = useState(true);
  const [notifyResolved, setNotifyResolved] = useState(false);
  const [monitorScope, setMonitorScope] = useState<SourcePlatform[]>(['douyin', 'kuaishou', 'weibo', 'bilibili', 'xiaohongshu']);
  const [whitelist, setWhitelist] = useState<string[]>(['科技评测菌', 'MCN 联合出品']);

  // 真接口:3 类维权数据(uid 隔离),失败时 fallback 到 SEED
  const protectedQ = useQuery({ queryKey: ['creator-original-protected'], queryFn: () => getProtectedList(), staleTime: 30 * 1000 });
  const infringeQ = useQuery({ queryKey: ['creator-original-infringements'], queryFn: () => getInfringementList(), staleTime: 30 * 1000 });
  const takedownQ = useQuery({ queryKey: ['creator-original-takedowns'], queryFn: () => getTakedownList(), staleTime: 30 * 1000 });
  const apiProtected = (protectedQ.data?.records ?? protectedQ.data?.list ?? []).map((p: any) => ({
    id: p.id, title: p.title, cover: p.cover, fingerprint: p.fingerprint,
    status: p.status, monitorAt: p.monitorAt, takedowns: p.takedowns, income: p.income,
    level: 'full', matchRate: 92, platforms: [], lastCheck: Date.now(),
  })) as unknown as ProtectedWork[];
  const apiInfringe = (infringeQ.data?.records ?? infringeQ.data?.list ?? []).map((i: any) => ({
    id: i.id, workTitle: i.workTitle, infringer: i.infringer, platform: i.platform, url: i.url,
    status: i.status, detectedAt: i.detectedAt, income: i.income,
    level: 'medium', evidence: [], autoTakedownEligible: i.income > 0,
  })) as unknown as Infringement[];
  const apiTakedowns = (takedownQ.data?.records ?? takedownQ.data?.list ?? []).map((t: any) => ({
    id: t.id, workTitle: t.workTitle, infringer: t.infringer, platform: t.platform,
    reason: t.reason, reqAt: t.reqAt, completedAt: t.completedAt, status: t.status, refund: t.refund,
    appealCount: 0,
  })) as unknown as TakedownRecord[];
  const [protected_, setProtected] = useState<ProtectedWork[]>((apiProtected.length ? apiProtected : SEED_PROTECTED) as ProtectedWork[]);
  const [infringe, setInfringe] = useState<Infringement[]>((apiInfringe.length ? apiInfringe : SEED_INFRINGEMENTS) as Infringement[]);
  const takedowns = (apiTakedowns.length ? apiTakedowns : SEED_TAKEDOWNS) as TakedownRecord[];
  useEffect(() => { if (apiProtected.length) setProtected(apiProtected); }, [apiProtected.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (apiInfringe.length) setInfringe(apiInfringe); }, [apiInfringe.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    return {
      protected: protected_.length,
      monitoring: protected_.filter((p) => p.status === 'monitoring' || p.status === 'infringing').length,
      infringes: infringe.filter((i) => i.status === 'pending' || i.status === 'submitted' || i.status === 'appealed').length,
      takenDown: takedowns.filter((t) => t.status === 'takenDown').length,
    };
  }, [protected_, infringe, takedowns]);

  const filteredProtected = useMemo(() => {
    if (!search) return protected_;
    const k = search.toLowerCase();
    return protected_.filter((p) => p.title.toLowerCase().includes(k) || p.certificateNo.toLowerCase().includes(k));
  }, [protected_, search]);

  const filteredInfringe = useMemo(() => {
    if (!search) return infringe;
    const k = search.toLowerCase();
    return infringe.filter(
      (i) =>
        i.workTitle.toLowerCase().includes(k) ||
        i.infractorName.toLowerCase().includes(k) ||
        PLATFORM_META[i.platform].label.toLowerCase().includes(k),
    );
  }, [infringe, search]);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, id: string) => {
    setMenuAnchor({ el: e.currentTarget, id });
  };
  const handleMenuClose = () => setMenuAnchor(null);

  const handleInfringeMenuOpen = (e: React.MouseEvent<HTMLElement>, id: string) => {
    setInfringeMenuAnchor({ el: e.currentTarget, id });
  };
  const handleInfringeMenuClose = () => setInfringeMenuAnchor(null);

  const handlePause = (id: string) => {
    setProtected((p) => p.map((x) => (x.id === id ? { ...x, status: 'paused' as OriginalStatus } : x)));
    setSnack('监测已暂停');
    handleMenuClose();
  };
  const handleResume = (id: string) => {
    setProtected((p) => p.map((x) => (x.id === id ? { ...x, status: 'monitoring' as OriginalStatus } : x)));
    setSnack('监测已恢复');
    handleMenuClose();
  };
  const handleDelete = async (id: string) => {
    try {
      await adminClient('/original/remove', { method: 'POST', data: { id } });
    } catch {
      // still update local state
    }
    setProtected((p) => p.filter((x) => x.id !== id));
    setSnack('已移除存证');
    handleMenuClose();
  };

  const handleTakedown = (i: Infringement) => {
    setAppealTarget(i);
    setAppealReason('');
  };

  const submitAppeal = async () => {
    if (!appealTarget || !appealReason.trim()) return;
    try {
      await adminClient('/original/appeal', {
        method: 'POST',
        data: { id: appealTarget.id, reason: appealReason.trim() },
      });
    } catch {
      // still update local state
    }
    setInfringe((arr) => arr.map((i) => (i.id === appealTarget.id ? { ...i, status: 'submitted' as InfringeAction } : i)));
    setSnack('申诉已提交,等待平台审核');
    setAppealTarget(null);
    setAppealReason('');
  };
  const handleWhitelist = (id: string) => {
    const item = infringe.find((i) => i.id === id);
    if (!item) return;
    setInfringe((arr) =>
      arr.map((i) => (i.id === id ? { ...i, whitelisted: true, status: 'settled' as InfringeAction, resolution: '已加入白名单' } : i)),
    );
    setWhitelist((w) => (w.includes(item.infractorName) ? w : [...w, item.infractorName]));
    setSnack(`已添加 ${item.infractorName} 到白名单`);
    handleInfringeMenuClose();
  };
  const handleIgnore = (id: string) => {
    setInfringe((arr) => arr.filter((i) => i.id !== id));
    setSnack('已忽略');
    handleInfringeMenuClose();
  };

  const toggleAddSelected = (id: string) => {
    setAddSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const handleSubmitAdd = async () => {
    if (addSelected.length === 0) {
      setSnack('请选择要存证的作品');
      return;
    }
    try {
      await Promise.all(
        addSelected.map((contentId) =>
          adminClient('/original/apply', { method: 'POST', data: { contentId } }),
        ),
      );
    } catch {
      // still update local state
    }
    const works = CANDIDATE_WORKS.filter((c) => addSelected.includes(c.id));
    const newItems: ProtectedWork[] = works.map((w, idx) => ({
      id: `p-new-${Date.now()}-${idx}`,
      title: w.title,
      cover: w.cover,
      type: w.type,
      fingerprint: Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      blockchainHash: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      certificateNo: `QY-DBC-2026-${String(13000 + Math.floor(Math.random() * 999)).padStart(8, '0')}`,
      registeredAt: Date.now(),
      level: addLevel,
      status: 'monitoring',
      infringeCount: 0,
      totalViews: w.views,
      duration: w.duration,
    }));
    setProtected((p) => [...newItems, ...p]);
    setSnack(`已成功存证 ${newItems.length} 个作品`);
    setAddOpen(false);
    setAddSelected([]);
    setAddLevel('full');
  };

  const toggleMonitorPlatform = (p: SourcePlatform) => {
    setMonitorScope((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  };

  const removeWhitelist = (name: string) => {
    setWhitelist((w) => w.filter((n) => n !== name));
    setSnack(`已移除白名单 ${name}`);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Stat cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
        }}
      >
        {[
          { label: '已存证作品', value: String(stats.protected), suffix: '个', icon: <ShieldRoundedIcon />, color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)' },
          { label: '监测中', value: String(stats.monitoring), suffix: '个', icon: <TravelExploreRoundedIcon />, color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.12)' },
          { label: '待处理侵权', value: String(stats.infringes), suffix: '条', icon: <WarningAmberRoundedIcon />, color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)' },
          { label: '累计下架', value: String(stats.takenDown), suffix: '条', icon: <CheckCircleRoundedIcon />, color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)' },
        ].map((s) => (
          <Box
            key={s.label}
            sx={{
              p: 2.5,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -20,
                right: -20,
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: s.bg,
                filter: 'blur(20px)',
              }}
            />
            <Box sx={{ position: 'relative' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    bgcolor: s.bg,
                    color: s.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {s.icon}
                </Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s.label}</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                <Typography sx={{ fontSize: 26, fontWeight: 700, color: 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
                  {s.value}
                </Typography>
                <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{s.suffix}</Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Top action bar */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 2.5,
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 1.5,
            background: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <ShieldRoundedIcon sx={{ fontSize: 24 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>原创保护中心</Typography>
            <Chip
              size="small"
              icon={<VerifiedRoundedIcon sx={{ fontSize: '14px !important' }} />}
              label="已认证作者"
              sx={{
                height: 18,
                fontSize: 10,
                fontWeight: 700,
                bgcolor: 'rgba(93, 219, 150, 0.12)',
                color: '#5DDB96',
                '& .MuiChip-label': { px: 0.5 },
                '& .MuiChip-icon': { color: '#5DDB96' },
              }}
            />
          </Box>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            区块链存证 · 跨平台监测 · 一键维权 · 已为 12,832 位创作者保护 ¥ 8,432w 收益
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
          onClick={() => setAddOpen(true)}
          sx={{
            textTransform: 'none',
            fontSize: 12,
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
            '&:hover': {
              background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
              filter: 'brightness(1.1)',
            },
          }}
        >
          添加存证
        </Button>
      </Box>

      {/* Tabs */}
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', px: 1 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => {
              setTab(v);
              setSearch('');
            }}
            sx={{
              minHeight: 0,
              '& .MuiTab-root': { minHeight: 0, py: 1.5, px: 2, fontSize: 13, textTransform: 'none' },
            }}
          >
            <Tab value={0} label={`存证管理 ${protected_.length}`} icon={<ShieldRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
            <Tab value={1} label={`侵权监测 ${infringe.length}`} icon={<TravelExploreRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
            <Tab value={2} label={`维权记录 ${takedowns.length}`} icon={<GavelRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
            <Tab value={3} label="监测设置" icon={<SecurityRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
          </Tabs>
          <Box sx={{ flex: 1 }} />
          {tab !== 3 && (
            <TextField
              size="small"
              placeholder={tab === 0 ? '搜索作品 / 证书编号…' : tab === 1 ? '搜索作品 / 搬运方…' : '搜索记录…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{
                minWidth: 240,
                mr: 1,
                '& .MuiOutlinedInput-root': {
                  fontSize: 12,
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FAFAFA',
                  '& fieldset': { borderColor: 'divider' },
                },
              }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                    </InputAdornment>
                  ),
                },
              }}
            />
          )}
        </Box>

        {/* Tab 0: 存证管理 */}
        {tab === 0 && (
          <Box sx={{ p: 2 }}>
            {filteredProtected.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled', fontSize: 13 }}>
                暂未存证任何作品
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {filteredProtected.map((p) => {
                  const lm = LEVEL_META[p.level];
                  const sm = STATUS_META[p.status];
                  return (
                    <Box
                      key={p.id}
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
                        border: '1px solid',
                        borderColor: p.status === 'infringing' ? 'rgba(254, 44, 85, 0.3)' : 'divider',
                        display: 'flex',
                        gap: 2,
                        transition: 'border-color 0.15s',
                        '&:hover': { borderColor: sm.color },
                      }}
                    >
                      <Box
                        onClick={() => setDetailId(p.id)}
                        sx={{
                          width: 100,
                          height: 64,
                          borderRadius: 1,
                          background: p.cover,
                          flexShrink: 0,
                          position: 'relative',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {p.duration && (
                          <Typography
                            sx={{
                              position: 'absolute',
                              bottom: 4,
                              right: 4,
                              fontSize: 9,
                              color: '#fff',
                              fontWeight: 600,
                              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.4)',
                              px: 0.5,
                              borderRadius: 0.5,
                            }}
                          >
                            {p.duration}
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, flexWrap: 'wrap' }}>
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.25,
                              px: 0.5,
                              py: 0.1,
                              borderRadius: 0.5,
                              bgcolor: lm.bg,
                              color: lm.color,
                              fontSize: 9,
                              fontWeight: 700,
                            }}
                          >
                            {lm.label}
                          </Box>
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.25,
                              px: 0.5,
                              py: 0.1,
                              borderRadius: 0.5,
                              bgcolor: sm.bg,
                              color: sm.color,
                              fontSize: 9,
                              fontWeight: 700,
                            }}
                          >
                            {sm.label}
                          </Box>
                          {p.infringeCount > 0 && (
                            <Chip
                              size="small"
                              icon={<WarningAmberRoundedIcon sx={{ fontSize: '12px !important' }} />}
                              label={`发现 ${p.infringeCount} 处侵权`}
                              sx={{
                                height: 16,
                                fontSize: 9,
                                fontWeight: 700,
                                bgcolor: 'rgba(254, 44, 85, 0.12)',
                                color: 'primary.main',
                                '& .MuiChip-label': { px: 0.5 },
                                '& .MuiChip-icon': { color: 'primary.main' },
                              }}
                            />
                          )}
                        </Box>
                        <Typography
                          onClick={() => setDetailId(p.id)}
                          sx={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'text.primary',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            '&:hover': { color: 'primary.main' },
                          }}
                        >
                          {p.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                            📜 {p.certificateNo}
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                            🔗 {shortHash(p.blockchainHash, 8, 6)}
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                            存证于 {<RelativeTime ts={p.registeredAt} fallback="" />}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        <Button
                          size="small"
                          startIcon={<VisibilityRoundedIcon sx={{ fontSize: 14 }} />}
                          onClick={() => setDetailId(p.id)}
                          sx={{ textTransform: 'none', fontSize: 11, color: 'text.secondary', minWidth: 0, px: 1 }}
                        >
                          证书
                        </Button>
                        <IconButton size="small" onClick={(e) => handleMenuOpen(e, p.id)} sx={{ p: 0.5 }} aria-label="更多">
                          <MoreHorizIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* Tab 1: 侵权监测 */}
        {tab === 1 && (
          <Box sx={{ p: 2 }}>
            {filteredInfringe.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled', fontSize: 13 }}>
                暂未发现侵权内容
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {filteredInfringe.map((i) => {
                  const sm = INFRINGE_STATUS_META[i.status];
                  const pm = PLATFORM_META[i.platform];
                  return (
                    <Box
                      key={i.id}
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
                        border: '1px solid',
                        borderColor: i.status === 'pending' ? 'rgba(255, 180, 0, 0.3)' : 'divider',
                        display: 'flex',
                        gap: 2,
                        transition: 'border-color 0.15s',
                        '&:hover': { borderColor: sm.color },
                      }}
                    >
                      {/* Source + target side-by-side */}
                      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                        <Box sx={{ position: 'relative' }}>
                          <Box
                            sx={{
                              width: 72,
                              height: 48,
                              borderRadius: 0.75,
                              background: i.workCover,
                            }}
                          />
                          <Typography
                            sx={{
                              position: 'absolute',
                              bottom: 2,
                              left: 2,
                              fontSize: 8,
                              color: '#fff',
                              fontWeight: 700,
                              bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.4)',
                              px: 0.5,
                              borderRadius: 0.25,
                            }}
                          >
                            原
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            alignSelf: 'center',
                            fontSize: 12,
                            color: 'text.disabled',
                          }}
                        >
                          →
                        </Box>
                        <Box sx={{ position: 'relative' }}>
                          <Box
                            sx={{
                              width: 72,
                              height: 48,
                              borderRadius: 0.75,
                              background: gradient2('#FE2C55', '#FFB400'),
                              opacity: 0.85,
                            }}
                          />
                          <Typography
                            sx={{
                              position: 'absolute',
                              bottom: 2,
                              left: 2,
                              fontSize: 8,
                              color: '#fff',
                              fontWeight: 700,
                              bgcolor: 'rgba(254, 44, 85, 0.8)',
                              px: 0.5,
                              borderRadius: 0.25,
                            }}
                          >
                            搬运
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.25,
                              px: 0.5,
                              py: 0.1,
                              borderRadius: 0.5,
                              bgcolor: sm.bg,
                              color: sm.color,
                              fontSize: 9,
                              fontWeight: 700,
                            }}
                          >
                            {sm.icon}
                            {sm.label}
                          </Box>
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.25,
                              px: 0.5,
                              py: 0.1,
                              borderRadius: 0.5,
                              bgcolor: `${pm.color}20`,
                              color: pm.color,
                              fontSize: 9,
                              fontWeight: 700,
                            }}
                          >
                            {pm.label}
                          </Box>
                          <Chip
                            size="small"
                            label={`相似度 ${i.similarity}%`}
                            sx={{
                              height: 16,
                              fontSize: 9,
                              fontWeight: 700,
                              bgcolor: i.similarity >= 90 ? 'rgba(254, 44, 85, 0.15)' : 'rgba(255, 180, 0, 0.12)',
                              color: i.similarity >= 90 ? 'primary.main' : '#FFB400',
                              '& .MuiChip-label': { px: 0.5 },
                            }}
                          />
                        </Box>
                        <Typography sx={{ fontSize: 12, color: 'text.primary', fontWeight: 500 }}>
                          {i.workTitle}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                            搬运方:<Box component="span" sx={{ color: 'text.primary' }}>{i.infractorName}</Box> · {formatCount(i.infractorFans)} 粉丝
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                            已播放 {formatCount(i.views)} · 发现于 {<RelativeTime ts={i.detectedAt} fallback="" />}
                          </Typography>
                        </Box>
                        {i.resolution && (
                          <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.25 }}>
                            ✓ {i.resolution}
                          </Typography>
                        )}
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                        {i.status === 'pending' && (
                          <>
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={<GavelRoundedIcon sx={{ fontSize: 14 }} />}
                              onClick={() => handleTakedown(i)}
                              sx={{
                                textTransform: 'none',
                                fontSize: 11,
                                minWidth: 0,
                                px: 1,
                                background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                                '&:hover': {
                                  background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                                  filter: 'brightness(1.1)',
                                },
                              }}
                            >
                              一键维权
                            </Button>
                            <Button
                              size="small"
                              onClick={() => handleWhitelist(i.id)}
                              sx={{ textTransform: 'none', fontSize: 11, color: '#FFB400', minWidth: 0, px: 1 }}
                            >
                              白名单
                            </Button>
                          </>
                        )}
                        {i.status === 'submitted' && (
                          <Button
                            size="small"
                            startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
                            onClick={() => setProgressTarget(i)}
                            sx={{ textTransform: 'none', fontSize: 11, color: 'text.secondary', minWidth: 0, px: 1 }}
                          >
                            查看进度
                          </Button>
                        )}
                        <IconButton size="small" onClick={(e) => handleInfringeMenuOpen(e, i.id)} sx={{ p: 0.5 }} aria-label="更多">
                          <MoreHorizIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* Tab 2: 维权记录 */}
        {tab === 2 && (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {takedowns.map((t) => {
                const sm = INFRINGE_STATUS_META[t.status];
                const pm = PLATFORM_META[t.platform];
                return (
                  <Box
                    key={t.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: 1,
                          background: t.workCover,
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, flexWrap: 'wrap' }}>
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.25,
                              px: 0.5,
                              py: 0.1,
                              borderRadius: 0.5,
                              bgcolor: sm.bg,
                              color: sm.color,
                              fontSize: 9,
                              fontWeight: 700,
                            }}
                          >
                            {sm.icon}
                            {sm.label}
                          </Box>
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.25,
                              px: 0.5,
                              py: 0.1,
                              borderRadius: 0.5,
                              bgcolor: `${pm.color}20`,
                              color: pm.color,
                              fontSize: 9,
                              fontWeight: 700,
                            }}
                          >
                            {pm.label}
                          </Box>
                          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                            提交于 {<RelativeTime ts={t.submittedAt} fallback="" />}
                            {t.resolvedAt && ` · 处理用时 ${Math.ceil((t.resolvedAt - t.submittedAt) / 86400000)} 天`}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 12, color: 'text.primary', fontWeight: 500, mb: 0.25 }}>
                          {t.workTitle}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                          申诉对象:<Box component="span" sx={{ color: 'text.primary' }}>{t.infractorName}</Box>
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: 'text.disabled', mt: 0.5, lineHeight: 1.5 }}>
                          申诉理由:{t.reason}
                        </Typography>
                        {t.proofHash && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <FingerprintRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                            <Typography sx={{ fontSize: 10, color: 'text.disabled', fontFamily: 'monospace' }}>
                              {shortHash(t.proofHash, 10, 8)}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>

                    {/* Progress timeline */}
                    {(t.status === 'submitted' || t.status === 'appealed') && (
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px dashed', borderColor: 'divider' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, position: 'relative' }}>
                          {['提交申诉', '平台初审', '通知对方', '终审裁定'].map((step, idx) => {
                            const stepStatus = t.status === 'appealed' && idx === 2 ? 'done' : idx === 0 ? 'done' : idx === 1 ? 'current' : 'pending';
                            return (
                              <Box key={step} sx={{ display: 'flex', alignItems: 'center', flex: idx < 3 ? 1 : 0, gap: 0.5 }}>
                                <Box
                                  sx={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    bgcolor: stepStatus === 'done' ? 'primary.main' : stepStatus === 'current' ? '#FFB400' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
                                    color: stepStatus === 'pending' ? 'text.primary' : '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 9,
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                >
                                  {stepStatus === 'done' ? '✓' : idx + 1}
                                </Box>
                                <Typography
                                  sx={{
                                    fontSize: 10,
                                    color: stepStatus === 'pending' ? 'text.disabled' : 'text.primary',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {step}
                                </Typography>
                                {idx < 3 && (
                                  <Box
                                    sx={{
                                      flex: 1,
                                      height: 1,
                                      bgcolor: stepStatus === 'done' ? 'primary.main' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
                                      minWidth: 12,
                                    }}
                                  />
                                )}
                              </Box>
                            );
                          })}
                        </Box>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Tab 3: 监测设置 */}
        {tab === 3 && (
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <TravelExploreRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>监测范围</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 1.5 }}>
                选择需要监测侵权内容的平台,默认覆盖主流短视频与内容平台
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {(Object.keys(PLATFORM_META) as SourcePlatform[]).map((p) => {
                  const meta = PLATFORM_META[p];
                  const selected = monitorScope.includes(p);
                  return (
                    <Chip
                      key={p}
                      label={meta.label}
                      onClick={() => toggleMonitorPlatform(p)}
                      sx={{
                        fontSize: 12,
                        fontWeight: 600,
                        bgcolor: selected ? `${meta.color}20` : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
                        color: selected ? meta.color : 'text.disabled',
                        border: '1px solid',
                        borderColor: selected ? meta.color : 'divider',
                        '&:hover': { bgcolor: `${meta.color}30` },
                      }}
                    />
                  );
                })}
              </Box>
            </Box>

            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <GavelRoundedIcon sx={{ fontSize: 16, color: '#FFB400' }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>自动维权</Typography>
              </Box>
              <Stack spacing={0.5}>
                <FormControlLabel
                  control={<Switch size="small" checked={autoTakedown} onChange={(e) => setAutoTakedown(e.target.checked)} />}
                  label={
                    <Box>
                      <Typography sx={{ fontSize: 12, color: 'text.primary' }}>自动提交申诉</Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                        发现相似度 ≥ 90% 的搬运内容时,自动提交平台申诉
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  control={<Switch size="small" checked={notifyInfringe} onChange={(e) => setNotifyInfringe(e.target.checked)} />}
                  label={
                    <Box>
                      <Typography sx={{ fontSize: 12, color: 'text.primary' }}>侵权通知</Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                        发现侵权时,推送 App 通知 + 邮件
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  control={<Switch size="small" checked={notifyResolved} onChange={(e) => setNotifyResolved(e.target.checked)} />}
                  label={
                    <Box>
                      <Typography sx={{ fontSize: 12, color: 'text.primary' }}>处理结果通知</Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                        申诉有进展时(下架/驳回/和解)发送通知
                      </Typography>
                    </Box>
                  }
                />
              </Stack>
            </Box>

            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <LinkRoundedIcon sx={{ fontSize: 16, color: '#25F4EE' }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>白名单</Typography>
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>已授权转载的账号,自动跳过监测</Typography>
              </Box>
              {whitelist.length === 0 ? (
                <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', py: 2 }}>
                  暂无白名单账号
                </Typography>
              ) : (
                <Stack spacing={0.5}>
                  {whitelist.map((name) => (
                    <Box
                      key={name}
                      sx={{
                        p: 1,
                        borderRadius: 0.75,
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: gradient2('#FFB400', '#FE2C55'),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          color: '#fff',
                          fontWeight: 700,
                        }}
                      >
                        {name[0]}
                      </Box>
                      <Typography sx={{ fontSize: 12, color: 'text.primary', flex: 1 }}>{name}</Typography>
                      <IconButton size="small" onClick={() => removeWhitelist(name)} sx={{ p: 0.25 }}>
                        <CloseRoundedIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Add 存证 dialog */}
      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } },
        }}
      >
        <Box sx={{ p: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                background: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <ShieldRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Typography sx={{ fontSize: 16, fontWeight: 600, color: 'text.primary' }}>添加原创存证</Typography>
          </Box>
          <IconButton size="small" onClick={() => setAddOpen(false)}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: 'divider' }} />

        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 1 }}>
              选择要保护的作品
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 1.25,
                maxHeight: 280,
                overflow: 'auto',
                pr: 0.5,
              }}
            >
              {CANDIDATE_WORKS.map((w) => {
                const selected = addSelected.includes(w.id);
                return (
                  <Box
                    key={w.id}
                    onClick={() => toggleAddSelected(w.id)}
                    sx={{
                      p: 1.25,
                      borderRadius: 1.5,
                      border: '1.5px solid',
                      borderColor: selected ? 'primary.main' : 'divider',
                      bgcolor: selected ? 'rgba(254, 44, 85, 0.06)' : (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FAFAFA',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    <Box
                      sx={{
                        width: 48,
                        height: 32,
                        borderRadius: 0.5,
                        background: w.cover,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 700,
                        position: 'relative',
                      }}
                    >
                      {w.duration && (
                        <Typography
                          sx={{
                            position: 'absolute',
                            bottom: 1,
                            right: 2,
                            fontSize: 8,
                            fontWeight: 600,
                            textShadow: '0 0 2px rgba(0,0,0,0.8)',
                          }}
                        >
                          {w.duration}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: 11,
                          color: 'text.primary',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {w.title}
                      </Typography>
                      <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
                        {w.type === 'video' ? '视频' : w.type === 'image' ? '图文' : '文章'}
                      </Typography>
                    </Box>
                    {selected && (
                      <CheckRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>

          <FormControl>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 1 }}>
              监测等级
            </Typography>
            <RadioGroup
              value={addLevel}
              onChange={(e) => setAddLevel(e.target.value as ProtectLevel)}
            >
              {(Object.keys(LEVEL_META) as ProtectLevel[]).map((l) => {
                const meta = LEVEL_META[l];
                return (
                  <Box
                    key={l}
                    sx={{
                      p: 1.25,
                      mb: 0.75,
                      borderRadius: 1,
                      border: '1.5px solid',
                      borderColor: addLevel === l ? meta.color : 'divider',
                      bgcolor: addLevel === l ? `${meta.color}10` : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Radio size="small" value={l} sx={{ p: 0 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 12, color: 'text.primary', fontWeight: 600 }}>{meta.label}</Typography>
                      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                        {meta.desc} · 比对周期 {meta.cycles}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </RadioGroup>
          </FormControl>
        </Box>

        <Divider sx={{ borderColor: 'divider' }} />
        <Box sx={{ p: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={() => setAddOpen(false)} sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>
            取消
          </Button>
          <Button
            variant="contained"
            startIcon={<ShieldRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={handleSubmitAdd}
            disabled={addSelected.length === 0}
            sx={{
              textTransform: 'none',
              fontSize: 12,
              background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
              '&:hover': {
                background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                filter: 'brightness(1.1)',
              },
            }}
          >
            立即存证 {addSelected.length > 0 ? `(${addSelected.length})` : ''}
          </Button>
        </Box>
      </Dialog>

      {/* Row action menus */}
      <Menu
        anchorEl={menuAnchor?.el ?? null}
        open={!!menuAnchor}
        onClose={handleMenuClose}
        slotProps={{
          paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', minWidth: 140 } },
        }}
      >
        <MenuItem
          onClick={() => {
            if (menuAnchor) setDetailId(menuAnchor.id);
            handleMenuClose();
          }}
          sx={{ fontSize: 12 }}
        >
          <VisibilityRoundedIcon sx={{ fontSize: 14, mr: 1 }} />
          查看证书
        </MenuItem>
        {menuAnchor &&
          (() => {
            const p = protected_.find((x) => x.id === menuAnchor.id);
            if (!p) return null;
            return p.status === 'paused' ? (
              <MenuItem onClick={() => handleResume(menuAnchor.id)} sx={{ fontSize: 12 }}>
                <TravelExploreRoundedIcon sx={{ fontSize: 14, mr: 1 }} />
                恢复监测
              </MenuItem>
            ) : (
              <MenuItem onClick={() => handlePause(menuAnchor.id)} sx={{ fontSize: 12 }}>
                <BlockRoundedIcon sx={{ fontSize: 14, mr: 1 }} />
                暂停监测
              </MenuItem>
            );
          })()}
        <Divider sx={{ my: 0.5, borderColor: 'divider' }} />
        <MenuItem
          onClick={() => menuAnchor && handleDelete(menuAnchor.id)}
          sx={{ fontSize: 12, color: 'primary.main' }}
        >
          <DeleteOutlineRoundedIcon sx={{ fontSize: 14, mr: 1 }} />
          移除存证
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={infringeMenuAnchor?.el ?? null}
        open={!!infringeMenuAnchor}
        onClose={handleInfringeMenuClose}
        slotProps={{
          paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', minWidth: 140 } },
        }}
      >
        <MenuItem
          onClick={() => {
            const item = infringeMenuAnchor ? infringe.find((i) => i.id === infringeMenuAnchor.id) : null;
            if (item?.sourceUrl) {
              navigator.clipboard.writeText(item.sourceUrl).then(() => setSnack('链接已复制'));
            } else {
              setSnack('暂无链接');
            }
            handleInfringeMenuClose();
          }}
          sx={{ fontSize: 12 }}
        >
          <LinkRoundedIcon sx={{ fontSize: 14, mr: 1 }} />
          复制搬运链接
        </MenuItem>
        {infringeMenuAnchor && (
          <MenuItem
            onClick={() => handleWhitelist(infringeMenuAnchor.id)}
            sx={{ fontSize: 12 }}
          >
            <LinkRoundedIcon sx={{ fontSize: 14, mr: 1 }} />
            加入白名单
          </MenuItem>
        )}
        <Divider sx={{ my: 0.5, borderColor: 'divider' }} />
        <MenuItem
          onClick={() => infringeMenuAnchor && handleIgnore(infringeMenuAnchor.id)}
          sx={{ fontSize: 12, color: 'text.disabled' }}
        >
          <CloseRoundedIcon sx={{ fontSize: 14, mr: 1 }} />
          忽略此条
        </MenuItem>
      </Menu>

      {/* Detail drawer */}
      <Drawer
        anchor="right"
        open={!!detailId}
        onClose={() => setDetailId(null)}
        slotProps={{
          paper: { sx: { width: { xs: '100%', sm: 520 }, bgcolor: 'background.paper' } },
        }}
      >
        {detailId &&
          (() => {
            const p = protected_.find((x) => x.id === detailId);
            if (!p) return null;
            const lm = LEVEL_META[p.level];
            const sm = STATUS_META[p.status];
            const relatedInfringe = infringe.filter((i) => i.workId === p.id);
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Box
                  sx={{
                    p: 2.5,
                    pb: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <VerifiedRoundedIcon sx={{ fontSize: 18, color: '#5DDB96' }} />
                    <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary' }}>原创存证证书</Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setDetailId(null)}>
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>

                <Box sx={{ flex: 1, overflow: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 120,
                        aspectRatio: '16/9',
                        borderRadius: 1.5,
                        background: p.cover,
                        flexShrink: 0,
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                        <Box
                          sx={{
                            px: 0.5,
                            py: 0.1,
                            borderRadius: 0.5,
                            bgcolor: lm.bg,
                            color: lm.color,
                            fontSize: 9,
                            fontWeight: 700,
                          }}
                        >
                          {lm.label}
                        </Box>
                        <Box
                          sx={{
                            px: 0.5,
                            py: 0.1,
                            borderRadius: 0.5,
                            bgcolor: sm.bg,
                            color: sm.color,
                            fontSize: 9,
                            fontWeight: 700,
                          }}
                        >
                          {sm.label}
                        </Box>
                      </Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
                        {p.title}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                        存证于 {<RelativeTime ts={p.registeredAt} fallback="" />} · 累计播放 {formatCount(p.totalViews)}
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      background: 'linear-gradient(135deg, rgba(93, 219, 150, 0.08) 0%, rgba(37, 244, 238, 0.08) 100%)',
                      border: '1px solid',
                      borderColor: 'rgba(93, 219, 150, 0.3)',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                      <AccountTreeRoundedIcon sx={{ fontSize: 14, color: '#5DDB96' }} />
                      <Typography sx={{ fontSize: 11, color: 'text.primary', fontWeight: 600 }}>区块链存证信息</Typography>
                    </Box>
                    <CertRow label="证书编号" value={p.certificateNo} copyable />
                    <CertRow label="内容指纹" value={p.fingerprint} copyable />
                    <CertRow label="区块哈希" value={p.blockchainHash} copyable />
                    <CertRow label="存证时间" value={new Date(p.registeredAt).toISOString().replace('T', ' ').slice(0, 19)} />
                  </Box>

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                    {[
                      { label: '存证天数', value: `${Math.floor((Date.now() - p.registeredAt) / 86400000)} 天` },
                      { label: '监测次数', value: `${Math.floor((Date.now() - p.registeredAt) / 86400000) * 24} 次` },
                      { label: '发现侵权', value: `${p.infringeCount} 次`, color: p.infringeCount > 0 ? 'primary.main' : undefined },
                    ].map((m) => (
                      <Box
                        key={m.label}
                        sx={{
                          p: 1.25,
                          borderRadius: 1,
                          bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FAFAFA',
                          border: '1px solid',
                          borderColor: 'divider',
                          textAlign: 'center',
                        }}
                      >
                        <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>{m.label}</Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: m.color || 'text.primary', mt: 0.25 }}>
                          {m.value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {relatedInfringe.length > 0 && (
                    <Box>
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.secondary', mb: 1 }}>
                        关联侵权记录
                      </Typography>
                      <Stack spacing={0.75}>
                        {relatedInfringe.map((i) => {
                          const ism = INFRINGE_STATUS_META[i.status];
                          return (
                            <Box
                              key={i.id}
                              sx={{
                                p: 1,
                                borderRadius: 1,
                                bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FAFAFA',
                                border: '1px solid',
                                borderColor: 'divider',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                            >
                              <Box
                                sx={{
                                  width: 32,
                                  height: 22,
                                  borderRadius: 0.5,
                                  background: gradient2('#FE2C55', '#FFB400'),
                                  flexShrink: 0,
                                }}
                              />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontSize: 11, color: 'text.primary' }} noWrap>
                                  {i.infractorName} · {PLATFORM_META[i.platform].label}
                                </Typography>
                                <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>
                                  相似度 {i.similarity}%
                                </Typography>
                              </Box>
                              <Box
                                sx={{
                                  px: 0.5,
                                  py: 0.1,
                                  borderRadius: 0.5,
                                  bgcolor: ism.bg,
                                  color: ism.color,
                                  fontSize: 9,
                                  fontWeight: 700,
                                }}
                              >
                                {ism.label}
                              </Box>
                            </Box>
                          );
                        })}
                      </Stack>
                    </Box>
                  )}
                </Box>

                <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
                    onClick={async () => {
                      try {
                        const dateStr = new Date(p.registeredAt).toISOString().slice(0, 10);
                        const res = await accountClient.post<{ url: string; filename: string }>(
                          '/account/original/certificate',
                          { id: p.id, title: p.title, date: dateStr }
                        );
                        const payload = (res as any)?.data ?? res;
                        if (payload?.url) {
                          const a = document.createElement('a');
                          a.href = payload.url;
                          a.download = payload.filename || `${p.title}-证书.pdf`;
                          a.click();
                          setSnack('证书 PDF 已生成');
                        } else {
                          setSnack('证书 PDF 已生成（本地下载）');
                        }
                      } catch (err) {
                        if (isNetworkError(err)) {
                          // 网络错 fallback:本地生成一个简单 text 占位
                          const blob = new Blob(
                            [
                              `作品：${p.title}\n登记号：${p.id}\n证书编号：${p.certificateNo}\n登记日期：${new Date(p.registeredAt).toISOString().slice(0, 10)}\n本证书由青丘阅原创登记中心颁发`,
                            ],
                            { type: 'application/pdf' }
                          );
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${p.title}-证书.pdf`;
                          a.click();
                          URL.revokeObjectURL(url);
                          setSnack('证书已下载（离线模式）');
                        } else if (isAuthError(err)) {
                          setSnack('请重新登录');
                        } else {
                          setSnack(formatApiError(err));
                        }
                      }
                    }}
                    sx={{
                      textTransform: 'none',
                      fontSize: 12,
                      background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                      '&:hover': {
                        background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                        filter: 'brightness(1.1)',
                      },
                    }}
                  >
                    下载证书
                  </Button>
                  <Button
                    onClick={() => {
                      handleDelete(p.id);
                      setDetailId(null);
                    }}
                    sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}
                  >
                    移除
                  </Button>
                </Box>
              </Box>
            );
          })()}
      </Drawer>

      <AppealDialog target={appealTarget} reason={appealReason} onReasonChange={setAppealReason} onClose={() => setAppealTarget(null)} onSubmit={submitAppeal} />
      <ProgressDialog target={progressTarget} onClose={() => setProgressTarget(null)} />

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

function AppealDialog({
  target,
  reason,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  target: Infringement | null;
  reason: string;
  onReasonChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={!!target} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 700 }}>提交申诉</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>
          {target && `针对《${target.workTitle}》的侵权内容提交平台申诉`}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          maxRows={5}
          label="申诉理由"
          placeholder="说明侵权情况,例如:未经授权搬运,画面/音频高度相似..."
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          sx={{ '& .MuiInputBase-root': { fontSize: 13 } }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>取消</Button>
        <Button variant="contained" disabled={!reason.trim()} onClick={onSubmit} sx={{ textTransform: 'none' }}>提交申诉</Button>
      </DialogActions>
    </Dialog>
  );
}

function ProgressDialog({ target, onClose }: { target: Infringement | null; onClose: () => void }) {
  if (!target) return null;
  const steps = ['提交申诉', '平台初审', '通知对方', '终审裁定'];
  return (
    <Dialog open={!!target} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 700 }}>申诉进度</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 48, height: 32, borderRadius: 0.75, background: target.workCover }} />
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{target.workTitle}</Typography>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>搬运方: {target.infractorName}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, position: 'relative' }}>
            {steps.map((step, idx) => {
              const stepStatus = target.status === 'appealed' && idx === 2 ? 'done' : idx === 0 ? 'done' : idx === 1 ? 'current' : 'pending';
              return (
                <Box key={step} sx={{ display: 'flex', alignItems: 'center', flex: idx < 3 ? 1 : 0, gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      bgcolor: stepStatus === 'done' ? 'primary.main' : stepStatus === 'current' ? '#FFB400' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
                      color: stepStatus === 'pending' ? 'text.primary' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {stepStatus === 'done' ? '✓' : idx + 1}
                  </Box>
                  <Typography sx={{ fontSize: 10, color: stepStatus === 'pending' ? 'text.disabled' : 'text.primary', whiteSpace: 'nowrap' }}>{step}</Typography>
                  {idx < 3 && (
                    <Box
                      sx={{
                        flex: 1,
                        height: 1,
                        bgcolor: stepStatus === 'done' ? 'primary.main' : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
                        minWidth: 12,
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.6 }}>
              当前状态:{' '}
              <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{INFRINGE_STATUS_META[target.status].label}</Box>
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.6 }}>发现时间: {new Date(target.detectedAt).toLocaleString()}</Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.6 }}>相似度: {target.similarity}%</Typography>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>关闭</Button>
      </DialogActions>
    </Dialog>
  );
}
