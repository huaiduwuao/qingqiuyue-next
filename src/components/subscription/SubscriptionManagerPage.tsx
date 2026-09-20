'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  listSubscriptions,
  deleteSubscription,
  toggleSubscription,
  type SubscriptionItem,
} from '@/apis/subscription';

/**
 * SubscriptionManagerPage —— /subscribe 路由页。
 *
 * 列出当前用户订阅的所有专题;支持暂停/启用/删除。
 * 列表项来自 GET /api/digital-human/subscription。
 */
export function SubscriptionManagerPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: listSubscriptions,
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteSubscription(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  });
  const toggle = useMutation({
    mutationFn: (id: number) => toggleSubscription(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  });

  const list: SubscriptionItem[] = Array.isArray(data)
    ? (data as SubscriptionItem[])
    : (data as any)?.list ?? [];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 720, mx: 'auto' }}>
      <Typography sx={{ fontSize: 22, fontWeight: 800, mb: 0.5 }}>我的订阅</Typography>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 3 }}>
        订阅后,数字人会在该专题新内容入库时推送气泡给你。停用 = 保留订阅但不再推送。
      </Typography>

      {isLoading && <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>加载中…</Typography>}

      {!isLoading && list.length === 0 && (
        <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
          还没有订阅。打开任意专题详情页,点订阅按钮即可加入。
        </Typography>
      )}

      {list.map((s) => {
        const enabled = !!s.enabled;
        return (
          <Box
            key={s.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{s.target_key}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>{s.target_type}</Typography>
            </Box>
            <Typography
              onClick={() => toggle.mutate(s.id)}
              sx={{
                fontSize: 12,
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
                bgcolor: enabled ? 'rgba(254,44,85,0.12)' : 'action.hover',
                color: enabled ? 'primary.main' : 'text.secondary',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {enabled ? '推送中' : '已暂停'}
            </Typography>
            <IconButton
              aria-label="删除订阅"
              onClick={() => remove.mutate(s.id)}
              sx={{ color: 'text.disabled' }}
            >
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}
    </Box>
  );
}

export default SubscriptionManagerPage;