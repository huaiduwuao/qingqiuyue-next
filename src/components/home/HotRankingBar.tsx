'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { fetchHot, HotItem } from '@/apis/home-discover';
import { getDetailRoute } from '@/lib/contentRoute';
import { useRouter } from 'next/navigation';

interface Props {
  contentType?: string; // 默认 NEWS,后端会按 contentType 过滤
  title?: string;
  maxItems?: number;
  expandable?: boolean;
}

export default function HotRankingBar({
  contentType = 'NEWS',
  title = '实时热搜',
  maxItems = 12,
  expandable = false,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = React.useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['hot-ranking', contentType],
    queryFn: () => fetchHot({ type: contentType, size: 30 }).then((r: any) => (r?.data?.list ?? []) as HotItem[]),
    staleTime: 60_000,
  });

  const allItems = data ?? [];
  const items = expandable && !expanded ? allItems.slice(0, maxItems) : allItems.slice(0, 30);

  const handleClick = (item: HotItem) => {
    if (!item.id) return;
    const route = getDetailRoute((item.category || contentType).toUpperCase(), item.id);
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
        <WhatshotIcon sx={{ fontSize: 16, color: 'primary.main', mr: 0.75 }} />
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, currentColor)', flex: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: 10, color: 'var(--text-muted, currentColor)' }}>
          共 {allItems.length} 条
        </Typography>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.75 }}>
          {Array.from({ length: maxItems }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={28} sx={{ bgcolor: 'action.hover' }} />
          ))}
        </Box>
      ) : items.length === 0 ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', py: 1, display: 'block' }}>
          暂无热搜数据(等待每小时抓取入 Doris 后自动出现)
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.5 }}>
          {items.map((item, i) => (
            <Box
              key={item.id || i}
              onClick={() => handleClick(item)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 0.75,
                py: 0.5,
                borderRadius: 1.25,
                cursor: item.id ? 'pointer' : 'default',
                transition: 'background 0.15s',
                '&:hover': item.id ? { bgcolor: 'var(--bg-hover, transparent)' } : {},
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
                  bgcolor: i < 3 ? 'primary.main' : 'action.hover',
                  fontFamily: 'monospace',
                }}
              >
                {i + 1}
              </Box>
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
              {item.source && (
                <Typography
                  sx={{
                    fontSize: 9,
                    color: 'var(--text-muted, currentColor)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {(item.source || '').replace(' [爬取测试]', '').slice(0, 8)}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      )}

      {expandable && allItems.length > maxItems && (
        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <Typography
            onClick={() => setExpanded(!expanded)}
            sx={{
              fontSize: 11,
              color: 'primary.main',
              cursor: 'pointer',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {expanded ? '收起' : `查看全部 ${allItems.length} 条`}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
