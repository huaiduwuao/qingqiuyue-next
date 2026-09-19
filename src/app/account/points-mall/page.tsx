'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { LoginGate } from '@/components/auth/LoginGate';
import { useApp } from '@/contexts/AppContext';
import { getUserPoint, type UserPointResp } from '@/apis/system-user-point';
import { PointsMallTab } from '@/app/user/points/PointsMallTab';

/**
 * 积分商城 —— 与「我的积分 · 积分商城」同一套真实数据:商品来自 /user/point/mall/items,
 * 用积分(user_point)兑换,钻石类立即到账、实物类由运营发货。
 * 这里原来是一份写死的商品清单,兑换时扣的是钱包余额,扣完什么也不发。
 */
export default function PointsMallPage() {
  const { currentUser } = useApp();
  const uid = currentUser?.id ?? 0;
  const pointQuery = useQuery({
    queryKey: ['user-point', uid],
    queryFn: () => getUserPoint().then((r: any) => (r ?? null) as UserPointResp | null),
    enabled: !!uid,
  });

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>积分商城</Typography>
        <LoginGate mode="replace" message="登录后访问积分商城">
          <PointsMallTab initialPoints={pointQuery.data?.point ?? 0} />
        </LoginGate>
      </Container>
    </Box>
  );
}
