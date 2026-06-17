'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import ChatIcon from '@mui/icons-material/Chat';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { wxClient } from '@/lib/api/client';

interface WxConfig {
  id: number;
  appId: string;
  appName: string;
  appSecret: string;
  token: string;
  status: 'active' | 'inactive';
  bindTime: string;
  fans: number;
}

export default function WxConfigPage() {
  const { data: configs = [] } = useQuery({
    queryKey: ['wx-config', 'list'],
    queryFn: () => wxClient<{ list: WxConfig[]; total: number }>('/wxConfig/list', {
      params: { page: 1, pageSize: 20 },
    }).then((r: any) => (r?.data?.list as WxConfig[]) || []),
  });
  const [selected, setSelected] = useState<WxConfig | null>(null);

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <ChatIcon sx={{ color: 'success.main', fontSize: 28 }} />
        <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
          微信配置
        </Typography>
        <Chip label="服务号" size="small" sx={{ bgcolor: '#5DDB9620', color: 'success.main' }} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, gap: 3 }}>
        {/* 左侧公众号列表 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {configs.map((c) => {
            const isSel = selected?.id === c.id;
            return (
              <Box
                key={c.id}
                onClick={() => setSelected(c)}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                  border: `1px solid ${isSel ? 'success.main' : 'divider'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: '#5DDB9680' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      bgcolor: '#5DDB9620',
                      color: 'success.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ChatIcon />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }} noWrap>
                      {c.appName}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }} noWrap>
                      {c.appId}
                    </Typography>
                  </Box>
                  {c.status === 'active' ? (
                    <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                  ) : (
                    <ErrorIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5 }}>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>粉丝</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'success.main' }}>
                    {c.fans.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* 右侧详情 */}
        {selected && (
          <Box sx={{ p: 3, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid #252836' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6" sx={{ color: 'text.primary' }}>
                {selected.appName}
              </Typography>
              <Chip
                label={selected.status === 'active' ? '已启用' : '已停用'}
                size="small"
                sx={{
                  bgcolor: selected.status === 'active' ? '#5DDB9620' : '#5A5E7220',
                  color: selected.status === 'active' ? 'success.main' : 'text.secondary',
                  fontWeight: 600,
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { label: 'AppID', value: selected.appId, copy: true },
                { label: 'AppSecret', value: selected.appSecret, copy: true },
                { label: 'Token', value: selected.token, copy: true },
                { label: '绑定时间', value: selected.bindTime, copy: false },
                { label: '粉丝数', value: selected.fans.toLocaleString(), copy: false },
              ].map((f) => (
                <Box key={f.label}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>{f.label}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        flex: 1,
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: 'background.default',
                        border: '1px solid #252836',
                        fontFamily: 'monospace',
                        fontSize: 13,
                        color: 'text.tertiary',
                      }}
                    >
                      {f.value}
                    </Box>
                    {f.copy && (
                      <Button
                        size="small"
                        onClick={() => navigator.clipboard?.writeText(selected.appId)}
                        sx={{ minWidth: 60, textTransform: 'none', color: 'success.main' }}
                      >
                        复制
                      </Button>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>

            <Divider sx={{ borderColor: 'divider', my: 3 }} />

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                sx={{ bgcolor: 'success.main', '&:hover': { bgcolor: '#4FC986' }, textTransform: 'none' }}
              >
                保存修改
              </Button>
              <Button
                variant="outlined"
                sx={{ borderColor: 'divider', color: 'text.tertiary', textTransform: 'none' }}
              >
                重新授权
              </Button>
              <Button
                variant="outlined"
                sx={{ borderColor: 'divider', color: 'primary.main', textTransform: 'none' }}
              >
                {selected.status === 'active' ? '停用' : '启用'}
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
