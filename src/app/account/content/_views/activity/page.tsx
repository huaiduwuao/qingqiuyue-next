'use client';

export const dynamic = "force-dynamic";

// 该页依赖 client context + 后端实时数据,SSR/pre-render 时 TIERS/orders 等未就绪 →
// 报 "Cannot read properties of undefined"。强制 dynamic 跳过预渲染。

import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getActivityList, getMyWorks, type Activity as ApiActivity } from '@/apis/dashboard';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Drawer from '@mui/material/Drawer';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import RedeemRoundedIcon from '@mui/icons-material/RedeemRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';

import { accountClient } from '@/lib/api/client';
  import {
  CATEGORY_META,
  type Activity,
  type ActivityCategory,
  type ActivitySubmission,
  type PrizeTier,
  type LeaderboardEntry,
  type MyWork,
  formatBigNumber,
  formatDuration,
  ensureArray,
} from './data';
import { parseRewardCny } from './helpers';
import { KpiCard } from './KpiCard';
import { ActivityCard } from './ActivityCard';
import { DetailDrawer, type DetailTabKey } from './DetailDrawer';

type FilterTab = 'all' | 'mine' | 'active' | 'signup' | 'upcoming' | 'won' | 'ended';
type CategoryFilter = 'all' | ActivityCategory;
type SortKey = 'heat' | 'deadline' | 'reward' | 'newest';

const TAB_DEFS: Array<{ id: FilterTab; label: string }> = [
  { id: 'all',      label: '全部活动' },
  { id: 'mine',     label: '我的活动' },
  { id: 'active',   label: '进行中' },
  { id: 'signup',   label: '报名中' },
  { id: 'upcoming', label: '即将开始' },
  { id: 'won',      label: '已获奖' },
  { id: 'ended',    label: '已结束' },
];

const SORT_DEFS: Array<{ id: SortKey; label: string }> = [
  { id: 'heat',     label: '人气最高' },
  { id: 'deadline', label: '即将截止' },
  { id: 'reward',   label: '奖金最高' },
  { id: 'newest',   label: '最新发布' },
];

export default function ActivityPage() {
  const [tab, setTab] = useState<FilterTab>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortKey>('heat');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTabKey>('detail');
  const [signupId, setSignupId] = useState<string | null>(null);
  const [signupAgreed, setSignupAgreed] = useState(false);
  const [submitId, setSubmitId] = useState<string | null>(null);
  const [submitSelected, setSubmitSelected] = useState<string[]>([]);
  const [submitCaption, setSubmitCaption] = useState('');
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'info' | 'warning' } | null>(null);

  // 真接口拉活动列表 + 我的可投稿作品
  const { data: actResp } = useQuery({
    queryKey: ['creator-activities', category],
    queryFn: () => getActivityList({ category: category === 'all' ? undefined : category }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  const { data: worksResp } = useQuery({
    queryKey: ['creator-my-works'],
    queryFn: () => getMyWorks(),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  // apiActivities 来自后端响应 + 字段补全,useMemo 锁住引用,避免每次 render 都生成
  // 新数组导致下方 setItems deps 变化而触发"Maximum update depth exceeded"无限循环。
  const apiActivities: Activity[] = React.useMemo(() => {
    // 后端不保证这些字段是数组(老 DTO 有时返 null/对象),用 ensureArray 兜底
    // —— 单纯 `?? []` 只挡 null/undefined,挡不住"传成字符串/对象"的情况
    // (eligibleWorks 的 .map/.some 已踩过这种雷)
    return (actResp?.records ?? actResp?.list ?? []).map((a: ApiActivity) => ({
      ...a,
      rules: ensureArray<string>(a.rules),
      requirements: ensureArray<string>(a.requirements),
      prizes: ensureArray<PrizeTier>(a.prizes),
      submissions: ensureArray<ActivitySubmission>(a.submissions),
      leaderboard: ensureArray<LeaderboardEntry>(a.leaderboard),
    }));
  }, [actResp]);
  // apiMyWorks 同理:hashtags 字段也要防御。后端没保证是数组
  const apiMyWorks: MyWork[] = (worksResp?.records ?? worksResp?.list ?? []).map((w: any) => ({
    ...w,
    hashtags: ensureArray<string>(w?.hashtags),
  }));
  // 本地 state 支持 optimistic update(报名/投稿后立即改 UI,不等下一次 refetch);
  // useEffect 依赖 memo 后的 apiActivities,引用稳定后只会在后端数据真变化时才 setItems。
  const [items, setItems] = useState<Activity[]>(apiActivities);
  useEffect(() => {
    setItems(apiActivities);
  }, [apiActivities]);

  const stats = useMemo(() => {
    const active = items.filter((a) => a.status === 'active').length;
    const mySigned = items.filter((a) =>
      ['signed', 'submitted', 'shortlist', 'won', 'lost'].includes(a.participation),
    ).length;
    const monthlyReward = items
      .filter((a) => a.participation === 'won' && a.myWonAt && a.myWonAt > Date.now() - 30 * 86400000)
      .reduce((sum, a) => sum + (parseRewardCny(a.myWonReward) || 0), 0);
    const totalWon = items
      .filter((a) => a.participation === 'won')
      .reduce((sum, a) => sum + (parseRewardCny(a.myWonReward) || 0), 0);
    return { active, mySigned, monthlyReward, totalWon };
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;

    if (tab === 'mine') {
      list = list.filter((a) =>
        ['signed', 'submitted', 'shortlist', 'won', 'lost'].includes(a.participation),
      );
    } else if (tab === 'won') {
      list = list.filter((a) => a.participation === 'won');
    } else if (tab === 'active') {
      list = list.filter((a) => a.status === 'active');
    } else if (tab === 'signup') {
      list = list.filter((a) => a.status === 'signup');
    } else if (tab === 'upcoming') {
      list = list.filter((a) => a.status === 'upcoming');
    } else if (tab === 'ended') {
      list = list.filter((a) => a.status === 'ended' || a.status === 'judging');
    }

    if (category !== 'all') {
      list = list.filter((a) => a.category === category);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.subtitle.toLowerCase().includes(q) ||
          a.organizer.toLowerCase().includes(q),
      );
    }

    const sorted = [...list];
    if (sort === 'heat') sorted.sort((a, b) => b.heat - a.heat);
    else if (sort === 'deadline') sorted.sort((a, b) => a.endAt - b.endAt);
    else if (sort === 'reward') sorted.sort((a, b) => b.totalRewardValue - a.totalRewardValue);
    else if (sort === 'newest') sorted.sort((a, b) => b.startAt - a.startAt);

    return sorted;
  }, [items, tab, category, sort, search]);

  const detail = useMemo(() => items.find((a) => a.id === detailId) ?? null, [items, detailId]);
  const signupTarget = useMemo(() => items.find((a) => a.id === signupId) ?? null, [items, signupId]);
  const submitTarget = useMemo(() => items.find((a) => a.id === submitId) ?? null, [items, submitId]);

  // 按活动要求里的 hashtag 粗筛 + 排序(已投过稿置后)
  const eligibleWorks = useMemo(() => {
    if (!submitTarget) return [] as MyWork[];
    const required = submitTarget.requirements
      .map((r) => r.match(/#[一-龥\w]+/g) || [])
      .flat()
      .map((h) => h.toLowerCase());
    if (required.length === 0) return apiMyWorks;
    const matched: MyWork[] = [];
    const rest: MyWork[] = [];
    for (const w of apiMyWorks) {
      const tags = w.hashtags.map((t) => t.toLowerCase());
      if (required.some((r) => tags.includes(r))) matched.push(w);
      else rest.push(w);
    }
    return [...matched, ...rest];
  }, [submitTarget, apiMyWorks]);

  const openSignup = (id: string) => { setSignupId(id); setSignupAgreed(false); };
  const closeSignup = () => { setSignupId(null); setSignupAgreed(false); };

  const confirmSignup = async () => {
    if (!signupTarget || !signupAgreed) return;
    try {
      await accountClient('/activity/signup', { method: 'POST', data: { activityId: signupTarget.id } });
      setItems((prev) =>
        prev.map((a) =>
          a.id === signupTarget.id
            ? { ...a, participation: 'signed', signupCount: a.signupCount + 1 }
            : a,
        ),
      );
      setSnack({ msg: `已成功报名《${signupTarget.title}》`, sev: 'success' });
      closeSignup();
    } catch (e) {
      setSnack({ msg: `报名失败:${e instanceof Error ? e.message : '网络异常'}`, sev: 'warning' });
    }
  };

  const openSubmit = (id: string) => { setSubmitId(id); setSubmitSelected([]); setSubmitCaption(''); };
  const closeSubmit = () => { setSubmitId(null); setSubmitSelected([]); setSubmitCaption(''); };

  const confirmSubmit = async () => {
    if (!submitTarget || submitSelected.length === 0) return;
    try {
      await accountClient('/activity/submit', { method: 'POST', data: { activityId: submitTarget.id } });
      const newSubs: ActivitySubmission[] = submitSelected.map((wid, idx) => {
        const w = apiMyWorks.find((x) => x.id === wid)!;
        return {
          id: `sub-${Date.now()}-${idx}`,
          workId: w.id,
          workTitle: w.title,
          workCover: w.cover,
          workDuration: w.duration,
          views: w.views,
          likes: w.likes,
          votes: Math.floor(w.likes * 0.6),
          submittedAt: Date.now(),
        };
      });
      setItems((prev) =>
        prev.map((a) =>
          a.id === submitTarget.id
            ? {
                ...a,
                participation: 'submitted',
                submissions: [...a.submissions, ...newSubs],
                submissionCount: a.submissionCount + newSubs.length,
              }
            : a,
        ),
      );
      setSnack({
        msg: `已提交 ${newSubs.length} 部作品到《${submitTarget.title}》`,
        sev: 'success',
      });
      closeSubmit();
    } catch (e) {
      setSnack({ msg: `投稿失败:${e instanceof Error ? e.message : '网络异常'}`, sev: 'warning' });
    }
  };

  const handleCopyLink = (id: string) => {
    if (!navigator.clipboard?.writeText) {
      setSnack({ msg: '复制失败,请手动复制链接', sev: 'warning' });
      return;
    }
    navigator.clipboard
      .writeText(`${window.location.origin}/activity/${id}`)
      .then(() => setSnack({ msg: '活动链接已复制,快邀好友一起来玩', sev: 'info' }))
      .catch(() => setSnack({ msg: '复制失败,请手动复制链接', sev: 'warning' }));
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Box
        sx={{
          p: 3,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
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
            <EmojiEventsIcon sx={{ fontSize: 18 }} />
          </Box>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary', flex: 1 }}>
            活动管理
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<NotificationsActiveRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={async () => {
              try {
                await accountClient('/activity/subscribe', { method: 'POST' });
                setSnack({ msg: '已开启活动提醒,新活动上线时第一时间通知', sev: 'success' });
              } catch (e) {
                setSnack({ msg: `订阅失败:${e instanceof Error ? e.message : '网络异常'}`, sev: 'warning' });
              }
            }}
            sx={{ textTransform: 'none', fontSize: 12 }}
          >
            活动订阅
          </Button>
        </Box>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
          浏览平台活动 · 报名参与 · 投稿作品 · 查看获奖
        </Typography>

        {/* KPI cards */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 1.5,
          }}
        >
          <KpiCard icon={<LocalFireDepartmentIcon />} label="进行中活动" value={stats.active.toString()} suffix="个" color="#FE2C55" bg="rgba(254, 44, 85, 0.12)" />
          <KpiCard icon={<HowToRegRoundedIcon />} label="我已参与" value={stats.mySigned.toString()} suffix="个" color="#25F4EE" bg="rgba(37, 244, 238, 0.12)" />
          <KpiCard icon={<RedeemRoundedIcon />} label="本月奖励" value={formatBigNumber(stats.monthlyReward)} suffix="元" color="#5DDB96" bg="rgba(93, 219, 150, 0.12)" />
          <KpiCard icon={<EmojiEventsRoundedIcon />} label="累计获奖" value={formatBigNumber(stats.totalWon)} suffix="元" color="#FFD700" bg="rgba(255, 215, 0, 0.12)" />
        </Box>
      </Box>

      {/* Tabs + toolbar */}
      <Box sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 36,
              flex: 1,
              minWidth: 280,
              '& .MuiTab-root': { minHeight: 36, fontSize: 13, textTransform: 'none', px: 1.5 },
              '& .MuiTabs-indicator': { bgcolor: 'primary.main', height: 2 },
            }}
          >
            {TAB_DEFS.map((t) => {
              const count =
                t.id === 'all' ? items.length
                : t.id === 'mine' ? items.filter((a) => ['signed', 'submitted', 'shortlist', 'won', 'lost'].includes(a.participation)).length
                : t.id === 'won' ? items.filter((a) => a.participation === 'won').length
                : t.id === 'active' ? items.filter((a) => a.status === 'active').length
                : t.id === 'signup' ? items.filter((a) => a.status === 'signup').length
                : t.id === 'upcoming' ? items.filter((a) => a.status === 'upcoming').length
                : items.filter((a) => a.status === 'ended' || a.status === 'judging').length;
              return (
                <Tab
                  key={t.id}
                  value={t.id}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {t.label}
                      <Box
                        component="span"
                        sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          px: 0.5,
                          py: 0.1,
                          borderRadius: 0.5,
                          bgcolor: tab === t.id ? 'rgba(254, 44, 85, 0.16)' : 'action.hover',
                          color: tab === t.id ? 'primary.main' : 'text.disabled',
                        }}
                      >
                        {count}
                      </Box>
                    </Box>
                  }
                />
              );
            })}
          </Tabs>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            placeholder="搜索活动名称 / 主办方"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ flex: 1, minWidth: 220, '& .MuiInputBase-root': { fontSize: 13 } }}
          />
          <Select
            size="small"
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryFilter)}
            startAdornment={
              <InputAdornment position="start">
                <CategoryRoundedIcon sx={{ fontSize: 14, color: 'text.disabled', mr: 0.5 }} />
              </InputAdornment>
            }
            sx={{ minWidth: 140, fontSize: 13, '& .MuiSelect-select': { display: 'flex', alignItems: 'center' } }}
          >
            <MenuItem value="all" sx={{ fontSize: 13 }}>全部类型</MenuItem>
            {(Object.keys(CATEGORY_META) as ActivityCategory[]).map((c) => (
              <MenuItem key={c} value={c} sx={{ fontSize: 13 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: CATEGORY_META[c].color }} />
                  {CATEGORY_META[c].label}
                </Box>
              </MenuItem>
            ))}
          </Select>
          <Select
            size="small"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            startAdornment={
              <InputAdornment position="start">
                <SortRoundedIcon sx={{ fontSize: 14, color: 'text.disabled', mr: 0.5 }} />
              </InputAdornment>
            }
            sx={{ minWidth: 140, fontSize: 13 }}
          >
            {SORT_DEFS.map((s) => (
              <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13 }}>{s.label}</MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      {/* Activity grid */}
      {filtered.length === 0 ? (
        <Box sx={{ p: 6, borderRadius: 2, bgcolor: 'background.paper', border: '1px dashed', borderColor: 'divider', textAlign: 'center' }}>
          <EmojiEventsIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
            没有符合条件的活动 — 试试切换筛选或清空搜索词
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          {filtered.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              onOpen={() => { setDetailId(a.id); setDetailTab('detail'); }}
              onSignup={() => openSignup(a.id)}
              onSubmit={() => openSubmit(a.id)}
              onCopyLink={() => handleCopyLink(a.id)}
            />
          ))}
        </Box>
      )}

      {/* Detail Drawer */}
      <Drawer
        anchor="right"
        open={!!detail}
        onClose={() => setDetailId(null)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', md: 720 },
              bgcolor: 'background.default',
              borderLeft: '1px solid',
              borderColor: 'divider',
            },
          },
        }}
      >
        {detail && (
          <DetailDrawer
            activity={detail}
            tab={detailTab}
            onTabChange={setDetailTab}
            onClose={() => setDetailId(null)}
            onSignup={() => openSignup(detail.id)}
            onSubmit={() => openSubmit(detail.id)}
            onCopyLink={() => handleCopyLink(detail.id)}
          />
        )}
      </Drawer>

      {/* Sign-up dialog */}
      <Dialog
        open={!!signupTarget}
        onClose={closeSignup}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } } }}
      >
        {signupTarget && (
          <>
            <DialogTitle sx={{ fontSize: 16, fontWeight: 700, pb: 1 }}>报名《{signupTarget.title}》</DialogTitle>
            <DialogContent sx={{ pb: 1 }}>
              <Box sx={{ p: 1.5, mb: 2, borderRadius: 1.5, bgcolor: 'rgba(254, 44, 85, 0.08)', border: '1px solid', borderColor: 'rgba(254, 44, 85, 0.2)' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'primary.main', mb: 0.5 }}>奖项总额</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>{signupTarget.totalReward}</Typography>
              </Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', mb: 1 }}>报名前请阅读活动规则</Typography>
              <Box component="ul" sx={{ pl: 2, m: 0, mb: 2 }}>
                {signupTarget.rules.map((r, i) => (
                  <Typography key={i} component="li" sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5, lineHeight: 1.5 }}>{r}</Typography>
                ))}
              </Box>
              <FormControlLabel
                control={<Checkbox size="small" checked={signupAgreed} onChange={(e) => setSignupAgreed(e.target.checked)} sx={{ color: 'text.disabled' }} />}
                label={<Typography sx={{ fontSize: 12, color: 'text.secondary' }}>我已阅读并同意以上规则,自愿参与本活动</Typography>}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={closeSignup} sx={{ textTransform: 'none' }}>取消</Button>
              <Button onClick={confirmSignup} variant="contained" disabled={!signupAgreed} sx={{ textTransform: 'none' }}>确认报名</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Submit-work dialog */}
      <Dialog
        open={!!submitTarget}
        onClose={closeSubmit}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } } }}
      >
        {submitTarget && (
          <>
            <DialogTitle sx={{ fontSize: 16, fontWeight: 700, pb: 1 }}>投稿到《{submitTarget.title}》</DialogTitle>
            <DialogContent sx={{ pb: 1 }}>
              <Box sx={{ p: 1.5, mb: 2, borderRadius: 1.5, bgcolor: 'rgba(37, 244, 238, 0.08)', border: '1px solid', borderColor: 'rgba(37, 244, 238, 0.2)' }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'secondary.main', mb: 0.5 }}>投稿要求</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {submitTarget.requirements.map((r) => (
                    <Chip key={r} label={r} size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(37, 244, 238, 0.16)', color: '#25F4EE' }} />
                  ))}
                </Box>
              </Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', mb: 1 }}>
                选择作品 ({submitSelected.length} 已选)
              </Typography>
              <Box sx={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2, pr: 0.5 }}>
                {eligibleWorks.map((w) => {
                  const selected = submitSelected.includes(w.id);
                  const matchedTag = w.hashtags.find((h) => submitTarget.requirements.some((r) => r.toLowerCase().includes(h.toLowerCase())));
                  const alreadySubmitted = submitTarget.submissions.some((s) => s.workId === w.id);
                  return (
                    <Box
                      key={w.id}
                      onClick={() => {
                        if (alreadySubmitted) return;
                        setSubmitSelected((prev) => prev.includes(w.id) ? prev.filter((x) => x !== w.id) : [...prev, w.id]);
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: selected ? 'rgba(254, 44, 85, 0.08)' : 'transparent',
                        border: '1px solid',
                        borderColor: selected ? 'rgba(254, 44, 85, 0.4)' : 'divider',
                        cursor: alreadySubmitted ? 'not-allowed' : 'pointer',
                        opacity: alreadySubmitted ? 0.5 : 1,
                        transition: 'all 0.15s',
                        '&:hover': alreadySubmitted ? {} : { borderColor: selected ? 'primary.main' : 'rgba(254, 44, 85, 0.3)' },
                      }}
                    >
                      <Box sx={{ width: 56, height: 56, borderRadius: 1, background: w.cover, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PlayArrowRoundedIcon sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 22 }} />
                        <Box sx={{ position: 'absolute', bottom: 2, right: 2, px: 0.4, borderRadius: 0.5, fontSize: 9, fontWeight: 600, color: '#fff', bgcolor: 'rgba(0,0,0,0.6)' }}>
                          {formatDuration(w.duration)}
                        </Box>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{formatBigNumber(w.views)} 观看</Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>·</Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{formatBigNumber(w.likes)} 点赞</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.4, mt: 0.4, flexWrap: 'wrap' }}>
                          {w.hashtags.map((h) => (
                            <Box
                              key={h}
                              sx={{
                                fontSize: 9,
                                px: 0.4,
                                borderRadius: 0.4,
                                bgcolor: matchedTag === h ? 'rgba(93, 219, 150, 0.16)' : 'action.hover',
                                color: matchedTag === h ? '#5DDB96' : 'text.disabled',
                                fontWeight: matchedTag === h ? 700 : 400,
                              }}
                            >
                              {h}
                            </Box>
                          ))}
                          {alreadySubmitted && (
                            <Box sx={{ fontSize: 9, px: 0.4, color: '#FFB400', fontWeight: 600 }}>已投稿</Box>
                          )}
                        </Box>
                      </Box>
                      <Checkbox checked={selected} disabled={alreadySubmitted} size="small" sx={{ p: 0 }} />
                    </Box>
                  );
                })}
              </Box>
              <TextField
                placeholder="附言(可选,会展示在评委评审界面)"
                multiline
                minRows={2}
                maxRows={4}
                fullWidth
                value={submitCaption}
                onChange={(e) => setSubmitCaption(e.target.value)}
                sx={{ '& .MuiInputBase-root': { fontSize: 12 } }}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={closeSubmit} sx={{ textTransform: 'none' }}>取消</Button>
              <Button
                onClick={confirmSubmit}
                variant="contained"
                disabled={submitSelected.length === 0}
                startIcon={<UploadFileRoundedIcon sx={{ fontSize: 14 }} />}
                sx={{ textTransform: 'none' }}
              >
                提交 {submitSelected.length} 部作品
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snack ? (
          <Alert severity={snack.sev} variant="filled" onClose={() => setSnack(null)} sx={{ fontSize: 13 }}>
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
