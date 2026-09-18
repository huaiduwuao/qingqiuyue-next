'use client';

// 13 个内容创作类型的统一配置 —— 工作台 / 发布中心 / 落地页三处共用。
//
// 历史:NewCreationSection(创作者中心)和 hd-publish/TypePicker(发布中心落地页)
// 各自维护一份卡片定义(id / 图标 / 标题 / 简介 / 渐变色 / contentType 后端枚举),
// 任何修改都得改两处,且容易漂。本文件是单一事实来源,工作台直接用;
// TypePicker 也换成 import 自这里。

import React from 'react';
import VideocamIcon from '@mui/icons-material/Videocam';
import ImageIcon from '@mui/icons-material/Image';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import DescriptionIcon from '@mui/icons-material/Description';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import LibraryMusicRoundedIcon from '@mui/icons-material/LibraryMusicRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import TvRoundedIcon from '@mui/icons-material/TvRounded';
import LocalMoviesRoundedIcon from '@mui/icons-material/LocalMoviesRounded';
import AnimationRoundedIcon from '@mui/icons-material/AnimationRounded';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';

export type CreationTypeId =
  | 'video'
  | 'image'
  | 'image-mv'
  | 'article'
  | 'novel'
  | 'news'
  | 'music'
  | 'comics'
  | 'vshow'
  | 'teleplay'
  | 'film'
  | 'animation'
  | 'live';

export interface CreationType {
  /** 工作台 chip 的 kebab-case id,与后端 publish hub chip 对齐 */
  id: CreationTypeId;
  /** 工作台卡片标题 */
  title: string;
  /** 工作台卡片简介(一句话) */
  desc: string;
  icon: React.ReactElement;
  /** 工作台卡片渐变色(linear-gradient(from, to)) */
  gradient: string;
  /** 后端 content_type 枚举,用于埋点/未来 payload 预填 */
  contentType: string;
  /** publish-hub chip 类型(见 PUBLISH_HUB_TYPE_TO_CONTENT_TYPE) */
  hubType:
    | 'video'
    | 'picture-album'
    | 'picture-mv'
    | 'article'
    | 'novel'
    | 'news'
    | 'music'
    | 'comics'
    | 'vshow'
    | 'teleplay'
    | 'film'
    | 'animation'
    | 'live';
  /** 卡片右上角的小徽标 */
  badge?: 'NEW' | 'HOT';
}

/** 渐变色工具 — 给两端的 hex 生成 linear-gradient。 */
function g2(a: string, b: string): string {
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export const CREATION_TYPES: CreationType[] = [
  {
    id: 'video',
    title: '发布视频',
    desc: '支持常用格式，推荐mp4、webm',
    icon: <VideocamIcon sx={{ fontSize: 32 }} />,
    gradient: g2('#FE2C55', '#FF6B8A'),
    contentType: 'VIDEO',
    hubType: 'video',
    badge: 'HOT',
  },
  {
    id: 'image',
    title: '发布图文',
    desc: '支持常用图片格式，png、jpg',
    icon: <ImageIcon sx={{ fontSize: 32 }} />,
    gradient: g2('#25F4EE', '#5DF7F2'),
    contentType: 'PICTURE',
    hubType: 'picture-album',
  },
  {
    id: 'image-mv',
    title: '发布图片 MV',
    desc: '多图轮播 + 背景音乐',
    icon: <PhotoLibraryRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: g2('#22D3EE', '#67E8F9'),
    contentType: 'PICTURE',
    hubType: 'picture-mv',
  },
  {
    id: 'article',
    title: '发布文章',
    desc: '支持 8000 字文本和 30 个图片素材',
    icon: <DescriptionIcon sx={{ fontSize: 32 }} />,
    gradient: g2('#8B5CF6', '#C4B5FD'),
    contentType: 'ARTICLE',
    hubType: 'article',
  },
  {
    id: 'novel',
    title: '发布小说',
    desc: '章节连载，单本可超 10 万字',
    icon: <MenuBookRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: g2('#A78BFA', '#DDD6FE'),
    contentType: 'NOVEL',
    hubType: 'novel',
  },
  {
    id: 'news',
    title: '发布新闻',
    desc: '摘要 + 配图 + 来源',
    icon: <ArticleRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: g2('#F87171', '#FCA5A5'),
    contentType: 'NEWS',
    hubType: 'news',
  },
  {
    id: 'music',
    title: '发布音乐',
    desc: '音频 + 封面 + LRC 歌词',
    icon: <LibraryMusicRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: g2('#34D399', '#6EE7B7'),
    contentType: 'MUSIC',
    hubType: 'music',
  },
  {
    id: 'comics',
    title: '发布漫画',
    desc: '分镜列表，每页图片 + 旁白',
    icon: <AutoStoriesRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: g2('#FB923C', '#FDBA74'),
    contentType: 'COMICS',
    hubType: 'comics',
  },
  {
    id: 'vshow',
    title: '发布短剧',
    desc: '竖屏短剧，支持选集',
    icon: <MovieFilterRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: g2('#F472B6', '#F9A8D4'),
    contentType: 'VSHOW',
    hubType: 'vshow',
  },
  {
    id: 'teleplay',
    title: '发布电视剧',
    desc: '季 / 集，每集独立视频',
    icon: <TvRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: g2('#60A5FA', '#93C5FD'),
    contentType: 'TELEPLAY',
    hubType: 'teleplay',
  },
  {
    id: 'film',
    title: '发布电影',
    desc: '长视频,海报+导演+演员+时长',
    icon: <LocalMoviesRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: g2('#1E40AF', '#3B82F6'),
    contentType: 'FILM',
    hubType: 'film',
  },
  {
    id: 'animation',
    title: '发布动画',
    desc: '2D/3D/定格,选集+制作公司+监督',
    icon: <AnimationRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: g2('#A855F7', '#C084FC'),
    contentType: 'ANIMATION',
    hubType: 'animation',
  },
  {
    id: 'live',
    title: '发布直播回放',
    desc: '直播录制+开始时间+弹幕开关',
    icon: <LiveTvRoundedIcon sx={{ fontSize: 32 }} />,
    gradient: g2('#DC2626', '#EF4444'),
    contentType: 'LIVE',
    hubType: 'live',
  },
];

/** 按 id 快速查表 */
export const CREATION_TYPES_BY_ID: Record<CreationTypeId, CreationType> = Object.fromEntries(
  CREATION_TYPES.map((c) => [c.id, c]),
) as Record<CreationTypeId, CreationType>;
