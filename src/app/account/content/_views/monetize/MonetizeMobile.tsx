'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Fab from '@mui/material/Fab';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import { getMyPaidContents, type PaidContent } from '@/apis/social-monetize';
import { WALLET_HREF, getWalletIncome } from '@/apis/wallet';
import { TYPE_LABEL } from '@/lib/contentRoute';
import { MobileSection, MobileStatRow, MobileListRow } from '@/components/mobile/MobileSection';
import { useActiveTab } from '../../ActiveTabContext';
import { MOBILE_FAB_SX } from '../works/MobileFilterBar';
import { worksIncome } from './worksIncome';

const dia = (v?: number) => (v === undefined || v === null ? '—' : `💎${Number(v).toLocaleString('zh-CN')}`);

/**
 * 手机上的作品变现:作品收益一行(本月 / 累计)→ 付费作品单列行;右下角「钱包」进个人中心的钱包
 * (余额、提现、全部收益与明细都在那里)。
 */
export default function MonetizeMobile() {
  const router = useRouter();
  const { setActiveTab } = useActiveTab();

  const incomeQ = useQuery({ queryKey: ['wallet-income'], queryFn: getWalletIncome });
  const paidQ = useQuery({
    queryKey: ['social', 'my-paid-contents', 'list'],
    queryFn: () => getMyPaidContents({ page: 1, pageSize: 20 }),
  });
  const w = worksIncome(incomeQ.data);
  const paid: PaidContent[] = paidQ.data?.list ?? [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pb: 8 }}>
      <MobileSection title="作品收益" extra="扣 10% 服务费后实时入账" moreLabel="明细" onMore={() => router.push('/account/social-monetize')}>
        {incomeQ.isLoading ? (
          <Skeleton variant="rounded" height={40} />
        ) : (
          <MobileStatRow
            items={[
              { label: '本月', value: dia(incomeQ.data ? w.month : undefined) },
              { label: '累计', value: dia(incomeQ.data ? w.total : undefined) },
            ]}
          />
        )}
      </MobileSection>

      <MobileSection title="付费作品" extra={paid.length ? `${paid.length} 件` : undefined} moreLabel="发布" onMore={() => setActiveTab('hd-publish')} flush>
        {paidQ.isLoading ? (
          <Box sx={{ px: 1.75, pb: 1.75 }}>
            <Skeleton variant="rounded" height={44} />
          </Box>
        ) : paid.length === 0 ? (
          <Typography sx={{ px: 1.75, pb: 1.75, pt: 0.5, fontSize: 12, color: 'text.secondary' }}>
            还没有付费作品,发布时把定价设为「付费」即可
          </Typography>
        ) : (
          paid.map((pc, i) => (
            <MobileListRow
              key={pc.id}
              divider={i > 0}
              title={pc.title || `作品 ${pc.contentId}`}
              subtitle={`${TYPE_LABEL[pc.contentType?.toUpperCase()] ?? pc.contentType ?? '—'} · 定价 💎${pc.price} · 销量 ${pc.salesCount}`}
              trailing={
                <Typography sx={{ fontSize: 14, fontWeight: 700, flexShrink: 0 }}>💎{pc.revenue}</Typography>
              }
            />
          ))
        )}
      </MobileSection>

      <Fab variant="extended" color="primary" onClick={() => router.push(WALLET_HREF)} sx={MOBILE_FAB_SX}>
        <AccountBalanceWalletRoundedIcon sx={{ mr: 0.75, fontSize: 20 }} />
        钱包
      </Fab>
    </Box>
  );
}
