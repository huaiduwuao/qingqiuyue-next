'use client';

/**
 * 手机版任务看板。电脑版是五列拖拽看板 + 视角切换 + 三个下拉筛选 + 进度条 + 开发者提示,
 * 手机上五列放不下、拖拽也不好用。这里:
 *   一张小卡(视角 ▾ / 团队 ▾ + 完成进度)→ 吸顶的「状态胶囊横滑 + 筛选 + 刷新」一行 → 单列任务行
 *   → 右下角「新建任务」。状态变更(认领 / 提交 / 验收)点行进详情弹窗里做,和电脑版点卡片是同一个弹窗。
 */

import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { MobileSection } from '@/components/mobile/MobileSection';
import type { RewardTask, RewardTaskStatus, TaskPriority } from '@/beans/reward';
import type { MyTeam } from '@/apis/team';
import { normalizeRewardTaskStatus, REWARD_TASK_STATUS_COLOR, REWARD_TASK_STATUS_LABEL } from './status';
import { ListFooter, MobileChipRow, MobileEmpty, MobileFab, MobileSkeletonRows, StatusTag } from '../personal/mobileKit';

type ViewMode = 'mine' | 'published' | 'team';

const STATUSES: RewardTaskStatus[] = ['OPEN', 'CLAIMED', 'SUBMITTED', 'APPROVED', 'REJECTED'];
const PRIORITY_LABEL: Record<TaskPriority, string> = { P0: 'P0 紧急', P1: 'P1 普通', P2: 'P2 宽松' };
const PRIORITY_COLOR: Record<string, string> = { P0: 'primary.main', P1: 'warning.main', P2: 'divider' };

interface Props {
  viewMeta: Record<ViewMode, { label: string; desc: string }>;
  viewMode: ViewMode;
  onViewMode: (v: ViewMode) => void;
  teams: MyTeam[];
  teamId: number | null;
  onTeamId: (id: number | null) => void;
  tasks: RewardTask[];
  loading: boolean;
  progress: { total: number; approved: number; percent: number };
  priorityFilter: TaskPriority | '';
  onPriority: (p: TaskPriority | '') => void;
  assigneeFilter: number | '';
  onAssignee: (id: number | '') => void;
  assignees: { id: number; name: string }[];
  demandTitleMap: Map<number, string>;
  teamNameMap: Map<number, string>;
  onTaskClick: (t: RewardTask) => void;
  onOpenDemand?: (demandId: number) => void;
  onCreate: () => void;
  onRefresh: () => void;
}

function fmtDeadline(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return { label: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, overdue: d.getTime() < Date.now() };
}

export default function TaskboardMobile(p: Props) {
  const [status, setStatus] = useState<RewardTaskStatus | ''>('');
  const [viewAnchor, setViewAnchor] = useState<HTMLElement | null>(null);
  const [teamAnchor, setTeamAnchor] = useState<HTMLElement | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of p.tasks) {
      const s = normalizeRewardTaskStatus(t.status);
      c[s] = (c[s] || 0) + 1;
    }
    return c;
  }, [p.tasks]);
  const rows = status ? p.tasks.filter((t) => normalizeRewardTaskStatus(t.status) === status) : p.tasks;
  const filtering = !!p.priorityFilter || !!p.assigneeFilter;
  const teamName = p.teams.find((t) => t.id === p.teamId)?.name;
  const progressColor = p.progress.percent >= 67 ? 'success.main' : p.progress.percent >= 34 ? 'warning.main' : 'text.disabled';

  const dropBtn = (label: React.ReactNode, onClick: (e: React.MouseEvent<HTMLElement>) => void) => (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', minWidth: 0, fontSize: 15, fontWeight: 700, color: 'text.primary' }}
    >
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </Box>
      <ExpandMoreRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pb: 8 }}>
      {/* 视角 / 团队 + 完成进度 */}
      <MobileSection>
        <Box sx={{ pt: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          {dropBtn(p.viewMeta[p.viewMode].label, (e) => setViewAnchor(e.currentTarget))}
          {p.viewMode === 'team' &&
            (p.teams.length > 0 ? (
              dropBtn(teamName || '选择团队', (e) => setTeamAnchor(e.currentTarget))
            ) : (
              <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>
                还没有团队
              </Typography>
            ))}
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 12, color: 'text.secondary', flexShrink: 0 }}>
            完成 <Box component="span" sx={{ fontWeight: 700, color: progressColor }}>{p.progress.approved}/{p.progress.total}</Box>
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={p.progress.percent}
          sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: progressColor, borderRadius: 2 } }}
        />
      </MobileSection>

      <Menu anchorEl={viewAnchor} open={!!viewAnchor} onClose={() => setViewAnchor(null)}>
        {(Object.keys(p.viewMeta) as ViewMode[]).map((k) => (
          <MenuItem
            key={k}
            selected={k === p.viewMode}
            onClick={() => {
              p.onViewMode(k);
              setViewAnchor(null);
            }}
            sx={{ display: 'block', py: 1 }}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{p.viewMeta[k].label}</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{p.viewMeta[k].desc}</Typography>
          </MenuItem>
        ))}
      </Menu>
      <Menu anchorEl={teamAnchor} open={!!teamAnchor} onClose={() => setTeamAnchor(null)}>
        {p.teams.map((t) => (
          <MenuItem
            key={t.id}
            selected={t.id === p.teamId}
            onClick={() => {
              p.onTeamId(t.id);
              setTeamAnchor(null);
            }}
            sx={{ fontSize: 14 }}
          >
            {t.name}
          </MenuItem>
        ))}
      </Menu>

      {/* 状态胶囊 + 筛选 + 刷新 */}
      <MobileChipRow
        sticky
        items={[
          { value: '' as RewardTaskStatus | '', label: '全部', count: p.tasks.length },
          ...STATUSES.map((s) => ({ value: s as RewardTaskStatus | '', label: REWARD_TASK_STATUS_LABEL[s], count: counts[s] || 0 })),
        ]}
        value={status}
        onChange={setStatus}
        trailing={
          <>
            <IconButton size="small" aria-label="筛选" onClick={(e) => setFilterAnchor(e.currentTarget)} sx={{ color: filtering ? 'primary.main' : 'text.secondary' }}>
              <FilterListRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton size="small" aria-label="刷新" onClick={p.onRefresh} sx={{ color: 'text.secondary' }}>
              <RefreshRoundedIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </>
        }
      />
      <Menu anchorEl={filterAnchor} open={!!filterAnchor} onClose={() => setFilterAnchor(null)} slotProps={{ paper: { sx: { maxHeight: 420 } } }}>
        <ListSubheader sx={{ lineHeight: '32px' }}>优先级</ListSubheader>
        {(['', 'P0', 'P1', 'P2'] as (TaskPriority | '')[]).map((v) => (
          <MenuItem
            key={v || 'all'}
            selected={v === p.priorityFilter}
            onClick={() => {
              p.onPriority(v);
              setFilterAnchor(null);
            }}
            sx={{ fontSize: 14 }}
          >
            {v ? PRIORITY_LABEL[v] : '全部'}
          </MenuItem>
        ))}
        {p.viewMode !== 'mine' && p.assignees.length > 0 && [
          <Divider key="d" />,
          <ListSubheader key="h" sx={{ lineHeight: '32px' }}>
            负责人
          </ListSubheader>,
          ...[{ id: 0, name: '全部' }, ...p.assignees].map((a) => (
            <MenuItem
              key={`a-${a.id}`}
              selected={(a.id || '') === p.assigneeFilter}
              onClick={() => {
                p.onAssignee(a.id || '');
                setFilterAnchor(null);
              }}
              sx={{ fontSize: 14 }}
            >
              {a.name}
            </MenuItem>
          )),
        ]}
      </Menu>

      {/* 单列任务 */}
      <MobileSection flush>
        {p.loading ? (
          <MobileSkeletonRows count={5} />
        ) : rows.length === 0 ? (
          <MobileEmpty>
            {p.viewMode === 'team' && p.teams.length === 0
              ? '你还没有加入团队,先到「团队」页创建或加入一支'
              : status || filtering
                ? '当前筛选下没有任务'
                : '暂无任务'}
          </MobileEmpty>
        ) : (
          rows.map((t, i) => {
            const s = normalizeRewardTaskStatus(t.status);
            const dl = fmtDeadline(t.deadline);
            const demandTitle = t.demandId != null ? p.demandTitleMap.get(t.demandId) || `#${t.demandId}` : null;
            return (
              <Box
                key={t.id}
                onClick={() => p.onTaskClick(t)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: 1.75,
                  py: 1.25,
                  cursor: 'pointer',
                  borderTop: i > 0 ? '1px solid' : 0,
                  borderColor: 'divider',
                  WebkitTapHighlightColor: 'transparent',
                  '&:active': { bgcolor: 'action.hover' },
                }}
              >
                <Box sx={{ width: 3, alignSelf: 'stretch', borderRadius: 1, flexShrink: 0, bgcolor: PRIORITY_COLOR[t.priority || 'P2'] }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, color: dl?.overdue && s !== 'APPROVED' ? 'primary.main' : 'text.primary' }}>
                    {t.title || '(无标题)'}
                  </Typography>
                  <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1, fontSize: 12, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    <StatusTag label={REWARD_TASK_STATUS_LABEL[s]} color={REWARD_TASK_STATUS_COLOR[s]} />
                    {t.priority && <span>{t.priority}</span>}
                    {dl && (
                      <Box component="span" sx={{ color: dl.overdue && s !== 'APPROVED' ? 'primary.main' : undefined }}>
                        {dl.label}
                      </Box>
                    )}
                    <span>{t.assigneeName || '待认领'}</span>
                    {!!t.teamId && <span>{p.teamNameMap.get(t.teamId) || '团队'}</span>}
                    {demandTitle &&
                      (p.onOpenDemand ? (
                        <Box
                          component="span"
                          onClick={(e) => {
                            e.stopPropagation();
                            p.onOpenDemand!(t.demandId!);
                          }}
                          sx={{ color: 'text.primary', textDecoration: 'underline', textDecorationColor: 'rgba(128,128,128,0.4)', textUnderlineOffset: 2 }}
                        >
                          {demandTitle}
                        </Box>
                      ) : (
                        <span>{demandTitle}</span>
                      ))}
                  </Box>
                </Box>
                <ChevronRightRoundedIcon sx={{ fontSize: 20, color: 'text.disabled', flexShrink: 0 }} />
              </Box>
            );
          })
        )}
        <ListFooter done={!p.loading && rows.length > 0} />
      </MobileSection>

      <MobileFab label="新建任务" onClick={p.onCreate} />
    </Box>
  );
}
