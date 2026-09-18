'use client';

/**
 * 私信「分享」选择器:挑一件站内内容(作品 / 收藏 / 悬赏任务 / 歌单 / 活动)发进会话。
 *
 * 页签由后端 /msg/share/candidates 的 sources 给出,前端不写死 —— 后端加一个来源
 * 这里就多一个页签,不用两边一起改。
 */

import React, { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import SearchIcon from '@mui/icons-material/Search';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { useQuery } from '@tanstack/react-query';
import { getShareCandidates, type ShareCandidate, type ShareKind } from '@/apis/msg';

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (kind: ShareKind, id: string, note: string) => void | Promise<void>;
  /** 正在发送:按钮转圈,避免重复提交 */
  sending?: boolean;
}

/**
 * 选择器本体只在打开时挂载 —— 关掉即卸载,上次选中的条目和附言随之消失。
 * 用 effect 在 open 变 false 时逐个 setState 复位也能做到,但那会多跑一轮渲染,
 * 而且每加一个字段就得记得去那个 effect 里补一行。
 */
export default function SharePicker({ open, onClose, onPick, sending }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      {open && <PickerBody onClose={onClose} onPick={onPick} sending={sending} />}
    </Dialog>
  );
}

function PickerBody({ onClose, onPick, sending }: Omit<Props, 'open'>) {
  const [source, setSource] = useState('work');
  const [keyword, setKeyword] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<ShareCandidate | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => clearTimeout(t);
  }, [keyword]);

  const { data, isLoading } = useQuery({
    queryKey: ['share-candidates', source, debounced],
    queryFn: () => getShareCandidates(source, debounced),
    staleTime: 30_000,
  });

  const sources = useMemo(
    () => data?.sources ?? [{ key: 'work', label: '我的作品', kind: 'work' as ShareKind }],
    [data?.sources],
  );
  const list = data?.list ?? [];

  return (
    <>
      <DialogTitle sx={{ fontSize: 15, fontWeight: 700, pb: 1 }}>分享到私信</DialogTitle>
      <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: 'column', height: 440 }}>
        <Tabs
          value={sources.some((s) => s.key === source) ? source : sources[0].key}
          onChange={(_, v) => {
            setSource(v);
            setPicked(null);
          }}
          variant="scrollable"
          scrollButtons={false}
          sx={{ minHeight: 36, px: 1, flexShrink: 0, '& .MuiTab-root': { minHeight: 36, fontSize: 12, textTransform: 'none' } }}
        >
          {sources.map((s) => (
            <Tab key={s.key} value={s.key} label={s.label} />
          ))}
        </Tabs>

        <Box sx={{ px: 1.5, py: 1, flexShrink: 0 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="搜索标题"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16 }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, px: 1 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 0.5 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" height={56} />
              ))}
            </Box>
          ) : list.length === 0 ? (
            <Box sx={{ py: 6, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: 'text.disabled' }}>这里还没有可分享的内容</Typography>
            </Box>
          ) : (
            list.map((item) => {
              const selected = picked?.kind === item.kind && picked?.id === item.id;
              return (
                <Box
                  key={`${item.kind}-${item.id}`}
                  onClick={() => setPicked(item)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    p: 1,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: selected ? 'primary.main' : 'transparent',
                    bgcolor: selected ? 'action.selected' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      borderRadius: 1,
                      bgcolor: 'action.selected',
                      backgroundImage: item.cover ? `url("${item.cover}")` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {!item.cover && <ImageOutlinedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap sx={{ fontSize: 13, fontWeight: 500 }}>
                      {item.title || '未命名'}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: 11, color: 'text.secondary' }}>
                      {[item.badge, item.meta, item.subtitle].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

        {picked && (
          <Box sx={{ px: 1.5, py: 1, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="说点什么(可不填)"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }} variant="text">
          取消
        </Button>
        <Button
          variant="contained"
          disabled={!picked || !!sending}
          onClick={() => picked && onPick(picked.kind, picked.id, note.trim())}
          sx={{ textTransform: 'none' }}
        >
          {sending ? '发送中…' : '发送'}
        </Button>
      </DialogActions>
    </>
  );
}
