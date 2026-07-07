'use client';

import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Tooltip from '@mui/material/Tooltip';
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
import Divider from '@mui/material/Divider';

import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import RedeemRoundedIcon from '@mui/icons-material/RedeemRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import HowToVoteRoundedIcon from '@mui/icons-material/HowToVoteRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';

import { adminClient } from '@/lib/api/client';
import { ACTIVITIES,
  MY_WORKS,
  CATEGORY_META,
  STATUS_META,
  PART_META,
  type Activity,
  type ActivityCategory,
  type ActivitySubmission,
  type MyWork,
  formatBigNumber,
  formatDuration } from './data';
import { RelativeTime } from '@/components/common/RelativeTime';

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
  const [items, setItems] = useState<Activity[]>(ACTIVITIES);
  const [tab, setTab] = useState<FilterTab>('all');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [sort, setSort] = useState<SortKey>('heat');
  const [search, setSearch] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'detail' | 'prizes' | 'leaderboard' | 'mywork'>('detail');
  const [signupId, setSignupId] = useState<string | null>(null);
  const [signupAgreed, setSignupAgreed] = useState(false);
  const [submitId, setSubmitId] = useState<string | null>(null);
  const [submitSelected, setSubmitSelected] = useState<string[]>([]);
  const [submitCaption, setSubmitCaption] = useState('');
  const [snack, setSnack] = useState<{ msg: string; sev: 'success' | 'info' | 'warning' } | null>(null);

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

    // Tab filter
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

  // Pre-filter MY_WORKS for the submit dialog (rough hashtag match)
  const eligibleWorks = useMemo(() => {
    if (!submitTarget) return [] as MyWork[];
    const required = submitTarget.requirements
      .map((r) => r.match(/#[一-龥\w]+/g) || [])
      .flat()
      .map((h) => h.toLowerCase());
    if (required.length === 0) return MY_WORKS;
    const matched: MyWork[] = [];
    const rest: MyWork[] = [];
    for (const w of MY_WORKS) {
      const tags = w.hashtags.map((t) => t.toLowerCase());
      if (required.some((r) => tags.includes(r))) matched.push(w);
      else rest.push(w);
    }
    return [...matched, ...rest];
  }, [submitTarget]);

  const openSignup = (id: string) => {
    setSignupId(id);
    setSignupAgreed(false);
  };

  const closeSignup = () => {
    setSignupId(null);
    setSignupAgreed(false);
  };

  const confirmSignup = async () => {
    if (!signupTarget || !signupAgreed) return;
    try {
      await adminClient('/activity/signup', { method: 'POST', data: { activityId: signupTarget.id } });
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

  const openSubmit = (id: string) => {
    setSubmitId(id);
    setSubmitSelected([]);
    setSubmitCaption('');
  };

  const closeSubmit = () => {
    setSubmitId(null);
    setSubmitSelected([]);
    setSubmitCaption('');
  };

  const confirmSubmit = async () => {
    if (!submitTarget || submitSelected.length === 0) return;
    try {
      await adminClient('/activity/submit', { method: 'POST', data: { activityId: submitTarget.id } });
      const newSubs: ActivitySubmission[] = submitSelected.map((wid, idx) => {
        const w = MY_WORKS.find((x) => x.id === wid)!;
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
                await adminClient('/activity/subscribe', { method: 'POST' });
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
          <KpiCard
            icon={<LocalFireDepartmentIcon />}
            label="进行中活动"
            value={stats.active.toString()}
            suffix="个"
            color="#FE2C55"
            bg="rgba(254, 44, 85, 0.12)"
          />
          <KpiCard
            icon={<HowToRegRoundedIcon />}
            label="我已参与"
            value={stats.mySigned.toString()}
            suffix="个"
            color="#25F4EE"
            bg="rgba(37, 244, 238, 0.12)"
          />
          <KpiCard
            icon={<RedeemRoundedIcon />}
            label="本月奖励"
            value={formatBigNumber(stats.monthlyReward)}
            suffix="元"
            color="#5DDB96"
            bg="rgba(93, 219, 150, 0.12)"
          />
          <KpiCard
            icon={<EmojiEventsRoundedIcon />}
            label="累计获奖"
            value={formatBigNumber(stats.totalWon)}
            suffix="元"
            color="#FFD700"
            bg="rgba(255, 215, 0, 0.12)"
          />
        </Box>
      </Box>

      {/* Tabs + toolbar */}
      <Box
        sx={{
          p: 2.5,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
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
                t.id === 'all'
                  ? items.length
                  : t.id === 'mine'
                  ? items.filter((a) =>
                      ['signed', 'submitted', 'shortlist', 'won', 'lost'].includes(a.participation),
                    ).length
                  : t.id === 'won'
                  ? items.filter((a) => a.participation === 'won').length
                  : t.id === 'active'
                  ? items.filter((a) => a.status === 'active').length
                  : t.id === 'signup'
                  ? items.filter((a) => a.status === 'signup').length
                  : t.id === 'upcoming'
                  ? items.filter((a) => a.status === 'upcoming').length
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
                          bgcolor: tab === t.id
                            ? 'rgba(254, 44, 85, 0.16)'
                            : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
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
              <MenuItem key={s.id} value={s.id} sx={{ fontSize: 13 }}>
                {s.label}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      {/* Activity grid */}
      {filtered.length === 0 ? (
        <Box
          sx={{
            p: 6,
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px dashed',
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
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
              onOpen={() => {
                setDetailId(a.id);
                setDetailTab('detail');
              }}
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
        slotProps={{
          paper: {
            sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' },
          },
        }}
      >
        {signupTarget && (
          <>
            <DialogTitle sx={{ fontSize: 16, fontWeight: 700, pb: 1 }}>
              报名《{signupTarget.title}》
            </DialogTitle>
            <DialogContent sx={{ pb: 1 }}>
              <Box
                sx={{
                  p: 1.5,
                  mb: 2,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(254, 44, 85, 0.08)',
                  border: '1px solid',
                  borderColor: 'rgba(254, 44, 85, 0.2)',
                }}
              >
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'primary.main', mb: 0.5 }}>
                  奖项总额
                </Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                  {signupTarget.totalReward}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', mb: 1 }}>
                报名前请阅读活动规则
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0, mb: 2 }}>
                {signupTarget.rules.map((r, i) => (
                  <Typography
                    key={i}
                    component="li"
                    sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5, lineHeight: 1.5 }}
                  >
                    {r}
                  </Typography>
                ))}
              </Box>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={signupAgreed}
                    onChange={(e) => setSignupAgreed(e.target.checked)}
                    sx={{ color: 'text.disabled' }}
                  />
                }
                label={
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    我已阅读并同意以上规则,自愿参与本活动
                  </Typography>
                }
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={closeSignup} sx={{ textTransform: 'none' }}>
                取消
              </Button>
              <Button
                onClick={confirmSignup}
                variant="contained"
                disabled={!signupAgreed}
                sx={{ textTransform: 'none' }}
              >
                确认报名
              </Button>
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
        slotProps={{
          paper: {
            sx: { bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' },
          },
        }}
      >
        {submitTarget && (
          <>
            <DialogTitle sx={{ fontSize: 16, fontWeight: 700, pb: 1 }}>
              投稿到《{submitTarget.title}》
            </DialogTitle>
            <DialogContent sx={{ pb: 1 }}>
              <Box
                sx={{
                  p: 1.5,
                  mb: 2,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(37, 244, 238, 0.08)',
                  border: '1px solid',
                  borderColor: 'rgba(37, 244, 238, 0.2)',
                }}
              >
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'secondary.main', mb: 0.5 }}>
                  投稿要求
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {submitTarget.requirements.map((r) => (
                    <Chip
                      key={r}
                      label={r}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: 10,
                        bgcolor: 'rgba(37, 244, 238, 0.16)',
                        color: '#25F4EE',
                      }}
                    />
                  ))}
                </Box>
              </Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', mb: 1 }}>
                选择作品 ({submitSelected.length} 已选)
              </Typography>
              <Box
                sx={{
                  maxHeight: 280,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.75,
                  mb: 2,
                  pr: 0.5,
                }}
              >
                {eligibleWorks.map((w) => {
                  const selected = submitSelected.includes(w.id);
                  const matchedTag = w.hashtags.find((h) =>
                    submitTarget.requirements.some((r) => r.toLowerCase().includes(h.toLowerCase())),
                  );
                  const alreadySubmitted = submitTarget.submissions.some((s) => s.workId === w.id);
                  return (
                    <Box
                      key={w.id}
                      onClick={() => {
                        if (alreadySubmitted) return;
                        setSubmitSelected((prev) =>
                          prev.includes(w.id) ? prev.filter((x) => x !== w.id) : [...prev, w.id],
                        );
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
                        '&:hover': alreadySubmitted
                          ? {}
                          : { borderColor: selected ? 'primary.main' : 'rgba(254, 44, 85, 0.3)' },
                      }}
                    >
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: 1,
                          background: w.cover,
                          flexShrink: 0,
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <PlayArrowRoundedIcon sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 22 }} />
                        <Box
                          sx={{
                            position: 'absolute',
                            bottom: 2,
                            right: 2,
                            px: 0.4,
                            borderRadius: 0.5,
                            fontSize: 9,
                            fontWeight: 600,
                            color: '#fff',
                            bgcolor: 'rgba(0,0,0,0.6)',
                          }}
                        >
                          {formatDuration(w.duration)}
                        </Box>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: 'text.primary',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {w.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                            {formatBigNumber(w.views)} 观看
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>·</Typography>
                          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                            {formatBigNumber(w.likes)} 点赞
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.4, mt: 0.4, flexWrap: 'wrap' }}>
                          {w.hashtags.map((h) => (
                            <Box
                              key={h}
                              sx={{
                                fontSize: 9,
                                px: 0.4,
                                borderRadius: 0.4,
                                bgcolor:
                                  matchedTag === h
                                    ? 'rgba(93, 219, 150, 0.16)'
                                    : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
                                color: matchedTag === h ? '#5DDB96' : 'text.disabled',
                                fontWeight: matchedTag === h ? 700 : 400,
                              }}
                            >
                              {h}
                            </Box>
                          ))}
                          {alreadySubmitted && (
                            <Box sx={{ fontSize: 9, px: 0.4, color: '#FFB400', fontWeight: 600 }}>
                              已投稿
                            </Box>
                          )}
                        </Box>
                      </Box>
                      <Checkbox
                        checked={selected}
                        disabled={alreadySubmitted}
                        size="small"
                        sx={{ p: 0 }}
                      />
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
              <Button onClick={closeSubmit} sx={{ textTransform: 'none' }}>
                取消
              </Button>
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
          <Alert
            severity={snack.sev}
            variant="filled"
            onClose={() => setSnack(null)}
            sx={{ fontSize: 13 }}
          >
            {snack.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// Sub-components

function KpiCard({
  icon,
  label,
  value,
  suffix,
  color,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  color: string;
  bg: string;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1,
          bgcolor: bg,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          '& .MuiSvgIcon-root': { fontSize: 20 },
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 10, color: 'text.disabled', mb: 0.25 }}>{label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.25 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'text.primary', lineHeight: 1 }}>
            {value}
          </Typography>
          {suffix && (
            <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{suffix}</Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function ActivityCard({
  activity,
  onOpen,
  onSignup,
  onSubmit,
  onCopyLink,
}: {
  activity: Activity;
  onOpen: () => void;
  onSignup: () => void;
  onSubmit: () => void;
  onCopyLink: () => void;
}) {
  const a = activity;
  const cat = CATEGORY_META[a.category];
  const st = STATUS_META[a.status];
  const pm = PART_META[a.participation];
  const countdownLabel = useCountdownLabel(a);

  const primaryAction = getPrimaryAction(a);

  return (
    <Box
      sx={{
        borderRadius: 2,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
        border: '1px solid',
        borderColor: a.participation === 'won' ? 'rgba(255, 215, 0, 0.4)' : 'divider',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        '&:hover': { transform: 'translateY(-2px)', borderColor: cat.color },
      }}
      onClick={onOpen}
    >
      {/* Won ribbon */}
      {a.participation === 'won' && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 2,
            px: 0.75,
            py: 0.25,
            borderRadius: 0.75,
            bgcolor: 'rgba(255, 215, 0, 0.95)',
            color: '#1F1B00',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 0.4,
            boxShadow: '0 2px 8px rgba(255, 215, 0, 0.4)',
          }}
        >
          <WorkspacePremiumRoundedIcon sx={{ fontSize: 12 }} />
          {pm.label}
        </Box>
      )}

      <Box
        sx={{
          height: 110,
          background: a.gradient,
          position: 'relative',
          display: 'flex',
          alignItems: 'flex-end',
          p: 1.5,
        }}
      >
        <Chip
          label={cat.label}
          size="small"
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            height: 20,
            bgcolor: 'rgba(255,255,255,0.95)',
            color: cat.color,
            fontSize: 10,
            fontWeight: 700,
          }}
        />
        {a.participation !== 'won' && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.75,
              py: 0.25,
              borderRadius: 0.75,
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            <LocalFireDepartmentIcon sx={{ fontSize: 11, color: '#FFB400' }} />
            {formatBigNumber(a.heat)}
          </Box>
        )}
        {/* Title overlay */}
        <Box sx={{ position: 'relative' }}>
          <Typography
            sx={{
              fontSize: 15,
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.3,
              textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }}
          >
            {a.title}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1 }}>
        <Typography
          sx={{
            fontSize: 12,
            color: 'text.secondary',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
            minHeight: 34,
          }}
        >
          {a.subtitle}
        </Typography>

        {/* Status row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          <Box
            sx={{
              px: 0.6,
              py: 0.15,
              borderRadius: 0.5,
              bgcolor: st.bg,
              color: st.color,
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {st.label}
          </Box>
          {a.participation !== 'none' && a.participation !== 'won' && (
            <Box
              sx={{
                px: 0.6,
                py: 0.15,
                borderRadius: 0.5,
                bgcolor: pm.bg,
                color: pm.color,
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {pm.label}
            </Box>
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="复制活动链接">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onCopyLink();
              }}
              sx={{ p: 0.5, color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}
            >
              <ContentCopyRoundedIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Stats line */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Tooltip title="报名人数">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <GroupRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
              <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                {formatBigNumber(a.signupCount)}
              </Typography>
            </Box>
          </Tooltip>
          <Tooltip title="投稿作品数">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <UploadFileRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
              <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                {formatBigNumber(a.submissionCount)}
              </Typography>
            </Box>
          </Tooltip>
          <Tooltip title="总曝光">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <VisibilityRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
              <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                {formatBigNumber(a.totalViews)}
              </Typography>
            </Box>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Tooltip title={`截止 ${a.endLabel}`}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <ScheduleRoundedIcon sx={{ fontSize: 11, color: countdownLabel.color }} />
              <Typography sx={{ fontSize: 10, fontWeight: 600, color: countdownLabel.color }}>
                {countdownLabel.text}
              </Typography>
            </Box>
          </Tooltip>
        </Box>

        {/* Reward */}
        <Box
          sx={{
            mt: 0.5,
            p: 1,
            borderRadius: 1,
            bgcolor: 'rgba(255, 180, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
          }}
        >
          <RedeemRoundedIcon sx={{ fontSize: 14, color: '#FFB400' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                color: '#FFB400',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {a.totalReward}
            </Typography>
          </Box>
        </Box>

        {/* My submissions count if participating */}
        {a.submissions.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: 10,
              color: a.participation === 'won' ? '#FFD700' : '#5DDB96',
            }}
          >
            {a.participation === 'won' ? (
              <CelebrationRoundedIcon sx={{ fontSize: 12 }} />
            ) : (
              <VerifiedRoundedIcon sx={{ fontSize: 12 }} />
            )}
            <Typography sx={{ fontSize: 10, fontWeight: 600 }}>
              {a.participation === 'won' && a.myWonReward
                ? `已获奖:${a.myWonReward}`
                : `已投稿 ${a.submissions.length} 部 ${
                    a.myRank ? `· 当前排名 #${a.myRank}` : ''
                  }`}
            </Typography>
          </Box>
        )}

        {/* Action */}
        <Button
          fullWidth
          size="small"
          variant={primaryAction.variant}
          onClick={(e) => {
            e.stopPropagation();
            if (primaryAction.kind === 'signup') onSignup();
            else if (primaryAction.kind === 'submit') onSubmit();
            else onOpen();
          }}
          startIcon={primaryAction.icon}
          sx={{
            mt: 'auto',
            textTransform: 'none',
            fontSize: 12,
            py: 0.5,
            ...(primaryAction.variant === 'contained' && {
              bgcolor: primaryAction.color,
              color: '#fff',
              '&:hover': { bgcolor: primaryAction.color, filter: 'brightness(1.1)' },
            }),
          }}
        >
          {primaryAction.label}
        </Button>
      </Box>
    </Box>
  );
}

function DetailDrawer({
  activity,
  tab,
  onTabChange,
  onClose,
  onSignup,
  onSubmit,
  onCopyLink,
}: {
  activity: Activity;
  tab: 'detail' | 'prizes' | 'leaderboard' | 'mywork';
  onTabChange: (t: 'detail' | 'prizes' | 'leaderboard' | 'mywork') => void;
  onClose: () => void;
  onSignup: () => void;
  onSubmit: () => void;
  onCopyLink: () => void;
}) {
  const a = activity;
  const cat = CATEGORY_META[a.category];
  const st = STATUS_META[a.status];
  const pm = PART_META[a.participation];
  const primaryAction = getPrimaryAction(a);
  const countdown = useCountdownLabel(a);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Hero header */}
      <Box
        sx={{
          background: a.gradient,
          p: 2.5,
          position: 'relative',
          color: '#fff',
        }}
      >
        <IconButton
          size="small"
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            bgcolor: 'rgba(0,0,0,0.3)',
            color: '#fff',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
          }}
        >
          <CloseRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
          <Chip
            label={cat.label}
            size="small"
            sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.95)', color: cat.color }}
          />
          <Chip
            label={st.label}
            size="small"
            sx={{
              height: 20,
              fontSize: 10,
              fontWeight: 700,
              bgcolor: 'rgba(0,0,0,0.35)',
              color: '#fff',
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
            <LocalFireDepartmentIcon sx={{ fontSize: 12, color: '#FFB400' }} />
            <Typography sx={{ fontSize: 11, fontWeight: 600 }}>
              {formatBigNumber(a.heat)}
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, mb: 0.5 }}>
          {a.title}
        </Typography>
        <Typography sx={{ fontSize: 13, opacity: 0.95, mb: 1.5 }}>
          {a.subtitle}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', fontSize: 11 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <VerifiedRoundedIcon sx={{ fontSize: 12 }} />
            <Typography sx={{ fontSize: 11 }}>{a.organizer}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <ScheduleRoundedIcon sx={{ fontSize: 12 }} />
            <Typography sx={{ fontSize: 11 }}>截止 {a.endLabel}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <ScheduleRoundedIcon sx={{ fontSize: 12 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{countdown.text}</Typography>
          </Box>
        </Box>
      </Box>

      {/* KPI strip */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 0,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {[
          { label: '报名', value: formatBigNumber(a.signupCount), icon: <HowToRegRoundedIcon /> },
          { label: '投稿', value: formatBigNumber(a.submissionCount), icon: <UploadFileRoundedIcon /> },
          { label: '总曝光', value: formatBigNumber(a.totalViews), icon: <VisibilityRoundedIcon /> },
          { label: '奖金池', value: formatBigNumber(a.totalRewardValue) + '元', icon: <RedeemRoundedIcon /> },
        ].map((s, i) => (
          <Box
            key={i}
            sx={{
              p: 1.5,
              textAlign: 'center',
              borderRight: i < 3 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.4,
                mb: 0.25,
                color: 'text.disabled',
                '& .MuiSvgIcon-root': { fontSize: 12 },
              }}
            >
              {s.icon}
              <Typography sx={{ fontSize: 10 }}>{s.label}</Typography>
            </Box>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
              {s.value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* My participation card */}
      {a.participation !== 'none' && (
        <Box
          sx={{
            mx: 2.5,
            mt: 2,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor:
              a.participation === 'won'
                ? 'rgba(255, 215, 0, 0.08)'
                : 'rgba(254, 44, 85, 0.08)',
            border: '1px solid',
            borderColor:
              a.participation === 'won'
                ? 'rgba(255, 215, 0, 0.3)'
                : 'rgba(254, 44, 85, 0.2)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            {a.participation === 'won' ? (
              <CelebrationRoundedIcon sx={{ fontSize: 18, color: '#FFD700' }} />
            ) : (
              <VerifiedRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            )}
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary', flex: 1 }}>
              我的参与
            </Typography>
            <Box
              sx={{
                px: 0.6,
                py: 0.15,
                borderRadius: 0.5,
                bgcolor: pm.bg,
                color: pm.color,
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {pm.label}
            </Box>
          </Box>
          {a.participation === 'won' && a.myWonReward && (
            <Typography sx={{ fontSize: 12, color: 'text.primary', fontWeight: 600, mb: 0.5 }}>
              🎉 恭喜!获得 <Box component="span" sx={{ color: '#FFD700' }}>{a.myWonReward}</Box>
              {a.myWonAt && (
                <Typography component="span" sx={{ fontSize: 11, color: 'text.disabled', ml: 0.5 }} suppressHydrationWarning>
                  · <RelativeTime ts={a.myWonAt} fallback="" />揭晓
                </Typography>
              )}
            </Typography>
          )}
          {a.submissions.length > 0 && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              已投稿 <b>{a.submissions.length}</b> 部作品
              {a.myRank && (
                <>
                  ,当前最佳排名 <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>#{a.myRank}</Box>
                </>
              )}
            </Typography>
          )}
          {a.participation === 'signed' && a.submissions.length === 0 && (
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              已报名,尚未投稿。投稿截止前完成即可参与评审。
            </Typography>
          )}
        </Box>
      )}

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => onTabChange(v)}
        sx={{
          mx: 2.5,
          mt: 2,
          minHeight: 36,
          borderBottom: '1px solid',
          borderColor: 'divider',
          '& .MuiTab-root': { minHeight: 36, fontSize: 13, textTransform: 'none', minWidth: 0, px: 1.5 },
          '& .MuiTabs-indicator': { bgcolor: 'primary.main', height: 2 },
        }}
      >
        <Tab value="detail" label="活动详情" icon={<RuleRoundedIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
        <Tab value="prizes" label={`奖项 (${a.prizes.length})`} icon={<EmojiEventsRoundedIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
        <Tab
          value="leaderboard"
          label={`排行榜 (${a.leaderboard.length})`}
          icon={<LeaderboardRoundedIcon sx={{ fontSize: 14 }} />}
          iconPosition="start"
        />
        <Tab
          value="mywork"
          label={`我的作品 (${a.submissions.length})`}
          icon={<UploadFileRoundedIcon sx={{ fontSize: 14 }} />}
          iconPosition="start"
        />
      </Tabs>

      {/* Tab content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5, pb: 10 }}>
        {tab === 'detail' && <DetailTabContent activity={a} />}
        {tab === 'prizes' && <PrizesTabContent activity={a} />}
        {tab === 'leaderboard' && <LeaderboardTabContent activity={a} />}
        {tab === 'mywork' && <MyWorkTabContent activity={a} />}
      </Box>

      {/* Sticky footer */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          p: 2,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
        }}
      >
        <Button
          variant="outlined"
          size="medium"
          onClick={onCopyLink}
          startIcon={<ContentCopyRoundedIcon sx={{ fontSize: 14 }} />}
          sx={{ textTransform: 'none', minWidth: 'auto', px: 1.5 }}
        >
          复制链接
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant={primaryAction.variant}
          size="medium"
          onClick={() => {
            if (primaryAction.kind === 'signup') onSignup();
            else if (primaryAction.kind === 'submit') onSubmit();
          }}
          startIcon={primaryAction.icon}
          disabled={primaryAction.disabled}
          sx={{
            textTransform: 'none',
            minWidth: 180,
            ...(primaryAction.variant === 'contained' && {
              bgcolor: primaryAction.color,
              '&:hover': { bgcolor: primaryAction.color, filter: 'brightness(1.1)' },
            }),
          }}
        >
          {primaryAction.label}
        </Button>
      </Box>
    </Box>
  );
}

function DetailTabContent({ activity }: { activity: Activity }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <SectionTitle icon={<RuleRoundedIcon />} title="活动介绍" />
        <Typography sx={{ fontSize: 13, color: 'text.secondary', lineHeight: 1.7 }}>
          {activity.desc}
        </Typography>
      </Box>
      <Box>
        <SectionTitle icon={<StarRoundedIcon />} title="投稿要求" />
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {activity.requirements.map((r) => (
            <Chip
              key={r}
              label={r}
              size="small"
              sx={{
                height: 22,
                fontSize: 11,
                bgcolor: 'rgba(37, 244, 238, 0.12)',
                color: '#25F4EE',
                fontWeight: 600,
              }}
            />
          ))}
        </Box>
      </Box>
      <Box>
        <SectionTitle icon={<VerifiedRoundedIcon />} title="活动规则" />
        <Box component="ol" sx={{ pl: 2.5, m: 0 }}>
          {activity.rules.map((r, i) => (
            <Typography
              key={i}
              component="li"
              sx={{ fontSize: 12.5, color: 'text.secondary', mb: 0.75, lineHeight: 1.6 }}
            >
              {r}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function PrizesTabContent({ activity }: { activity: Activity }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <SectionTitle icon={<EmojiEventsRoundedIcon />} title="奖项设置" />
      {activity.prizes.map((p, i) => (
        <Box
          key={i}
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              bgcolor: p.color,
            },
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: `${p.color}22`,
              color: p.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 20,
              fontWeight: 800,
            }}
          >
            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🎖'}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: p.color }}>
                {p.rank}
              </Typography>
              <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                {p.count} 名
              </Typography>
            </Box>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
              {p.reward}
            </Typography>
          </Box>
          {activity.participation === 'won' &&
            activity.myWonReward?.includes(p.rank) && (
              <Box
                sx={{
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.75,
                  bgcolor: 'rgba(255, 215, 0, 0.16)',
                  color: '#FFD700',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.4,
                }}
              >
                <CelebrationRoundedIcon sx={{ fontSize: 12 }} />
                我获得
              </Box>
            )}
        </Box>
      ))}
    </Box>
  );
}

function LeaderboardTabContent({ activity }: { activity: Activity }) {
  const a = activity;
  if (a.leaderboard.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <LeaderboardRoundedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          {a.status === 'upcoming' || a.status === 'signup'
            ? '活动尚未开始,排行榜将在投稿期开放'
            : '暂无榜单数据'}
        </Typography>
      </Box>
    );
  }
  return (
    <Box>
      <SectionTitle icon={<LeaderboardRoundedIcon />} title="作品热度榜" />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {a.leaderboard.map((e) => (
          <Box
            key={`${e.rank}-${e.creatorName}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1,
              borderRadius: 1,
              bgcolor: e.isMe ? 'rgba(254, 44, 85, 0.1)' : 'transparent',
              border: '1px solid',
              borderColor: e.isMe ? 'rgba(254, 44, 85, 0.3)' : 'transparent',
              '&:hover': {
                bgcolor: e.isMe
                  ? 'rgba(254, 44, 85, 0.14)'
                  : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
              },
            }}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor:
                  e.rank === 1
                    ? '#FFD700'
                    : e.rank === 2
                    ? '#C0C0C0'
                    : e.rank === 3
                    ? '#CD7F32'
                    : (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
                color: e.rank <= 3 ? '#1F1B00' : 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {e.rank}
            </Box>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: e.avatarColor,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {e.initials}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: e.isMe ? 'primary.main' : 'text.primary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {e.creatorName} {e.isMe && <Box component="span" sx={{ fontSize: 9, color: 'primary.main' }}>(我)</Box>}
              </Typography>
              <Typography
                sx={{
                  fontSize: 11,
                  color: 'text.disabled',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {e.workTitle}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, justifyContent: 'flex-end' }}>
                <VisibilityRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {formatBigNumber(e.views)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, justifyContent: 'flex-end' }}>
                <HowToVoteRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {formatBigNumber(e.votes)}
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function MyWorkTabContent({ activity }: { activity: Activity }) {
  const a = activity;
  if (a.submissions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <UploadFileRoundedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          还没有作品参赛 — 点击下方"投稿作品"开始
        </Typography>
      </Box>
    );
  }
  return (
    <Box>
      <SectionTitle icon={<UploadFileRoundedIcon />} title={`我的投稿 (${a.submissions.length})`} />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {a.submissions.map((s) => (
          <Box
            key={s.id}
            sx={{
              p: 1.25,
              borderRadius: 1.5,
              bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1E2030' : '#FFFFFF',
              border: '1px solid',
              borderColor: s.prize ? 'rgba(255, 215, 0, 0.4)' : 'divider',
              display: 'flex',
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: 1,
                background: s.workCover,
                flexShrink: 0,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PlayArrowRoundedIcon sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 24 }} />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  px: 0.5,
                  borderRadius: 0.5,
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#fff',
                  bgcolor: 'rgba(0,0,0,0.6)',
                }}
              >
                {formatDuration(s.workDuration)}
              </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'text.primary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  mb: 0.5,
                }}
              >
                {s.workTitle}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <VisibilityRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {formatBigNumber(s.views)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <FavoriteRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {formatBigNumber(s.likes)}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <HowToVoteRoundedIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                  <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
                    {formatBigNumber(s.votes)} 票
                  </Typography>
                </Box>
              </Box>
              {s.rank && (
                <Typography sx={{ fontSize: 11, color: 'primary.main', fontWeight: 700 }}>
                  当前排名 #{s.rank}
                </Typography>
              )}
              {s.prize && (
                <Box
                  sx={{
                    mt: 0.5,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 0.75,
                    bgcolor: 'rgba(255, 215, 0, 0.16)',
                    color: '#FFD700',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.4,
                  }}
                >
                  <CelebrationRoundedIcon sx={{ fontSize: 12 }} />
                  {s.prize}
                </Box>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
      <Box sx={{ color: 'primary.main', display: 'flex', '& .MuiSvgIcon-root': { fontSize: 14 } }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'text.primary' }}>
        {title}
      </Typography>
      <Divider sx={{ flex: 1, ml: 1 }} />
    </Box>
  );
}

// ────────────────────────────────────────────────────────────
// Helpers

function getPrimaryAction(a: Activity): {
  label: string;
  kind: 'signup' | 'submit' | 'view';
  icon: React.ReactElement;
  variant: 'contained' | 'outlined';
  color: string;
  disabled?: boolean;
} {
  if (a.participation === 'won') {
    return {
      label: '查看获奖详情',
      kind: 'view',
      icon: <WorkspacePremiumRoundedIcon sx={{ fontSize: 14 }} />,
      variant: 'contained',
      color: '#FFD700',
    };
  }
  if (a.status === 'ended' || a.status === 'judging') {
    return {
      label: a.status === 'judging' ? '评审中,等待公示' : '查看活动结果',
      kind: 'view',
      icon: <AutorenewRoundedIcon sx={{ fontSize: 14 }} />,
      variant: 'outlined',
      color: '#9CA3AF',
      disabled: a.status === 'judging',
    };
  }
  if (a.status === 'upcoming') {
    return {
      label: '即将开始,敬请期待',
      kind: 'view',
      icon: <ScheduleRoundedIcon sx={{ fontSize: 14 }} />,
      variant: 'outlined',
      color: '#8B5CF6',
      disabled: true,
    };
  }
  if (a.participation === 'none') {
    return {
      label: '立即报名',
      kind: 'signup',
      icon: <HowToRegRoundedIcon sx={{ fontSize: 14 }} />,
      variant: 'contained',
      color: '#FE2C55',
    };
  }
  // signed, submitted, shortlist, lost — let user submit (or keep submitting)
  if (a.status === 'active') {
    return {
      label: a.submissions.length === 0 ? '投稿作品' : '继续投稿',
      kind: 'submit',
      icon: <UploadFileRoundedIcon sx={{ fontSize: 14 }} />,
      variant: 'contained',
      color: '#FE2C55',
    };
  }
  return {
    label: '查看详情',
    kind: 'view',
    icon: <VisibilityRoundedIcon sx={{ fontSize: 14 }} />,
    variant: 'outlined',
    color: 'text.secondary',
  };
}

function useCountdownLabel(a: Activity): { text: string; color: string } {
  const now = Date.now();
  if (a.status === 'ended') return { text: '已结束', color: '#9CA3AF' };
  if (a.status === 'judging') return { text: '评审中', color: '#FFB400' };
  if (a.status === 'upcoming') {
    const diff = a.startAt - now;
    const d = Math.floor(diff / 86400000);
    return { text: `${d} 天后开放`, color: '#8B5CF6' };
  }
  const diff = a.endAt - now;
  if (diff <= 0) return { text: '截止', color: '#FE2C55' };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 7) return { text: `还剩 ${d} 天`, color: 'text.disabled' };
  if (d > 0) return { text: `仅剩 ${d} 天`, color: '#FFB400' };
  return { text: `仅剩 ${h} 小时`, color: '#FE2C55' };
}

function parseRewardCny(reward: string | undefined): number {
  if (!reward) return 0;
  // Match patterns like ¥10,000 or ¥3,000 or 10w
  const cnyMatch = reward.match(/¥\s*([\d,]+)/);
  if (cnyMatch) return Number(cnyMatch[1].replace(/,/g, ''));
  const wMatch = reward.match(/(\d+)w/);
  if (wMatch) return Number(wMatch[1]) * 10000;
  return 0;
}
