'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ShareIcon from '@mui/icons-material/Share';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

interface ModuleContentDetailProps {
  detail: {
    id?: string | number;
    name?: string;
    info?: string;
    cover?: string;
    content?: string;
  };
  onClose?: () => void;
}

export default function ModuleContentDetail({ detail, onClose }: ModuleContentDetailProps) {
  return (
    <Card sx={{ maxWidth: 800, mx: 'auto', my: 4 }}>
      <CardContent>
        <Typography variant="h5">{detail.name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>
          {detail.info}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<ThumbUpIcon />}>点赞</Button>
          <Button startIcon={<ThumbDownIcon />}>不喜欢</Button>
          <Button startIcon={<ShareIcon />}>分享</Button>
        </Box>
        {onClose && (
          <Button onClick={onClose} sx={{ mt: 2 }}>
            关闭
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
