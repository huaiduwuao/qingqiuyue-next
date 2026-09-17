'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { addToMyList, createMyList, getMyLists, type MyListItem } from '@/apis/my-list';
import { formatApiError } from '@/lib/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { loginHref } from '@/lib/auth/redirect';
import type { EntityId } from '@/lib/id';
import PlaylistCover from './PlaylistCover';

export const PLAYLISTS_KEY = ['my-lists', 'playlist'] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  /** 要加进歌单的歌 */
  contentIds: EntityId[];
  /** 新建歌单时预填的名字(如「周杰伦 精选」) */
  suggestName?: string;
  onDone?: (message: string) => void;
}

/**
 * 「加入歌单」弹窗:选一个已有歌单,或者当场新建一个。
 * 一首歌(详情页 / 卡片)和一批歌(播放队列、搜索结果)共用。
 */
export default function PlaylistPicker({ open, onClose, contentIds, suggestName, onDone }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [doneId, setDoneId] = useState<EntityId | null>(null);

  const lists = useQuery({
    queryKey: PLAYLISTS_KEY,
    queryFn: () => getMyLists('playlist'),
    enabled: open && isAuthenticated,
  });

  const finish = (message: string, id: EntityId) => {
    setDoneId(id);
    qc.invalidateQueries({ queryKey: ['my-lists'] });
    onDone?.(message);
    setTimeout(() => {
      setDoneId(null);
      setCreating(false);
      setName('');
      onClose();
    }, 500);
  };

  const add = useMutation({
    mutationFn: (list: MyListItem) => addToMyList(list.id, contentIds).then((r) => ({ r, list })),
    onSuccess: ({ r, list }) =>
      finish(r.added > 0 ? `已加入「${list.name}」${contentIds.length > 1 ? ` · ${r.added} 首` : ''}` : `「${list.name}」里已经有了`, list.id),
    onError: (e) => setError(formatApiError(e)),
  });

  const create = useMutation({
    mutationFn: (n: string) => createMyList({ name: n, type: 'playlist', contentIds }).then((r) => ({ r, n })),
    onSuccess: ({ r, n }) => finish(`已新建歌单「${n}」${r.added > 0 ? ` · ${r.added} 首` : ''}`, r.id),
    onError: (e) => setError(formatApiError(e)),
  });

  const busy = add.isPending || create.isPending;
  const items = lists.data?.list ?? [];

  const submitCreate = () => {
    const n = name.trim();
    if (!n) return setError('给歌单起个名字');
    setError('');
    create.mutate(n);
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ pb: 1, fontSize: 17, fontWeight: 700 }}>
        加入歌单
        {contentIds.length > 1 && (
          <Box component="span" sx={{ ml: 1, fontSize: 13, fontWeight: 400, color: 'text.secondary' }}>
            {contentIds.length} 首
          </Box>
        )}
      </DialogTitle>
      <DialogContent sx={{ px: 1.5, pb: 2 }}>
        {!isAuthenticated ? (
          <Box sx={{ px: 1.5, py: 3, textAlign: 'center' }}>
            <Box sx={{ fontSize: 14, color: 'text.secondary', mb: 2 }}>登录后可以建自己的歌单,换设备也在。</Box>
            <Button variant="contained" onClick={() => router.push(loginHref())}>
              去登录
            </Button>
          </Box>
        ) : (
          <>
            {creating ? (
              <Box sx={{ px: 1.5, py: 1, display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  autoFocus
                  fullWidth
                  size="small"
                  label="歌单名称"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitCreate()}
                  slotProps={{ htmlInput: { maxLength: 40 } }}
                  disabled={busy}
                />
                <Button variant="contained" onClick={submitCreate} disabled={busy} sx={{ flexShrink: 0, height: 40 }}>
                  {create.isPending ? <CircularProgress size={18} color="inherit" /> : '创建'}
                </Button>
              </Box>
            ) : (
              <Row
                onClick={() => {
                  setName(suggestName?.slice(0, 40) ?? '');
                  setCreating(true);
                }}
                cover={
                  <Box sx={{ width: 44, height: 44, borderRadius: 1.5, border: '1.5px dashed', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'primary.main' }}>
                    <AddRoundedIcon />
                  </Box>
                }
                title="新建歌单"
              />
            )}

            {error && <Box sx={{ px: 1.5, py: 0.5, fontSize: 12, color: 'error.main' }}>{error}</Box>}

            {lists.isLoading ? (
              <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={22} />
              </Box>
            ) : lists.isError ? (
              <Box sx={{ px: 1.5, py: 2, fontSize: 13, color: 'text.secondary' }}>歌单加载失败:{formatApiError(lists.error)}</Box>
            ) : (
              <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
                {items.map((l) => (
                  <Row
                    key={String(l.id)}
                    disabled={busy}
                    onClick={() => {
                      setError('');
                      add.mutate(l);
                    }}
                    cover={<PlaylistCover covers={l.covers} coverUrl={l.coverUrl} size={44} />}
                    title={l.name}
                    subtitle={`${l.itemCount} 首${l.isPublic ? ' · 公开' : ''}`}
                    trailing={
                      String(doneId) === String(l.id) ? (
                        <CheckRoundedIcon color="success" fontSize="small" />
                      ) : add.isPending && String(add.variables?.id) === String(l.id) ? (
                        <CircularProgress size={16} />
                      ) : null
                    }
                  />
                ))}
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({
  cover,
  title,
  subtitle,
  trailing,
  onClick,
  disabled,
}: {
  cover: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      sx={{
        all: 'unset',
        boxSizing: 'border-box',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 1,
        borderRadius: 2,
        cursor: disabled ? 'default' : 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
      }}
    >
      {cover}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</Box>
        {subtitle && <Box sx={{ fontSize: 12, color: 'text.secondary' }}>{subtitle}</Box>}
      </Box>
      {trailing}
    </Box>
  );
}
