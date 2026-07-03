'use client';

import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { fallbackImg } from '@/lib/utils';

interface ModuleContentProps {
  item: {
    id?: string | number;
    name?: string;
    info?: string;
    cover?: string;
    type?: string;
  };
  onClick?: () => void;
}

export default function ModuleContent({ item, onClick }: ModuleContentProps) {
  return (
    <Card sx={{ cursor: 'pointer' }} onClick={onClick}>
      <CardMedia
        component="img"
        height="140"
        image={item.cover || fallbackImg}
        alt={item.name}
      />
      <CardContent>
        <Typography variant="subtitle2" noWrap>
          {item.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {item.info}
        </Typography>
      </CardContent>
    </Card>
  );
}
