'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
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
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Divider from '@mui/material/Divider';
import {
  agreeGroup,
  groupList,
  groupListWait,
  groupSuggest,
  newGroup,
  remove,
  sendGroup,
} from '@/apis/reward-group';
import { remove as groupUserRemove } from '@/apis/reward-group-user';
import { useApp } from '@/contexts/AppContext';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import GroupIcon from '@mui/icons-material/Group';
import type { GroupItem } from '@/beans/reward';

export default function GroupPage({ groupId, groupData }: { groupId: any; groupData: any }) {
  const { currentUser } = useApp();
  const [myGroups, setMyGroups] = useState<GroupItem[]>([]);
  const [waitList, setWaitList] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'my' | 'apply'>('my');
  const [createVisible, setCreateVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupItem | null>(null);
  const [formValues, setFormValues] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  useEffect(() => {
    fetchMyGroups();
    fetchWaitList();
  }, []);

  const fetchMyGroups = async () => {
    setLoading(true);
    try {
      const res: any = await groupList({ status: 'AGREE' });
      setMyGroups(res.data?.records || res.data || []);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWaitList = async () => {
    try {
      const res: any = await groupListWait({ status: 'SEND' });
      setWaitList(res.data || []);
    } catch (err) {
      console.error('Failed to fetch wait list:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res: any = await groupSuggest({ name: searchQuery });
      setSearchResults(res.data || []);
    } catch (err) {
      console.error('Failed to search groups:', err);
    }
  };

  const handleAddGroup = async (item: GroupItem) => {
    try {
      await sendGroup({ groupId: item.id });
      showMessage('申请已发送');
      setAddVisible(false);
      fetchWaitList();
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleCreateGroup = async () => {
    try {
      await newGroup(formValues);
      showMessage('创建成功');
      setCreateVisible(false);
      setFormValues({});
      fetchMyGroups();
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleAgreeGroup = async (item: any) => {
    try {
      await agreeGroup({ id: item.id });
      showMessage('已同意');
      fetchWaitList();
      fetchMyGroups();
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleDeleteGroup = async (group: GroupItem) => {
    if (!confirm('确定删除团队吗？')) return;
    try {
      await remove([group.id as number]);
      showMessage('删除成功');
      fetchMyGroups();
    } catch (err: any) {
      showMessage(err.message || '删除失败', 'error');
    }
  };

  const handleQuitGroup = async (group: GroupItem) => {
    if (!confirm('确定退出团队吗？')) return;
    try {
      // 找到groupUserId来退出
      await groupUserRemove([group.id as number]);
      showMessage('已退出');
      fetchMyGroups();
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setFormValues((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleDetail = (group: GroupItem) => {
    setSelectedGroup(group);
    setDetailVisible(true);
  };

  const isOwner = (group: GroupItem) => currentUser?.id === group.createUser;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>团队管理</Typography>

      {/* 标签页切换 */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={`我的团队(${myGroups.length})`} value="my" />
        <Tab label={`申请列表(${waitList.length})`} value="apply" />
      </Tabs>

      {tab === 'my' && (
        <Box>
          {/* 操作按钮 */}
          <Box sx={{ mb: 3, display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateVisible(true)}>
              创建团队
            </Button>
            <Button variant="outlined" onClick={() => setAddVisible(true)}>
              加入团队
            </Button>
          </Box>

          {/* 团队卡片列表 */}
          <Grid container spacing={2}>
            {myGroups.map((group) => (
              <Grid item xs={12} sm={6} md={4} key={group.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
                      onClick={() => handleDetail(group)}>
                  <CardMedia
                    component="div"
                    sx={{
                      height: 100,
                      backgroundColor: '#1976d2',
                      backgroundImage: group.cover ? `url(${group.cover})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {!group.cover && (
                      <GroupIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.7)' }} />
                    )}
                  </CardMedia>
                  <CardContent sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" noWrap>
                      {group.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
                      {group.info || '暂无描述'}
                    </Typography>
                    <Box sx={{ mt: 1, display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      <GroupIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {group.projects || 0} 个项目
                      </Typography>
                    </Box>
                  </CardContent>
                  <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}
                       onClick={(e) => e.stopPropagation()}>
                    {isOwner(group) ? (
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={() => handleDeleteGroup(group)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Button size="small" color="error" onClick={() => handleQuitGroup(group)}>
                        退出
                      </Button>
                    )}
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>

          {myGroups.length === 0 && !loading && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography color="text.secondary">暂没有加入任何团队</Typography>
              <Button sx={{ mt: 2 }} onClick={() => setAddVisible(true)}>加入团队</Button>
            </Box>
          )}
        </Box>
      )}

      {tab === 'apply' && (
        <Card>
          <List>
            {waitList.length === 0 ? (
              <ListItem>
                <ListItemText primary="暂无申请记录" />
              </ListItem>
            ) : (
              waitList.map((item) => (
                <ListItem key={item.id} divider>
                  <ListItemAvatar>
                    <Avatar src={item.avatar} />
                  </ListItemAvatar>
                  <ListItemText
                    primary={item.nickname || item.username || '用户'}
                    secondary={`申请加入: ${item.group?.name || item.name || ''}`}
                  />
                  <ListItemSecondaryAction>
                    {item.createUser === currentUser?.id ? (
                      <Chip label="待审核" size="small" />
                    ) : (
                      <Button size="small" onClick={() => handleAgreeGroup(item)}>同意</Button>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))
            )}
          </List>
        </Card>
      )}

      {/* 创建团队弹窗 */}
      <Dialog open={createVisible} onClose={() => setCreateVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          创建团队
          <IconButton onClick={() => setCreateVisible(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="团队名称"
              value={formValues.name || ''}
              onChange={(e) => handleFormChange('name', e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="团队简介"
              value={formValues.info || ''}
              onChange={(e) => handleFormChange('info', e.target.value)}
              fullWidth
              multiline
              rows={3}
            />
            <TextField
              label="封面图URL"
              value={formValues.cover || ''}
              onChange={(e) => handleFormChange('cover', e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreateGroup}>创建</Button>
        </DialogActions>
      </Dialog>

      {/* 加入团队弹窗 */}
      <Dialog open={addVisible} onClose={() => setAddVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          加入团队
          <IconButton onClick={() => setAddVisible(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              placeholder="搜索团队名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button variant="contained" onClick={handleSearch} startIcon={<SearchIcon />}>
              搜索
            </Button>
          </Box>
          <List>
            {searchResults.map((item) => (
              <ListItem key={item.id} divider>
                <ListItemAvatar>
                  <Avatar src={item.cover} />
                </ListItemAvatar>
                <ListItemText primary={item.name} secondary={item.info} />
                <ListItemSecondaryAction>
                  <Button size="small" onClick={() => handleAddGroup(item)}>申请加入</Button>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            {searchResults.length === 0 && (
              <ListItem>
                <ListItemText primary="输入团队名称搜索" />
              </ListItem>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddVisible(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 团队详情弹窗 */}
      <Dialog open={detailVisible} onClose={() => setDetailVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedGroup?.name}
          <IconButton onClick={() => setDetailVisible(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedGroup?.cover && (
            <Box
              component="img"
              src={selectedGroup.cover}
              sx={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 1, mb: 2 }}
            />
          )}
          <Typography variant="body1" sx={{ mb: 2 }}>{selectedGroup?.info || '暂无描述'}</Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <GroupIcon />
            <Typography variant="body2">{selectedGroup?.projects || 0} 个项目</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailVisible(false)}>关闭</Button>
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