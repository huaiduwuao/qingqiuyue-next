'use client';

/**
 * 短剧工作台。按创作阶段分页签:概览 / 剧本 / 主体 / 分镜 / 故事板 / 成片。
 *
 * - 顶栏:返回、标题、阶段页签,右侧是「下一步」主按钮(带每次生成的钻石单价)和更多操作;
 * - 左栏:分集列表(剧本 / 分镜 / 故事板 / 成片这些按集干活的阶段才有);
 * - 中间:当前阶段;
 * - 右栏:当前阶段的编辑面板(全局设定 / 主体图 / 镜头绘图与视频)+「AI 助手」
 *   (数字员工的实时日志 + 修改意见)。选中主体或镜头时,修改意见自动对准它。
 *
 * 出图模型和参数不在工作台里:风格库与 ComfyUI 模板由管理员在 /system/shortdrama 维护。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import ListItemButton from '@mui/material/ListItemButton';
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
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getDetailRoute } from '@/lib/contentRoute';
import { AGENT_LABELS, dramaAPI, isTaskTerminal, type Episode, type Step, type Task } from '@/apis/shortdrama';
import { TaskStatusChip, fmtTime } from './common';
import { qk, useFeedback, useOverview, useProjectEvents, useStartTask, useUnitCost } from './useProject';
import OverviewSection from './sections/OverviewSection';
import ScriptSection from './sections/ScriptSection';
import SubjectsSection from './sections/SubjectsSection';
import StoryboardSection from './sections/StoryboardSection';
import BoardSection from './sections/BoardSection';
import PostSection from './sections/PostSection';
import TasksSection from './sections/TasksSection';
import GlobalSettingsPanel from './panels/GlobalSettingsPanel';
import SubjectPanel from './panels/SubjectPanel';
import ShotPanel from './panels/ShotPanel';

export type SectionId = 'overview' | 'script' | 'subjects' | 'storyboard' | 'board' | 'post';

const STAGES: { id: SectionId; label: string }[] = [
  { id: 'overview', label: '概览' },
  { id: 'script', label: '剧本' },
  { id: 'subjects', label: '主体' },
  { id: 'storyboard', label: '分镜' },
  { id: 'board', label: '故事板' },
  { id: 'post', label: '成片' },
];
/** 按集干活的阶段:左边显示分集列表 */
const EPISODE_STAGES = new Set<SectionId>(['script', 'storyboard', 'board', 'post']);

/** 反馈目标:由各分区在用户选中某个实体时设置。 */
export interface FeedbackTarget {
  type: 'project' | 'episode' | 'character' | 'scene' | 'prop' | 'shot';
  id: number;
  label: string;
}

/** 当前选中的主体或镜头,右栏编辑面板跟着它走 */
export type Selection = { type: 'character' | 'scene' | 'prop' | 'shot'; id: number; label: string } | null;

export interface SectionProps {
  projectId: number;
  setSection: (s: SectionId, opts?: { episodeId?: number }) => void;
  setFeedbackTarget: (t: FeedbackTarget | null) => void;
  episodeId: number;
  setEpisodeId: (id: number) => void;
  /** 工作台左栏已经有分集列表:分区里就不用再画一排分集页签 */
  episodeRail?: boolean;
  selected?: Selection;
  select?: (s: Selection) => void;
  /** 打开右栏的编辑面板(选中镜头后改提示词等) */
  openPanel?: () => void;
}

/** 助手面板里的快捷意见,点一下填进输入框 */
const SUGGESTIONS: Partial<Record<SectionId, string[]>> = {
  overview: ['整体节奏再快一点,开场 3 秒就要有冲突', '主角人设更鲜明一些'],
  script: ['这一集结尾的悬念不够,加一个反转', '台词更口语化,少一点书面语'],
  subjects: ['女主的造型更精致一些', '场景的光线改成黄昏暖色调'],
  storyboard: ['这一集多用特写,情绪更饱满', '镜头再紧凑一点,删掉过场镜头'],
  board: ['画面整体再明亮一些', '人物表情更夸张一点'],
};

export default function Workbench({ projectId, onExit }: { projectId: number; onExit: () => void }) {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const [section, setSection0] = useState<SectionId>('overview');
  // 手机上整页一起滚、页签吸顶:切分区时如果已经往下滚过,回到新分区的开头(页签正下方)
  const tabsAnchorRef = useRef<HTMLDivElement>(null);
  const setSectionState = (s: SectionId) => {
    setSection0(s);
    // 换阶段就放下之前选中的主体 / 镜头,修改意见回到整个项目
    setSelected(null);
    setFeedbackTarget(null);
    const a = tabsAnchorRef.current;
    if (narrow && a && a.getBoundingClientRect().top < (a.closest('main')?.getBoundingClientRect().top ?? 0)) a.scrollIntoView({ block: 'start' });
  };
  const [episodeId, setEpisodeId] = useState(0);
  const [feedbackTarget, setFeedbackTarget] = useState<FeedbackTarget | null>(null);
  const [selected, setSelected] = useState<Selection>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<'context' | 'assistant'>('context');
  const [tasksOpen, setTasksOpen] = useState(false);
  const [moreMenu, setMoreMenu] = useState<null | HTMLElement>(null);
  // 手机上右栏是从底部弹出的一层,一进来就盖住大半屏:默认收起
  useEffect(() => {
    if (narrow) setPanelOpen(false);
  }, [narrow]);
  const overview = useOverview(projectId);
  const { liveTask, connected } = useProjectEvents(projectId);
  const start = useStartTask(projectId);
  const cost = useUnitCost();

  const setSection = (s: SectionId, opts?: { episodeId?: number }) => {
    if (opts?.episodeId) setEpisodeId(opts.episodeId);
    setSectionState(s);
  };
  const select = (s: Selection) => {
    setSelected(s);
    setFeedbackTarget(s ? { type: s.type, id: s.id, label: s.label } : null);
    if (s) {
      setPanelTab('context');
      if (narrow) setPanelOpen(true);
    }
  };

  // 默认选中第一集
  const episodes: Episode[] = useMemo(() => overview.data?.episodes ?? [], [overview.data]);
  useEffect(() => {
    if ((!episodeId || !episodes.some((e) => e.id === episodeId)) && episodes.length) setEpisodeId(episodes[0].id);
  }, [episodes, episodeId]);
  const curEp = episodes.find((e) => e.id === episodeId) ?? episodes[0];

  const running: Task | null = useMemo(() => {
    if (liveTask && !isTaskTerminal(liveTask.status)) return liveTask;
    if (overview.data?.running) return overview.data.running;
    return null;
  }, [liveTask, overview.data]);
  const lastTask: Task | null = liveTask ?? overview.data?.tasks?.[0] ?? null;

  const p = overview.data?.project;
  const showRail = !narrow && EPISODE_STAGES.has(section) && episodes.length > 0;
  const sectionProps: SectionProps = { projectId, setSection, setFeedbackTarget, episodeId, setEpisodeId, episodeRail: showRail, selected, select, openPanel: () => { setPanelTab('context'); setPanelOpen(true); } };

  // 发布成标准作品(module_content SHORT_DRAMA):进"我的作品"与内容审核,和普通投稿同一条路。
  const queryClient = useQueryClient();
  const publish = useMutation({
    mutationFn: () => dramaAPI.publish(projectId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.overview(projectId) }),
  });
  const publishedRoute = p?.content_id ? getDetailRoute('SHORT_DRAMA', p.content_id) : null;

  const run = (step: Step, input: Record<string, unknown> = {}) => {
    start.mutate({ step, input });
    setPanelTab('assistant');
    setPanelOpen(true);
  };
  const epInput = curEp ? { episode_id: curEp.id, episode_no: curEp.no } : null;

  // 每个阶段右上角的「下一步」:做完这一页,推到下一页
  const next: { label: string; tip: string; price?: string; disabled?: boolean; go: () => void } | null = (() => {
    switch (section) {
      case 'overview':
        return { label: '一键生成', tip: '剧本 → 主体 → 每集分镜 → 出图 → 质检,全流程自动跑完(已做好的环节会跳过)', price: cost.shot ? `${cost.shot} 钻/张图` : undefined, go: () => run('pipeline') };
      case 'script':
        return { label: '主体提取', tip: '按剧本给角色、场景、道具写图片提示词,并生成主体图(已有的不重画)', price: cost.t2i ? `${cost.t2i} 钻/张` : undefined, go: () => run('visual_design', { generate_images: cost.t2i > 0 }) };
      case 'subjects':
        return { label: '智能分镜', tip: curEp ? `把第 ${curEp.no} 集剧本拆成镜头(景别、运镜、台词、时长)` : '先写剧本', disabled: !epInput, go: () => epInput && run('storyboard', epInput) };
      case 'storyboard':
        return { label: '生成故事板', tip: curEp ? `给第 ${curEp.no} 集还没有画面的镜头出图` : '', price: cost.shot ? `${cost.shot} 钻/镜` : undefined, disabled: !epInput || !cost.canImage, go: () => epInput && run('visual_gen', epInput) };
      case 'board':
        return { label: '生成视频', tip: curEp ? `把第 ${curEp.no} 集的镜头画面做成动态视频(已有视频的跳过)` : '', price: cost.i2v ? `${cost.i2v} 钻/镜` : undefined, disabled: !epInput || !cost.canVideo, go: () => epInput && run('visual_gen', { ...epInput, video: true }) };
      case 'post':
        return { label: p?.content_id ? '更新作品' : '发布为作品', tip: p?.content_id ? '更新已发布的作品(分集随最新镜头产出刷新)' : '发布成短剧作品:进入"我的作品"并提交内容审核', disabled: publish.isPending, go: () => publish.mutate() };
    }
  })();

  const contextPanel: { label: string; el: React.ReactNode } | null =
    section === 'script'
      ? { label: '全局设定', el: <GlobalSettingsPanel projectId={projectId} /> }
      : section === 'subjects'
        ? { label: '主体图', el: <SubjectPanel projectId={projectId} selected={selected} /> }
        : section === 'storyboard' || section === 'board'
          ? { label: '绘图 / 视频', el: <ShotPanel projectId={projectId} episodeId={curEp?.id ?? 0} selected={selected} /> }
          : null;
  const tab = contextPanel ? panelTab : 'assistant';

  const stageTabs = (
    <Tabs
      value={section}
      onChange={(_, v) => (v === '__panel' ? setPanelOpen(true) : setSectionState(v))}
      variant={narrow ? 'scrollable' : 'standard'}
      scrollButtons={narrow ? 'auto' : false}
      sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, minWidth: 64, px: 1.5 } }}
    >
      {STAGES.map((s) => (
        <Tab key={s.id} value={s.id} label={s.label} />
      ))}
      {narrow && <Tab value="__panel" label="助手" />}
    </Tabs>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: { xs: 'auto', md: '100%' }, minHeight: { md: 'calc(100vh - 120px)' } }}>
      {/* 顶栏 */}
      <Paper square elevation={0} sx={{ px: { xs: 1, md: 1.5 }, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 52 }}>
          <Button size="small" startIcon={<ArrowBackRoundedIcon />} onClick={onExit} sx={{ flexShrink: 0 }}>
            返回
          </Button>
          <Box sx={{ minWidth: 0, flex: { xs: 1, md: '0 1 280px' } }}>
            <Typography sx={{ fontWeight: 700 }} variant="subtitle1" noWrap>
              {p?.title ?? '加载中…'}
            </Typography>
          </Box>
          {!narrow && <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{stageTabs}</Box>}
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexShrink: 0 }}>
            <Tooltip title={connected ? '实时连接正常' : '实时连接断开,重连中'}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: connected ? 'success.main' : 'warning.main' }} />
            </Tooltip>
            {running ? (
              <>
                {!narrow && (
                  <Chip size="small" color="primary" icon={<SmartToyRoundedIcon />} label={`${AGENT_LABELS[running.agent] ?? running.agent} · ${running.title} ${running.progress}%`} sx={{ maxWidth: 320 }} onClick={() => { setPanelTab('assistant'); setPanelOpen(true); }} />
                )}
                <Tooltip title="取消当前任务">
                  <IconButton size="small" color="error" onClick={() => dramaAPI.cancelTask(running.id)}>
                    <StopRoundedIcon />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              next && (
                <Tooltip title={next.tip}>
                  <span>
                    <Button size="small" variant="contained" disabled={next.disabled || start.isPending} onClick={next.go} endIcon={<ArrowForwardRoundedIcon />} sx={{ borderRadius: 5, whiteSpace: 'nowrap' }}>
                      {next.label}
                      {next.price && !narrow && (
                        <Box component="span" sx={{ ml: 0.75, opacity: 0.85, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                          <DiamondRoundedIcon sx={{ fontSize: 13 }} />
                          {next.price}
                        </Box>
                      )}
                    </Button>
                  </span>
                </Tooltip>
              )
            )}
            <IconButton size="small" onClick={(e) => setMoreMenu(e.currentTarget)} aria-label="更多操作">
              <MoreHorizRoundedIcon />
            </IconButton>
            <Menu open={!!moreMenu} anchorEl={moreMenu} onClose={() => setMoreMenu(null)}>
              <MenuItem disabled={!!running} onClick={() => { setMoreMenu(null); run('pipeline'); }}>
                一键生成(全流程)
              </MenuItem>
              <MenuItem disabled={!!running} onClick={() => { setMoreMenu(null); run('screenwriter'); }}>
                重写剧本框架
              </MenuItem>
              <MenuItem disabled={!!running || publish.isPending} onClick={() => { setMoreMenu(null); publish.mutate(); }}>
                {p?.content_id ? '更新已发布的作品' : '发布为作品'}
              </MenuItem>
              {publishedRoute && (
                <MenuItem component="a" href={publishedRoute} target="_blank" onClick={() => setMoreMenu(null)}>
                  查看已发布作品 <OpenInNewRoundedIcon fontSize="small" sx={{ ml: 0.5 }} />
                </MenuItem>
              )}
              <MenuItem onClick={() => { setMoreMenu(null); setTasksOpen(true); }}>任务记录</MenuItem>
              {!narrow && (
                <MenuItem onClick={() => { setMoreMenu(null); setPanelOpen((v) => !v); }}>{panelOpen ? '收起右侧面板' : '展开右侧面板'}</MenuItem>
              )}
            </Menu>
          </Stack>
        </Box>
        {running && <LinearProgress variant={running.progress > 0 ? 'determinate' : 'indeterminate'} value={running.progress} sx={{ mb: 0.5, borderRadius: 1 }} />}
        {running && (
          <Alert
            severity="info"
            sx={{ mb: 1, py: 0 }}
            action={
              <Button size="small" color="inherit" onClick={() => { setPanelTab('assistant'); setPanelOpen(true); }}>
                看进度
              </Button>
            }
          >
            正在「{running.title}」{running.progress > 0 ? ` ${running.progress}%` : ''}。一个项目同一时间只跑一个任务,其它生成按钮先置灰,跑完自动恢复;不想等可以点右上角 ■ 取消。
          </Alert>
        )}
        {publish.isError && (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => publish.reset()}>
            发布失败:{(publish.error as Error).message}
          </Alert>
        )}
        {publish.isSuccess && publish.data && (
          <Alert severity="success" sx={{ mb: 1 }} onClose={() => publish.reset()}>
            已作为短剧作品提交:{publish.data.episodes} 集、{publish.data.shots} 个镜头
            {publish.data.finals ? `,其中 ${publish.data.finals} 集用的是合成成片` : ''}
            {publish.data.missing_render > 0 ? `(${publish.data.missing_render} 个镜头还没有画面,出图后再点"更新作品"即可补上)` : ''}
            ,状态 {publish.data.status === 'REVIEWING' ? '审核中' : publish.data.status}。
          </Alert>
        )}
        {start.isError && (
          <Alert severity="error" sx={{ mb: 1 }} onClose={() => start.reset()}>
            {(start.error as Error).message}
          </Alert>
        )}
      </Paper>

      {/* 手机:阶段页签吸顶在顶栏下面。吸顶在创作中心外层滚动区的顶边,那层有 12px 内边距,top 抵掉它 */}
      <Box ref={tabsAnchorRef} />
      {narrow && <Box sx={{ position: 'sticky', top: -12, zIndex: 3, bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>{stageTabs}</Box>}

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {showRail && <EpisodeRail episodes={episodes} current={curEp?.id ?? 0} onPick={setEpisodeId} stats={overview.data?.episode_stats} />}

        <Box sx={{ flex: 1, minWidth: 0, overflow: { xs: 'visible', md: 'auto' }, p: { xs: 1.5, md: 2.5 } }}>
          {overview.isError ? (
            <Alert severity="error" action={<Button onClick={onExit}>返回</Button>}>
              {(overview.error as Error).message}
            </Alert>
          ) : (
            <>
              {section === 'overview' && <OverviewSection {...sectionProps} />}
              {section === 'script' && <ScriptSection {...sectionProps} />}
              {section === 'subjects' && <SubjectsSection {...sectionProps} />}
              {section === 'storyboard' && <StoryboardSection {...sectionProps} />}
              {section === 'board' && <BoardSection {...sectionProps} />}
              {section === 'post' && <PostSection {...sectionProps} />}
            </>
          )}
          {/* MiniMax H3 社区许可要求产品界面标出模型名;成片画面另有「AI生成」角标 */}
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 3, textAlign: 'center' }}>
            内容由 AI 生成 · 音画同出视频由 MiniMax H3 生成
          </Typography>
        </Box>

        {panelOpen && (
          <Paper
            elevation={narrow ? 8 : 0}
            square={!narrow}
            sx={{
              width: narrow ? 'auto' : 360,
              flexShrink: 0,
              borderLeft: narrow ? 0 : 1,
              borderColor: 'divider',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              // 手机:底部弹层,左右铺满,盖住底部导航(zIndex 高于它),底边让出手势条
              ...(narrow ? { position: 'fixed', left: 0, right: 0, bottom: 0, top: 'auto', height: '78vh', zIndex: 1300, borderRadius: '16px 16px 0 0', pb: 'var(--sab, 0px)' } : {}),
            }}
          >
            <Stack direction="row" sx={{ alignItems: 'center', borderBottom: 1, borderColor: 'divider', pr: 0.5 }}>
              <Tabs value={tab} onChange={(_, v) => setPanelTab(v)} sx={{ flex: 1, minHeight: 42, '& .MuiTab-root': { minHeight: 42, minWidth: 0, px: 1.5 } }}>
                {contextPanel && <Tab value="context" label={contextPanel.label} />}
                <Tab value="assistant" icon={<SmartToyRoundedIcon fontSize="small" />} iconPosition="start" label="AI 助手" />
              </Tabs>
              <IconButton size="small" onClick={() => setPanelOpen(false)} aria-label="收起面板">
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {tab === 'context' && contextPanel ? (
                <Box sx={{ flex: 1, overflow: 'auto' }}>{contextPanel.el}</Box>
              ) : (
                <AssistantPanel
                  projectId={projectId}
                  task={running ?? lastTask}
                  feedbackTarget={feedbackTarget}
                  onClearTarget={() => select(null)}
                  suggestions={SUGGESTIONS[section] ?? []}
                />
              )}
            </Box>
          </Paper>
        )}
      </Box>

      <Dialog open={tasksOpen} onClose={() => setTasksOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>任务记录</DialogTitle>
        <DialogContent>{tasksOpen && <TasksSection {...sectionProps} />}</DialogContent>
      </Dialog>
    </Box>
  );
}

function EpisodeRail({ episodes, current, onPick, stats }: { episodes: Episode[]; current: number; onPick: (id: number) => void; stats?: Record<string, { shots: number; framed: number; videos: number }> }) {
  return (
    <Box sx={{ width: 148, flexShrink: 0, borderRight: 1, borderColor: 'divider', overflow: 'auto', py: 1, px: 0.75 }}>
      {episodes.map((e) => {
        const st = stats?.[String(e.id)];
        const pct = st && st.shots ? Math.round((st.framed / st.shots) * 100) : 0;
        return (
          <ListItemButton key={e.id} selected={e.id === current} onClick={() => onPick(e.id)} sx={{ borderRadius: 1, mb: 0.25, display: 'block', py: 0.75 }}>
            <Typography variant="body2" sx={{ fontWeight: e.id === current ? 700 : 500 }} noWrap>
              第 {e.no} 集
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {e.title || '未命名'}
            </Typography>
            {st && st.shots > 0 && <LinearProgress variant="determinate" value={pct} sx={{ mt: 0.5, height: 3, borderRadius: 1 }} />}
          </ListItemButton>
        );
      })}
    </Box>
  );
}

function AssistantPanel({
  projectId,
  task,
  feedbackTarget,
  onClearTarget,
  suggestions,
}: {
  projectId: number;
  task: Task | null;
  feedbackTarget: FeedbackTarget | null;
  onClearTarget: () => void;
  suggestions: string[];
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
    <>
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
          <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
            <SmartToyRoundedIcon color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              我是你的 AI 短剧助手
            </Typography>
            <Typography variant="caption" color="text.secondary">
              点右上角的按钮推进到下一步;想改哪里,直接在下面告诉我。选中某个角色或镜头再说,就只改它。
            </Typography>
          </Box>
        )}
      </Box>

      <Divider />
      <Box sx={{ p: 1.5 }}>
        {suggestions.length > 0 && !text && (
          <Stack spacing={0.5} sx={{ mb: 1 }}>
            {suggestions.map((s) => (
              <Chip key={s} size="small" variant="outlined" label={s} onClick={() => setText(s)} sx={{ justifyContent: 'flex-start', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 } }} />
            ))}
          </Stack>
        )}
        <Stack direction="row" spacing={0.5} sx={{ mb: 0.5, alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            修改 →
          </Typography>
          <Chip size="small" variant="outlined" label={feedbackTarget ? feedbackTarget.label : '整个项目'} onDelete={feedbackTarget ? onClearTarget : undefined} />
        </Stack>
        <Stack sx={{ alignItems: 'flex-end' }} direction="row" spacing={1}>
          <TextField
            size="small"
            fullWidth
            multiline
            maxRows={4}
            placeholder={feedbackTarget ? `对「${feedbackTarget.label}」想怎么改?` : '告诉助手你想怎么改(Ctrl+Enter 发送)'}
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
            有任务在进行中,结束后再提交。
          </Typography>
        )}
      </Box>
    </>
  );
}
