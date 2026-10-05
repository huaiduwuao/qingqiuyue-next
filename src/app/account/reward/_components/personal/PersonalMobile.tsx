'use client';

/**
 * 手机版「我的工作台」。电脑版是 渐变 hero(欢迎语 + 进度条 + 6 个 KPI 卡 + 收入摘要 + 最近一条 + 操作提示)
 * + 两栏六个面板,手机上堆成两屏多。这里:
 *   钱包卡(余额 + 今日 + 已结/待结 + 一行 4 个数,点数字进对应子页)
 *   → 我的待办 → 我的需求 → 我的团队 → 我的实现(各最多 3 行,「更多」进子页)→ 积分流水(滚到底续页)。
 * 查询与电脑版各面板同 queryKey,切换宽度时共用缓存。
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { MobileListRow, MobileSection, MobileStatRow } from '@/components/mobile/MobileSection';
import { getWalletSummary } from '@/apis/reward-center';
import { getMyStats, listMyPointRecords, type MyStats, type PointRecord } from '@/apis/dashboard';
import { listDemands } from '@/apis/reward-demand';
import { listRealizations, myTeams, centsAsDiamonds } from '@/apis/team';
import { listTasks } from '@/apis/reward-task';
import { safeSitePath } from '@/lib/safeUrl';
import type { DemandItem, DemandStatus, RewardTask, RewardTaskStatus } from '@/beans/reward';
import { mapRewardTaskListFromBackend, normalizeRewardTaskStatus, REWARD_TASK_STATUS_LABEL } from '../taskboard/status';
import RealizationRowsMobile from '../realization/RealizationRowsMobile';
import { ListFooter, MobileEmpty, MobileSkeletonRows, StatusTag } from './mobileKit';
import type { PersonalWorkspaceProps } from './page';
import { demandPayDiamonds, formatDiamonds } from '@/apis/wallet';

const DEMAND_META: Record<DemandStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: '待发布', color: 'text.secondary', bg: 'rgba(139, 143, 163, 0.12)' },
  PUBLISHED: { label: '进行中', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
  COMPLETED: { label: '待结账', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  SETTLED: { label: '已结算', color: 'success.main', bg: 'rgba(93, 219, 150, 0.12)' },
  CLOSED: { label: '已关闭', color: 'text.disabled', bg: 'rgba(90, 94, 114, 0.12)' },
};

const TASK_COLOR: Record<RewardTaskStatus, string> = {
  OPEN: '#5DDB96',
  CLAIMED: '#8B5CF6',
  SUBMITTED: '#FFB400',
  APPROVED: '#5DDB96',
  REJECTED: '#FE2C55',
};

const SOURCE_META: Record<string, { label: string; color: string; bg: string }> = {
  demand_settle: { label: '需求结算', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)' },
  demand_complete: { label: '需求完成', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  task_approve: { label: '任务通过', color: 'var(--fg-green)', bg: 'rgba(93, 219, 150, 0.12)' },
  task_reward: { label: '任务奖励', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
  achievement: { label: '成就奖励', color: 'var(--fg-amber)', bg: 'rgba(255, 180, 0, 0.12)' },
  signup_bonus: { label: '注册奖励', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
  '': { label: '系统', color: 'text.secondary', bg: 'action.hover' },
};

const ROLE_LABEL: Record<string, string> = { owner: '队长', admin: '管理员', member: '成员' };

function timeAgo(s?: string) {
  if (!s) return '';
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 60) return `${Math.max(m, 0)} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.floor(h / 24)} 天前`;
}

const PAGE = 8;

export default function PersonalMobile({
  currentUserId,
  onOpenDemandTab,
  onOpenDemandDetail,
  onOpenRealizationTab,
  onOpenTaskboardTab,
  onOpenTeamTab,
}: PersonalWorkspaceProps & { currentUserId: number }) {
  const router = useRouter();

  const walletQ = useQuery({
    queryKey: ['personal', 'wallet-summary', currentUserId],
    queryFn: () => getWalletSummary(),
    enabled: !!currentUserId,
    placeholderData: { balance: 0, totalIncome: 0, totalSpend: 0, todayReward: 0 },
  });
  const wallet = walletQ.data || { balance: 0, totalIncome: 0, totalSpend: 0, todayReward: 0 };

  const statsQ = useQuery({
    queryKey: ['personal', 'my-stats', currentUserId],
    queryFn: () => getMyStats(),
    enabled: !!currentUserId,
    placeholderData: {} as MyStats,
    refetchOnMount: 'always',
    staleTime: 30 * 1000,
  });
  const st: Partial<MyStats> = statsQ.data || {};

  const teamsQ = useQuery({ queryKey: ['team', 'mine'], queryFn: () => myTeams().then((r) => r.list || []) });
  const allTeams = useMemo(() => teamsQ.data || [], [teamsQ.data]);
  const teams = allTeams.filter((t) => t.myStatus === 'active');
  const invites = allTeams.filter((t) => t.myStatus === 'invited').length;

  const demandsQ = useQuery({
    queryKey: ['personal', 'demands', 'all', currentUserId],
    queryFn: () => listDemands({ pageSize: 200 } as any).then((r: any) => (r?.records || r?.list || []) as DemandItem[]),
    enabled: !!currentUserId,
    placeholderData: [],
  });
  const demands = demandsQ.data || [];

  const realQ = useQuery({
    queryKey: ['realization', 'me', 'recent', currentUserId],
    queryFn: () => listRealizations({ userId: Number(currentUserId), pageSize: 5 }),
    enabled: !!currentUserId,
  });
  const realTotal = realQ.data?.total ?? 0;

  const tasksQ = useQuery({
    queryKey: ['personal', 'tasks', 'mine-detail', currentUserId],
    queryFn: () =>
      listTasks({ assigneeId: currentUserId, claimerId: currentUserId, pageSize: 100 } as any).then((r: any) =>
        mapRewardTaskListFromBackend(r?.records || []),
      ),
    enabled: !!currentUserId,
    placeholderData: [],
  });
  const tasks: RewardTask[] = useMemo(() => tasksQ.data || [], [tasksQ.data]);
  // 待办:进行中 → 待验收 → 被驳回 → 待领,已完成的不算
  const todo = useMemo(() => {
    const rank: Record<RewardTaskStatus, number> = { CLAIMED: 0, SUBMITTED: 1, REJECTED: 2, OPEN: 3, APPROVED: 9 };
    return tasks
      .filter((t) => normalizeRewardTaskStatus(t.status) !== 'APPROVED')
      .sort((a, b) => rank[normalizeRewardTaskStatus(a.status)] - rank[normalizeRewardTaskStatus(b.status)]);
  }, [tasks]);
  const teamName = useMemo(() => new Map(allTeams.map((t) => [t.id, t.name])), [allTeams]);

  const pointQ = useInfiniteQuery({
    queryKey: ['personal', 'point-records', currentUserId],
    queryFn: ({ pageParam }) =>
      listMyPointRecords({ page: pageParam, pageSize: PAGE }).then((r: any) => ({
        list: (r.list || r.records || []) as PointRecord[],
        total: Number(r.total ?? r.totalRow ?? 0),
        page: pageParam as number,
      })),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * PAGE < last.total ? last.page + 1 : undefined),
    enabled: !!currentUserId,
    refetchOnMount: 'always',
    staleTime: 15 * 1000,
  });
  const records = pointQ.data?.pages.flatMap((p) => p.list) ?? [];
  const recordTotal = pointQ.data?.pages[0]?.total ?? 0;

  // 积分流水在页面最底下:滚到底续页(电脑版是面板内部滚动)
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pointQ;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const ob = new IntersectionObserver((e) => {
      if (e[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: '300px' });
    ob.observe(el);
    return () => ob.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const openRecord = (rec: PointRecord) => {
    // sourceUrl 来自服务端:只跳站内路径
    const path = safeSitePath(rec.sourceUrl);
    if (path) router.push(path);
  };

  const pending = Number(st.pendingIncomeDiamonds || 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {/* 钱包 + 四个入口数 */}
      <MobileSection>
        <Box sx={{ pt: 1.75, display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>钻石余额</Typography>
            <Typography sx={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2, color: 'primary.main', fontFamily: 'monospace' }}>
              💎 {wallet.balance.toLocaleString()}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 12, color: 'text.secondary', pb: 0.25, whiteSpace: 'nowrap' }}>
            今日 <Box component="span" sx={{ color: 'success.main', fontWeight: 700 }}>+{wallet.todayReward.toLocaleString()}</Box> 钻
          </Typography>
        </Box>
        <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5, mb: 1.5 }}>
          赏金已结 <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>{formatDiamonds(st.totalIncomeDiamonds)}</Box>
          {pending > 0 && (
            <>
              {' · 待结 '}
              <Box component="span" sx={{ color: 'warning.main', fontWeight: 700 }}>{formatDiamonds(pending)}</Box>
            </>
          )}
          {' · 累计 '}
          {wallet.totalIncome.toLocaleString()} 钻
        </Typography>
        <MobileStatRow
          items={[
            { label: '需求', value: demandsQ.isLoading ? '—' : demands.length, onClick: onOpenDemandTab },
            { label: '实现', value: realQ.isLoading ? '—' : realTotal, onClick: onOpenRealizationTab },
            { label: '团队', value: teams.length, onClick: () => onOpenTeamTab?.() },
            { label: '任务', value: tasksQ.isLoading ? '—' : tasks.length, onClick: () => onOpenTaskboardTab?.() },
          ]}
        />
      </MobileSection>

      {/* 我的待办 */}
      <MobileSection
        title="我的待办"
        extra={todo.length > 0 ? `${todo.length} 项` : undefined}
        moreLabel="看板"
        onMore={onOpenTaskboardTab ? () => onOpenTaskboardTab() : undefined}
        flush
      >
        {tasksQ.isLoading ? (
          <MobileSkeletonRows count={2} />
        ) : todo.length === 0 ? (
          <MobileEmpty>{tasks.length === 0 ? '暂无待办任务' : '所有任务都已完成 ✓'}</MobileEmpty>
        ) : (
          todo.slice(0, 3).map((t, i) => {
            const s = normalizeRewardTaskStatus(t.status);
            const meta = [t.priority, t.teamId ? teamName.get(t.teamId) || '团队' : null, t.demandTitle].filter(Boolean).join(' · ');
            return (
              <MobileListRow
                key={t.id}
                divider={i > 0}
                onClick={onOpenTaskboardTab ? () => onOpenTaskboardTab(t.teamId || undefined) : undefined}
                leading={<Box sx={{ width: 4, height: 32, borderRadius: 1, bgcolor: TASK_COLOR[s], flexShrink: 0 }} />}
                title={t.title || '(无标题)'}
                subtitle={meta || undefined}
                trailing={<StatusTag label={REWARD_TASK_STATUS_LABEL[s]} color={TASK_COLOR[s]} bg={`${TASK_COLOR[s]}22`} />}
              />
            );
          })
        )}
      </MobileSection>

      {/* 我的需求 */}
      <MobileSection title="我的需求" extra={demands.length > 0 ? `${demands.length} 个` : undefined} moreLabel="管理" onMore={onOpenDemandTab} flush>
        {demandsQ.isLoading ? (
          <MobileSkeletonRows count={2} />
        ) : demands.length === 0 ? (
          <MobileEmpty>还没有发布过需求</MobileEmpty>
        ) : (
          demands.slice(0, 3).map((d, i) => {
            const meta = DEMAND_META[(d.status as DemandStatus) || 'PENDING'] || DEMAND_META.PENDING;
            return (
              <MobileListRow
                key={d.id}
                divider={i > 0}
                onClick={onOpenDemandDetail && d.id ? () => onOpenDemandDetail(d.id as number) : undefined}
                title={d.title || '(无标题)'}
                subtitle={
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <StatusTag label={meta.label} color={meta.color} bg={meta.bg} />
                    {(d.pay != null || d.payDiamonds != null) && (
                      <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>
                        {formatDiamonds(demandPayDiamonds(d))}
                      </Box>
                    )}
                    <span>{timeAgo(d.createTime as any)}</span>
                  </Box>
                }
              />
            );
          })
        )}
      </MobileSection>

      {/* 我的团队 */}
      <MobileSection
        title="我的团队"
        extra={invites > 0 ? <Box component="span" sx={{ color: 'warning.main', fontWeight: 600 }}>{invites} 个邀请</Box> : undefined}
        onMore={onOpenTeamTab ? () => onOpenTeamTab() : undefined}
        flush
      >
        {teams.length === 0 ? (
          <MobileEmpty>还没有加入团队,结队可以一起认领任务</MobileEmpty>
        ) : (
          teams.slice(0, 3).map((t, i) => (
            <MobileListRow
              key={t.id}
              divider={i > 0}
              onClick={() => onOpenTeamTab?.(t.id)}
              leading={
                <Avatar src={t.avatar || undefined} variant="rounded" sx={{ width: 36, height: 36 }}>
                  <GroupsRoundedIcon fontSize="small" />
                </Avatar>
              }
              title={t.name}
              subtitle={`${ROLE_LABEL[t.myRole] || ''} · 份额 ${t.myShare} · ${t.memberCount} 人 · ${centsAsDiamonds(t.earnedCents)}`}
              trailing={
                <Button
                  size="small"
                  variant="text"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTaskboardTab?.(t.id);
                  }}
                  sx={{ minWidth: 0, flexShrink: 0, textTransform: 'none', fontSize: 13 }}
                >
                  任务
                </Button>
              }
            />
          ))
        )}
      </MobileSection>

      {/* 我的实现 */}
      <MobileSection title="我的实现" extra={realTotal > 0 ? `${realTotal} 条` : undefined} onMore={realTotal > 0 ? onOpenRealizationTab : undefined} flush>
        {realQ.isLoading ? (
          <MobileSkeletonRows count={2} />
        ) : (realQ.data?.list || []).filter(Boolean).length === 0 ? (
          <MobileEmpty>还没有验收通过的交付</MobileEmpty>
        ) : (
          <RealizationRowsMobile items={(realQ.data?.list || []).slice(0, 3)} />
        )}
      </MobileSection>

      {/* 积分流水 */}
      <MobileSection title="积分流水" extra={recordTotal > 0 ? `共 ${recordTotal} 笔` : undefined} flush>
        {pointQ.isLoading ? (
          <MobileSkeletonRows count={3} />
        ) : records.length === 0 ? (
          <MobileEmpty>暂无积分记录</MobileEmpty>
        ) : (
          records.map((rec, i) => {
            const meta = SOURCE_META[rec.sourceType] || SOURCE_META[''];
            const path = safeSitePath(rec.sourceUrl);
            return (
              <MobileListRow
                key={rec.id}
                divider={i > 0}
                onClick={path ? () => openRecord(rec) : undefined}
                leading={
                  <Box
                    sx={{
                      minWidth: 40,
                      height: 36,
                      px: 0.5,
                      borderRadius: 2,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: meta.bg,
                      color: meta.color,
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: 'monospace',
                    }}
                  >
                    {rec.point > 0 ? '+' : ''}
                    {rec.point}
                  </Box>
                }
                title={rec.sourceTitle || rec.info || '—'}
                subtitle={`${meta.label} · ${rec.createTime}`}
              />
            );
          })
        )}
        <Box ref={sentinel} sx={{ height: '1px' }} />
        <ListFooter loading={isFetchingNextPage} done={!hasNextPage && records.length > PAGE} />
      </MobileSection>
    </Box>
  );
}
