'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';

const ModuleBannerPage = React.lazy(() => import('../module-banner/page'));
const ModuleCategoryPage = React.lazy(() => import('../module-category/page'));
const ModuleTagPage = React.lazy(() => import('../module-tag/page'));

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

interface Props {
  detail?: { id: number };
  handleClose?: () => void;
}

const LIST_KEY = ['content', 'module-detail'];

export default function ModuleDetailPage({ detail, handleClose }: Props) {
  const [tab, setTab] = useState(0);
  const moduleId = detail?.id;

  return (
    <Card>
      <CardContent>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="菜单" />
          <Tab label="轮播图" />
          <Tab label="分类" />
          <Tab label="标签" />
        </Tabs>
        <TabPanel value={tab} index={0}>
          <Typography color="text.secondary">菜单管理 (暂未迁移)</Typography>
        </TabPanel>
        <TabPanel value={tab} index={1}>
          {moduleId && <ModuleBannerPage moduleId={moduleId} />}
        </TabPanel>
        <TabPanel value={tab} index={2}>
          {moduleId && <ModuleCategoryPage moduleId={moduleId} />}
        </TabPanel>
        <TabPanel value={tab} index={3}>
          {moduleId && <ModuleTagPage moduleId={moduleId} />}
        </TabPanel>
      </CardContent>
    </Card>
  );
}