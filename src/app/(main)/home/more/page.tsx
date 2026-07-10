'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { clientTree } from '@/apis/system-module-menu';
import { detail } from '@/apis/system-module-content';
import { getByCode } from '@/apis/system-app-config';
import ModuleContentDetail from '@/components/ModuleContentDetail';
import { AsyncState, EmptyState } from '@/components/common/AsyncState';

interface MenuItem {
  id: number;
  name: string;
  contentId?: number;
  type?: string;
  children?: MenuItem[];
}

export default function HomeMorePage() {
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
  const [activeContentId, setActiveContentId] = useState<number | null>(null);

  const configQuery = useQuery({
    queryKey: ['more', 'config'],
    queryFn: () => getByCode({ code: 'more' }).then((r) => r.data?.content?.id as number | undefined),
  });

  const treeQuery = useQuery({
    queryKey: ['more', 'tree', configQuery.data],
    queryFn: () => clientTree({ moduleId: configQuery.data! }).then((r) => r.data || []),
    enabled: !!configQuery.data,
  });

  const detailQuery = useQuery({
    queryKey: ['more', 'detail', activeContentId],
    queryFn: () => detail({ id: activeContentId! }).then((r) => r.data || null),
    enabled: !!activeContentId,
  });

  useEffect(() => {
    if (!selectedKeys.length && treeQuery.data && treeQuery.data.length > 0) {
      const first = treeQuery.data[0];
      setSelectedKeys([first.id]);
      if (first.contentId) setActiveContentId(first.contentId);
    }
  }, [treeQuery.data, selectedKeys.length]);

  const handleMenuClick = (menu: MenuItem) => {
    setSelectedKeys([menu.id]);
    if (menu.contentId) setActiveContentId(menu.contentId);
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
      <Box sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h4" sx={{ mb: 3 }}>更多内容</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 320px' }, gap: 2, mb: 3 }}>
          <Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
          <Card sx={{ width: 256, flexShrink: 0 }}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <AsyncState query={treeQuery} isEmpty={(d) => d.length === 0} emptyText="暂无内容" skeletonCount={5}>
                {(data) => <List sx={{ p: 0 }}>{renderMenu(data)}</List>}
              </AsyncState>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              {!activeContentId ? (
                <EmptyState text="请选择左侧菜单" />
              ) : (
                <AsyncState query={detailQuery} skeletonCount={4} isEmpty={(d) => !d}>
                  {(data) => <ModuleContentDetail detail={data} />}
                </AsyncState>
              )}
            </CardContent>
          </Card>
        </Box>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}
