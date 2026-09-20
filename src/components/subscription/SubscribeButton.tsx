'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import {
  listSubscriptions,
  createSubscription,
  deleteSubscription,
  type SubscriptionTargetType,
} from '@/apis/subscription';

interface Props {
  targetType: SubscriptionTargetType;
  targetKey: string;
  variant?: 'icon' | 'button';
}

/**
 * SubscribeButton — 通用订阅按钮。
 *
 * 列表 GET /api/digital-human/subscription 找到匹配行 → 已订阅显示"取消"。
 * 新订阅 POST {target_type, target_key}(同 target 视为幂等,后端返回现有行)。
 * 取消 DELETE /api/digital-human/subscription/:id。
 *
 * 挂在 DetailHeader.rightActions 槽位(variant='icon')或 hero 区(variant='button')。
 */
export function SubscribeButton({ targetType, targetKey, variant = 'icon' }: Props) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: listSubscriptions,
  });

  const list: any[] = Array.isArray(data)
    ? (data as any[])
    : (data as any)?.list ?? [];
  const existing = list.find(
    (s: any) => s.target_type === targetType && s.target_key === targetKey
  );

  const create = useMutation({
    mutationFn: () => createSubscription({ target_type: targetType, target_key: targetKey }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteSubscription(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  });

  const subscribed = !!existing;
  const toggle = () => (subscribed ? remove.mutate(existing.id) : create.mutate());
  const Icon = subscribed ? NotificationsActiveIcon : NotificationsOffIcon;

  if (variant === 'icon') {
    return (
      <IconButton
        onClick={toggle}
        aria-label={subscribed ? '取消订阅' : '订阅'}
        sx={{
          color: subscribed ? 'primary.main' : 'text.tertiary',
        }}
      >
        <Icon />
      </IconButton>
    );
  }

  return (
    <Button
      onClick={toggle}
      variant={subscribed ? 'contained' : 'outlined'}
      size="small"
      startIcon={<Icon />}
      disabled={create.isPending || remove.isPending}
    >
      {subscribed ? '已订阅' : '订阅更新'}
    </Button>
  );
}

export default SubscribeButton;