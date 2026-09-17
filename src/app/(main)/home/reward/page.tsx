'use client';

import React, { useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import ListItemText from '@mui/material/ListItemText';
import Modal from '@mui/material/Modal';
import { demandPage, conceptionPage, groupPage, projectPage } from '@/apis/reward';
import RewardContentDetail from '@/components/RewardContentDetail';
import { AsyncState } from '@/components/common/AsyncState';
import { ListLayout } from '@/components/common/ListLayout';

const TYPE_TABS = [
  { key: 'demand', label: '需求', api: demandPage },
  { key: 'project', label: '项目', api: projectPage },
  { key: 'group', label: '团队', api: groupPage },
  { key: 'conception', label: '意境', api: conceptionPage },
];

export default function HomeRewardPage() {
  const [tabIndex, setTabIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const currentTab = TYPE_TABS[tabIndex];

  const query = useQuery({
    queryKey: ['reward', 'home', currentTab.key],
    queryFn: () => currentTab.api({ pageNum: 1, pageSize: 50 } as any).then((r) => r.data?.records || []),
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

        <AsyncState query={query} isEmpty={(d) => d.length === 0} emptyText="暂无内容" emptyHint="试试切换其他分类">
          {(data) => (
            <ListLayout rows minColumnWidth={380} gap={12} packing="masonry">
              {data.map((rawItem) => {
                const item = rawItem as unknown as { id: number; name?: string; info?: string; rewardAmount?: number };
                return (
                  <Box
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedItem(rawItem)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedItem(rawItem)}
                    sx={{
                      px: 2,
                      py: 1,
                      cursor: 'pointer',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      transition: 'border-color 0.15s, background-color 0.15s',
                      '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                    }}
                  >
                    <ListItemText
                      primary={item.name || '无标题'}
                      secondary={
                        <Box component="span">
                          {item.info && <Typography variant="body2" color="text.secondary">{item.info}</Typography>}
                          {item.rewardAmount ? (
                            <Typography color="error" sx={{ mt: 0.5 }}>
                              赏金: ¥{item.rewardAmount}
                            </Typography>
                          ) : null}
                        </Box>
                      }
                    />
                  </Box>
                );
              })}
            </ListLayout>
          )}
        </AsyncState>

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
