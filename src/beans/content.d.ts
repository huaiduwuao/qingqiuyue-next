import {TableListItem} from '@/beans/system';

export interface ArticleItem extends TableListItem {
  title?: string;
  ids?: any[];
  subtitle?: string;
  info?: string;
  content?: string;
  type?: string;
  status?: string;
  cover?: string;
  permission?: string;
  moduleContentId?: number;
  moduleContentStatus?: string;
  moduleContentSearch?: boolean;
}

export interface LiveItem extends TableListItem {
  title?: string;
  ids?: any[];
  subtitle?: string;
  info?: string;
  content?: string;
  type?: string;
  status?: string;
  cover?: string;
  permission?: string;
}

export interface PictureAlbumItem extends TableListItem {
  name?: string;
  info?: string;
  type?: string;
  url?: string;
  cover?: string;
  permission?: string;
}

export interface PictureItem extends TableListItem {
  url?: string;
  info?: string;
  name?: string;
  createTime?: any;
  members?: MemberItem[];
  cover?: string;
  permission?: string;
}

export interface MusicItem extends TableListItem {
  name?: string;
  info?: string;
  content?: string;
  type?: string;
  url?: string;
  cover?: string;
  permission?: string;
  members?: MemberItem[];
  singerName?: string;
  albumName?: string;
  message?: string;
  avatar?: string;
}

export interface MusicSingerItem extends TableListItem {
  name?: string;
  otherName?: string;
  spell?: string;
  info?: string;
  type?: string;
  url?: string;
  cover?: string;
  permission?: string;
  avatar?: string;
}

export interface VideoItem extends TableListItem {
  ids?: any;
  name?: string;
  moduleContentStatus?: string;
  info?: string;
  status?: string;
  content?: string;
  type?: string;
  cover?: string;
  url?: string;
  permission?: string;
  members?: MemberItem[];
}


export interface FilmItem extends TableListItem {
  ids?: any;
  title?: string;
  subtitle?: string;
  score?: string;
  fireScore?: string;
  age?: string;
  category?: string;
  area?: string;
  status?: string;
  content?: string;
  type?: string;
  cover?: string;
  url?: string;
  permission?: string;
}


export interface MemberItem {
  avatar?: string;
  name?: string;
  id?: string;
}

export interface NovelItem extends TableListItem {
  name?: string;
  novelId?: number;
  chapterId?: number;
  novelName?: string;
  collected?: boolean;
  chapterName?: string;
  info?: string;
  cover?: string;
  categoryName?: string;
  avatar?: string;
  type?: number;
  num?: number;
  category?: string;
  serialstatus?: string;
  url?: string;
  link?: string;
  author?: string;
  lastRead?: string;
  lastReadChapter?: number;
  permission?: string;
  serialnumber?: string;
  content?: any;
}


export interface NovelChapterItem extends TableListItem {
  title?: string;
  name?: string;
  num?: string;
  url?: string;
  moduleContentId?: string;
  collected?: boolean;
  content?: string;
  novelName?: string;
  novelId?: number;
  fullContent?: string;
  permission?: string;
}
