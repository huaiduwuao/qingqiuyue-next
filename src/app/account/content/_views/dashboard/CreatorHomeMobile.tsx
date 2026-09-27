'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Skeleton from '@mui/material/Skeleton';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import { getCreatorProfile, getCreatorHotTopics, type HotTopic } from '@/apis/dashboard';
import { accountClient } from '@/lib/api/client';
import { coverBackground } from '@/lib/media';
import { gradient2 } from '@/constants/gradients';
import { MobileSection, MobileStatRow, MobileListRow } from '@/components/mobile/MobileSection';
import { useActiveTab } from '../../ActiveTabContext';
import CreatorOnboarding from '../../_components/CreatorOnboarding';
import NewCreationSection from '../../_components/NewCreationSection';
import BountyPicks from '../../_components/BountyPicks';

type Overview = {
  totalViews?: number;
  totalLikes?: number;
  totalComments?: number;
  viewsDelta?: number;
  likesDelta?: number;
  commentsDelta?: number;
};

const fmt = (n?: number) => {
  const v = Number(n) || 0;
  if (v >= 10000) return `${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}w`;
  return v.toLocaleString();
};

function Delta({ v }: { v?: number }) {
  const n = Number(v) || 0;
  if (!n) return <Box component="span" sx={{ color: 'text.disabled' }}>较上周持平</Box>;
  return (
    <Box component="span" sx={{ color: n > 0 ? 'success.main' : 'error.main' }}>
      较上周 {n > 0 ? '+' : ''}{fmt(n)}
    </Box>
  );
}

/**
 * 手机上的创作者工作台。不是电脑版工作台缩窄 —— 电脑版一屏铺开的趋势图、粉丝画像、
 * 内容分布、日历、通知在手机上是五屏多的长滚动,这里只留创作者每天真要看的:
 *   我是谁(资料 + 四个数)→ 发布 → 新手任务(一行)→ 进行中(有才显示)→ 本周数据 → 可以参与的热门话题。
 * 其余都在顶部横滑的工作台页签里(数据中心、活动与话题…)。
 */
export default function CreatorHomeMobile() {
  const router = useRouter();
  const { setActiveTab } = useActiveTab();

  // 与电脑版组件同 queryKey,共用缓存
  const profileQ = useQuery({ queryKey: ['creator-profile'], queryFn: () => getCreatorProfile(), staleTime: 60_000 });
  const overviewQ = useQuery({
    queryKey: ['account', 'data', 'overview'],
    queryFn: () => accountClient.get<Overview>('/data/overview').then((r) => r),
    staleTime: 60_000,
  });
  const topicsQ = useQuery({
    queryKey: ['creator-hot-topics'],
    queryFn: () => getCreatorHotTopics({ pageSize: 10 }),
    staleTime: 60_000,
  });

  const profile = profileQ.data?.profile;
  const ov = overviewQ.data || {};
  const topics = ((topicsQ.data?.list ?? []) as HotTopic[]).slice(0, 3);

  const openTopic = (t: HotTopic) => {
    const id = String(t.id ?? '');
    if (id.startsWith('topic-')) router.push(`/detail/topic-detail?id=${id.slice('topic-'.length)}`);
    else router.push(`/search?q=${encodeURIComponent(t.title)}`);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {/* 我是谁 */}
      <MobileSection>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pt: 1.75, pb: 1.5 }}>
          {profileQ.isLoading ? (
            <Skeleton variant="circular" width={48} height={48} />
          ) : (
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 700,
                color: '#fff',
                background: coverBackground(profile?.avatar, gradient2('#FE2C55', '#25F4EE')),
              }}
            >
              {!profile?.avatar && (profile?.nickname?.charAt(0) || '我')}
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography noWrap sx={{ fontSize: 16, fontWeight: 700, minWidth: 0 }}>
                {profile?.nickname || (profileQ.isLoading ? ' ' : '未设置昵称')}
              </Typography>
              {profile && (
                <Box
                  component="span"
                  onClick={() => setActiveTab('creator')}
                  sx={{ flexShrink: 0, px: 0.75, py: 0.125, borderRadius: 1, fontSize: 11, fontWeight: 700, color: '#fff', background: gradient2('#FE2C55', '#FFB400'), cursor: 'pointer' }}
                >
                  Lv{profile.level}
                </Box>
              )}
            </Box>
            <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
              {profile?.levelName || '创作者'}
            </Typography>
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => profile?.userId && router.push(`/u?id=${profile.userId}`)}
            sx={{ all: 'unset', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', fontSize: 12, color: 'text.secondary' }}
          >
            主页
            <ChevronRightRoundedIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>
        <MobileStatRow
          items={[
            { label: '作品', value: fmt(profile?.works), onClick: () => setActiveTab('works') },
            { label: '粉丝', value: fmt(profile?.fans), onClick: () => setActiveTab('data') },
            { label: '获赞', value: fmt(profile?.likes) },
            { label: '关注', value: fmt(profile?.follows) },
          ]}
        />
      </MobileSection>

      {/* 发布:手机上工作台最重要的一件事,单独一个大按钮;13 种类型在「发布作品」页里选 */}
      <ButtonBase
        onClick={() => setActiveTab('hd-publish')}
        sx={{
          borderRadius: 3,
          py: 1.5,
          px: 2,
          justifyContent: 'flex-start',
          gap: 1.5,
          color: '#fff',
          background: 'linear-gradient(100deg, #FE2C55 0%, #FF6B3D 100%)',
          boxShadow: '0 8px 20px rgba(254,44,85,0.25)',
        }}
      >
        <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AddRoundedIcon />
        </Box>
        <Box sx={{ textAlign: 'left', flex: 1 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>发布作品</Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.85 }}>视频 · 图文 · 小说 · 音乐等 13 种</Typography>
        </Box>
        <ChevronRightRoundedIcon />
      </ButtonBase>

      <CreatorOnboarding compact />

      <NewCreationSection compact />

      {/* 本周数据:三个数 + 周环比,图表都在数据中心 */}
      <MobileSection title="本周数据" onMore={() => setActiveTab('data')} moreLabel="数据中心">
        {overviewQ.isLoading ? (
          <Skeleton variant="rounded" height={52} />
        ) : (
          <MobileStatRow
            items={[
              { label: '播放', value: fmt(ov.totalViews), hint: <Delta v={ov.viewsDelta} /> },
              { label: '点赞', value: fmt(ov.totalLikes), hint: <Delta v={ov.likesDelta} /> },
              { label: '评论', value: fmt(ov.totalComments), hint: <Delta v={ov.commentsDelta} /> },
            ]}
          />
        )}
      </MobileSection>

      {/* 接个悬赏:和悬赏中心打通,点开能直接认领 */}
      <BountyPicks variant="mobile" />

      {/* 可以参与的热门话题:前三个,更多在「活动与话题」 */}
      {topics.length > 0 && (
        <MobileSection title="热门话题" extra="参与获得曝光" onMore={() => setActiveTab('activity')} flush>
          {topics.map((t, i) => (
            <MobileListRow
              key={t.id}
              divider={i > 0}
              onClick={() => openTopic(t)}
              leading={
                <Box sx={{ width: 36, height: 36, borderRadius: 2, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: t.gradient || gradient2('#FE2C55', '#FFB400') }}>
                  <LocalFireDepartmentRoundedIcon sx={{ fontSize: 20 }} />
                </Box>
              }
              title={`#${t.title}`}
              subtitle={[t.participants, t.desc].filter(Boolean).join(' · ')}
            />
          ))}
        </MobileSection>
      )}
    </Box>
  );
}
