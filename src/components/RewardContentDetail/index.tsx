'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import DemandDetail from './components/Demand';
import ConceptionDetail from './components/Conception';
import RealizationDetail from './components/Realization';
import GroupDetail from './components/Group';
import ProjectDetail from './components/Project';

interface RewardContentDetailProps {
  detail: {
    id?: string | number;
    name?: string;
    info?: string;
    content?: string;
    rewardAmount?: number;
  };
  type?: string;
  onClose?: () => void;
  onReward?: () => void;
}

export default function RewardContentDetail({ detail, type, onClose, onReward }: RewardContentDetailProps) {
  const renderContent = () => {
    switch (type) {
      case 'DEMAND':
        return <DemandDetail item={detail} type={type} />;
      case 'CONCEPTION':
        return <ConceptionDetail item={detail} type={type} />;
      case 'REALIZATION':
        return <RealizationDetail item={detail} />;
      case 'GROUP':
        return <GroupDetail item={detail} type={type} />;
      case 'PROJECT':
        return <ProjectDetail item={detail} type={type} />;
      default:
        return (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Box sx={{ fontSize: 20, fontWeight: 700, mb: 2 }}>{detail.name}</Box>
            <Box sx={{ color: 'text.secondary' }} dangerouslySetInnerHTML={{ __html: detail.info || '' }} />
          </Box>
        );
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', my: 2 }}>
      {renderContent()}
      {onReward && (
        <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
          <Button variant="contained" color="error" onClick={onReward}>
            参与悬赏
          </Button>
        </Box>
      )}
      {onClose && (
        <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>关闭</Button>
        </Box>
      )}
    </Box>
  );
}
