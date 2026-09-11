'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { getEarnings, getMyPaidContents, type PaidContent } from '@/apis/social-monetize';
import { formatYuan } from '@/apis/paywall';
import { TYPE_LABEL } from '@/lib/contentRoute';
import { useActiveTab } from '../../ActiveTabContext';
import WalletSummary from './page';

/**
 * 收益中心:创作收益(付费作品 + 打赏 + 订阅)→ 付费作品表现 → 钱包流水。
 * 收入实时进入钱包,提现在钱包页发起。
 */
export default function MonetizeHub() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <CreatorEarnings />
      <PaidWorks />
      <WalletSummary />
    </Box>
  );
}

const card = { p: { xs: 2, md: 3 }, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' };

function CreatorEarnings() {
  const earnings = useQuery({ queryKey: ['social', 'earnings'], queryFn: getEarnings });
  const e = earnings.data;
  const items = [
    { label: '可提现', value: e?.availableAmount },
    { label: '今日收益', value: e?.todayEarnings },
    { label: '本月收益', value: e?.monthEarnings },
    { label: '累计收益', value: e?.totalEarnings },
  ];
  return (
    <Box component="section" aria-label="创作收益" sx={card}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 600, flex: 1 }}>
          创作收益
        </Typography>
        <Button component={Link} href="/account/social-monetize" size="small" sx={{ textTransform: 'none' }}>
          订阅与打赏明细
        </Button>
        <Button component={Link} href="/account/wallet" size="small" variant="contained" sx={{ textTransform: 'none', borderRadius: 999 }}>
          提现
        </Button>
      </Box>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' } }}>
        {items.map((it) => (
          <Box key={it.label} sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{it.label}</Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', mt: 0.5 }}>
              {it.value === undefined ? '—' : `¥${formatYuan(it.value)}`}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 1.5 }}>
        付费作品、打赏与订阅收入扣除 10% 平台服务费后实时进入钱包。
      </Typography>
    </Box>
  );
}

function PaidWorks() {
  const { setActiveTab } = useActiveTab();
  const paid = useQuery({
    queryKey: ['social', 'my-paid-contents', 'list'],
    queryFn: () => getMyPaidContents({ page: 1, pageSize: 20 }),
  });
  const list: PaidContent[] = paid.data?.list ?? [];

  return (
    <Box component="section" aria-label="付费作品" sx={card}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 600, flex: 1 }}>
          付费作品
        </Typography>
        <Button size="small" onClick={() => setActiveTab('hd-publish')} sx={{ textTransform: 'none' }}>
          发布付费作品
        </Button>
      </Box>
      {paid.isLoading ? (
        <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>加载中…</Typography>
      ) : list.length === 0 ? (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            还没有付费作品。发布小说、漫画、剧集等内容时把定价设为「付费」,可以设置前几章免费试看。
          </Typography>
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, '& th, & td': { py: 1, px: 1, textAlign: 'left', borderBottom: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap' }, '& th': { fontSize: 12, color: 'text.secondary', fontWeight: 500 } }}>
            <thead>
              <tr>
                <th>作品</th>
                <th>类型</th>
                <th>定价</th>
                <th>销量</th>
                <th>销售额</th>
              </tr>
            </thead>
            <tbody>
              {list.map((pc) => (
                <tr key={pc.id}>
                  <Box component="td" sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pc.title || `作品 ${pc.contentId}`}
                  </Box>
                  <td>{TYPE_LABEL[pc.contentType?.toUpperCase()] ?? pc.contentType ?? '—'}</td>
                  <td>¥{formatYuan(pc.price)}</td>
                  <td>{pc.salesCount}</td>
                  <td>¥{formatYuan(pc.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      )}
    </Box>
  );
}
