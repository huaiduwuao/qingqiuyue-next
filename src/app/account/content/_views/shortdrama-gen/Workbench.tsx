'use client';

/**
 * 短剧工作台:左侧分区导航(概览 / 剧本 / 角色 / 场景 / 道具 / 分镜 / 任务 / 设置),
 * 中间内容,右侧「数字员工活动」面板(当前任务实时日志 + 修改意见输入)。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import FaceRoundedIcon from '@mui/icons-material/FaceRounded';
import LandscapeRoundedIcon from '@mui/icons-material/LandscapeRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import ViewCarouselRoundedIcon from '@mui/icons-material/ViewCarouselRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getDetailRoute } from '@/lib/contentRoute';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import { AGENT_LABELS, STEP_LABELS, dramaAPI, isTaskTerminal, type Step, type Task } from '@/apis/shortdrama';
import { TaskStatusChip, fmtTime } from './common';
import { qk, useFeedback, useOverview, useProjectEvents, useStartTask } from './useProject';
import OverviewSection from './sections/OverviewSection';
import ScriptSection from './sections/ScriptSection';
import EntitySection from './sections/EntitySection';
import StoryboardSection from './sections/StoryboardSection';
import TasksSection from './sections/TasksSection';
import SettingsSection from './sections/SettingsSection';
import { BOARD_STEPS, FiveStepBoard } from './FiveStepBoard';

export type SectionId = 'overview' | 'script' | 'characters' | 'scenes' | 'props' | 'storyboard' | 'tasks' | 'settings';

const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: '概览', icon: <DashboardRoundedIcon fontSize="small" /> },
  { id: 'script', label: '剧本', icon: <DescriptionRoundedIcon fontSize="small" /> },
  { id: 'characters', label: '角色', icon: <FaceRoundedIcon fontSize="small" /> },
  { id: 'scenes', label: '场景', icon: <LandscapeRoundedIcon fontSize="small" /> },
  { id: 'props', label: '道具', icon: <CategoryRoundedIcon fontSize="small" /> },
  { id: 'storyboard', label: '分镜', icon: <ViewCarouselRoundedIcon fontSize="small" /> },
  { id: 'tasks', label: '任务', icon: <TaskAltRoundedIcon fontSize="small" /> },
  { id: 'settings', label: '设置', icon: <SettingsRoundedIcon fontSize="small" /> },
];

/** 反馈目标:由各分区在用户选中某个实体时设置。 */
export interface FeedbackTarget {
  type: 'project' | 'episode' | 'character' | 'scene' | 'prop' | 'shot';
  id: number;
  label: string;
}

export interface SectionProps {
  projectId: number;
  setSection: (s: SectionId, opts?: { episodeId?: number }) => void;
  setFeedbackTarget: (t: FeedbackTarget | null) => void;
  episodeId: number;
  setEpisodeId: (id: number) => void;
}

export default function Workbench({ projectId, onExit }: { projectId: number; onExit: () => void }) {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const [section, setSectionState] = useState<SectionId>('overview');
  const [episodeId, setEpisodeId] = useState(0);
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget | null>(null);
  const [activityOpen, setActivityOpen] = useState(true);
  const overview = useOverview(projectId);
  const { liveTask, connected } = useProjectEvents(projectId);
  const start = useStartTask(projectId);

  const setSection = (s: SectionId, opts?: { episodeId?: number }) => {
    if (opts?.episodeId) setEpisodeId(opts.episodeId);
    setSectionState(s);
  };

  // 默认选中第一集
  useEffect(() => {
    if (!episodeId && overview.data?.episodes?.length) setEpisodeId(overview.data.episodes[0].id);
  }, [overview.data, episodeId]);

  const running: Task | null = useMemo(() => {
    if (liveTask && !isTaskTerminal(liveTask.status)) return liveTask;
    if (overview.data?.running) return overview.data.running;
    return null;
  }, [liveTask, overview.data]);
  const lastTask: Task | null = liveTask ?? overview.data?.tasks?.[0] ?? null;

  const p = overview.data?.project;
  const sectionProps: SectionProps = { projectId, setSection, setFeedbackTarget, episodeId, setEpisodeId };

  // 发布成标准作品(module_content SHORT_DRAMA):进"我的作品"与内容审核,和普通投稿同一条路。
  // 已发布过的项目再点是更新同一件作品(分集随镜头产出刷新)。
  const queryClient = useQueryClient();
  const publish = useMutation({
    mutationFn: () => dramaAPI.publish(projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.overview(projectId) }),
  });
  const publishedRoute = p?.content_id ? getDetailRoute('SHORT_DRAMA', p.content_id) : null;

  const [runMenu, setRunMenu] = useState<null | HTMLElement>(null);
  const projectSteps: Step[] = ['pipeline', 'screenwriter', 'visual_design'];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 120px)' }}>
      {/* 顶栏 */}
      <Paper square elevation={0} sx={{ px: { xs: 1.5, md: 2 }, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Stack sx={{ alignItems: 'center', flexWrap: 'wrap' }} direction="row" spacing={1} useFlexGap>
          <IconButton size="small" onClick={onExit} aria-label="返回项目列表">
            <ArrowBackRoundedIcon />
          </IconButton>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 700 }} variant="subtitle1" noWrap>
              {p?.title ?? '加载中…'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {p ? `${p.genre || '未定题材'} · ${p.style} · ${p.episodes} 集 × ${p.ep_seconds}s · ${p.aspect}` : ''}
            </Typography>
          </Box>
          {running ? (
            <Stack sx={{ alignItems: 'center' }} direction="row" spacing={1}>
              <Chip size="small" color="primary" icon={<SmartToyRoundedIcon />} label={`${AGENT_LABELS[running.agent] ?? running.agent} · ${running.title} ${running.progress}%`} />
              <Tooltip title="取消当前任务">
                <IconButton size="small" color="error" onClick={() => dramaAPI.cancelTask(running.id)}>
                  <StopRoundedIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : (
            <>
              <Button size="small" variant="contained" startIcon={<PlayArrowRoundedIcon />} onClick={(e) => setRunMenu(e.currentTarget)} disabled={start.isPending}>
                运行
              </Button>
              <Menu open={!!runMenu} anchorEl={runMenu} onClose={() => setRunMenu(null)}>
                {projectSteps.map((s) => (
                  <MenuItem
                    key={s}
                    onClick={() => {
                      setRunMenu(null);
                      start.mutate({ step: s });
                      setActivityOpen(true);
                    }}
                  >
                    {STEP_LABELS[s]}
                    {s === 'pipeline' && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        全流程
                      </Typography>
                    )}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
          {p && (
            <Tooltip title={p.content_id ? '更新已发布的作品(分集随最新镜头产出刷新)' : '发布成短剧作品:进入"我的作品"并提交内容审核'}>
              <span>
                <Button size="small" variant={p.content_id ? 'text' : 'outlined'} startIcon={<PublishRoundedIcon />} onClick={() => publish.mutate()} disabled={publish.isPending || !!running}>
                  {publish.isPending ? '发布中…' : p.content_id ? '更新作品' : '发布为作品'}
                </Button>
              </span>
            </Tooltip>
          )}
          {publishedRoute && (
            <Chip size="small" variant="outlined" color="success" icon={<OpenInNewRoundedIcon />} label="已发布 · 查看作品" component="a" href={publishedRoute} target="_blank" clickable />
          )}
          <Tooltip title={connected ? '实时连接正常' : '实时连接断开,重连中'}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: connected ? 'success.main' : 'warning.main' }} />
          </Tooltip>
          {!narrow && (
            <Button size="small" variant={activityOpen ? 'outlined' : 'text'} onClick={() => setActivityOpen((v) => !v)}>
              活动
            </Button>
          )}
        </Stack>
        {running && <LinearProgress variant={running.progress > 0 ? 'determinate' : 'indeterminate'} value={running.progress} sx={{ mt: 1, borderRadius: 1 }} />}
        {publish.isError && (
          <Alert severity="error" sx={{ mt: 1 }} onClose={() => publish.reset()}>
            发布失败:{(publish.error as Error).message}
          </Alert>
        )}
        {publish.isSuccess && publish.data && (
          <Alert severity="success" sx={{ mt: 1 }} onClose={() => publish.reset()}>
            已作为短剧作品提交:{publish.data.episodes} 集、{publish.data.shots} 个镜头
            {publish.data.missing_render > 0 ? `(${publish.data.missing_render} 个镜头还没有画面,出图后再点"更新作品"即可补上)` : ''}
            ,状态 {publish.data.status === 'REVIEWING' ? '审核中' : publish.data.status}。
          </Alert>
        )}
        {start.isError && (
          <Alert severity="error" sx={{ mt: 1 }} onClose={() => start.reset()}>
            {(start.error as Error).message}
          </Alert>
        )}
      </Paper>

      {/* G1:5 步看板 —— 剧本 → 主题 → 分镜提示词 → 故事板分镜图 → 成片合成 */}
      {p && (
        <Box sx={{ px: { xs: 1.5, md: 2 }, py: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
          <FiveStepBoard
            currentStage={p.stage}
            status={p.status}
            running={running}
            canStart={!start.isPending}
            disabled={!!running}
            onStartStep={(bs) => {
              // 启动该看板步对应后端 step 列表的第一个 step;同一个 step 也可以再次启动覆盖
              const firstBackend = bs.backendSteps[0];
              start.mutate({ step: firstBackend });
              setActivityOpen(true);
            }}
          />
        </Box>
      )}

      {narrow && (
        <Tabs value={section} onChange={(_, v) => setSectionState(v)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider' }}>
          {SECTIONS.map((s) => (
            <Tab key={s.id} value={s.id} label={s.label} sx={{ minWidth: 72 }} />
          ))}
          <Tab value="__activity" label="活动" sx={{ minWidth: 72 }} onClick={() => setActivityOpen(true)} />
        </Tabs>
      )}

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 左侧分区导航 */}
        {!narrow && (
          <List dense sx={{ width: 168, flexShrink: 0, borderRight: 1, borderColor: 'divider', py: 1 }}>
            {SECTIONS.map((s) => (
              <ListItemButton key={s.id} selected={section === s.id} onClick={() => setSectionState(s.id)} sx={{ borderRadius: 1, mx: 1 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>{s.icon}</ListItemIcon>
                <ListItemText primary={s.label} />
              </ListItemButton>
            ))}
          </List>
        )}

        {/* 中间内容 */}
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto', p: { xs: 1.5, md: 2.5 } }}>
          {overview.isError ? (
            <Alert severity="error" action={<Button onClick={onExit}>返回</Button>}>
              {(overview.error as Error).message}
            </Alert>
          ) : (
            <>
              {section === 'overview' && <OverviewSection {...sectionProps} />}
              {section === 'script' && <ScriptSection {...sectionProps} />}
              {section === 'characters' && <EntitySection {...sectionProps} kind="character" />}
              {section === 'scenes' && <EntitySection {...sectionProps} kind="scene" />}
              {section === 'props' && <EntitySection {...sectionProps} kind="prop" />}
              {section === 'storyboard' && <StoryboardSection {...sectionProps} />}
              {section === 'tasks' && <TasksSection {...sectionProps} />}
              {section === 'settings' && <SettingsSection {...sectionProps} />}
            </>
          )}
        </Box>

        {/* 右侧活动面板 */}
        {activityOpen && (
          <ActivityPanel
            projectId={projectId}
            task={running ?? lastTask}
            feedbackTarget={feedbackTarget}
            onClearTarget={() => setFeedbackTarget(null)}
            onClose={() => setActivityOpen(false)}
            floating={narrow}
          />
        )}
      </Box>
    </Box>
  );
}

function ActivityPanel({
  projectId,
  task,
  feedbackTarget,
  onClearTarget,
  onClose,
  floating,
}: {
  projectId: number;
  task: Task | null;
  feedbackTarget: FeedbackTarget | null;
  onClearTarget: () => void;
  onClose: () => void;
  floating: boolean;
}) {
  const feedback = useFeedback(projectId);
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [task?.logs?.length]);
  const busy = task ? !isTaskTerminal(task.status) : false;

  const send = () => {
    if (!text.trim()) return;
    feedback.mutate(
      { target_type: feedbackTarget?.type ?? 'project', target_id: feedbackTarget?.id ?? projectId, instruction: text.trim() },
      { onSuccess: () => setText('') },
    );
  };

  return (
    <Paper
      elevation={floating ? 8 : 0}
      square={!floating}
      sx={{
        width: floating ? 'min(100vw - 24px, 420px)' : 340,
        flexShrink: 0,
        borderLeft: floating ? 0 : 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        ...(floating ? { position: 'fixed', right: 12, bottom: 12, top: 'auto', maxHeight: '70vh', zIndex: 1200, borderRadius: 2 } : {}),
      }}
    >
      <Stack direction="row" sx={{ px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', alignItems: 'center' }}>
        <SmartToyRoundedIcon fontSize="small" color="primary" sx={{ mr: 1 }} />
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          数字员工活动
        </Typography>
        <Button size="small" onClick={onClose}>
          收起
        </Button>
      </Stack>

      <Box ref={logRef} sx={{ flex: 1, overflow: 'auto', p: 1.5, minHeight: 160 }}>
        {task ? (
          <>
            <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
              <Chip size="small" label={AGENT_LABELS[task.agent] ?? task.agent} />
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }} noWrap>
                {task.title}
              </Typography>
              <TaskStatusChip status={task.status} />
            </Stack>
            {busy && <LinearProgress variant={task.progress > 0 ? 'determinate' : 'indeterminate'} value={task.progress} sx={{ mb: 1, borderRadius: 1 }} />}
            {task.error && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {task.error}
              </Alert>
            )}
            {typeof task.output?.reply === 'string' && task.output.reply && (
              <Alert severity="success" icon={<SmartToyRoundedIcon fontSize="inherit" />} sx={{ mb: 1 }}>
                {task.output.reply as string}
              </Alert>
            )}
            <Stack spacing={0.5}>
              {(task.logs ?? []).map((l, i) => (
                <Typography key={i} variant="caption" sx={{ display: 'block', color: l.level === 'error' ? 'error.main' : l.level === 'warn' ? 'warning.main' : 'text.secondary', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  <Box component="span" sx={{ opacity: 0.6, mr: 0.5 }}>
                    {fmtTime(l.ts).slice(-8)}
                  </Box>
                  {l.text}
                </Typography>
              ))}
            </Stack>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            还没有任务。点顶部「运行」发起,或在下面写修改意见让反馈优化员工处理。
          </Typography>
        )}
      </Box>

      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={0.5} sx={{ mb: 0.5, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            修改意见 →
          </Typography>
          <Chip size="small" variant="outlined" label={feedbackTarget ? feedbackTarget.label : '整个项目'} onDelete={feedbackTarget ? onClearTarget : undefined} />
        </Stack>
        <Stack sx={{ alignItems: 'flex-end' }} direction="row" spacing={1}>
          <TextField
            size="small"
            fullWidth
            multiline
            maxRows={4}
            placeholder={feedbackTarget ? `对「${feedbackTarget.label}」想怎么改?` : '比如:女主再冷一点;第二集结尾反转不够;第 3 镜换成特写'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
            }}
            disabled={busy || feedback.isPending}
          />
          <IconButton color="primary" onClick={send} disabled={busy || feedback.isPending || !text.trim()} aria-label="发送修改意见">
            <SendRoundedIcon />
          </IconButton>
        </Stack>
        {feedback.isError && (
          <Typography variant="caption" color="error">
            {(feedback.error as Error).message}
          </Typography>
        )}
        {busy && (
          <Typography variant="caption" color="text.secondary">
            有任务在进行中,结束后再提交意见。
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
