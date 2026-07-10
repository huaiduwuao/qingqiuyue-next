'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import { realizationDetail, pickRealization } from '@/apis/reward-realization';
import { useApp } from '@/contexts/AppContext';
import { REWARD_STATUS_ENUM } from '@/enums/common';

interface RealizationDetailProps {
  item: any;
  demand?: any;
  handleClose?: () => void;
}

export default function RealizationDetail({ item, demand, handleClose }: RealizationDetailProps) {
  const { currentUser } = useApp();
  const [detail, setDetail] = useState<any>({});
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await realizationDetail({ id: item.id });
        setDetail(res.data || {});
      } catch (err) {
        console.error('Failed to fetch realization detail:', err);
      }
    };
    if (item.id) {
      fetchDetail();
    }
  }, [item.id]);

  const handlePickRealization = async () => {
    try {
      await pickRealization({ id: detail.id });
      const detailRes = await realizationDetail({ id: item.id });
      setDetail(detailRes.data || {});
      setSnack('采纳成功');
    } catch (err) {
      console.error('Failed to pick realization:', err);
      setSnack('采纳失败,请重试');
    }
  };

  const canShowAttachments = detail.createUser === currentUser?.id || detail.status === 'PICKED';
  const canPick = demand?.createUser === currentUser?.id && detail.status !== 'PICKED';

  return (
    <Card sx={{ m: 0, p: 0, border: 'none', minHeight: 500 }}>
      {/* Detail Top */}
      <Box
        sx={{
          p: 2.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          fontSize: 20,
          fontWeight: 700,
          color: 'text.primary',
        }}
      >
        <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
          {detail.title}
        </Typography>
      </Box>

      {/* Detail Desc */}
      <Box sx={{ p: 2.5, fontSize: 14, lineHeight: 1.5, color: 'text.secondary' }}>
        <Typography component="div" sx={{ mb: 1 }}>
          状态: <span>{REWARD_STATUS_ENUM[detail.status] || detail.status}</span>
        </Typography>
        <Typography component="div" sx={{ mb: 2 }}>
          提交日期: <span>{detail.updateTime}</span>
        </Typography>

        {/* Pick Button */}
        {canPick && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" color="primary" onClick={handlePickRealization} sx={{ width: 150 }}>
              采纳
            </Button>
          </Box>
        )}
      </Box>

      {/* Detail Main */}
      <Box sx={{ p: 2.5, fontSize: 14, lineHeight: 1.5, color: 'text.secondary' }}>
        <Typography
          component="div"
          sx={{
            fontWeight: 700,
            fontSize: 16,
            color: 'text.primary',
            pl: 1.25,
            borderLeft: '5px solid',
            borderColor: 'info.main',
            mb: 1,
          }}
        >
          实现方案:
        </Typography>
        <Box
          sx={{ minHeight: 100, fontSize: 14, color: 'text.secondary', lineHeight: '22px', py: 2.5 }}
          dangerouslySetInnerHTML={{ __html: detail.content?.content || '' }}
        />

        <Typography
          component="div"
          sx={{
            fontWeight: 700,
            fontSize: 16,
            color: 'text.primary',
            pl: 1.25,
            borderLeft: '5px solid',
            borderColor: 'info.main',
            mb: 1,
          }}
        >
          附件:
        </Typography>
        {!canShowAttachments ? (
          <Typography color="text.secondary">采纳后可查看附件</Typography>
        ) : (
          detail.content?.exts?.map((ele: any, index: number) => (
            <Box key={index} sx={{ mb: 0.5 }}>
              <a target="_blank" href={ele.url} rel="noopener noreferrer">
                {ele.name}
              </a>
            </Box>
          ))
        )}
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Card>
  );
}