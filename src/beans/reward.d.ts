import {TableListItem} from "@/beans/system";

export interface DemandItem extends TableListItem {
  title?: string;
  tags?: any;
  subtitle?: string;
  content?: any;
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

export interface GroupItem extends TableListItem {
  name?: string;
  info?: string;
  content?: string;
  projects?: number;
  url?: string;
  cover?: string;
  status?: string;
  username?: string;
}

export interface ProjectItem extends TableListItem {
  name?: string;
  cover?: string;
  groups?: number
  content?: string;
  url?: string;
  logo?: string;
  status?: string;
  username?: string;
  info?: string;
}

export interface RealizationItem extends TableListItem {
  title?: string;
  subtitle?: string;
  content?: any;
  cover?: string;
  status?: string;
  publishTime?: string;
  endTime?: string;
  username?: string;
  avatar?: string;
  demands?: any;
}

export interface ConceptionItem extends TableListItem {
  name?: string;
  info?: string;
  content?: string;
  cover?: string;
  date?: string;
  pay?: number;
  status?: string;
  username?: string;
  avatar?: string;
}
