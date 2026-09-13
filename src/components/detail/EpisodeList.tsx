'use client';

import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import LockIcon from '@mui/icons-material/Lock';
import { episodeTitle, type ContentItem } from '@/hooks/useContentItems';

interface EpisodeListProps {
  title: string;
  items: ContentItem[];
  activeId?: string | null;
  onSelect: (item: ContentItem, index: number) => void;
  /** 计量单位:集 / 期 / 话 / 章 */
  unit?: string;
  /** grid:只显示序号的密集格子(电视剧、动漫);list:序号 + 标题(综艺、漫画) */
  variant?: 'grid' | 'list';
  loading?: boolean;
  /** 后端正在从源站补齐列表 */
  backfilling?: boolean;
  /** 列表为空时的提示;可带操作(如"去原站观看") */
  empty?: React.ReactNode;
}

const GROUP_SIZE = 50;

/** 选集/章节列表:超过 50 条按区间分组,当前播放/阅读的那一条高亮,付费未解锁的带锁。 */
export function EpisodeList({
  title, items, activeId, onSelect, unit = '集', variant = 'grid', loading, backfilling, empty,
}: EpisodeListProps) {
  const groups = useMemo(() => {
    const out: { start: number; end: number }[] = [];
    for (let i = 0; i < items.length; i += GROUP_SIZE) {
      out.push({ start: i, end: Math.min(i + GROUP_SIZE, items.length) });
    }
    return out;
  }, [items]);

  const activeIndex = items.findIndex((it) => it.id === activeId);
  // 默认显示当前这一集所在的分组;手动切组后以手动为准,直到当前集变了。
  const [picked, setPicked] = useState<{ group: number; activeIndex: number } | null>(null);
  const group =
    picked && picked.activeIndex === activeIndex ? picked.group : Math.max(0, Math.floor(activeIndex / GROUP_SIZE));

  const current = groups[Math.min(group, Math.max(0, groups.length - 1))];
  const visible = current ? items.slice(current.start, current.end) : [];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
        <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 700 }}>
          {title}
        </Typography>
        {items.length > 0 && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
            共 {items.length} {unit}
          </Typography>
        )}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={22} />
        </Box>
      ) : items.length === 0 ? (
        <Box
          sx={{
            py: 3,
            px: 2,
            textAlign: 'center',
            color: 'text.secondary',
            fontSize: 13,
            borderRadius: 2,
            border: '1px dashed',
            borderColor: 'divider',
          }}
        >
          {backfilling ? (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={14} />
              正在从源站获取{unit}列表…
            </Box>
          ) : (
            empty ?? `暂无${unit}列表`
          )}
        </Box>
      ) : (
        <>
          {groups.length > 1 && (
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5, overflowX: 'auto', pb: 0.5 }}>
              {groups.map((g, i) => (
                <Chip
                  key={g.start}
                  label={`${g.start + 1}-${g.end}`}
                  size="small"
                  onClick={() => setPicked({ group: i, activeIndex })}
                  color={i === group ? 'primary' : 'default'}
                  variant={i === group ? 'filled' : 'outlined'}
                  sx={{ flexShrink: 0 }}
                />
              ))}
            </Box>
          )}
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns:
                variant === 'grid'
                  ? { xs: 'repeat(5, 1fr)', sm: 'repeat(8, 1fr)', md: 'repeat(10, 1fr)' }
                  : { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            }}
          >
            {visible.map((it, i) => {
              const index = (current?.start ?? 0) + i;
              const active = it.id === activeId;
              const label = `第${index + 1}${unit}`;
              const title = episodeTitle(it, index);
              const cell = (
                <Box
                  role="button"
                  tabIndex={0}
                  aria-current={active ? 'true' : undefined}
                  aria-label={title ? `${label} ${title}` : label}
                  onClick={() => onSelect(it, index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(it, index);
                    }
                  }}
                  sx={{
                    position: 'relative',
                    py: variant === 'grid' ? 1 : 1.25,
                    px: variant === 'grid' ? 0.5 : 1.5,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: active ? 'primary.main' : 'divider',
                    bgcolor: active ? 'rgba(254, 44, 85, 0.12)' : 'background.paper',
                    color: active ? 'primary.main' : 'text.primary',
                    transition: 'border-color 0.15s, background-color 0.15s',
                    '&:hover': { borderColor: 'primary.main' },
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
                    textAlign: variant === 'grid' ? 'center' : 'left',
                    minWidth: 0,
                  }}
                >
                  {it.locked && (
                    <LockIcon sx={{ position: 'absolute', top: 3, right: 3, fontSize: 11, color: 'text.secondary' }} />
                  )}
                  {variant === 'grid' ? (
                    <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{index + 1}</Typography>
                  ) : (
                    <>
                      <Typography sx={{ fontSize: 11, color: active ? 'primary.main' : 'text.secondary' }}>{label}</Typography>
                      <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
                        {title || label}
                      </Typography>
                    </>
                  )}
                </Box>
              );
              return variant === 'grid' && title ? (
                <Tooltip key={it.id} title={`${label} ${title}`} placement="top" enterDelay={400}>
                  {cell}
                </Tooltip>
              ) : (
                <React.Fragment key={it.id}>{cell}</React.Fragment>
              );
            })}
          </Box>
        </>
      )}
    </Box>
  );
}

export default EpisodeList;
