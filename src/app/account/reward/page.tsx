'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { WorkspaceShell } from '../components/WorkspaceShell';
import { useUrlTab } from '../components/useUrlTab';
import { REWARD_HOME_TAB, REWARD_NAV, REWARD_TAB_IDS } from './navigation';

// 赏金广场的右栏(达人榜 / 最近动态);只挂在首页那个 tab 上。
const RewardAside = React.lazy(() => import('./_components/dashboard/RewardAside'));

// 子页面按需加载;放在模块顶层,避免每次渲染重新创建 lazy 组件导致子页面反复卸载重挂。
const VIEWS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  square: React.lazy(() => import('./_components/dashboard/page')),
  workspace: React.lazy(() => import('./_components/personal/page')),
  demands: React.lazy(() => import('./_components/demand/page')),
  realizations: React.lazy(() => import('./_components/realization/page')),
  board: React.lazy(() => import('./_components/taskboard/page')),
  teams: React.lazy(() => import('./_components/team/page')),
  tasks: React.lazy(() => import('./_components/daily-task/page')),
  invite: React.lazy(() => import('./_components/invite/page')),
  benefit: React.lazy(() => import('./_components/monthly-benefit/page')),
  achievements: React.lazy(() => import('./_components/achievement/page')),
};

/** 任务看板的聚焦对象(从团队 / 需求跳过来时预选)。 */
interface BoardFocus {
  teamId?: number | null;
  demandId?: number | null;
}

export default function AccountRewardPage() {
  return (
    // useUrlTab 读取 ?tab=,静态导出要求放在 Suspense 边界内
    <Suspense fallback={null}>
      <RewardCenter />
    </Suspense>
  );
}

function RewardLogo() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 32,
        height: 32,
        borderRadius: 1,
        background: (theme) => `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.primary.main} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'background.default',
      }}
    >
      <LocalFireDepartmentIcon sx={{ fontSize: 18 }} />
    </Box>
  );
}

function RewardCenter() {
  const [tab, setTab] = useUrlTab(REWARD_TAB_IDS, REWARD_HOME_TAB);
  const [boardFocus, setBoardFocus] = useState<BoardFocus>({});
  const [teamFocus, setTeamFocus] = useState<number | null>(null);

  // 意境页的深链:?tab=board&demand=<id> 落在这个需求的任务上,?tab=teams&team=<id> 直接打开团队主页。
  // 读完就从地址栏去掉,刷新不会反复触发。
  useEffect(() => {
    const url = new URL(window.location.href);
    const demand = Number(url.searchParams.get('demand'));
    const team = Number(url.searchParams.get('team'));
    if (!demand && !team) return;
    if (demand) setBoardFocus({ demandId: demand });
    if (team) setTeamFocus(team);
    url.searchParams.delete('demand');
    url.searchParams.delete('team');
    window.history.replaceState(window.history.state, '', url.toString());
  }, []);

  const openBoard = (focus: BoardFocus) => {
    setBoardFocus(focus);
    setTab('board');
  };
  const go = (target: string) => () => {
    if (target !== 'board') setBoardFocus({});
    setTab(target);
  };

  const View = VIEWS[tab] ?? VIEWS[REWARD_HOME_TAB];
  const viewProps =
    tab === 'workspace'
      ? {
          onOpenDemandTab: go('demands'),
          onOpenDemandDetail: (did: number) => openBoard({ demandId: did }),
          onOpenRealizationTab: go('realizations'),
          onOpenTaskboardTab: (teamId?: number) => openBoard(teamId ? { teamId } : {}),
          onOpenTeamTab: (teamId?: number) => {
            setTeamFocus(teamId ?? null);
            setTab('teams');
          },
        }
      : tab === 'board'
        ? {
            initialTeamId: boardFocus.teamId ?? null,
            initialDemandId: boardFocus.demandId ?? null,
            onOpenDemandDetail: (did: number) => openBoard({ demandId: did }),
          }
        : tab === 'teams'
          ? { initialTeamId: teamFocus, onOpenTaskboard: (teamId: number) => openBoard({ teamId }) }
          : tab === 'demands'
            ? { onOpenTaskboard: (did: number) => openBoard({ demandId: did }) }
            : {};

  return (
    <WorkspaceShell
      title="奖励中心"
      logo={<RewardLogo />}
      groups={REWARD_NAV}
      selected={tab}
      onSelect={setTab}
      // 赏金广场才有右栏(达人榜 / 最近动态);其它子页是整幅的看板/表格。
      aside={tab === REWARD_HOME_TAB ? <RewardAside /> : undefined}
    >
      <Suspense
        fallback={
          <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>加载中...</Typography>
        }
      >
        {/* key:从需求 / 团队跳到看板时聚焦对象变了,看板要按新的初始值重建 */}
        <View
          key={tab === 'board' ? `board-${boardFocus.teamId ?? 0}-${boardFocus.demandId ?? 0}` : tab === 'teams' ? `teams-${teamFocus ?? 0}` : tab}
          {...viewProps}
        />
      </Suspense>
    </WorkspaceShell>
  );
}
