'use client'

/**
 * 网关与配额 Tab —— 阶段 4 重写:
 *   - 配额卡:展示真实 token 限额/已用/重置日/状态色 + 钻石余额
 *   - 用量趋势折线图(7d/30d 切换)
 *   - 按模型/Agent 拆分表
 *   - 购买入口 → QuotaPurchaseModal
 *   - 历史订单表 + 退订
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import LinearProgress from '@mui/material/LinearProgress'
import RefreshIcon from '@mui/icons-material/Refresh'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import HistoryIcon from '@mui/icons-material/History'

import { quotaAPI, type QuotaOverview, type QuotaPackage, type QuotaOrder, type QuotaTrendPoint, type QuotaBreakdownRow } from './quotaApi'

interface Props {
  embedded?: boolean
}

export default function GatewayQuotaPanel(_: Props) {
  const [overview, setOverview] = useState<QuotaOverview | null>(null)
  const [trend, setTrend] = useState<QuotaTrendPoint[]>([])
  const [trendDays, setTrendDays] = useState<7 | 30>(7)
  const [breakdown, setBreakdown] = useState<QuotaBreakdownRow[]>([])
  const [breakdownDim, setBreakdownDim] = useState<'model' | 'agent'>('model')
  const [packages, setPackages] = useState<QuotaPackage[]>([])
  const [orders, setOrders] = useState<QuotaOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [purchaseOpen, setPurchaseOpen] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, tr, bd, pk, od] = await Promise.all([
        quotaAPI.overview(),
        quotaAPI.trend(trendDays).catch(() => ({ points: [], days: trendDays })),
        quotaAPI.breakdown(breakdownDim, 30).catch(() => ({ rows: [], dim: breakdownDim, days: 30 })),
        quotaAPI.listPackages().catch(() => ({ list: [], total: 0 })),
        quotaAPI.listMyOrders(1, 10).catch(() => ({ list: [], total: 0, page: 1, limit: 10 })),
      ])
      setOverview(ov)
      setTrend(tr.points)
      setBreakdown(bd.rows)
      setPackages(pk.list.filter(p => p.enabled))
      setOrders(od.list)
    } finally {
      setLoading(false)
    }
  }, [trendDays, breakdownDim])

  useEffect(() => { loadAll() }, [loadAll])

  const handleBuy = async (pkg: QuotaPackage) => {
    try {
      await quotaAPI.buyPackage(pkg.id, 'diamond')
      setPurchaseOpen(false)
      await loadAll()
    } catch (e: any) {
      alert(`购买失败: ${e.message ?? e}`)
    }
  }

  const handleRefund = async (orderNo: string) => {
    if (!confirm(`退订订单 ${orderNo}?购买 7 天内可退,按加油包剩余量退回钻石`)) return
    try {
      const r = await quotaAPI.refundOrder(orderNo)
      alert(`已退订:退 ${r.refund_tokens.toLocaleString()} tokens,${r.refund_diamond} 钻`)
      await loadAll()
    } catch (e: any) {
      alert(`退订失败: ${e.message ?? e}`)
    }
  }

  const statusColor = overview?.status === 'hard_block' ? 'error' : overview?.status === 'soft_warn' ? 'warning' : 'success'
  const statusText = overview?.status === 'hard_block' ? '已触顶' : overview?.status === 'soft_warn' ? '即将触顶' : '正常'

  // 折线图:用 SVG 简画
  const trendChart = useMemo(() => {
    if (!trend.length) return null
    const maxV = Math.max(1, ...trend.map(p => p.tokens))
    const W = 480, H = 120, pad = 16
    const step = (W - pad * 2) / Math.max(1, trend.length - 1)
    const points = trend.map((p, i) => `${pad + i * step},${H - pad - (p.tokens / maxV) * (H - pad * 2)}`)
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <polyline fill="none" stroke="#5B8DEF" strokeWidth="2" points={points.join(' ')} />
        {trend.map((p, i) => (
          <circle key={i} cx={pad + i * step} cy={H - pad - (p.tokens / maxV) * (H - pad * 2)} r="2" fill="#5B8DEF" />
        ))}
      </svg>
    )
  }, [trend])

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">🌐 网关与配额</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" startIcon={<RefreshIcon />} onClick={loadAll} disabled={loading}>刷新</Button>
          <Button size="small" variant="contained" startIcon={<ShoppingCartIcon />} onClick={() => setPurchaseOpen(true)}>购买更多</Button>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* 配额卡 + 钻石余额 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 2 }}>
        <Card variant="outlined" sx={{ gridColumn: { xs: '1', md: 'span 2' } }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>本月 Token 配额</Typography>
              {overview && <Chip size="small" color={statusColor} label={statusText} />}
            </Box>
            {overview ? (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    {overview.token_used.toLocaleString()} / {overview.token_limit.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    下次重置 {overview.reset_at}
                  </Typography>
                </Box>
                <Box sx={{ bgcolor: 'grey.200', borderRadius: 1, height: 10, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      bgcolor: statusColor === 'error' ? 'error.main' : statusColor === 'warning' ? 'warning.main' : 'primary.main',
                      height: '100%',
                      width: `${Math.min(overview.token_percent, 100)}%`,
                      transition: 'width 0.3s',
                    }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 3, mt: 1.5, color: 'text.secondary', fontSize: 12 }}>
                  <span>软限: <b>{overview.soft_limit_tokens.toLocaleString()}</b></span>
                  <span>硬限: <b>{overview.hard_limit_tokens.toLocaleString()}</b></span>
                  <span>本期: <b>{overview.period}</b></span>
                </Box>
                {overview.base_token_limit !== undefined && (
                  <Box sx={{ display: 'flex', gap: 3, mt: 0.5, color: 'text.secondary', fontSize: 12, flexWrap: 'wrap' }}>
                    <span>月度额度: <b>{overview.base_token_limit.toLocaleString()}</b></span>
                    <span>
                      加油包: <b>{(overview.purchased_tokens ?? 0).toLocaleString()}</b>
                      {(overview.purchased_tokens ?? 0) > 0 && overview.purchased_expires_at
                        ? `(${new Date(overview.purchased_expires_at).toLocaleDateString('zh-CN')} 到期)`
                        : ''}
                    </span>
                  </Box>
                )}
              </Box>
            ) : (
              <CircularProgress size={20} />
            )}
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>💎 钻石余额</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
              {overview?.diamond_balance.toLocaleString() ?? '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              钻石可购买 LLM 配额套餐,余额耗尽时按月度顶额限流。
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* 用量趋势 */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>📈 用量趋势</Typography>
            <ToggleButtonGroup size="small" value={trendDays} exclusive onChange={(_, v) => v && setTrendDays(v)}>
              <ToggleButton value={7}>7 天</ToggleButton>
              <ToggleButton value={30}>30 天</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          {trendChart ?? <Typography variant="body2" color="text.secondary">暂无数据</Typography>}
        </CardContent>
      </Card>

      {/* 按模型/Agent 拆分 */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>📊 用量拆分</Typography>
            <ToggleButtonGroup size="small" value={breakdownDim} exclusive onChange={(_, v) => v && setBreakdownDim(v)}>
              <ToggleButton value="model">按模型</ToggleButton>
              <ToggleButton value="agent">按 Agent</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          {breakdown.length === 0 ? (
            <Typography variant="body2" color="text.secondary">暂无数据</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{breakdownDim === 'model' ? '模型' : 'Agent'}</TableCell>
                  <TableCell align="right">Tokens</TableCell>
                  <TableCell align="right">请求数</TableCell>
                  <TableCell align="right">占比</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {breakdown.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell><Typography variant="body2" noWrap>{r.key || '—'}</Typography></TableCell>
                    <TableCell align="right">{r.tokens.toLocaleString()}</TableCell>
                    <TableCell align="right">{r.requests.toLocaleString()}</TableCell>
                    <TableCell align="right">{r.percent.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 历史订单 */}
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <HistoryIcon fontSize="small" />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>历史订单</Typography>
          </Box>
          {orders.length === 0 ? (
            <Typography variant="body2" color="text.secondary">暂无订单,点「购买更多」开通</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>订单号</TableCell>
                  <TableCell>套餐</TableCell>
                  <TableCell align="right">支付钻</TableCell>
                  <TableCell align="right">授予 tokens</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>时间</TableCell>
                  <TableCell align="right">操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.order_no}>
                    <TableCell><Typography variant="caption">{o.order_no}</Typography></TableCell>
                    <TableCell>{o.package_name || `套餐 #${o.package_id}`}</TableCell>
                    <TableCell align="right">{o.diamond_paid}</TableCell>
                    <TableCell align="right">{o.tokens_granted.toLocaleString()}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={o.status === 'paid' ? '已支付' : o.status === 'pending' ? '待支付' : o.status === 'refunded' ? '已退订' : o.status}
                        color={o.status === 'paid' ? 'success' : o.status === 'refunded' ? 'default' : 'warning'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{new Date(o.create_time).toLocaleString()}</TableCell>
                    <TableCell align="right">
                      {o.status === 'paid' && (
                        <Button size="small" color="error" onClick={() => handleRefund(o.order_no)}>退订</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 购买弹窗 */}
      <Dialog open={purchaseOpen} onClose={() => setPurchaseOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>购买 LLM 配额套餐</DialogTitle>
        <DialogContent>
          {packages.length === 0 ? (
            <Typography variant="body2" color="text.secondary">暂无可购买的套餐,请联系管理员配置</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
              {packages.map(p => (
                <Card key={p.id} variant="outlined" sx={{ display: 'flex', alignItems: 'center', p: 1.5, gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{p.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {p.token_quota.toLocaleString()} tokens · {p.request_quota.toLocaleString()} 请求
                      {p.rpm ? ` · ${p.rpm} RPM` : ''}{p.tpm ? ` · ${p.tpm} TPM` : ''} · {p.valid_days} 天
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {p.diamond_price > 0 ? `${p.diamond_price} 💎` : p.rmb_price > 0 ? `¥${(p.rmb_price / 100).toFixed(2)}` : '免费'}
                    </Typography>
                    <Button variant="contained" size="small" onClick={() => handleBuy(p)} disabled={p.diamond_price <= 0 && p.rmb_price <= 0}>
                      购买
                    </Button>
                  </Box>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPurchaseOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}