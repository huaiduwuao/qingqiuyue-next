'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { getMyPaidContents, type PaidContent } from '@/apis/social-monetize';
import { WALLET_HREF, formatDiamonds, getWalletIncome } from '@/apis/wallet';
import { worksIncome } from './worksIncome';
import { TYPE_LABEL } from '@/lib/contentRoute';
import { useActiveTab } from '../../ActiveTabContext';
import { useResponsive } from '@/hooks/useResponsive';
import MonetizeMobile from './MonetizeMobile';

/**
 * 作品变现:付费作品的定价与销售。钱(余额、提现、全部收益与流水)在个人中心的钱包里,
 * 这里只留一行作品收益,点过去看全部。
 */
export default function MonetizeHub() {
  const { isMobile } = useResponsive();
  if (isMobile) return <MonetizeMobile />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <WorksIncomeLine />
      <PaidWorks />
    </Box>
  );
}

const card = { p: { xs: 2, md: 3 }, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' };

function WorksIncomeLine() {
  const incomeQ = useQuery({ queryKey: ['wallet-income'], queryFn: getWalletIncome });
  const w = worksIncome(incomeQ.data);
  return (
    <Box
      component="section"
      aria-label="作品收益"
      sx={{ ...card, py: { xs: 1.5, md: 1.75 }, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}
    >
      <Typography sx={{ fontSize: 14, flex: 1, minWidth: 240 }}>
        作品收益 本月 <b>{incomeQ.data ? formatDiamonds(w.month) : '—'}</b> · 累计 <b>{incomeQ.data ? formatDiamonds(w.total) : '—'}</b>
        <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', ml: 1 }}>
          付费作品、打赏、订阅、礼物,扣除 10% 平台服务费后实时进入钱包
        </Box>
      </Typography>
      <Button variant="text" component={Link} href="/account/social-monetize" size="small" sx={{ textTransform: 'none' }}>
        订阅与打赏明细
      </Button>
      <Button component={Link} href={WALLET_HREF} size="small" variant="outlined" sx={{ textTransform: 'none', borderRadius: 999 }}>
        去钱包 ›
      </Button>
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
        <Button variant="outlined" size="small" onClick={() => setActiveTab('hd-publish')} sx={{ textTransform: 'none' }}>
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
                  <td>💎 {pc.price}</td>
                  <td>{pc.salesCount}</td>
                  <td>💎 {pc.revenue}</td>
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      )}
    </Box>
  );
}
