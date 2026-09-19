'use client';

// 私密合集的公开访问页 /my-list/shared?token=<share_token>
//
// 口令走查询参数而不是 /shared/[token] 路由段:站点生产是 output:'export' 静态导出,
// 动态段必须有 generateStaticParams() 才能导出,而分享口令在构建期根本不存在
// (第一次带这个页面的构建就是这么失败的)。站内其它凭 id 打开的详情页也都是查询参数。
//
// 入口:合集主在「合集管理」开启 share-token 后,把这个链接发给访客。
// 访客无需登录所有者 —— 通过 token 直接访问。
// 合集设了买断价时,未解锁访客只能看付费墙 + 「解锁」按钮;
// 已解锁/合集主/免费合集,直接看完整内容。
//
// 后端:
//   GET  /my-list/shared/:token    详情(可能附带 unlocked=false + price)
//   POST /my-list/:id/unlock       钻石解锁(需登录)

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PublicTopBar from '@/components/layout/PublicTopBar';
import {
  getSharedList,
  unlockList,
  getMyListContent,
  type MyListContentItem,
  type MyListItem,
} from '@/apis/my-list';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import { mediaUrl } from '@/lib/media';
import { coverBackground } from '@/lib/media';

function SharedListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { user } = useAuth();
  const qc = useQueryClient();

  const [snack, setSnack] = useState<string | null>(null);

  const detailQ = useQuery({
    queryKey: ['shared-list', token],
    queryFn: () => getSharedList(token),
    enabled: !!token,
    retry: false,
  });

  const detail = detailQ.data;
  const list: MyListItem | undefined = detail?.list;
  const unlocked = !!detail?.unlocked;
  const price = detail?.price ?? 0;
  const isPaidLocked = !unlocked && price > 0;

  // 已解锁或免费时,加载条目列表
  const contentQ = useQuery({
    queryKey: ['shared-list-content', list?.id, unlocked],
    queryFn: () => getMyListContent(list!.id),
    enabled: !!list && unlocked,
    retry: false,
  });

  const unlockM = useMutation({
    mutationFn: () => unlockList(list!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shared-list', token] });
      qc.invalidateQueries({ queryKey: ['shared-list-content', list?.id] });
      setSnack('解锁成功,正在打开合集…');
    },
    onError: (e: any) => setSnack(e?.message || '解锁失败'),
  });

  const handleUnlock = () => {
    if (!user) {
      router.push(loginHref(`/my-list/shared?token=${encodeURIComponent(token)}`));
      return;
    }
    unlockM.mutate();
  };

  if (detailQ.isLoading) {
    return (
      <Box>
        <PublicTopBar />
        <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress size={28} />
        </Container>
      </Box>
    );
  }

  if (detailQ.isError || !list) {
    return (
      <Box>
        <PublicTopBar />
        <Container maxWidth="sm" sx={{ py: 8 }}>
          <Alert severity="warning">合集不存在或分享链接已关闭</Alert>
          <Button onClick={() => router.push('/')} sx={{ mt: 2, textTransform: 'none' }}>
            返回首页
          </Button>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <PublicTopBar />

      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
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
              width: { xs: '100%', sm: 200 },
              flexShrink: 0,
              aspectRatio: '16/9',
              borderRadius: 1.5,
              background: coverBackground(list.coverUrl, 'linear-gradient(135deg, #2A2D3A 0%, #1A1C26 100%)'),
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mb: 1 }}>
              {list.isPublic ? (
                <Chip icon={<PublicRoundedIcon sx={{ fontSize: 14 }} />} label="公开" size="small" />
              ) : (
                <Chip icon={<LockOutlinedIcon sx={{ fontSize: 14 }} />} label="私密分享" size="small" color="default" />
              )}
              {price > 0 && (
                <Chip
                  icon={<DiamondRoundedIcon sx={{ fontSize: 14 }} />}
                  label={`💎 ${(price / 100).toFixed(2)} 买断`}
                  size="small"
                  color="primary"
                />
              )}
            </Box>
            <Typography sx={{ fontSize: { xs: 18, md: 22 }, fontWeight: 700, color: 'text.primary', mb: 1 }}>
              {list.name}
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2, whiteSpace: 'pre-wrap' }}>
              {list.description || '合集主还没写简介。'}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
              {list.itemCount ?? 0} 个作品 ·{' '}
              {list.ownerName ? `by ${list.ownerName}` : list.userId > 0 ? '' : '平台精选'}
            </Typography>
          </Box>
        </Box>

        {/* 付费墙 */}
        {isPaidLocked ? (
          <Box
            sx={{
              mt: 3,
              p: 4,
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: '1px dashed',
              borderColor: 'primary.main',
              textAlign: 'center',
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 36, color: 'primary.main', mb: 1 }} />
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'text.primary', mb: 1 }}>
              这是付费合集
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2 }}>
              一次性解锁合集下所有作品,永久有效
            </Typography>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 0.75,
                mb: 2.5,
                px: 2,
                py: 1,
                borderRadius: 1.5,
                bgcolor: 'rgba(254, 44, 85, 0.08)',
              }}
            >
              <DiamondRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography sx={{ fontSize: 24, fontWeight: 700, color: 'primary.main' }}>
                {(price / 100).toFixed(2)}
              </Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>钻石</Typography>
            </Box>
            <Box>
              <Button
                variant="contained"
                size="large"
                disabled={unlockM.isPending}
                startIcon={unlockM.isPending ? <CircularProgress size={14} color="inherit" /> : <DiamondRoundedIcon />}
                onClick={handleUnlock}
                sx={{
                  textTransform: 'none',
                  px: 4,
                  background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
                  '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
                }}
              >
                {user ? '立即解锁' : '登录后解锁'}
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ mt: 3 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', mb: 1.5 }}>
              作品列表 ({contentQ.data?.total ?? 0})
            </Typography>
            {contentQ.isLoading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={22} />
              </Box>
            ) : contentQ.isError ? (
              <Alert severity="error">作品加载失败</Alert>
            ) : (contentQ.data?.list ?? []).length === 0 ? (
              <Box
                sx={{
                  py: 6,
                  textAlign: 'center',
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                  color: 'text.disabled',
                  fontSize: 13,
                }}
              >
                合集中还没有作品
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(contentQ.data!.list as MyListContentItem[]).map((it, idx) => (
                  <Box
                    key={it.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 1.5,
                      bgcolor: 'background.paper',
                      border: '1px solid',
                      borderColor: 'divider',
                      '&:hover': { borderColor: 'primary.main' },
                    }}
                  >
                    <Typography sx={{ fontSize: 12, color: 'text.disabled', width: 24, textAlign: 'center' }}>
                      {idx + 1}
                    </Typography>
                    <Box
                      sx={{
                        width: 80,
                        height: 45,
                        flexShrink: 0,
                        borderRadius: 0.5,
                        background: coverBackground(it.coverUrl, 'action.hover'),
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: 13,
                          color: 'text.primary',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {it.title}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                        {it.author || '匿名'} · {(it.views ?? 0).toLocaleString()} 播放
                      </Typography>
                    </Box>
                    <Button
                      size="small"
                      startIcon={<PlayArrowRoundedIcon sx={{ fontSize: 16 }} />}
                      onClick={() => router.push(`/detail/${it.type}?id=${it.contentId}`)}
                      sx={{ textTransform: 'none', fontSize: 12 }}
                    >
                      播放
                    </Button>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Container>

      <Snackbar
        open={!!snack}
        autoHideDuration={2200}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}

export default function SharedListPage() {
  return (
    <React.Suspense fallback={null}>
      <SharedListContent />
    </React.Suspense>
  );
}
