'use client';

import React, { useMemo, useState, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Drawer from '@mui/material/Drawer';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import MenuIcon from '@mui/icons-material/Menu';
import FolderIcon from '@mui/icons-material/Folder';
import ArticleIcon from '@mui/icons-material/Article';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useSearchParams } from 'next/navigation';
import { clientTree } from '@/apis/system-module-menu';
import { detail as contentDetailApi } from '@/apis/system-module-content';
import { detail as moduleDetail } from '@/apis/system-module-list';
import ModuleContentDetail from '@/components/ModuleContentDetail';

// 频道(module)分享页 /share/module-detail?moduleId=:左侧目录树,右侧内容详情。
// 频道一律公开,没有口令 / 付费解锁;付费合集是用户合集,见 /collections/detail。

interface MenuItem {
  id: number;
  name: string;
  contentId?: number;
  type?: string;
  children?: MenuItem[];
}

/** 频道详情(后端 /module/:id) */
interface ShareModuleInfo {
  id: number;
  title?: string;
  name?: string;
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

function ShareModuleDetailContent() {
  const searchParams = useSearchParams();
  const moduleId = searchParams.get('moduleId');

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const moduleQuery = useQuery({
    queryKey: ['share-module', moduleId],
    queryFn: () => moduleDetail({ id: Number(moduleId) }) as Promise<ShareModuleInfo>,
    enabled: !!moduleId,
  });
  const moduleInfo = moduleQuery.data;

  const treeQuery = useQuery({
    queryKey: ['share-module-tree', moduleId],
    queryFn: async () => ((await clientTree({ moduleId: Number(moduleId) })) || []) as MenuItem[],
    enabled: !!moduleId,
  });
  const treeData = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);
  const loading = moduleQuery.isLoading || treeQuery.isLoading;

  // 没手动选过就默认第一项
  const activeMenu = findMenu(treeData, selectedId) ?? treeData[0];
  const activeContentId = activeMenu?.contentId ?? null;

  const contentDetailQuery = useQuery({
    queryKey: ['share-module-content', activeContentId],
    queryFn: () => contentDetailApi({ id: activeContentId! }),
    enabled: !!activeContentId,
  });
  const contentDetail = contentDetailQuery.data;

  const handleMenuClick = (menu: MenuItem) => {
    setSelectedId(menu.id);
    setDrawerOpen(false);
  };

  const moduleName = moduleInfo?.title || moduleInfo?.name || '内容详情';

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
                    {loading || contentDetailQuery.isLoading ? '加载中...' : '请选择左侧目录查看内容'}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Container>

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
