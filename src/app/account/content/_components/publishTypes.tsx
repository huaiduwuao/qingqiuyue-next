import React from 'react';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import FiberNewRoundedIcon from '@mui/icons-material/FiberNewRounded';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import MovieFilterRoundedIcon from '@mui/icons-material/MovieFilterRounded';
import LiveTvRoundedIcon from '@mui/icons-material/LiveTvRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import AnimationRoundedIcon from '@mui/icons-material/AnimationRounded';
import PodcastsRoundedIcon from '@mui/icons-material/PodcastsRounded';
import { PUBLISH_HUB_TYPE_LABEL, type PublishHubType } from '@/lib/contentRoute';

/**
 * 13 种可发布内容类型的**单一事实来源**。
 *
 * 此前「工作台新建区」(NewCreationSection.CREATION_ITEMS)与「发布落地页类型卡片」
 * (hd-publish/TypePicker.TYPE_CARDS)各维护一份类型清单 —— 图标、文案、配色、
 * id 体系各写各的(image vs picture-album),工作台把 'image' 直接传给 dispatcher,
 * 后者只认 'picture-album',图集/图片 MV 两个入口因此选不中类型。
 *
 * 现在统一以 PublishHubType(dispatcher 认的 kebab-case id)为 key,
 * 两侧都从这份定义生成,字段差异(工作台要渐变、落地页要徽章)由各自映射。
 */

export type PublishTypeId = Exclude<PublishHubType, 'all' | 'short-drama'>;

export interface PublishTypeDef {
  /** dispatcher 认的 id(= PublishHubType) */
  id: PublishTypeId;
  /** 后端 contentType 由 contentRoute.PUBLISH_HUB_TYPE_TO_CONTENT_TYPE 推导,这里不重复 */
  /** 一句话说明(两侧共用) */
  desc: string;
  /** 主色(落地页卡片描边/徽章色;工作台渐变基色) */
  color: string;
  /** 浅色底(落地页卡片图标底/徽绰底) */
  bg: string;
  icon: React.ReactElement;
  badge?: 'NEW' | 'HOT';
}

const iconSx = { fontSize: 22 };

export const PUBLISH_TYPES: PublishTypeDef[] = [
  { id: 'video',         desc: '4K / HDR / 多音轨字幕',       color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)',  icon: <CloudUploadRoundedIcon sx={iconSx} />,   badge: 'HOT' },
  { id: 'picture-album', desc: '多图 + 短文 + 标签',          color: '#FF7AB6', bg: 'rgba(255, 122, 182, 0.14)', icon: <ImageRoundedIcon sx={iconSx} /> },
  { id: 'picture-mv',    desc: '多图配音乐 · 时间轴',         color: '#F472B6', bg: 'rgba(244, 114, 182, 0.14)', icon: <PhotoLibraryRoundedIcon sx={iconSx} /> },
  { id: 'article',       desc: '长文 + 封面 + 分类',          color: '#25F4EE', bg: 'rgba(37, 244, 238, 0.12)',  icon: <ArticleRoundedIcon sx={iconSx} /> },
  { id: 'novel',         desc: '章节结构 · 长文本',           color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)',  icon: <MenuBookRoundedIcon sx={iconSx} /> },
  { id: 'news',          desc: '实时性 · 时事标签',           color: '#FE2C55', bg: 'rgba(254, 44, 85, 0.12)',  icon: <FiberNewRoundedIcon sx={iconSx} /> },
  { id: 'music',         desc: '音频 + LRC 歌词',             color: '#FFB400', bg: 'rgba(255, 180, 0, 0.12)',  icon: <MusicNoteRoundedIcon sx={iconSx} /> },
  { id: 'comics',        desc: '分镜 + 页面',                 color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)',  icon: <AutoStoriesRoundedIcon sx={iconSx} /> },
  { id: 'vshow',         desc: '选集结构',                    color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)',  icon: <MovieFilterRoundedIcon sx={iconSx} /> },
  { id: 'teleplay',      desc: '多集分集剧情',                color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)',  icon: <LiveTvRoundedIcon sx={iconSx} /> },
  { id: 'film',          desc: '长片 + 预告',                 color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.12)',  icon: <MovieRoundedIcon sx={iconSx} /> },
  { id: 'animation',     desc: '集数 + 制作信息',             color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)',  icon: <AnimationRoundedIcon sx={iconSx} /> },
  { id: 'live',          desc: '推流码 + 封面 + 预约',        color: '#5DDB96', bg: 'rgba(93, 219, 150, 0.12)',  icon: <PodcastsRoundedIcon sx={iconSx} /> },
];

/** 类型展示名(从 contentRoute 的 PUBLISH_HUB_TYPE_LABEL 取,不再手写)。 */
export function publishTypeLabel(id: PublishTypeId): string {
  return PUBLISH_HUB_TYPE_LABEL[id] ?? id;
}
