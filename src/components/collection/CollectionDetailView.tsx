'use client';

// 合集详情:/collections/detail?id=(按 id)与 /my-list/shared?token=(凭分享口令)共用。
//
// 付费合集(price > 0)公开可看:名称、封面、简介、条目数、作者、价格和前几个条目(预览);
// 其余条目要「用 N 钻解锁合集」买断后才给 —— 这件事服务端做(/my-list/content/page 未买断只回预览),
// 这里只负责展示。买断也一并解锁合集里作者本人的付费作品(paidWorks 个)。
// 未登录点解锁去登录;余额不足引导去 /recharge。

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import {
  getMyListContent,
  getMyListDetail,
  getSharedList,
  unlockList,
  type MyListContentItem,
  type MyListItem,
} from '@/apis/my-list';
import { formatDiamonds, getWalletBalance } from '@/apis/wallet';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { formatApiError } from '@/lib/api/client';
import { useContentNavigate } from '@/lib/contentRoute';
import { coverBackground } from '@/lib/media';
import { PlayTag } from '@/components/common/PlayTag';

const gradient = 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)';

interface Props {
  /** 按 id 打开(公开 / 付费 / 自己的合集) */
  listId?: string;
  /** 凭分享口令打开(私密合集) */
  token?: string;
  /** 回跳地址:未登录点解锁时登录完回到这里 */
  returnTo: string;
}

/** 合集详情的统一形状:按 id 和按口令两条接口拼成一样的 */
interface DetailData {
  list: MyListItem;
  unlocked: boolean;
  paidWorks: number;
}

function VisibilityChip({ list }: { list: MyListItem }) {
  const v = list.visibility ?? (list.price > 0 ? 'paid' : list.isPublic ? 'public' : 'private');
  if (v === 'paid') {
    return <Chip icon={<DiamondRoundedIcon sx={{ fontSize: 14 }} />} label={`付费合集 · ${list.price} 钻`} size="small" color="primary" />;
  }
  if (v === 'public') return <Chip icon={<PublicRoundedIcon sx={{ fontSize: 14 }} />} label="公开" size="small" />;
  if (v === 'link') return <Chip icon={<LinkRoundedIcon sx={{ fontSize: 14 }} />} label="仅链接可见" size="small" />;
  return <Chip icon={<LockOutlinedIcon sx={{ fontSize: 14 }} />} label="私密" size="small" />;
}

export default function CollectionDetailView({ listId, token, returnTo }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const navigate = useContentNavigate();
  const { user } = useAuth();
  const [snack, setSnack] = React.useState<string | null>(null);

  const detailKey = ['collection-detail', listId ?? '', token ?? '', user?.id ?? 0];
  const detailQ = useQuery({
    queryKey: detailKey,
    queryFn: async (): Promise<DetailData> => {
      if (token) {
        const r = await getSharedList(token);
        return { list: r.list, unlocked: r.unlocked, paidWorks: r.paidWorks ?? r.list.paidWorks ?? 0 };
      }
      const list = await getMyListDetail(listId!);
      const unlocked = !(list.price > 0) || !!list.unlocked || list.mine;
      return { list, unlocked, paidWorks: list.paidWorks ?? 0 };
    },
    enabled: !!(listId || token),
    retry: false,
  });
  const list = detailQ.data?.list;
  const unlocked = !!detailQ.data?.unlocked;
  const price = list?.price ?? 0;
  const paidWorks = detailQ.data?.paidWorks ?? 0;
  const paidLocked = price > 0 && !unlocked;

  // 条目:付费合集未买断时服务端只给预览那几项(locked = true,total 是全部)
  const contentQ = useQuery({
    queryKey: ['collection-content', list?.id, token ?? '', unlocked],
    queryFn: () => getMyListContent(list!.id, token),
    enabled: !!list,
    retry: false,
  });
  const rows: MyListContentItem[] = contentQ.data?.list ?? [];
  const total = contentQ.data?.total ?? list?.itemCount ?? 0;
  const hiddenCount = paidLocked ? Math.max(0, total - rows.length) : 0;

  const walletQ = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: getWalletBalance,
    enabled: !!user && paidLocked,
  });
  const balance = walletQ.data?.balance;
  const insufficient = balance != null && balance < price;

  const unlockM = useMutation({
    mutationFn: () => unlockList(list!.id),
    onSuccess: () => {
      setSnack('解锁成功');
      qc.invalidateQueries({ queryKey: ['collection-detail'] });
      qc.invalidateQueries({ queryKey: ['collection-content'] });
      qc.invalidateQueries({ queryKey: ['wallet-balance'] });
    },
    onError: (e: unknown) => {
      setSnack(formatApiError(e) || '解锁失败');
      // 余额可能在别处变了,失败后重新取一次
      qc.invalidateQueries({ queryKey: ['wallet-balance'] });
    },
  });

  const handleUnlock = () => {
    if (!user) {
      router.push(loginHref(returnTo));
      return;
    }
    unlockM.mutate();
  };

  if (detailQ.isLoading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress size={28} />
      </Container>
    );
  }
  if (detailQ.isError || !list) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="warning">{token ? '合集不存在或分享链接已关闭' : '合集不存在或未公开'}</Alert>
        <Button component={Link} href="/collections" sx={{ mt: 2, textTransform: 'none' }}>
          去合集广场看看
        </Button>
      </Container>
    );
  }

  const cover = list.coverUrl || list.covers?.[0] || '';

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 }, px: { xs: 2, md: 3 } }}>
      {/* 头部 */}
      <Box
        sx={{
          display: 'flex',
          gap: 3,
          p: { xs: 2, md: 3 },
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box
          sx={{
            width: { xs: '100%', sm: 220 },
            flexShrink: 0,
            aspectRatio: '16/9',
            borderRadius: 1.5,
            background: coverBackground(cover, 'linear-gradient(135deg, #2A2D3A 0%, #1A1C26 100%)'),
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
            <VisibilityChip list={list} />
            {price > 0 && unlocked && !list.mine && (
              <Chip icon={<LockOpenRoundedIcon sx={{ fontSize: 14 }} />} label="已解锁" size="small" color="success" />
            )}
          </Box>
          <Typography sx={{ fontSize: { xs: 18, md: 22 }, fontWeight: 700, color: 'text.primary', mb: 1, wordBreak: 'break-word' }}>
            {list.name}
          </Typography>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {list.description || '合集主还没写简介。'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {list.official ? (
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>平台精选</Typography>
            ) : list.mine ? (
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>我的合集</Typography>
            ) : list.userId > 0 ? (
              <Box
                component={Link}
                href={`/u?id=${encodeURIComponent(String(list.userId))}`}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}
              >
                <Avatar src={list.ownerAvatar || undefined} sx={{ width: 20, height: 20, fontSize: 11 }}>
                  {(list.ownerName || '?').slice(0, 1)}
                </Avatar>
                <Typography sx={{ fontSize: 12 }}>{list.ownerName || '作者'}</Typography>
              </Box>
            ) : null}
            <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
              {total} 个作品
              {price > 0 && (list.unlockCount ?? 0) > 0 ? ` · ${list.unlockCount} 人已买` : ''}
            </Typography>
          </Box>
          {list.mine && (
            <Button
              size="small"
              component={Link}
              href="/account/content?tab=collection"
              sx={{ mt: 1.5, textTransform: 'none', px: 0 }}
            >
              管理合集(可见性 / 价格)
            </Button>
          )}
        </Box>
      </Box>

      {/* 付费墙:价格、余额、解锁按钮 */}
      {paidLocked && (
        <Box
          sx={{
            mt: 2,
            p: { xs: 2.5, md: 3 },
            borderRadius: 2,
            bgcolor: 'background.paper',
            border: '1px dashed',
            borderColor: 'primary.main',
            textAlign: 'center',
          }}
        >
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: 'text.primary', mb: 0.5 }}>
            买断后可看全部 {total} 个作品,永久有效
          </Typography>
          {paidWorks > 0 && (
            <Typography sx={{ fontSize: 13, color: 'primary.main', mb: 0.5 }}>
              含作者付费作品 {paidWorks} 个,买断后一并解锁
            </Typography>
          )}
          {user && (
            <Typography sx={{ fontSize: 12, color: insufficient ? 'error.main' : 'text.secondary', mb: 1.5 }}>
              {balance == null ? '正在查询余额…' : `当前余额 ${formatDiamonds(balance)}`}
            </Typography>
          )}
          {user && insufficient ? (
            <Button
              variant="contained"
              component={Link}
              href="/recharge"
              startIcon={<DiamondRoundedIcon />}
              sx={{ textTransform: 'none', px: 4, mt: user ? 0 : 1.5, background: gradient }}
            >
              钻石不足,去充值
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={unlockM.isPending || (!!user && balance == null)}
              startIcon={unlockM.isPending ? <CircularProgress size={14} color="inherit" /> : <DiamondRoundedIcon />}
              onClick={handleUnlock}
              sx={{ textTransform: 'none', px: 4, mt: user ? 0 : 1.5, background: gradient, '&:hover': { background: gradient, filter: 'brightness(1.1)' } }}
            >
              {user ? `用 ${price} 钻解锁合集` : `登录后用 ${price} 钻解锁合集`}
            </Button>
          )}
        </Box>
      )}

      {/* 条目 */}
      <Box sx={{ mt: 3 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', mb: 1.5 }}>
          {paidLocked ? `免费预览(前 ${rows.length} 个)` : `作品列表(${total})`}
        </Typography>
        {contentQ.isLoading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={22} />
          </Box>
        ) : contentQ.isError ? (
          <Alert severity="error">作品加载失败</Alert>
        ) : rows.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2, color: 'text.disabled', fontSize: 13 }}>
            合集中还没有作品
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {rows.map((it, idx) => (
              <Box
                key={String(it.id)}
                role="button"
                tabIndex={0}
                onClick={() => navigate(it.type, it.contentId)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(it.type, it.contentId)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <Typography sx={{ fontSize: 12, color: 'text.disabled', width: 24, textAlign: 'center', flexShrink: 0 }}>
                  {idx + 1}
                </Typography>
                <Box sx={{ width: 80, height: 45, flexShrink: 0, borderRadius: 0.5, background: coverBackground(it.coverUrl, 'action.hover') }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 13, color: 'text.primary' }}>
                    {it.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 11, color: 'text.secondary', minWidth: 0 }}>
                      {it.author || '匿名'} · {(it.views ?? 0).toLocaleString()} 播放
                    </Typography>
                    <PlayTag id={it.contentId} contentType={it.type} variant="inline" sx={{ flexShrink: 0 }} />
                  </Box>
                </Box>
                <PlayArrowRoundedIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
              </Box>
            ))}
            {hiddenCount > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.75,
                  py: 2,
                  borderRadius: 1.5,
                  border: '1px dashed',
                  borderColor: 'divider',
                  color: 'text.secondary',
                  fontSize: 13,
                }}
              >
                <LockOutlinedIcon sx={{ fontSize: 16 }} />
                还有 {hiddenCount} 个作品,解锁后可看
              </Box>
            )}
          </Box>
        )}
      </Box>

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
  );
}
