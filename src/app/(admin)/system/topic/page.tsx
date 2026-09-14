'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Chip,
  Switch,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Article as ArticleIcon,
} from '@mui/icons-material';
import {
  listTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  Topic,
  CreateTopicReq,
  UpdateTopicReq,
} from '@/apis/topic';

export default function TopicAdminPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [formData, setFormData] = useState<CreateTopicReq>({
    title: '',
    subtitle: '',
    cover: '',
    description: '',
    contentType: '',
    sort: 0,
  });

  useEffect(() => {
    loadTopics();
  }, [page]);

  const loadTopics = async () => {
    setLoading(true);
    try {
      const res = await listTopics({ page, pageSize: 10 });
      if (res.data) {
        setTopics(res.data.list || []);
        setTotal(res.data.total || 0);
      }
    } catch (error) {
      console.error('加载专题失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (topic?: Topic) => {
    if (topic) {
      setEditingTopic(topic);
      setFormData({
        title: topic.title,
        subtitle: topic.subtitle || '',
        cover: topic.cover || '',
        description: topic.description || '',
        contentType: topic.contentType || '',
        sort: topic.sort,
      });
    } else {
      setEditingTopic(null);
      setFormData({
        title: '',
        subtitle: '',
        cover: '',
        description: '',
        contentType: '',
        sort: 0,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTopic(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingTopic) {
        await updateTopic(editingTopic.id, formData as UpdateTopicReq);
      } else {
        await createTopic(formData);
      }
      handleCloseDialog();
      loadTopics();
    } catch (error) {
      console.error('保存专题失败:', error);
      alert('保存失败，请重试');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个专题吗？')) return;
    try {
      await deleteTopic(id);
      loadTopics();
    } catch (error) {
      console.error('删除专题失败:', error);
      alert('删除失败，请重试');
    }
  };

  const handleToggleStatus = async (topic: Topic) => {
    try {
      await updateTopic(topic.id, { status: topic.status === 1 ? 0 : 1 });
      loadTopics();
    } catch (error) {
      console.error('更新状态失败:', error);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          专题管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          新建专题
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>封面</TableCell>
              <TableCell>标题</TableCell>
              <TableCell>副标题</TableCell>
              <TableCell>内容数</TableCell>
              <TableCell>浏览量</TableCell>
              <TableCell>排序</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  加载中...
                </TableCell>
              </TableRow>
            ) : topics.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  暂无专题
                </TableCell>
              </TableRow>
            ) : (
              topics.map((topic) => (
                <TableRow key={topic.id}>
                  <TableCell>{topic.id}</TableCell>
                  <TableCell>
                    {topic.cover ? (
                      <Box
                        component="img"
                        src={topic.cover}
                        alt={topic.title}
                        sx={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 1 }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 60,
                          height: 40,
                          bgcolor: 'grey.200',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 1,
                        }}
                      >
                        <ArticleIcon color="disabled" />
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="subtitle2">{topic.title}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                      {topic.subtitle || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{topic.contentCount}</TableCell>
                  <TableCell>{topic.viewCount}</TableCell>
                  <TableCell>{topic.sort}</TableCell>
                  <TableCell>
                    <Switch
                      checked={topic.status === 1}
                      onChange={() => handleToggleStatus(topic)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="编辑">
                      <IconButton size="small" onClick={() => handleOpenDialog(topic)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="删除">
                      <IconButton size="small" color="error" onClick={() => handleDelete(topic.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 分页 */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3, gap: 2 }}>
        <Button
          variant="outlined"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          上一页
        </Button>
        <Typography sx={{ alignSelf: 'center' }}>
          {page} / {Math.ceil(total / 10) || 1}
        </Typography>
        <Button
          variant="outlined"
          onClick={() => setPage((p) => p + 1)}
          disabled={page >= Math.ceil(total / 10)}
        >
          下一页
        </Button>
      </Box>

      {/* 编辑对话框 */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingTopic ? '编辑专题' : '新建专题'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="标题"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="副标题"
              value={formData.subtitle}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              fullWidth
            />
            <TextField
              label="封面图URL"
              value={formData.cover}
              onChange={(e) => setFormData({ ...formData, cover: e.target.value })}
              fullWidth
            />
            <TextField
              label="详细描述"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={4}
            />
            <TextField
              label="内容类型限制"
              value={formData.contentType}
              onChange={(e) => setFormData({ ...formData, contentType: e.target.value })}
              fullWidth
              placeholder="如: VIDEO, NOVEL, MUSIC (留空表示不限制)"
            />
            <TextField
              label="排序"
              type="number"
              value={formData.sort}
              onChange={(e) => setFormData({ ...formData, sort: parseInt(e.target.value) || 0 })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!formData.title}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
