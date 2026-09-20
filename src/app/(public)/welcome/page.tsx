'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PublicTopBar from '@/components/layout/PublicTopBar';
import { SiteLegalFooter } from '@/components/layout/SiteLegalFooter';
import { fetchContentTypes } from '@/apis/home-discover';
import { CONTENT_CATALOG, describePlayability, type ContentCatalogEntry } from '@/lib/contentCatalog';
import { LEGAL_PATH, SITE_NAME } from '@/constants/site';
import { markWelcomeSeen } from '@/lib/onboardingPrefs';

/**
 * 独立欢迎页 —— 给"看一眼网站是什么"的用户准备的稳定入口。
 *
 * 路由:
 *   /welcome          这页
 *   /welcome#about    关于清秋月
 *   /welcome#features 主要功能
 *   /welcome#types    内容类型一览
 *   /welcome#start    如何开始
 *   /welcome#faq      常见问题
 *
 * 模板照抄 /legal:PublicTopBar + Container + section 锚点 + SiteLegalFooter;
 * 顶栏带 sticky + 毛玻璃,锚点跳转要让出顶栏高度(scrollMarginTop),
 * 否则从首页点锚点进会被顶栏遮住一截。
 *
 * 副作用:挂载时调一次 markWelcomeSeen(),让 FirstRunGuide 的 Step 1
 * 知道用户已经看过这份"自我介绍",自动折叠重复段落。
 */

const bodySx = { fontSize: 14, lineHeight: 1.9, color: 'text.secondary', mb: 1.25 };

const FEATURES: { title: string; desc: React.ReactNode }[] = [
  {
    title: '首页频道',
    desc: (
      <>
        顶部 9 个预置频道(小说 / 漫画 / 影视 / 综艺 / 音乐 / 动漫 / 资讯 / 游戏 / 科技)+ 任意增删排序。
        点 Tune 图标可以按内容分类 / 题材 / 标签 / 意境 / 歌单,现场加频道。
      </>
    ),
  },
  {
    title: '意境专题',
    desc: (
      <>
        手动创建的话题,以及 topiccurator 自动生成的(按 tag / 平台 / hot_score 聚合)。
        进「意境」页可关注自己感兴趣的专题,关注后会出现在你的频道候选里。
      </>
    ),
  },
  {
    title: '歌单',
    desc: (
      <>
        音乐频道里可以建自建歌单、关注别人公开的歌单、查看平台编排的官方歌单;
        一张歌单本身就能加成首页的一个频道。
      </>
    ),
  },
  {
    title: '关注 / 收藏',
    desc: (
      <>
        人 - 内容 - 意境三维关注网络;在意境页关注专题,在内容详情点关注创作者,
        在歌单页收藏整套编排,三处汇总到「我的」主页。
      </>
    ),
  },
  {
    title: '可播放性',
    desc: (
      <>
        每个内容类型(小说 / 漫画 / 影视 / ...)都有默认的可播放性(可读 / 可播 / 跳站 / 维护中);
        个别记录的实际状态由卡片实时显示,详细解释见本页
        <Box component="a" href="#types" sx={{ color: 'primary.main', mx: 0.5 }}>内容类型一览</Box>
        。
      </>
    ),
  },
  {
    title: '客户端下载',
    desc: (
      <>
        网页版 + Tauri 桌面壳同一套代码;桌面端在 <Link href="/download" style={{ color: 'inherit' }}>客户端下载页</Link>{' '}
        取安装包,支持 Windows / macOS / Linux。
      </>
    ),
  },
];

const SECTIONS: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: 'about',
    title: `关于${SITE_NAME}`,
    body: (
      <>
        <Typography sx={bodySx}>
          {SITE_NAME}是一个内容索引与创作社区:追踪全网热点与各类榜单,把散落的信息整理成摘要;也留一块地方,让人慢下来想想生活的意义。
        </Typography>
        <Typography sx={bodySx}>
          在这里可以用 AI 生成短剧,从不同视角对影视作品做 AIGC 再演绎与二次创作;可以发悬赏、接悬赏,也可以交易自己的作品;可以围绕任何话题开帖讨论 —— 像皮皮虾一样轻松,像影评站一样认真,像贴吧一样什么都能聊。
        </Typography>
        <Typography sx={bodySx}>
          世上可以有无数个社区,{SITE_NAME}想做其中最自由、最聪明的那一个:自由,是在法律与公序良俗之内不预设立场、不限制话题;聪明,是让 AI 帮每个人更快找到信息、更容易把想法做成作品。
        </Typography>
        <Typography sx={{ ...bodySx, color: 'text.disabled', fontStyle: 'italic' }}>
          十年清秋 · 问心明月
        </Typography>
      </>
    ),
  },
  {
    id: 'features',
    title: '主要功能',
    body: (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5, mt: 1 }}>
        {FEATURES.map((f) => (
          <Box
            key={f.title}
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>{f.title}</Typography>
            <Typography sx={{ fontSize: 12.5, lineHeight: 1.7, color: 'text.secondary' }}>
              {f.desc}
            </Typography>
          </Box>
        ))}
      </Box>
    ),
  },
  {
    id: 'types',
    title: '内容类型一览',
    // 在组件内通过 TypesGrid 渲染,这里留个空 Fragment 即可。
    body: <TypesGrid />,
  },
  {
    id: 'start',
    title: '如何开始',
    body: (
      <Box component="ol" sx={{ pl: 2.5, m: 0, '& li': { mb: 1 } }}>
        <Step n="1">
          <b>新用户:</b>进入首页 → 弹出兴趣选择 → 选完生成专属页签栏 → 进对应频道。
        </Step>
        <Step n="2">
          <b>老用户:</b>首页右上角 Tune 图标(或底部导航「我的」→ 设置)→ 频道管理,可以拖动 / 增减 / 搜标签。
        </Step>
        <Step n="3">
          <b>搜索:</b>顶部搜索框支持关键字 / 标签 / 意境名;输完回车进搜索结果。
        </Step>
        <Step n="4">
          <b>个人页:</b>右下角头像(或底部「我的」标签)→ 我的主页、收藏、关注、历史。
        </Step>
        <Step n="5">
          <b>想自己发内容?</b>侧栏「内容管理」→ 发布图文 / 短视频;有悬赏的可以进「悬赏中心」。
        </Step>
      </Box>
    ),
  },
  {
    id: 'faq',
    title: '常见问题',
    body: (
      <Box>
        <Faq q="为什么我搜不到东西?">
          大概率是关键词 / 标签对应不上。先确认频道选对了(频道管理里能看到具体 type 或 tag),
          再把关键字换成更通用的同义词试试;题材类查询(仙侠 / 都市 / ...)走 tag 而不是 genre。
        </Faq>
        <Faq q="为什么这个视频点不开?">
          多数影视 / 综艺 / 视频类型的来源是第三方平台,本站只做入口 —— 点开会跳到来源站点,
          那个站点可能限地区或下线了。卡片上的「可播放性」徽标会标明状态。
        </Faq>
        <Faq q="AIGC 内容是官方做的吗?">
          不是。带「AI 生成」标识的内容由 AI 工具或用户自行创作,可能存在事实错误,
          与本站和原作权利人立场无关。详见 <Link href={`${LEGAL_PATH}#aigc`}>AIGC 与二次创作声明</Link>。
        </Faq>
        <Faq q="怎么联系 / 反馈 / 投诉侵权?">
          走 <Link href={`${LEGAL_PATH}#complaint`}>侵权投诉与联系</Link>,或点站内在线客服入口。
        </Faq>
      </Box>
    ),
  },
];

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <Box component="li" sx={{ '& b': { color: 'text.primary' } }}>
      <Typography component="span" sx={{ fontSize: 13.5, lineHeight: 1.85, color: 'text.secondary' }}>
        <Box component="span" sx={{ color: 'primary.main', fontWeight: 700, mr: 1 }}>{n}.</Box>
        {children}
      </Typography>
    </Box>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.5 }}>{q}</Typography>
      <Typography sx={{ ...bodySx, mb: 0 }}>
        <Box component="span" sx={{ '& a': { color: 'primary.main', textDecoration: 'none' } }}>{children}</Box>
      </Typography>
    </Box>
  );
}

export default function WelcomePage() {
  useEffect(() => {
    markWelcomeSeen();
    const jump = () => {
      const id = window.location.hash.slice(1);
      if (id) document.getElementById(id)?.scrollIntoView();
    };
    jump();
    window.addEventListener('hashchange', jump);
    return () => window.removeEventListener('hashchange', jump);
  }, []);

  return (
    <Box sx={{ minHeight: 'var(--app-height, 100vh)', bgcolor: 'var(--bg-body, transparent)', color: 'var(--text-primary, currentColor)' }}>
      <PublicTopBar title={`欢迎使用${SITE_NAME}`} maxWidth="md" icon={<CollectionsRoundedIcon sx={{ fontSize: 18 }} />} />
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        {SECTIONS.map((s) => (
          <Box
            key={s.id}
            id={s.id}
            component="section"
            sx={{ mb: { xs: 4, md: 5 }, scrollMarginTop: 'calc(var(--topbar-h, 60px) + 16px)' }}
          >
            <Typography component="h2" sx={{ fontSize: { xs: 17, md: 19 }, fontWeight: 700, mb: 1.5 }}>
              {s.title}
            </Typography>
            {s.body}
          </Box>
        ))}
        <SiteLegalFooter sx={{ pt: 2, borderTop: '1px solid var(--border-color, transparent)' }} />
      </Container>
    </Box>
  );
}

// ─────────────────────────── 内容类型网格 ───────────────────────────

function TypesGrid() {
  const typesQuery = useQuery({
    queryKey: ['welcome', 'types'],
    queryFn: () =>
      fetchContentTypes()
        .then((r: any) => (r?.list ?? []) as { code: string; name: string }[])
        .catch(() => []),
    staleTime: 10 * 60_000,
  });

  const dictByCode = new Map((typesQuery.data ?? []).map((t) => [t.code, t.name]));
  const entries: ContentCatalogEntry[] = CONTENT_CATALOG.map((e) =>
    dictByCode.has(e.code) && dictByCode.get(e.code) !== e.label
      ? { ...e, label: dictByCode.get(e.code)! }
      : e,
  );

  if (typesQuery.isLoading) {
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25 }}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={120} />
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
        gap: 1.25,
      }}
    >
      {entries.map((e) => {
        const badge = describePlayability(e.playability);
        return (
          <Box
            key={e.code}
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              transition: 'border-color .15s, transform .15s',
              '&:hover': { borderColor: 'primary.main', transform: 'translateY(-1px)' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{e.label}</Typography>
              <Chip
                label={badge.label}
                size="small"
                color={badge.tone === 'good' ? 'success' : badge.tone === 'warn' ? 'warning' : badge.tone === 'bad' ? 'error' : 'default'}
                variant="outlined"
                sx={{ fontSize: 10, height: 18, '& .MuiChip-label': { px: 0.75 } }}
              />
            </Box>
            <Typography sx={{ fontSize: 12, lineHeight: 1.6, color: 'text.secondary', flex: 1 }}>
              {e.shortDesc}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <Button
                component={Link}
                href={`/home/recommend?section=${e.sectionId}&tab=home`}
                size="small"
                variant="text"
                endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 13 }} />}
                sx={{ fontSize: 11, px: 0.5, minWidth: 0 }}
              >
                直达频道
              </Button>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
