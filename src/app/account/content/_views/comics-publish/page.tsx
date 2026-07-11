'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HdRoundedIcon from '@mui/icons-material/Hd';
import { useActiveTab } from '../../ActiveTabContext';
import { gradient2 } from '@/constants/gradients';
import PlaceholderShell from '../../_components/PlaceholderShell';

/**
 * 漫画发布 (COMICS) — 骨架页。
 *
 * 计划字段:作品名 / 简介 / 封面 / 标签 / 分镜列表(每页图片 + 旁白
 * 文本框,支持拖拽排序)/ 单话页数。
 * 后续要支持:对白气泡编辑器、网点/特效、跨页大图。
 */
export default function ComicsPublishPage() {
  const { setActiveTab } = useActiveTab();
  return (
    <PlaceholderShell
      title="发布漫画"
      subtitle="COMICS contentType"
      gradient={gradient2('#FB923C', '#FDBA74')}
      icon={<AutoStoriesRoundedIcon sx={{ fontSize: 44 }} />}
      desc={
        <>
          漫画发布支持分镜列表(每页图片 + 旁白),支持拖拽排序。
          <br />
          后续还要做:对白气泡编辑器、网点 / 特效、跨页大图。
          <br />
          本入口暂未开放,先体验下方其他类型。
        </>
      }
      setActiveTab={setActiveTab}
    />
  );
}
