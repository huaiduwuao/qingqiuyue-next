'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Modal from '@mui/material/Modal';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
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

  const [treeData, setTreeData] = useState<MenuItem[]>([]);
  const [contentDetail, setContentDetail] = useState<any>(null);
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [module, setModule] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [unlockVisible, setUnlockVisible] = useState(false);

  useEffect(() => {
    if (moduleId) {
      fetchData();
    }
  }, [moduleId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [treeRes, moduleRes] = await Promise.all([
        clientTree({ moduleId: Number(moduleId) }),
        moduleDetail({ id: Number(moduleId) }),
      ]);
      setTreeData(treeRes.data || []);
      setModule(moduleRes.data);

      if (moduleRes.data?.needPay && moduleRes.data?.shareType === 'pay') {
        setUnlockVisible(true);
      } else if (moduleRes.data?.shareType === 'password') {
        setUnlockVisible(true);
      }

      if (treeRes.data?.length > 0) {
        const firstItem = treeRes.data[0];
        setSelectedKeys([firstItem.id]);
        if (firstItem.contentId) {
          fetchContentDetail(firstItem.contentId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
    setLoading(false);
  };

  const fetchContentDetail = async (contentId: number) => {
    try {
      const res = await contentDetailApi({ id: contentId });
      setContentDetail(res.data);
    } catch (err) {
      console.error('Failed to fetch content:', err);
    }
  };

  const handleMenuClick = (menu: MenuItem) => {
    setSelectedKeys([menu.id]);
    if (menu.contentId) {
      fetchContentDetail(menu.contentId);
    }
  };

  const handlePasswordUnlock = () => {
    if (password === '123456') {
      setUnlockVisible(false);
    }
  };

  const renderMenu = (data: MenuItem[], depth = 0) => {
    return data.map((menu) => {
      if (menu.type === 'PAGE') {
        return (
          <ListItemButton
            key={menu.id}
            selected={selectedKeys.includes(menu.id)}
            onClick={() => handleMenuClick(menu)}
            sx={{ pl: 2 + depth * 2 }}
          >
            <ListItemText
              primary={menu.name}
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            />
          </ListItemButton>
        );
      }

      return (
        <Box key={menu.id}>
          <ListItemButton sx={{ pl: 2 + depth * 2 }}>
            <Typography sx={{ fontWeight: 'bold' }}>{menu.name}</Typography>
          </ListItemButton>
          {menu.children && (
            <Box sx={{ pl: 2 }}>{renderMenu(menu.children, depth + 1)}</Box>
          )}
        </Box>
      );
    });
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Card sx={{ width: 256, flexShrink: 0 }}>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <Box sx={{ p: 2 }}>
                <Typography variant="h6">目录</Typography>
              </Box>
              {loading ? (
                <Box sx={{ p: 2 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} variant="text" width="100%" height={32} sx={{ my: 1 }} />
                  ))}
                </Box>
              ) : treeData.length === 0 ? (
                <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
                  暂无内容
                </Typography>
              ) : (
                <List sx={{ p: 0 }}>{renderMenu(treeData)}</List>
              )}
            </CardContent>
          </Card>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              {contentDetail && contentDetail.id ? (
                <ModuleContentDetail detail={contentDetail} />
              ) : (
                <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
                  请选择左侧菜单
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>

        <Modal open={unlockVisible} onClose={() => {}}>
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 300,
              bgcolor: 'background.paper',
              p: 3,
              borderRadius: 1,
            }}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              解锁内容
            </Typography>
            {module?.shareType === 'pay' && (
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography>扫码支付后查看</Typography>
              </Box>
            )}
            {module?.shareType === 'password' && (
              <Box>
                <TextField
                  fullWidth
                  type="password"
                  placeholder="输入口令"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePasswordUnlock()}
                  sx={{ mb: 2 }}
                />
                <Button fullWidth variant="contained" onClick={handlePasswordUnlock}>
                  解锁
                </Button>
              </Box>
            )}
          </Box>
        </Modal>
      </Box>
    </Container>
  );
}

export default function ShareModuleDetailPage() {
  return (
    <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}>
      <ShareModuleDetailContent />
    </Suspense>
  );
}
