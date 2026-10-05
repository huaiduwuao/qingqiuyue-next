'use client';

import React, { useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Modal from '@mui/material/Modal';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import FolderIcon from '@mui/icons-material/Folder';
import ArticleIcon from '@mui/icons-material/Article';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useRouter, useSearchParams } from 'next/navigation';
import { clientTree } from '@/apis/system-module-menu';
import { detail as contentDetailApi } from '@/apis/system-module-content';
import { detail as moduleDetail } from '@/apis/system-module-list';
import { passwordUnlock, payUnlock } from '@/apis/global';
import { formatDiamonds, getWalletBalance } from '@/apis/wallet';
import { formatApiError } from '@/lib/api/client';
import { loginHref } from '@/lib/auth/redirect';
import { useAuth } from '@/contexts/AuthContext';
import ModuleContentDetail from '@/components/ModuleContentDetail';

interface MenuItem {
  id: number;
  name: string;
  contentId?: number;
  type?: string;
  children?: MenuItem[];
}

/** 模块详情(后端 /module/:id):口令 / 付费合集带上对当前访问者的解锁状态 */
interface ShareModuleInfo {
  id: number;
  title?: string;
  name?: string;
  shareType?: string;
  /** 对当前访问者仍上锁 */
  locked?: boolean;
  needPay?: boolean;
  needPassword?: boolean;
  /** 买断价(钻) */
  price?: number;
}

// 口令合集的通行证存在 sessionStorage:关掉标签页就忘,刷新页面不用重输口令。
const passKey = (moduleId: string) => `module-pass:${moduleId}`;

function readPass(moduleId: string | null): string {
  if (!moduleId || typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(passKey(moduleId)) || '';
  } catch {
    return '';
  }
}

function writePass(moduleId: string, pass: string) {
  try {
    window.sessionStorage.setItem(passKey(moduleId), pass);
  } catch {
    // 隐私模式等存不了:本次页面内仍然有效
  }
}

function findMenu(list: MenuItem[], id: number | null): MenuItem | undefined {
  if (id == null) return undefined;
  for (const m of list) {
    if (m.id === id) return m;
    const hit = m.children ? findMenu(m.children, id) : undefined;
    if (hit) return hit;
  }
  return undefined;
}

const gradient = 'linear-gradient(135deg, #FE2C55 0%, #FF6B8A 100%)';

function ShareModuleDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleId = searchParams.get('moduleId');
  const { user } = useAuth();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [modulePass, setModulePass] = useState(() => readPass(moduleId));
  const [unlockDismissed, setUnlockDismissed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  // 模块详情和菜单都按通行证区分缓存:解锁后换了通行证,自然重新取一遍
  const moduleQuery = useQuery({
    queryKey: ['share-module', moduleId, modulePass],
    queryFn: () => moduleDetail({ id: Number(moduleId), ...(modulePass ? { modulePass } : {}) }) as Promise<ShareModuleInfo>,
    enabled: !!moduleId,
  });
  const moduleInfo = moduleQuery.data;
  const locked = !!(moduleInfo?.locked || moduleInfo?.needPay || moduleInfo?.needPassword);
  const isPay = moduleInfo?.shareType === 'pay';
  const isPassword = moduleInfo?.shareType === 'password';
  const price = moduleInfo?.price ?? 0;

  const treeQuery = useQuery({
    queryKey: ['share-module-tree', moduleId, modulePass, locked],
    queryFn: async () => ((await clientTree({ moduleId: Number(moduleId), ...(modulePass ? { modulePass } : {}) })) || []) as MenuItem[],
    enabled: !!moduleId && !!moduleInfo,
  });
  const treeData = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);
  const loading = moduleQuery.isLoading || treeQuery.isLoading;

  // 没手动选过就默认第一项;合集上锁时菜单不带 contentId,解锁后同一项就能打开
  const activeMenu = findMenu(treeData, selectedId) ?? treeData[0];
  const activeContentId = !locked && activeMenu?.contentId ? activeMenu.contentId : null;

  const contentDetailQuery = useQuery({
    queryKey: ['share-module-content', activeContentId, modulePass],
    queryFn: () => contentDetailApi({ id: activeContentId!, ...(modulePass ? { modulePass } : {}) }),
    enabled: !!activeContentId,
  });
  const contentDetail = contentDetailQuery.data;

  const walletQuery = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: getWalletBalance,
    enabled: !!user && locked && isPay,
  });
  const balance = walletQuery.data?.balance;
  const insufficient = balance != null && price > 0 && balance < price;

  const refreshAfterUnlock = () => {
    qc.invalidateQueries({ queryKey: ['share-module', moduleId] });
    qc.invalidateQueries({ queryKey: ['share-module-tree', moduleId] });
    qc.invalidateQueries({ queryKey: ['share-module-content'] });
  };

  const payMutation = useMutation({
    mutationFn: () => payUnlock({ moduleId: Number(moduleId) }),
    onSuccess: () => {
      setUnlockError('');
      qc.invalidateQueries({ queryKey: ['wallet-balance'] });
      refreshAfterUnlock();
    },
    onError: (err) => {
      setUnlockError(formatApiError(err));
      // 余额可能在别处变了,失败后重新取一次
      qc.invalidateQueries({ queryKey: ['wallet-balance'] });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (pw: string) => passwordUnlock({ moduleId: Number(moduleId), password: pw }),
    onSuccess: (res) => {
      setUnlockError('');
      if (res?.pass && moduleId) {
        writePass(moduleId, res.pass);
        setModulePass(res.pass);
      } else {
        refreshAfterUnlock();
      }
    },
    onError: (err) => setUnlockError(formatApiError(err)),
  });

  const handlePay = () => {
    if (!user) {
      router.push(loginHref(`/share/module-detail?moduleId=${encodeURIComponent(moduleId || '')}`));
      return;
    }
    payMutation.mutate();
  };

  const handlePasswordUnlock = () => {
    if (!password.trim() || !moduleId || passwordMutation.isPending) return;
    passwordMutation.mutate(password.trim());
  };

  const handleMenuClick = (menu: MenuItem) => {
    setSelectedId(menu.id);
    setDrawerOpen(false);
  };

  const unlockVisible = locked && (isPay || isPassword) && !unlockDismissed;
  const moduleName = moduleInfo?.title || moduleInfo?.name || '内容详情';
  const unlockBusy = payMutation.isPending || passwordMutation.isPending;

  const renderMenu = (data: MenuItem[], depth = 0) => {
    return data.map((menu) => {
      const isSelected = activeMenu?.id === menu.id;
      const isPage = menu.type === 'PAGE';

      if (isPage) {
        return (
          <Box
            key={menu.id}
            onClick={() => handleMenuClick(menu)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              pl: 1.5 + depth * 1.5,
              pr: 1.5,
              py: 1,
              borderRadius: 1.5,
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative',
              color: isSelected ? 'primary.main' : 'text.tertiary',
              bgcolor: isSelected ? 'rgba(254, 44, 85, 0.12)' : 'transparent',
              '&:hover': {
                bgcolor: isSelected ? 'rgba(254, 44, 85, 0.18)' : 'action.hover',
              },
            }}
          >
            {isSelected && (
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: '20%',
                  bottom: '20%',
                  width: 3,
                  borderRadius: 2,
                  bgcolor: 'primary.main',
                }}
              />
            )}
            {locked ? (
              <LockOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
            ) : (
              <ArticleIcon sx={{ fontSize: 14, color: isSelected ? 'primary.main' : 'text.secondary' }} />
            )}
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: isSelected ? 600 : 400,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {menu.name}
            </Typography>
            {isSelected && <ChevronRightIcon sx={{ fontSize: 14, color: 'primary.main' }} />}
          </Box>
        );
      }

      return (
        <Box key={menu.id}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              pl: 1.5 + depth * 1.5,
              pr: 1.5,
              py: 1,
              color: 'text.secondary',
            }}
          >
            <FolderIcon sx={{ fontSize: 14, color: 'warning.main' }} />
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.tertiary' }}>
              {menu.name}
            </Typography>
          </Box>
          {menu.children && (
            <Box>{renderMenu(menu.children, depth + 1)}</Box>
          )}
        </Box>
      );
    });
  };

  // 以前写成组件 <SidebarContent />:每次渲染都是一个新的组件类型,点一下目录项
  // 整棵侧栏就卸载重挂,长目录的滚动位置跳回顶部。改成普通函数调用,DOM 原地复用。
  const renderSidebar = () => (
    <Box sx={{ height: '100%', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary', letterSpacing: 1 }}>
          CONTENT MODULE
        </Typography>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mt: 0.5 }}>
          {moduleName}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, p: 1.5, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ p: 1.5 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="text" width="100%" height={32} sx={{ my: 0.5 }} />
            ))}
          </Box>
        ) : treeData.length === 0 ? (
          <Typography sx={{ color: 'text.secondary', fontSize: 12, textAlign: 'center', py: 4 }}>
            暂无目录
          </Typography>
        ) : (
          renderMenu(treeData)
        )}
      </Box>
    </Box>
  );

  const renderLockedCard = () => (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: 6,
        textAlign: 'center',
        border: '1px dashed',
        borderColor: 'divider',
      }}
    >
      <LockOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
      <Typography sx={{ color: 'text.secondary', fontSize: 13, mb: 2 }}>
        {isPay ? `这是付费合集,解锁后可查看全部内容` : '这是口令合集,输入口令后可查看全部内容'}
      </Typography>
      <Button variant="contained" onClick={() => setUnlockDismissed(false)} sx={{ borderRadius: 4, background: gradient }}>
        {isPay ? `用 ${price} 钻解锁` : '输入口令'}
      </Button>
    </Box>
  );

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <Container maxWidth="lg" sx={{ px: { xs: 1, md: 3 } }}>
        <Box sx={{ py: { xs: 1, md: 2 } }}>
          {/* Mobile header */}
          <Box
            sx={{
              display: { xs: 'flex', md: 'none' },
              alignItems: 'center',
              gap: 1,
              p: 1.5,
              mb: 1.5,
              bgcolor: 'background.paper',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <IconButton
              onClick={() => setDrawerOpen(true)}
              size="small"
              sx={{ border: '1px solid', borderColor: 'divider' }}
            >
              <MenuIcon fontSize="small" />
            </IconButton>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {moduleName}
              </Typography>
              <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                共 {treeData.length} 个分类
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            {/* Desktop sidebar */}
            <Box
              sx={{
                display: { xs: 'none', md: 'block' },
                width: 280,
                flexShrink: 0,
                borderRadius: 2,
                bgcolor: 'background.default',
                border: '1px solid',
                borderColor: 'divider',
                position: 'sticky',
                top: 80,
                maxHeight: 'calc(100vh - 100px)',
                overflow: 'hidden',
              }}
            >
              {renderSidebar()}
            </Box>

            {/* Mobile drawer */}
            <Drawer
              anchor="left"
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              sx={{
                display: { xs: 'block', md: 'none' },
                '& .MuiDrawer-paper': { width: 280, bgcolor: 'background.default' },
              }}
            >
              <Box sx={{ position: 'absolute', right: 8, top: 8, zIndex: 1 }}>
                <IconButton size="small" onClick={() => setDrawerOpen(false)} sx={{ color: 'text.secondary' }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
              {renderSidebar()}
            </Drawer>

            {/* Content area */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {locked && (isPay || isPassword) ? (
                renderLockedCard()
              ) : contentDetail && contentDetail.id ? (
                <ModuleContentDetail detail={contentDetail} />
              ) : (
                <Box
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    p: 6,
                    textAlign: 'center',
                    border: '1px dashed',
                    borderColor: 'divider',
                  }}
                >
                  <ArticleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>
                    {loading || contentDetailQuery.isLoading ? '加载中...' : '请选择左侧目录查看内容'}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Container>

      <Modal
        open={unlockVisible}
        onClose={() => { if (!unlockBusy) setUnlockDismissed(true); }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: { xs: '90%', sm: 400 },
            bgcolor: 'background.paper',
            borderRadius: 3,
            p: 3,
            outline: 'none',
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
          }}
        >
          <IconButton
            size="small"
            aria-label="关闭"
            onClick={() => setUnlockDismissed(true)}
            disabled={unlockBusy}
            sx={{ position: 'absolute', right: 8, top: 8, color: 'text.secondary' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          <Box
            sx={{
              width: 56,
              height: 56,
              mx: 'auto',
              mb: 2,
              borderRadius: '50%',
              background: gradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            {isPay ? <DiamondRoundedIcon sx={{ fontSize: 28 }} /> : <LockOutlinedIcon sx={{ fontSize: 28 }} />}
          </Box>
          <Typography variant="h6" sx={{ mb: 0.5, textAlign: 'center', fontWeight: 700 }}>
            {isPay ? '付费合集' : '输入口令解锁'}
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', mb: 3 }}>
            {isPay ? '一次解锁,合集内全部内容永久可看' : '请输入分享者提供的口令'}
          </Typography>

          {isPay && (
            <Box sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: 0.75,
                  mb: 1,
                  px: 2,
                  py: 1,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(254, 44, 85, 0.08)',
                }}
              >
                <DiamondRoundedIcon sx={{ fontSize: 16, color: 'primary.main', alignSelf: 'center' }} />
                <Typography sx={{ fontSize: 24, fontWeight: 700, color: 'primary.main' }}>{price}</Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>钻石</Typography>
              </Box>
              {user && (
                <Typography sx={{ fontSize: 12, color: insufficient ? 'error.main' : 'text.secondary', mb: 2 }}>
                  {balance == null ? '正在查询余额…' : `当前余额 ${formatDiamonds(balance)}`}
                </Typography>
              )}
              {unlockError && (
                <Typography sx={{ fontSize: 12, color: 'error.main', mb: 1.5 }}>{unlockError}</Typography>
              )}
              {price <= 0 ? (
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1.5 }}>该合集暂未定价,暂不能购买</Typography>
              ) : user && insufficient ? (
                <Button
                  fullWidth
                  variant="contained"
                  component={Link}
                  href="/recharge"
                  startIcon={<DiamondRoundedIcon />}
                  sx={{ borderRadius: 4, py: 1.25, background: gradient }}
                >
                  钻石不足,去充值
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="contained"
                  disabled={unlockBusy || (!!user && balance == null)}
                  startIcon={payMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <DiamondRoundedIcon />}
                  onClick={handlePay}
                  sx={{ borderRadius: 4, py: 1.25, background: gradient }}
                >
                  {user ? `用 ${price} 钻解锁` : '登录后解锁'}
                </Button>
              )}
            </Box>
          )}

          {isPassword && (
            <Box>
              <TextField
                fullWidth
                type="password"
                placeholder="请输入口令"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordUnlock()}
                disabled={unlockBusy}
                sx={{ mb: 2 }}
                slotProps={{
                  input: {
                    sx: { textAlign: 'center', letterSpacing: 4, fontSize: 16, fontWeight: 600 },
                  },
                }}
              />
              {unlockError && (
                <Typography sx={{ fontSize: 12, color: 'error.main', textAlign: 'center', mb: 1.5 }}>{unlockError}</Typography>
              )}
              <Button
                fullWidth
                variant="contained"
                disabled={unlockBusy || !password.trim()}
                onClick={handlePasswordUnlock}
                sx={{ borderRadius: 4, py: 1.25, background: gradient }}
              >
                {passwordMutation.isPending ? '验证中…' : '解锁内容'}
              </Button>
            </Box>
          )}
        </Box>
      </Modal>
    </Box>
  );
}

export default function ShareModuleDetailPage() {
  return (
    <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}>
      <ShareModuleDetailContent />
    </Suspense>
  );
}
