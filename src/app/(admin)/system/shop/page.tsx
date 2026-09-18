'use client';

import React, { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
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
import type { GridColDef } from '@mui/x-data-grid';
import { DataGridTable } from '@/components/tables/DataGridTable';
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
 * 商城与礼物:商城商品、订单发货、礼物目录。
 * 每个商品只标一种货币:装扮只收积分、兑换后立即到账;实物可标积分或钻石、需要发货。
 * 假人的实物订单由后端仓库流程自动发货,真人订单在这里人工发。
 * 商品与礼物只能下架不能删除(订单和送礼记录要能追溯到它们)。
 *
 * 后端 admin shop 接口(2026-09)不分页——一次 SELECT 全表。前端统一走 DataGridTable,
 * 这里在 fetchData 里把全量结果按 pageNumber/pageSize 切片,totalRow 用全量长度。
 * 这样所有后台表格共用同一套交互/筛选/loading 体验,不需要每个页面写一遍分页。
 */

const CATEGORY_LABEL: Record<AdminMallItem['category'], string> = {
  virtual: '虚拟权益',
  privilege: '平台特权',
  physical: '实物礼品',
  limited: '限定收藏',
};
const REDEMPTION_STATUS: Record<AdminRedemption['status'], string> = { pending: '待发货', shipped: '已发货', completed: '已完成' };
const EFFECTS: AdminGift['effect'][] = ['small', 'medium', 'large', 'huge'];
const DELIVER_LABEL: Record<AdminMallItem['deliverType'], string> = {
  physical: '实物发货',
  avatar_frame: '头像框',
  title: '称号',
  name_color: '名字颜色',
};
const EMPTY_ITEM: AdminMallItem = {
  name: '', desc: '', category: 'virtual', emoji: '🎁', gradient: 'linear-gradient(135deg, #FE2C55 0%, #FFB400 100%)',
  points: 100, originalPoints: 0, stock: -1, tag: '', currency: 'point', priceCents: 0,
  deliverType: 'avatar_frame', cosmeticValue: 'linear-gradient(135deg, #25F4EE 0%, #5B8DEF 100%)', durationDays: 0, status: 'active', sort: 0,
};
const EMPTY_GIFT: AdminGift = { name: '', icon: '🌹', price: 100, effect: 'small', combo: false, status: 'active', sort: 0 };

const priceLabel = (it: { currency: 'point' | 'diamond'; points: number; priceCents?: number; amountCents?: number }) =>
  it.currency === 'diamond' ? `${Math.floor((it.priceCents ?? it.amountCents ?? 0) / 10)} 钻石` : `${it.points} 积分`;
const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;
const num = (v: string) => (v === '' ? 0 : Number(v));

/** 把全量结果切片成 DataGridTable 期望的 {records, totalRow}。 */
function sliceAll<T>(all: T[], pageNumber: number, pageSize: number) {
  const totalRow = all.length;
  const start = (pageNumber - 1) * pageSize;
  const records = all.slice(start, start + pageSize);
  return { records, totalRow };
}

export default function SystemShopPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [msg, setMsg] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);
  const [item, setItem] = useState<AdminMallItem | null>(null);
  const [gift, setGift] = useState<AdminGift | null>(null);
  const [shipTarget, setShipTarget] = useState<AdminRedemption | null>(null);
  const [tracking, setTracking] = useState('');

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

  // 全量缓存:fetches 引用同一份数据,只在 extraParams 变化时重新拉。
  // 用 module 级 cache 避免每次 fetchData 都重新打后端。
  const itemsAll = React.useRef<AdminMallItem[]>([]);
  const redemptionsAll = React.useRef<AdminRedemption[]>([]);
  const giftsAll = React.useRef<AdminGift[]>([]);

  const fetchItems = useCallback(async (params: { pageNumber: number; pageSize: number }) => {
    itemsAll.current = await listMallItems();
    return sliceAll(itemsAll.current, params.pageNumber, params.pageSize);
  }, []);
  const fetchRedemptions = useCallback(async (params: { pageNumber: number; pageSize: number }) => {
    redemptionsAll.current = await listRedemptions();
    return sliceAll(redemptionsAll.current, params.pageNumber, params.pageSize);
  }, []);
  const fetchGifts = useCallback(async (params: { pageNumber: number; pageSize: number }) => {
    giftsAll.current = await listGifts();
    return sliceAll(giftsAll.current, params.pageNumber, params.pageSize);
  }, []);

  const itemsColumns: GridColDef[] = [
    { field: 'name', headerName: '商品', flex: 1.5, minWidth: 180, renderCell: (p) => `${(p.row as AdminMallItem).emoji} ${p.value}` },
    { field: 'category', headerName: '分类', width: 110, valueFormatter: (v) => CATEGORY_LABEL[v as AdminMallItem['category']] },
    { field: 'price', headerName: '标价', type: 'number', width: 100, align: 'right', headerAlign: 'right',
      valueGetter: (_, row) => priceLabel(row as AdminMallItem), sortable: false },
    { field: 'stock', headerName: '库存', type: 'number', width: 90, align: 'right', headerAlign: 'right',
      valueGetter: (_, row) => (row as AdminMallItem).stock < 0 ? '不限' : (row as AdminMallItem).stock },
    { field: 'totalRedeemed', headerName: '已兑', type: 'number', width: 80, align: 'right', headerAlign: 'right',
      valueGetter: (_, row) => (row as AdminMallItem).totalRedeemed ?? 0 },
    { field: 'deliver', headerName: '发放', flex: 1.2, minWidth: 140, sortable: false,
      valueGetter: (_, row) => {
        const r = row as AdminMallItem;
        return `${DELIVER_LABEL[r.deliverType] ?? '已停用'}${r.durationDays ? ` · ${r.durationDays} 天` : ''}`;
      } },
    { field: 'status', headerName: '状态', width: 90,
      renderCell: (p) => <Chip size="small" label={p.value === 'active' ? '上架' : '下架'}
        color={p.value === 'active' ? 'success' : 'default'} /> },
  ];

  const redemptionsColumns: GridColDef[] = [
    { field: 'serial', headerName: '单号', width: 200, renderCell: (p) => <Box sx={{ fontFamily: 'monospace', fontSize: 12 }}>{p.value}</Box> },
    { field: 'user', headerName: '用户', width: 130, sortable: false,
      renderCell: (p) => {
        const r = p.row as AdminRedemption;
        return <>{r.userId}{(r as any).isBot && <Chip size="small" label="AI" sx={{ ml: 0.5, height: 18, fontSize: 10 }} />}</>;
      } },
    { field: 'itemName', headerName: '商品', flex: 1, minWidth: 140 },
    { field: 'price', headerName: '实付', width: 100, align: 'right', headerAlign: 'right', sortable: false,
      valueGetter: (_, row) => priceLabel(row as AdminRedemption) },
    { field: 'address', headerName: '收货信息', flex: 1.5, minWidth: 200,
      renderCell: (p) => <Box sx={{ maxWidth: 240, whiteSpace: 'pre-wrap', fontSize: 12 }}>{p.value || '-'}</Box> },
    { field: 'tracking', headerName: '物流', width: 160, renderCell: (p) => p.value || '-' },
    { field: 'status', headerName: '状态', width: 100,
      valueFormatter: (v) => REDEMPTION_STATUS[v as AdminRedemption['status']] },
    { field: 'redeemedAt', headerName: '时间', width: 160,
      valueFormatter: (v) => v ? new Date(v as string).toLocaleString('zh-CN', { hour12: false }) : '-' },
  ];

  const giftsColumns: GridColDef[] = [
    { field: 'name', headerName: '礼物', flex: 1, minWidth: 160, renderCell: (p) => `${(p.row as AdminGift).icon} ${p.value}` },
    { field: 'price', headerName: '单价', type: 'number', width: 100, align: 'right', headerAlign: 'right',
      valueGetter: (_, row) => yuan((row as AdminGift).price) },
    { field: 'effect', headerName: '特效', width: 100 },
    { field: 'combo', headerName: '连击', width: 80, renderCell: (p) => p.value ? '是' : '否' },
    { field: 'status', headerName: '状态', width: 90,
      renderCell: (p) => <Chip size="small" label={p.value === 'active' ? '上架' : '下架'}
        color={p.value === 'active' ? 'success' : 'default'} /> },
  ];

  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h5" sx={{ mb: 2 }}>商城与礼物</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="商城商品" />
        <Tab label="订单与发货" />
        <Tab label="礼物" />
      </Tabs>

      {tab === 0 && (
        <DataGridTable
          title="商城商品"
          columns={itemsColumns}
          fetchData={fetchItems}
          onEdit={(row) => setItem({ ...(row as AdminMallItem) })}
          toolBarRender={() => (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setItem({ ...EMPTY_ITEM })}>
              新建商品
            </Button>
          )}
        />
      )}

      {tab === 1 && (
        <DataGridTable
          title="订单与发货"
          columns={redemptionsColumns}
          fetchData={fetchRedemptions}
          customActions={[
            {
              label: '发货',
              color: 'primary',
              hidden: (row) => (row as AdminRedemption).status !== 'pending' || (row as AdminRedemption).isBot,
              onClick: (row) => { setShipTarget(row as AdminRedemption); setTracking(''); },
            },
            {
              label: '确认完成',
              color: 'success',
              hidden: (row) => (row as AdminRedemption).status !== 'shipped' || (row as AdminRedemption).isBot,
              onClick: (row) => run(() => completeRedemption((row as AdminRedemption).id), '已确认完成'),
            },
          ]}
        />
      )}

      {tab === 2 && (
        <DataGridTable
          title="礼物"
          columns={giftsColumns}
          fetchData={fetchGifts}
          onEdit={(row) => setGift({ ...(row as AdminGift) })}
          toolBarRender={() => (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setGift({ ...EMPTY_GIFT })}>
              新建礼物
            </Button>
          )}
        />
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
              <TextField
                select
                label="发放方式"
                value={item.deliverType}
                onChange={(e) => {
                  const deliverType = e.target.value as AdminMallItem['deliverType'];
                  setItem({ ...item, deliverType, currency: deliverType === 'physical' ? item.currency : 'point' });
                }}
              >
                {Object.entries(DELIVER_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{k === 'physical' ? '实物,需要发货' : `装扮 · ${v}(立即到账)`}</MenuItem>)}
              </TextField>
              <TextField
                select
                label="货币"
                value={item.currency}
                disabled={item.deliverType !== 'physical'}
                helperText={item.deliverType !== 'physical' ? '装扮只收积分' : '钻石商品计入平台商品收入'}
                onChange={(e) => setItem({ ...item, currency: e.target.value as AdminMallItem['currency'] })}
              >
                <MenuItem value="point">积分</MenuItem>
                <MenuItem value="diamond">钻石</MenuItem>
              </TextField>
              {item.currency === 'point' ? (
                <TextField label="兑换积分" type="number" value={item.points} onChange={(e) => setItem({ ...item, points: num(e.target.value) })} />
              ) : (
                <TextField
                  label="价格(钻石)"
                  type="number"
                  value={item.priceCents / 10}
                  helperText={`1 钻 = ¥0.1,合 ${yuan(item.priceCents)}`}
                  onChange={(e) => setItem({ ...item, priceCents: Math.round(num(e.target.value) * 10) })}
                />
              )}
              <TextField label="原价积分(可空)" type="number" disabled={item.currency !== 'point'} value={item.originalPoints} onChange={(e) => setItem({ ...item, originalPoints: num(e.target.value) })} />
              <TextField label="库存(-1 不限)" type="number" value={item.stock} onChange={(e) => setItem({ ...item, stock: num(e.target.value) })} />
              <TextField label="排序" type="number" value={item.sort} onChange={(e) => setItem({ ...item, sort: num(e.target.value) })} />
              {item.deliverType !== 'physical' && (
                <>
                  <TextField
                    label={item.deliverType === 'title' ? '称号文字' : '样式值(CSS 渐变 / 颜色 / 图片 URL)'}
                    value={item.cosmeticValue}
                    onChange={(e) => setItem({ ...item, cosmeticValue: e.target.value })}
                    sx={{ gridColumn: '1 / -1' }}
                  />
                  <TextField label="有效天数(0 永久)" type="number" value={item.durationDays} onChange={(e) => setItem({ ...item, durationDays: num(e.target.value) })} />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">预览</Typography>
                    {item.deliverType === 'avatar_frame' && (
                      <Box sx={{ width: 44, height: 44, borderRadius: '50%', p: '3px', background: item.cosmeticValue }}>
                        <Box sx={{ width: '100%', height: '100%', borderRadius: '50%', bgcolor: 'background.paper' }} />
                      </Box>
                    )}
                    {item.deliverType === 'title' && <Chip size="small" label={item.cosmeticValue || '称号'} />}
                    {item.deliverType === 'name_color' && (
                      <Typography sx={{ fontWeight: 700, background: item.cosmeticValue, WebkitBackgroundClip: 'text', color: 'transparent' }}>用户昵称</Typography>
                    )}
                  </Box>
                </>
              )}
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
                helperText="送礼人从钱包支付,创作者到账扣除平台服务费"
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