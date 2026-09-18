'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  Chip,
  Switch,
  Tooltip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  ListItemSecondaryAction,
  Divider,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Article as ArticleIcon,
  LibraryAdd as LibraryAddIcon,
  Search as SearchIcon,
  RemoveCircle as RemoveCircleIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { DataGridTable } from '@/components/tables/DataGridTable';
import type { GridColDef } from '@mui/x-data-grid';
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
  TopicKind,
  parseTopicRule,
  curateTopics,
} from '@/apis/topic';
import { moduleContentPage } from '@/apis/home';

// 自动收录规则可选的内容类型
const RULE_CONTENT_TYPES: { value: string; label: string }[] = [
  { value: 'FILM', label: '电影' },
  { value: 'TELEPLAY', label: '剧集' },
  { value: 'VIDEO', label: '视频' },
  { value: 'ANIMATION', label: '动画' },
  { value: 'COMICS', label: '漫画' },
  { value: 'VSHOW', label: '综艺' },
  { value: 'NOVEL', label: '小说' },
  { value: 'MUSIC', label: '音乐' },
  { value: 'ARTICLE', label: '文章' },
  { value: 'WALLPAPER', label: '壁纸' },
];

interface RuleForm {
  contentTypes: string[];
  keywords: string;
  orderBy: 'hot' | 'new';
}

const emptyRule: RuleForm = { contentTypes: [], keywords: '', orderBy: 'hot' };

// 内容搜索结果类型(内容 id 超过 2^53 时是字符串)
interface ContentItem {
  id: number | string;
  title: string;
  subtitle?: string;
  contentType: string;
  coverUrl?: string;
}

/** 列表里重新拉取数据用的 token,改它即可让 DataGridTable 刷新当前页 */
export default function TopicAdminPage() {
  const [refreshToken, setRefreshToken] = useState(0);
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
    kind: 'collection',
  });
  const [ruleForm, setRuleForm] = useState<RuleForm>(emptyRule);
  // 自动生成:internal/topiccurator 每 30 分钟跑一轮;这里可以立即触发并看结果
  const [curating, setCurating] = useState(false);
  const [curateNote, setCurateNote] = useState('');

  // 内容搜索状态
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<ContentItem[]>([]);
  const [searching, setSearching] = useState(false);

  // 列表由 DataGridTable 拉取;改动数据后调用它来刷新当前页
  const loadTopics = () => setRefreshToken((n) => n + 1);

  const handleCurate = async () => {
    setCurating(true);
    setCurateNote('');
    try {
      const res = await curateTopics();
      const r = res;
      if (r) {
        setCurateNote(
          `已按 ${r.contents} 条内容生成:标签专题 ${r.tagTopics}(候选 ${r.tagCandidates})、平台专题 ${r.platformTopics};新建 ${r.created}、刷新 ${r.updated}、跳过已停用 ${r.skippedOff};热度分刷新 ${r.scored} 个,用时 ${r.duration}`,
        );
      }
      loadTopics();
    } catch (error: any) {
      setCurateNote(`生成失败:${error?.message || error}`);
    } finally {
      setCurating(false);
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
        kind: topic.kind || 'collection',
      });
      const r = parseTopicRule(topic.rule);
      setRuleForm({ contentTypes: r.contentTypes || [], keywords: (r.keywords || []).join(','), orderBy: r.orderBy === 'new' ? 'new' : 'hot' });
    } else {
      setEditingTopic(null);
      setFormData({
        title: '',
        subtitle: '',
        cover: '',
        description: '',
        contentType: '',
        sort: 0,
        kind: 'collection',
      });
      setRuleForm(emptyRule);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTopic(null);
  };

  const handleSubmit = async () => {
    // 规则为空(没选类型也没填关键词)时后端会清除规则
    const payload: CreateTopicReq = {
      ...formData,
      rule: {
        contentTypes: ruleForm.contentTypes,
        keywords: ruleForm.keywords.split(/[,，\s]+/).map((k) => k.trim()).filter(Boolean),
        orderBy: ruleForm.orderBy,
      },
    };
    try {
      if (editingTopic) {
        await updateTopic(editingTopic.id, payload);
      } else {
        await createTopic(payload);
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
      if (res) {
        setCurrentTopic(res);
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

      const list = res?.list || res?.records || [];
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
      if (res) {
        setCurrentTopic(res);
      }
      // 从搜索结果中移除已添加的内容
      setSearchResults(searchResults.filter((c) => String(c.id) !== String(content.id)));
    } catch (error) {
      console.error('添加内容失败:', error);
      alert('添加失败，请重试');
    }
  };

  // 从专题移除内容
  const handleRemoveContent = async (contentId: number | string) => {
    if (!currentTopic) return;
    try {
      await removeTopicContent(currentTopic.id, contentId);
      // 刷新专题内容
      const res = await getTopic(currentTopic.id);
      if (res) {
        setCurrentTopic(res);
      }
    } catch (error) {
      console.error('移除内容失败:', error);
      alert('移除失败，请重试');
    }
  };

  // 检查内容是否已在专题中
  const isContentInTopic = (contentId: number | string) => {
    return currentTopic?.contents?.some((c: any) => String(c.id) === String(contentId)) || false;
  };

  const columns: GridColDef<Topic>[] = [
    { field: 'id', headerName: 'ID', width: 70 },
    {
      field: 'cover',
      headerName: '封面',
      width: 90,
      sortable: false,
      renderCell: (params) =>
        params.value ? (
          <Box component="img" src={params.value as string} alt="" sx={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 1 }} />
        ) : (
          <Box sx={{ width: 60, height: 40, bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 1 }}>
            <ArticleIcon color="disabled" />
          </Box>
        ),
    },
    {
      field: 'title',
      headerName: '标题',
      width: 160,
      renderCell: (params) => (
        <Box>
          <Typography variant="subtitle2">{params.value}</Typography>
          {params.row.ownerId ? <Typography variant="caption" color="text.secondary">用户创建</Typography> : null}
        </Box>
      ),
    },
    {
      field: 'kind',
      headerName: '类型',
      width: 170,
      sortable: false,
      renderCell: (params) => {
        const topic = params.row as Topic;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', height: '100%' }}>
            <Chip size="small" variant="outlined" label={topic.kind === 'topic' ? '话题' : '合集'} />
            {topic.source === 'auto' ? (
              <Tooltip title={`数据自动生成(${topic.autoKey || ''}),热度分 ${topic.hotScore ?? 0}。停用后不会再被自动复活`}>
                <Chip size="small" color="info" label="自动生成" sx={{ ml: 0.5 }} />
              </Tooltip>
            ) : topic.rule ? <Chip size="small" label="自动收录" sx={{ ml: 0.5 }} /> : null}
          </Box>
        );
      },
    },
    {
      field: 'subtitle',
      headerName: '副标题',
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 180 }}>
          {(params.value as string) || '-'}
        </Typography>
      ),
    },
    { field: 'contentCount', headerName: '内容数', width: 80 },
    { field: 'followerCount', headerName: '关注 / 讨论', width: 100, renderCell: (params) => `${params.row.followerCount ?? 0} / ${params.row.postCount ?? 0}` },
    { field: 'viewCount', headerName: '浏览量', width: 90 },
    { field: 'sort', headerName: '排序', width: 70 },
    {
      field: 'status',
      headerName: '状态',
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <Switch checked={params.value === 1} onChange={() => handleToggleStatus(params.row as Topic)} size="small" />
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          专题管理
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="按内容标签与各平台热榜自动生成合集,并刷新所有专题的热度分(后台每 30 分钟也会自动跑一轮)">
            <span>
              <Button variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={handleCurate} disabled={curating}>
                {curating ? '生成中…' : '立即生成'}
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            新建专题
          </Button>
        </Box>
      </Box>
      {curateNote && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {curateNote}
        </Typography>
      )}

      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          const res = await listTopics({ page: params.pageNumber, pageSize: params.pageSize });
          return {
            records: res?.list || res?.records || [],
            totalRow: res?.total || 0,
          };
        }}
        extraParams={{ refresh: refreshToken }}
        customActions={[
          {
            label: '内容',
            icon: <LibraryAddIcon />,
            color: 'primary',
            onClick: (row) => handleOpenContentDialog(row),
          },
        ]}
        onEdit={(row) => handleOpenDialog(row)}
        onDelete={(row) => handleDelete(row.id)}
      />

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
              select
              label="类型"
              value={formData.kind || 'collection'}
              onChange={(e) => setFormData({ ...formData, kind: e.target.value as TopicKind })}
              fullWidth
              helperText="合集:以作品为主(手工收录 + 自动收录);话题:以讨论为主,用户发帖写 #话题名# 即可参与"
            >
              <MenuItem value="collection">合集</MenuItem>
              <MenuItem value="topic">话题</MenuItem>
            </TextField>
            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              自动收录规则(可选)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1.5 }}>
              手工收录的作品排在前面,满足规则的作品自动补在后面;类型和关键词都不填表示不自动收录。
            </Typography>
            <TextField
              select
              label="内容类型"
              value={ruleForm.contentTypes}
              onChange={(e) => {
                const v = e.target.value as unknown as string[] | string;
                setRuleForm({ ...ruleForm, contentTypes: typeof v === 'string' ? v.split(',') : v });
              }}
              slotProps={{ select: { multiple: true } }}
              fullWidth
            >
              {RULE_CONTENT_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="标题/标签关键词"
              value={ruleForm.keywords}
              onChange={(e) => setRuleForm({ ...ruleForm, keywords: e.target.value })}
              fullWidth
              placeholder="多个用逗号分隔,如:科幻, 悬疑"
            />
            <TextField
              select
              label="自动收录排序"
              value={ruleForm.orderBy}
              onChange={(e) => setRuleForm({ ...ruleForm, orderBy: e.target.value as 'hot' | 'new' })}
              fullWidth
            >
              <MenuItem value="hot">按热度</MenuItem>
              <MenuItem value="new">按最近更新</MenuItem>
            </TextField>
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
