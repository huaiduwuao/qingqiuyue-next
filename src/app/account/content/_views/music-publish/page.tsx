'use client';

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LibraryMusicRoundedIcon from '@mui/icons-material/LibraryMusicRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import HdRoundedIcon from '@mui/icons-material/Hd';
import { useActiveTab } from '../../ActiveTabContext';
import { gradient2 } from '@/constants/gradients';
import PlaceholderShell from '../../_components/PlaceholderShell';

/**
 * 音乐发布 (MUSIC) — 骨架页。
 *
 * 计划字段:音频文件(mp3 / flac / wav) / 封面(300x300) / 歌名 / 艺人 /
 * 专辑 / LRC 歌词(带时间轴) / 流派 / 心情标签 / 发行时间。
 * 后续要支持:歌词逐行时间轴编辑器、音频波形预览、和声/分轨上传。
 */
export default function MusicPublishPage() {
  const { setActiveTab } = useActiveTab();
  return (
    <PlaceholderShell
      title="发布音乐"
      subtitle="MUSIC contentType"
      gradient={gradient2('#34D399', '#6EE7B7')}
      icon={<LibraryMusicRoundedIcon sx={{ fontSize: 44 }} />}
      desc={
        <>
          音乐发布支持音频文件 + 封面 + LRC 歌词(带时间轴) + 流派 / 心情标签。
          <br />
          后续还要做:歌词逐行时间轴编辑器、音频波形预览、和声 / 分轨上传。
          <br />
          本入口暂未开放,先体验下方其他类型。
        </>
      }
      setActiveTab={setActiveTab}
    />
  );
}
