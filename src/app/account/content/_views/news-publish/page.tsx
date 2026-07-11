'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HdRoundedIcon from '@mui/icons-material/Hd';
import { useActiveTab } from '../../ActiveTabContext';
import { gradient2 } from '@/constants/gradients';
import PlaceholderShell from '../../_components/PlaceholderShell';

/**
 * 新闻发布 (NEWS) — 骨架页。
 *
 * 计划字段:标题 / 摘要(200字内) / 单图封面 / 来源 URL / 正文(支持引用块) /
 * 标签 / 发布时间。审核比普通内容更严(合规性),发布后不可改。
 */
export default function NewsPublishPage() {
  const { setActiveTab } = useActiveTab();
  return (
    <PlaceholderShell
      title="发布新闻"
      subtitle="NEWS contentType"
      gradient={gradient2('#F87171', '#FCA5A5')}
      icon={<ArticleRoundedIcon sx={{ fontSize: 44 }} />}
      desc={
        <>
          新闻发布支持摘要 + 单图 + 来源 + 正文,审核比普通内容更严
          (合规性),发布后不可改。
          <br />
          本入口暂未开放,先体验下方其他类型。
        </>
      }
      setActiveTab={setActiveTab}
    />
  );
}
