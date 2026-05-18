import type {Settings as ProSettings} from '@ant-design/pro-components';
import {UserModelState} from './user';
import type {StateType} from './login';
import {MenuModelState} from "@/models/menu";
import {DictTypeItem} from "@/beans/system";
import {NoticeItem} from "@/models/global";
import {NoticeIconData} from "@/components/NoticeIcon";
import {MusicItem} from "@/beans/content";

export {GlobalModelState, UserModelState};

export type Loading = {

  global: boolean;
  effects: Record<string, boolean | undefined>;
  models: {
    global?: boolean;
    menu?: boolean;
    setting?: boolean;
    user?: boolean;
    login?: boolean;
  };
};

export interface NoticeItem extends NoticeIconData {
  id: string;
  type: string;
  status: string;
}

export interface GlobalModelState {
  global: any;
  wsMessage: any;
  collapsed: boolean;
  searchShow: boolean;
  notices: NoticeItem[];
  moduleTypeShowList: any;
  dict: DictTypeItem[];
  musicDetail: MusicItem;
  musicParams: any;
  contactTalkShow: boolean;
  audioList: [];
  banner: any,
  currentUser: any,
  videoChat: any,
}

export type ConnectState = {
  global: GlobalModelState;
  loading: Loading;
  settings: ProSettings;
  login: StateType;
  systemMenu: MenuModelState;
};
