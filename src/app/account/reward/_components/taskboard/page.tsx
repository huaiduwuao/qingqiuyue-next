'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupsIcon from '@mui/icons-material/Groups';
import FolderIcon from '@mui/icons-material/Folder';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  closestCorners,
} from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import { TaskDetailDialog } from './TaskDetailDialog';
import { TaskEditDialog } from './TaskEditDialog';
import { listTasks, claimTask, submitTask, reviewTask } from '@/apis/reward-task';
import { listProjects } from '@/apis/reward-project';
import { listGroups } from '@/apis/reward-group';
import { myPage as listDemands } from '@/apis/reward-demand';
import { useApp } from '@/contexts/AppContext';
import type { RewardTask, RewardTaskStatus, TaskPriority, DemandItem } from '@/beans/reward';

const STATUSES: RewardTaskStatus[] = ['OPEN', 'CLAIMED', 'SUBMITTED', 'APPROVED', 'REJECTED'];

const PRIORITY_LABEL: Record<TaskPriority, string> = { P0: 'P0 紧急', P1: 'P1 普通', P2: 'P2 宽松' };

type ViewMode = 'mine' | 'all' | 'team' | 'project';

const VIEW_META: Record<ViewMode, { label: string; icon: React.ReactNode; desc: string }> = {
  mine: { label: '我的任务', icon: <AssignmentIndIcon sx={{ fontSize: 14 }} />, desc: '我负责的跨团队任务' },
  all: { label: '全部', icon: <DashboardIcon sx={{ fontSize: 14 }} />, desc: '所有项目任务一览' },
  team: { label: '按团队', icon: <GroupsIcon sx={{ fontSize: 14 }} />, desc: '按团队维度筛选' },
  project: { label: '按项目', icon: <FolderIcon sx={{ fontSize: 14 }} />, desc: '按项目维度筛选' },
};

interface Props {
  initialProjectId?: number | null;
  initialGroupId?: number | null;
  initialViewMode?: ViewMode | null;
  initialDemandId?: number | null;
  onOpenDemandDetail?: (demandId: number) => void;
}

export default function TaskboardPage({ initialProjectId, initialGroupId, initialViewMode, initialDemandId, onOpenDemandDetail }: Props) {
  const { currentUser } = useApp();
  const currentUserId = currentUser?.id || 10086;

  // ?owner=1 query 用于演示/测试时切换为 owner 视角
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setIsOwner(params.get('owner') === '1');
    }
  }, []);

  // 视图模式 — 初始化逻辑:外部传 initialViewMode 优先,否则按 initial props 推断
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialViewMode || (initialGroupId ? 'team' : initialProjectId ? 'project' : 'project')
  );

  const [projectId, setProjectId] = useState<number | null>(initialProjectId ?? null);
  const [groupId, setGroupId] = useState<number | null>(initialGroupId ?? null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [detailTask, setDetailTask] = useState<RewardTask | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<RewardTask | null>(null);
  const [activeTask, setActiveTask] = useState<RewardTask | null>(null);

  // 筛选
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');
  const [assigneeFilter, setAssigneeFilter] = useState<number | ''>('');

  const isOwnerRef = useRef(isOwner);
  isOwnerRef.current = isOwner;

  const qc = useQueryClient();

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnackbar({ open: true, message, severity });

  // 项目列表
  const projectsQuery = useQuery({
    queryKey: ['taskboard', 'projects'],
    queryFn: () => listProjects({ pageSize: 50 }).then((r: any) => r.data?.records || r.data?.list || []),
    placeholderData: [],
  });
  const projects: any[] = projectsQuery.data || [];

  // 团队列表
  const groupsQuery = useQuery({
    queryKey: ['taskboard', 'groups'],
    queryFn: () => listGroups({ pageSize: 50 }).then((r: any) => r.data?.records || r.data?.list || []),
    placeholderData: [],
  });
  const groups: any[] = groupsQuery.data || [];

  // 需求列表
  const demandsQuery = useQuery({
    queryKey: ['taskboard', 'demands'],
    queryFn: () => listDemands({ pageSize: 100 }).then((r: any) => (r.data?.records || r.data?.list || []) as DemandItem[]),
    placeholderData: [],
  });
  const demands: DemandItem[] = demandsQuery.data || [];

  // 任务列表 — 根据 viewMode 决定过滤维度
  const tasksQuery = useQuery({
    queryKey: ['taskboard', 'tasks', viewMode, projectId, groupId, currentUserId, initialDemandId],
    queryFn: async () => {
      const params: any = { pageSize: 100 };
      if (viewMode === 'mine') {
        params.assigneeId = currentUserId;
      } else if (viewMode === 'team') {
        params.groupId = groupId;
      } else if (viewMode === 'project') {
        params.projectId = projectId;
      }
      if (initialDemandId) params.demandId = initialDemandId;
      const res: any = await listTasks(params);
      return res?.data?.records || [];
    },
    enabled:
      viewMode === 'mine' ||
      (viewMode === 'project' && !!projectId) ||
      (viewMode === 'team' && !!groupId),
    placeholderData: [],
  });
  const tasks: RewardTask[] = tasksQuery.data || [];
  const loading = tasksQuery.isLoading;

  // 数据加载完后,设置默认 projectId / groupId(原 useEffect 内的副作用)
  useEffect(() => {
    if (!projectId && projects.length > 0) setProjectId(projects[0].id);
    if (!groupId && groups.length > 0 && !initialGroupId) setGroupId(groups[0].id);
    if (initialDemandId) {
      const d = demands.find((x) => x.id === initialDemandId);
      if (d && d.taskIds && d.taskIds.length > 0) {
        const firstTask = (d as any).__firstTaskProjectId;
        if (firstTask) setProjectId(firstTask);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, groups, demands]);

  // 拖拽状态变更 — claim / submit / review
  const updateTaskMutation = useMutation({
    mutationFn: async (vals: { id: number; status: RewardTaskStatus; deliverable?: string }) => {
      const { id, status, deliverable } = vals;
      if (status === 'CLAIMED') {
        return claimTask(id);
      } else if (status === 'SUBMITTED') {
        return submitTask(id, deliverable || '(拖拽提交)');
      } else if (status === 'APPROVED') {
        return reviewTask(id, true, '通过');
      } else if (status === 'REJECTED') {
        return reviewTask(id, false, '驳回');
      }
      return undefined;
    },
    onSuccess: () => {
      showMessage('状态已更新', 'success');
      qc.invalidateQueries({ queryKey: ['taskboard', 'tasks', viewMode, projectId, groupId, currentUserId, initialDemandId] });
    },
    onError: (err: any) => {
      showMessage(err?.message || '操作失败', 'error');
    },
  });

  // demandId → title 映射(给 TaskCard 显示用)
  const demandTitleMap = useMemo(() => {
    const m = new Map<number, string>();
    demands.forEach((d) => {
      if (d.id != null) m.set(d.id, (d.title || '').slice(0, 8) + ((d.title || '').length > 8 ? '…' : ''));
    });
    return m;
  }, [demands]);

  // groupId → name 映射(TaskCard 显示多团队 chip)
  const groupNameMap = useMemo(() => {
    const m = new Map<number, string>();
    groups.forEach((g) => m.set(g.id, g.name || `团队 ${g.id}`));
    return m;
  }, [groups]);

  // 客户端二次筛选
  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (assigneeFilter && t.assigneeId !== assigneeFilter) return false;
      return true;
    });
  }, [tasks, priorityFilter, assigneeFilter]);

  const grouped = useMemo(() => {
    const m: Record<RewardTaskStatus, RewardTask[]> = {
      OPEN: [], CLAIMED: [], SUBMITTED: [], APPROVED: [], REJECTED: [],
    };
    for (const t of filtered) {
      const s = (t.status || 'OPEN') as RewardTaskStatus;
      if (m[s]) m[s].push(t);
    }
    return m;
  }, [filtered]);

  // 进度统计
  const progress = useMemo(() => {
    const total = filtered.length;
    const approved = filtered.filter((t) => t.status === 'APPROVED').length;
    return { total, approved, percent: total > 0 ? Math.round((approved / total) * 100) : 0 };
  }, [filtered]);

  // 我的任务小卡(所有视图下都计算,顶部小条用)
  const myStats = useMemo(() => {
    const all = tasks.filter((t) => t.assigneeId === currentUserId);
    return {
      total: all.length,
      inProgress: all.filter((t) => t.status === 'CLAIMED').length,
      submitted: all.filter((t) => t.status === 'SUBMITTED').length,
      approved: all.filter((t) => t.status === 'APPROVED').length,
    };
  }, [tasks, currentUserId]);

  const progressColor = progress.percent >= 67 ? 'success.main' : progress.percent >= 34 ? 'warning.main' : 'text.disabled';

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (e: DragStartEvent) => {
    const t = tasks.find((x) => x.id === e.active.id);
    setActiveTask(t || null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;

    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;

    let targetStatus: RewardTaskStatus | null = null;
    if (typeof over.id === 'string' && over.id.startsWith('col-')) {
      targetStatus = over.id.slice(4) as RewardTaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) targetStatus = (overTask.status || 'OPEN') as RewardTaskStatus;
    }
    if (!targetStatus) return;
    if (targetStatus === task.status) return;

    const isAssignee = task.assigneeId === currentUserId;
    if (targetStatus === 'CLAIMED' && task.status === 'OPEN') {
      // 任意人都能领
    } else if (targetStatus === 'CLAIMED' && task.status === 'REJECTED') {
      if (!isAssignee) {
        showMessage('只有原负责人可以重新认领', 'error');
        return;
      }
    } else if (targetStatus === 'SUBMITTED') {
      if (!isAssignee) {
        showMessage('只有负责人可以提交', 'error');
        return;
      }
    } else if (targetStatus === 'APPROVED' || targetStatus === 'REJECTED') {
      if (!isOwnerRef.current) {
        showMessage('只有项目主/团队长可以审稿', 'error');
        return;
      }
    } else {
      showMessage('非法的状态流转', 'error');
      return;
    }

    updateTaskMutation.mutate({
      id: task.id!,
      status: targetStatus,
      deliverable: task.deliverable ?? undefined,
    });
  };

  const handleTaskChanged = (updated: RewardTask) => {
    setDetailTask(updated);
    showMessage('操作成功');
    qc.invalidateQueries({ queryKey: ['taskboard', 'tasks', viewMode, projectId, groupId, currentUserId, initialDemandId] });
  };

  const handleTaskDeleted = (id: number) => {
    setDetailTask(null);
    showMessage('已删除');
    qc.invalidateQueries({ queryKey: ['taskboard', 'tasks', viewMode, projectId, groupId, currentUserId, initialDemandId] });
  };

  const handleSaved = (t: RewardTask) => {
    setEditOpen(false);
    setEditRecord(null);
    showMessage('保存成功');
    qc.invalidateQueries({ queryKey: ['taskboard', 'tasks', viewMode, projectId, groupId, currentUserId, initialDemandId] });
  };

  const allAssignees = useMemo(() => {
    const m = new Map<number, { id: number; name: string; avatar: string }>();
    for (const t of tasks) {
      if (t.assigneeId && t.assigneeName) m.set(t.assigneeId, { id: t.assigneeId, name: t.assigneeName, avatar: t.assigneeAvatar || '' });
    }
    return Array.from(m.values());
  }, [tasks]);

  // 当前生效的 groupId / projectId(用于决定 owner 权限,新建任务时塞进 projectId)
  const activeProjectIdForCreate = useMemo(() => {
    if (viewMode === 'project') return projectId || 0;
    if (viewMode === 'team' && groupId) {
      // 跨团队任务(groupIds 含本组)也参与
      const sample = tasks.find((t) =>
        (Array.isArray(t.groupIds) && t.groupIds.includes(groupId)) || t.groupId === groupId
      );
      return sample?.projectId || 0;
    }
    if (viewMode === 'mine') {
      const sample = tasks.find((t) => t.assigneeId === currentUserId);
      return sample?.projectId || 0;
    }
    return projectId || 0;
  }, [viewMode, projectId, groupId, tasks, currentUserId]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
      {/* 视图模式 tabs */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          size="small"
          onChange={(_, v) => v && setViewMode(v)}
          sx={{
            '& .MuiToggleButton-root': {
              px: 1.5,
              py: 0.5,
              fontSize: 12,
              border: '1px solid',
              borderColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB',
              color: 'text.secondary',
              textTransform: 'none',
              '&.Mui-selected': {
                bgcolor: 'rgba(6, 182, 212, 0.18)',
                color: '#06B6D4',
                borderColor: '#06B6D4',
                '&:hover': { bgcolor: 'rgba(6, 182, 212, 0.24)' },
              },
            },
          }}
        >
          {(Object.keys(VIEW_META) as ViewMode[]).map((k) => (
            <ToggleButton key={k} value={k}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {VIEW_META[k].icon}
                {VIEW_META[k].label}
              </Box>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>{VIEW_META[viewMode].desc}</Typography>
      </Box>

      {/* 筛选行 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        {viewMode === 'project' && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>选择项目</InputLabel>
            <Select
              value={projectId ?? ''}
              label="选择项目"
              onChange={(e) => setProjectId(Number(e.target.value) || null)}
            >
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name || `项目 ${p.id}`}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {viewMode === 'team' && (
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>选择团队</InputLabel>
            <Select
              value={groupId ?? ''}
              label="选择团队"
              onChange={(e) => setGroupId(Number(e.target.value) || null)}
            >
              {groups.map((g) => (
                <MenuItem key={g.id} value={g.id}>{g.name || `团队 ${g.id}`}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>优先级</InputLabel>
          <Select value={priorityFilter} label="优先级" onChange={(e) => setPriorityFilter(e.target.value as any)}>
            <MenuItem value="">全部</MenuItem>
            {(['P0', 'P1', 'P2'] as TaskPriority[]).map((p) => (
              <MenuItem key={p} value={p}>{PRIORITY_LABEL[p]}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {viewMode !== 'mine' && (
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>负责人</InputLabel>
            <Select value={assigneeFilter} label="负责人" onChange={(e) => setAssigneeFilter(Number(e.target.value) || '')}>
              <MenuItem value="">全部</MenuItem>
              {allAssignees.map((a) => (
                <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <Box sx={{ flex: 1 }} />

        {isOwner && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditRecord(null);
              setEditOpen(true);
            }}
            disabled={!activeProjectIdForCreate}
            sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: '#E61E47' } }}
          >
            新建任务
          </Button>
        )}

        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
          onClick={() => qc.invalidateQueries({ queryKey: ['taskboard', 'tasks', viewMode, projectId, groupId, currentUserId, initialDemandId] })}
          sx={{ borderColor: 'divider', color: 'text.secondary' }}
        >
          刷新
        </Button>
      </Box>

      {/* 我的任务小卡(视图模式 != mine 时也显示,作为速览) */}
      {viewMode !== 'mine' && myStats.total > 0 && (
        <Card sx={{ bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0F1018' : '#FFFFFF', border: '1px solid', borderColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB' }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3, p: '12px !important' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <AssignmentIndIcon sx={{ fontSize: 16, color: '#06B6D4' }} />
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>我负责的任务</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Stat label="总数" value={myStats.total} color="text.primary" />
              <Stat label="进行中" value={myStats.inProgress} color="secondary.main" />
              <Stat label="待验收" value={myStats.submitted} color="warning.main" />
              <Stat label="已完成" value={myStats.approved} color="#8B5CF6" />
            </Box>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              onClick={() => setViewMode('mine')}
              sx={{ color: '#06B6D4', fontSize: 11, textTransform: 'none' }}
            >
              跳转到我的任务 →
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 进度条 */}
      <Box sx={{ p: 1.5, bgcolor: (theme) => theme.palette.mode === 'dark' ? '#0F1018' : '#FAFAFA', border: '1px solid', borderColor: (theme) => theme.palette.mode === 'dark' ? '#252836' : '#E5E7EB', borderRadius: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.75 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>当前视图进度</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: progressColor }}>
            {progress.approved} / {progress.total} ({progress.percent}%)
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
            提示:仅 owner 可新建/审稿(URL 加 ?owner=1 切换)
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress.percent}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'action.hover',
            '& .MuiLinearProgress-bar': { bgcolor: progressColor, borderRadius: 3 },
          }}
        />
      </Box>

      {loading && <LinearProgress sx={{ height: 2 }} />}

      {/* 看板 */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Box sx={{ display: 'flex', gap: 1, flex: 1, minHeight: 0, alignItems: 'stretch' }}>
          {STATUSES.map((s) => (
            <KanbanColumn
              key={s}
              status={s}
              tasks={grouped[s]}
              onTaskClick={setDetailTask}
              onOpenDemand={onOpenDemandDetail}
              demandTitleMap={demandTitleMap}
              groupNameMap={groupNameMap}
            />
          ))}
        </Box>
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} isOverlay />}
        </DragOverlay>
      </DndContext>

      <TaskDetailDialog
        open={!!detailTask}
        task={detailTask}
        isOwner={isOwner}
        currentUserId={currentUserId}
        onClose={() => setDetailTask(null)}
        onChanged={handleTaskChanged}
        onDeleted={handleTaskDeleted}
        onError={(m) => showMessage(m, 'error')}
      />

      <TaskEditDialog
        open={editOpen}
        record={editRecord}
        projectId={activeProjectIdForCreate}
        groupId={groupId}
        groups={groups}
        onClose={() => {
          setEditOpen(false);
          setEditRecord(null);
        }}
        onSaved={handleSaved}
        onError={(m) => showMessage(m, 'error')}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
      <Typography sx={{ fontSize: 16, fontWeight: 700, color }}>{value}</Typography>
      <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{label}</Typography>
    </Box>
  );
}
