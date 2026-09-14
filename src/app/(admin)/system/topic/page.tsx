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
  Autocomplete,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  ListItemSecondaryAction,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Article as ArticleIcon,
  LibraryAdd as LibraryAddIcon,
  Search as SearchIcon,
  RemoveCircle as RemoveCircleIcon,
} from '@mui/icons-material';
import {
  listTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  getTopic,
  addTopicContent,
  removeTopicContent,
  Topic,
  TopicWithContents,
  CreateTopicReq,
  UpdateTopicReq,
} from '@/apis/topic';
import { moduleContentPage } from '@/apis/home';

// 内容搜索结果类型
interface ContentItem {
  id: number;
  title: string;
  subtitle?: string;
  contentType: string;
  coverUrl?: string;
}

export default function TopicAdminPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [openContentDialog, setOpenContentDialog] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [currentTopic, setCurrentTopic] = useState<TopicWithContents | null>(null);
  const [formData, setFormData] = useState<CreateTopicReq>({
    title: '',
    subtitle: '',
    cover: '',
    description: '',
    contentType: '',
    sort: 0,
  });

  // 内容搜索状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);
  const [searching, setSearching] = useState(false);

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

  // 打开内容管理对话框
  const handleOpenContentDialog = async (topic: Topic) => {
    try {
      const res = await getTopic(topic.id);
      if (res.data) {
        setCurrentTopic(res.data);
        setOpenContentDialog(true);
      }
    } catch (error) {
      console.error('加载专题详情失败:', error);
      alert('加载失败，请重试');
    }
  };

  // 搜索内容
  const handleSearchContent = async () => {
    if (!searchKeyword.trim()) return;
    setSearching(true);
    try {
      const res = await moduleContentPage({
        page: 1,
        pageSize: 20,
        title: searchKeyword,
        status: 'PUBLISH',
      }) as any;
      const list = res?.data?.data?.list || res?.data?.data?.records || [];
      setSearchResults(list);
    } catch (error) {
      console.error('搜索内容失败:', error);
    } finally {
      setSearching(false);
    }
  };

  // 添加内容到专题
  const handleAddContent = async (content: ContentItem) => {
    if (!currentTopic) return;
    try {
      await addTopicContent(currentTopic.id, {
        contentId: content.id,
        contentType: content.contentType,
        sort: (currentTopic.contents?.length || 0) + 1,
      });
      // 刷新专题内容
      const res = await getTopic(currentTopic.id);
      if (res.data) {
        setCurrentTopic(res.data);
      }
      // 从搜索结果中移除已添加的内容
      setSearchResults(searchResults.filter((c) => c.id !== content.id));
    } catch (error) {
      console.error('添加内容失败:', error);
      alert('添加失败，请重试');
    }
  };

  // 从专题移除内容
  const handleRemoveContent = async (contentId: number) => {
    if (!currentTopic) return;
    try {
      await removeTopicContent(currentTopic.id, contentId);
      // 刷新专题内容
      const res = await getTopic(currentTopic.id);
      if (res.data) {
        setCurrentTopic(res.data);
      }
    } catch (error) {
      console.error('移除内容失败:', error);
      alert('移除失败，请重试');
    }
  };

  // 检查内容是否已在专题中
  const isContentInTopic = (contentId: number) => {
    return currentTopic?.contents?.some((c: any) => c.id === contentId) || false;
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
                    <Tooltip title="管理内容">
                      <IconButton size="small" color="primary" onClick={() => handleOpenContentDialog(topic)}>
                        <LibraryAddIcon />
                      </IconButton>
                    </Tooltip>
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

      {/* 编辑专题对话框 */}
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

      {/* 内容管理对话框 */}
      <Dialog
        open={openContentDialog}
        onClose={() => setOpenContentDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          管理专题内容 - {currentTopic?.title}
        </DialogTitle>
        <DialogContent>
          {/* 搜索内容 */}
          <Box sx={{ display: 'flex', gap: 1, mb: 3, mt: 1 }}>
            <TextField
              label="搜索内容"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchContent()}
              fullWidth
              size="small"
            />
            <Button
              variant="contained"
              onClick={handleSearchContent}
              disabled={searching}
              startIcon={searching ? <CircularProgress size={20} /> : <SearchIcon />}
            >
              搜索
            </Button>
          </Box>

          {/* 搜索结果 */}
          {searchResults.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                搜索结果 (点击添加到专题)
              </Typography>
              <List dense>
                {searchResults.map((content) => (
                  <ListItem
                    key={content.id}
                    sx={{
                      bgcolor: isContentInTopic(content.id) ? 'action.selected' : 'transparent',
                      borderRadius: 1,
                      mb: 0.5,
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar src={content.coverUrl} variant="rounded">
                        <ArticleIcon />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={content.title}
                      secondary={content.contentType}
                    />
                    <ListItemSecondaryAction>
                      {isContentInTopic(content.id) ? (
                        <Chip label="已添加" size="small" color="success" />
                      ) : (
                        <IconButton
                          edge="end"
                          color="primary"
                          onClick={() => handleAddContent(content)}
                        >
                          <AddIcon />
                        </IconButton>
                      )}
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* 当前专题内容 */}
          <Typography variant="subtitle2" gutterBottom>
            当前专题内容 ({currentTopic?.contents?.length || 0})
          </Typography>
          {currentTopic?.contents && currentTopic.contents.length > 0 ? (
            <List dense>
              {currentTopic.contents.map((content: any) => (
                <ListItem key={content.id}>
                  <ListItemAvatar>
                    <Avatar src={content.coverUrl} variant="rounded">
                      <ArticleIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={content.title}
                    secondary={`${content.contentType} · ${content.readNum || 0} 阅读`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      color="error"
                      onClick={() => handleRemoveContent(content.id)}
                    >
                      <RemoveCircleIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              该专题暂无内容，请通过上方搜索添加
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenContentDialog(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
