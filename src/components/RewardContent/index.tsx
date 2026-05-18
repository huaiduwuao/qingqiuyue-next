'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { fallbackImg } from '@/lib/utils';

interface RewardContentProps {
  item: {
    id?: string | number;
    name?: string;
    info?: string;
    cover?: string;
    rewardAmount?: number;
  };
  onClick?: () => void;
}

export default function RewardContent({ item, onClick }: RewardContentProps) {
  return (
    <Card sx={{ cursor: 'pointer' }} onClick={onClick}>
      <CardContent>
        <Typography variant="subtitle1">{item.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {item.info}
        </Typography>
        {item.rewardAmount && (
          <Typography color="error" sx={{ mt: 1 }}>
            赏金: ¥{item.rewardAmount}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
