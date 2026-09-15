'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import PublicIcon from '@mui/icons-material/PublicRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import BedtimeRoundedIcon from '@mui/icons-material/BedtimeRounded';
import { useRouter } from 'next/navigation';

import {
  getTrending,
  getTrendingPlatforms,
  type TrendingItem,
  type TrendingPeriod,
  type TrendingPlatform,
} from '@/apis/recommend';
import { getDetailRoute } from '@/lib/contentRoute';
import { mediaUrl } from '@/lib/media';

// 时间窗口。与后端 internal/trending 的 Period 一一对应。
const PERIODS: { value: TrendingPeriod; label: string }[] = [
  { value: 'realtime', label: '实时' },
  { value: 'day', label: '今日' },
  { value: 'week', label: '本周' },
];

interface Props {
  title?: string;
  /** 初始窗口。实时榜窗口只有 6 小时,爬虫不是连续跑的,默认用今日更稳。 */
  defaultPeriod?: TrendingPeriod;
  maxItems?: number;
  /** 只显示能播的。文本类内容(小说/文章)不受影响,它们本来就不进播放器。 */
  playableOnly?: boolean;
}

/**
 * TrendingBoard —— 全网热门资源榜。
 *
 * 与排行榜(components/leaderboard)的区别:那个是按类型/分类出的站内榜单
 * (/home/leaderboard),这个是跨平台的全网热度索引(/trending)—— 每条都带
 * 来源平台归属,可以按平台筛选,热度里含源站榜位而不只是站内点击。
 *
 * 平台筛选项来自 /trending/platforms 而不是前端硬编码:爬虫接入新平台后
 * 筛选栏自动多一项,不用改这个文件。
 */
export default function TrendingBoard({
  title = '全网热榜',
  defaultPeriod = 'day',
  maxItems = 20,
  playableOnly = false,
}: Props) {
  const router = useRouter();
  const [period, setPeriod] = useState<TrendingPeriod>(defaultPeriod);
  const [platform, setPlatform] = useState<string>('');

  const { data: platforms } = useQuery({
    queryKey: ['trending-platforms', period],
    queryFn: () =>
      getTrendingPlatforms({ period }).then((r: any) => (r?.data?.list ?? []) as TrendingPlatform[]),
    staleTime: 5 * 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['trending', period, platform, playableOnly],
    queryFn: () =>
      getTrending({
        period,
        platform: platform || undefined,
        limit: maxItems,
        ...(playableOnly ? { playableOnly: 1 as const } : {}),
      }).then((r: any) => (r?.data?.list ?? []) as TrendingItem[]),
    staleTime: 60_000,
  });

  const items = data ?? [];

  // 切窗口时清掉平台筛选:各窗口覆盖的平台不一定相同,留着一个当前窗口
  // 没有的平台会让列表空白,用户以为是坏了。
  const changePeriod = (p: TrendingPeriod) => {
    setPeriod(p);
    setPlatform('');
  };

  const open = (item: TrendingItem) => {
    const route = getDetailRoute((item.contentType || '').toUpperCase(), item.id);
    if (route) router.push(route);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        borderRadius: 2,
        bgcolor: 'var(--bg-surface, transparent)',
        border: '1px solid var(--border-color, transparent)',
        p: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <PublicIcon sx={{ fontSize: 16, color: 'primary.main', mr: 0.75 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, currentColor)', flex: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'var(--text-muted, currentColor)' }}>
          共 {items.length} 条
        </Typography>
      </Box>

      <Tabs
        value={period}
        onChange={(_, v) => changePeriod(v)}
        sx={{
          minHeight: 28,
          mb: 1,
          '& .MuiTab-root': { minHeight: 28, py: 0, fontSize: 11 },
          '& .MuiTabs-indicator': { height: 2 },
        }}
      >
        {PERIODS.map((p) => (
          <Tab key={p.value} value={p.value} label={p.label} />
        ))}
      </Tabs>

      {/* 平台筛选。选项来自索引本身,不是写死的列表。 */}
      {!!platforms?.length && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
          <Chip
            size="small"
            label="全部"
            variant={platform === '' ? 'filled' : 'outlined'}
            onClick={() => setPlatform('')}
            sx={{ height: 22, fontSize: 10 }}
          />
          {platforms.map((p) => (
            <Chip
              key={p.platform}
              size="small"
              label={`${p.label} ${p.count}`}
              variant={platform === p.platform ? 'filled' : 'outlined'}
              onClick={() => setPlatform(p.platform)}
              sx={{ height: 22, fontSize: 10 }}
            />
          ))}
        </Box>
      )}

      {isLoading ? (
        <Box sx={{ display: 'grid', gap: 0.75 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={34} sx={{ bgcolor: 'action.hover' }} />
          ))}
        </Box>
      ) : items.length === 0 ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', py: 1, display: 'block' }}>
          {/* 实时榜窗口只有 6 小时,爬虫没跑就是空的 —— 说清楚是"这段时间没有",
              而不是让用户以为功能坏了。 */}
          {period === 'realtime' ? '最近 6 小时暂无新增热门内容,试试「今日」' : '暂无数据'}
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gap: 0.25 }}>
          {items.map((item) => (
            <Box
              key={item.id}
              onClick={() => open(item)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 0.75,
                py: 0.5,
                borderRadius: 1.25,
                cursor: 'pointer',
                transition: 'background 0.15s',
                '&:hover': { bgcolor: 'var(--bg-hover, transparent)' },
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  width: 18,
                  height: 18,
                  flexShrink: 0,
                  borderRadius: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'text.primary',
                  bgcolor: item.rank <= 3 ? 'primary.main' : 'action.hover',
                  fontFamily: 'monospace',
                }}
              >
                {item.rank}
              </Box>

              {item.cover && (
                <Box
                  component="img"
                  src={mediaUrl(item.cover)}
                  alt=""
                  loading="lazy"
                  sx={{ width: 30, height: 20, objectFit: 'cover', borderRadius: 0.5, flexShrink: 0 }}
                />
              )}

              <Typography
                sx={{
                  fontSize: 12,
                  color: 'var(--text-primary, currentColor)',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {item.title}
              </Typography>

              {/* 播放性:不可播的内容明确标出来,别让用户点进去才发现。
                  三种状态给三种待遇 ——
                    pending_repair:真故障,警告色扳手
                    live_offline  :主播没开播,是直播的正常状态,用中性色的"休息中"
                                    图标,不能用故障色,那会让用户以为我们坏了
                    not_applicable:小说/文章,不标 */}
              {item.playbackStatus === 'pending_repair' && (
                <Tooltip title={item.repairNotice || '内容修复中'}>
                  <BuildRoundedIcon sx={{ fontSize: 13, color: 'warning.main', flexShrink: 0 }} />
                </Tooltip>
              )}
              {item.playbackStatus === 'live_offline' && (
                <Tooltip title={item.repairNotice || '主播当前未开播'}>
                  <BedtimeRoundedIcon sx={{ fontSize: 13, color: 'text.disabled', flexShrink: 0 }} />
                </Tooltip>
              )}

              <Typography
                sx={{
                  fontSize: 9,
                  color: 'var(--text-muted, currentColor)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {item.platformLabel}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
