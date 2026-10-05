'use client';

// 合集分享 / 可见性对话框:在创作者中心的「合集管理」里,⋮ 菜单或卡片上的分享图标触发。
//
// 三件事:
//   1. 可见性:公开 / 仅链接 / 私密 / 付费(付费填钻石价,需创作者 Lv4,不够时显示后端给的当前 / 所需等级)
//   2. 开启 / 重置 / 关闭 私密分享链接(`/my-list/shared?token=`)
//   3. 复制链接:公开 / 付费合集用合集详情页 `/collections/detail?id=`
//
// 付费合集公开可列出(合集广场、主页),别人只看得到前 3 个作品,买断后看全部,
// 并一并解锁合集里你本人发布的付费作品。
//
// 后端:internal/handler/my_list_share.go 的 share-token / price 接口 + PUT /my-list/:id(isPublic);
// 路由调用见 src/apis/my-list.ts 的 createShareToken / deleteShareToken / setListPrice / updateMyList。

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import {
  COLLECTION_MAX_PRICE,
  COLLECTION_PREVIEW_ITEMS,
  collectionHref,
  createShareToken,
  deleteShareToken,
  setListPrice,
  updateMyList,
  type CollectionVisibility,
} from '@/apis/my-list';
import { formatApiError } from '@/lib/api/client';

/** 内部 prop:承接 page.tsx 里的 Collection(轻量本地模型)。 */
export interface ShareTarget {
  id: string | number;
  name: string;
  isPublic: boolean;
  /** 后端 MyListItem 上的 shareToken;undefined/null 表示没开过。 */
  shareToken?: string | null;
  /** 当前价格(钻)。 */
  price: number;
}

interface Props {
  open: boolean;
  /** null 时对话框不渲染内容。 */
  target: ShareTarget | null;
  onClose: () => void;
  /**
   * 操作成功后(开/关/改价)通知父组件刷新列表。
   * 父组件收到后可顺手把后端返回的最新 shareToken / price 回灌到本地 target,
   * 但更简单是直接 invalidateQuery 让 React Query 重新拉取。
   */
  onChanged: () => void;
  /** 顶 snackbar,文案走父组件统一风格。 */
  onSnack: (msg: string) => void;
}

const VISIBILITY_OPTIONS: { v: CollectionVisibility; label: string; desc: string }[] = [
  { v: 'public', label: '公开', desc: '广场可见,全部可看' },
  { v: 'link', label: '仅链接', desc: '凭链接访问' },
  { v: 'private', label: '私密', desc: '只有自己' },
  { v: 'paid', label: '付费', desc: '预览 + 钻石买断' },
];

const VISIBILITY_HINT: Record<CollectionVisibility, string> = {
  public: '公开 — 任何人都能在合集广场看到',
  link: '仅链接 — 只有拿到链接的人能看',
  private: '私密 — 只有你自己能看',
  paid: '付费 — 公开可见,买断后看全部',
};

export default function ShareDialog({ open, target, onClose, onChanged, onSnack }: Props) {
  const qc = useQueryClient();

  // ─── 派生状态 ───
  const shareUrl = useMemo(() => {
    if (!target?.shareToken) return '';
    if (typeof window === 'undefined') return `/my-list/shared?token=${target.shareToken}`;
    return `${window.location.origin}/my-list/shared?token=${target.shareToken}`;
  }, [target?.shareToken]);

  const playlistUrl = useMemo(() => {
    if (!target) return '';
    const base = typeof window === 'undefined' ? '' : window.location.origin;
    return `${base}${collectionHref(target.id)}`;
  }, [target]);

  const currentVisibility: CollectionVisibility = !target
    ? 'private'
    : target.price > 0
      ? 'paid'
      : target.isPublic
        ? 'public'
        : target.shareToken
          ? 'link'
          : 'private';
  const [visibility, setVisibility] = useState<CollectionVisibility>(currentVisibility);
  const [visError, setVisError] = useState('');

  // 复制后给个 1.2s 的视觉反馈
  const [copied, setCopied] = useState(false);

  // 价格输入 —— 独立于后端返回值,只在「保存」时提交
  const [priceInput, setPriceInput] = useState<string>('');

  // 关闭确认(防误点)
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (open && target) {
      setPriceInput(target.price > 0 ? String(target.price) : '');
      setVisibility(currentVisibility);
      setVisError('');
      setConfirmClose(false);
      setCopied(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在打开或换了目标 / 价格时重置表单,target 对象本身每次渲染都是新的
  }, [open, target?.id, target?.price]);

  // ─── mutations ───
  const enableM = useMutation({
    mutationFn: () => createShareToken(target!.id),
    onSuccess: () => {
      onChanged();
      // 让 React Query 重新拉列表,刷新 shareToken 字段
      qc.invalidateQueries({ queryKey: ['creator-collections'] });
      onSnack('已开启私密分享链接');
    },
    onError: (e: unknown) => onSnack(formatApiError(e) || '开启失败'),
  });

  const resetM = useMutation({
    mutationFn: () => createShareToken(target!.id),
    onSuccess: () => {
      onChanged();
      qc.invalidateQueries({ queryKey: ['creator-collections'] });
      onSnack('链接已重置,旧链接立即失效');
    },
    onError: (e: unknown) => onSnack(formatApiError(e) || '重置失败'),
  });

  const disableM = useMutation({
    mutationFn: () => deleteShareToken(target!.id),
    onSuccess: () => {
      onChanged();
      qc.invalidateQueries({ queryKey: ['creator-collections'] });
      onSnack('已关闭分享');
      setConfirmClose(false);
    },
    onError: (e: unknown) => onSnack(formatApiError(e) || '关闭失败'),
  });

  // 可见性一次保存:付费先定价(Lv4 门槛在后端,失败就停在这里把原因显示出来);
  // 其它三种先把价格清零,再改公开 / 分享链接。
  const visibilityM = useMutation({
    mutationFn: async ({ v, price }: { v: CollectionVisibility; price: number }) => {
      const t = target!;
      if (v === 'paid') {
        await setListPrice(t.id, price);
        return;
      }
      if (t.price > 0) await setListPrice(t.id, 0);
      if (v === 'public') {
        if (!t.isPublic) await updateMyList(t.id, { isPublic: true });
        return;
      }
      if (t.isPublic) await updateMyList(t.id, { isPublic: false });
      if (v === 'link' && !t.shareToken) await createShareToken(t.id);
      if (v === 'private' && t.shareToken) await deleteShareToken(t.id);
    },
    onSuccess: (_res, { v, price }) => {
      setVisError('');
      onChanged();
      qc.invalidateQueries({ queryKey: ['creator-collections'] });
      onSnack(
        v === 'paid' ? `已设为付费合集,${price} 钻买断` : v === 'public' ? '已设为公开' : v === 'link' ? '已设为仅链接可见' : '已设为私密',
      );
    },
    onError: (e: unknown) => setVisError(formatApiError(e) || '保存失败'),
  });

  const handleCopy = async (text: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onSnack(`${label}已复制`);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      onSnack('复制失败,请手动复制');
    }
  };

  const handleSaveVisibility = () => {
    if (visibility === 'paid') {
      const n = Number(priceInput);
      // 后端 mylistpay.MaxPrice:合集买断价 1 ~ 10000 钻
      if (!Number.isInteger(n) || n < 1 || n > COLLECTION_MAX_PRICE) {
        setVisError(`价格需为 1 ~ ${COLLECTION_MAX_PRICE} 的整数(钻)`);
        return;
      }
      visibilityM.mutate({ v: 'paid', price: n });
      return;
    }
    visibilityM.mutate({ v: visibility, price: 0 });
  };

  if (!target) return null;

  const hasShare = !!target.shareToken;
  const isBusy = enableM.isPending || resetM.isPending || disableM.isPending || visibilityM.isPending;
  const visibilityDirty =
    visibility !== currentVisibility || (visibility === 'paid' && Number(priceInput) !== target.price);

  return (
    <>
      <Dialog open={open} onClose={isBusy ? undefined : onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
          {target.isPublic || target.price > 0 ? (
            <PublicRoundedIcon fontSize="small" sx={{ color: 'success.main' }} />
          ) : (
            <LockOutlinedIcon fontSize="small" sx={{ color: 'warning.main' }} />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600 }} noWrap>
              分享合集:{target.name}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              当前状态:{VISIBILITY_HINT[currentVisibility]}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} disabled={isBusy}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2 }}>
          {/* ─── 可见性 / 价格 ─── */}
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.75 }}>谁能看这个合集</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1 }}>
              {VISIBILITY_OPTIONS.map((o) => (
                <Box
                  key={o.v}
                  role="radio"
                  aria-checked={visibility === o.v}
                  tabIndex={0}
                  onClick={() => !isBusy && setVisibility(o.v)}
                  onKeyDown={(e) => e.key === 'Enter' && !isBusy && setVisibility(o.v)}
                  sx={{
                    p: 1,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    textAlign: 'center',
                    border: '1px solid',
                    borderColor: visibility === o.v ? 'primary.main' : 'divider',
                    bgcolor: visibility === o.v ? 'rgba(254, 44, 85, 0.08)' : 'transparent',
                  }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: visibility === o.v ? 'primary.main' : 'text.primary' }}>
                    {o.label}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.25 }}>{o.desc}</Typography>
                </Box>
              ))}
            </Box>
            {visibility === 'paid' && (
              <Box sx={{ mt: 1.5 }}>
                <TextField
                  type="number"
                  size="small"
                  label="买断价(钻)"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  slotProps={{ htmlInput: { min: 1, max: COLLECTION_MAX_PRICE, step: 1 } }}
                  sx={{ width: 160 }}
                />
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                  1 ~ {COLLECTION_MAX_PRICE} 钻,1 钻 = ¥0.1。付费合集会出现在合集广场和你的主页,别人可先看前 {COLLECTION_PREVIEW_ITEMS} 个作品,
                  买断后看全部,并一并解锁合集里你本人发布的付费作品。需要创作者等级 Lv4。
                </Typography>
              </Box>
            )}
            {visError && (
              <Alert severity="error" sx={{ mt: 1.5, fontSize: 12 }}>
                {visError}
              </Alert>
            )}
            <Button
              size="small"
              variant="contained"
              onClick={handleSaveVisibility}
              disabled={isBusy || !visibilityDirty}
              sx={{ mt: 1.5, textTransform: 'none' }}
            >
              {visibilityM.isPending ? '保存中…' : '保存可见性'}
            </Button>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {hasShare ? (
            // ─── 已开启 ───
            <Stack spacing={2}>
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
                  私密分享链接
                </Typography>
                <TextField
                  value={shareUrl}
                  size="small"
                  fullWidth
                  slotProps={{
                    htmlInput: { readOnly: true, 'aria-label': '分享链接' },
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockOutlinedIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip title={copied ? '已复制' : '复制'}>
                            <IconButton
                              size="small"
                              onClick={() => handleCopy(shareUrl, '链接')}
                              edge="end"
                            >
                              <ContentCopyRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    },
                  }}
                  sx={{ '& input': { fontSize: 13, fontFamily: 'monospace' } }}
                />
              </Box>

              <Alert severity="warning" sx={{ fontSize: 12 }}>
                链接包含访问令牌,任何拿到链接的人都能查看合集内容。请勿公开发布到论坛/群聊;如怀疑泄露,点「重新生成」让旧链接失效。
              </Alert>

              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RefreshRoundedIcon />}
                  onClick={() => resetM.mutate()}
                  disabled={isBusy}
                  sx={{ textTransform: 'none' }}
                >
                  重新生成
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => setConfirmClose(true)}
                  disabled={isBusy}
                  sx={{ textTransform: 'none' }}
                >
                  关闭分享
                </Button>
              </Stack>

            </Stack>
          ) : (
            // ─── 未开启 ───
            <Stack spacing={2}>
              <Alert severity="info" sx={{ fontSize: 12 }}>
                {target.isPublic || target.price > 0
                  ? '当前合集是公开可见的,任何人都能在合集广场找到。这里再开启「私密链接」可让指定访客凭链接直达。'
                  : '当前合集是私密的,只有你自己能看到。开启后系统会生成一个含访问令牌的链接,把它发给指定的人就能访问。'}
              </Alert>

              <Button
                size="large"
                variant="contained"
                startIcon={<LockOutlinedIcon />}
                onClick={() => enableM.mutate()}
                disabled={isBusy}
                sx={{
                  textTransform: 'none',
                  background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                  '&:hover': {
                    background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                    filter: 'brightness(1.1)',
                  },
                }}
              >
                开启私密分享链接
              </Button>

              <Divider />

              {/* 公开 / 付费合集复制合集详情页链接 */}
              {(target.isPublic || target.price > 0) && (
                <Box>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
                    公开页面链接
                  </Typography>
                  <TextField
                    value={playlistUrl}
                    size="small"
                    fullWidth
                    slotProps={{
                      htmlInput: { readOnly: true, 'aria-label': '公开链接' },
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <PublicRoundedIcon sx={{ fontSize: 16, color: 'success.main' }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            <Tooltip title={copied ? '已复制' : '复制'}>
                              <IconButton
                                size="small"
                                onClick={() => handleCopy(playlistUrl, '公开链接')}
                                edge="end"
                              >
                                <ContentCopyRoundedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </InputAdornment>
                        ),
                      },
                    }}
                    sx={{ '& input': { fontSize: 13, fontFamily: 'monospace' } }}
                  />
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={onClose} disabled={isBusy} sx={{ textTransform: 'none' }}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>

      {/* 关闭分享的二次确认 */}
      <Dialog open={confirmClose} onClose={() => setConfirmClose(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 14 }}>确认关闭分享?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13 }}>
            关闭后,当前链接立即失效,任何拿到旧链接的人都将无法再访问该合集。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClose(false)} sx={{ textTransform: 'none' }} disabled={disableM.isPending}>
            取消
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => disableM.mutate()}
            disabled={disableM.isPending}
            sx={{ textTransform: 'none' }}
          >
            确认关闭
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}