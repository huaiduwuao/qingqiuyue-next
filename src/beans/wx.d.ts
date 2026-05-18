import {TableListItem} from "@/beans/system";

export interface WxUserItem extends TableListItem {
  title?: string;
  tags?: any;
  subtitle?: string;
  content?: string;
  cover?: string;
  pay?: number;
  status?: string;
  realizations?: any;
  myRealizations?: any;
  publishTime?: string;
  endTime?: string;
  username?: string;
  avatar?: string;
}

export interface WxMsgItem extends TableListItem {
  title?: string;
  tags?: any;
  subtitle?: string;
  content?: string;
  cover?: string;
  pay?: number;
  status?: string;
  realizations?: any;
  myRealizations?: any;
  publishTime?: string;
  endTime?: string;
  username?: string;
  avatar?: string;
}

export interface WxAutoReplyItem extends TableListItem {
  title?: string;
  tags?: any;
  subtitle?: string;
  content?: string;
  cover?: string;
  pay?: number;
  status?: string;
  realizations?: any;
  myRealizations?: any;
  publishTime?: string;
  endTime?: string;
  username?: string;
  avatar?: string;
}
