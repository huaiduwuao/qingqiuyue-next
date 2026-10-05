'use client';

import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import VideoFileRoundedIcon from '@mui/icons-material/VideoFileRounded';
import { RelativeTime } from '@/components/common/RelativeTime';
import type { HdFilter, HdVideo } from './data';
import { RESOLUTION_META, coverBackground } from './hdPublishModel';
import { STATUS_META } from './hdPublishMeta';

const FILTERS: { id: HdFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'transcoding', label: '转码中' },
  { id: 'reviewing', label: '审核中' },
  { id: 'review_failed', label: '审核未通过' },
  { id: 'published', label: '已发布' },
  { id: 'failed', label: '转码失败' },
];

/**
 * 我的视频列表:点卡片看详情(抽屉里有重新转码 / 送审 / 发布 / 删除),卡片上直接「换封面」。
 * 47b567ef 合并发布入口时整块列表被删,详情抽屉、换封面、审核历史都没了入口。
 */
export const HdVideoList = React.memo(function HdVideoList({
  videos,
  onOpenDetail,
  onChangeCover,
  onOpenReviewHistory,
}: {
  videos: HdVideo[];
  onOpenDetail: (id: string) => void;
  onChangeCover: (id: string) => void;
  onOpenReviewHistory: () => void;
}) {
  const [filter, setFilter] = useState<HdFilter>('all');
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: videos.length };
    for (const v of videos) c[v.status] = (c[v.status] ?? 0) + 1;
    return c;
  }, [videos]);
  const shown = filter === 'all' ? videos : videos.filter((v) => v.status === filter);

  return (
    <Box
      component="section"
      aria-label="我的视频"
      sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', p: { xs: 1.5, sm: 2 } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'text.primary' }}>我的视频</Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<HistoryRoundedIcon sx={{ fontSize: 14 }} />}
          onClick={onOpenReviewHistory}
          sx={{ textTransform: 'none', fontSize: 12, color: 'text.secondary' }}
        >
          审核历史
        </Button>
      </Box>
      <Tabs
        value={filter}
        onChange={(_, v: HdFilter) => setFilter(v)}
        variant="scrollable"
        scrollButtons={false}
        sx={{ minHeight: 0, mb: 1, '& .MuiTab-root': { minHeight: 0, py: 0.5, px: 1.25, fontSize: 12, textTransform: 'none', minWidth: 0 } }}
      >
        {FILTERS.map((f) => (
          <Tab key={f.id} value={f.id} label={`${f.label} ${counts[f.id] ?? 0}`} />
        ))}
      </Tabs>

      {shown.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled', fontSize: 13 }}>
          {videos.length === 0 ? '还没有视频,上传一个试试' : '没有这个状态的视频'}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {shown.map((v) => {
            const sm = STATUS_META[v.status] ?? STATUS_META.transcoding;
            const rm = RESOLUTION_META[v.resolution];
            return (
              <Box
                key={v.id}
                sx={{
                  p: 1,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  gap: 1.5,
                  alignItems: 'center',
                  minWidth: 0,
                }}
              >
                <Box
                  component="button"
                  type="button"
                  aria-label={`查看《${v.title}》详情`}
                  onClick={() => onOpenDetail(v.id)}
                  sx={{
                    p: 0,
                    border: 0,
                    width: { xs: 96, sm: 128 },
                    aspectRatio: '16/9',
                    borderRadius: 1,
                    flexShrink: 0,
                    cursor: 'pointer',
                    bgcolor: 'action.hover',
                    background: coverBackground(v.cover),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {!v.hasCover && <VideoFileRoundedIcon sx={{ fontSize: 28, color: 'rgba(255,255,255,0.6)' }} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    onClick={() => onOpenDetail(v.id)}
                    sx={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'text.primary',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    {v.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.25,
                        px: 0.5,
                        borderRadius: 0.5,
                        bgcolor: sm.bg,
                        color: sm.color,
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      {sm.icon}
                      {sm.label}
                    </Box>
                    {rm && (
                      <Box sx={{ px: 0.5, borderRadius: 0.5, bgcolor: rm.bg, color: rm.color, fontSize: 10, fontWeight: 700 }}>{rm.label}</Box>
                    )}
                    <Typography component="span" sx={{ fontSize: 11, color: 'text.disabled' }}>
                      <RelativeTime ts={v.uploadedAt} />
                    </Typography>
                  </Box>
                </Box>
                <Button
                  size="small"
                  startIcon={<ImageRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={() => onChangeCover(v.id)}
                  sx={{ textTransform: 'none', fontSize: 12, flexShrink: 0, color: 'text.secondary' }}
                >
                  换封面
                </Button>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
});
