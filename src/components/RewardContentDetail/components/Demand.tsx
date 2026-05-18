'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import { demandDetail } from '@/apis/reward-demand';
import { useApp } from '@/contexts/AppContext';
import { REWARD_STATUS_ENUM } from '@/enums/common';

interface DemandDetailProps {
  item: any;
  type?: any;
}

export default function DemandDetail({ item, type }: DemandDetailProps) {
  const { currentUser } = useApp();
  const [detail, setDetail] = useState<any>({});

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await demandDetail({ id: item.id });
        setDetail(res.data || {});
      } catch (err) {
        console.error('Failed to fetch demand detail:', err);
      }
    };
    if (item.id) {
      fetchDetail();
    }
  }, [item.id]);

  const goRealizationOperation = () => {
    if (!currentUser?.id) {
      alert('请先登录');
      return;
    }
    // 实现提交流程
  };

  const renderSubmitButton = () => {
    if (!currentUser?.id) {
      return (
        <Button variant="contained" disabled sx={{ width: 150, my: 2 }}>
          登录后提交实现方案
        </Button>
      );
    }

    if (detail.createUser === currentUser.id) {
      return null;
    }

    if (detail.myRealizations?.length > 0) {
      return (
        <Button variant="contained" disabled sx={{ width: 150, my: 2 }}>
          已提交实现方案
        </Button>
      );
    }

    return (
      <Button variant="contained" color="primary" onClick={goRealizationOperation} sx={{ width: 150, my: 2 }}>
        提交实现方案
      </Button>
    );
  };

  return (
    <Card sx={{ m: 0, p: 0, border: 'none', minHeight: 500 }}>
      {/* Detail Top */}
      <Box
        sx={{
          p: 2.5,
          borderBottom: '1px solid #f5f5f5',
          position: 'relative',
          fontSize: 20,
          fontWeight: 700,
          color: '#000',
        }}
      >
        <Typography variant="h5" component="div" sx={{ fontWeight: 700 }}>
          {detail.title}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Typography
            component="span"
            sx={{
              display: 'inline-block',
              px: 1.25,
              height: 26,
              lineHeight: '26px',
              textAlign: 'center',
              fontSize: 13,
              bgcolor: '#fff2e6',
              color: '#fa8c16',
              borderRadius: 1,
            }}
          >
            赏金: {detail.pay}积分
          </Typography>
          <Typography
            component="span"
            sx={{
              display: 'inline-block',
              px: 1.25,
              height: 26,
              lineHeight: '26px',
              textAlign: 'center',
              fontSize: 13,
              bgcolor: '#e6f7ff',
              color: '#1890ff',
              borderRadius: 1,
            }}
          >
            {REWARD_STATUS_ENUM[detail.status] || detail.status}
          </Typography>
          {detail.tags?.map((tag: string) => (
            <Typography
              key={tag}
              component="span"
              sx={{
                display: 'inline-block',
                px: 1.25,
                height: 26,
                lineHeight: '26px',
                textAlign: 'center',
                fontSize: 13,
                bgcolor: '#f0f0f0',
                color: '#666',
                borderRadius: 1,
              }}
            >
              {tag}
            </Typography>
          ))}
        </Box>

        {/* Submit Button */}
        {detail.createUser !== currentUser?.id && (
          <Box sx={{ position: 'absolute', bottom: 20, right: 15 }}>
            {renderSubmitButton()}
          </Box>
        )}
      </Box>

      {/* Detail Main */}
      <Box sx={{ p: 2.5, fontSize: 14, lineHeight: 1.5, color: '#48576a' }}>
        <Typography
          component="div"
          sx={{
            fontWeight: 700,
            fontSize: 16,
            color: '#151519',
            pl: 1.25,
            borderLeft: '5px solid #1890ff',
            mb: 1,
          }}
        >
          需求描述:
        </Typography>
        <Box
          sx={{ minHeight: 100, fontSize: 14, color: '#666', lineHeight: '22px', py: 2.5 }}
          dangerouslySetInnerHTML={{ __html: detail.content?.content || '' }}
        />

        <Typography
          component="div"
          sx={{
            fontWeight: 700,
            fontSize: 16,
            color: '#151519',
            pl: 1.25,
            borderLeft: '5px solid #1890ff',
            mb: 1,
          }}
        >
          附件:
        </Typography>
        {detail.content?.exts?.map((ele: any, index: number) => (
          <Box key={index} sx={{ mb: 0.5 }}>
            <a target="_blank" href={ele.url} rel="noopener noreferrer">
              {ele.name}
            </a>
          </Box>
        ))}
      </Box>

      {/* Realizations List */}
      {detail.realizations && detail.realizations.length > 0 && (
        <Box>
          <Divider sx={{ my: 2 }}>实现列表</Divider>
          <List>
            {detail.realizations.map((realization: any) => (
              <ListItem key={realization.id} sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                <ListItemText
                  primary={realization.title}
                  secondary={`状态: ${REWARD_STATUS_ENUM[realization.status] || realization.status}`}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}

      {/* My Realizations */}
      {detail.myRealizations?.length > 0 && (
        <Box>
          <Divider sx={{ my: 2 }}>我的方案</Divider>
          <List>
            <ListItem>
              <ListItemText
                primary={detail.myRealizations[0].title}
                secondary={`状态: ${REWARD_STATUS_ENUM[detail.myRealizations[0].status] || detail.myRealizations[0].status}`}
              />
            </ListItem>
          </List>
        </Box>
      )}
    </Card>
  );
}