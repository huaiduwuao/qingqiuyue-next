'use client';

import React from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import RedeemRoundedIcon from '@mui/icons-material/RedeemRounded';
import { ACCENT } from '@/constants/accents';
import { WALLET_HREF } from '@/apis/wallet';
import { QUICK_LINKS } from './myHomeTabs';
import { quickLinkBadge } from './myHomeModel';

/** 资产入口:手机上是一行数字(钻石/积分/订单/会员/积分商城),电脑端是带图标和徽标的六宫格。 */
export const MyAssetLinks = React.memo(function MyAssetLinks({
  wallet,
  point,
  order,
  vip,
}: {
  wallet: any;
  point: any;
  order: any;
  vip: any;
}) {
  return (
    <>
      {/* 手机:资产一行 —— 钻石余额 / 积分 / 订单 / 会员 / 积分商城,数字在上、名字在下,点进各自页面。
          (电脑端是下面那排带图标的六宫格) */}
      <Box
        sx={{
          display: { xs: 'grid', md: 'none' },
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          mb: 1,
          py: 1,
          borderRadius: 2.5,
          bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
          border: '1px solid var(--border-color, transparent)',
        }}
      >
        {[
          { key: 'wallet', label: '钻石', value: (wallet?.balance ?? 0).toLocaleString(), href: WALLET_HREF },
          { key: 'points', label: '积分', value: (point?.points ?? 0).toLocaleString(), href: '/user/points' },
          { key: 'orders', label: '订单', value: String(order?.total ?? order?.records?.length ?? order?.list?.length ?? 0), href: '/account/orders' },
          { key: 'vip', label: '会员', value: (vip as any)?.tiers?.some((t: any) => t.active) ? 'VIP' : '开通', href: '/account/vip', warn: true },
          { key: 'mall', label: '积分商城', icon: <RedeemRoundedIcon sx={{ fontSize: 20 }} />, href: '/account/points-mall' },
        ].map((a) => (
          <Box
            key={a.key}
            component={Link}
            href={a.href}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.25,
              minWidth: 0,
              textDecoration: 'none',
              color: 'var(--text-primary, currentColor)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {a.icon ? (
              <Box sx={{ height: 20, display: 'flex', alignItems: 'center', color: ACCENT.cyan.main }}>{a.icon}</Box>
            ) : (
              <Typography noWrap sx={{ fontSize: 15, fontWeight: 700, lineHeight: '20px', maxWidth: '100%', color: a.warn ? 'warning.main' : 'inherit' }}>
                {a.value}
              </Typography>
            )}
            <Typography sx={{ fontSize: 11, color: 'var(--text-muted, currentColor)', whiteSpace: 'nowrap' }}>{a.label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Quick links row:竖排 图标在上/标签在下,6 列(电脑端)。手机上是上面那条资产行 */}
      <Box
        sx={{
          display: { xs: 'none', md: 'grid' },
          gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(6, 1fr)' },
          gap: 0.5,
          mb: 2,
          p: 1,
          borderRadius: 2.5,
          bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
          border: '1px solid var(--border-color, transparent)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {QUICK_LINKS.map((q) => {
          // 真实数据:每个入口右上角的小徽标从对应接口取
          const { badge, badgeColor } = quickLinkBadge(q.key, { wallet, point, order, vip });
          return (
            <Box
              key={q.key}
              component={Link}
              href={q.href}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.75,
                py: 1.25,
                px: 0.5,
                borderRadius: 1.5,
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.15s',
                '&:hover': { bgcolor: 'var(--bg-hover, transparent)' },
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.75,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: q.accent,
                  bgcolor: `${q.accent}1A`,
                }}
              >
                {q.icon}
              </Box>
              <Typography sx={{ fontSize: 11, color: 'var(--text-primary, currentColor)', whiteSpace: 'nowrap' }}>{q.label}</Typography>
              {badge && (
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: badgeColor === 'warning' ? 'warning.main' : 'var(--text-secondary, currentColor)', lineHeight: 1 }}>
                  {badge}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </>
  );
});
