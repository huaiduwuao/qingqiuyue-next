'use client';

import React from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Avatar,
  AvatarGroup,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Skeleton,
  Alert,
  Button,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import TerminalRoundedIcon from '@mui/icons-material/TerminalRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import CircleIcon from '@mui/icons-material/Circle';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';

// ── 类型 ──
interface WorkplaceUser {
  name: string; avatar: string; role: string; department: string; greeting: string;
}
interface QuickAction { id: string; label: string; icon: string; color: string; path: string; }
interface Todo {
  id: number; title: string; description: string; priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'done'; assignee: string; dueDate: string; createTime: string;
}
interface Project {
  id: number; name: string; description: string; progress: number; status: string;
  members: { name: string; avatar: string }[]; deadline: string; updateTime: string;
}
interface TeamMember {
  id: number; name: string; avatar: string; role: string; status: 'online' | 'offline'; lastActive: string;
}

// ── Icons ──
const ICON_MAP: Record<string, React.ReactNode> = {
  publish: <SendRoundedIcon />,
  userAdd: <PeopleAltRoundedIcon />,
  bot: <SmartToyRoundedIcon />,
  dict: <MenuBookRoundedIcon />,
  log: <TerminalRoundedIcon />,
  monitor: <StorageRoundedIcon />,
  spider: <BugReportRoundedIcon />,
  chart: <BarChartRoundedIcon />,
};

const PRIORITY_COLORS = { high: '#FE2C55', medium: '#FFB400', low: '#5DDB96' };
const PRIORITY_LABELS = { high: '高', medium: '中', low: '低' };
const STATUS_LABELS: Record<string, string> = { pending: '待处理', in_progress: '进行中', done: '已完成' };
const STATUS_COLORS: Record<string, 'warning' | 'info' | 'success'> = { pending: 'warning', in_progress: 'info', done: 'success' };

function useWorkplace() {
  const { currentUser } = useApp();
  const user = useQuery<WorkplaceUser>({
    queryKey: ['workplace', 'user', currentUser?.name],
    queryFn: async () => {
      const u = currentUser || {};
      const hour = new Date().getHours();
      const greeting = hour < 6 ? '凌晨好' : hour < 12 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
      return {
        name: (u as any).nickname || (u as any).name || '管理员',
        avatar: (u as any).avatar || '',
        role: ((u as any).roles || []).join(', ') || '系统管理员',
        department: '技术部',
        greeting,
      };
    },
    staleTime: 5 * 60_000,
  });

  const quickActions = useQuery<QuickAction[]>({
    queryKey: ['workplace', 'quick-actions'],
    queryFn: async () => [
      { id: 'publish', label: '发布内容', icon: 'publish', color: '#FE2C55', path: '/system/app-config' },
      { id: 'userAdd', label: '添加用户', icon: 'userAdd', color: '#5B8DEF', path: '/system/user' },
      { id: 'bot', label: '数字人', icon: 'bot', color: '#8B5CF6', path: '/system/digital-human' },
      { id: 'dict', label: '字典管理', icon: 'dict', color: '#25F4EE', path: '/system/dict/dict-type' },
      { id: 'log', label: '操作日志', icon: 'log', color: '#5DDB96', path: '/system/log' },
      { id: 'monitor', label: '服务监控', icon: 'monitor', color: '#FFB400', path: '/system/app' },
      { id: 'spider', label: '爬虫管理', icon: 'spider', color: '#FE2C55', path: '/system/hermes' },
      { id: 'chart', label: '数据分析', icon: 'chart', color: '#8B5CF6', path: '/system/dashboard/analysis' },
    ],
    // 之前:staleTime: Infinity → dev 模式 query cache 永不释放,内存持续上涨
    // 改:1h 上限,既保持 admin 长时间停留不重查,也允许 GC 释放
    staleTime: 60 * 60 * 1000,
  });

  const todos = useQuery<Todo[]>({
    queryKey: ['workplace', 'todos'],
    queryFn: async () => [
      { id: 1, title: '完成首页 Banner 设计稿审核', description: '设计稿已提交', priority: 'high' as const, status: 'pending' as const, assignee: '陈设计', dueDate: '2026-07-05', createTime: '2026-07-03' },
      { id: 2, title: '修复内容审核列表分页异常', description: '第3页数据重复', priority: 'high' as const, status: 'in_progress' as const, assignee: '李前端', dueDate: '2026-07-04', createTime: '2026-07-02' },
      { id: 3, title: '更新 API 接口文档', description: '新增 Hermes 实例管理接口', priority: 'medium' as const, status: 'pending' as const, assignee: '王后端', dueDate: '2026-07-06', createTime: '2026-07-03' },
      { id: 4, title: '准备 Q3 技术分享 PPT', description: '主题: WebAssembly 实践', priority: 'low' as const, status: 'pending' as const, assignee: '张架构', dueDate: '2026-07-10', createTime: '2026-07-01' },
      { id: 5, title: '升级 PostgreSQL 到 17', description: '需停机维护', priority: 'medium' as const, status: 'done' as const, assignee: '赵运维', dueDate: '2026-06-30', createTime: '2026-06-25' },
      { id: 6, title: '用户体验反馈汇总', description: '收集了 200+ 条反馈', priority: 'low' as const, status: 'done' as const, assignee: '刘产品', dueDate: '2026-06-28', createTime: '2026-06-20' },
    ],
    staleTime: 5 * 60_000,
  });

  const projects = useQuery<Project[]>({
    queryKey: ['workplace', 'projects'],
    queryFn: async () => [
      { id: 1, name: '青丘阅 v3.0 重构', description: 'Next.js + Go 微服务架构升级', progress: 85, status: 'active', members: [{ name: '张三', avatar: '' }, { name: '李四', avatar: '' }, { name: '王五', avatar: '' }], deadline: '2026-08-15', updateTime: '2026-07-03' },
      { id: 2, name: '数字人引擎优化', description: '语音合成延迟降低 50%', progress: 60, status: 'active', members: [{ name: '赵六', avatar: '' }, { name: '钱七', avatar: '' }], deadline: '2026-07-30', updateTime: '2026-07-02' },
      { id: 3, name: '内容推荐算法迭代', description: '引入 LLM 增强语义理解', progress: 40, status: 'planning', members: [{ name: '孙八', avatar: '' }, { name: '周九', avatar: '' }, { name: '吴十', avatar: '' }, { name: '郑一', avatar: '' }], deadline: '2026-09-01', updateTime: '2026-07-01' },
      { id: 4, name: '移动端适配', description: 'Flutter 跨平台方案验证', progress: 15, status: 'planning', members: [{ name: '陈二', avatar: '' }, { name: '李三', avatar: '' }], deadline: '2026-10-15', updateTime: '2026-06-28' },
    ],
    staleTime: 5 * 60_000,
  });

  const team = useQuery<TeamMember[]>({
    queryKey: ['workplace', 'team'],
    queryFn: async () => [
      { id: 1, name: '李前端', avatar: '', role: '前端开发', status: 'online' as const, lastActive: '刚刚' },
      { id: 2, name: '王后端', avatar: '', role: '后端开发', status: 'online' as const, lastActive: '5分钟前' },
      { id: 3, name: '陈设计', avatar: '', role: 'UI 设计师', status: 'offline' as const, lastActive: '1小时前' },
      { id: 4, name: '赵运维', avatar: '', role: 'DevOps', status: 'online' as const, lastActive: '刚刚' },
      { id: 5, name: '刘产品', avatar: '', role: '产品经理', status: 'offline' as const, lastActive: '3小时前' },
      { id: 6, name: '张架构', avatar: '', role: '技术负责人', status: 'online' as const, lastActive: '10分钟前' },
      { id: 7, name: '孙运营', avatar: '', role: '运营专员', status: 'offline' as const, lastActive: '昨天' },
      { id: 8, name: '周测试', avatar: '', role: 'QA 工程师', status: 'online' as const, lastActive: '刚刚' },
    ],
    staleTime: 5 * 60_000,
  });

  return { user, quickActions, todos, projects, team };
}

export default function DashboardWorkplacePage() {
  const { user, quickActions, todos, projects, team } = useWorkplace();
  const router = useRouter();
  const queryClient = useQueryClient();

  const toggleTodo = useMutation({
    mutationFn: (id: number) => {
      // 本地状态更新,不需要后端 API
      const current = queryClient.getQueryData<Todo[]>(['workplace', 'todos']) || [];
      const updated = current.map((t: Todo) =>
        t.id === id ? { ...t, status: t.status === 'done' ? ('pending' as const) : ('done' as const) } : t
      );
      queryClient.setQueryData(['workplace', 'todos'], updated);
      return Promise.resolve();
    },
  });

  const u = user.data;
  const pendingTodos = (todos.data || []).filter((t: Todo) => t.status !== 'done');
  const doneTodos = (todos.data || []).filter((t: Todo) => t.status === 'done');

  if (user.isError && !user.isLoading) {
    return (
      <Container maxWidth="lg"><Box sx={{ py: 4 }}><Alert severity="error">数据加载失败,请确认后端 API 已启动</Alert></Box></Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: { xs: 2, md: 3 } }}>
        {/* ── 欢迎横幅 ── */}
        <Card sx={{ mb: 3, overflow: 'hidden', position: 'relative' }}>
          <Box
            sx={{
              position: 'absolute', top: -40, right: -40, width: 200, height: 200,
              borderRadius: '50%', bgcolor: alpha('#5B8DEF', 0.08),
            }}
          />
          <Box
            sx={{
              position: 'absolute', bottom: -60, left: '40%', width: 160, height: 160,
              borderRadius: '50%', bgcolor: alpha('#FE2C55', 0.06),
            }}
          />
          <CardContent sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2.5, py: 3, px: 3 }}>
            {user.isLoading ? (
              <Skeleton variant="circular" width={64} height={64} />
            ) : (
              <Avatar src={u?.avatar} sx={{ width: 64, height: 64, border: '3px solid white', boxShadow: 2 }} />
            )}
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {user.isLoading ? <Skeleton width={120} /> : (
                  <>
                    <WbSunnyRoundedIcon sx={{ color: '#FFB400', fontSize: 20 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>{u?.greeting}，{u?.name}</Typography>
                  </>
                )}
              </Box>
              {user.isLoading ? <Skeleton width={200} sx={{ mt: 0.5 }} /> : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {u?.department} · {u?.role} | 祝你工作愉快!
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip icon={<NotificationsRoundedIcon />} label="3 条新消息" size="small" color="primary" variant="outlined" />
            </Box>
          </CardContent>
        </Card>

        <Grid container spacing={2}>
          {/* ── 快捷操作 ── */}
          <Grid size={12}>
            <Card>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>快捷操作</Typography>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  {quickActions.isLoading
                    ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} variant="rounded" width={100} height={72} />)
                    : (quickActions.data || []).map((a: QuickAction) => (
                      <Tooltip key={a.id} title={a.label}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => router.push(a.path)}
                          sx={{
                            minWidth: 90,
                            flexDirection: 'column',
                            gap: 0.5,
                            py: 1.2,
                            borderColor: alpha(a.color, 0.3),
                            color: a.color,
                            '&:hover': { borderColor: a.color, bgcolor: alpha(a.color, 0.05) },
                          }}
                        >
                          <Box sx={{ '& .MuiSvgIcon-root': { fontSize: 22 } }}>{ICON_MAP[a.icon]}</Box>
                          <Typography variant="caption" sx={{ fontSize: 11 }}>{a.label}</Typography>
                        </Button>
                      </Tooltip>
                    ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* ── 待办事项 ── */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PendingActionsRoundedIcon sx={{ color: '#FFB400', fontSize: 22 }} />
                    <Typography variant="h6">待办事项</Typography>
                    <Chip label={`${pendingTodos.length} 待处理`} size="small" color="warning" variant="outlined" sx={{ height: 22, fontSize: 11 }} />
                  </Box>
                  <IconButton size="small"><AddRoundedIcon fontSize="small" /></IconButton>
                </Box>
                {todos.isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 1 }} />)
                ) : (
                  <List dense disablePadding sx={{ maxHeight: 320, overflow: 'auto' }}>
                    {pendingTodos.map((t: Todo) => (
                      <React.Fragment key={t.id}>
                        <ListItem
                          sx={{ px: 1, py: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
                          secondaryAction={
                            <Tooltip title="标记完成">
                              <IconButton size="small" onClick={() => toggleTodo.mutate(t.id)}>
                                <DoneAllRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          }
                        >
                          <Box sx={{ mr: 1.5, minWidth: 8 }}>
                            <CircleIcon sx={{ fontSize: 8, color: PRIORITY_COLORS[t.priority] }} />
                          </Box>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13 }}>{t.title}</Typography>
                                <Chip label={PRIORITY_LABELS[t.priority]} size="small" sx={{ height: 18, fontSize: 10, bgcolor: alpha(PRIORITY_COLORS[t.priority], 0.1), color: PRIORITY_COLORS[t.priority] }} />
                              </Box>
                            }
                            secondary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.3 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>{t.description}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>· {t.assignee}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>· {new Date(t.dueDate).toLocaleDateString('zh-CN')}</Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                        <Divider component="li" />
                      </React.Fragment>
                    ))}
                    {pendingTodos.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>🎉 所有待办已处理完毕</Typography>
                    )}
                    {doneTodos.length > 0 && (
                      <>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, mb: 0.5, fontWeight: 600 }}>已完成 ({doneTodos.length})</Typography>
                        {doneTodos.map((t: Todo) => (
                          <ListItem key={t.id} sx={{ px: 1, py: 0.8, opacity: 0.6 }}>
                            <DoneAllRoundedIcon sx={{ mr: 1.5, fontSize: 16, color: 'success.main' }} />
                            <ListItemText
                              primary={<Typography variant="body2" sx={{ fontSize: 13, textDecoration: 'line-through' }}>{t.title}</Typography>}
                              secondary={<Typography variant="caption" sx={{ fontSize: 11 }}>{t.assignee}</Typography>}
                            />
                          </ListItem>
                        ))}
                      </>
                    )}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* ── 项目进度 ── */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssessmentRoundedIcon sx={{ color: '#8B5CF6', fontSize: 22 }} />
                    <Typography variant="h6">项目进度</Typography>
                  </Box>
                  <Button size="small" variant="text" sx={{ fontSize: 12 }}>查看全部</Button>
                </Box>
                {projects.isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={80} sx={{ mb: 1 }} />)
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {(projects.data || []).map((p: Project) => (
                      <Box key={p.id} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', '&:hover': { borderColor: 'primary.light' } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>{p.name}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>{p.description}</Typography>
                          </Box>
                          <Chip
                            label={p.status === 'active' ? '进行中' : '规划中'}
                            size="small"
                            color={p.status === 'active' ? 'primary' : 'default'}
                            variant="outlined"
                            sx={{ height: 20, fontSize: 10 }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 12, color: p.progress >= 80 ? 'success.main' : p.progress >= 40 ? 'warning.main' : 'text.secondary' }}>
                            {p.progress}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={p.progress}
                            sx={{
                              flex: 1, height: 6, borderRadius: 3,
                              bgcolor: alpha('#8B5CF6', 0.1),
                              '& .MuiLinearProgress-bar': { bgcolor: p.progress >= 80 ? '#5DDB96' : p.progress >= 40 ? '#FFB400' : '#8B5CF6', borderRadius: 3 },
                            }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: 10 } }}>
                            {p.members.map((m, j) => (
                              <Tooltip key={j} title={m.name}><Avatar src={m.avatar} /></Tooltip>
                            ))}
                          </AvatarGroup>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                            截止 {new Date(p.deadline).toLocaleDateString('zh-CN')}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* ── 团队成员 ── */}
          <Grid size={12}>
            <Card>
              <CardContent sx={{ py: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">团队成员</Typography>
                  <Button size="small" variant="text" sx={{ fontSize: 12 }}>管理团队</Button>
                </Box>
                {team.isLoading ? (
                  <Box sx={{ display: 'flex', gap: 2 }}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} variant="rounded" width={140} height={100} />)}</Box>
                ) : (
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {(team.data || []).map((m: TeamMember) => (
                      <Box
                        key={m.id}
                        sx={{
                          flex: '1 1 160px', minWidth: 140, maxWidth: 200,
                          p: 2, borderRadius: 2, textAlign: 'center',
                          border: '1px solid', borderColor: 'divider',
                          '&:hover': { borderColor: 'primary.light', boxShadow: 1 },
                          transition: 'all 0.2s',
                        }}
                      >
                        <Badge
                          overlap="circular"
                          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                          variant="dot"
                          color={m.status === 'online' ? 'success' : 'default'}
                          sx={{ '& .MuiBadge-dot': { width: 10, height: 10, borderRadius: '50%', border: '2px solid white' } }}
                        >
                          <Avatar src={m.avatar} sx={{ width: 48, height: 48, mx: 'auto', mb: 1 }} />
                        </Badge>
                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>{m.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11 }}>{m.role}</Typography>
                        <Typography variant="caption" color={m.status === 'online' ? 'success.main' : 'text.secondary'} sx={{ fontSize: 10 }}>
                          {m.status === 'online' ? `在线 · ${m.lastActive}` : `离线 · ${m.lastActive}`}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}
