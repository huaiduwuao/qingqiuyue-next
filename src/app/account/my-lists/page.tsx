'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import Drawer from '@mui/material/Drawer';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Skeleton from '@mui/material/Skeleton';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import PhotoAlbumRoundedIcon from '@mui/icons-material/PhotoAlbumRounded';
import TopicRoundedIcon from '@mui/icons-material/TopicRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PlaylistPlayRoundedIcon from '@mui/icons-material/PlaylistPlayRounded';
import { getMyLists, createMyList, updateMyList, deleteMyList, type MyListType, type MyListItem } from '@/apis/my-list';

type ListMeta = {
  label: string;
  color: string;
  icon: React.ReactElement<{ sx?: object }>;
};

const LIST_TYPE_META: Record<MyListType, ListMeta> = {
  playlist: { label: '歌单', color: '#25F4EE', icon: <MusicNoteRoundedIcon /> },
  album: { label: '图集', color: '#FFB400', icon: <PhotoAlbumRoundedIcon /> },
  topic: { label: '专题', color: '#FE2C55', icon: <TopicRoundedIcon /> },
  bookshelf: { label: '书架', color: '#5DDB96', icon: <MenuBookRoundedIcon /> },
};

function formatNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

// 渲染带样式的 icon
function ListIcon({ meta, size = 20 }: { meta: ListMeta; size?: number }) {
  return React.cloneElement(meta.icon, { sx: { fontSize: size } } as any);
}

function MyListCard({ item, onEdit, onDelete }: { item: MyListItem; onEdit: () => void; onDelete: () => void }) {
  const router = useRouter();
  const meta = LIST_TYPE_META[item.type] || LIST_TYPE_META.topic;

  return (
    <Box
      onClick={() => router.push(`/account/my-lists/detail?id=${item.id}`)}
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
        '&:hover': { borderColor: meta.color, transform: 'translateY(-2px)' },
      }}
    >
      {/* 封面区 */}
      <Box
        sx={{
          height: 120,
          background: item.coverUrl || `linear-gradient(135deg, ${meta.color}40 0%, ${meta.color}10 100%)`,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ opacity: 0.3, color: meta.color }}>
          <ListIcon meta={meta} size={48} />
        </Box>
        {!item.isPublic && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 600,
              backdropFilter: 'blur(4px)',
            }}
          >
            私密
          </Box>
        )}
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: '#fff',
          }}
        >
          <PlaylistPlayRoundedIcon sx={{ fontSize: 12 }} />
          <Typography sx={{ fontSize: 11, fontWeight: 600 }}>{item.itemCount} 项内容</Typography>
        </Box>
      </Box>

      {/* 文本区 */}
      <Box sx={{ p: 1.5 }}>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 700,
            color: 'text.primary',
            mb: 0.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </Typography>
        {item.description && (
          <Typography
            sx={{
              fontSize: 11,
              color: 'text.secondary',
              mb: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.description}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>{formatNum(item.totalViews)} 浏览</Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
              aria-label="编辑"
            >
              <EditRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
              aria-label="删除"
            >
              <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function EmptyMyList({ type, onCreate }: { type: MyListType; onCreate: () => void }) {
  const meta = LIST_TYPE_META[type];
  return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <Box sx={{ opacity: 0.3, color: meta.color, mb: 1 }}>
        <ListIcon meta={meta} size={56} />
      </Box>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 2 }}>暂无{meta.label}</Typography>
      <Button
        variant="contained"
        startIcon={<AddRoundedIcon />}
        onClick={onCreate}
        sx={{
          textTransform: 'none',
          borderRadius: 1.5,
          background: `linear-gradient(90deg, ${meta.color} 0%, ${meta.color}80 100%)`,
          '&:hover': { filter: 'brightness(1.1)' },
        }}
      >
        创建{meta.label}
      </Button>
    </Box>
  );
}

function CreateListDialog({
  open,
  onClose,
  defaultType,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  defaultType?: MyListType;
  onCreate: (data: { name: string; description: string; type: MyListType; isPublic: boolean }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<MyListType>(defaultType || 'topic');
  const [isPublic, setIsPublic] = useState(true);

  React.useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setType(defaultType || 'topic');
      setIsPublic(true);
    }
  }, [open, defaultType]);

  const canSubmit = name.trim().length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { bgcolor: 'background.paper', backgroundImage: 'none' } } }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, flex: 1 }}>创建收藏夹</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
          {(Object.keys(LIST_TYPE_META) as MyListType[]).map((t) => {
            const meta = LIST_TYPE_META[t];
            const selected = type === t;
            return (
              <Box
                key={t}
                onClick={() => setType(t)}
                sx={{
                  flex: 1,
                  p: 1,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: selected ? meta.color : 'divider',
                  bgcolor: selected ? `${meta.color}1A` : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <Box sx={{ color: selected ? meta.color : 'text.secondary', mb: 0.5, display: 'flex', justifyContent: 'center' }}>
                  <ListIcon meta={meta} size={20} />
                </Box>
                <Typography sx={{ fontSize: 11, color: selected ? meta.color : 'text.secondary', fontWeight: selected ? 600 : 400 }}>
                  {meta.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        <TextField
          label="名称"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 30))}
          fullWidth
          slotProps={{ htmlInput: { maxLength: 30 } }}
          sx={{ mb: 2 }}
        />
        <TextField
          label="描述（可选）"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 100))}
          fullWidth
          multiline
          minRows={2}
          maxRows={3}
          slotProps={{ htmlInput: { maxLength: 100 } }}
          sx={{ mb: 2 }}
        />

        <FormControlLabel
          control={<Switch checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} size="small" />}
          label={<Typography sx={{ fontSize: 12 }}>公开收藏夹</Typography>}
        />
      </Box>
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none', borderRadius: 1.5 }}>
          取消
        </Button>
        <Button
          onClick={() => onCreate({ name: name.trim(), description, type, isPublic })}
          disabled={!canSubmit}
          variant="contained"
          sx={{
            textTransform: 'none',
            borderRadius: 1.5,
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
            '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
          }}
        >
          创建
        </Button>
      </Box>
    </Dialog>
  );
}

function EditListDrawer({
  list,
  onClose,
  onSave,
}: {
  list: MyListItem | null;
  onClose: () => void;
  onSave: (id: number, data: { name?: string; description?: string; isPublic?: boolean }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  React.useEffect(() => {
    if (list) {
      setName(list.name);
      setDescription(list.description || '');
      setIsPublic(list.isPublic);
    }
  }, [list]);

  if (!list) return null;

  const canSubmit = name.trim().length > 0;

  return (
    <Drawer
      anchor="right"
      open={!!list}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 400 }, bgcolor: 'background.paper' } } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, flex: 1 }}>编辑{LIST_TYPE_META[list.type]?.label}</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
        <TextField
          label="名称"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 30))}
          fullWidth
          slotProps={{ htmlInput: { maxLength: 30 } }}
          sx={{ mb: 2 }}
        />
        <TextField
          label="描述（可选）"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 100))}
          fullWidth
          multiline
          minRows={3}
          maxRows={5}
          slotProps={{ htmlInput: { maxLength: 100 } }}
          sx={{ mb: 2 }}
        />

        <FormControlLabel
          control={<Switch checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} size="small" />}
          label={<Typography sx={{ fontSize: 12 }}>公开收藏夹</Typography>}
        />
      </Box>
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none', borderRadius: 1.5 }}>
          取消
        </Button>
        <Button
          onClick={() => {
            onSave(list.id, { name: name.trim(), description, isPublic });
            onClose();
          }}
          disabled={!canSubmit}
          variant="contained"
          sx={{
            textTransform: 'none',
            borderRadius: 1.5,
            background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
            '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
          }}
        >
          保存
        </Button>
      </Box>
    </Drawer>
  );
}

export default function MyListsPage() {
  const [tab, setTab] = useState<MyListType | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MyListItem | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const queryClient = useQueryClient();

  const { data: listsData, isLoading } = useQuery({
    queryKey: ['my-lists', tab],
    queryFn: () => getMyLists(tab === 'all' ? undefined : tab),
    staleTime: 30 * 1000,
  });

  const lists: MyListItem[] = (listsData?.list ?? []).map((l: any) => ({
    ...l,
    id: Number(l.id),
    userId: Number(l.userId),
    itemCount: l.itemCount ?? 0,
    totalViews: l.totalViews ?? 0,
    isPublic: l.isPublic ?? true,
  }));

  const createMutation = useMutation({
    mutationFn: createMyList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-lists'] });
      setSnack({ open: true, message: '收藏夹已创建', severity: 'success' });
      setCreateOpen(false);
    },
    onError: () => {
      setSnack({ open: true, message: '创建失败，请重试', severity: 'error' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateMyList>[1] }) => updateMyList(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-lists'] });
      setSnack({ open: true, message: '已保存', severity: 'success' });
    },
    onError: () => {
      setSnack({ open: true, message: '保存失败，请重试', severity: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMyList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-lists'] });
      setSnack({ open: true, message: '已删除', severity: 'success' });
    },
    onError: () => {
      setSnack({ open: true, message: '删除失败，请重试', severity: 'error' });
    },
  });

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: lists.length };
    (Object.keys(LIST_TYPE_META) as MyListType[]).forEach((t) => {
      c[t] = lists.filter((l) => l.type === t).length;
    });
    return c;
  }, [lists]);

  const filteredLists = tab === 'all' ? lists : lists.filter((l) => l.type === tab);

  const handleCreate = useCallback(
    (data: { name: string; description: string; type: MyListType; isPublic: boolean }) => {
      createMutation.mutate(data);
    },
    [createMutation],
  );

  const handleSave = useCallback(
    (id: number, data: { name?: string; description?: string; isPublic?: boolean }) => {
      updateMutation.mutate({ id, data });
    },
    [updateMutation],
  );

  const handleDelete = useCallback(
    (id: number) => {
      if (confirm('确定要删除这个收藏夹吗？')) {
        deleteMutation.mutate(id);
      }
    },
    [deleteMutation],
  );

  return (
    <Box sx={{ height: 'calc(100dvh - var(--appbar-h, 66px))', overflow: 'auto', overscrollBehavior: 'contain' }}>
      <Box sx={{ maxWidth: 1000, mx: 'auto', p: { xs: 2, md: 3 } }}>
        {/* 标题栏 */}
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'text.primary' }}>我的收藏</Typography>
            <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>
              管理歌单、图集、专题和书架
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{
              textTransform: 'none',
              borderRadius: 1.5,
              background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)',
              '&:hover': { background: 'linear-gradient(90deg, #FE2C55 0%, #FFB400 100%)', filter: 'brightness(1.1)' },
            }}
          >
            新建收藏夹
          </Button>
        </Box>

        {/* 类型筛选 Tab */}
        <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
          <Box
            onClick={() => setTab('all')}
            sx={{
              px: 2,
              py: 0.75,
              borderRadius: 1,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              bgcolor: tab === 'all' ? 'rgba(254, 44, 85, 0.12)' : 'action.hover',
              color: tab === 'all' ? 'primary.main' : 'text.secondary',
              border: '1px solid',
              borderColor: tab === 'all' ? 'primary.main' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            全部 {counts.all}
          </Box>
          {(Object.keys(LIST_TYPE_META) as MyListType[]).map((t) => {
            const meta = LIST_TYPE_META[t];
            const selected = tab === t;
            return (
              <Box
                key={t}
                onClick={() => setTab(t)}
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 1,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: selected ? `${meta.color}1A` : 'action.hover',
                  color: selected ? meta.color : 'text.secondary',
                  border: '1px solid',
                  borderColor: selected ? meta.color : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <ListIcon meta={meta} size={14} />
                {meta.label} {counts[t]}
              </Box>
            );
          })}
        </Box>

        {/* 列表 */}
        {isLoading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            {[1, 2, 3, 4].map((i) => (
              <Box key={i} sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden' }}>
                <Skeleton variant="rectangular" height={120} />
                <Box sx={{ p: 1.5 }}>
                  <Skeleton width="70%" />
                  <Skeleton width="40%" />
                </Box>
              </Box>
            ))}
          </Box>
        ) : filteredLists.length === 0 ? (
          <EmptyMyList type={tab === 'all' ? 'topic' : tab} onCreate={() => setCreateOpen(true)} />
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 2,
            }}
          >
            {filteredLists.map((item) => (
              <MyListCard
                key={item.id}
                item={item}
                onEdit={() => setEditing(item)}
                onDelete={() => handleDelete(item.id)}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* 创建对话框 */}
      <CreateListDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultType={tab === 'all' ? 'topic' : tab}
        onCreate={handleCreate}
      />

      {/* 编辑抽屉 */}
      <EditListDrawer list={editing} onClose={() => setEditing(null)} onSave={handleSave} />

      {/* Toast */}
      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
