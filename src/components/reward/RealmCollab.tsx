'use client';

/**
 * 意境页里的「需求 / 实现 / 团队」三个页签。
 *
 * 意境是人聚在一起的地方;这三页是它和交易、和人群的接口:
 *   需求 —— 发在这个意境里的悬赏,谁都可以来认领;
 *   实现 —— 这些需求验收通过的交付(带作品的交付同时进了「作品」页);
 *   团队 —— 把这里当主场、或在这里交付过的团队。
 */

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import RealmDemandList from './RealmDemandList';
import RealizationList from './RealizationList';
import { listRealizations, listRealmDemands, listTeams, yuan } from '@/apis/team';
import type { EntityId } from '@/lib/id';

export type RealmCollabTab = 'demands' | 'realizations' | 'teams';

export default function RealmCollab({ topicId, tab }: { topicId: EntityId; tab: RealmCollabTab }) {
  if (tab === 'demands') return <Demands topicId={topicId} />;
  if (tab === 'realizations') return <Realizations topicId={topicId} />;
  return <Teams topicId={topicId} />;
}

function Demands({ topicId }: { topicId: EntityId }) {
  const q = useQuery({ queryKey: ['realm', 'demands', topicId], queryFn: () => listRealmDemands({ topicId, status: 'all', pageSize: 30 }) });
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', flex: 1 }}>
          在这个意境里悬赏:想要什么作品、什么整理、什么答案,写下来并托管赏金,个人或团队来认领。
        </Typography>
        <Button size="small" variant="contained" component={Link} href={`/account/reward?tab=demands&realm=${topicId}`} sx={{ textTransform: 'none', flexShrink: 0 }}>
          提一个需求
        </Button>
      </Box>
      <RealmDemandList items={q.data?.list || []} empty={q.isLoading ? '加载中…' : '这个意境里还没有需求,来提第一个'} />
    </Box>
  );
}

function Realizations({ topicId }: { topicId: EntityId }) {
  const q = useQuery({ queryKey: ['realm', 'realizations', topicId], queryFn: () => listRealizations({ topicId, pageSize: 30 }) });
  return <RealizationList items={q.data?.list || []} empty={q.isLoading ? '加载中…' : '这个意境里的需求还没有验收通过的交付'} />;
}

function Teams({ topicId }: { topicId: EntityId }) {
  const q = useQuery({ queryKey: ['realm', 'teams', topicId], queryFn: () => listTeams({ topicId, pageSize: 30 }) });
  const list = q.data?.list || [];
  if (list.length === 0) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>{q.isLoading ? '加载中…' : '还没有团队把这里当主场'}</Typography>
        {!q.isLoading && (
          <Button size="small" variant="outlined" component={Link} href="/account/reward?tab=teams" sx={{ textTransform: 'none' }}>
            创建团队
          </Button>
        )}
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
      {list.map((t) => (
        <Box
          key={t.id}
          component={Link}
          href={`/account/reward?tab=teams&team=${t.id}`}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            p: 1.5,
            borderRadius: 2,
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            color: 'inherit',
            textDecoration: 'none',
            minWidth: 0,
            '&:hover': { borderColor: 'primary.main' },
          }}
        >
          <Avatar src={t.avatar || undefined} variant="rounded" sx={{ width: 40, height: 40 }}>
            <GroupsRoundedIcon fontSize="small" />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: 14, fontWeight: 700 }}>
              {t.name}
            </Typography>
            <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>
              {t.memberCount} 人 · 交付 {t.realizedCount} · 收入 ¥{yuan(t.earnedCents)}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
