'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { projectDetail } from '@/apis/reward-project';

interface ProjectDetailProps {
  item: any;
  type?: any;
}

export default function ProjectDetail({ item, type }: ProjectDetailProps) {
  const [detail, setDetail] = useState<any>({});

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await projectDetail({ id: item.id });
        setDetail(res.data || {});
      } catch (err) {
        console.error('Failed to fetch project detail:', err);
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