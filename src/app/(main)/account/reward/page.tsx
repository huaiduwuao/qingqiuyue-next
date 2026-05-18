'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Popover from '@mui/material/Popover';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Divider from '@mui/material/Divider';
import { useApp } from '@/contexts/AppContext';
import { groupList } from '@/apis/reward-group';

const menuItems = [
  { key: '1', label: '主页' },
  { key: '2', label: '需求管理' },
  { key: '3', label: '实现管理' },
  { key: '4', label: '项目管理' },
  { key: '5', label: '意境管理' },
  { key: '6', label: '团队管理' },
];

// Lazy loaded sub-components
const componentMap: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  '1': React.lazy(() => import('./components/dashboard/page')),
  '2': React.lazy(() => import('./components/demand/page')),
  '3': React.lazy(() => import('./components/realization/page')),
  '4': React.lazy(() => import('./components/project/page')),
  '5': React.lazy(() => import('./components/conception/page')),
  '6': React.lazy(() => import('./components/group/page')),
};

export default function AccountRewardPage() {
  const { currentUser } = useApp();
  const [tabKey, setTabKey] = useState('1');
  const [groupAnchorEl, setGroupAnchorEl] = useState<HTMLElement | null>(null);
  const [groupData, setGroupData] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  useEffect(() => {
    fetchGroupList();
  }, []);

  const fetchGroupList = async () => {
    try {
      const res: any = await groupList({ status: 'AGREE' });
      setGroupData(res.data || []);
    } catch (err) {
      console.error('Failed to fetch group list:', err);
    }
  };

  const getGroupName = () => {
    if (!selectedGroup) return '个人空间';
    const group = groupData.find(g => g.id === selectedGroup);
    return group ? `${group.name}的团队空间` : '个人空间';
  };

  const ContentComponent = componentMap[tabKey];

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        {/* Group Selector */}
        <Box sx={{ mb: 2 }}>
          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel>切换团队空间</InputLabel>
            <Select
              value={selectedGroup}
              label="切换团队空间"
              onChange={(e) => setSelectedGroup(e.target.value)}
            >
              <MenuItem value="">个人空间</MenuItem>
              {groupData.map((item) => (
                <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', gap: 3 }}>
          {/* Sidebar Menu */}
          <Card sx={{ width: 240, flexShrink: 0 }}>
            <List>
              {menuItems.map((item) => (
                <ListItem key={item.key} disablePadding>
                  <ListItemButton
                    selected={tabKey === item.key}
                    onClick={() => setTabKey(item.key)}
                    sx={{
                      borderLeft: tabKey === item.key ? '3px solid' : '3px solid transparent',
                      borderColor: tabKey === item.key ? 'primary.main' : 'transparent',
                    }}
                  >
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Card>

          {/* Content Area */}
          <Card sx={{ flex: 1 }}>
            <Box sx={{ p: 2 }}>
              {ContentComponent ? (
                <React.Suspense fallback={<Typography>加载中...</Typography>}>
                  <ContentComponent groupId={selectedGroup} groupData={groupData} />
                </React.Suspense>
              ) : (
                <Typography color="text.secondary">奖励中心</Typography>
              )}
            </Box>
          </Card>
        </Box>
      </Box>
    </Container>
  );
}
