'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import Fab from '@mui/material/Fab';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import { getEarnings, getMyPaidContents, type PaidContent } from '@/apis/social-monetize';
import { getCreatorMonetizeSummary } from '@/apis/creator';
import { TYPE_LABEL } from '@/lib/contentRoute';
import { MobileSection, MobileStatRow, MobileListRow } from '@/components/mobile/MobileSection';
import { useActiveTab } from '../../ActiveTabContext';
import { MOBILE_FAB_SX } from '../works/MobileFilterBar';

const SOURCE_LABELS: Record<string, string> = {
  recharge: '充值',
  consume: '消费',
  reward: '打赏',
  refund: '退款',
  // 钱包流水的实际类型码(电脑版表只认前四个,其余直接露出英文码)
  gift_in: '礼物收入',
  gift_out: '送礼',
  tip_in: '打赏收入',
  tip_out: '打赏支出',
  withdraw: '提现',
  demand_settle: '悬赏结算',
  demand_fund: '悬赏预付',
  demand_refund: '悬赏退回',
  task_reward: '任务奖励',
  monthly_benefit: '会员福利',
  invite: '邀请奖励',
  purchase: '购买内容',
  sale: '内容售出',
};

const dia = (v?: number) => (v === undefined || v === null ? '—' : `💎${Number(v).toLocaleString('zh-CN')}`);

/**
 * 手机上的收益中心。电脑版是 收益卡(四格 + 两个按钮 + 说明)→ 付费作品表格 → 钱包总览(大余额卡 +
 * 类型分布条)+ 30 天净流水卡。这里:创作收益四个数一行(「明细 ›」进订阅与打赏)→ 付费作品单列行
 * → 钱包四个数一行 + 流水类型一行字,「提现」是右下角唯一的按钮。
 */
export default function MonetizeMobile() {
  const router = useRouter();
  const { setActiveTab } = useActiveTab();

  // 与电脑版同 queryKey,共用缓存
  const earningsQ = useQuery({ queryKey: ['social', 'earnings'], queryFn: getEarnings });
  const paidQ = useQuery({
    queryKey: ['social', 'my-paid-contents', 'list'],
    queryFn: () => getMyPaidContents({ page: 1, pageSize: 20 }),
  });
  const walletQ = useQuery({
    queryKey: ['account', 'monetize', 'summary'],
    queryFn: () => getCreatorMonetizeSummary(),
  });

  const e = earningsQ.data;
  const paid: PaidContent[] = paidQ.data?.list ?? [];
  const w = walletQ.data;
  const byType = Object.entries(w?.byType || {})
    .map(([k, v]) => ({ k, label: SOURCE_LABELS[k] || k, v }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  const r30 = w?.recent30Days ?? 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, pb: 8 }}>
      <MobileSection title="创作收益" extra="扣 10% 服务费后实时入账" moreLabel="明细" onMore={() => router.push('/account/social-monetize')}>
        {earningsQ.isLoading ? (
          <Skeleton variant="rounded" height={40} />
        ) : (
          <MobileStatRow
            items={[
              { label: '可提现', value: dia(e?.availableAmount) },
              { label: '今日', value: dia(e?.todayEarnings) },
              { label: '本月', value: dia(e?.monthEarnings) },
              { label: '累计', value: dia(e?.totalEarnings) },
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

      <MobileSection title="钱包" moreLabel="账单" onMore={() => router.push('/account/orders')}>
        {walletQ.isLoading ? (
          <Skeleton variant="rounded" height={40} />
        ) : walletQ.isError || !w ? (
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>钱包数据加载失败</Typography>
        ) : (
          <>
            <MobileStatRow
              items={[
                { label: '余额', value: dia(w.balance) },
                { label: '累计入账', value: dia(w.totalIncome) },
                { label: '累计支出', value: dia(w.totalExpense) },
                {
                  label: '近 30 天',
                  value: (
                    <Box component="span" sx={{ color: r30 >= 0 ? 'success.main' : 'error.main' }}>
                      {r30 >= 0 ? '+' : '-'}
                      {Math.abs(r30).toLocaleString('zh-CN')}
                    </Box>
                  ),
                },
              ]}
            />
            {byType.length > 0 && (
              <Typography noWrap sx={{ mt: 1.25, pt: 1.25, borderTop: '1px dashed', borderColor: 'divider', fontSize: 12, color: 'text.secondary' }}>
                {byType.map((t) => `${t.label} ${t.v > 0 ? '+' : ''}${t.v.toLocaleString('zh-CN')}`).join(' · ')}
              </Typography>
            )}
          </>
        )}
      </MobileSection>

      <Fab variant="extended" color="primary" onClick={() => router.push('/account/wallet')} sx={MOBILE_FAB_SX}>
        <AccountBalanceWalletRoundedIcon sx={{ mr: 0.75, fontSize: 20 }} />
        提现
      </Fab>
    </Box>
  );
}
