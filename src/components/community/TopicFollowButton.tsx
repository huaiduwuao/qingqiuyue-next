'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import Button from '@mui/material/Button';
import { useAuth } from '@/contexts/AuthContext';
import { formatApiError } from '@/lib/api/client';
import { setTopicFollow, type Id } from '@/apis/community';
import type { Notify } from './FeedCard';

/** 关注/取消关注专题或话题;关注后,话题里的新帖会进「关注」流 */
export function TopicFollowButton({
  topicId,
  following,
  onChange,
  notify,
  size = 'small',
}: {
  topicId: Id;
  following: boolean;
  onChange?: (following: boolean, followerCount: number) => void;
  notify?: Notify;
  size?: 'small' | 'medium';
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [on, setOn] = useState(following);
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isAuthenticated) {
      notify?.('登录后才能关注', 'info');
      router.push('/user/login');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const r = await setTopicFollow(topicId, !on);
      setOn(r.following);
      onChange?.(r.following, r.followerCount);
      qc.invalidateQueries({ queryKey: ['community', 'topics'] });
    } catch (err) {
      notify?.(formatApiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size={size}
      variant={on ? 'outlined' : 'contained'}
      disabled={busy}
      onClick={toggle}
      sx={{
        minWidth: 0,
        px: size === 'small' ? 1.25 : 2.5,
        borderRadius: 999,
        textTransform: 'none',
        fontSize: size === 'small' ? 11 : 13,
        fontWeight: 600,
        flexShrink: 0,
        ...(on
          ? { color: 'var(--text-secondary, rgba(255,255,255,0.7))', borderColor: 'var(--border-strong, rgba(255,255,255,0.2))' }
          : { bgcolor: 'var(--brand-color, #FE2C55)', '&:hover': { bgcolor: '#E0274A' } }),
      }}
    >
      {on ? '已关注' : '+ 关注'}
    </Button>
  );
}
