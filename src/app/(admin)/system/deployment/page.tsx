'use client';

import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import RefreshIcon from '@mui/icons-material/Refresh';
import BuildIcon from '@mui/icons-material/Build';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import WebIcon from '@mui/icons-material/Web';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import UndoIcon from '@mui/icons-material/Undo';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import HistoryIcon from '@mui/icons-material/History';
import HealthIcon from '@mui/icons-material/HealthAndSafety';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getServicesStatus,
  getDeploymentHistory,
  rebuildBackend,
  rebuildFrontend,
  healthCheckFull,
  rollbackService,
  getAlertConfig,
  setAlertConfig,
  testAlert,
  analyzeLogs,
  getBuildLog,
  getDeployLog,
  type FullHealthCheckResponse,
  type DeployRecord,
  type AlertConfig,
  type LogAnalysisResponse,
} from '@/apis/deployment';

// Tab 面板
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

// 服务类型图标
const ServiceTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'backend': return <BuildIcon fontSize="small" />;
    case 'frontend': return <WebIcon fontSize="small" />;
    default: return <StorageIcon fontSize="small" />;
  }
};

// 状态图标
const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'running': return <CheckCircleIcon fontSize="small" color="success" />;
    case 'stopped': return <ErrorIcon fontSize="small" color="error" />;
    default: return <HourglassEmptyIcon fontSize="small" />;
  }
};

// 健康状态图标
const HealthIcon_ = ({ status }: { status: string }) => {
  switch (status) {
    case 'healthy': return <CheckCircleIcon fontSize="small" color="success" />;
    case 'unhealthy': return <ErrorIcon fontSize="small" color="error" />;
    default: return <HourglassEmptyIcon fontSize="small" color="disabled" />;
  }
};

// 格式化时间
const formatTime = (ts: string) => {
  try {
    return new Date(ts).toLocaleString('zh-CN');
  } catch {
    return ts;
  }
};

// 格式化 commit
const fmtCommit = (c: string) => c?.length > 8 ? c.substring(0, 8) : c || '-';

// 事件标签
const eventLabel: Record<string, string> = {
  startup: '启动',
  auto_update: '自动更新',
  manual_rebuild: '手动重建',
  service_rebuild: '服务重建',
  rollback: '回滚',
  build_failed: '构建失败',
};
const getEventLabel = (e: string) => eventLabel[e] || e;

const eventColor: Record<string, 'default' | 'info' | 'warning' | 'error' | 'success'> = {
  startup: 'default',
  auto_update: 'info',
  manual_rebuild: 'warning',
  service_rebuild: 'warning',
  rollback: 'warning',
  build_failed: 'error',
};
const getEventColor = (e: string) => eventColor[e] || 'default';

export default function DeploymentPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [rollbackDialog, setRollbackDialog] = useState({ open: false, service: '', commit: '' });
  const [alertDialog, setAlertDialog] = useState(false);
  const [logService, setLogService] = useState('');

  const showMsg = useCallback((msg: string, sev: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message: msg, severity: sev });
  }, []);

  // 查询
  const { data: servicesData, isLoading: svcLoading, refetch: refetchSvc } = useQuery({
    queryFn: getServicesStatus,
    queryKey: ['services'],
    refetchInterval: 30000,
  });

  const { data: historyData, isLoading: histLoading, refetch: refetchHist } = useQuery({
    queryFn: getDeploymentHistory,
    queryKey: ['history'],
    refetchInterval: 30000,
  });

  const { data: healthData, isLoading: hlthLoading, refetch: refetchHlth } = useQuery({
    queryFn: healthCheckFull,
    queryKey: ['health-full'],
    refetchInterval: 60000,
  });

  const { data: alertData, refetch: refetchAlert } = useQuery({
    queryFn: getAlertConfig,
    queryKey: ['alert-config'],
  });

  const { data: logAnalysis, isLoading: logLoading, refetch: refetchLog } = useQuery({
    queryFn: () => analyzeLogs(logService || undefined),
    queryKey: ['log-analysis', logService],
    enabled: false,
  });

  // 突变
  const rebuildBackendMut = useMutation({ mutationFn: rebuildBackend,
    onSuccess: () => { showMsg('后端重建已触发'); setTimeout(() => { refetchSvc(); refetchHist(); }, 5000); },
    onError: (e: any) => showMsg(e.message || '重建失败', 'error'),
  });

  const rebuildFrontendMut = useMutation({ mutationFn: rebuildFrontend,
    onSuccess: () => { showMsg('前端重建已触发'); setTimeout(() => { refetchSvc(); refetchHist(); }, 5000); },
    onError: (e: any) => showMsg(e.message || '重建失败', 'error'),
  });

  const rollbackMut = useMutation({
    mutationFn: ({ svc, commit }: { svc: string; commit?: string }) => rollbackService(svc, commit),
    onSuccess: () => {
      showMsg('回滚已触发'); setRollbackDialog({ open: false, service: '', commit: '' });
      setTimeout(() => { refetchSvc(); refetchHist(); }, 5000);
    },
    onError: (e: any) => showMsg(e.message || '回滚失败', 'error'),
  });

  const alertMut = useMutation({
    mutationFn: (cfg: AlertConfig) => setAlertConfig(cfg),
    onSuccess: () => { showMsg('告警配置已保存'); refetchAlert(); },
    onError: (e: any) => showMsg(e.message || '保存失败', 'error'),
  });

  const testAlertMut = useMutation({
    mutationFn: testAlert,
    onSuccess: () => showMsg('测试告警已发送'),
    onError: (e: any) => showMsg(e.message || '发送失败', 'error'),
  });

  const services = servicesData?.services || [];
  const history: DeployRecord[] = Array.isArray(historyData) ? historyData : historyData?.history || [];

  const runningCount = services.filter((s: any) => s.status === 'running').length;
  const stoppedCount = services.filter((s: any) => s.status === 'stopped').length;

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">部署管理</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => { refetchSvc(); refetchHist(); refetchHlth(); }}>
          刷新
        </Button>
      </Box>

      {/* 统计卡片 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <Card><CardContent>
          <Typography color="text.secondary">服务总数</Typography>
          <Typography variant="h3">{services.length}</Typography>
        </CardContent></Card>
        <Card><CardContent>
          <Typography color="text.secondary">运行中</Typography>
          <Typography variant="h3" color="success.main">{runningCount}</Typography>
        </CardContent></Card>
        <Card><CardContent>
          <Typography color="text.secondary">已停止</Typography>
          <Typography variant="h3" color="error.main">{stoppedCount}</Typography>
        </CardContent></Card>
        <Card><CardContent>
          <Typography color="text.secondary">更新历史</Typography>
          <Typography variant="h3">{history.length}</Typography>
        </CardContent></Card>
      </Box>

      {/* 版本信息 */}
      {servicesData && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>后端:</strong> {fmtCommit(servicesData.backend_commit)} &nbsp;
            <strong>前端:</strong> {fmtCommit(servicesData.frontend_commit)} &nbsp;
            <strong>检查:</strong> {formatTime(servicesData.last_check)}
          </Typography>
        </Alert>
      )}

      {/* 操作按钮 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={rebuildBackendMut.isPending ? <CircularProgress size={18}/> : <CloudSyncIcon />}
          onClick={() => rebuildBackendMut.mutate()} disabled={rebuildBackendMut.isPending}>
          重建后端
        </Button>
        <Button variant="contained" color="secondary" startIcon={rebuildFrontendMut.isPending ? <CircularProgress size={18}/> : <WebIcon />}
          onClick={() => rebuildFrontendMut.mutate()} disabled={rebuildFrontendMut.isPending}>
          重建前端
        </Button>
        <Button variant="outlined" startIcon={<UndoIcon />} onClick={() => setTab(3)}>
          回滚
        </Button>
        <Button variant="outlined" startIcon={<NotificationsIcon />} onClick={() => setAlertDialog(true)}>
          告警配置
        </Button>
        <Button variant="outlined" startIcon={<AnalyticsIcon />} onClick={() => setTab(4)}>
          日志分析
        </Button>
      </Box>

      {/* Tab 导航 */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab icon={<HistoryIcon />} label="部署历史" />
        <Tab icon={<HealthIcon_ status={healthData?.status || 'unknown'}/>} label="健康检查" />
        <Tab icon={<BuildIcon />} label="服务状态" />
        <Tab icon={<UndoIcon />} label="回滚管理" />
        <Tab icon={<AnalyticsIcon />} label="日志分析" />
      </Tabs>

      {/* Tab 1: 部署历史 */}
      <TabPanel value={tab} index={0}>
        {histLoading ? <CircularProgress /> : history.length === 0 ? (
          <Alert severity="info">暂无部署历史</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>时间</TableCell><TableCell>事件</TableCell><TableCell>服务</TableCell><TableCell>Commit</TableCell><TableCell>说明</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {history.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{formatTime(r.timestamp)}</TableCell>
                    <TableCell><Chip label={getEventLabel(r.event)} size="small" color={getEventColor(r.event)}/></TableCell>
                    <TableCell>{r.service}</TableCell>
                    <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{fmtCommit(r.commit)}</Typography></TableCell>
                    <TableCell>{r.message || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Tab 2: 健康检查 */}
      <TabPanel value={tab} index={1}>
        {hlthLoading ? <CircularProgress /> : (
          <>
            <Alert severity={healthData?.status === 'healthy' ? 'success' : healthData?.status === 'degraded' ? 'warning' : 'error'} sx={{ mb: 2 }}>
              整体状态: <strong>{healthData?.status === 'healthy' ? '全部健康' : healthData?.status === 'degraded' ? '部分异常' : '异常'}</strong>
            </Alert>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>服务</TableCell><TableCell>状态</TableCell><TableCell>延迟</TableCell><TableCell>错误</TableCell>
                </TableRow></TableHead>
                <TableBody>
                  {(healthData?.services || []).map((s: any) => (
                    <TableRow key={s.service}>
                      <TableCell>{s.service}</TableCell>
                      <TableCell><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <HealthIcon_ status={s.status}/><Chip label={s.status === 'healthy' ? '健康' : s.status === 'unhealthy' ? '异常' : '未知'} size="small"
                          color={s.status === 'healthy' ? 'success' : s.status === 'unhealthy' ? 'error' : 'default'}/>
                      </Box></TableCell>
                      <TableCell>{s.latencyMs}ms</TableCell>
                      <TableCell><Typography variant="body2" color="error">{s.error || '-'}</Typography></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </TabPanel>

      {/* Tab 3: 服务状态 */}
      <TabPanel value={tab} index={2}>
        {svcLoading ? <CircularProgress /> : services.length === 0 ? (
          <Alert severity="warning">未检测到服务</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell>服务</TableCell><TableCell>类型</TableCell><TableCell>运行状态</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {services.map((s: any) => (
                  <TableRow key={s.name}>
                    <TableCell><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ServiceTypeIcon type={s.type}/>{s.name}
                    </Box></TableCell>
                    <TableCell><Chip label={s.type === 'backend' ? '后端' : s.type === 'frontend' ? '前端' : '其他'} size="small"/></TableCell>
                    <TableCell><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StatusIcon status={s.status}/>
                      <Chip label={s.status === 'running' ? '运行中' : '已停止'} size="small"
                        color={s.status === 'running' ? 'success' : 'error'}/>
                    </Box></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* Tab 4: 回滚管理 */}
      <TabPanel value={tab} index={3}>
        <Alert severity="info" sx={{ mb: 2 }}>
          选择服务回滚到上一个成功的部署版本。回滚会自动重建并重启服务。
        </Alert>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
          {services.filter((s: any) => s.type === 'backend').map((s: any) => (
            <Button key={s.name} variant="outlined" startIcon={<UndoIcon />}
              onClick={() => setRollbackDialog({ open: true, service: s.name, commit: '' })}>
              回滚 {s.name}
            </Button>
          ))}
        </Box>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>最近部署记录</Typography>
        {history.slice(-10).reverse().map((r: DeployRecord, i: number) => (
          <Alert key={i} severity={r.success ? 'success' : 'error'} sx={{ mb: 1 }}>
            <Typography variant="body2">
              [{formatTime(r.timestamp)}] {r.service} - {getEventLabel(r.event)} - {fmtCommit(r.commit)}
              {r.message && `: ${r.message}`}
            </Typography>
          </Alert>
        ))}
      </TabPanel>

      {/* Tab 5: 日志分析 */}
      <TabPanel value={tab} index={4}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>选择服务</InputLabel>
            <Select value={logService} label="选择服务" onChange={(e) => setLogService(e.target.value)}>
              <MenuItem value="">全部服务</MenuItem>
              <MenuItem value="core-api">core-api</MenuItem>
              <MenuItem value="content-api">content-api</MenuItem>
              <MenuItem value="realtime-api">realtime-api</MenuItem>
              <MenuItem value="spider-api">spider-api</MenuItem>
              <MenuItem value="gen-api">gen-api</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" onClick={() => refetchLog()} disabled={logLoading}>
            {logLoading ? <CircularProgress size={18}/> : '分析'}
          </Button>
        </Box>
        {logAnalysis && (
          <>
            <Alert severity={logAnalysis.summary.total_errors > 0 ? 'error' : 'success'} sx={{ mb: 2 }}>
              共发现 <strong>{logAnalysis.summary.total_errors}</strong> 个错误, <strong>{logAnalysis.summary.total_warnings}</strong> 个警告
            </Alert>
            {logAnalysis.results.map((r: LogAnalysisResponse['results'][0], i: number) => (
              <Card key={i} sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {r.service} - 错误:{r.errorCount} 警告:{r.warningCount}
                  </Typography>
                  {r.errors.length > 0 && (
                    <Box component="ul" sx={{ pl: 2, m: 0 }}>
                      {r.errors.map((e: string, i: number) => <li key={i}><Typography variant="body2" color="error">{e.substring(0, 200)}</Typography></li>)}
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </TabPanel>

      {/* 回滚对话框 */}
      <Dialog open={rollbackDialog.open} onClose={() => setRollbackDialog({ open: false, service: '', commit: '' })}>
        <DialogTitle>确认回滚</DialogTitle>
        <DialogContent>
          <Typography>确定要回滚 <strong>{rollbackDialog.service}</strong> 吗？</Typography>
          <TextField label="指定 Commit (可选)" fullWidth margin="dense" sx={{ mt: 2 }}
            value={rollbackDialog.commit}
            onChange={(e) => setRollbackDialog((d) => ({ ...d, commit: e.target.value }))}
            placeholder="留空则回滚到上一个版本"/>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRollbackDialog({ open: false, service: '', commit: '' })}>取消</Button>
          <Button variant="contained" color="warning" onClick={() => rollbackMut.mutate({ svc: rollbackDialog.service, commit: rollbackDialog.commit || undefined })}>
            确认回滚
          </Button>
        </DialogActions>
      </Dialog>

      {/* 告警配置对话框 */}
      <Dialog open={alertDialog} onClose={() => setAlertDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>告警配置</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>配置告警后，部署失败或服务异常时会自动发送通知</Alert>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel control={<Switch defaultChecked={alertData?.config?.enabled} onChange={(e) => {
              const cfg = { ...alertData?.config, enabled: e.target.checked } as AlertConfig;
              alertMut.mutate(cfg);
            }}/>} label="启用告警"/>
            <Divider/>
            <FormControl fullWidth>
              <InputLabel>告警类型</InputLabel>
              <Select value={alertData?.config?.type || 'none'} label="告警类型" onChange={(e) => {
                const cfg = { ...alertData?.config, type: e.target.value } as AlertConfig;
                alertMut.mutate(cfg);
              }}>
                <MenuItem value="none">不发送</MenuItem>
                <MenuItem value="dingtalk">钉钉</MenuItem>
                <MenuItem value="feishu">飞书</MenuItem>
                <MenuItem value="slack">Slack</MenuItem>
                <MenuItem value="webhook">自定义 Webhook</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Webhook URL" fullWidth value={alertData?.config?.webhookUrl || ''} onChange={(e) => {
              const cfg = { ...alertData?.config, webhookUrl: e.target.value } as AlertConfig;
              alertMut.mutate(cfg);
            }}/>
            <TextField label="Token (可选)" fullWidth value={alertData?.config?.token || ''} onChange={(e) => {
              const cfg = { ...alertData?.config, token: e.target.value } as AlertConfig;
              alertMut.mutate(cfg);
            }}/>
            <Button variant="outlined" onClick={() => testAlertMut.mutate()} disabled={testAlertMut.isPending}>
              {testAlertMut.isPending ? '发送中...' : '发送测试告警'}
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertDialog(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
