'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { conceptionDetail } from '@/apis/reward-conception';

interface ConceptionDetailProps {
  item: any;
  type?: any;
}

export default function ConceptionDetail({ item, type }: ConceptionDetailProps) {
  const [detail, setDetail] = useState<any>({});

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await conceptionDetail({ id: item.id });
        setDetail(res.data || {});
      } catch (err) {
        console.error('Failed to fetch conception detail:', err);
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