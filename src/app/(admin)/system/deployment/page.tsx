'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import RefreshIcon from '@mui/icons-material/Refresh';
import BuildIcon from '@mui/icons-material/Build';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import WebIcon from '@mui/icons-material/Web';
import StorageIcon from '@mui/icons-material/Storage';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getServicesStatus,
  getDeploymentHistory,
  rebuildBackend,
  rebuildFrontend,
} from '@/apis/deployment';

// 服务类型图标映射
const ServiceTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'backend':
      return <BuildIcon fontSize="small" />;
    case 'frontend':
      return <WebIcon fontSize="small" />;
    case 'infrastructure':
      return <StorageIcon fontSize="small" />;
    default:
      return <StorageIcon fontSize="small" />;
  }
};

// 状态颜色映射
const getStatusColor = (status: string) => {
  switch (status) {
    case 'running':
      return 'success';
    case 'stopped':
      return 'error';
    case 'unknown':
      return 'default';
    default:
      return 'default';
  }
};

// 状态图标
const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'running':
      return <CheckCircleIcon fontSize="small" color="success" />;
    case 'stopped':
      return <ErrorIcon fontSize="small" color="error" />;
    default:
      return <HourglassEmptyIcon fontSize="small" />;
  }
};

// 事件类型映射
const getEventLabel = (event: string) => {
  switch (event) {
    case 'startup':
      return '启动';
    case 'auto_update':
      return '自动更新';
    case 'manual_rebuild':
      return '手动重建';
    case 'service_rebuild':
      return '服务重建';
    case 'build_failed':
      return '构建失败';
    default:
      return event;
  }
};

const getEventColor = (event: string) => {
  switch (event) {
    case 'startup':
      return 'default';
    case 'auto_update':
      return 'info';
    case 'manual_rebuild':
      return 'warning';
    case 'service_rebuild':
      return 'warning';
    case 'build_failed':
      return 'error';
    default:
      return 'default';
  }
};

// 格式化时间
const formatTime = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
};

// 格式化 commit
const formatCommit = (commit: string) => {
  if (!commit || commit === 'unknown') return '-';
  return commit.length > 8 ? commit.substring(0, 8) : commit;
};

export default function DeploymentPage() {
  const qc = useQueryClient();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showMessage = useCallback((message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // 获取服务状态
  const { data: servicesData, isLoading: servicesLoading, error: servicesError, refetch: refetchServices } = useQuery({
    queryKey: ['deployment', 'services'],
    queryFn: getServicesStatus,
    refetchInterval: 30000, // 30秒刷新一次
  });

  // 获取部署历史
  const { data: historyData, isLoading: historyLoading, error: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ['deployment', 'history'],
    queryFn: getDeploymentHistory,
    refetchInterval: 30000,
  });

  // 重建后端
  const rebuildBackendMutation = useMutation({
    mutationFn: rebuildBackend,
    onSuccess: () => {
      showMessage('后端重建已触发');
      setTimeout(() => {
        refetchServices();
        refetchHistory();
      }, 5000);
    },
    onError: (err: any) => {
      showMessage(err.message || '后端重建失败', 'error');
    },
  });

  // 重建前端
  const rebuildFrontendMutation = useMutation({
    mutationFn: rebuildFrontend,
    onSuccess: () => {
      showMessage('前端重建已触发');
      setTimeout(() => {
        refetchServices();
        refetchHistory();
      }, 5000);
    },
    onError: (err: any) => {
      showMessage(err.message || '前端重建失败', 'error');
    },
  });

  // 刷新所有数据
  const handleRefresh = () => {
    refetchServices();
    refetchHistory();
  };

  const services = servicesData?.services || [];
  const history = Array.isArray(historyData) ? historyData : [];

  // 统计信息
  const runningCount = services.filter((s: any) => s.status === 'running').length;
  const stoppedCount = services.filter((s: any) => s.status === 'stopped').length;

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">部署管理</Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          disabled={servicesLoading || historyLoading}
        >
          刷新
        </Button>
      </Box>

      {/* 统计卡片 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <Card>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>服务总数</Typography>
            <Typography variant="h3">{services.length}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>运行中</Typography>
            <Typography variant="h3" color="success.main">{runningCount}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>已停止</Typography>
            <Typography variant="h3" color="error.main">{stoppedCount}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography color="text.secondary" gutterBottom>更新历史</Typography>
            <Typography variant="h3">{history.length}</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 当前版本信息 */}
      {servicesData && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>后端版本:</strong> {formatCommit(servicesData.backend_commit)} &nbsp;&nbsp;
            <strong>前端版本:</strong> {formatCommit(servicesData.frontend_commit)} &nbsp;&nbsp;
            <strong>最后检查:</strong> {formatTime(servicesData.last_check)}
          </Typography>
        </Alert>
      )}

      {/* 操作按钮 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={rebuildBackendMutation.isPending ? <CircularProgress size={20} /> : <CloudSyncIcon />}
          onClick={() => rebuildBackendMutation.mutate()}
          disabled={rebuildBackendMutation.isPending}
        >
          重建后端
        </Button>
        <Button
          variant="contained"
          color="secondary"
          startIcon={rebuildFrontendMutation.isPending ? <CircularProgress size={20} /> : <WebIcon />}
          onClick={() => rebuildFrontendMutation.mutate()}
          disabled={rebuildFrontendMutation.isPending}
        >
          重建前端
        </Button>
      </Box>

      {/* 服务状态表格 */}
      <Typography variant="h6" sx={{ mb: 2 }}>服务状态</Typography>
      {servicesLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : servicesError ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>获取服务状态失败</strong><br/>
            请检查 updater 服务是否运行: <code>http://localhost:10082</code><br/>
            错误: {String(servicesError)}
          </Typography>
        </Alert>
      ) : services.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            未检测到服务，可能 updater 服务未运行或网络不可达
          </Typography>
        </Alert>
      ) : (
        <TableContainer component={Paper} sx={{ mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>服务名称</TableCell>
                <TableCell>类型</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>健康检查</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map((service: any) => (
                <TableRow key={service.name}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ServiceTypeIcon type={service.type} />
                      {service.name}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={service.type === 'backend' ? '后端' : service.type === 'frontend' ? '前端' : '基础设施'}
                      size="small"
                      color={service.type === 'backend' ? 'primary' : service.type === 'frontend' ? 'secondary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StatusIcon status={service.status} />
                      <Chip
                        label={service.status === 'running' ? '运行中' : service.status === 'stopped' ? '已停止' : '未知'}
                        size="small"
                        color={getStatusColor(service.status)}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    {service.health && service.health !== 'unknown' ? (
                      <Chip label={service.health} size="small" color="success" variant="outlined" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 部署历史 */}
      <Typography variant="h6" sx={{ mb: 2 }}>部署历史</Typography>
      {historyLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : historyError ? (
        <Alert severity="error">
          获取部署历史失败
        </Alert>
      ) : history.length === 0 ? (
        <Alert severity="info">
          暂无部署历史记录
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>时间</TableCell>
                <TableCell>事件</TableCell>
                <TableCell>Commit</TableCell>
                <TableCell>说明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((record: any, index: number) => (
                <TableRow key={index}>
                  <TableCell>{formatTime(record.timestamp)}</TableCell>
                  <TableCell>
                    <Chip
                      label={getEventLabel(record.event)}
                      size="small"
                      color={getEventColor(record.event)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        cursor: 'pointer',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                      title={record.commit}
                    >
                      {formatCommit(record.commit)}
                    </Typography>
                  </TableCell>
                  <TableCell>{record.message || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 提示信息 */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>提示:</strong> 服务每 30 秒自动刷新一次。重建操作会触发 git pull 和镜像重建，可能需要几分钟时间。
          <br />
          自动更新: updater 每 60 秒检查一次 git 远程仓库，发现更新后自动重建。
        </Typography>
      </Alert>

      {/* 消息提示 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
