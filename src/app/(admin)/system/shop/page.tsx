'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AddIcon from '@mui/icons-material/Add';
import {
  listMallItems,
  saveMallItem,
  listRedemptions,
  shipRedemption,
  completeRedemption,
  listGifts,
  saveGift,
  type AdminMallItem,
  type AdminGift,
  type AdminRedemption,
} from '@/apis/admin-shop';

/**
 * 商城与礼物:积分商城商品、实物兑换单发货、直播礼物目录。
 * 商品与礼物只能下架不能删除(兑换单和送礼记录要能追溯到它们)。
 */

const CATEGORY_LABEL: Record<AdminMallItem['category'], string> = {
  virtual: '虚拟权益',
  privilege: '平台特权',
  physical: '实物礼品',
  limited: '限定收藏',
};
const REDEMPTION_STATUS: Record<AdminRedemption['status'], string> = { pending: '待发货', shipped: '已发货', completed: '已完成' };
const EFFECTS: AdminGift['effect'][] = ['small', 'medium', 'large', 'huge'];

const EMPTY_ITEM: AdminMallItem = {
  name: '', desc: '', category: 'virtual', emoji: '🎁', gradient: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
  points: 100, originalPoints: 0, stock: -1, tag: '', deliverType: 'diamond', deliverAmount: 100, status: 'active', sort: 0,
};
const EMPTY_GIFT: AdminGift = { name: '', icon: '🌹', price: 100, effect: 'small', combo: false, status: 'active', sort: 0 };

const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

export default function SystemShopPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [msg, setMsg] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);
  const [item, setItem] = useState<AdminMallItem | null>(null);
  const [gift, setGift] = useState<AdminGift | null>(null);
  const [shipTarget, setShipTarget] = useState<AdminRedemption | null>(null);
  const [tracking, setTracking] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const itemsQ = useQuery({ queryKey: ['admin-shop', 'items'], queryFn: listMallItems });
  const redemptionsQ = useQuery({ queryKey: ['admin-shop', 'redemptions', statusFilter], queryFn: () => listRedemptions(statusFilter || undefined) });
  const giftsQ = useQuery({ queryKey: ['admin-shop', 'gifts'], queryFn: listGifts });

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg({ text: ok, severity: 'success' });
      qc.invalidateQueries({ queryKey: ['admin-shop'] });
      return true;
    } catch (err: any) {
      setMsg({ text: err?.message || '操作失败', severity: 'error' });
      return false;
    }
  };

  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h5" sx={{ mb: 2 }}>商城与礼物</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="积分商城商品" />
        <Tab label="兑换单" />
        <Tab label="直播礼物" />
      </Tabs>

      {tab === 0 && (
        <>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setItem({ ...EMPTY_ITEM })} sx={{ mb: 2 }}>
            新建商品
          </Button>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>商品</TableCell>
                  <TableCell>分类</TableCell>
                  <TableCell align="right">积分</TableCell>
                  <TableCell align="right">库存</TableCell>
                  <TableCell align="right">已兑</TableCell>
                  <TableCell>发放</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {(itemsQ.data ?? []).map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.emoji} {it.name}</TableCell>
                    <TableCell>{CATEGORY_LABEL[it.category]}</TableCell>
                    <TableCell align="right">{it.points}</TableCell>
                    <TableCell align="right">{it.stock < 0 ? '不限' : it.stock}</TableCell>
                    <TableCell align="right">{it.totalRedeemed ?? 0}</TableCell>
                    <TableCell>{it.deliverType === 'diamond' ? `钻石 ${yuan(it.deliverAmount)}` : '实物发货'}</TableCell>
                    <TableCell><Chip size="small" label={it.status === 'active' ? '上架' : '下架'} color={it.status === 'active' ? 'success' : 'default'} /></TableCell>
                    <TableCell><Button size="small" onClick={() => setItem({ ...it })}>编辑</Button></TableCell>
                  </TableRow>
                ))}
                {itemsQ.data?.length === 0 && (
                  <TableRow><TableCell colSpan={8} sx={{ color: 'text.secondary' }}>还没有商品,前台积分商城为空</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {tab === 1 && (
        <>
          <TextField select size="small" label="状态" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ mb: 2, minWidth: 160 }}>
            <MenuItem value="">全部</MenuItem>
            {Object.entries(REDEMPTION_STATUS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </TextField>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>单号</TableCell>
                  <TableCell>用户</TableCell>
                  <TableCell>商品</TableCell>
                  <TableCell align="right">积分</TableCell>
                  <TableCell>收货信息</TableCell>
                  <TableCell>物流</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>时间</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {(redemptionsQ.data ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{r.serial}</TableCell>
                    <TableCell>{r.userId}</TableCell>
                    <TableCell>{r.itemName}</TableCell>
                    <TableCell align="right">{r.points}</TableCell>
                    <TableCell sx={{ maxWidth: 240, whiteSpace: 'pre-wrap' }}>{r.address || '-'}</TableCell>
                    <TableCell>{r.tracking || '-'}</TableCell>
                    <TableCell>{REDEMPTION_STATUS[r.status]}</TableCell>
                    <TableCell>{new Date(r.redeemedAt).toLocaleString('zh-CN', { hour12: false })}</TableCell>
                    <TableCell>
                      {r.status === 'pending' && (
                        <Button size="small" onClick={() => { setShipTarget(r); setTracking(''); }}>发货</Button>
                      )}
                      {r.status === 'shipped' && (
                        <Button size="small" onClick={() => run(() => completeRedemption(r.id), '已确认完成')}>确认完成</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {redemptionsQ.data?.length === 0 && (
                  <TableRow><TableCell colSpan={9} sx={{ color: 'text.secondary' }}>没有兑换单</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {tab === 2 && (
        <>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setGift({ ...EMPTY_GIFT })} sx={{ mb: 2 }}>
            新建礼物
          </Button>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>礼物</TableCell>
                  <TableCell align="right">单价</TableCell>
                  <TableCell>特效</TableCell>
                  <TableCell>连击</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {(giftsQ.data ?? []).map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>{g.icon} {g.name}</TableCell>
                    <TableCell align="right">{yuan(g.price)}</TableCell>
                    <TableCell>{g.effect}</TableCell>
                    <TableCell>{g.combo ? '是' : '否'}</TableCell>
                    <TableCell><Chip size="small" label={g.status === 'active' ? '上架' : '下架'} color={g.status === 'active' ? 'success' : 'default'} /></TableCell>
                    <TableCell><Button size="small" onClick={() => setGift({ ...g })}>编辑</Button></TableCell>
                  </TableRow>
                ))}
                {giftsQ.data?.length === 0 && (
                  <TableRow><TableCell colSpan={6} sx={{ color: 'text.secondary' }}>还没有礼物,直播间礼物面板为空</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* 商品编辑 */}
      <Dialog open={!!item} onClose={() => setItem(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{item?.id ? '编辑商品' : '新建商品'}</DialogTitle>
        {item && (
          <DialogContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, pt: 1 }}>
              <TextField label="名称" value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} sx={{ gridColumn: '1 / -1' }} />
              <TextField label="描述" value={item.desc} onChange={(e) => setItem({ ...item, desc: e.target.value })} multiline minRows={2} sx={{ gridColumn: '1 / -1' }} />
              <TextField select label="分类" value={item.category} onChange={(e) => setItem({ ...item, category: e.target.value as AdminMallItem['category'] })}>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
              <TextField label="标签(HOT / NEW / 限时 / 独家)" value={item.tag} onChange={(e) => setItem({ ...item, tag: e.target.value })} />
              <TextField label="图标 emoji" value={item.emoji} onChange={(e) => setItem({ ...item, emoji: e.target.value })} />
              <TextField label="背景渐变 CSS" value={item.gradient} onChange={(e) => setItem({ ...item, gradient: e.target.value })} />
              <TextField label="兑换积分" type="number" value={item.points} onChange={(e) => setItem({ ...item, points: num(e.target.value) })} />
              <TextField label="原价积分(可空)" type="number" value={item.originalPoints} onChange={(e) => setItem({ ...item, originalPoints: num(e.target.value) })} />
              <TextField label="库存(-1 不限)" type="number" value={item.stock} onChange={(e) => setItem({ ...item, stock: num(e.target.value) })} />
              <TextField label="排序" type="number" value={item.sort} onChange={(e) => setItem({ ...item, sort: num(e.target.value) })} />
              <TextField select label="发放方式" value={item.deliverType} onChange={(e) => setItem({ ...item, deliverType: e.target.value as AdminMallItem['deliverType'] })}>
                <MenuItem value="diamond">兑换后发钻石到钱包</MenuItem>
                <MenuItem value="physical">实物,人工发货</MenuItem>
              </TextField>
              <TextField
                label="发放钻石金额(元)"
                type="number"
                disabled={item.deliverType !== 'diamond'}
                value={item.deliverAmount / 100}
                onChange={(e) => setItem({ ...item, deliverAmount: Math.round(num(e.target.value) * 100) })}
              />
              <FormControlLabel
                control={<Switch checked={item.status === 'active'} onChange={(e) => setItem({ ...item, status: e.target.checked ? 'active' : 'offline' })} />}
                label="上架"
              />
            </Box>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setItem(null)}>取消</Button>
          <Button variant="contained" onClick={async () => { if (item && (await run(() => saveMallItem(item), '已保存'))) setItem(null); }}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* 礼物编辑 */}
      <Dialog open={!!gift} onClose={() => setGift(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{gift?.id ? '编辑礼物' : '新建礼物'}</DialogTitle>
        {gift && (
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField label="名称" value={gift.name} onChange={(e) => setGift({ ...gift, name: e.target.value })} />
              <TextField label="图标 emoji" value={gift.icon} onChange={(e) => setGift({ ...gift, icon: e.target.value })} />
              <TextField
                label="单价(元)"
                type="number"
                value={gift.price / 100}
                onChange={(e) => setGift({ ...gift, price: Math.round(num(e.target.value) * 100) })}
                helperText="观众从钱包支付,主播到账扣除平台服务费"
              />
              <TextField select label="特效" value={gift.effect} onChange={(e) => setGift({ ...gift, effect: e.target.value as AdminGift['effect'] })}>
                {EFFECTS.map((e) => <MenuItem key={e} value={e}>{e}</MenuItem>)}
              </TextField>
              <TextField label="排序" type="number" value={gift.sort} onChange={(e) => setGift({ ...gift, sort: num(e.target.value) })} />
              <FormControlLabel control={<Switch checked={gift.combo} onChange={(e) => setGift({ ...gift, combo: e.target.checked })} />} label="支持连击" />
              <FormControlLabel
                control={<Switch checked={gift.status === 'active'} onChange={(e) => setGift({ ...gift, status: e.target.checked ? 'active' : 'offline' })} />}
                label="上架"
              />
            </Box>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setGift(null)}>取消</Button>
          <Button variant="contained" onClick={async () => { if (gift && (await run(() => saveGift(gift), '已保存'))) setGift(null); }}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* 发货 */}
      <Dialog open={!!shipTarget} onClose={() => setShipTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>发货 · {shipTarget?.itemName}</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2, whiteSpace: 'pre-wrap' }}>{shipTarget?.address}</Typography>
          <TextField label="物流单号" value={tracking} onChange={(e) => setTracking(e.target.value)} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShipTarget(null)}>取消</Button>
          <Button
            variant="contained"
            onClick={async () => { if (shipTarget && (await run(() => shipRedemption(shipTarget.id, tracking.trim()), '已发货'))) setShipTarget(null); }}
          >
            确认发货
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!msg} autoHideDuration={3000} onClose={() => setMsg(null)} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={msg?.severity ?? 'success'} sx={{ width: '100%' }}>{msg?.text}</Alert>
      </Snackbar>
    </Box>
  );
}
