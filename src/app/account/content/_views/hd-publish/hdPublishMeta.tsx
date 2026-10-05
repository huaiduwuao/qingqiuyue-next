'use client';

import React from 'react';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import HighQualityRoundedIcon from '@mui/icons-material/HighQualityRounded';
import SubtitlesRoundedIcon from '@mui/icons-material/SubtitlesRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import type { HdStatus } from './data';

export const STATUS_META: Record<HdStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  transcoding: { label: '转码中', color: 'var(--fg-cyan)', bg: 'rgba(37, 244, 238, 0.12)', icon: <HourglassEmptyRoundedIcon sx={{ fontSize: 12 }} /> },
  reviewing: { label: '审核中', color: 'var(--fg-amber)', bg: 'rgba(255, 180, 0, 0.12)', icon: <RateReviewRoundedIcon sx={{ fontSize: 12 }} /> },
  review_failed: { label: '审核未通过', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)', icon: <GavelRoundedIcon sx={{ fontSize: 12 }} /> },
  published: { label: '已发布', color: 'var(--fg-green)', bg: 'rgba(93, 219, 150, 0.12)', icon: <CheckCircleRoundedIcon sx={{ fontSize: 12 }} /> },
  failed: { label: '转码失败', color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)', icon: <ErrorRoundedIcon sx={{ fontSize: 12 }} /> },
  scheduled: { label: '已定时', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)', icon: <RocketLaunchRoundedIcon sx={{ fontSize: 12 }} /> },
};

export const BENEFITS = [
  { icon: <RocketLaunchRoundedIcon sx={{ fontSize: 18 }} />, title: '极速审核', desc: '每月 10 次,审核单优先处理', color: '#FE2C55' },
  { icon: <BoltRoundedIcon sx={{ fontSize: 18 }} />, title: '智能转码', desc: '云端并行转码,4K ≤ 5 分钟', color: '#FFB400' },
  { icon: <HighQualityRoundedIcon sx={{ fontSize: 18 }} />, title: 'HDR 增强', desc: 'SDR 视频一键 HDR 化', color: '#8B5CF6' },
  { icon: <SubtitlesRoundedIcon sx={{ fontSize: 18 }} />, title: '字幕/音轨', desc: '多语言字幕 + 多音轨支持', color: '#25F4EE' },
  { icon: <SpeedRoundedIcon sx={{ fontSize: 18 }} />, title: '多清晰度', desc: '240P - 4K 自适应切换', color: '#5DDB96' },
  { icon: <AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />, title: 'AI 封面', desc: '智能抽取最佳帧作封面', color: '#5B8DEF' },
];
