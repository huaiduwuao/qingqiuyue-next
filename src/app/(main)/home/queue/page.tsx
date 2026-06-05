'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import Divider from '@mui/material/Divider';
import Badge from '@mui/material/Badge';
import { page as spiderPage } from '@/apis/content-spider-queue';
import { page as todoPage } from '@/apis/content-todo-queue';
import { AsyncState, EmptyState } from '@/components/common/AsyncState';

const MOCK_SPIDER = [
  { id: 1, title: '晋江文学城 · 待抓取', info: 'http://www.jjwxc.net', content: { content: '排队等待中,预计 5 分钟开始' } },
  { id: 2, title: '起点中文网 · 待抓取', info: 'http://www.qidian.com', content: { content: '已分配 worker #2' } },
];
const MOCK_TODO = [
  { id: 1, title: '首页推荐算法优化', info: 'P1', content: { content: '改用向量召回,当前 CTR +0.3%' } },
  { id: 2, title: '详情页接 useQuery', info: 'P0', content: { content: '已完成 9/9' } },
];

interface QueuePanelProps {
  status: 'running' | 'done';
  onStatusChange: (s: 'running' | 'done') => void;
  query: ReturnType<typeof useQuery<any[]>>;
}

function QueuePanel({ status, onStatusChange, query }: QueuePanelProps) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={status === 'running' ? 0 : 1} onChange={(_, v) => onStatusChange(v === 0 ? 'running' : 'done')}>
            <Tab label="进行中" />
            <Tab label="已完成" />
          </Tabs>
        </Box>
        <AsyncState query={query} isEmpty={(d) => d.length === 0} emptyText="暂无任务" emptyVariant="inbox">
          {(data) => (
            <List>
              {data.map((item, index) => (
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
        </AsyncState>
      </CardContent>
    </Card>
  );
}

export default function HomeQueuePage() {
  const [tabIndex, setTabIndex] = useState(0);
  const [spiderStatus, setSpiderStatus] = useState<'running' | 'done'>('running');
  const [todoStatus, setTodoStatus] = useState<'running' | 'done'>('running');

  const spiderQuery = useQuery({
    queryKey: ['queue', 'spider', spiderStatus],
    queryFn: () => spiderPage({ current: 1, size: 50, status: spiderStatus }).then((r) => r.data?.records || MOCK_SPIDER),
    placeholderData: MOCK_SPIDER,
  });

  const todoQuery = useQuery({
    queryKey: ['queue', 'todo', todoStatus],
    queryFn: () => todoPage({ current: 1, size: 50, status: todoStatus }).then((r) => r.data?.records || MOCK_TODO),
    placeholderData: MOCK_TODO,
  });

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h4" sx={{ mb: 3 }}>队列</Typography>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
          <Tab label="找资源任务" />
          <Tab label="网站开发任务" />
        </Tabs>
        <Box sx={{ display: tabIndex === 0 ? 'block' : 'none' }}>
          <QueuePanel status={spiderStatus} onStatusChange={setSpiderStatus} query={spiderQuery} />
        </Box>
        <Box sx={{ display: tabIndex === 1 ? 'block' : 'none' }}>
          <QueuePanel status={todoStatus} onStatusChange={setTodoStatus} query={todoQuery} />
        </Box>
      </Box>
    </Container>
  );
}
