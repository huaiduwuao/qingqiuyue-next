export interface NoticeType {
  id: string;
  title: string;
  logo: string;
  description: string;
  updatedAt: string;
  member: string;
  href: string;
  memberLink: string;
}

export interface CurrentUser {
  id?: number;
  name?: string;
  nickname?: string;
  info?: string;
  avatar?: string;
  notice?: NoticeType[];
  email?: string;
  signature?: string;
  title?: string;
  mobile?: string;
  group?: string;
  tags?: TagType[];
  notifyCount?: number;
  unreadCount?: number;
  country?: string;
  geographic?: GeographicType;
  address?: string;
  phone?: string;
  focusCount?: number;
  fansCount?: number;
  authorities?: string[];
  permissions?: string[];
}


export interface TagType {
  key: string;
  label: string;
}

export interface GeographicType {
  province: number;
  city: number;
}


export interface NovelItem {
  id: number;
  userId: number;
  novelId: number;
  chapterId: number;
  chapterName: string;
  novelName: string;
  type: string;
  createTime: any;
  createUser: string;
}

export interface PictureItem {
  id: number;
  url: string;
  info: string;
  name: string;
  createTime: any;
  members: MemberItem[]
}

export interface MusicItem {
  id: number;
  url: string;
  info: string;
  name: string;
  createTime: any;
  members: MemberItem[]
}

export interface VideoItem {
  id: number;
  url: string;
  info: string;
  name: string;
  createTime: any;
  members: MemberItem[]
}

export interface MemberItem {
  avatar: string;
  name: string;
  id: string;
}
