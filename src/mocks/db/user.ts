/**
 * User & dict seed data — admin APIs(用户、积分、字典、菜单)。
 */

export const CURRENT_USER = {
  id: 1,
  username: 'guest',
  nickname: '怀独无傲',
  avatar: 'https://picsum.photos/seed/u1/100/100',
  // 管理员模式默认开启(mock 环境);真后端时由 /user/current 返 authorities
  authorities: ['ADMIN', 'SUPER_ADMIN'],
  permissions: [
    'system:role:list',
    'system:role:create',
    'system:role:update',
    'system:role:delete',
    'system:menu:list',
    'system:menu:create',
    'system:menu:update',
    'system:menu:delete',
    'system:permission:list',
    'system:permission:create',
    'system:permission:update',
    'system:permission:delete',
    'system:data-permission:list',
    'system:data-permission:create',
    'system:data-permission:update',
    'system:data-permission:delete',
    'system:user:list',
    'system:user:create',
    'system:user:update',
    'system:user:delete',
    'system:user-level:list',
    'system:user-level:create',
    'system:user-level:update',
    'system:user-level:delete',
    'system:user-point:list',
    'system:user-point:create',
    'system:user-point:update',
    'system:user-point:delete',
    'system:app:list',
    'system:app:create',
    'system:app:update',
    'system:app:delete',
    'system:app-config:list',
    'system:app-config:create',
    'system:app-config:update',
    'system:app-config:delete',
    'system:app-service:list',
    'system:app-service:create',
    'system:app-service:update',
    'system:app-service:delete',
    'system:resource:list',
    'system:resource:create',
    'system:resource:update',
    'system:resource:delete',
    'system:dict:list',
    'system:dict:create',
    'system:dict:update',
    'system:dict:delete',
    'system:website-dict:list',
    'system:website-dict:create',
    'system:website-dict:update',
    'system:website-dict:delete',
    'system:address:list',
    'system:address:create',
    'system:address:update',
    'system:address:delete',
  ],
};

export const MENU_LIST = [
  { id: 1, name: '首页', path: '/home', icon: 'home', sort: 1 },
  { id: 2, name: '内容管理', path: '/account/content', icon: 'content', sort: 2 },
  { id: 3, name: '悬赏中心', path: '/account/reward', icon: 'reward', sort: 3 },
];

export const MODULE_TYPE_DICT = {
  type: 'module-type',
  dataList: [
    { id: 1, name: 'NOVEL', label: '小说', sort: 1 },
    { id: 2, name: 'VIDEO', label: '视频', sort: 2 },
    { id: 3, name: 'MUSIC', label: '音乐', sort: 3 },
    { id: 4, name: 'FILM', label: '电影', sort: 4 },
    { id: 5, name: 'ARTICLE', label: '文章', sort: 5 },
    { id: 6, name: 'ANIMATION', label: '动画', sort: 6 },
    { id: 7, name: 'TELEPLAY', label: '电视剧', sort: 7 },
    { id: 8, name: 'COMICS', label: '漫画', sort: 8 },
    { id: 9, name: 'VSHOW', label: '综艺', sort: 9 },
  ],
};

export const DICT_TYPE_LIST = {
  list: [{ id: 1, name: '模块类型', code: 'module-type', type: 'module-type' }],
  total: 1,
};

export const DICT_DATA_BY_TYPE = [
  { id: 1, label: '小说', name: 'NOVEL', type: 'module-type', sort: 1 },
  { id: 2, label: '视频', name: 'VIDEO', type: 'module-type', sort: 2 },
  { id: 3, label: '音乐', name: 'MUSIC', type: 'module-type', sort: 3 },
  { id: 4, label: '电影', name: 'FILM', type: 'module-type', sort: 4 },
  { id: 5, label: '文章', name: 'ARTICLE', type: 'module-type', sort: 5 },
  { id: 6, label: '动画', name: 'ANIMATION', type: 'module-type', sort: 6 },
  { id: 7, label: '电视剧', name: 'TELEPLAY', type: 'module-type', sort: 7 },
  { id: 8, label: '漫画', name: 'COMICS', type: 'module-type', sort: 8 },
  { id: 9, label: '综艺', name: 'VSHOW', type: 'module-type', sort: 9 },
];

export const APP_CONFIG_LIST = [{ id: 1, code: 'more', content: { id: 1 } }];

export const MODULE_MENU_TREE = [
  {
    id: 1, name: '分类一', contentId: 1,
    children: [
      { id: 2, name: '子分类1-1', contentId: 2 },
      { id: 3, name: '子分类1-2', contentId: 3 },
    ],
  },
  { id: 4, name: '分类二', contentId: 4 },
];

export const USER_POINT = {
  level: 5,
  levelName: '白银',
  totalPoint: 1500,
  needPoint: 500,
};

export const USER_RELATION_PAGE = { records: [], totalRow: 0 };
