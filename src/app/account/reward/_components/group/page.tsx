'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ResponsiveTableWrapper from '@/components/common/ResponsiveTableWrapper';
import InputAdornment from '@mui/material/InputAdornment';
import { agreeGroup,
  groupList,
  groupListWait,
  groupSuggest,
  newGroup,
  remove,
  sendGroup } from '@/apis/reward-group';
import { listGroupUsers, inviteGroupUser, remove as removeGroupUser, updateGroupUser } from '@/apis/reward-group-user';
import { useApp } from '@/contexts/AppContext';
import { useAccount } from '@/contexts/AccountContext';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import GroupIcon from '@mui/icons-material/Group';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RemoveIcon from '@mui/icons-material/Remove';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import StarIcon from '@mui/icons-material/Star';
import type { GroupItem } from '@/beans/reward';

interface GroupMember {
  id: number;
  userId: number;
  groupId?: number;
  nickname?: string;
  avatar?: string;
  username?: string;
  status?: string;
  role?: string;
  contribution?: number;
  createTime?: string;
}

export default function GroupPage({ groupId, groupData, onOpenTaskboard }: { groupId: any; groupData: any; onOpenTaskboard?: (groupId: number) => void }) {
  const { currentUser } = useApp();
  const { space, selectedTeam, teamList } = useAccount();
  const [searchResults, setSearchResults] = useState<GroupItem[]>([]);
  const [tab, setTab] = useState<'my' | 'apply' | 'ranking'>('my');
  const [createVisible, setCreateVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [memberVisible, setMemberVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupItem | null>(null);
  const [formValues, setFormValues] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showMessage = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // 当前查看详情的团队
  const activeGroup = space === 'team' && selectedTeam
    ? teamList.find(t => t.id === selectedTeam.id) || selectedTeam
    : selectedGroup;

  const currentGroupId = activeGroup?.id;

  // query keys
  const LIST_KEY = ['reward-group'];
  const MY_KEY = ['reward-group', 'my'];
  const WAIT_KEY = ['reward-group', 'wait'];
  const MEMBER_KEY = (gid?: number | null) => ['reward-group', 'members', gid];
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: LIST_KEY });

  // 我的团队列表
  const myGroupsQuery = useQuery({
    queryKey: MY_KEY,
    queryFn: () => groupList({ status: 'AGREE' }).then((r: any) => {
      const data = r.data?.list || r.data?.records || r.data || [];
      return Array.isArray(data) ? data : [];
    }),
    placeholderData: [],
  });
  const myGroups: GroupItem[] = myGroupsQuery.data || [];

  // 待审核申请列表
  const waitListQuery = useQuery({
    queryKey: WAIT_KEY,
    queryFn: () => groupListWait({ status: 'SEND' }).then((r: any) => r.data || []),
    placeholderData: [],
  });
  const waitList: any[] = waitListQuery.data || [];

  // 当前团队成员
  const membersQuery = useQuery({
    queryKey: MEMBER_KEY(currentGroupId),
    queryFn: () => listGroupUsers({ groupId: currentGroupId, status: 'AGREE' }).then((r: any) => {
      const data = r.data?.list || r.data?.records || r.data || [];
      return Array.isArray(data) ? data : [];
    }),
    enabled: !!currentGroupId,
    placeholderData: [],
  });
  const groupMembers: GroupMember[] = membersQuery.data || [];

  const loading = myGroupsQuery.isLoading;

  // 搜索团队
  const searchMutation = useMutation({
    mutationFn: (vals: any) => groupSuggest(vals),
    onSuccess: (data: any) => setSearchResults(data?.data || []),
    onError: (err: any) => console.error('Failed to search groups:', err),
  });

  // 申请加入团队
  const addMutation = useMutation({
    mutationFn: (vals: any) => sendGroup(vals),
    onSuccess: () => {
      showMessage('申请已发送');
      setAddVisible(false);
      qc.invalidateQueries({ queryKey: WAIT_KEY });
    },
    onError: (err: any) => showMessage(err.message || '操作失败', 'error'),
  });

  // 创建团队
  const createMutation = useMutation({
    mutationFn: (vals: any) => newGroup(vals),
    onSuccess: () => {
      showMessage('创建成功');
      setCreateVisible(false);
      setFormValues({});
      invalidate();
    },
    onError: (err: any) => showMessage(err.message || '操作失败', 'error'),
  });

  // 同意申请
  const agreeMutation = useMutation({
    mutationFn: (vals: any) => agreeGroup(vals),
    onSuccess: () => {
      showMessage('已同意');
      qc.invalidateQueries({ queryKey: WAIT_KEY });
      invalidate();
    },
    onError: (err: any) => showMessage(err.message || '操作失败', 'error'),
  });

  // 删除团队
  const deleteMutation = useMutation({
    mutationFn: (id: number) => remove([id]),
    onSuccess: () => {
      showMessage('删除成功');
      invalidate();
    },
    onError: (err: any) => showMessage(err.message || '删除失败', 'error'),
  });

  // 退出团队
  const quitMutation = useMutation({
    mutationFn: (id: number) => removeGroupUser([id]),
    onSuccess: () => {
      showMessage('已退出');
      invalidate();
    },
    onError: (err: any) => showMessage(err.message || '操作失败', 'error'),
  });

  // 邀请成员
  const inviteMutation = useMutation({
    mutationFn: (vals: any) => inviteGroupUser(vals),
    onSuccess: () => {
      showMessage('邀请已发送');
      setInviteUsername('');
      qc.invalidateQueries({ queryKey: MEMBER_KEY(currentGroupId) });
    },
    onError: (err: any) => showMessage(err.message || '邀请失败', 'error'),
  });

  // 移除成员
  const removeMemberMutation = useMutation({
    mutationFn: (vals: any) => removeGroupUser([vals]),
    onSuccess: () => {
      showMessage('已移除');
      qc.invalidateQueries({ queryKey: MEMBER_KEY(currentGroupId) });
    },
    onError: (err: any) => showMessage(err.message || '移除失败', 'error'),
  });

  // 修改成员角色
  const changeRoleMutation = useMutation({
    mutationFn: (vals: any) => updateGroupUser(vals.id, vals.payload),
    onSuccess: () => {
      showMessage('已更新角色');
      qc.invalidateQueries({ queryKey: MEMBER_KEY(currentGroupId) });
    },
    onError: (err: any) => showMessage(err.message || '更新失败', 'error'),
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    searchMutation.mutate({ name: searchQuery });
  };

  const handleAddGroup = (item: GroupItem) => {
    addMutation.mutate({ groupId: item.id });
  };

  const handleCreateGroup = () => {
    createMutation.mutate(formValues);
  };

  const handleAgreeGroup = (item: any) => {
    agreeMutation.mutate({ id: item.id });
  };

  const handleDeleteGroup = (group: GroupItem) => {
    if (!confirm('确定删除团队吗？')) return;
    deleteMutation.mutate(group.id as number);
  };

  const handleQuitGroup = (group: GroupItem) => {
    if (!confirm('确定退出团队吗？')) return;
    quitMutation.mutate(group.id as number);
  };

  const handleInviteMember = () => {
    if (!inviteUsername.trim() || !activeGroup?.id) return;
    inviteMutation.mutate({ groupId: activeGroup.id, username: inviteUsername });
  };

  const handleRemoveMember = (member: GroupMember) => {
    if (!confirm(`确定将 ${member.nickname || member.username} 移出团队吗？`)) return;
    removeMemberMutation.mutate(member.id);
  };

  const handleChangeRole = (member: GroupMember, isAdmin: boolean) => {
    changeRoleMutation.mutate({ id: member.id, payload: { role: isAdmin ? 'ADMIN' : 'MEMBER' } });
  };

  const handleDetail = (group: GroupItem) => {
    setSelectedGroup(group);
    setDetailVisible(true);
  };

  const handleViewMembers = (group: GroupItem) => {
    setSelectedGroup(group);
    setMemberVisible(true);
    if (group.id) qc.invalidateQueries({ queryKey: MEMBER_KEY(group.id) });
  };

  const isOwner = (group: GroupItem) => currentUser?.id === (group as any)?.createUser;

  // 按贡献值排序的成员列表
  const sortedMembers = [...groupMembers].sort((a, b) => (b.contribution || 0) - (a.contribution || 0));

  // 获取团队排名（基于成员贡献值总和）
  const getGroupRanking = () => {
    return myGroups.map(group => ({
      ...group,
      totalContribution: groupMembers.filter(m => m.groupId === group.id)
        .reduce((sum, m) => sum + (m.contribution || 0), 0),
    })).sort((a, b) => b.totalContribution - a.totalContribution);
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>团队管理</Typography>

      {/* 标签页切换 */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 3 }}>
        <Tab label={`我的团队(${myGroups.length})`} value="my" />
        <Tab label={`申请列表(${waitList.length})`} value="apply" />
        <Tab label="团队排名" value="ranking" />
      </Tabs>

      {tab === 'my' && (
        <Box>
          {/* 操作按钮 */}
          <Box sx={{ mb: 3, display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateVisible(true)}>
              创建团队
            </Button>
            <Button variant="outlined" startIcon={<SearchIcon />} onClick={() => setAddVisible(true)}>
              加入团队
            </Button>
          </Box>

          {/* 团队卡片列表 */}
          <Grid container spacing={2}>
            {myGroups.map((group) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={group.id}>
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
                      <GroupIcon
                        sx={{
                          fontSize: 48,
                          color: (theme) =>
                            theme.palette.mode === 'dark'
                              ? 'rgba(255,255,255,0.5)'
                              : 'text.disabled',
                        }}
                      />
                    )}
                  </CardMedia>
                  <CardContent sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" noWrap sx={{ fontWeight: "bold" }}>
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
                    {onOpenTaskboard && (
                      <Button
                        size="small"
                        sx={{ color: '#06B6D4' }}
                        onClick={(e) => { e.stopPropagation(); onOpenTaskboard(group.id!); }}
                      >
                        查看任务
                      </Button>
                    )}
                    <Button
                      size="small"
                      startIcon={<PersonAddIcon />}
                      onClick={() => handleViewMembers(group)}
                    >
                      成员
                    </Button>
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

      {tab === 'ranking' && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>团队贡献排行榜</Typography>
          <ResponsiveTableWrapper>
            <TableContainer component={Card}>
              <Table>
              <TableHead>
                <TableRow>
                  <TableCell align="center">排名</TableCell>
                  <TableCell align="center">团队名称</TableCell>
                  <TableCell align="center">成员数</TableCell>
                  <TableCell align="center">总贡献值</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {getGroupRanking().map((group, index) => (
                  <TableRow key={group.id} hover>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        {index < 3 ? (
                          <StarIcon sx={{ color: index === 0 ? 'gold' : index === 1 ? 'silver' : '#cd7f32', fontSize: 20 }} />
                        ) : null}
                        <Typography sx={{ fontWeight: index < 3 ? 'bold' : 'normal' }}>#{index + 1}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Avatar src={group.cover} sx={{ width: 32, height: 32 }}>
                          <GroupIcon />
                        </Avatar>
                        <Typography>{group.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">{groupMembers.filter(m => m.groupId === group.id).length}</TableCell>
                    <TableCell align="center">
                      <Chip
                        icon={<StarIcon />}
                        label={group.totalContribution || 0}
                        size="small"
                        color={index < 3 ? 'primary' : 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {myGroups.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Typography color="text.secondary">暂无团队数据</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          </ResponsiveTableWrapper>
        </Box>
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
              onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="团队简介"
              value={formValues.info || ''}
              onChange={(e) => setFormValues({ ...formValues, info: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <TextField
              label="封面图URL"
              value={formValues.cover || ''}
              onChange={(e) => setFormValues({ ...formValues, cover: e.target.value })}
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
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={handleSearch}>
                        <SearchIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
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
              sx={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 0, mb: 2 }}
            />
          )}
          <Typography variant="body1" sx={{ mb: 2 }}>{selectedGroup?.info || '暂无描述'}</Typography>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
            <GroupIcon />
            <Typography variant="body2">{selectedGroup?.projects || 0} 个项目</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => {
                setDetailVisible(false);
                handleViewMembers(selectedGroup!);
              }}
            >
              管理成员
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailVisible(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* 成员管理弹窗 */}
      <Dialog open={memberVisible} onClose={() => setMemberVisible(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          成员管理 - {selectedGroup?.name}
          <IconButton onClick={() => setMemberVisible(false)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {/* 邀请成员 */}
          {isOwner(selectedGroup!) && (
            <Box sx={{ mb: 3, display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="输入用户名邀请成员..."
                value={inviteUsername}
                onChange={(e) => setInviteUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInviteMember()}
                sx={{ flex: 1 }}
              />
              <Button variant="contained" startIcon={<PersonAddIcon />} onClick={handleInviteMember}>
                邀请
              </Button>
            </Box>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center">成员</TableCell>
                  <TableCell align="center">角色</TableCell>
                  <TableCell align="center">贡献值</TableCell>
                  <TableCell align="center">加入时间</TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      position: 'sticky',
                      right: 0,
                      bgcolor: 'action.hover',
                      zIndex: 3,
                      minWidth: 120,
                      boxShadow: '-4px 0 8px rgba(0,0,0,0.06)',
                    }}
                  >
                    操作
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedMembers.map((member, index) => (
                  <TableRow key={member.id} hover>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Avatar src={member.avatar} sx={{ width: 28, height: 28 }}>
                          {(member.nickname || member.username || 'U')[0]}
                        </Avatar>
                        <Box>
                          <Typography variant="body2">{member.nickname || member.username}</Typography>
                          {index < 3 && (
                            <StarIcon sx={{ fontSize: 12, color: 'gold' }} />
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={member.role === 'ADMIN' ? '管理员' : '成员'}
                        size="small"
                        color={member.role === 'ADMIN' ? 'primary' : 'default'}
                        variant={member.role === 'ADMIN' ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        icon={<StarIcon sx={{ fontSize: 14 }} />}
                        label={member.contribution || 0}
                        size="small"
                        color={index < 3 ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="caption">
                        {member.createTime ? new Date(member.createTime).toLocaleDateString() : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        position: 'sticky',
                        right: 0,
                        bgcolor: 'background.paper',
                        zIndex: 2,
                        minWidth: 120,
                        boxShadow: '-4px 0 8px rgba(0,0,0,0.06)',
                        // 跟随 row hover:用 boxShadow 模拟,保持背景透出但有边框感
                        '&.MuiTableCell-body': { transition: 'background-color 0.15s' },
                      }}
                    >
                      {isOwner(selectedGroup!) && member.userId !== currentUser?.id && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title={member.role === 'ADMIN' ? '撤销管理员' : '设为管理员'}>
                            <IconButton
                              size="small"
                              onClick={() => handleChangeRole(member, member.role !== 'ADMIN')}
                            >
                              <LeaderboardIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="移除">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveMember(member)}
                            >
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {groupMembers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="text.secondary">暂无成员</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMemberVisible(false)}>关闭</Button>
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
