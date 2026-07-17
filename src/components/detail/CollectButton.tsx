'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import PhotoAlbumRoundedIcon from '@mui/icons-material/PhotoAlbumRounded';
import TopicRoundedIcon from '@mui/icons-material/TopicRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { collectContent } from '@/apis/global';
import { getMyLists, createMyList, addToMyList, quickCollect, checkCollected, type MyListType, type MyListItem } from '@/apis/my-list';
import { formatApiError } from '@/lib/api/client';

type ListMeta = {
  label: string;
  color: string;
  Icon: React.ElementType;
};

const LIST_TYPE_META: Record<MyListType, ListMeta> = {
  playlist: { label: '歌单', color: '#25F4EE', Icon: MusicNoteRoundedIcon },
  album: { label: '图集', color: '#FFB400', Icon: PhotoAlbumRoundedIcon },
  topic: { label: '专题', color: '#FE2C55', Icon: TopicRoundedIcon },
  bookshelf: { label: '书架', color: '#5DDB96', Icon: MenuBookRoundedIcon },
};

// 根据内容类型确定收藏夹类型
function getListTypeByContentType(contentType: string): MyListType {
  const type = contentType?.toLowerCase() || '';
  if (type.includes('music')) return 'playlist';
  if (type.includes('picture') || type.includes('image')) return 'album';
  if (type.includes('novel') || type.includes('comics')) return 'bookshelf';
  return 'topic';
}

interface CollectButtonProps {
  /** 内容 ID */
  contentId: number | string;
  /** 内容类型: video, music, novel, comics, film, animation, teleplay, vshow, news, article, picture */
  contentType?: string;
  /** 初始收藏状态 */
  initialCollected?: boolean;
  /** 收藏数 */
  collectCount?: number;
  /** 是否显示为 IconButton（默认）还是 Button */
  variant?: 'icon' | 'button';
  /** 图标大小 */
  iconSize?: 'small' | 'medium';
  /** 自定义颜色 */
  color?: string;
  /** 紧凑模式 */
  compact?: boolean;
  className?: string;
  onCollectedChange?: (collected: boolean) => void;
}

export function CollectButton({
  contentId,
  contentType = 'video',
  initialCollected = false,
  collectCount = 0,
  variant = 'icon',
  iconSize = 'medium',
  color,
  compact = false,
  className,
  onCollectedChange,
}: CollectButtonProps) {
  const queryClient = useQueryClient();
  const numId = Number(contentId);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const notify = useCallback((message: string, severity: 'success' | 'error' = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  // 获取收藏夹列表
  const { data: listsData, isLoading: listsLoading } = useQuery({
    queryKey: ['my-lists-for-collect'],
    queryFn: () => getMyLists(),
    staleTime: 30 * 1000,
  });

  const lists: MyListItem[] = (listsData?.list ?? []).map((l: any) => ({
    ...l,
    id: Number(l.id),
  }));

  // 按类型分组的收藏夹
  const listType = getListTypeByContentType(contentType);
  const targetLists = lists.filter((l) => l.type === listType);

  // 检查是否已收藏（查询第一个匹配的收藏夹）
  const { data: collectedData } = useQuery({
    queryKey: ['check-collected', numId],
    queryFn: () => checkCollected(numId),
    staleTime: 10 * 1000,
    enabled: !!numId,
  });

  const isCollected = collectedData?.collected ?? initialCollected;

  // 快捷收藏
  const quickCollectMutation = useMutation({
    mutationFn: () => quickCollect(numId, contentType),
    onSuccess: (res) => {
      const collected = res.collected;
      onCollectedChange?.(collected);
      setAnchorEl(null);
      queryClient.invalidateQueries({ queryKey: ['check-collected', numId] });
      notify(collected ? '已收藏' : '已取消收藏');
    },
    onError: (err) => {
      notify(formatApiError(err), 'error');
    },
  });

  // 添加到指定收藏夹
  const addToListMutation = useMutation({
    mutationFn: (listId: number) => addToMyList(listId, [numId]),
    onSuccess: () => {
      onCollectedChange?.(true);
      setAnchorEl(null);
      queryClient.invalidateQueries({ queryKey: ['check-collected', numId] });
      notify('已添加到收藏夹');
    },
    onError: (err) => {
      notify(formatApiError(err), 'error');
    },
  });

  // 创建新收藏夹并添加
  const createAndAddMutation = useMutation({
    mutationFn: async () => {
      const listTypeForCreate = listType;
      const res = await createMyList({
        name: newListName.trim() || `${LIST_TYPE_META[listTypeForCreate]?.label || '收藏'} ${new Date().toLocaleDateString()}`,
        type: listTypeForCreate,
        isPublic: false,
      });
      if (res.id) {
        await addToMyList(res.id, [numId]);
      }
      return res;
    },
    onSuccess: () => {
      onCollectedChange?.(true);
      setCreateDialogOpen(false);
      setNewListName('');
      setAnchorEl(null);
      queryClient.invalidateQueries({ queryKey: ['my-lists'] });
      queryClient.invalidateQueries({ queryKey: ['check-collected', numId] });
      notify('已创建并添加');
    },
    onError: (err) => {
      notify(formatApiError(err), 'error');
    },
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleQuickCollect = () => {
    quickCollectMutation.mutate();
  };

  const handleAddToList = (listId: number) => {
    addToListMutation.mutate(listId);
  };

  const handleCreateAndAdd = () => {
    createAndAddMutation.mutate();
  };

  const iconButtonProps = {
    size: iconSize === 'small' ? 'small' as const : 'medium' as const,
    onClick: handleMenuOpen,
    disabled: quickCollectMutation.isPending || addToListMutation.isPending || createAndAddMutation.isPending,
    className,
    sx: {
      color: color || (isCollected ? 'primary.main' : 'text.tertiary'),
      transition: 'color 0.15s',
      '&:hover': {
        color: color || 'primary.main',
      },
    },
  };

  if (variant === 'button') {
    return (
      <>
        <Button
          variant={isCollected ? 'contained' : 'outlined'}
          color={isCollected ? 'primary' : 'inherit'}
          startIcon={isCollected ? <FavoriteIcon /> : <FavoriteBorderIcon />}
          onClick={handleMenuOpen}
          disabled={quickCollectMutation.isPending}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          {isCollected ? '已收藏' : '收藏'}
          {collectCount > 0 && ` (${collectCount})`}
        </Button>

        <CollectMenu
          anchorEl={anchorEl}
          onClose={handleMenuClose}
          listsLoading={listsLoading}
          lists={lists}
          targetLists={targetLists}
          listType={listType}
          isCollected={isCollected}
          onQuickCollect={handleQuickCollect}
          onAddToList={handleAddToList}
          onCreateNew={() => {
            setCreateDialogOpen(true);
          }}
          quickCollecting={quickCollectMutation.isPending}
          addingToList={addToListMutation.isPending}
        />

        <CreateListDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          listType={listType}
          listName={newListName}
          onListNameChange={setNewListName}
          onConfirm={handleCreateAndAdd}
          loading={createAndAddMutation.isPending}
        />

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
      </>
    );
  }

  return (
    <>
      <IconButton {...iconButtonProps}>
        {isCollected ? <FavoriteIcon /> : <FavoriteBorderIcon />}
      </IconButton>

      <CollectMenu
        anchorEl={anchorEl}
        onClose={handleMenuClose}
        listsLoading={listsLoading}
        lists={lists}
        targetLists={targetLists}
        listType={listType}
        isCollected={isCollected}
        onQuickCollect={handleQuickCollect}
        onAddToList={handleAddToList}
        onCreateNew={() => {
          setCreateDialogOpen(true);
        }}
        quickCollecting={quickCollectMutation.isPending}
        addingToList={addToListMutation.isPending}
      />

      <CreateListDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        listType={listType}
        listName={newListName}
        onListNameChange={setNewListName}
        onConfirm={handleCreateAndAdd}
        loading={createAndAddMutation.isPending}
      />

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
    </>
  );
}

// 收藏菜单
interface CollectMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  listsLoading: boolean;
  lists: MyListItem[];
  targetLists: MyListItem[];
  listType: MyListType;
  isCollected: boolean;
  onQuickCollect: () => void;
  onAddToList: (listId: number) => void;
  onCreateNew: () => void;
  quickCollecting: boolean;
  addingToList: boolean;
}

function CollectMenu({
  anchorEl,
  onClose,
  listsLoading,
  lists,
  targetLists,
  listType,
  isCollected,
  onQuickCollect,
  onAddToList,
  onCreateNew,
  quickCollecting,
  addingToList,
}: CollectMenuProps) {
  const meta = LIST_TYPE_META[listType] || LIST_TYPE_META.topic;
  const Icon = meta.Icon;

  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: {
            minWidth: 220,
            maxHeight: 360,
            bgcolor: 'background.paper',
          },
        },
      }}
    >
      {/* 快捷收藏 */}
      <MenuItem
        onClick={() => {
          onQuickCollect();
          onClose();
        }}
        disabled={quickCollecting}
        sx={{ py: 1.25 }}
      >
        {quickCollecting ? (
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
            <CircularProgress size={20} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1, minWidth: 24 }}>
            {isCollected ? (
              <FavoriteIcon sx={{ color: 'error.main', fontSize: 20 }} />
            ) : (
              <FavoriteBorderIcon sx={{ fontSize: 20 }} />
            )}
          </Box>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
            {isCollected ? '取消收藏' : '快捷收藏'}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {`添加到"我的${meta.label}"`}
          </Typography>
        </Box>
      </MenuItem>

      <Divider />

      {/* 已有收藏夹列表 */}
      {listsLoading ? (
        <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={20} />
        </Box>
      ) : targetLists.length > 0 ? (
        targetLists.map((list) => {
          const listMeta = LIST_TYPE_META[list.type as MyListType] || LIST_TYPE_META.topic;
          const ListIcon = listMeta.Icon;
          return (
            <MenuItem
              key={list.id}
              onClick={() => {
                onAddToList(list.id);
                onClose();
              }}
              disabled={addingToList}
              sx={{ py: 1, display: 'flex', alignItems: 'center' }}
            >
              <Box sx={{ minWidth: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ListIcon sx={{ fontSize: 18, color: listMeta.color }} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {list.name}
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {`${list.itemCount} 项内容`}
                </Typography>
              </Box>
            </MenuItem>
          );
        })
      ) : (
        <Box sx={{ py: 2, px: 2, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            暂无{meta.label}
          </Typography>
        </Box>
      )}

      <Divider />

      {/* 创建新收藏夹 */}
      <MenuItem
        onClick={() => {
          onCreateNew();
        }}
        sx={{ py: 1, display: 'flex', alignItems: 'center' }}
      >
        <Box sx={{ minWidth: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AddRoundedIcon sx={{ fontSize: 20, color: meta.color }} />
        </Box>
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary', ml: 1 }}>
          {`新建${meta.label}`}
        </Typography>
      </MenuItem>
    </Menu>
  );
}

// 创建收藏夹对话框
interface CreateListDialogProps {
  open: boolean;
  onClose: () => void;
  listType: MyListType;
  listName: string;
  onListNameChange: (name: string) => void;
  onConfirm: () => void;
  loading: boolean;
}

function CreateListDialog({
  open,
  onClose,
  listType,
  listName,
  onListNameChange,
  onConfirm,
  loading,
}: CreateListDialogProps) {
  const meta = LIST_TYPE_META[listType] || LIST_TYPE_META.topic;
  const Icon = meta.Icon;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: { bgcolor: 'background.paper', backgroundImage: 'none' },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon sx={{ color: meta.color, fontSize: 24 }} />
          <Typography sx={{ fontSize: 16, fontWeight: 700 }}>新建{meta.label}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="收藏夹名称"
          value={listName}
          onChange={(e) => onListNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onConfirm();
            }
          }}
          placeholder={`我的${meta.label}`}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none' }}>
          取消
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{
            textTransform: 'none',
            background: `linear-gradient(90deg, ${meta.color} 0%, ${meta.color}80 100%)`,
            '&:hover': { filter: 'brightness(1.1)' },
          }}
        >
          创建并添加
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CollectButton;
