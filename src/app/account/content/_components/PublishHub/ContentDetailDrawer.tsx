'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Drawer from '@mui/material/Drawer';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import { getDetailRoute } from '@/lib/contentRoute';
import { RelativeTime } from '@/components/common/RelativeTime';

type SelectPayload = {
  id: string | number;
  title: string;
  cover?: string;
  contentType: string;
  createdAt: number;
  views?: number;
  likes?: number;
  comments?: number;
  status: string;
};

interface Props {
  open: boolean;
  payload: SelectPayload | null;
  onClose: () => void;
  /** 如果业务方想自己处理跳转(比如 VIDEO 走自有原播放器),提供这个 prop */
  onNavigate?: (payload: SelectPayload) => void;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  publish: { label: '已发布', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)' },
  published: { label: '已发布', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)' },
  reviewing: { label: '审核中', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)' },
  review_failed: { label: '审核未通过', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)' },
  un_publish: { label: '已下架', color: 'text.disabled', bg: 'action.hover' },
};

function formatCount(n: number | undefined): string {
  const num = n ?? 0;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}w`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

/**
 * 通用右滑 Drawer — 显示某个非 VIDEO 内容的精简详情。
 * VIDEO 类型由 dispatcher 自己用原 hd-publish 的 Drawer(含分辨率/HDR/
 * 审核/极速通道/申诉),不经过本组件。
 */
export default function ContentDetailDrawer({ open, payload, onClose, onNavigate }: Props) {
  const router = useRouter();
  if (!payload) return null;
  const sm = STATUS_META[payload.status] ?? STATUS_META.published;
  const isVideo = payload.contentType === 'VIDEO';

  const handleViewDetail = () => {
    if (onNavigate) {
      onNavigate(payload);
      return;
    }
    // PICTURE / IMAGE-detail:目前 detail 路由只有占位,跳不到就走 fallback
    const route = getDetailRoute(payload.contentType, payload.id);
    if (route) {
      router.push(route);
    } else {
      // 没详情路由(罕见)— 不动作,只保留 drawer
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: { sx: { width: { xs: '100%', sm: 480 }, bgcolor: 'background.paper' } },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
            内容详情
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* 封面 */}
          <Box
            sx={{
              width: '100%',
              aspectRatio: '16/9',
              borderRadius: 1.5,
              background: payload.cover,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {!payload.cover && <MovieFilterRoundedIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.4)' }} />}
          </Box>

          {/* 标题 + 状态 + 计数 */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.5,
                  bgcolor: sm.bg,
                  color: sm.color,
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {sm.label}
              </Box>
              {isVideo && (
                <Chip
                  size="small"
                  label="VIDEO"
                  sx={{
                    height: 18,
                    fontSize: 9,
                    fontWeight: 700,
                    bgcolor: 'rgba(254, 44, 85, 0.12)',
                    color: '#FE2C55',
                    '& .MuiChip-label': { px: 0.5 },
                  }}
                />
              )}
            </Box>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
              {payload.title}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.disabled' }}>
              发布于 {<RelativeTime ts={payload.createdAt} fallback="" />}
            </Typography>
          </Box>

          {/* 数据表现 */}
          <Box
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: 'rgba(93, 219, 150, 0.06)',
              border: '1px solid rgba(93, 219, 150, 0.3)',
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>
              数据表现
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>播放</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                  {formatCount(payload.views)}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>点赞</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                  {formatCount(payload.likes)}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: 9, color: 'text.disabled' }}>评论</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>
                  {formatCount(payload.comments)}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1 }}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<VisibilityRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={handleViewDetail}
            sx={{
              textTransform: 'none',
              fontSize: 12,
              borderColor: 'divider',
              color: 'text.primary',
            }}
          >
            查看详情页
          </Button>
          <Button onClick={onClose} sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}>
            关闭
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
