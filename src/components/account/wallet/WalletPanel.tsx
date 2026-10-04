'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import CircularProgress from '@mui/material/CircularProgress';
import DiamondIcon from '@mui/icons-material/Diamond';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { gradient3 } from '@/constants/gradients';
import { formatApiError } from '@/lib/api/client';
import {
  applyWithdraw,
  formatDiamonds,
  getWalletBalance,
  getWalletIncome,
  getWalletTransactions,
  FEN_PER_DIAMOND,
  MIN_WITHDRAW_DIAMONDS,
  type IncomeBucket,
  type WalletTransaction,
} from '@/apis/wallet';
import { getWithdrawHistory } from '@/apis/social-monetize';

/**
 * 个人中心里的钱包:余额 → 收益(按来源)→ 支出 → 明细(可按来源筛)→ 提现记录。
 *
 * 全站只有一种货币:钻石。悬赏结账、作品付费、打赏、订阅、礼物、平台奖励都进这一个钱包,
 * 人民币只在充值(买钻石)和提现(钻石换钱到账)两处出现。
 */

const WITHDRAW_METHOD_LABEL = { wechat: '微信', alipay: '支付宝', bank: '银行卡' } as const;

/** 流水类型的短名;没列出的用备注 */
const TX_LABEL: Record<string, string> = {
  demand_settle: '悬赏结账',
  demand_escrow: '悬赏托管',
  demand_refund: '赏金退回',
  demand_settle_out: '悬赏补付',
  paid_content_in: '作品付费',
  paid_content_out: '购买作品',
  collection_in: '合集付费',
  collection_out: '购买合集',
  my_list_unlock_in: '合集买断',
  my_list_unlock_out: '买断合集',
  tip_in: '收到打赏',
  tip_out: '打赏',
  subscription_in: '订阅收入',
  subscription_out: '订阅',
  gift_in: '收到礼物',
  gift_out: '送礼物',
  recharge: '充值',
  withdraw_freeze: '提现',
  withdraw_reject: '提现退回',
  monthly_benefit: '会员福利',
  mall_purchase: '商城兑换',
  membership_purchase: '开通会员',
  quota_purchase: 'AI 额度',
  admin_adjust: '平台调整',
};

/** 悬赏相关流水能跳回对应的需求 */
function demandIdOf(tx: WalletTransaction): number | null {
  if (tx.sourceType === 'demand_settle' && tx.sourceId) return tx.sourceId;
  const m = /^demand_(?:escrow|refund|settle_out)_(\d+)$/.exec(tx.refId || '');
  return m ? Number(m[1]) : null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return `今天 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${d.getFullYear() === today.getFullYear() ? '' : `${d.getFullYear()}-`}${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const card = { p: { xs: 2, md: 2.5 }, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } as const;

export default function WalletPanel() {
  const qc = useQueryClient();
  const [hidden, setHidden] = useState(false);
  const [filter, setFilter] = useState('');
  const [snack, setSnack] = useState<string | null>(null);

  const balanceQuery = useQuery({ queryKey: ['wallet-balance'], queryFn: getWalletBalance, staleTime: 10_000, refetchOnMount: 'always' });
  const incomeQuery = useQuery({ queryKey: ['wallet-income'], queryFn: getWalletIncome, staleTime: 10_000, refetchOnMount: 'always' });
  const withdrawQuery = useQuery({
    queryKey: ['wallet-withdraws'],
    queryFn: () => getWithdrawHistory({ page: 1, pageSize: 5 }),
    staleTime: 30_000,
  });
  const PAGE_SIZE = 20;
  const txQuery = useInfiniteQuery({
    queryKey: ['wallet-transactions', filter],
    queryFn: ({ pageParam }) => getWalletTransactions({ page: pageParam, size: PAGE_SIZE, filter: filter || undefined }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (pages.length * PAGE_SIZE < (last?.total ?? 0) ? pages.length + 1 : undefined),
    staleTime: 10_000,
    refetchOnMount: 'always',
  });

  const balance = balanceQuery.data?.balance ?? 0;
  const frozen = balanceQuery.data?.frozen ?? 0;
  const income = incomeQuery.data;
  const records = txQuery.data?.pages.flatMap((p) => p?.list ?? []) ?? [];
  const filterLabel = income?.filters.find((f) => f.key === filter)?.label;

  // ── 提现 ──
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState<'wechat' | 'alipay' | 'bank'>('wechat');
  const [withdrawAccount, setWithdrawAccount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const handleWithdraw = async () => {
    const amountNum = Number(withdrawAmount);
    if (!withdrawAmount || !Number.isInteger(amountNum) || amountNum <= 0) {
      setSnack('请输入有效的提现钻石数(整数)');
      return;
    }
    if (amountNum < MIN_WITHDRAW_DIAMONDS) {
      setSnack(`最低提现 ${MIN_WITHDRAW_DIAMONDS} 钻(¥${(MIN_WITHDRAW_DIAMONDS * FEN_PER_DIAMOND) / 100})`);
      return;
    }
    if (amountNum > balance) {
      setSnack('提现钻石数不能超过余额');
      return;
    }
    if (!withdrawAccount.trim()) {
      setSnack('请输入收款账号');
      return;
    }
    // 后端 bankInfo ≤ 200 字(含前面的「支付宝: 」)
    if (withdrawAccount.trim().length > 190) {
      setSnack('收款账号过长');
      return;
    }
    setWithdrawing(true);
    try {
      const res = await applyWithdraw({
        amount: amountNum,
        bankInfo: `${WITHDRAW_METHOD_LABEL[withdrawMethod]}: ${withdrawAccount.trim()}`,
      });
      const payout = res?.payoutCents ?? amountNum * FEN_PER_DIAMOND;
      setSnack(`提交成功,审核通过后到账 ¥${(payout / 100).toFixed(2)}`);
      for (const key of ['wallet-balance', 'wallet-transactions', 'wallet-income', 'wallet-withdraws']) {
        qc.invalidateQueries({ queryKey: [key] });
      }
      setWithdrawOpen(false);
      setWithdrawAmount('');
      setWithdrawAccount('');
    } catch (err) {
      setSnack(formatApiError(err) || '提现提交失败');
    } finally {
      setWithdrawing(false);
    }
  };

  const pickFilter = (key: string) => {
    setFilter(key);
    document.getElementById('wallet-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* 余额卡 */}
      <Box
        sx={{
          position: 'relative',
          p: { xs: 2.5, md: 3 },
          borderRadius: 3,
          background: gradient3('#FFB400', '#FE2C55', '#8B5CF6', 50),
          overflow: 'hidden',
          color: '#fff',
        }}
      >
        <Box aria-hidden sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.25), transparent 50%)' }} />
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <DiamondIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>钻石余额</Typography>
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              component={Link}
              href="/account/orders"
              startIcon={<HistoryRoundedIcon sx={{ fontSize: 14 }} />}
              sx={{ color: 'rgba(255,255,255,0.85)', textTransform: 'none', fontSize: 12 }}
            >
              订单
            </Button>
            <IconButton size="small" onClick={() => setHidden((h) => !h)} sx={{ color: '#fff' }} aria-label={hidden ? '显示余额' : '隐藏余额'}>
              {hidden ? <VisibilityOffRoundedIcon sx={{ fontSize: 18 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Typography sx={{ fontSize: { xs: 40, md: 48 }, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {hidden ? '****' : balance.toLocaleString('zh-CN')}
            </Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 600, opacity: 0.85 }}>钻</Typography>
          </Box>
          <Typography sx={{ fontSize: 11, opacity: 0.8, mt: 1, mb: 2 }}>
            {hidden ? '可提现 ****' : `可提现约 ¥${((balance * FEN_PER_DIAMOND) / 100).toFixed(2)}`}
            {frozen > 0 && !hidden ? ` · 提现审核中 ${formatDiamonds(frozen)}` : ''} · 永不过期
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              fullWidth
              component={Link}
              href="/recharge"
              sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 700, textTransform: 'none', borderRadius: 2, border: '1px solid rgba(255,255,255,0.3)', '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' } }}
            >
              充值
            </Button>
            <Button
              fullWidth
              onClick={() => setWithdrawOpen(true)}
              sx={{ bgcolor: 'rgba(0,0,0,0.25)', color: '#fff', fontWeight: 700, textTransform: 'none', borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(0,0,0,0.4)' } }}
            >
              提现
            </Button>
          </Box>
        </Box>
      </Box>

      {/* 收益:悬赏、作品付费、打赏……都在这里汇总 */}
      <Box component="section" aria-label="我的收益" sx={card}>
        <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, mb: 1.5 }}>我的收益</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1.5 }}>
          {[
            { label: '今日', value: income?.today },
            { label: '本月', value: income?.month },
            { label: '累计', value: income?.total },
          ].map((it) => (
            <Box key={it.label} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'action.hover', minWidth: 0 }}>
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{it.label}</Typography>
              <Typography noWrap sx={{ fontSize: { xs: 16, md: 18 }, fontWeight: 700, fontVariantNumeric: 'tabular-nums', mt: 0.25 }}>
                {it.value === undefined ? '—' : hidden ? '****' : it.value.toLocaleString('zh-CN')}
              </Typography>
            </Box>
          ))}
        </Box>
        <SourceTable
          rows={income?.sources ?? []}
          hidden={hidden}
          empty={incomeQuery.isLoading ? '加载中…' : '还没有收益'}
          onPick={(key) => pickFilter(`in:${key}`)}
        />
        <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 1.25 }}>
          单位:钻。悬赏结账、作品付费、打赏和订阅的收入实时进入钱包;作品收入已扣除平台服务费。点一行看对应明细。
        </Typography>
      </Box>

      {(income?.expenses.length ?? 0) > 0 && (
        <Box component="section" aria-label="我的支出" sx={card}>
          <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, mb: 1.5 }}>我的支出</Typography>
          <SourceTable rows={income?.expenses ?? []} hidden={hidden} empty="" onPick={(key) => pickFilter(`out:${key}`)} />
        </Box>
      )}

      {/* 明细 */}
      <Box component="section" aria-label="收支明细" id="wallet-records" sx={{ ...card, scrollMarginTop: 72 }}>
        <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, mb: 1 }}>收支明细</Typography>
        <Box sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', pb: 1, mb: 0.5, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {[{ key: '', label: '全部' }, { key: 'in', label: '收入' }, { key: 'out', label: '支出' }, ...(income?.filters ?? [])].map((f) => (
            <Chip
              key={f.key || 'all'}
              size="small"
              label={f.key.startsWith('out:') && !f.label.startsWith('提现') ? `支出·${f.label}` : f.label}
              color={filter === f.key ? 'primary' : 'default'}
              variant={filter === f.key ? 'filled' : 'outlined'}
              onClick={() => setFilter(f.key)}
              sx={{ flexShrink: 0 }}
            />
          ))}
        </Box>
        {records.length === 0 ? (
          <Typography sx={{ textAlign: 'center', py: 4, fontSize: 13, color: 'text.disabled' }}>
            {txQuery.isLoading ? '加载中…' : filterLabel ? `暂无「${filterLabel}」记录` : '暂无交易记录'}
          </Typography>
        ) : (
          <Box>
            {records.map((r) => (
              <TxRow key={r.id} tx={r} hidden={hidden} />
            ))}
            {txQuery.hasNextPage && (
              <Button fullWidth size="small" onClick={() => txQuery.fetchNextPage()} disabled={txQuery.isFetchingNextPage} sx={{ mt: 1, textTransform: 'none' }}>
                {txQuery.isFetchingNextPage ? '加载中…' : '加载更多'}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {(withdrawQuery.data?.list?.length ?? 0) > 0 && (
        <Box component="section" aria-label="提现记录" sx={card}>
          <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, mb: 1 }}>提现记录</Typography>
          {withdrawQuery.data!.list.map((w) => (
            <Box key={w.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 'none' } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13 }}>
                  {formatDiamonds(w.amount)} → ¥{((w.actualAmount || w.amount * FEN_PER_DIAMOND) / 100).toFixed(2)}
                </Typography>
                <Typography noWrap sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {formatTime(w.createdAt)}
                  {w.remark ? ` · ${w.remark}` : ''}
                </Typography>
              </Box>
              <Chip size="small" label={WITHDRAW_STATUS[w.status]?.label ?? w.status} color={WITHDRAW_STATUS[w.status]?.color ?? 'default'} variant="outlined" />
            </Box>
          ))}
        </Box>
      )}

      <Dialog open={withdrawOpen} onClose={() => !withdrawing && setWithdrawOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>提现</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="提现钻石数"
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              helperText={
                `当前余额 ${formatDiamonds(balance)} · 最低 ${MIN_WITHDRAW_DIAMONDS} 钻` +
                (Number(withdrawAmount) > 0 ? ` · 到账 ¥${((Number(withdrawAmount) * FEN_PER_DIAMOND) / 100).toFixed(2)}` : '')
              }
            />
            <FormControl fullWidth>
              <InputLabel>提现方式</InputLabel>
              <Select value={withdrawMethod} label="提现方式" onChange={(e) => setWithdrawMethod(e.target.value as 'wechat' | 'alipay' | 'bank')}>
                <MenuItem value="wechat">微信</MenuItem>
                <MenuItem value="alipay">支付宝</MenuItem>
                <MenuItem value="bank">银行卡</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="收款账号"
              value={withdrawAccount}
              onChange={(e) => setWithdrawAccount(e.target.value)}
              helperText={withdrawMethod === 'bank' ? '请输入银行卡号' : withdrawMethod === 'alipay' ? '请输入支付宝账号' : '请输入微信号'}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWithdrawOpen(false)} disabled={withdrawing}>取消</Button>
          <Button variant="contained" onClick={handleWithdraw} disabled={withdrawing} startIcon={withdrawing ? <CircularProgress size={14} color="inherit" /> : null}>
            提交
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={2200} onClose={() => setSnack(null)} message={snack} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Box>
  );
}

const WITHDRAW_STATUS: Record<string, { label: string; color: 'default' | 'warning' | 'success' | 'error' }> = {
  pending: { label: '审核中', color: 'warning' },
  approved: { label: '已打款', color: 'success' },
  rejected: { label: '已驳回', color: 'error' },
};

/** 按来源 / 去向的今日 · 本月 · 累计表 */
function SourceTable({ rows, hidden, empty, onPick }: { rows: IncomeBucket[]; hidden: boolean; empty: string; onPick: (key: string) => void }) {
  if (rows.length === 0) {
    return empty ? <Typography sx={{ fontSize: 13, color: 'text.disabled', py: 1 }}>{empty}</Typography> : null;
  }
  const num = (n: number) => (hidden ? '**' : n.toLocaleString('zh-CN'));
  return (
    <Box
      component="table"
      sx={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        '& th, & td': { py: 0.9, px: 0.5, textAlign: 'right', borderBottom: '1px solid', borderColor: 'divider', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
        '& th': { fontSize: 11, color: 'text.secondary', fontWeight: 500 },
        '& th:first-of-type, & td:first-of-type': { textAlign: 'left' },
        '& tbody tr': { cursor: 'pointer' },
        '& tbody tr:hover': { bgcolor: 'action.hover' },
        '& tbody tr:last-of-type td': { borderBottom: 'none' },
      }}
    >
      <thead>
        <tr>
          <th>来源</th>
          <th>今日</th>
          <th>本月</th>
          <th>累计</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.key} onClick={() => onPick(r.key)}>
            <td>{r.label}</td>
            <td>{num(r.today)}</td>
            <td>{num(r.month)}</td>
            <td style={{ fontWeight: 600 }}>{num(r.total)}</td>
          </tr>
        ))}
      </tbody>
    </Box>
  );
}

function TxRow({ tx, hidden }: { tx: WalletTransaction; hidden: boolean }) {
  const demandId = demandIdOf(tx);
  const positive = tx.amount > 0;
  const body = (
    <>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 13, fontWeight: 500 }}>
          {tx.remark || TX_LABEL[tx.type] || tx.type}
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
          {TX_LABEL[tx.type] ? `${TX_LABEL[tx.type]} · ` : ''}
          {formatTime(tx.createTime)}
          {!hidden && ` · 余额 ${tx.balanceAfter.toLocaleString('zh-CN')}`}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: positive ? 'success.main' : 'text.primary', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {hidden ? '**' : `${positive ? '+' : ''}${tx.amount.toLocaleString('zh-CN')}`}
      </Typography>
    </>
  );
  const rowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    py: 1.25,
    borderBottom: '1px solid',
    borderColor: 'divider',
    color: 'inherit',
    textDecoration: 'none',
    '&:last-of-type': { borderBottom: 'none' },
  } as const;
  return demandId ? (
    <Box component={Link} href={`/account/reward?tab=square&demand=${demandId}`} sx={{ ...rowSx, '&:hover': { bgcolor: 'action.hover' } }}>
      {body}
    </Box>
  ) : (
    <Box sx={rowSx}>{body}</Box>
  );
}
