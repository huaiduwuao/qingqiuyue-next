'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import HdRoundedIcon from '@mui/icons-material/HdRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { myPage } from '@/apis/module-content';
import type { ModuleContentItem } from '@/apis/module-content';
import { RelativeTime } from '@/components/common/RelativeTime';
import { TYPE_LABEL } from '@/lib/contentRoute';
import { gradient2 } from '@/constants/gradients';

type SelectPayload = {
  /** 内容 id — 传 VIDEO 类型时是 hd 接口返回的字符串;非 VIDEO 是数字 */
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
  selectedType: 'video' | string;
  onSelectItem?: (item: SelectPayload) => void;
  /** 通过 setSnack 反馈错误(msg 字符串即可) */
  onError?: (msg: string) => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  publish: { label: '已发布', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)' },
  published: { label: '已发布', color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)' },
  reviewing: { label: '审核中', color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)' },
  review_failed: { label: '未通过', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)' },
  un_publish: { label: '已下架', color: 'text.disabled', bg: 'action.hover' },
  transcoding: { label: '转码中', color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.12)' },
  failed: { label: '失败', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)' },
};

function formatCount(n: number | undefined): string {
  const num = n ?? 0;
  if (num >= 10000) return `${(num / 10000).toFixed(1)}w`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return String(num);
}

/**
 * 统一的内容列表 — 跨类型显示作者名下所有内容。
 *
 * VIDEO 类型:走专用 HD 列表(本组件只是 placeholder,真正显示由 dispatcher 用
 * hd-publish 原生实现)。其它类型通过 myPage({ contentType }) 拉。
 */
export default function UnifiedContentList({ selectedType, onSelectItem }: Props) {
  // 非 VIDEO 的混合列表
  const wantBackendType = selectedType === 'video' ? '' : selectedType;
  const enabled = selectedType !== 'video';

  const { data, isLoading } = useQuery({
    queryKey: ['publish-hub-list', wantBackendType],
    queryFn: async () => {
        const res = await myPage(
        wantBackendType ? { contentType: wantBackendType.toUpperCase(), pageSize: 50 } : { pageSize: 50 },
      );
      return (res.list ?? []) as ModuleContentItem[];
    },
    enabled,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });

  const items: ModuleContentItem[] = data ?? [];

  if (!enabled) {
    // VIDEO 由 dispatcher 自己渲染 HD 列表(里面含分辨率/HDR/审核/极速通道
    // 详情,远比通用简化版丰富)。
    return null;
  }

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        p: 2.5,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'text.primary' }}>
          已发布内容 ({items.length})
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ py: 4 }}>
          <LinearProgress />
        </Box>
      ) : items.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 6,
            color: 'text.disabled',
            fontSize: 13,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1.5,
          }}
        >
          暂无该类型的发布内容
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {items.map((item) => {
            const sm = STATUS_LABELS[item.status] ?? STATUS_LABELS.published;
            const cover = item.coverUrl || item.cover || gradient2('#5B8DEF', '#8B5CF6');
            const typeLabel = TYPE_LABEL[item.contentType] ?? item.contentType;
            return (
              <Box
                key={`${item.contentType}-${item.id}`}
                onClick={() =>
                  onSelectItem?.({
                    id: item.id,
                    title: item.title,
                    cover: item.coverUrl || item.cover,
                    contentType: item.contentType,
                    createdAt: item.createTime ? new Date(item.createTime).getTime() : Date.now(),
                    views: item.readNum,
                    likes: item.agreeNum,
                    comments: item.commentNum,
                    status: item.status,
                  })
                }
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  gap: 2,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                  '&:hover': { borderColor: sm.color },
                }}
              >
                <Box
                  sx={{
                    width: 88,
                    height: 56,
                    borderRadius: 1,
                    background: cover,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    flexShrink: 0,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 4,
                      left: 4,
                      px: 0.5,
                      py: 0.1,
                      borderRadius: 0.5,
                      bgcolor: 'rgba(15, 23, 42, 0.65)',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    {typeLabel}
                  </Box>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.25,
                        px: 0.5,
                        py: 0.05,
                        borderRadius: 0.5,
                        bgcolor: sm.bg,
                        color: sm.color,
                        fontSize: 9,
                        fontWeight: 700,
                      }}
                    >
                      {sm.label}
                    </Box>
                  </Box>
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'text.primary',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.title}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: 'text.disabled' }}>
                    发布于 {<RelativeTime ts={item.createTime ? new Date(item.createTime).getTime() : Date.now()} fallback="" />}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                    👁 {formatCount(item.readNum)}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>
                    ❤ {formatCount(item.agreeNum)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
