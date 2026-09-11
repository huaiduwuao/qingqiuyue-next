'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import { listGroups, type GroupInfo } from '@/apis/reward-group';
import { WorkspaceShell } from '../components/WorkspaceShell';
import { useUrlTab } from '../components/useUrlTab';
import { REWARD_HOME_TAB, REWARD_NAV, REWARD_TAB_IDS, TEAM_SCOPED_TABS } from './navigation';

// 子页面按需加载;放在模块顶层,避免每次渲染重新创建 lazy 组件导致子页面反复卸载重挂。
const VIEWS: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  square: React.lazy(() => import('./_components/dashboard/page')),
  workspace: React.lazy(() => import('./_components/personal/page')),
  demands: React.lazy(() => import('./_components/demand/page')),
  conceptions: React.lazy(() => import('./_components/conception/page')),
  realizations: React.lazy(() => import('./_components/realization/page')),
  projects: React.lazy(() => import('./_components/project/page')),
  board: React.lazy(() => import('./_components/taskboard/page')),
  teams: React.lazy(() => import('./_components/group/page')),
  tasks: React.lazy(() => import('./_components/daily-task/page')),
  invite: React.lazy(() => import('./_components/invite/page')),
  benefit: React.lazy(() => import('./_components/monthly-benefit/page')),
  achievements: React.lazy(() => import('./_components/achievement/page')),
};

/** 协作看板的聚焦对象(从项目 / 团队 / 需求跳过来时预选)。 */
interface BoardFocus {
  projectId?: number | null;
  groupId?: number | null;
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
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [groupId, setGroupId] = useState<number | ''>('');
  const [boardFocus, setBoardFocus] = useState<BoardFocus>({});

  // 需求/意境/实现/项目的列表与创建都依赖团队:拉取我的团队并默认选中第一个。
  // 切换子页面时重拉,保证「团队」里新建的团队即时生效。
  useEffect(() => {
    let alive = true;
    listGroups({ pageSize: 50 })
      .then((res: any) => {
        if (!alive) return;
        const payload = res?.data ?? res;
        const list: GroupInfo[] = payload?.records || payload?.list || (Array.isArray(payload) ? payload : []);
        setGroups(list);
        setGroupId((prev) => (prev && list.some((g) => g.id === prev) ? prev : list[0]?.id ?? ''));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tab]);

  const openBoard = (focus: BoardFocus) => {
    setBoardFocus(focus);
    setTab('board');
  };
  const openWithGroup = (target: string) => (gid: number) => {
    if (gid) setGroupId(gid);
    setTab(target);
  };

  const View = VIEWS[tab] ?? VIEWS[REWARD_HOME_TAB];
  const viewProps =
    tab === 'workspace'
      ? {
          groups,
          selectedGroupId: groupId,
          onOpenDemandTab: openWithGroup('demands'),
          onOpenDemandDetail: (gid: number, did: number) => {
            if (gid) setGroupId(gid);
            openBoard({ demandId: did });
          },
          onOpenRealizationTab: openWithGroup('realizations'),
          onOpenProjectTab: openWithGroup('projects'),
          onOpenTaskboardTab: (gid: number) => {
            if (gid) setGroupId(gid);
            openBoard({ groupId: gid });
          },
          onOpenGroupTab: openWithGroup('teams'),
        }
      : {
          groupId,
          groupData: groups,
          onOpenTaskboard:
            tab === 'projects'
              ? (pid: number) => openBoard({ projectId: pid })
              : tab === 'teams'
                ? (gid: number) => openBoard({ groupId: gid })
                : tab === 'demands'
                  ? (did: number) => openBoard({ demandId: did })
                  : undefined,
          onOpenDemandDetail:
            tab === 'board' || tab === 'realizations' || tab === 'conceptions'
              ? (did: number) => openBoard({ demandId: did })
              : undefined,
          initialProjectId: tab === 'board' ? boardFocus.projectId ?? null : null,
          initialGroupId: tab === 'board' ? boardFocus.groupId ?? null : null,
          initialDemandId:
            tab === 'board' ? boardFocus.demandId ?? null : null,
        };

  return (
    <WorkspaceShell title="奖励中心" logo={<RewardLogo />} groups={REWARD_NAV} selected={tab} onSelect={setTab}>
      {TEAM_SCOPED_TABS.has(tab) && (
        <TeamBar groups={groups} groupId={groupId} onChange={setGroupId} onCreate={() => setTab('teams')} />
      )}
      <Suspense
        fallback={
          <Typography sx={{ p: 4, textAlign: 'center', color: 'text.secondary', fontSize: 13 }}>加载中...</Typography>
        }
      >
        <View {...viewProps} />
      </Suspense>
    </WorkspaceShell>
  );
}

function TeamBar({
  groups,
  groupId,
  onChange,
  onCreate,
}: {
  groups: GroupInfo[];
  groupId: number | '';
  onChange: (id: number) => void;
  onCreate: () => void;
}) {
  if (groups.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          需求、意境、实现和项目都归属于团队,先创建或加入一个团队。
        </Typography>
        <Button size="small" variant="outlined" onClick={onCreate} sx={{ textTransform: 'none' }}>
          去创建团队
        </Button>
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>当前团队</Typography>
      <TextField
        select
        size="small"
        value={groupId}
        onChange={(e) => onChange(Number(e.target.value))}
        sx={{ minWidth: 200 }}
        slotProps={{ htmlInput: { 'aria-label': '当前团队' } }}
      >
        {groups.map((g) => (
          <MenuItem key={g.id} value={g.id}>
            {g.name}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
}
