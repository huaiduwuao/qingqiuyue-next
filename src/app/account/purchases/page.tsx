'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import { LoginGate } from '@/components/auth/LoginGate';
import { getMyUnifiedPurchases, formatMoney, type UnifiedPurchase } from '@/apis/social-monetize';
import { getDetailRoute } from '@/lib/contentRoute';
import { coverBackground } from '@/lib/media';

/**
 * 我的购买 —— 单条内容购买 + 合集买断(GET /social/my-purchases/unified)。
 * 私密专辑被私信分享后,买家付费买断的记录也会出现在这里,点合集卡片回到合集详情。
 */

function formatTime(unixSec?: number) {
  if (!unixSec) return '-';
  return new Date(unixSec * 1000).toLocaleString('zh-CN', { hour12: false });
}

// 每条购买的跳转目标:单条按内容类型拼详情页;合集买家已解锁,回常规合集详情。
function purchaseHref(p: UnifiedPurchase): string {
  if (p.kind === 'collection') return `/account/my-lists/detail?id=${p.refId}`;
  return getDetailRoute(p.contentType || '', p.refId) ?? `/detail/${p.contentType}?id=${p.refId}`;
}

const TABS = [
  { label: '全部', match: (_: UnifiedPurchase) => true },
  { label: '单条内容', match: (p: UnifiedPurchase) => p.kind === 'content' },
  { label: '合集买断', match: (p: UnifiedPurchase) => p.kind === 'collection' },
];

export default function PurchasesPage() {
  const [tab, setTab] = useState(0);

  const purchasesQuery = useQuery({
    queryKey: ['my-unified-purchases'],
    queryFn: () => getMyUnifiedPurchases({ page: 1, pageSize: 100 }),
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  });
  const purchases: UnifiedPurchase[] = (purchasesQuery.data?.list ?? []) as UnifiedPurchase[];
  const filtered = useMemo(() => purchases.filter(TABS[tab].match), [purchases, tab]);
  const totalSpent = purchases.reduce((s, p) => s + p.amount, 0);

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>我的购买</Typography>

        <LoginGate mode="replace" message="登录后查看我的购买">
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mb: 3 }}>
            <Summary label="累计购买" value={String(purchases.length)} />
            <Summary label="已花费" value={`¥${formatMoney(totalSpent)}`} color="primary.main" />
            <Summary label="合集买断" value={String(purchases.filter((p) => p.kind === 'collection').length)} color="#FFB400" />
          </Box>

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { textTransform: 'none', fontSize: 13, minHeight: 40 } }}
          >
            {TABS.map((t) => (
              <Tab key={t.label} label={t.label} />
            ))}
          </Tabs>

          {purchasesQuery.isLoading ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <CircularProgress size={32} />
            </Box>
          ) : purchasesQuery.isError ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>购买记录加载失败</Typography>
              <Button size="small" onClick={() => purchasesQuery.refetch()}>重试</Button>
            </Box>
          ) : filtered.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>还没有购买记录</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {filtered.map((p) => {
                const isCollection = p.kind === 'collection';
                return (
                  <Box
                    key={`${p.kind}-${p.id}`}
                    component={Link}
                    href={purchaseHref(p)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))',
                      border: '1px solid var(--border-color, rgba(255,255,255,0.06))',
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'border-color 0.15s',
                      '&:hover': { borderColor: 'primary.main' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 72,
                        height: 48,
                        flexShrink: 0,
                        borderRadius: 1,
                        background: coverBackground(p.coverUrl, 'action.hover'),
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, flexWrap: 'wrap' }}>
                        <Tag
                          icon={isCollection ? <CollectionsBookmarkRoundedIcon sx={{ fontSize: 11 }} /> : <ArticleRoundedIcon sx={{ fontSize: 11 }} />}
                          text={isCollection ? '合集买断' : '单条内容'}
                          color={isCollection ? '#FFB400' : '#5B8DEF'}
                          bg={isCollection ? 'rgba(255,180,0,0.12)' : 'rgba(91,141,239,0.12)'}
                        />
                        <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{formatTime(p.createdAt)}</Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'text.primary',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {p.title || (isCollection ? '合集' : '内容')}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: 'text.primary' }}>
                      ¥{formatMoney(p.amount)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </LoginGate>
      </Container>
    </Box>
  );
}

function Summary({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'var(--bg-surface, rgba(20, 22, 32, 0.6))', border: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 700, color }}>{value}</Typography>
    </Box>
  );
}

function Tag({ icon, text, color, bg }: { icon: React.ReactNode; text: string; color: string; bg: string }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.375, px: 0.75, py: 0.125, borderRadius: 0.5, bgcolor: bg, color, fontSize: 9, fontWeight: 700 }}>
      {icon}
      {text}
    </Box>
  );
}
