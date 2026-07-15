'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Button, IconButton, Chip, Avatar, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel,
  Select, MenuItem, Switch, FormControlLabel, Alert, CircularProgress, Tooltip,
  Stack, Card, CardContent
} from '@mui/material';
import {
  Search as SearchIcon, Add as AddIcon, Pause as PauseIcon,
  PlayArrow as PlayIcon, Delete as DeleteIcon, SmartToy as BotIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import { page, get, save, update, remove, pause, resume, batchCreate, BatchCreateBotParams } from '@/apis/bot';

interface BotItem {
  id: number;
  name: string;
  nickname: string;
  avatar: string;
  personaPrompt: string;
  commentTemplates: string[];
  useLlmForComments: boolean;
  commentIntervalMinutes: number;
  chatEnabled: boolean;
  llmModel: string;
  status: string;
  lastActiveAt: string | null;
  createTime: string;
  updateTime: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#4caf50',
  paused: '#ff9800',
  banned: '#f44336',
};

const STATUS_LABELS: Record<string, string> = {
  active: '运行中',
  paused: '已暂停',
  banned: '已封禁',
};

export default function BotManagementPage() {
  const theme = useTheme();

  const [bots, setBots] = useState<BotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // 创建/编辑对话框
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<BotItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    avatar: '',
    personaPrompt: '',
    commentTemplates: '',
    useLlmForComments: false,
    commentIntervalMinutes: 30,
    chatEnabled: true,
    llmModel: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  // 批量创建对话框
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchForm, setBatchForm] = useState<BatchCreateBotParams>({
    count: 10,
    prefix: 'bot',
    personaPrompt: '你是一个真实用户,对内容做出自然的评论。',
    commentTemplates: [
      '这个内容太棒了！',
      '写得真好，点赞！',
      '内容很有深度，学到了',
      '很有意思，继续加油！',
      '收藏了，感谢分享！',
    ],
    useLlmForComments: false,
    commentIntervalMinutes: 30,
    initBalance: 10000,
  });
  const [batchResult, setBatchResult] = useState<{ successCount: number; failedCount: number } | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // 加载数据
  const loadBots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await page({
        page: currentPage + 1,
        pageSize: rowsPerPage,
        keyword: search || undefined,
        status: statusFilter || undefined,
      });
      setBots(res?.list || []);
      setTotal(res?.total || 0);
    } catch (err) {
      console.error('Load bots failed:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, rowsPerPage, search, statusFilter]);

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  // 打开创建对话框
  const handleOpenCreate = () => {
    setEditingBot(null);
    setFormData({
      name: '',
      nickname: '',
      avatar: '',
      personaPrompt: '你是一个真实用户,对内容做出自然的评论。',
      commentTemplates: '["太棒了！", "点赞！", "写得真好"]',
      useLlmForComments: false,
      commentIntervalMinutes: 30,
      chatEnabled: true,
      llmModel: '',
    });
    setDialogOpen(true);
  };

  // 打开编辑对话框
  const handleOpenEdit = async (bot: BotItem) => {
    try {
      const res = await get(bot.id);
      const data = res?.data || res;
      setEditingBot(data);
      setFormData({
        name: data.nickname || data.name,
        nickname: data.nickname || '',
        avatar: data.avatar || '',
        personaPrompt: data.personaPrompt || '',
        commentTemplates: Array.isArray(data.commentTemplates)
          ? JSON.stringify(data.commentTemplates)
          : JSON.stringify(data.commentTemplates || []),
        useLlmForComments: data.useLlmForComments || false,
        commentIntervalMinutes: data.commentIntervalMinutes || 30,
        chatEnabled: data.chatEnabled !== false,
        llmModel: data.llmModel || '',
      });
      setDialogOpen(true);
    } catch (err) {
      console.error('Load bot failed:', err);
    }
  };

  // 保存
  const handleSave = async () => {
    setFormLoading(true);
    try {
      const data = {
        ...formData,
        commentTemplates: JSON.parse(formData.commentTemplates || '[]'),
      };
      if (editingBot) {
        await update({ id: editingBot.id, ...data });
      } else {
        await save(data);
      }
      setDialogOpen(false);
      loadBots();
    } catch (err: any) {
      alert(err?.message || err?.msg || '保存失败');
    } finally {
      setFormLoading(false);
    }
  };

  // 删除
  const handleDelete = async (bot: BotItem) => {
    if (!confirm(`确定删除假人「${bot.nickname || bot.name}」？`)) return;
    try {
      await remove([bot.id]);
      loadBots();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // 暂停/恢复
  const handleToggleStatus = async (bot: BotItem) => {
    try {
      if (bot.status === 'active') {
        await pause(bot.id);
      } else {
        await resume(bot.id);
      }
      loadBots();
    } catch (err) {
      console.error('Toggle status failed:', err);
    }
  };

  // 批量创建
  const handleBatchCreate = async () => {
    setBatchLoading(true);
    setBatchResult(null);
    try {
      const res = await batchCreate(batchForm);
      setBatchResult(res);
      if (res.successCount > 0) {
        loadBots();
      }
    } catch (err: any) {
      alert(err?.message || err?.msg || '批量创建失败');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleChangePage = (_: unknown, newPage: number) => setCurrentPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setCurrentPage(0);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 标题栏 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 40, height: 40 }}>
            <BotIcon />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>假人管理</Typography>
            <Typography variant="caption" color="text.secondary">
              管理平台假人账号，自动评论和互动
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setBatchDialogOpen(true)}>
            批量创建
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
            新建假人
          </Button>
        </Stack>
      </Box>

      {/* 统计卡片 */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Card sx={{ flex: '1 1 200px' }}>
          <CardContent>
            <Typography color="text.secondary" variant="body2">假人总数</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>{total}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 200px' }}>
          <CardContent>
            <Typography color="text.secondary" variant="body2">运行中</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#4caf50' }}>
              {bots.filter(b => b.status === 'active').length}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: '1 1 200px' }}>
          <CardContent>
            <Typography color="text.secondary" variant="body2">已暂停</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#ff9800' }}>
              {bots.filter(b => b.status === 'paused').length}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 搜索和筛选 */}
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <TextField
            size="small"
            placeholder="搜索名称/昵称..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(0); }}
            slotProps={{
              input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }
            }}
            sx={{ width: 240 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>状态</InputLabel>
            <Select value={statusFilter} label="状态" onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(0); }}>
              <MenuItem value="">全部</MenuItem>
              <MenuItem value="active">运行中</MenuItem>
              <MenuItem value="paused">已暂停</MenuItem>
              <MenuItem value="banned">已封禁</MenuItem>
            </Select>
          </FormControl>
          <Button startIcon={<RefreshIcon />} onClick={loadBots} disabled={loading}>
            刷新
          </Button>
        </Stack>
      </Paper>

      {/* 表格 */}
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>假人</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>评论方式</TableCell>
              <TableCell>间隔(分钟)</TableCell>
              <TableCell>最后活跃</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : bots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">暂无数据</Typography>
                </TableCell>
              </TableRow>
            ) : (
              bots.map((bot) => (
                <TableRow key={bot.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar src={bot.avatar} sx={{ width: 36, height: 36 }}>
                        {(bot.nickname || bot.name).charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {bot.nickname || bot.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {bot.name}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={STATUS_LABELS[bot.status] || bot.status}
                      size="small"
                      sx={{
                        bgcolor: alpha(STATUS_COLORS[bot.status] || '#999', 0.1),
                        color: STATUS_COLORS[bot.status] || '#999',
                        fontWeight: 500,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {bot.useLlmForComments ? '🤖 LLM' : '📝 模板'}
                    </Typography>
                  </TableCell>
                  <TableCell>{bot.commentIntervalMinutes}</TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {bot.lastActiveAt ? new Date(bot.lastActiveAt).toLocaleString() : '从未'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                      <Tooltip title={bot.status === 'active' ? '暂停' : '恢复'}>
                        <IconButton size="small" onClick={() => handleToggleStatus(bot)}>
                          {bot.status === 'active' ? <PauseIcon /> : <PlayIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="编辑">
                        <IconButton size="small" onClick={() => handleOpenEdit(bot)}>
                          <BotIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={() => handleDelete(bot)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={currentPage}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </Paper>

      {/* 创建/编辑对话框 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingBot ? '编辑假人' : '新建假人'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {!editingBot && (
              <TextField
                label="名称(name)" required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                helperText="唯一标识,如 bot_001"
                fullWidth
              />
            )}
            <TextField
              label="昵称"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              fullWidth
            />
            <TextField
              label="头像URL"
              value={formData.avatar}
              onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
              fullWidth
            />
            <TextField
              label="人设提示词"
              value={formData.personaPrompt}
              onChange={(e) => setFormData({ ...formData, personaPrompt: e.target.value })}
              multiline rows={3}
              helperText="定义假人的性格和行为方式"
              fullWidth
            />
            <TextField
              label="评论模板(JSON数组)"
              value={formData.commentTemplates}
              onChange={(e) => setFormData({ ...formData, commentTemplates: e.target.value })}
              multiline rows={3}
              helperText='如: ["太棒了！", "点赞！"]'
              fullWidth
            />
            <Stack direction="row" spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.useLlmForComments}
                    onChange={(e) => setFormData({ ...formData, useLlmForComments: e.target.checked })}
                  />
                }
                label="使用LLM生成评论"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.chatEnabled}
                    onChange={(e) => setFormData({ ...formData, chatEnabled: e.target.checked })}
                  />
                }
                label="启用聊天"
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="评论间隔(分钟)"
                type="number"
                value={formData.commentIntervalMinutes}
                onChange={(e) => setFormData({ ...formData, commentIntervalMinutes: parseInt(e.target.value) || 30 })}
                sx={{ flex: 1 }}
              />
              <TextField
                label="LLM模型"
                value={formData.llmModel}
                onChange={(e) => setFormData({ ...formData, llmModel: e.target.value })}
                placeholder="如: gpt-4o-mini"
                sx={{ flex: 1 }}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={formLoading}>
            {formLoading ? <CircularProgress size={20} /> : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 批量创建对话框 */}
      <Dialog open={batchDialogOpen} onClose={() => setBatchDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>批量创建假人</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="创建数量"
              type="number"
              value={batchForm.count}
              onChange={(e) => setBatchForm({ ...batchForm, count: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) })}
              slotProps={{ htmlInput: { min: 1, max: 100 } }}
              helperText="1-100 个"
              fullWidth
            />
            <TextField
              label="名称前缀"
              value={batchForm.prefix}
              onChange={(e) => setBatchForm({ ...batchForm, prefix: e.target.value })}
              helperText="如 bot, 实际名称为 bot_001, bot_002..."
              fullWidth
            />
            <TextField
              label="人设提示词"
              value={batchForm.personaPrompt}
              onChange={(e) => setBatchForm({ ...batchForm, personaPrompt: e.target.value })}
              multiline rows={2}
              fullWidth
            />
            <TextField
              label="评论模板"
              value={batchForm.commentTemplates?.join('\n')}
              onChange={(e) => setBatchForm({
                ...batchForm,
                commentTemplates: e.target.value.split('\n').filter(t => t.trim())
              })}
              multiline rows={4}
              helperText="每行一个模板,支持 {title} 占位符"
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={batchForm.useLlmForComments}
                  onChange={(e) => setBatchForm({ ...batchForm, useLlmForComments: e.target.checked })}
                />
              }
              label="使用LLM"
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="评论间隔(分钟)"
                type="number"
                value={batchForm.commentIntervalMinutes}
                onChange={(e) => setBatchForm({ ...batchForm, commentIntervalMinutes: parseInt(e.target.value) || 30 })}
                sx={{ flex: 1 }}
              />
              <TextField
                label="初始积分(分)"
                type="number"
                value={batchForm.initBalance}
                onChange={(e) => setBatchForm({ ...batchForm, initBalance: parseInt(e.target.value) || 0 })}
                helperText="每个假人的初始积分"
                sx={{ flex: 1 }}
              />
            </Stack>

            {batchResult && (
              <Alert severity={batchResult.failedCount === 0 ? 'success' : 'warning'}>
                成功创建 {batchResult.successCount} 个,失败 {batchResult.failedCount} 个
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setBatchDialogOpen(false); setBatchResult(null); }}>关闭</Button>
          <Button variant="contained" onClick={handleBatchCreate} disabled={batchLoading}>
            {batchLoading ? <CircularProgress size={20} /> : '批量创建'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
