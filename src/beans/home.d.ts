import {TableListItem} from "@/beans/system";

export interface MessageItem {
  id: number;
  title: string;
  subtitle: string;
  username: string;
  avatar: string;
  content: string;
  transferNum: number;
  commentNum: number;
  readNum: number;
  agreeNum: number;
  collectNum: number;
  transfer: boolean;
  agree: boolean;
  collect: boolean;
  status: string;
  publishTime: string;
  createTime: string;
  updateTime: string;
  comments: CommentItem[];
  dialogues: CommentItem[];
}

export interface CommentItem {
  id: number;
  messageId: number;
  userId: number;
  username: string;
  type: string;
  content: string;
  avatar: string;
  createTime: string;
  updateTime: string;
  replies: ReplyItem[]
}

export interface ReplyItem {
  id: number;
  userId: number;
  commentId: number;
  replyId: number;
  username: string;
  type: string;
  content: string;
  avatar: string;
  createTime: string;
  updateTime: string;
}

export interface NoticeIconItem {
  id?: number;
  info?: string;
  title?: string;
  status?: string;
  content?: any;
  createTime: string;
  updateTime: string;
  type?: string;
}

export interface NoticeSize {
  notificationSize?: number;
  messageSize?: number;
  eventSize?: number;
  totalSize?: number;
}

export interface ContactItem extends TableListItem {
  name?: string;
  avatar?: string;
  nickname?: string;
  info?: string;
  userId?: number;
  userById?: number;
  typeId?: any;
  type?: string;
  status?: string;
}

export interface ContactGroupItem extends TableListItem {
  name?: string;
  info?: string;
  userId?: number;
  typeId?: any;
  groupId?: any;
  type?: string;
  status?: string;
}

