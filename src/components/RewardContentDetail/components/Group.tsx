'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { groupDetail } from '@/apis/reward-group';

interface GroupDetailProps {
  item: any;
  type?: any;
}

export default function GroupDetail({ item, type }: GroupDetailProps) {
  const [detail, setDetail] = useState<any>({});

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await groupDetail({ id: item.id });
        setDetail(res.data || {});
      } catch (err) {
        console.error('Failed to fetch group detail:', err);
      }
    };
    if (item.id) {
      fetchDetail();
    }
  }, [item.id]);

  return (
    <Card sx={{ m: 0, p: 0, border: 'none', minHeight: 500 }}>
      <CardContent>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          {detail.name}
        </Typography>
        <Box dangerouslySetInnerHTML={{ __html: detail.info || '' }} />
      </CardContent>
    </Card>
  );
}