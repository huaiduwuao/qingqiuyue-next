'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { myPage as listConceptions, remove, save, update } from '@/apis/reward-conception';
import { useApp } from '@/contexts/AppContext';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import type { ConceptionItem, DemandItem } from '@/beans/reward';

const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  WAITING: '待审核',
  SUCCESS: '审核通过',
  FAIL: '驳回',
  PUBLISHED: '已发布',
};

interface FilterType {
  status: string;
  keyword: string;
}

interface Props {
  groupId: any;
  groupData: any;
  initialDemandId?: number | null;
  onOpenDemandDetail?: (demandId: number) => void;
}

export default function ConceptionPage({ groupId, groupData, initialDemandId, onOpenDemandDetail }: Props) {
  const { currentUser } = useApp();
  const [writeVisible, setWriteVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ConceptionItem | null>(null);
  const [formValues, setFormValues] = useState<any>({});
  const [filter, setFilter] = useState<FilterType>({ status: '', keyword: '' });
  const [demandFilter, setDemandFilter] = useState<number | ''>(initialDemandId ?? '');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const qc = useQueryClient();
  const LIST_KEY = ['reward-conception'];

  // 需求过滤响应外部入参
  useEffect(() => {
    if (initialDemandId != null) setDemandFilter(initialDemandId);
  }, [initialDemandId]);

  const demandsQuery = useQuery({
    queryKey: [...LIST_KEY, 'demands'],
    queryFn: () => listConceptions({ pageSize: 100 }).then((r: any) => r.data?.records || r.data?.list || []),
    placeholderData: [],
  });
  const demands: DemandItem[] = demandsQuery.data || [];

  const query = useQuery({
    queryKey: [...LIST_KEY, filter.status, page, groupId],
    queryFn: () => listConceptions({ pageNumber: page, pageSize, groupId, status: filter.status || undefined }).then((r) => {
      const records = r.data?.records || [];
      return { records, totalRow: r.data?.totalRow || records.length };
    }),
    enabled: !!groupId,
    placeholderData: { records: [], totalRow: 0 },
  });

  const list = query.data?.records || [];
  const total = query.data?.totalRow || 0;
  const loading = query.isFetching;

  const demandTitleMap = React.useMemo(() => {
    const m = new Map<number, string>();
    demands.forEach((d) => {
      if (d.id != null) m.set(d.id, d.title || `需求 ${d.id}`);
    });
    return m;
  }, [demands]);

  const handleSearch = () => {
    setPage(1);
    query.refetch();
  };

  const handleEdit = (record: ConceptionItem) => {
    setSelectedRecord(record);
    setFormValues({
      name: record?.name || '',
      info: record?.info || '',
      content: record?.content || '',
      cover: record?.cover || '',
    });
    setWriteVisible(true);
  };

  const handleDetail = (record: ConceptionItem) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };

  const handleFormChange = (field: string, value: any) => {
    setFormValues((prev: any) => ({ ...prev, [field]: value }));
  };

  const submitMutation = useMutation({
    mutationFn: (params: { isUpdate: boolean }) => {
      if (params.isUpdate) {
        return update({ ...selectedRecord, ...formValues }).then(() => '更新成功');
      }
      return save({ ...formValues, groupId }).then(() => '创建成功');
    },
    onSuccess: (message) => {
      showMessage(message);
      setWriteVisible(false);
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (err: any) => {
      showMessage(err.message || '操作失败', 'error');
    },
  });

  const handleSubmit = () => {
    submitMutation.mutate({ isUpdate: !!selectedRecord?.id });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => remove([id]),
    onSuccess: () => {
      showMessage('删除成功');
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (err: any) => {
      showMessage(err.message || '删除失败', 'error');
    },
  });

  const handleDelete = (record: ConceptionItem) => {
    if (!confirm('确定删除吗？')) return;
    deleteMutation.mutate(record.id as number);
  };

  const getActions = (record: ConceptionItem) => {
    const actions: React.ReactNode[] = [];

    if (currentUser?.id === record.createUser) {
      actions.push(
        <Tooltip title="编辑" key="edit">
          <IconButton size="small" onClick={() => handleEdit(record)}><EditIcon /></IconButton>
        </Tooltip>
      );
      actions.push(
        <Tooltip title="删除" key="delete">
          <IconButton size="small" color="error" onClick={() => handleDelete(record)}><DeleteIcon /></IconButton>
        </Tooltip>
      );
    }

    actions.push(
      <Tooltip title="查看详情" key="detail">
        <Button size="small" onClick={() => handleDetail(record)}>详情</Button>
      </Tooltip>
    );

    return actions;
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>意境管理</Typography>

      {/* 筛选工具栏 */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="搜索意境..."
          value={filter.keyword}
          onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          sx={{ minWidth: 200 }}
          slotProps={{
            input: {
              endAdornment: (
                <IconButton size="small" onClick={handleSearch}>
                  <SearchIcon />
                </IconButton>
              ),
            },
          }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>按需求过滤</InputLabel>
          <Select
            value={demandFilter}
            label="按需求过滤"
            onChange={(e) => setDemandFilter(e.target.value as number | '')}
          >
            <MenuItem value="">全部需求</MenuItem>
            {demands.map((d) => (
              <MenuItem key={d.id} value={d.id}>#{d.id} {d.title}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tabs
          value={filter.status}
          onChange={(_, v) => { setFilter({ ...filter, status: v }); setPage(1); }}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 36 }}
        >
          <Tab label="全部" value="" />
          <Tab label="草稿" value="DRAFT" />
          <Tab label="待审核" value="WAITING" />
          <Tab label="已发布" value="PUBLISHED" />
        </Tabs>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleEdit({} as ConceptionItem)}>
          新建意境
        </Button>
      </Box>

      {/* 卡片列表 */}
      <Grid container spacing={2}>
        {list.map((item) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                  onClick={() => handleDetail(item)}>
              <CardMedia
                component="div"
                sx={{
                  height: 140,
                  backgroundColor: '#f5f5f5',
                  backgroundImage: item.cover ? `url(${item.cover})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {!item.cover && (
                  <Typography variant="h4" sx={{ color: '#ccc' }}>
                    {item.name?.charAt(0) || '?'}
                  </Typography>
                )}
              </CardMedia>
              <CardContent sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle1" noWrap sx={{ fontWeight: 'bold', maxWidth: '70%' }}>
                    {item.name || (item as any).title}
                  </Typography>
                  <Chip label={STATUS_MAP[item.status || ''] || item.status || '未知'} size="small" />
                </Box>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {item.info || '暂无描述'}
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {item.demandId != null && (
                    <Chip
                      icon={<AssignmentIcon sx={{ fontSize: '12px !important' }} />}
                      label={demandTitleMap.get(item.demandId) || `需求 ${item.demandId}`}
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDemandDetail?.(item.demandId!);
                      }}
                      sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(139, 92, 246, 0.12)', color: '#8B5CF6', cursor: 'pointer' }}
                    />
                  )}
                  {item.tags && String(item.tags).split(',').slice(0, 3).map((tag, idx) => (
                    <Chip key={idx} label={tag} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                  ))}
                </Box>
              </CardContent>
              <CardActions sx={{ justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                {getActions(item)}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 空状态 */}
      {list.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary">暂无意境</Typography>
          <Button sx={{ mt: 2 }} onClick={() => handleEdit({} as ConceptionItem)}>创建第一个意境</Button>
        </Box>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Button disabled={page === 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <Typography sx={{ lineHeight: '36px' }}>第 {page} / {totalPages} 页</Typography>
          <Button disabled={page === totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
        </Box>
      )}

      {/* 新建/编辑弹窗 */}
      <Dialog open={writeVisible} onClose={() => setWriteVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedRecord?.id ? '编辑意境' : '新建意境'}
          <IconButton onClick={() => setWriteVisible(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="名称"
              value={formValues.name || ''}
              onChange={(e) => handleFormChange('name', e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="简介"
              value={formValues.info || ''}
              onChange={(e) => handleFormChange('info', e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="封面图URL"
              value={formValues.cover || ''}
              onChange={(e) => handleFormChange('cover', e.target.value)}
              fullWidth
            />
            <TextField
              label="标签(逗号分隔)"
              value={formValues.tags || ''}
              onChange={(e) => handleFormChange('tags', e.target.value)}
              fullWidth
            />
            <TextField
              label="分类"
              value={formValues.category || ''}
              onChange={(e) => handleFormChange('category', e.target.value)}
              fullWidth
            />
            <TextField
              label="详细内容"
              value={formValues.content || ''}
              onChange={(e) => handleFormChange('content', e.target.value)}
              fullWidth
              multiline
              rows={6}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWriteVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleSubmit}>提交</Button>
        </DialogActions>
      </Dialog>

      {/* 详情弹窗 */}
      <Dialog open={detailVisible} onClose={() => setDetailVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedRecord?.name}
          <IconButton onClick={() => setDetailVisible(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedRecord?.cover && (
            <Box
              component="img"
              src={selectedRecord.cover}
              sx={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 1, mb: 2 }}
            />
          )}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip label={STATUS_MAP[selectedRecord?.status || ''] || selectedRecord?.status} />
            {selectedRecord?.category && <Chip label={selectedRecord.category} variant="outlined" />}
          </Box>
          <Typography variant="body1" sx={{ mb: 2 }}>{selectedRecord?.info}</Typography>
          {selectedRecord?.content && (
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {selectedRecord.content}
            </Typography>
          )}
          {selectedRecord?.tags && (
            <Box sx={{ mt: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {String(selectedRecord.tags).split(',').map((tag, idx) => (
                <Chip key={idx} label={tag} size="small" />
              ))}
            </Box>
          )}
          <Box sx={{ mt: 3, display: 'flex', gap: 1, alignItems: 'center' }}>
            <Avatar sx={{ width: 32, height: 32 }} src={selectedRecord?.avatar} />
            <Typography variant="caption">{selectedRecord?.username || '未知用户'}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
              {selectedRecord?.createTime ? new Date(selectedRecord.createTime).toLocaleString() : ''}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailVisible(false)}>关闭</Button>
          {currentUser?.id === selectedRecord?.createUser && (
            <Button variant="contained" onClick={() => { setDetailVisible(false); if (selectedRecord) handleEdit(selectedRecord); }}>
              编辑
            </Button>
          )}
        </DialogActions>
      </Dialog>

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