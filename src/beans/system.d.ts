export interface TableListItem {
  id?: number;
  disabled?: string;
  createTime?: string;
  updateTime?: string;
  createUser?: string;
  updateUser?: string;
}

export interface TableListParams {
  status?: string;
  name?: string;
  desc?: string;
  key?: number;
  currentPage?: number;
  filter?: Record<string, any[]>;
  sorter?: Record<string, any>;
  size?: number;
  current?: number;
}

export interface TableListPagination {
  total: number;
  pageSize: number;
  current: number;
}

export interface MenuItem extends TableListItem {
  pid?: number;
  name?: string;
  info?: string;
  code?: string;
  path?: string;
  sort?: number;
  icon?: string;
  type?: string;
  belong?: boolean;
  children?: MenuItem[];
}

export interface AppServiceItem extends TableListItem {
  name: string;
  path: string;
  appId: string;
}

export interface SysDictType {
  type: string;
}

export interface SysDictData {
  id: number,
  name: string;
  typeName: string;
  value: string;
  remark: string;
  typeId: number;
}

export interface PermissionItem extends TableListItem {
  permissionResourceId?: number;
  rolePermissionId?: number;
  name?: string;
  code?: string;
  info?: string;
}

export interface DataPermissionItem extends TableListItem {
  permissionResourceId?: number;
  roleDataPermissionId?: number;
  name?: string;
  code?: string;
  info?: string;
}

export interface UploadVo {
  file: File;
}

export interface ProvinceItem extends TableListItem {
  name?: string;
  code?: string;
  sort?: string;
}

export interface CityItem extends TableListItem {
  name?: string;
  code?: string;
  provinceCode?: string;
}

export interface AreaItem extends TableListItem {
  name?: string;
  code?: string;
}

export interface StreetItem extends TableListItem {
  name?: string;
  code?: string;
}

export interface DictDataItem extends TableListItem {
  name?: string;
  typeName?: string;
  value?: string;
  remark?: string;
  sort?: string;
  typeId?: number;
  pid?: number;
  children?: [];
}

export interface DictTypeItem extends TableListItem {
  name?: string;
  type?: string;
  dataList?: DictDataItem[];
}

export interface AppItem extends TableListItem {
  name?: string;
  code?: string;
  app?: string;
  secret?: string;
}

export interface AppConfigItem extends TableListItem {
  name?: string;
  code?: string;
  content?: any;
  type?: string;
}

export interface UserPointItem extends TableListItem {
  totalPoint?: string;
  usablePoint?: string;
  type?: string;
}

export interface UserLevelItem extends TableListItem {
  start?: string;
  end?: string;
  level?: string;
  name?: string;
  type?: string;
}


export interface UserItem extends TableListItem {
  userRoleId?: number;
  name?: string;
  path?: string;
  appId?: string;
  info?: string;
  pswd?: string;
  mobile?: string;
  address?: any;
  avatar?: string;
  country?: string;
  email?: string;
  geographic?: any;
  team?: string;
  notifyCount?: string;
  phone?: string;
  signature?: string;
  tags?: string;
  title?: string;
  nickname?: string;
}

export interface BotItem extends TableListItem {
  id?: number;
  name?: string;
  nickname?: string;
  avatar?: string;
  personaPrompt?: string;
  commentTemplates?: string[];
  useLlmForComments?: boolean;
  commentIntervalMinutes?: number;
  chatEnabled?: boolean;
  llmModel?: string;
  status?: 'active' | 'paused' | 'banned';
  lastActiveAt?: string;
  createTime?: string;
  updateTime?: string;
}

export interface UserChangeType {
  userIds?: number[];
  roleId?: number;
}

export interface UserRoleItem extends TableListItem {
  userRoleId?: number;
  roleIds?: number[];
  userId?: number;
  name?: string;
  system?: boolean;
  rolePermissionId?: number;
  info?: string;
}

export interface RoleItem extends TableListItem {
  name?: string;
  system?: boolean;
  rolePermissionId?: number;
  info?: string;
}

export interface MenuChangeType {
  roleId?: number;
  menuIds: number[];
}


export interface PermissionChangeType {
  roleId?: number;
  permissionIds?: number[];
}

export interface ResourceItem extends TableListItem {
  serviceId?: number;
  pid?: number;
  name?: string;
  url?: string;
  method?: string;
  serviceName?: string;
  belong?: boolean;
  children?: ResourceItem[];
}

export interface SystemModuleTemplateAttrItem extends TableListItem {
  name?: string;
  code?: string;
  remark?: string;
  content?: string;
}

export interface ModuleTemplateItem extends TableListItem {
  name?: string;
  code?: string;
  type?: string;
  category?: string;
  remark?: string;
  content?: any;
  sourceId?: any;
  parentId?: any;
  attrs?: any;
}

export interface ModuleItem extends TableListItem {
  title?: string;
  icon?: string;
  subtitle?: string;
  type?: string;
  sort?: string;
  cover?: string;
  shareType?: string;
  needPay?: string;
  shareContent?: any;
  search?: any;
  templateCode?: string;
  tags?: ModuleTagItem[];
  moduleBanners?: BannerItem[];
  contents?: ModuleContentItem[];
  categories?: ModuleCategoryItem[];
}

export interface ModuleContentToplist extends TableListItem {
  title?: string;
  subtitle?: string;
  type?: string;
  sort?: string;
  content?: any;
}

export interface ModuleContentToplistItem extends TableListItem {
  toplistId?: number;
  moduleContentId?: number;
  content?: ModuleContentItem;
}


export interface ModuleCategoryItem extends TableListItem {
  moduleId?: string;
  title?: string;
  subtitle?: string;
  contentUrl?: string;
  username?: string;
  userId?: string;
  url?: string;
  sort?: string;
}


export interface ModuleTagItem extends TableListItem {
  title?: string;
  moduleId?: string;
  sort?: string;
}

export interface ModuleContentItem extends TableListItem {
  moduleId?: string;
  title?: string;
  link?: string;
  subtitle?: string;
  shareType?: string;
  needPay?: string;
  shareContent?: any;
  sort?: string;
  avatar?: string;
  username?: string;
  collectNum?: string;
  agreeNum?: string;
  userId?: string;
  contentType?: string;
  contentId?: string;
  content?: any;
}

export interface ModuleContentTopItem extends TableListItem {
  moduleId?: string;
  title?: string;
  subtitle?: string;
  sort?: string;
  avatar?: string;
  username?: string;
  userId?: string;
  contentType?: string;
  contentId?: string;
  bgimg?: string;
}


export interface BannerItem extends TableListItem {
  title?: string;
  link?: string;
  moduleId?: string;
  subtitle?: string;
  contentType?: string;
  contentId?: string;
  url?: string;
  sort?: string;
}
