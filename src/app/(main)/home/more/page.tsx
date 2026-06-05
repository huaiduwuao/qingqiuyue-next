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
import { listByMap } from '@/apis/system-app-config';
import ModuleContentDetail from '@/components/ModuleContentDetail';
import { AsyncState, EmptyState } from '@/components/common/AsyncState';

interface MenuItem {
  id: number;
  name: string;
  contentId?: number;
  type?: string;
  children?: MenuItem[];
}

const MOCK_TREE: MenuItem[] = [
  { id: 1, name: '清秋月简介', type: 'PAGE', contentId: 1 },
  { id: 2, name: '团队', type: 'GROUP', children: [
    { id: 21, name: '创始团队', type: 'PAGE', contentId: 2 },
    { id: 22, name: '顾问', type: 'PAGE', contentId: 3 },
  ]},
  { id: 3, name: '合作', type: 'PAGE', contentId: 4 },
];

const MOCK_DETAIL: Record<number, any> = {
  1: { id: 1, title: '清秋月简介', content: '清秋月致力于把江南文化通过数字方式带回日常生活。' },
  2: { id: 2, title: '创始团队', content: '由设计师、作家、工程师组成的小型独立团队。' },
  3: { id: 3, title: '顾问', content: '邀请了多位文化学者作为内容顾问。' },
  4: { id: 4, title: '合作', content: '欢迎品牌、内容方洽谈合作。' },
};

export default function HomeMorePage() {
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
  const [activeContentId, setActiveContentId] = useState<number | null>(null);

  const configQuery = useQuery({
    queryKey: ['more', 'config'],
    queryFn: () => listByMap({ code: 'more' }).then((r) => r.data?.[0]?.content?.id as number | undefined),
  });

  const treeQuery = useQuery({
    queryKey: ['more', 'tree', configQuery.data],
    queryFn: () => clientTree({ moduleId: configQuery.data! }).then((r) => {
      const list = r.data && r.data.length > 0 ? r.data : MOCK_TREE;
      return list;
    }),
    enabled: !!configQuery.data,
    placeholderData: MOCK_TREE,
  });

  const detailQuery = useQuery({
    queryKey: ['more', 'detail', activeContentId],
    queryFn: () => detail({ id: activeContentId! }).then((r) => r.data || MOCK_DETAIL[activeContentId!] || null),
    enabled: !!activeContentId,
    placeholderData: activeContentId ? MOCK_DETAIL[activeContentId] : undefined,
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
    </Container>
  );
}
