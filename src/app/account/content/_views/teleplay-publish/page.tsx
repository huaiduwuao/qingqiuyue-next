'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HdRoundedIcon from '@mui/icons-material/Hd';
import { useActiveTab } from '../../ActiveTabContext';
import { gradient2 } from '@/constants/gradients';
import PlaceholderShell from '../../_components/PlaceholderShell';

/**
 * 电视剧发布 (TELEPLAY) — 骨架页。
 *
 * 计划字段:剧名 / 简介 / 封面 / 季(默认 1)/ 集(每集独立视频) /
 * 标签。跟 VSHOW 区别:TELEPLAY 横屏、单集 30+ 分钟、支持多季。
 */
export default function TeleplayPublishPage() {
  const { setActiveTab } = useActiveTab();
  return (
    <PlaceholderShell
      title="发布电视剧"
      subtitle="TELEPLAY contentType"
      gradient={gradient2('#60A5FA', '#93C5FD')}
      icon={<TvRoundedIcon sx={{ fontSize: 44 }} />}
      desc={
        <>
          电视剧发布支持季 / 集(横屏,单集 30+ 分钟,多季)。
          <br />
          跟短剧的区别:横屏 + 单集更长 + 多季结构。
          <br />
          本入口暂未开放,先体验下方其他类型。
        </>
      }
      setActiveTab={setActiveTab}
    />
  );
}
