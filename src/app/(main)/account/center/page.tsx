'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Popover from '@mui/material/Popover';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { useApp } from '@/contexts/AppContext';
import { moduleContentActionPage } from '@/apis/account';
import { userRelationPage } from '@/apis/global';

const actionArr = ['LIKE', 'TRANSFER', 'COLLECT', 'CLICK'];

const statusMap: Record<string, string> = {
  DRAFT: '草稿',
  WAITING: '待审核',
  SUCCESS: '审核通过',
  FAIL: '驳回',
};

export default function AccountCenterPage() {
  const router = useRouter();
  const { currentUser } = useApp();
  const [type, setType] = useState<string>('DASHBOARD');
  const [groupAnchorEl, setGroupAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [groupData, setGroupData] = useState<any[]>([]);

  const handleMenuClick = (item: typeof sideMenuItems[0]) => {
    if (item.path) {
      router.push(item.path);
    } else {
      chooseType(item.key);
    }
  };

  const [data, setData] = useState<any[]>([]);
  const [current, setCurrent] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [size] = useState(10);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Modal state
  const [focusModalOpen, setFocusModalOpen] = useState(false);
  const [fansModalOpen, setFansModalOpen] = useState(false);
  const [focusData, setFocusData] = useState<any[]>([]);
  const [fansData, setFansData] = useState<any[]>([]);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => setSnackbar({ open: true, message, severity });

  useEffect(() => {
    fetchList(type, true);
  }, [type, selectedGroup]);

  useEffect(() => {
    // Mock group data - in real app would fetch from API
    setGroupData([]);
  }, []);

  const fetchList = async (action: string, change?: boolean) => {
    try {
      if (change) {
        setCurrent(1);
        setData([]);
      }
      setLoading(true);
      const res = await moduleContentActionPage({
        action: action,
        current: change ? 1 : current,
        size: size,
        groupId: selectedGroup || undefined,
      });
      const newData = change ? res.data?.records || [] : [...data, ...(res.data?.records || [])];
      setData(newData);
      setPages(res.data?.pages || 1);
      setTotal(res.data?.total || 0);
      setCurrent(res.data?.current || 1);
      setHasMore((res.data?.pages || 1) > (res.data?.current || 1));
    } catch (err: any) {
      showMessage(err.message || '获取数据失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (!hasMore || loading) return;
    setCurrent(current + 1);
    fetchList(type);
  };

  const chooseType = async (newType: string) => {
    if (actionArr.indexOf(newType) === -1) {
      setType(newType);
    } else {
      setType(newType);
      fetchList(newType, true);
    }
  };

  const handleFocusShow = async () => {
    try {
      const res = await userRelationPage({ type: 'focus', userId: currentUser?.id, pageSize: 100 });
      setFocusData(res.data?.records || []);
      setFocusModalOpen(true);
    } catch (err: any) {
      showMessage(err.message || '获取失败', 'error');
    }
  };

  const handleFansShow = async () => {
    try {
      const res = await userRelationPage({ byUserId: currentUser?.id, type: 'focus', pageSize: 100 });
      setFansData(res.data?.records || []);
      setFansModalOpen(true);
    } catch (err: any) {
      showMessage(err.message || '获取失败', 'error');
    }
  };

  const handleDetail = (record: any) => {
    if (record.contentType === 'VIDEO') {
      window.open(`/detail/video-detail?id=${record.id}&contentId=${record.contentId}`, '_blank');
      return;
    }
    window.location.href = `/share/module-content-detail?id=${record.moduleContentId}`;
  };

  const menuItems = [
    { key: 'DASHBOARD', label: '主页' },
    { key: 'SHELF', label: '我的书架' },
    { key: 'POINT', label: '储物袋' },
    { key: 'CLICK', label: '最近在看' },
    { key: 'COLLECT', label: '我的收藏' },
    { key: 'TRANSFER', label: '我转发的' },
    { key: 'LIKE', label: '我喜欢的' },
  ];

  const sideMenuItems = [
    { key: 'DASHBOARD', label: '主页' },
    { key: 'SHELF', label: '我的书架' },
    { key: 'POINT', label: '储物袋' },
    { key: 'CLICK', label: '最近在看' },
    { key: 'COLLECT', label: '我的收藏' },
    { key: 'TRANSFER', label: '我转发的' },
    { key: 'LIKE', label: '我喜欢的' },
    { key: 'REWARD', label: '悬赏中心', path: '/account/reward' },
  ];

  const getGroupName = () => {
    if (!selectedGroup) return '个人空间';
    const group = groupData.find(g => g.id === selectedGroup);
    return group ? `${group.name}的团队空间` : '个人空间';
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* User Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Avatar sx={{ width: 80, height: 80 }} src={currentUser?.avatar}>
                {currentUser?.name?.[0] || 'U'}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h5">{currentUser?.name || '未登录'}</Typography>
                <Typography color="text.secondary">{currentUser?.signature || ''}</Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Chip
                    label={`关注 ${currentUser?.focusCount || 0}`}
                    size="small"
                    onClick={handleFocusShow}
                    sx={{ cursor: 'pointer' }}
                  />
                  <Chip
                    label={`粉丝 ${currentUser?.fansCount || 0}`}
                    size="small"
                    onClick={handleFansShow}
                    sx={{ cursor: 'pointer' }}
                  />
                </Box>
              </Box>
              <Button onClick={(e) => setGroupAnchorEl(e.currentTarget)}>
                {getGroupName()}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Group Selector Popover */}
        <Popover
          open={Boolean(groupAnchorEl)}
          anchorEl={groupAnchorEl}
          onClose={() => setGroupAnchorEl(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <Box sx={{ p: 2, minWidth: 300 }}>
            <FormControl fullWidth>
              <InputLabel>切换团队空间</InputLabel>
              <Select
                value={selectedGroup}
                label="切换团队空间"
                onChange={(e) => {
                  setSelectedGroup(e.target.value);
                  setGroupAnchorEl(null);
                }}
              >
                <MenuItem value="">个人空间</MenuItem>
                {groupData.map((item) => (
                  <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Popover>

        <Box sx={{ display: 'flex', gap: 3 }}>
          {/* Sidebar Menu */}
          <Card sx={{ width: 240, flexShrink: 0 }}>
            <List>
              {sideMenuItems.map((item) => (
                <ListItem key={item.key} disablePadding>
                  <ListItemButton
                    selected={item.path ? false : type === item.key}
                    onClick={() => handleMenuClick(item)}
                    sx={{
                      borderLeft: item.path ? 'none' : (type === item.key ? '3px solid' : '3px solid transparent'),
                      borderColor: type === item.key ? 'primary.main' : 'transparent',
                    }}
                  >
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              ))}
              <ListItem key="message" disablePadding>
                <ListItemButton onClick={() => setFocusModalOpen(true)}>
                  <ListItemText primary="消息" />
                </ListItemButton>
              </ListItem>
            </List>
          </Card>

          {/* Content Area */}
          <Card sx={{ flex: 1 }}>
            <CardContent>
              {type === 'DASHBOARD' && (
                <Box>
                  <Typography variant="h6">个人中心主页</Typography>
                  <Divider sx={{ my: 2 }} />
                  <Typography color="text.secondary">欢迎回来！这里展示您的内容概览。</Typography>
                </Box>
              )}

              {type === 'SHELF' && (
                <Box>
                  <Typography variant="h6">我的书架</Typography>
                  <Divider sx={{ my: 2 }} />
                  <Typography color="text.secondary">书架功能开发中...</Typography>
                </Box>
              )}

              {type === 'POINT' && (
                <Box>
                  <Typography variant="h6">储物袋</Typography>
                  <Divider sx={{ my: 2 }} />
                  <Typography color="text.secondary">储物袋功能开发中...</Typography>
                </Box>
              )}

              {actionArr.indexOf(type) !== -1 && (
                <Box>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {menuItems.find(m => m.key === type)?.label || type}
                  </Typography>
                  {data.length === 0 && !loading ? (
                    <Typography color="text.secondary">暂无内容</Typography>
                  ) : (
                    <List>
                      {data.map((item: any) => (
                        <ListItem
                          key={item.id}
                          onClick={() => handleDetail(item.moduleContent)}
                          sx={{ cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider' }}
                        >
                          <ListItemAvatar>
                            <Avatar>{item.moduleContent?.title?.[0] || '?'}</Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={item.moduleContent?.title}
                            secondary={item.moduleContent?.info}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                  {hasMore && (
                    <Box sx={{ textAlign: 'center', mt: 2 }}>
                      <Button onClick={handleLoadMore} disabled={loading}>
                        {loading ? '加载中...' : '加载更多'}
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Focus Modal */}
      <Dialog open={focusModalOpen} onClose={() => setFocusModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>我的关注</DialogTitle>
        <DialogContent>
          {focusData.length === 0 ? (
            <Typography color="text.secondary">暂无关注</Typography>
          ) : (
            <List>
              {focusData.map((item: any) => (
                <ListItem key={item.id}>
                  <ListItemAvatar><Avatar src={item.byAvatar} /></ListItemAvatar>
                  <ListItemText primary={item.byName} />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFocusModalOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* Fans Modal */}
      <Dialog open={fansModalOpen} onClose={() => setFansModalOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>我的粉丝</DialogTitle>
        <DialogContent>
          {fansData.length === 0 ? (
            <Typography color="text.secondary">暂无粉丝</Typography>
          ) : (
            <List>
              {fansData.map((item: any) => (
                <ListItem key={item.id}>
                  <ListItemAvatar><Avatar src={item.avatar} /></ListItemAvatar>
                  <ListItemText primary={item.name} />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFansModalOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
}
