'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { DataGridTable } from '@/components/tables/DataGridTable';
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
import type { GridColDef } from '@mui/x-data-grid';
import type { GroupItem } from '@/beans/reward';

export default function GroupPage({ groupId, groupData }: { groupId: any; groupData: any }) {
  const { currentUser } = useApp();
  const [waitData, setWaitData] = useState<any[]>([]);
  const [groups, setGroupsData] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [createVisible, setCreateVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [formValues, setFormValues] = useState<any>({});
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  useEffect(() => {
    fetchGroup('AGREE');
    fetchGroupWait('SEND');
  }, []);

  const fetchGroup = async (status: string) => {
    try {
      const res: any = await groupList({ status });
      setGroupsData(res.data || []);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  };

  const fetchGroupWait = async (status: string) => {
    try {
      const res: any = await groupListWait({ status });
      setWaitData(res.data || []);
    } catch (err) {
      console.error('Failed to fetch wait groups:', err);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res: any = await groupSuggest({ name: query });
      setSearchResults(res.data || []);
    } catch (err) {
      console.error('Failed to search groups:', err);
    }
  };

  const handleAddGroup = async (item: any) => {
    try {
      await sendGroup({ groupId: item.id });
      showMessage('发送成功');
      setAddVisible(false);
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleCreateGroup = async () => {
    try {
      await newGroup(formValues);
      showMessage('创建成功');
      setCreateVisible(false);
      fetchGroup('AGREE');
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleAgreeGroup = async (item: any) => {
    try {
      await agreeGroup({ id: item.id });
      showMessage('操作成功');
      fetchGroup('AGREE');
      fetchGroupWait('SEND');
    } catch (err: any) {
      showMessage(err.message || '操作失败', 'error');
    }
  };

  const handleDeleteGroup = async (group: any) => {
    if (!confirm('确定删除吗？')) return;
    try {
      await remove([group]);
      showMessage('删除成功');
      fetchGroup('AGREE');
    } catch (err: any) {
      showMessage(err.message || '删除失败', 'error');
    }
  };

  const handleQuitGroup = async (group: any) => {
    if (!confirm('确定退出吗？')) return;
    try {
      await groupUserRemove([group]);
      showMessage('删除成功');
      fetchGroup('AGREE');
    } catch (err: any) {
      showMessage(err.message || '删除失败', 'error');
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setFormValues((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>团队管理</Typography>

      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button variant="contained" onClick={() => setAddVisible(true)}>
          添加团队
        </Button>
        <Button variant="contained" onClick={() => setCreateVisible(true)}>
          创建团队
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {/* Group Requests */}
        <Card sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 300 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>团队请求</Typography>
            <List>
              {waitData.length === 0 ? (
                <ListItem>
                  <ListItemText primary="暂无请求" />
                </ListItem>
              ) : (
                waitData.map((item: any) => (
                  <ListItem key={item.id}>
                    <ListItemAvatar>
                      <Avatar src={item.avatar} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={item.nickname}
                      secondary={`加入: ${item.group?.name || ''}`}
                    />
                    {item.createUser === currentUser?.id ? (
                      <Typography variant="caption">待通过</Typography>
                    ) : (
                      <Button size="small" onClick={() => handleAgreeGroup(item)}>通过</Button>
                    )}
                  </ListItem>
                ))
              )}
            </List>
          </CardContent>
        </Card>

        {/* All Groups */}
        <Card sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 300 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>全部团队</Typography>
            <List>
              {groups.length === 0 ? (
                <ListItem>
                  <ListItemText primary="暂无团队" />
                </ListItem>
              ) : (
                groups.map((item: any) => (
                  <ListItem
                    key={item.id}
                    secondaryAction={
                      item.createUser === currentUser?.id ? (
                        <Button key="delete" size="small" color="error" onClick={() => handleDeleteGroup(item.id)}>删除</Button>
                      ) : (
                        <Button key="quit" size="small" onClick={() => handleQuitGroup(item.id)}>退出</Button>
                      )
                    }
                  >
                    <ListItemAvatar>
                      <Avatar src={item.cover} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={item.name}
                      secondary={item.info}
                    />
                  </ListItem>
                ))
              )}
            </List>
          </CardContent>
        </Card>
      </Box>

      {/* Add Group Dialog */}
      <Dialog open={addVisible} onClose={() => setAddVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>搜索团队添加</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              placeholder="请输入团队名称"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
            />
            <Button variant="contained" onClick={() => handleSearch(searchQuery)} startIcon={<SearchIcon />}>
              搜索
            </Button>
          </Box>
          <List>
            {searchResults.map((item: any) => (
              <ListItem
                key={item.id}
              >
                <ListItemAvatar>
                  <Avatar src={item.cover} />
                </ListItemAvatar>
                <ListItemText primary={item.name} secondary={item.info} />
                <ListItemSecondaryAction>
                  <Button size="small" onClick={() => handleAddGroup(item)}>添加</Button>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddVisible(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={createVisible} onClose={() => setCreateVisible(false)} maxWidth="sm" fullWidth>
        <DialogTitle>创建团队</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="团队名称"
              value={formValues.name || ''}
              onChange={(e) => handleFormChange('name', e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateVisible(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreateGroup}>创建</Button>
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
