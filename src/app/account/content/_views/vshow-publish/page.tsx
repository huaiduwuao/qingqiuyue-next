'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HdRoundedIcon from '@mui/icons-material/Hd';
import { useActiveTab } from '../../ActiveTabContext';
import { gradient2 } from '@/constants/gradients';
import PlaceholderShell from '../../_components/PlaceholderShell';

/**
 * 短剧发布 (VSHOW) — 骨架页。
 *
 * 计划字段:剧名 / 简介 / 封面 / 选集列表(每集独立视频,默认 1 集) /
 * 标签。VSHOW 是竖屏短剧(2-5 分钟/集),支持 1-30 集,跟 VIDEO
 * 区别在 metadata 强制竖屏 + 选集结构。
 */
export default function VshowPublishPage() {
  const { setActiveTab } = useActiveTab();
  return (
    <PlaceholderShell
      title="发布短剧"
      subtitle="VSHOW contentType"
      gradient={gradient2('#F472B6', '#F9A8D4')}
      icon={<MovieFilterRoundedIcon sx={{ fontSize: 44 }} />}
      desc={
        <>
          短剧发布支持选集列表(1-30 集竖屏短剧,每集 2-5 分钟)。
          <br />
          跟视频的区别:强制竖屏 + 选集结构。
          <br />
          本入口暂未开放,先体验下方其他类型。
        </>
      }
      setActiveTab={setActiveTab}
    />
  );
}
