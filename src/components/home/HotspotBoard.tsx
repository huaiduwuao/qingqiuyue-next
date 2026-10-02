'use client';

/**
 * 此刻热议 —— 全网热搜(百度实时热搜 / 抖音热榜)对上的站内能看 / 能读的内容
 * (后端 qingqiuyue-go internal/hotspot,GET /api/content/hotspot/board,每 20 分钟刷新)。
 *
 * 新访客最先想看的是「现在大家在聊什么」:热词旁边直接给站内能点开看的视频 / 作品 / 人物。
 * 没有对上任何站内内容的热词不出现(后端已过滤),时政 / 社会事件类话题后端不收。
 *
 * variant="panel" 侧栏卡片;variant="strip" 信息流顶部一条横向滚动的紧凑版(手机上也看得到)。
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import WhatshotRoundedIcon from '@mui/icons-material/WhatshotRounded';
import { contentClient } from '@/lib/api/client';
import { getDetailRoute, useContentNavigate } from '@/lib/contentRoute';

interface HotItem {
  id: string;
  title: string;
  contentType: string;
  cover?: string;
}

interface HotEntry {
  word: { text: string; source: string; rank: number; heat: number };
  items: HotItem[];
}

interface HotBoard {
  at?: string;
  entries: HotEntry[];
}

const SOURCE_LABEL: Record<string, string> = { baidu: '百度', douyin: '抖音' };

export function useHotspotBoard(limit: number) {
  return useQuery({
    queryKey: ['hotspot', 'board', limit],
    queryFn: () => contentClient('/hotspot/board', { params: { limit } }) as Promise<HotBoard>,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

export default function HotspotBoard({ variant = 'panel', limit = 8 }: { variant?: 'panel' | 'strip'; limit?: number }) {
  const query = useHotspotBoard(limit);
  const nav = useContentNavigate();
  const entries = query.data?.entries ?? [];
  if (entries.length === 0) return null;

  const open = (it: HotItem) => {
    if (getDetailRoute(it.contentType, it.id)) nav(it.contentType, it.id);
  };

  if (variant === 'strip') {
    // 每条热词取它对上的第一条内容,横向一排
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflowX: 'auto', py: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, color: '#ef4444', fontWeight: 700, fontSize: 13 }}>
          <WhatshotRoundedIcon sx={{ fontSize: 18 }} />此刻热议
        </Box>
        {entries.map((e) => {
          const it = e.items[0];
          if (!it) return null;
          return (
            <Box
              key={e.word.text}
              component="button"
              onClick={() => open(it)}
              title={`${e.word.text} → ${it.title}`}
              sx={{
                flexShrink: 0, maxWidth: 220, px: 1.25, py: 0.5, borderRadius: 999, border: '1px solid', borderColor: 'divider',
                bgcolor: 'background.paper', color: 'text.primary', fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis', font: 'inherit',
              }}
            >
              {e.word.text}
            </Box>
          );
        })}
      </Box>
    );
  }

  return (
    <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', p: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <WhatshotRoundedIcon sx={{ fontSize: 18, color: '#ef4444' }} />
        <Typography sx={{ fontWeight: 700, fontSize: 15 }}>此刻热议</Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary', ml: 'auto' }}>全网热搜 · 站内能看的</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {entries.map((e, i) => (
          <Box key={e.word.text}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: i < 3 ? '#ef4444' : 'text.secondary', width: 16, flexShrink: 0 }}>{i + 1}</Typography>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0 }} noWrap title={e.word.text}>{e.word.text}</Typography>
              <Typography sx={{ fontSize: 10.5, color: 'text.secondary', flexShrink: 0 }}>{SOURCE_LABEL[e.word.source] ?? e.word.source}</Typography>
            </Box>
            <Box sx={{ pl: 2.75, display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.25 }}>
              {e.items.slice(0, 2).map((it) => (
                <Box
                  key={it.id}
                  component="button"
                  onClick={() => open(it)}
                  sx={{
                    textAlign: 'left', border: 0, bgcolor: 'transparent', p: 0, cursor: 'pointer', color: 'primary.main',
                    fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', font: 'inherit',
                    '&:hover': { textDecoration: 'underline' },
                  }}
                  title={it.title}
                >
                  ▶ {it.title}
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
