'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import QrCode2Icon from '@mui/icons-material/QrCode2';
import FolderIcon from '@mui/icons-material/Folder';
import ArticleIcon from '@mui/icons-material/Article';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useSearchParams } from 'next/navigation';
import { clientTree } from '@/apis/system-module-menu';
import { detail as contentDetailApi } from '@/apis/system-module-content';
import { detail as moduleDetail } from '@/apis/system-module-list';
import ModuleContentDetail from '@/components/ModuleContentDetail';

interface MenuItem {
  id: number;
  name: string;
  contentId?: number;
  type?: string;
  children?: MenuItem[];
}

function ShareModuleDetailContent() {
  const searchParams = useSearchParams();
  const moduleId = searchParams.get('moduleId');

  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
  const [activeContentId, setActiveContentId] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [unlockDismissed, setUnlockDismissed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const treeAndModuleQuery = useQuery({
    queryKey: ['share-module', moduleId],
    queryFn: async () => {
      const [treeRes, moduleRes] = await Promise.all([
        clientTree({ moduleId: Number(moduleId) }),
        moduleDetail({ id: Number(moduleId) }),
      ]);
      return { tree: treeRes.data || [], module: moduleRes.data };
    },
    enabled: !!moduleId,
  });
  const treeData = treeAndModuleQuery.data?.tree || [];
  const moduleInfo = treeAndModuleQuery.data?.module;
  const loading = treeAndModuleQuery.isLoading;

  const contentDetailQuery = useQuery({
    queryKey: ['share-module-content', activeContentId],
    queryFn: () => contentDetailApi({ id: activeContentId! }).then((r) => r.data),
    enabled: !!activeContentId,
  });
  const contentDetail = contentDetailQuery.data;

  useEffect(() => {
    if (treeAndModuleQuery.data && selectedKeys.length === 0 && treeAndModuleQuery.data.tree.length > 0) {
      const first = treeAndModuleQuery.data.tree[0];
      setSelectedKeys([first.id]);
      if (first.contentId) setActiveContentId(first.contentId);
    }
  }, [treeAndModuleQuery.data, selectedKeys.length]);

  const moduleShareType = treeAndModuleQuery.data?.module?.shareType;
  const moduleNeedPay = treeAndModuleQuery.data?.module?.needPay;
  const shouldShowUnlock =
    !!moduleShareType && (moduleShareType === 'password' || (moduleNeedPay && moduleShareType === 'pay'));
  const unlockVisible = shouldShowUnlock && !unlockDismissed;

  const handleMenuClick = (menu: MenuItem) => {
    setSelectedKeys([menu.id]);
    if (menu.contentId) {
      setActiveContentId(menu.contentId);
    }
    setDrawerOpen(false);
  };

  const handlePasswordUnlock = () => {
    if (password === '123456') {
      setUnlockDismissed(true);
    }
  };

  const renderMenu = (data: MenuItem[], depth = 0) => {
    return data.map((menu) => {
      const isSelected = selectedKeys.includes(menu.id);
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
                bgcolor: isSelected ? 'rgba(254, 44, 85, 0.18)' : 'rgba(255,255,255,0.04)',
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
            <ArticleIcon sx={{ fontSize: 14, color: isSelected ? 'primary.main' : 'text.secondary' }} />
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

  const SidebarContent = () => (
    <Box sx={{ height: '100%', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #252836' }}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary', letterSpacing: 1 }}>
          CONTENT MODULE
        </Typography>
        <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mt: 0.5 }}>
          {moduleInfo?.name || '内容详情'}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, p: 1.5, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ p: 1.5 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="text" width="100%" height={32} sx={{ my: 0.5, bgcolor: '#1E2030' }} />
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
                {moduleInfo?.name || '内容详情'}
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
                border: '1px solid #252836',
                position: 'sticky',
                top: 80,
                maxHeight: 'calc(100vh - 100px)',
                overflow: 'hidden',
              }}
            >
              <SidebarContent />
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
              <SidebarContent />
            </Drawer>

            {/* Content area */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {contentDetail && contentDetail.id ? (
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
                    {loading ? '加载中...' : '请选择左侧目录查看内容'}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Container>

      <Modal
        open={unlockVisible}
        onClose={() => {}}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: { xs: '90%', sm: 400 },
            bgcolor: 'background.paper',
            borderRadius: 3,
            p: 3,
            outline: 'none',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #FAFAFA 100%)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              mx: 'auto',
              mb: 2,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FE2C55 0%, #FF6B8A 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.primary',
            }}
          >
            {moduleInfo?.shareType === 'pay' ? <QrCode2Icon sx={{ fontSize: 28 }} /> : <LockOutlinedIcon sx={{ fontSize: 28 }} />}
          </Box>
          <Typography variant="h6" sx={{ mb: 0.5, textAlign: 'center', fontWeight: 700 }}>
            {moduleInfo?.shareType === 'pay' ? '扫码支付解锁' : '输入口令解锁'}
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', textAlign: 'center', mb: 3 }}>
            {moduleInfo?.shareType === 'pay' ? '请使用微信/支付宝扫码支付' : '请输入分享者提供的 6 位口令'}
          </Typography>

          {moduleInfo?.shareType === 'pay' && (
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Box
                sx={{
                  width: 180,
                  height: 180,
                  mx: 'auto',
                  borderRadius: 2,
                  bgcolor: '#F5F5F5',
                  border: '1px dashed',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                }}
              >
                <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>二维码占位</Typography>
              </Box>
              <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'primary.main', fontFamily: 'monospace' }}>
                ¥{moduleInfo?.shareContent?.pay || 9.9}
              </Typography>
            </Box>
          )}

          {moduleInfo?.shareType === 'password' && (
            <Box>
              <TextField
                fullWidth
                type="password"
                placeholder="请输入 6 位口令"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordUnlock()}
                sx={{ mb: 2 }}
                slotProps={{
                  input: {
                    sx: { textAlign: 'center', letterSpacing: 4, fontSize: 16, fontWeight: 600 },
                  },
                }}
              />
              <Button
                fullWidth
                variant="contained"
                onClick={handlePasswordUnlock}
                sx={{
                  borderRadius: 4,
                  py: 1.25,
                  background: 'linear-gradient(135deg, #FE2C55 0%, #FF6B8A 100%)',
                }}
              >
                解锁内容
              </Button>
              <Typography sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'center', mt: 1.5 }}>
                提示：演示口令为 123456
              </Typography>
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
