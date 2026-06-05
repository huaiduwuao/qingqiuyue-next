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
import Modal from '@mui/material/Modal';
import { demandPage, conceptionPage, groupPage, projectPage } from '@/apis/reward';
import RewardContentDetail from '@/components/RewardContentDetail';
import { AsyncState, EmptyState } from '@/components/common/AsyncState';

const TYPE_TABS = [
  { key: 'demand', label: '需求', api: demandPage },
  { key: 'project', label: '项目', api: projectPage },
  { key: 'group', label: '团队', api: groupPage },
  { key: 'conception', label: '意境', api: conceptionPage },
];

const MOCK_REWARD: Record<string, any[]> = {
  demand: [
    { id: 1, name: '江南古镇纪录片解说词', info: '需要 5 分钟成片脚本', rewardAmount: 3000 },
    { id: 2, name: '古风音乐歌词征集', info: '围绕清秋月主题', rewardAmount: 1500 },
  ],
  project: [
    { id: 1, name: '《清秋月物语》动画化', info: '10 集短片,寻找制作团队', rewardAmount: 80000 },
  ],
  group: [
    { id: 1, name: '原创插画师联盟', info: '已聚集 12 位插画师', rewardAmount: 0 },
  ],
  conception: [
    { id: 1, name: '"水墨秋色"主题短句征集', info: '一句话意境文案', rewardAmount: 500 },
    { id: 2, name: '夜雨听书场景氛围', info: '需要 200 字环境描写', rewardAmount: 800 },
  ],
};

export default function HomeRewardPage() {
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const currentTab = TYPE_TABS[tabIndex];

  const query = useQuery({
    queryKey: ['reward', 'home', currentTab.key],
    queryFn: () => currentTab.api({ pageNum: 1, pageSize: 50 } as any).then((r) => r.data?.records || MOCK_REWARD[currentTab.key] || []),
    placeholderData: MOCK_REWARD[currentTab.key] || [],
  });

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h4" sx={{ mb: 3 }}>悬赏</Typography>
        <Tabs value={tabIndex} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
          {TYPE_TABS.map((tab) => (
            <Tab key={tab.key} label={tab.label} />
          ))}
        </Tabs>

        <Card>
          <CardContent>
            <AsyncState query={query} isEmpty={(d) => d.length === 0} emptyText="暂无内容" emptyHint="试试切换其他分类">
              {(data) => (
                <List>
                  {data.map((item) => (
                    <React.Fragment key={item.id}>
                      <ListItem
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                        onClick={() => setSelectedItem(item)}
                      >
                        <ListItemText
                          primary={item.name || '无标题'}
                          secondary={
                            <Box component="span">
                              {item.info && <Typography variant="body2" color="text.secondary">{item.info}</Typography>}
                              {item.rewardAmount && (
                                <Typography color="error" sx={{ mt: 0.5 }}>
                                  赏金: ¥{item.rewardAmount}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                      <Divider component="li" />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </AsyncState>
          </CardContent>
        </Card>

        <Modal open={!!selectedItem} onClose={() => setSelectedItem(null)}>
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '80%', maxWidth: 800 }}>
            {selectedItem && (
              <RewardContentDetail
                detail={selectedItem}
                onClose={() => setSelectedItem(null)}
              />
            )}
          </Box>
        </Modal>
      </Box>
    </Container>
  );
}
