'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import WatchLaterOutlinedIcon from '@mui/icons-material/WatchLaterOutlined';
import { getMarkStatus, setMark } from '@/apis/content-mark';
import type { Interaction } from '@/apis/interaction';
import { formatApiError } from '@/lib/api/client';
import { toEntityId, type EntityId } from '@/lib/id';
import { interactionQueryKey, useContentInteraction } from '@/hooks/useContentInteraction';

type Severity = 'success' | 'error' | 'info';

interface CollectButtonProps {
  /** 内容 ID */
  contentId: number | string;
  /** 内容类型(保留兼容;收藏不再按类型分收藏夹) */
  contentType?: string;
  /** 初始收藏状态(/interaction 还没回来之前用) */
  initialCollected?: boolean;
  /** 收藏数(页面已知的基数) */
  collectCount?: number;
  /** 是否显示为 IconButton（默认）还是 Button */
  variant?: 'icon' | 'button';
  /** 图标大小 */
  iconSize?: 'small' | 'medium';
  /** 自定义颜色 */
  color?: string;
  /** 紧凑模式(保留兼容) */
  compact?: boolean;
  className?: string;
  onCollectedChange?: (collected: boolean) => void;
}

/**
 * 收藏按钮(各详情页通用),菜单里是「收藏 / 取消收藏」和「稍后再看」。
 *
 * 收藏只有一份真相:Doris user_content_collect(type=collect),「我的收藏」读的也是它。
 * 以前这里写的是 user_my_list_content —— 线上根本没有这张表,点了收藏全部丢失;
 * 按钮也不知道自己是否已收藏,刷新后永远是空心。现在状态和计数来自 /interaction,
 * 和页面上其它互动按钮共用同一份缓存;每次操作都有成功 / 失败提示。
 */
export function CollectButton({
  contentId,
  initialCollected = false,
  collectCount,
  variant = 'icon',
  iconSize = 'medium',
  color,
  className,
  onCollectedChange,
}: CollectButtonProps) {
  const queryClient = useQueryClient();
  // 内容 id 超 2^53,Number() 会截断成另一条内容 —— 收藏 / 稍后再看会记到别处
  const cid: EntityId = toEntityId(contentId) ?? 0;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: Severity }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const notify = useCallback((message: string, severity: Severity = 'success') => {
    setSnack({ open: true, message, severity });
  }, []);

  const interaction = useContentInteraction(contentId, { notify, baseCollects: collectCount });
  const isCollected = interaction.ready ? interaction.collected : initialCollected;
  const count = interaction.ready ? interaction.collectCount : collectCount ?? 0;

  // 稍后再看:和收藏相互独立,列表在个人中心「稍后再看」
  const { data: markData } = useQuery({
    queryKey: ['mark', cid],
    queryFn: () => getMarkStatus(cid),
    staleTime: 10 * 1000,
    enabled: !!cid,
  });
  const inWatchLater = !!markData?.watchlater;
  const watchLaterMutation = useMutation({
    mutationFn: () => setMark(cid, 'watchlater', !inWatchLater),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mark', cid] });
      notify(inWatchLater ? '已移出稍后再看' : '已加入稍后再看');
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

  const handleToggleCollect = async () => {
    setAnchorEl(null);
    await interaction.toggleCollect();
    const latest = queryClient.getQueryData<Interaction>(interactionQueryKey(contentId));
    if (latest) onCollectedChange?.(latest.collected);
  };

  const menu = (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={handleMenuClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { minWidth: 200, bgcolor: 'background.paper' } } }}
    >
      <MenuItem onClick={() => void handleToggleCollect()} disabled={interaction.collectBusy} sx={{ py: 1.25 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 1, minWidth: 24 }}>
          {interaction.collectBusy ? (
            <CircularProgress size={18} />
          ) : isCollected ? (
            <FavoriteIcon sx={{ color: 'error.main', fontSize: 20 }} />
          ) : (
            <FavoriteBorderIcon sx={{ fontSize: 20 }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
            {isCollected ? '取消收藏' : '收藏'}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {isCollected ? '已在「我的收藏」' : '收藏后可在「我的收藏」查看'}
          </Typography>
        </Box>
      </MenuItem>

      <MenuItem
        onClick={() => {
          watchLaterMutation.mutate();
          handleMenuClose();
        }}
        disabled={watchLaterMutation.isPending}
        sx={{ py: 1.25 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 1, minWidth: 24 }}>
          {inWatchLater ? (
            <WatchLaterIcon sx={{ color: '#8B5CF6', fontSize: 20 }} />
          ) : (
            <WatchLaterOutlinedIcon sx={{ fontSize: 20 }} />
          )}
        </Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.primary' }}>
          {inWatchLater ? '移出稍后再看' : '稍后再看'}
        </Typography>
      </MenuItem>
    </Menu>
  );

  const snackbar = (
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
  );

  if (variant === 'button') {
    return (
      <>
        <Button
          variant={isCollected ? 'contained' : 'outlined'}
          color={isCollected ? 'primary' : 'inherit'}
          startIcon={isCollected ? <FavoriteIcon /> : <FavoriteBorderIcon />}
          onClick={handleMenuOpen}
          disabled={interaction.collectBusy}
          className={className}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          {isCollected ? '已收藏' : '收藏'}
          {count > 0 && ` (${count})`}
        </Button>
        {menu}
        {snackbar}
      </>
    );
  }

  return (
    <>
      <IconButton
        size={iconSize === 'small' ? 'small' : 'medium'}
        onClick={handleMenuOpen}
        disabled={interaction.collectBusy}
        className={className}
        aria-label={isCollected ? '已收藏' : '收藏'}
        sx={{
          color: color || (isCollected ? 'primary.main' : 'text.tertiary'),
          transition: 'color 0.15s',
          '&:hover': { color: color || 'primary.main' },
        }}
      >
        {isCollected ? <FavoriteIcon /> : <FavoriteBorderIcon />}
      </IconButton>
      {menu}
      {snackbar}
    </>
  );
}

export default CollectButton;
