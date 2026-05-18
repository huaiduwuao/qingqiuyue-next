'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';
import { clientTree } from '@/apis/system-module-menu';
import { detail } from '@/apis/system-module-content';
import { listByMap } from '@/apis/system-app-config';
import ModuleContentDetail from '@/components/ModuleContentDetail';

interface MenuItem {
  id: number;
  name: string;
  contentId?: number;
  type?: string;
  children?: MenuItem[];
}

export default function HomeMorePage() {
  const [treeData, setTreeData] = useState<MenuItem[]>([]);
  const [contentDetail, setContentDetail] = useState<any>(null);
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchTreeData();
  }, []);

  const fetchTreeData = async () => {
    setLoading(true);
    try {
      const configRes = await listByMap({ code: 'more' });
      const moduleId = configRes.data?.[0]?.content?.id;
      if (moduleId) {
        const res = await clientTree({ moduleId });
        setTreeData(res.data || []);
        if (res.data?.length > 0) {
          const firstItem = res.data[0];
          setSelectedKeys([firstItem.id]);
          if (firstItem.contentId) {
            fetchContentDetail(firstItem.contentId);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch tree data:', err);
    }
    setLoading(false);
  };

  const fetchContentDetail = async (contentId: number) => {
    setDetailLoading(true);
    try {
      const res = await detail({ id: contentId });
      setContentDetail(res.data);
    } catch (err) {
      console.error('Failed to fetch content detail:', err);
    }
    setDetailLoading(false);
  };

  const handleMenuClick = (menu: MenuItem) => {
    setSelectedKeys([menu.id]);
    if (menu.contentId) {
      fetchContentDetail(menu.contentId);
    }
  };

  const renderMenu = (data: MenuItem[], depth = 0) => {
    return data.map((menu) => {
      if (menu.type === 'PAGE') {
        return (
          <ListItemButton
            key={menu.id}
            selected={selectedKeys.includes(menu.id)}
            onClick={() => handleMenuClick(menu)}
            sx={{ pl: 2 + depth * 2 }}
          >
            <ListItemText
              primary={menu.name}
              sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            />
          </ListItemButton>
        );
      }

      return (
        <Box key={menu.id}>
          <ListItemButton sx={{ pl: 2 + depth * 2 }}>
            <Typography
              sx={{
                fontWeight: 'bold',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {menu.name}
            </Typography>
          </ListItemButton>
          {menu.children && (
            <Box sx={{ pl: 2 }}>
              {renderMenu(menu.children, depth + 1)}
            </Box>
          )}
        </Box>
      );
    });
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ mb: 3 }}>更多内容</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Card sx={{ width: 256, flexShrink: 0 }}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              {loading ? (
                <Box sx={{ p: 2 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} variant="text" width="100%" height={32} sx={{ my: 1 }} />
                  ))}
                </Box>
              ) : treeData.length === 0 ? (
                <Typography align="center" color="text.secondary" sx={{ py: 4 }}>暂无内容</Typography>
              ) : (
                <List sx={{ p: 0 }}>
                  {renderMenu(treeData)}
                </List>
              )}
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              {detailLoading ? (
                <Box>
                  <Skeleton variant="text" width="40%" height={40} />
                  <Skeleton variant="text" width="100%" height={20} sx={{ my: 1 }} />
                  <Skeleton variant="text" width="80%" height={20} />
                </Box>
              ) : contentDetail && contentDetail.id ? (
                <ModuleContentDetail detail={contentDetail} />
              ) : (
                <Typography align="center" color="text.secondary" sx={{ py: 4 }}>请选择左侧菜单</Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Container>
  );
}
