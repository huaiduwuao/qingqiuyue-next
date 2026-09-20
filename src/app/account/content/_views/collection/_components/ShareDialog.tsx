'use client';

// 合集分享对话框:在创作者中心的「合集管理」里,⋮ 菜单或卡片上的分享图标
// 触发。统一处理公开 / 私密合集的分享入口 —— 公开合集保留原有的
// `/playlist?id=` 链接复制;私密合集通过分享 token 走 `/my-list/shared?token=`。
//
// 三件事:
//   1. 开启 / 重置 / 关闭 私密分享链接
//   2. 复制链接(公开 / 私密都各自合适的 URL)
//   3. 设置解锁价格(钻,0 = 免费)
//
// 后端:internal/handler/my_list_share.go 的 share-token / price 接口;
// 路由调用见 src/apis/my-list.ts 的 createShareToken / deleteShareToken / setListPrice。

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
  createShareToken,
  deleteShareToken,
  setListPrice,
  type MyListItem,
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
    return `${base}/playlist?id=${encodeURIComponent(String(target.id))}`;
  }, [target]);

  // 复制后给个 1.2s 的视觉反馈
  const [copied, setCopied] = useState(false);

  // 价格输入 —— 独立于后端返回值,只在「保存」时提交
  const [priceInput, setPriceInput] = useState<string>('');

  // 关闭确认(防误点)
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    if (open && target) {
      setPriceInput(target.price > 0 ? String(target.price) : '');
      setConfirmClose(false);
      setCopied(false);
    }
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
    onError: (e: any) => onSnack(formatApiError(e) || '开启失败'),
  });

  const resetM = useMutation({
    mutationFn: () => createShareToken(target!.id),
    onSuccess: () => {
      onChanged();
      qc.invalidateQueries({ queryKey: ['creator-collections'] });
      onSnack('链接已重置,旧链接立即失效');
    },
    onError: (e: any) => onSnack(formatApiError(e) || '重置失败'),
  });

  const disableM = useMutation({
    mutationFn: () => deleteShareToken(target!.id),
    onSuccess: () => {
      onChanged();
      qc.invalidateQueries({ queryKey: ['creator-collections'] });
      onSnack('已关闭分享');
      setConfirmClose(false);
    },
    onError: (e: any) => onSnack(formatApiError(e) || '关闭失败'),
  });

  const priceM = useMutation({
    mutationFn: (price: number) => setListPrice(target!.id, price),
    onSuccess: (res, price) => {
      onChanged();
      qc.invalidateQueries({ queryKey: ['creator-collections'] });
      const shown = res?.price ?? price;
      onSnack(shown === 0 ? '价格已清空(免费)' : `价格已设为 ${shown} 钻`);
    },
    onError: (e: any) => onSnack(formatApiError(e) || '设置失败'),
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

  const handleSavePrice = () => {
    const n = Number(priceInput);
    if (!Number.isFinite(n) || n < 0) {
      onSnack('价格需为非负整数(钻)');
      return;
    }
    priceM.mutate(Math.floor(n));
  };

  if (!target) return null;

  const hasShare = !!target.shareToken;
  const isBusy = enableM.isPending || resetM.isPending || disableM.isPending || priceM.isPending;

  return (
    <>
      <Dialog open={open} onClose={isBusy ? undefined : onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
          {target.isPublic ? (
            <PublicRoundedIcon fontSize="small" sx={{ color: 'success.main' }} />
          ) : (
            <LockOutlinedIcon fontSize="small" sx={{ color: 'warning.main' }} />
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600 }} noWrap>
              分享合集:{target.name}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
              当前状态:{target.isPublic ? '公开 — 任何人都能在歌单广场看到' : '私密 — 只能凭链接访问'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose} disabled={isBusy}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2 }}>
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

              <Divider />

              {/* 公开合集也能设价格(配合 share-token 工作),保留公开的复制入口 */}
              <Box>
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>
                  解锁价格(钻,0 = 免费)
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    type="number"
                    size="small"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    placeholder={target.price > 0 ? String(target.price) : '0'}
                    slotProps={{ htmlInput: { min: 0, step: 1 } }}
                    sx={{ width: 160 }}
                  />
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleSavePrice}
                    disabled={isBusy || priceInput === ''}
                    sx={{ textTransform: 'none' }}
                  >
                    保存价格
                  </Button>
                </Stack>
                <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>
                  设价后,链接访问者需先消耗钻石解锁才能查看完整内容。免费(0)直接可见。
                </Typography>
              </Box>
            </Stack>
          ) : (
            // ─── 未开启 ───
            <Stack spacing={2}>
              <Alert severity="info" sx={{ fontSize: 12 }}>
                {target.isPublic
                  ? '当前合集是公开的,任何人都能在歌单广场找到。这里再开启「私密链接」可让指定访客凭链接访问,适合给少数人定向分享。'
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

              {/* 公开合集也能复制 /playlist?id= */}
              {target.isPublic && (
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