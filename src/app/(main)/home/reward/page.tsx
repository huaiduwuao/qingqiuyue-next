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
import Modal from '@mui/material/Modal';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { useApp } from '@/contexts/AppContext';
import { demandPage, conceptionPage, groupPage, projectPage } from '@/apis/reward';
import RewardContentDetail from '@/components/RewardContentDetail';

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

const TYPE_TABS = [
  { key: 'demand', label: '需求', api: demandPage },
  { key: 'project', label: '项目', api: projectPage },
  { key: 'group', label: '团队', api: groupPage },
  { key: 'conception', label: '意境', api: conceptionPage },
];

export default function HomeRewardPage() {
  const { dict } = useApp();
  const [tabIndex, setTabIndex] = useState(0);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const currentTab = TYPE_TABS[tabIndex];

  useEffect(() => {
    fetchData();
  }, [tabIndex]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await currentTab.api({ pageNum: 1, pageSize: 50 } as any);
      setData(res.data?.records || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
    setLoading(false);
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  const renderList = () => (
    <Card>
      <CardContent>
        {loading ? (
          <List>
            {[1, 2, 3, 4, 5].map((i) => (
              <ListItem key={i}>
                <Skeleton variant="text" width="100%" height={40} />
              </ListItem>
            ))}
          </List>
        ) : data.length === 0 ? (
          <Typography align="center" color="text.secondary" sx={{ py: 4 }}>暂无内容</Typography>
        ) : (
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
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>悬赏</Typography>
        <Tabs value={tabIndex} onChange={handleTabChange} sx={{ mb: 2 }}>
          {TYPE_TABS.map((tab) => (
            <Tab key={tab.key} label={tab.label} />
          ))}
        </Tabs>
        <TabPanel value={tabIndex} index={tabIndex}>
          {renderList()}
        </TabPanel>

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
