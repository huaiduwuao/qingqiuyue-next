'use client';

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import { userPointMe } from '@/apis/global';

interface DashboardProps {
  groupId: any;
  groupData: any;
}

export default function DashboardPage({ groupId, groupData }: DashboardProps) {
  const [myPoint, setMyPoint] = useState<any>({});

  useEffect(() => {
    fetchUserPoint();
  }, []);

  const fetchUserPoint = async () => {
    try {
      const res = await userPointMe({ type: 'reward' });
      setMyPoint(res.data || {});
    } catch (err) {
      console.error('Failed to fetch user point:', err);
    }
  };

  const progress = myPoint.totalPoint && myPoint.needPoint
    ? (myPoint.totalPoint / (myPoint.totalPoint + myPoint.needPoint)) * 100
    : 0;

  return (
    <Box>
      {/* Reward Level Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6">悬赏等级</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              赏金悬赏，每天都有新的挑战！
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <Avatar
              src={"https://static.zhihu.com/heifetz/assets/V1.63bfe1eb.jpg"}
              variant="rounded"
              sx={{ width: 112, height: 88 }}
            />
            <Box sx={{ flex: 1 }}>
              <Typography>
                您当前等级为 {myPoint.levelName} Lv {myPoint.level || 0}，
                还差 {myPoint.needPoint || 0} 灵气即可升级为 Lv {(myPoint.level || 0) + 1}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                {myPoint.totalPoint || 0}/{myPoint.totalPoint + myPoint.needPoint || 0}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Statistics Card */}
      <Card>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6">数据总览</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              悬赏统计，查看您的悬赏数据
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Card variant="outlined" sx={{ flex: '1 1 calc(25% - 8px)', textAlign: 'center', minWidth: 150 }}>
              <CardContent>
                <Typography variant="h4" color="primary">0</Typography>
                <Typography color="text.secondary">需求数</Typography>
                <Typography variant="caption" color="text.secondary">昨日: 0</Typography>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ flex: '1 1 calc(25% - 8px)', textAlign: 'center', minWidth: 150 }}>
              <CardContent>
                <Typography variant="h4" color="primary">0</Typography>
                <Typography color="text.secondary">实现数</Typography>
                <Typography variant="caption" color="text.secondary">昨日: 0</Typography>
              </CardContent>
            </Card>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
