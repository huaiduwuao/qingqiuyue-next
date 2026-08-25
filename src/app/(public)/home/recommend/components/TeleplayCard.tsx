'use client';

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useQuery } from '@tanstack/react-query';
import { page as episodePage } from '@/apis/content-teleplay-item';
import VideoPlayer from '@/components/detail/VideoPlayer';
import { CoverImage } from '@/components/common/CoverImage';
import { RANK_BG } from '@/constants/gradients';

interface Episode {
  id: string | number;
  title: string;
  num: string;
  url?: string;
  playUrl?: string; // 后端回填直链(hls/mp4);空则对 url 实时解析
}

interface CardItem {
  id: number;
  title: string;
  cover?: string;
  coverUrl?: string;
  viewCount?: number;
  [key: string]: any;
}

interface Props {
  item: CardItem;
  rank: number;
  gradient: string;
  typeChip: string;
  onOpen: () => void; // 跳详情页
}

function formatCount(n: number = 0): string {
  if (n == null || isNaN(n) || n < 0) return '0';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

/**
 * 推荐页短剧卡片:默认与普通卡片一致(封面/排名/标题),但右下角多一个「▶ 第一集」悬浮按钮;
 * 点击就地切换为内嵌播放器自动播第一集;点其它区域仍跳详情页(onOpen)。
 */
export default function TeleplayCard({ item, rank, gradient, typeChip, onOpen }: Props) {
  const [playing, setPlaying] = useState(false);

  const { data: first, isLoading } = useQuery({
    queryKey: ['teleplay-first-ep', item.id],
    queryFn: async () => {
      const resp: any = await episodePage({ moduleContentId: String(item.id), page: 1, pageSize: 1 });
      const list: Episode[] =
        resp?.data?.data?.list || resp?.data?.data?.records || resp?.data?.list || resp?.data?.records || [];
      return (list[0] || null) as Episode | null;
    },
    enabled: playing, // 只有进入播放态才取第一集
    staleTime: 5 * 60_000,
  });

  // ===== 播放态:内嵌播放器替换整个卡片 =====
  if (playing) {
    return (
      <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: '#000', breakInside: 'avoid', mb: 2 }}>
        {/* 顶部操作条 */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            bgcolor: 'rgba(0,0,0,0.85)',
          }}
        >
          <Typography
            sx={{
              flex: 1,
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {first?.title || item.title}
          </Typography>
          <IconButton size="small" onClick={onOpen} sx={{ color: '#fff' }} title="看全集">
            <OpenInNewRoundedIcon sx={{ fontSize: 15 }} />
          </IconButton>
          <IconButton size="small" onClick={() => setPlaying(false)} sx={{ color: '#fff' }} title="收起">
            <CloseRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
        <Box sx={{ position: 'relative', aspectRatio: '16/9', bgcolor: '#000' }}>
          {isLoading || !first ? (
            <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0, bgcolor: 'action.hover' }} />
          ) : (
            <Box sx={{ position: 'absolute', inset: 0 }}>
              <VideoPlayer
                src={first.playUrl || ''}
                sourceUrl={first.playUrl ? undefined : first.url}
                poster={item.cover || item.coverUrl}
                autoPlay
              />
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  // ===== 默认态:卡片封面 + 「▶ 第一集」悬浮播放按钮 =====
  return (
    <Box
      onClick={onOpen}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        background: gradient,
        aspectRatio: '4/5',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 12px 32px rgba(0,0,0,0.4)' },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 60%)',
        }}
      />
      {(item.cover || item.coverUrl) && (
        <CoverImage
          src={item.cover || item.coverUrl}
          alt={item.title}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      )}

      {/* 排名角标 */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 800,
          color: 'text.primary',
          fontFamily: 'monospace',
          background: rank <= 3 ? RANK_BG[rank] : 'rgba(0,0,0,0.5)',
          backdropFilter: rank > 3 ? 'blur(4px)' : 'none',
          borderBottomRightRadius: 8,
          boxShadow: rank <= 3 ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
        }}
      >
        {rank}
      </Box>

      {item.viewCount !== undefined && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            bgcolor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            color: 'text.primary',
            fontSize: 10,
            fontFamily: 'monospace',
          }}
        >
          <PlayArrowRoundedIcon sx={{ fontSize: 11 }} />
          {formatCount(item.viewCount)}
        </Box>
      )}

      {/* 「▶ 第一集」悬浮播放按钮:点击就地播放,不跳详情 */}
      <Box
        onClick={(e) => { e.stopPropagation(); setPlaying(true); }}
        sx={{
          position: 'absolute',
          right: 8,
          bottom: 64,
          zIndex: 3,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.25,
          px: 1,
          py: 0.4,
          borderRadius: 5,
          bgcolor: 'rgba(254,44,85,0.92)',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(254,44,85,0.4)',
          backdropFilter: 'blur(4px)',
          '&:hover': { bgcolor: 'primary.main' },
        }}
      >
        <PlayArrowRoundedIcon sx={{ fontSize: 15 }} />
        第一集
      </Box>

      {/* 底部标题 */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          p: 1.25,
          background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)',
        }}
      >
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 500,
            color: 'text.primary',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 32,
          }}
        >
          {item.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <Box
            sx={{
              px: 0.5,
              py: 0.125,
              borderRadius: 0.5,
              bgcolor: 'rgba(255, 88, 88, 0.4)',
              color: 'text.primary',
              fontSize: 9,
              fontWeight: 600,
            }}
          >
            {typeChip}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
