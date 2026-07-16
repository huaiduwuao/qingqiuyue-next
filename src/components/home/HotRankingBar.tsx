'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Skeleton from '@mui/material/Skeleton';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import { fetchHot, HotItem } from '@/apis/home-discover';
import { getDetailRoute } from '@/lib/contentRoute';
import { useRouter } from 'next/navigation';

// section → contentType 映射（recommend/空时不映射，返回全类型）
export const SECTION_TO_CONTENT_TYPE: Record<string, string> = {
  novel: 'NOVEL',
  comics: 'COMICS',
  film: 'FILM',
  teleplay: 'TELEPLAY',
  entertainment: 'VSHOW',
  music: 'MUSIC',
  anime: 'ANIMATION',
  news: 'NEWS',
  game: 'VIDEO',
  // 其他类型暂用 VIDEO
  tech: 'VIDEO',
  food: 'VIDEO',
  knowledge: 'NOVEL',
  sports: 'VIDEO',
  finance: 'NOVEL',
};

// 内容类型配置（ALL 表示全类型混合排行）
const CONTENT_TYPES = [
  { value: 'ALL', label: '全部' },
  { value: 'NOVEL', label: '小说' },
  { value: 'COMICS', label: '漫画' },
  { value: 'FILM', label: '影视' },
  { value: 'TELEPLAY', label: '小剧场' },
  { value: 'VSHOW', label: '综艺' },
  { value: 'MUSIC', label: '音乐' },
  { value: 'ANIMATION', label: '动漫' },
  { value: 'NEWS', label: '资讯' },
  { value: 'VIDEO', label: '视频' },
];

interface Props {
  section?: string;     // 当前 section 参数，用于自动切换默认类型；空时显示"全部"
  title?: string;
  maxItems?: number;
  expandable?: boolean;
  showTypeTabs?: boolean; // 是否显示类型切换 tabs
  columns?: number; // 列数，默认 2
}

export default function HotRankingBar({
  section,
  title = '内容榜单',
  maxItems = 12,
  expandable = false,
  showTypeTabs = true,
  columns = 2,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  // 根据 section 自动确定默认类型：
  // - 空/recommend → ALL（全类型混合排行，默认）
  // - 具体类型 → 对应类型
  const resolvedDefaultType = section && section !== 'recommend' ? (SECTION_TO_CONTENT_TYPE[section] || 'NOVEL') : 'ALL';
  const [activeType, setActiveType] = useState(resolvedDefaultType);

  // 当 section 变化时，自动切换到对应的内容类型
  useEffect(() => {
    if (section && section !== 'recommend') {
      setActiveType(SECTION_TO_CONTENT_TYPE[section] || 'NOVEL');
    } else {
      setActiveType('ALL');
    }
  }, [section]);

  // ALL 类型不传 type 参数，获取全类型混合排行
  const { data, isLoading } = useQuery({
    queryKey: ['hot-ranking', activeType],
    queryFn: () => fetchHot(activeType === 'ALL' ? { size: 30 } : { type: activeType, size: 30 }).then((r: any) => (r?.data?.list ?? []) as HotItem[]),
    staleTime: 60_000,
  });

  const allItems = data ?? [];
  const items = expandable && !expanded ? allItems.slice(0, maxItems) : allItems.slice(0, 30);

  const handleClick = (item: HotItem) => {
    if (!item.id) return;
    const route = getDetailRoute((item.category || activeType).toUpperCase(), item.id);
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

      {/* 类型切换 Tabs */}
      {showTypeTabs && (
        <Tabs
          value={activeType}
          onChange={(_, v) => setActiveType(v)}
          sx={{
            minHeight: 28,
            mb: 1,
            '& .MuiTab-root': { minHeight: 28, py: 0, fontSize: 11 },
            '& .MuiTabs-indicator': { height: 2 },
          }}
        >
          {CONTENT_TYPES.map((t) => (
            <Tab key={t.value} value={t.value} label={t.label} />
          ))}
        </Tabs>
      )}

      {isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 0.75 }}>
          {Array.from({ length: maxItems }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={28} sx={{ bgcolor: 'action.hover' }} />
          ))}
        </Box>
      ) : items.length === 0 ? (
        <Typography variant="caption" sx={{ color: 'text.secondary', py: 1, display: 'block' }}>
          暂无{activeType}数据
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 0.5 }}>
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
                  {(item.source || '').replace(' [定时刷新]', '').replace(' [爬取测试]', '').slice(0, 8)}
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
