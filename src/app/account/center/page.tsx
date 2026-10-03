'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { PersonalCenterCard } from '@/components/account/PersonalCenterCard';
import WalletPanel from '@/components/account/wallet/WalletPanel';
import { LoginGate } from '@/components/auth/LoginGate';

/**
 * 个人中心:概览(资料、收藏、历史……)+ 钱包。
 * 钱包是个人的事,不属于创作中心或悬赏中心:悬赏结账、作品付费、打赏等所有收益都汇到这里(?tab=wallet)。
 */
const TABS = [
  { id: 'overview', label: '概览' },
  { id: 'wallet', label: '钱包' },
] as const;

function CenterContent() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get('tab') === 'wallet' ? 'wallet' : 'overview';

  return (
    <>
      <Tabs
        value={tab}
        onChange={(_, v: string) => router.replace(v === 'overview' ? '/account/center' : `/account/center?tab=${v}`, { scroll: false })}
        sx={{ mb: 2, minHeight: 40, '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontSize: 15, fontWeight: 600 } }}
      >
        {TABS.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} />
        ))}
      </Tabs>
      {tab === 'wallet' ? <WalletPanel /> : <PersonalCenterCard />}
    </>
  );
}

export default function AccountCenterPage() {
  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <LoginGate mode="replace" message="登录后查看个人中心">
          <Suspense fallback={null}>
            <CenterContent />
          </Suspense>
        </LoginGate>
      </Box>
    </Box>
  );
}
