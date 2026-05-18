'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';
import Badge from '@mui/material/Badge';
import { page as spiderPage } from '@/apis/content-spider-queue';
import { page as todoPage } from '@/apis/content-todo-queue';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export default function HomeQueuePage() {
  const [tabIndex, setTabIndex] = useState(0);
  const [spiderData, setSpiderData] = useState<any[]>([]);
  const [todoData, setTodoData] = useState<any[]>([]);
  const [spiderLoading, setSpiderLoading] = useState(false);
  const [todoLoading, setTodoLoading] = useState(false);
  const [spiderStatus, setSpiderStatus] = useState<string>('running');
  const [todoStatus, setTodoStatus] = useState<string>('running');

  const fetchSpiderData = async (status?: string) => {
    setSpiderLoading(true);
    try {
      const res = await spiderPage({ current: 1, size: 50, status: status || spiderStatus });
      setSpiderData(res.data?.records || []);
    } catch (err) {
      console.error('Failed to fetch spider queue:', err);
    }
    setSpiderLoading(false);
  };

  const fetchTodoData = async (status?: string) => {
    setTodoLoading(true);
    try {
      const res = await todoPage({ current: 1, size: 50, status: status || todoStatus });
      setTodoData(res.data?.records || []);
    } catch (err) {
      console.error('Failed to fetch todo queue:', err);
    }
    setTodoLoading(false);
  };

  useEffect(() => {
    fetchSpiderData();
    fetchTodoData();
  }, []);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  const handleStatusChange = (type: 'spider' | 'todo', status: string) => {
    if (type === 'spider') {
      setSpiderStatus(status);
      fetchSpiderData(status);
    } else {
      setTodoStatus(status);
      fetchTodoData(status);
    }
  };

  const renderSpiderList = () => (
    <Card>
      <CardContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={spiderStatus === 'running' ? 0 : 1} onChange={(_, v) => handleStatusChange('spider', v === 0 ? 'running' : 'done')}>
            <Tab label="进行中" />
            <Tab label="已完成" />
          </Tabs>
        </Box>
        {spiderLoading ? (
          <List>
            {[1, 2, 3].map((i) => (
              <ListItem key={i}>
                <Skeleton variant="text" width="100%" height={30} />
              </ListItem>
            ))}
          </List>
        ) : spiderData.length === 0 ? (
          <Typography align="center" color="text.secondary" sx={{ py: 4 }}>暂无内容</Typography>
        ) : (
          <List>
            {spiderData.map((item, index) => (
              <React.Fragment key={item.id || index}>
                <ListItem alignItems="flex-start">
                  <Badge badgeContent={`第${index + 1}名`} color="primary" sx={{ mr: 2 }}>
                    <ListItemText
                      primary={item.title || '无标题'}
                      secondary={
                        <Box component="span">
                          {item.info && <Typography variant="body2" color="text.secondary">{item.info}</Typography>}
                          {item.content?.content && <Typography variant="body2" sx={{ mt: 1 }}>{item.content.content}</Typography>}
                        </Box>
                      }
                    />
                  </Badge>
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );

  const renderTodoList = () => (
    <Card>
      <CardContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={todoStatus === 'running' ? 0 : 1} onChange={(_, v) => handleStatusChange('todo', v === 0 ? 'running' : 'done')}>
            <Tab label="进行中" />
            <Tab label="已完成" />
          </Tabs>
        </Box>
        {todoLoading ? (
          <List>
            {[1, 2, 3].map((i) => (
              <ListItem key={i}>
                <Skeleton variant="text" width="100%" height={30} />
              </ListItem>
            ))}
          </List>
        ) : todoData.length === 0 ? (
          <Typography align="center" color="text.secondary" sx={{ py: 4 }}>暂无内容</Typography>
        ) : (
          <List>
            {todoData.map((item, index) => (
              <React.Fragment key={item.id || index}>
                <ListItem alignItems="flex-start">
                  <Badge badgeContent={`第${index + 1}名`} color="primary" sx={{ mr: 2 }}>
                    <ListItemText
                      primary={item.title || '无标题'}
                      secondary={
                        <Box component="span">
                          {item.info && <Typography variant="body2" color="text.secondary">{item.info}</Typography>}
                          {item.content?.content && <Typography variant="body2" sx={{ mt: 1 }}>{item.content.content}</Typography>}
                        </Box>
                      }
                    />
                  </Badge>
                </ListItem>
                <Divider component="li" />
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>队列</Typography>
        <Tabs value={tabIndex} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="找资源任务" />
          <Tab label="网站开发任务" />
        </Tabs>
        <TabPanel value={tabIndex} index={0}>
          {renderSpiderList()}
        </TabPanel>
        <TabPanel value={tabIndex} index={1}>
          {renderTodoList()}
        </TabPanel>
      </Box>
    </Container>
  );
}
