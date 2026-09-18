'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import AddIcon from '@mui/icons-material/Add';
import {
  COSMETIC_LABEL,
  addressText,
  deleteAddress,
  equipCosmetic,
  getAddresses,
  getGrowthSummary,
  getMyCosmetics,
  getRegions,
  saveAddress,
  signIn,
  type CosmeticKind,
  type UserAddress,
  type UserCosmetic,
} from '@/apis/growth';
import { decorBackground, invalidateDecor } from '@/lib/decor';

const card = { p: 2.5, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' } as const;

// ==================== 签到 + 等级进度 ====================

export function SignCard({ userId }: { userId: number | string }) {
  const qc = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['growth-summary', userId], queryFn: getGrowthSummary, enabled: !!userId });
  const g = q.data;
  const sign = useMutation({
    mutationFn: signIn,
    onSuccess: (r) => {
      setToast(r.bonus > 0 ? `签到成功 +${r.points} 积分(含连续 ${r.seriesDays} 天奖励 ${r.bonus})` : `签到成功 +${r.points} 积分 · 已连续 ${r.seriesDays} 天`);
      qc.invalidateQueries({ queryKey: ['growth-summary', userId] });
      qc.invalidateQueries({ queryKey: ['user-point', userId] });
      qc.invalidateQueries({ queryKey: ['user-point-records'] });
    },
    onError: (e: any) => setToast(e?.message || '签到失败'),
  });
  if (!g) return null;
  const span = g.nextMin ? g.nextMin - g.levelMin : 1;
  const progress = g.nextMin ? Math.min(100, Math.round(((g.totalPoint - g.levelMin) / span) * 100)) : 100;
  return (
    <Box sx={{ ...card, display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
      <Box sx={{ flex: 1, minWidth: 220 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: 'warning.main' }}>Lv{g.level}</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{g.levelName}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', ml: 'auto' }}>
            {g.nextMin ? `距 Lv${g.nextLevel} ${g.nextLevelName} 还差 ${(g.nextMin - g.totalPoint).toLocaleString()} 积分` : '已达最高等级'}
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={progress} color="warning" sx={{ mt: 1, height: 6, borderRadius: 3 }} />
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
          {g.seriesDays > 0 ? `已连续签到 ${g.seriesDays} 天` : '今天开始连续签到'} · 累计 {g.totalDays} 天 · 连续 7 天、30 天有额外积分
        </Typography>
      </Box>
      <Button
        variant="contained"
        startIcon={<EventAvailableRoundedIcon />}
        disabled={g.signed || sign.isPending}
        onClick={() => sign.mutate()}
        sx={{ borderRadius: 2, textTransform: 'none', minWidth: 120 }}
      >
        {g.signed ? '今日已签到' : '签到领积分'}
      </Button>
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
}

// ==================== 我的装扮 ====================

function CosmeticPreview({ c }: { c: UserCosmetic }) {
  if (c.kind === 'avatar_frame') {
    return (
      <Box sx={{ width: 56, height: 56, borderRadius: '50%', p: '4px', background: decorBackground(c.value), flexShrink: 0 }}>
        <Box sx={{ width: '100%', height: '100%', borderRadius: '50%', bgcolor: 'background.default' }} />
      </Box>
    );
  }
  if (c.kind === 'title') return <Chip size="small" label={c.value} sx={{ color: '#fff', background: 'linear-gradient(135deg, #8B5CF6 0%, #5B8DEF 100%)' }} />;
  const gradient = c.value.includes('gradient');
  return (
    <Typography sx={{ fontWeight: 700, ...(gradient ? { background: c.value, WebkitBackgroundClip: 'text', color: 'transparent' } : { color: c.value }) }}>
      我的昵称
    </Typography>
  );
}

export function WardrobeTab({ userId, onGoMall }: { userId: number | string; onGoMall: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-cosmetics', userId], queryFn: getMyCosmetics, enabled: !!userId });
  const equip = useMutation({
    mutationFn: equipCosmetic,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-cosmetics', userId] });
      invalidateDecor(userId);
    },
  });
  const list = q.data ?? [];
  if (q.isSuccess && list.length === 0) {
    return (
      <Box sx={{ ...card, textAlign: 'center', py: 5 }}>
        <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 2 }}>还没有装扮。头像框、称号、名字颜色可以在商城用积分兑换,也会随成就解锁。</Typography>
        <Button variant="contained" onClick={onGoMall} sx={{ borderRadius: 2, textTransform: 'none' }}>去商城看看</Button>
      </Box>
    );
  }
  const now = Date.now();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {(Object.keys(COSMETIC_LABEL) as CosmeticKind[]).map((kind) => {
        const items = list.filter((c) => c.kind === kind);
        if (items.length === 0) return null;
        return (
          <Box key={kind}>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>{COSMETIC_LABEL[kind]}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1.5 }}>
              {items.map((c) => {
                const expired = !!c.expiresAt && new Date(c.expiresAt).getTime() < now;
                return (
                  <Box key={c.id} sx={{ ...card, p: 2, display: 'flex', alignItems: 'center', gap: 1.5, opacity: expired ? 0.5 : 1, borderColor: c.equipped ? 'primary.main' : 'divider' }}>
                    <CosmeticPreview c={c} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap>{c.name}</Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                        {c.source === 'achievement' ? '成就奖励' : '商城兑换'} · {expired ? '已过期' : c.expiresAt ? `${new Date(c.expiresAt).toLocaleDateString('zh-CN')} 到期` : '永久'}
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      variant={c.equipped ? 'outlined' : 'contained'}
                      disabled={expired || equip.isPending}
                      onClick={() => equip.mutate(c.equipped ? { kind: c.kind } : { id: c.id })}
                      sx={{ borderRadius: 2, textTransform: 'none', flexShrink: 0 }}
                    >
                      {c.equipped ? '摘下' : '佩戴'}
                    </Button>
                  </Box>
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// ==================== 收货地址 ====================

const EMPTY_ADDRESS: UserAddress = { receiver: '', phone: '', detail: '', isDefault: false };

export function AddressTab({ userId }: { userId: number | string }) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<UserAddress | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['user-address', userId], queryFn: getAddresses, enabled: !!userId });
  const provinces = useQuery({ queryKey: ['region', 'provinces'], queryFn: () => getRegions('provinces'), staleTime: Infinity });
  const cities = useQuery({
    queryKey: ['region', 'cities', edit?.provinceCode],
    queryFn: () => getRegions('cities', edit?.provinceCode),
    enabled: !!edit?.provinceCode,
    staleTime: Infinity,
  });
  const areas = useQuery({
    queryKey: ['region', 'areas', edit?.cityCode],
    queryFn: () => getRegions('areas', edit?.cityCode),
    enabled: !!edit?.cityCode,
    staleTime: Infinity,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['user-address', userId] });
  const save = useMutation({
    mutationFn: saveAddress,
    onSuccess: () => { refresh(); setEdit(null); },
    onError: (e: any) => setToast(e?.message || '保存失败'),
  });
  const remove = useMutation({ mutationFn: deleteAddress, onSuccess: refresh });
  const list = q.data ?? [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEdit({ ...EMPTY_ADDRESS })} sx={{ borderRadius: 2, textTransform: 'none' }}>
          新增收货地址
        </Button>
      </Box>
      {q.isSuccess && list.length === 0 && (
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>还没有收货地址。兑换或购买实物商品时需要用到。</Typography>
      )}
      {list.map((a) => (
        <Box key={a.id} sx={{ ...card, p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              {a.receiver} <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', ml: 1 }}>{a.phone}</Box>
              {a.isDefault && <Chip size="small" label="默认" color="primary" sx={{ ml: 1, height: 18, fontSize: 10 }} />}
            </Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>{`${a.province ?? ''}${a.city ?? ''}${a.area ?? ''}${a.detail}`}</Typography>
          </Box>
          <Button size="small" onClick={() => setEdit({ ...a })} sx={{ textTransform: 'none' }}>编辑</Button>
          <Button size="small" color="error" onClick={() => a.id && remove.mutate(a.id)} sx={{ textTransform: 'none' }}>删除</Button>
        </Box>
      ))}

      <Dialog open={!!edit} onClose={() => setEdit(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{edit?.id ? '编辑收货地址' : '新增收货地址'}</DialogTitle>
        {edit && (
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField label="收货人" size="small" value={edit.receiver} onChange={(e) => setEdit({ ...edit, receiver: e.target.value })} />
              <TextField label="联系电话" size="small" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
              <TextField
                select
                label="省 / 直辖市"
                size="small"
                value={edit.provinceCode ?? ''}
                onChange={(e) => {
                  const p = provinces.data?.find((r) => r.code === e.target.value);
                  setEdit({ ...edit, provinceCode: p?.code, province: p?.name, cityCode: undefined, city: undefined, areaCode: undefined, area: undefined });
                }}
              >
                {(provinces.data ?? []).map((r) => <MenuItem key={r.code} value={r.code}>{r.name}</MenuItem>)}
              </TextField>
              {(cities.data?.length ?? 0) > 0 && (
                <TextField
                  select
                  label="市"
                  size="small"
                  value={edit.cityCode ?? ''}
                  onChange={(e) => {
                    const c = cities.data?.find((r) => r.code === e.target.value);
                    // 直辖市的"市"和省同名,不重复写进地址
                    setEdit({ ...edit, cityCode: c?.code, city: c?.name === edit.province ? '' : c?.name, areaCode: undefined, area: undefined });
                  }}
                >
                  {(cities.data ?? []).map((r) => <MenuItem key={r.code} value={r.code}>{r.name}</MenuItem>)}
                </TextField>
              )}
              {(areas.data?.length ?? 0) > 0 && (
                <TextField
                  select
                  label="区 / 县"
                  size="small"
                  value={edit.areaCode ?? ''}
                  onChange={(e) => {
                    const a = areas.data?.find((r) => r.code === e.target.value);
                    setEdit({ ...edit, areaCode: a?.code, area: a?.name });
                  }}
                >
                  {(areas.data ?? []).map((r) => <MenuItem key={r.code} value={r.code}>{r.name}</MenuItem>)}
                </TextField>
              )}
              <TextField
                label="详细地址"
                size="small"
                multiline
                minRows={2}
                value={edit.detail}
                onChange={(e) => setEdit({ ...edit, detail: e.target.value })}
                helperText="上面选不到的市、区县请直接写在这里"
              />
              <FormControlLabel control={<Switch checked={!!edit.isDefault} onChange={(e) => setEdit({ ...edit, isDefault: e.target.checked })} />} label="设为默认地址" />
              <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>预览:{addressText(edit)}</Typography>
            </Box>
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setEdit(null)}>取消</Button>
          <Button variant="contained" disabled={save.isPending} onClick={() => edit && save.mutate(edit)}>保存</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} message={toast} />
    </Box>
  );
}
