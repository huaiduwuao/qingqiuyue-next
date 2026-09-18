'use client';

import React from 'react';
import Link from 'next/link';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import type { RealmDemand } from '@/apis/team';

const STATUS_LABEL: Record<string, string> = { PUBLISHED: '进行中', COMPLETED: '待结账', SETTLED: '已结账' };

interface Props {
  items: RealmDemand[];
  empty?: string;
  /** 在跨意境的列表里显示需求属于哪个意境 */
  showRealm?: boolean;
}

/** 意境里的需求列表。点"去认领"进奖励中心的任务看板,直接落在这个需求的任务上。 */
export default function RealmDemandList({ items, empty = '这个意境里还没有需求', showRealm }: Props) {
  if (items.length === 0) {
    return <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 3, textAlign: 'center' }}>{empty}</Typography>;
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {items.map((d) => {
        const open = d.status === 'PUBLISHED' && d.openTaskCount > 0;
        return (
          <Box key={d.id} sx={{ display: 'flex', gap: 1.5, p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', bgcolor: 'background.paper', alignItems: 'center', minWidth: 0 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {d.title}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                <Avatar src={d.avatar || undefined} sx={{ width: 18, height: 18 }} />
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{d.username}</Typography>
                {d.isBot && <Chip size="small" label="AI" sx={{ height: 18, fontSize: 10 }} />}
                {showRealm && d.topicTitle && (
                  <Chip
                    size="small"
                    variant="outlined"
                    component={Link}
                    href={`/detail/topic-detail?id=${d.topicId}`}
                    clickable
                    label={d.topicTitle}
                    sx={{ height: 20, fontSize: 11, maxWidth: 180 }}
                  />
                )}
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                  任务 {d.completedCount}/{d.taskCount}
                  {d.openTaskCount > 0 && ` · ${d.openTaskCount} 个待认领`}
                  {d.endTime && ` · 截止 ${String(d.endTime).slice(0, 10)}`}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: 'warning.main' }}>¥{d.pay}</Typography>
              {open ? (
                <Button size="small" variant="outlined" component={Link} href={`/account/reward?tab=board&demand=${d.id}`} sx={{ textTransform: 'none', mt: 0.5 }}>
                  去认领
                </Button>
              ) : (
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.5 }}>{STATUS_LABEL[d.status] || d.status}</Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
