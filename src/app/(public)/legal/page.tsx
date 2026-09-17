'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import PublicTopBar from '@/components/layout/PublicTopBar';
import { SiteLegalFooter } from '@/components/layout/SiteLegalFooter';
import { LEGAL_SECTIONS, SITE_NAME } from '@/constants/site';

// 关于 / 免责声明 / 数据采集说明 —— 侧栏底部 SiteLegalFooter 的链接按锚点跳到这里的各节。
// 文案改动请同步核对:采集一节写的是现行做法(只索引公开信息、遵守 robots、视频不经本站代理)。

const SECTIONS: { id: string; title: string; body: React.ReactNode[] }[] = [
  {
    id: LEGAL_SECTIONS.about,
    title: `关于${SITE_NAME}`,
    body: [
      `${SITE_NAME}是一个内容索引与创作社区:追踪全网热点与各类榜单,把散落的信息整理成摘要;也留一块地方,让人慢下来想想生活的意义。`,
      '在这里可以用 AI 生成短剧,从不同视角对影视作品做 AIGC 再演绎与二次创作;可以发悬赏、接悬赏,也可以交易自己的作品;可以围绕任何话题开帖讨论——像皮皮虾一样轻松,像影评站一样认真,像贴吧一样什么都能聊。',
      `世上可以有无数个社区,${SITE_NAME}想做其中最自由、最聪明的那一个:自由,是在法律与公序良俗之内不预设立场、不限制话题;聪明,是让 AI 帮每个人更快找到信息、更容易把想法做成作品。`,
    ],
  },
  {
    id: LEGAL_SECTIONS.disclaimer,
    title: '免责声明',
    body: [
      '本站展示的榜单、热点、摘要与作品条目,多数由程序自动整理自互联网公开信息,仅供参考,不保证其准确、完整与及时,亦不构成任何投资、医疗、法律等专业建议。',
      '站内指向第三方网站的链接与播放源,其内容由第三方提供并负责,本站不存储、不控制也不为其背书;访问第三方网站的风险由用户自行判断与承担。',
      '用户发布的帖子、评论、作品与悬赏内容仅代表其个人观点,与本站立场无关。用户应保证所发布内容合法且不侵犯他人权益,并自行承担由此产生的责任。',
      '对于违反法律法规或侵害他人合法权益的内容,本站在收到通知或自行发现后,有权不经事先通知予以删除、屏蔽或断开链接。',
    ],
  },
  {
    id: LEGAL_SECTIONS.dataCollection,
    title: '互联网数据采集说明',
    body: [
      '本站通过自动化程序采集互联网上公开可访问的信息,用于生成榜单、热点追踪、内容索引与摘要。采集范围限于公开页面的标题、简介、封面、热度数值、来源链接等索引性信息。',
      '采集程序遵守目标网站的 robots 协议并控制访问频率,不绕过登录、付费或其他访问限制,不采集非公开的个人信息。',
      '条目均标注来源并链接回原始页面;影视等音视频内容不经本站服务器中转或缓存,由用户设备直接访问来源站点。所有被索引内容的著作权及相关权利归原作者或原平台所有。',
      <>
        如果你是权利人或网站运营者,不希望相关内容被本站索引,请按
        <Box component="a" href={`#${LEGAL_SECTIONS.complaint}`} sx={{ color: 'primary.main', mx: 0.5 }}>侵权投诉与联系</Box>
        一节的方式告知,我们会在核实后尽快移除,并停止对相关页面的采集。
      </>,
    ],
  },
  {
    id: LEGAL_SECTIONS.aigc,
    title: 'AIGC 与二次创作',
    body: [
      '站内由人工智能生成或辅助生成的文字、图片、音频、视频(包括 AI 短剧与影视再演绎)均带有「AI 生成」标识。此类内容可能存在事实错误或与原作不符,不代表本站观点,也不代表原作品及其权利人的立场。',
      '基于既有影视、文学等作品的二次创作,应限于评论、介绍、戏仿等合理使用范围,不得替代原作品的正常传播,不得使用他人肖像、声音进行误导性合成。创作者对其发布的二次创作承担责任;权利人提出异议的,本站将按投诉流程处理。',
    ],
  },
  {
    id: LEGAL_SECTIONS.trade,
    title: '悬赏与作品交易',
    body: [
      '悬赏与作品交易发生在用户之间,本站提供发布、托管结算与纠纷协助等技术服务,不是交易的任何一方。钻石为站内虚拟道具,仅限站内使用。',
      '出售或交付的作品应为本人原创或已获得合法授权。因作品权属、质量或履约产生的争议,由交易双方协商解决;本站可依据平台规则与留存记录协助处理。',
    ],
  },
  {
    id: LEGAL_SECTIONS.complaint,
    title: '侵权投诉与联系',
    body: [
      <>
        如认为站内内容侵犯了你的合法权益,或希望停止对你网站的采集,请通过
        <Box component={Link} href="/kf-chat" sx={{ color: 'primary.main', mx: 0.5 }}>在线客服</Box>
        联系我们,并提供:权利人身份与联系方式、涉嫌侵权内容的页面地址、权属证明及侵权说明。
      </>,
      '我们在收到完整材料后会尽快核实,并依法采取删除、屏蔽或断开链接等措施。',
    ],
  },
];

export default function LegalPage() {
  // 从首页侧栏点进来时,首页布局还锁着 body 滚动,浏览器的锚点定位落空;挂载后自己滚一次
  useEffect(() => {
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
      <PublicTopBar title="关于与声明" maxWidth="md" icon={<GavelRoundedIcon sx={{ fontSize: 18 }} />} />
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        {SECTIONS.map((s) => (
          <Box
            key={s.id}
            id={s.id}
            component="section"
            // 顶栏是 sticky 的,锚点跳转要让出它的高度
            sx={{ mb: { xs: 4, md: 5 }, scrollMarginTop: 'calc(var(--topbar-h, 60px) + 16px)' }}
          >
            <Typography component="h2" sx={{ fontSize: { xs: 17, md: 19 }, fontWeight: 700, mb: 1.5 }}>
              {s.title}
            </Typography>
            {s.body.map((p, i) => (
              <Typography
                key={i}
                sx={{ fontSize: 14, lineHeight: 1.9, color: 'var(--text-secondary, currentColor)', mb: 1.25 }}
              >
                {p}
              </Typography>
            ))}
          </Box>
        ))}
        <SiteLegalFooter sx={{ pt: 2, borderTop: '1px solid var(--border-color, transparent)' }} />
      </Container>
    </Box>
  );
}
