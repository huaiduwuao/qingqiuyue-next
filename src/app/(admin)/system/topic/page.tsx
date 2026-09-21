'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
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
} from '@mui/material';
import {
  Add as AddIcon,
  Article as ArticleIcon,
  LibraryAdd as LibraryAddIcon,
  Search as SearchIcon,
  RemoveCircle as RemoveCircleIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';
import { CoverImage } from '@/components/common/CoverImage';
import { DataGridTable } from '@/components/tables/DataGridTable';
import type { GridColDef } from '@mui/x-data-grid';
import {
  listTopics,
  updateTopic,
  approveTopic,
  rejectTopic,
  deleteTopic,
  getTopic,
  addTopicContent,
  removeTopicContent,
  Topic,
  TopicWithContents,
  TOPIC_VISIBILITY_LABEL,
  curateTopics,
} from '@/apis/topic';
import { useAuthority } from '@/contexts/AuthContext';
import { moduleContentPage } from '@/apis/home';
import { TopicInsightsEditorDialog } from './InsightsEditorDialog';
import { TopicFormDialog } from '@/components/topic/TopicFormDialog';

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
  // 私密合集(admin_only)只对管理员开放:运营能管公开专题,但看不到也不该设私密。
  const { isAdmin } = useAuthority();
  const [refreshToken, setRefreshToken] = useState(0);
  // 待审池筛选(E2)。用户在前台自己建的意境进 status=0 归自己名下,要在这里通过才上线;
  // 不传 status 是看全部 —— 默认停在「待审」上,否则用户提交的意境会一直压在池子里没人看。
  const [statusFilter, setStatusFilter] = useState<'' | '0' | '1' | '2'>('0');
  // 主编辑表单(共享 TopicFormDialog)。
  const [formOpen, setFormOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [openContentDialog, setOpenContentDialog] = useState(false);
  // 专题洞察编辑器(lineups / versionHistory / autoFromSources)—— 走独立 Dialog,
  // 不嵌入主编辑表单,免得 UpdateTopicReq 字段流受牵连。
  const [insightsTopic, setInsightsTopic] = useState<Topic | null>(null);
  const [currentTopic, setCurrentTopic] = useState<TopicWithContents | null>(null);
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
    setFormOpen(true);
    setEditingTopic(topic ?? null);
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

  /**
   * 待审池裁决。通过保留 owner_id —— 意境主理人由创建者继续持有,
   * 上线后即可在主理人控制台维护。先确认一次。
   */
  const handleReview = async (topic: Topic, approve: boolean) => {
    if (!window.confirm(approve ? `通过「${topic.title}」?通过后它归官方,立即出现在意境广场。` : `驳回「${topic.title}」?`)) return;
    try {
      await (approve ? approveTopic(topic.id) : rejectTopic(topic.id));
      loadTopics();
    } catch (error: any) {
      console.error('审核失败:', error);
      alert(`审核失败:${error?.message || error}`);
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
          <CoverImage src={params.value as string} alt="" sx={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 1 }} />
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
            {topic.visibility === 'admin_only' ? (
              <Tooltip title={`可见范围:${TOPIC_VISIBILITY_LABEL.admin_only}。前台(搜索、联想、作品「收录于」)都看不到它`}>
                <Chip size="small" color="warning" label="私密" sx={{ ml: 0.5 }} />
              </Tooltip>
            ) : null}
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
      width: 110,
      sortable: false,
      // status:0 未上线(用户提交的 = 待审)、1 已上线、2 已驳回。
      // 用户提交的不能用开关直接扳上线 —— 通过要走 approve,它会清零 owner_id。
      renderCell: (params) => {
        const row = params.row as Topic;
        if (row.status === 2) return <Chip size="small" label="已驳回" color="error" variant="outlined" />;
        if (row.status === 0 && (row.ownerId ?? 0) > 0) {
          return <Chip size="small" label="待审" color="warning" />;
        }
        return <Switch checked={params.value === 1} onChange={() => handleToggleStatus(row)} size="small" />;
      },
    },
  ];

  const STATUS_TABS: { value: '' | '0' | '1' | '2'; label: string }[] = [
    { value: '0', label: '待审 / 未上线' },
    { value: '1', label: '已上线' },
    { value: '2', label: '已驳回' },
    { value: '', label: '全部' },
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

      {/* 待审池入口。用户在前台自己开的意境全落在「待审」这一档里,不给个筛选就等于没人审。 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {STATUS_TABS.map((t) => (
          <Button
            key={t.value || 'all'}
            size="small"
            variant={statusFilter === t.value ? 'contained' : 'text'}
            onClick={() => setStatusFilter(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </Box>

      <DataGridTable
        columns={columns}
        fetchData={async (params) => {
          const res = await listTopics({
            page: params.pageNumber,
            pageSize: params.pageSize,
            status: statusFilter === '' ? undefined : Number(statusFilter),
          });
          return {
            records: res?.list || res?.records || [],
            totalRow: res?.total || 0,
          };
        }}
        extraParams={{ refresh: refreshToken, status: statusFilter }}
        customActions={[
          {
            label: '通过',
            color: 'success',
            hidden: (row) => !(row.status === 0 && (row.ownerId ?? 0) > 0),
            onClick: (row) => handleReview(row as Topic, true),
          },
          {
            label: '驳回',
            color: 'error',
            hidden: (row) => !(row.status === 0 && (row.ownerId ?? 0) > 0),
            onClick: (row) => handleReview(row as Topic, false),
          },
          {
            label: '内容',
            icon: <LibraryAddIcon />,
            color: 'primary',
            onClick: (row) => handleOpenContentDialog(row),
          },
          {
            label: '洞察',
            color: 'secondary',
            onClick: (row) => setInsightsTopic(row as Topic),
          },
        ]}
        onEdit={(row) => handleOpenDialog(row)}
        onDelete={(row) => handleDelete(row.id)}
      />

      {/* 共享编辑/新建对话框(admin 全字段) */}
      <TopicFormDialog
        open={formOpen}
        topic={editingTopic}
        isAdmin={isAdmin}
        showTemplates={false}
        showRule
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          loadTopics();
        }}
      />

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

      {/* 专题洞察编辑器:独立 Dialog,不在主编辑表单里 */}
      <TopicInsightsEditorDialog
        open={!!insightsTopic}
        topicId={insightsTopic?.id ?? null}
        topicTitle={insightsTopic?.title}
        onClose={() => setInsightsTopic(null)}
        onSaved={() => loadTopics()}
      />
    </Box>
  );
}
