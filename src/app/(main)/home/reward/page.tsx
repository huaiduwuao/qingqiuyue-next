'use client';

/**
 * 悬赏 —— 公开入口。三个页签对应主线上的三个名词:
 *   需求:发在各个意境里、正在进行的悬赏;
 *   实现:最近验收通过的交付;
 *   团队:按战绩排的团队。
 *
 * 以前这一页列的是模板的 需求 / 项目 / 团队 / 意境 四张表,卡片读的还是 item.name(需求的字段叫 title),
 * 所以满屏都是"无标题"。
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import RealmDemandList from '@/components/reward/RealmDemandList';
import RealizationList from '@/components/reward/RealizationList';
import { listRealizations, listRealmDemands, listTeams, yuan } from '@/apis/team';

type TabKey = 'demands' | 'realizations' | 'teams';

export default function HomeRewardPage() {
  const [tab, setTab] = useState<TabKey>('demands');

  const demands = useQuery({ queryKey: ['reward-home', 'demands'], queryFn: () => listRealmDemands({ pageSize: 40 }), enabled: tab === 'demands' });
  const realizations = useQuery({ queryKey: ['reward-home', 'realizations'], queryFn: () => listRealizations({ pageSize: 40 }), enabled: tab === 'realizations' });
  const teams = useQuery({ queryKey: ['reward-home', 'teams'], queryFn: () => listTeams({ pageSize: 40 }), enabled: tab === 'teams' });

  return (
    <Container maxWidth="md">
      <Box sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1 }}>
          <Typography variant="h4" sx={{ flex: 1 }}>
            悬赏
          </Typography>
          <Button variant="outlined" component={Link} href="/account/reward?tab=square" sx={{ textTransform: 'none' }}>
            赏金广场
          </Button>
          <Button variant="contained" component={Link} href="/account/reward?tab=demands" sx={{ textTransform: 'none' }}>
            发布需求
          </Button>
        </Box>
        <Typography sx={{ fontSize: 13.5, color: 'text.secondary', mb: 2 }}>
          在意境里提需求、托管赏金;个人或团队认领并交付;验收通过的交付成为一条实现,回到意境里。
        </Typography>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}>
          <Tab value="demands" label="需求" />
          <Tab value="realizations" label="实现" />
          <Tab value="teams" label="团队" />
        </Tabs>

        {tab === 'demands' && <RealmDemandList showRealm items={demands.data?.list || []} empty={demands.isLoading ? '加载中…' : '还没有发在意境里的需求'} />}
        {tab === 'realizations' && (
          <RealizationList items={realizations.data?.list || []} empty={realizations.isLoading ? '加载中…' : '还没有验收通过的交付'} />
        )}
        {tab === 'teams' &&
          ((teams.data?.list || []).length === 0 ? (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', py: 3, textAlign: 'center' }}>{teams.isLoading ? '加载中…' : '还没有团队'}</Typography>
          ) : (
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' } }}>
              {(teams.data?.list || []).map((t) => (
                <Box
                  key={t.id}
                  component={Link}
                  href={`/account/reward?tab=teams&team=${t.id}`}
                  sx={{
                    display: 'flex',
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
                    {t.intro && (
                      <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {t.intro}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          ))}
      </Box>
    </Container>
  );
}
