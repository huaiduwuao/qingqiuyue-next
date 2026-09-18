'use client';

import React from 'react';
import Link from 'next/link';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { TYPE_LABEL, TYPE_TO_ROUTE } from '@/lib/contentType.gen';
import { yuan, type Realization } from '@/apis/team';

interface Props {
  items: Realization[];
  empty?: string;
  /** 紧凑模式:不显示封面(弹窗里用) */
  compact?: boolean;
}

const workHref = (r: Realization) => {
  const route = r.workId && r.workId !== '0' ? TYPE_TO_ROUTE[(r.workType || '').toUpperCase()] : null;
  return route ? `${route}?id=${encodeURIComponent(r.workId)}` : null;
};

/**
 * 实现列表。一条实现 = 一次验收通过的交付:哪个需求的哪个任务、谁(或哪支团队)交的、交了什么、分到多少。
 * 它只由验收动作产生,所以这里没有"新建",只有看。
 */
export default function RealizationList({ items, empty = '还没有验收通过的交付', compact }: Props) {
  if (items.length === 0) {
    return <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 2 }}>{empty}</Typography>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((r) => {
        const href = workHref(r);
        return (
          <Box
            key={r.id}
            sx={{ display: 'flex', gap: 1.5, p: 1.25, borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper', minWidth: 0 }}
          >
            {!compact && r.workCover && (
              <Box component="img" src={r.workCover} alt="" loading="lazy" sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }} />
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 600 }}>
                {r.taskTitle || r.demandTitle}
              </Typography>
              <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>
                需求:{r.demandTitle}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                {r.nickname && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Avatar src={r.avatar || undefined} sx={{ width: 18, height: 18 }} />
                    <Typography sx={{ fontSize: 12 }}>{r.nickname}</Typography>
                  </Box>
                )}
                {r.teamId > 0 && <Chip size="small" variant="outlined" label={r.teamName ? `团队 · ${r.teamName}` : '团队交付'} sx={{ height: 20, fontSize: 11 }} />}
                {href ? (
                  <Chip
                    size="small"
                    component={Link}
                    href={href}
                    clickable
                    label={`${TYPE_LABEL[(r.workType || '').toUpperCase()] || '作品'} · ${r.workTitle || '查看'}`}
                    sx={{ height: 20, fontSize: 11, maxWidth: 220 }}
                  />
                ) : (
                  <Chip size="small" label="文字交付" sx={{ height: 20, fontSize: 11 }} />
                )}
                <Typography sx={{ fontSize: 12, color: 'text.secondary', ml: 'auto' }}>
                  {r.settledAt ? `已结账 ¥${yuan(r.amountCents)}` : '待结账'} · {String(r.createdAt || '').slice(0, 10)}
                </Typography>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
