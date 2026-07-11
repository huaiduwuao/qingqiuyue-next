'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HdRoundedIcon from '@mui/icons-material/Hd';
import { useActiveTab } from '../../ActiveTabContext';
import { gradient2 } from '@/constants/gradients';
import PlaceholderShell from '../../_components/PlaceholderShell';

/**
 * 图片 MV 发布 (PICTURE) — 骨架页。
 *
 * 跟 image-publish(图集)的区别:图集是"多图 + 短文"(用户自己翻看),
 * 图片 MV 是"多图 + 背景音乐 + 时长 + 转场"(像 PPT 一样按时间播放)。
 *
 * 计划字段:多图槽(1-9 张) + 音频文件(背景音乐) + 总时长(自动算) +
 * 标题 / 简介 / 标签 / 转场效果(留给后续:淡入淡出 / 滑动 / 缩放)。
 */
export default function ImageMvPublishPage() {
  const { setActiveTab } = useActiveTab();
  return (
    <PlaceholderShell
      title="发布图片 MV"
      subtitle="PICTURE (图片 MV 变体)"
      gradient={gradient2('#22D3EE', '#67E8F9')}
      icon={<PhotoLibraryRoundedIcon sx={{ fontSize: 44 }} />}
      desc={
        <>
          图片 MV = 多图轮播 + 背景音乐 + 时长,像 PPT 一样自动播放。
          <br />
          跟图集(图文)的区别:图集用户翻看,图片 MV 系统按时间播放。
          <br />
          后续还要做:转场效果(淡入淡出 / 滑动 / 缩放)。
          <br />
          本入口暂未开放,先体验下方其他类型。
        </>
      }
      setActiveTab={setActiveTab}
    />
  );
}
