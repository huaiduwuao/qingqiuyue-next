/**
 * Admin (system) seed data — user/role/menu/dict/app/area 等。
 */

import { range, dateOffset, pick, avatar, cover } from '../utils/seed';

const USER_NICKNAMES = ['小桥流水', '海的尽头', '南风知我意', '青衫客', '杏花微雨', '夜归人', '山间清月', '故园', '风继续吹', '那年夏天'];

const AREA_PROVINCES = [
  { id: 110000, name: '北京市', code: 'BJ' },
  { id: 310000, name: '上海市', code: 'SH' },
  { id: 440000, name: '广东省', code: 'GD' },
  { id: 330000, name: '浙江省', code: 'ZJ' },
  { id: 320000, name: '江苏省', code: 'JS' },
  { id: 510000, name: '四川省', code: 'SC' },
  { id: 420000, name: '湖北省', code: 'HB' },
  { id: 610000, name: '陕西省', code: 'SN' },
];

const CITIES_BY_PROVINCE: Record<number, { id: number; name: string; code: string }[]> = {
  110000: [{ id: 110100, name: '市辖区', code: 'BJC' }],
  310000: [{ id: 310100, name: '市辖区', code: 'SHC' }],
  440000: [
    { id: 440100, name: '广州市', code: 'GZ' },
    { id: 440300, name: '深圳市', code: 'SZ' },
    { id: 440600, name: '佛山市', code: 'FS' },
    { id: 441900, name: '东莞市', code: 'DG' },
  ],
  330000: [
    { id: 330100, name: '杭州市', code: 'HZ' },
    { id: 330200, name: '宁波市', code: 'NB' },
    { id: 330300, name: '温州市', code: 'WZ' },
  ],
  320000: [
    { id: 320100, name: '南京市', code: 'NJ' },
    { id: 320500, name: '苏州市', code: 'SZ' },
    { id: 320200, name: '无锡市', code: 'WX' },
  ],
  510000: [
    { id: 510100, name: '成都市', code: 'CD' },
    { id: 511700, name: '达州市', code: 'DZ' },
  ],
  420000: [
    { id: 420100, name: '武汉市', code: 'WH' },
    { id: 420500, name: '宜昌市', code: 'YC' },
  ],
  610000: [
    { id: 610100, name: '西安市', code: 'XA' },
    { id: 610500, name: '渭南市', code: 'WN' },
  ],
};

const STREETS_BY_CITY: Record<number, { id: number; name: string }[]> = {
  440100: range(5).map((i) => ({ id: 4401000 + i, name: ['天河区', '越秀区', '荔湾区', '海珠区', '番禺区'][i] })),
  440300: range(5).map((i) => ({ id: 4403000 + i, name: ['福田区', '罗湖区', '南山区', '宝安区', '龙岗区'][i] })),
  330100: range(5).map((i) => ({ id: 3301000 + i, name: ['上城区', '下城区', '江干区', '拱墅区', '西湖区'][i] })),
  320100: range(5).map((i) => ({ id: 3201000 + i, name: ['玄武区', '秦淮区', '建邺区', '鼓楼区', '栖霞区'][i] })),
  510100: range(5).map((i) => ({ id: 5101000 + i, name: ['锦江区', '青羊区', '金牛区', '武侯区', '成华区'][i] })),
  420100: range(5).map((i) => ({ id: 4201000 + i, name: ['江岸区', '江汉区', '硚口区', '汉阳区', '武昌区'][i] })),
  610100: range(5).map((i) => ({ id: 6101000 + i, name: ['新城区', '碑林区', '莲湖区', '灞桥区', '未央区'][i] })),
};

export const SYS_USER = {
  records: range(30).map((i) => ({
    id: 100 + i,
    username: `user_${(i + 1).toString().padStart(3, '0')}`,
    nickname: USER_NICKNAMES[i % USER_NICKNAMES.length],
    avatar: avatar(i + 1),
    email: `user${i + 1}@example.com`,
    phone: `138${(10000000 + i).toString().slice(-8)}`,
    sex: i % 3,
    status: i % 8 === 0 ? 'DISABLED' : 'ENABLED',
    roleId: 1 + (i % 5),
    roleName: ['超级管理员', '系统管理员', '运营', '审核员', '普通用户'][i % 5],
    department: ['总经办', '技术部', '运营部', '市场部', '客服部'][i % 5],
    lastLoginTime: dateOffset(i % 7, 14),
    lastLoginIp: `192.168.1.${i + 1}`,
    createTime: dateOffset(i + 7),
    updateTime: dateOffset(i, 10),
  })),
  totalRow: 30,
};

export const SYS_USER_LEVEL = {
  records: range(8).map((i) => ({
    id: 1 + i,
    level: i + 1,
    name: ['青铜', '白银', '黄金', '铂金', '钻石', '大师', '宗师', '王者'][i],
    minPoint: i * 1000,
    maxPoint: (i + 1) * 1000,
    userCount: 5000 - i * 500,
    icon: cover(60, 60, i + 796),
    color: ['#CD7F32', '#C0C0C0', '#FFD700', '#E5E4E2', '#B9F2FF', '#8B5CF6', '#FE2C55', '#5DDB96'][i],
    privileges: ['签到', '评论', '投稿', '审核', '管理', '运营', 'VIP客服', '专属经理'].slice(0, i + 1),
  })),
  totalRow: 8,
};

export const SYS_USER_POINT = {
  level: 5,
  levelName: '白银',
  totalPoint: 1500,
  needPoint: 500,
  history: range(15).map((i) => ({
    id: 1 + i,
    type: pick(['签到', '评论', '投稿', '兑换', '奖励', '扣除'], i),
    point: pick([10, 20, 50, 100, -50, 200, -100, 30, 5, 15], i),
    description: pick(['每日签到', '发表评论', '投稿被采纳', '积分兑换', '活动奖励', '违规扣除'], i),
    createTime: dateOffset(i, 12),
  })),
};

export const SYS_ROLE = {
  records: range(8).map((i) => ({
    id: 1 + i,
    name: ['超级管理员', '系统管理员', '运营', '审核员', '编辑', '普通用户', 'VIP 用户', '游客'][i],
    code: ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'AUDITOR', 'EDITOR', 'USER', 'VIP_USER', 'GUEST'][i],
    description: ['拥有所有权限', '系统级权限', '内容运营', '内容审核', '内容编辑', '基础用户', 'VIP 权益', '只读权限'][i],
    userCount: 5 - i,
    sort: i,
    status: i > 0 ? 'ENABLED' : 'ENABLED',
    createTime: dateOffset(i + 30),
  })),
  totalRow: 8,
};

export const SYS_MENU = {
  records: range(15).map((i) => ({
    id: 1 + i,
    name: ['首页', '内容管理', '系统管理', '用户管理', '角色管理', '菜单管理', '字典管理', '应用管理', '资源管理', '权限管理', '数据权限', '公众号', '爬虫管理', '悬赏中心', '个人中心'][i],
    path: ['/home', '/account/content', '/system', '/system/user', '/system/role', '/system/menu', '/system/dict', '/system/app', '/system/resource', '/system/permission', '/system/data-permission', '/system/wx/mp/menu', '/account/content', '/account/reward', '/account/center'][i],
    icon: ['home', 'content', 'system', 'user', 'role', 'menu', 'dict', 'app', 'resource', 'permission', 'data', 'wx', 'spider', 'reward', 'center'][i],
    parentId: i === 0 || i === 1 || i === 2 || i === 11 ? 0 : Math.floor(i / 3) + 1,
    sort: i,
    type: i < 3 ? 'menu' : 'route',
    permission: `system:menu${i}:view`,
    status: 'ENABLED',
    createTime: dateOffset(i + 10),
  })),
  totalRow: 15,
};

export const SYS_DICT_TYPE = {
  records: range(10).map((i) => ({
    id: 1 + i,
    name: ['模块类型', '内容状态', '用户状态', '角色类型', '菜单类型', '性别', '审核状态', '支付方式', '消息类型', '任务状态'][i],
    code: ['module-type', 'content-status', 'user-status', 'role-type', 'menu-type', 'sex', 'audit-status', 'pay-type', 'msg-type', 'task-status'][i],
    type: 'system',
    description: '系统字典',
    itemCount: 6 + i * 2,
    createTime: dateOffset(i + 10),
  })),
  totalRow: 10,
};

export const SYS_DICT_DATA = [
  // 模块类型(嵌套示例)
  {
    id: 1,
    typeId: 1,
    typeName: '模块类型',
    label: '视频',
    name: 'VIDEO',
    type: 'module-type',
    sort: 1,
    status: 'ENABLED',
    parentId: 0,
    pid: 0,
    remark: '视频内容',
    createTime: dateOffset(10),
    children: [
      { id: 11, typeId: 1, typeName: '模块类型', label: '短视频', name: 'SHORT_VIDEO', type: 'module-type', sort: 1, status: 'ENABLED', parentId: 1, pid: 1, remark: '', createTime: dateOffset(9), children: [] },
      { id: 12, typeId: 1, typeName: '模块类型', label: '长视频', name: 'LONG_VIDEO', type: 'module-type', sort: 2, status: 'ENABLED', parentId: 1, pid: 1, remark: '', createTime: dateOffset(8), children: [] },
      { id: 13, typeId: 1, typeName: '模块类型', label: '直播', name: 'LIVE', type: 'module-type', sort: 3, status: 'ENABLED', parentId: 1, pid: 1, remark: '', createTime: dateOffset(7), children: [] },
    ],
  },
  {
    id: 2,
    typeId: 1,
    typeName: '模块类型',
    label: '图文',
    name: 'ARTICLE',
    type: 'module-type',
    sort: 2,
    status: 'ENABLED',
    parentId: 0,
    pid: 0,
    remark: '图文内容',
    createTime: dateOffset(10),
    children: [
      { id: 21, typeId: 1, typeName: '模块类型', label: '长文', name: 'LONG_ARTICLE', type: 'module-type', sort: 1, status: 'ENABLED', parentId: 2, pid: 2, remark: '', createTime: dateOffset(9), children: [] },
      { id: 22, typeId: 1, typeName: '模块类型', label: '微文', name: 'SHORT_ARTICLE', type: 'module-type', sort: 2, status: 'ENABLED', parentId: 2, pid: 2, remark: '', createTime: dateOffset(8), children: [] },
    ],
  },
  {
    id: 3,
    typeId: 1,
    typeName: '模块类型',
    label: '音乐',
    name: 'MUSIC',
    type: 'module-type',
    sort: 3,
    status: 'ENABLED',
    parentId: 0,
    pid: 0,
    remark: '',
    createTime: dateOffset(10),
    children: [],
  },
  // 内容状态(平铺示例)
  { id: 4, typeId: 2, typeName: '内容状态', label: '已发布', name: 'PUBLISH', type: 'content-status', sort: 1, status: 'ENABLED', parentId: 0, pid: 0, remark: '', createTime: dateOffset(9), children: [] },
  { id: 5, typeId: 2, typeName: '内容状态', label: '已下架', name: 'UN_PUBLISH', type: 'content-status', sort: 2, status: 'ENABLED', parentId: 0, pid: 0, remark: '', createTime: dateOffset(8), children: [] },
  { id: 6, typeId: 2, typeName: '内容状态', label: '草稿', name: 'DRAFT', type: 'content-status', sort: 3, status: 'DISABLED', parentId: 0, pid: 0, remark: '', createTime: dateOffset(7), children: [] },
  // 用户状态
  { id: 7, typeId: 3, typeName: '用户状态', label: '已启用', name: 'ENABLED', type: 'user-status', sort: 1, status: 'ENABLED', parentId: 0, pid: 0, remark: '', createTime: dateOffset(6), children: [] },
  { id: 8, typeId: 3, typeName: '用户状态', label: '已禁用', name: 'DISABLED', type: 'user-status', sort: 2, status: 'ENABLED', parentId: 0, pid: 0, remark: '', createTime: dateOffset(5), children: [] },
  // 性别
  { id: 9, typeId: 6, typeName: '性别', label: '男', name: 'MALE', type: 'sex', sort: 1, status: 'ENABLED', parentId: 0, pid: 0, remark: '', createTime: dateOffset(4), children: [] },
  { id: 10, typeId: 6, typeName: '性别', label: '女', name: 'FEMALE', type: 'sex', sort: 2, status: 'ENABLED', parentId: 0, pid: 0, remark: '', createTime: dateOffset(3), children: [] },
  { id: 11, typeId: 6, typeName: '性别', label: '未知', name: 'UNKNOWN', type: 'sex', sort: 3, status: 'ENABLED', parentId: 0, pid: 0, remark: '', createTime: dateOffset(2), children: [] },
];

export const SYS_APP = {
  records: range(8).map((i) => ({
    id: 1 + i,
    name: ['抖音精选', '抖音创作者', '抖音直播', '今日头条', '西瓜视频', '番茄小说', '抖音电商', '剪映'][i],
    code: ['douyin_select', 'douyin_creator', 'douyin_live', 'toutiao', 'xigua', 'fanqie', 'douyin_shop', 'jianying'][i],
    type: ['web', 'mobile', 'mobile', 'mobile', 'mobile', 'mobile', 'mobile', 'mobile'][i],
    status: i < 7 ? 'PUBLISH' : 'UN_PUBLISH',
    description: `${['抖音精选', '抖音创作者', '抖音直播', '今日头条', '西瓜视频', '番茄小说', '抖音电商', '剪映'][i]} 应用描述`,
    icon: cover(60, 60, i + 801),
    version: `v${1 + Math.floor(i / 2)}.${i % 3}.0`,
    createTime: dateOffset(i + 5),
  })),
  totalRow: 8,
};

export const SYS_APP_CONFIG = {
  list: range(6).map((i) => ({
    id: 1 + i,
    code: ['home-banner', 'notice-template', 'sign-rule', 'share-template', 'withdraw-rule', 'reward-rule'][i],
    name: ['首页 Banner', '通知模板', '签到规则', '分享模板', '提现规则', '悬赏规则'][i],
    content: { value: `配置 ${i + 1}`, items: range(3).map((j) => ({ key: j, val: `val${j}` })) },
    status: 'ENABLED',
    createTime: dateOffset(i),
  })),
  total: 6,
};

export const SYS_APP_SERVICE = {
  list: range(6).map((i) => ({
    id: 1 + i,
    name: ['阿里云 OSS', '腾讯云 COS', '七牛云存储', '短信服务', '邮件服务', '支付服务'][i],
    provider: ['aliyun', 'tencent', 'qiniu', 'aliyun', 'tencent', 'alipay'][i],
    endpoint: ['https://oss-cn-hangzhou.aliyuncs.com', 'https://cos.ap-shanghai.myqcloud.com', 'https://upload.qiniup.com', 'https://dysmsapi.aliyuncs.com', 'https://dm.aliyuncs.com', 'https://openapi.alipay.com'][i],
    bucket: ['douyin-oss', 'douyin-125', 'douyin-qiniu', '', '', ''][i],
    status: 'ENABLED',
    createTime: dateOffset(i + 5),
  })),
  total: 6,
};

export const SYS_RESOURCE = {
  records: range(20).map((i) => ({
    id: 1 + i,
    name: ['用户查看', '用户编辑', '用户删除', '角色查看', '角色编辑', '菜单查看', '菜单编辑', '字典查看', '字典编辑', '内容查看', '内容编辑', '内容删除', '审核权限', '导出权限', '导入权限', '系统设置', '日志查看', '统计查看', '财务管理', '运营管理'][i],
    code: [`sys:user:view`, `sys:user:edit`, `sys:user:delete`, `sys:role:view`, `sys:role:edit`, `sys:menu:view`, `sys:menu:edit`, `sys:dict:view`, `sys:dict:edit`, `content:view`, `content:edit`, `content:delete`, `content:audit`, `data:export`, `data:import`, `sys:settings`, `sys:log`, `stats:view`, `finance:manage`, `ops:manage`][i],
    type: pick(['menu', 'button', 'api', 'menu', 'button'], i),
    parentId: i < 9 ? 1 : (i < 12 ? 10 : 16),
    path: `/admin/${i}`,
    method: pick(['GET', 'POST', 'PUT', 'DELETE', 'GET'], i),
    createTime: dateOffset(i + 10),
  })),
  totalRow: 20,
};

export const SYS_DATA_PERMISSION = {
  records: range(6).map((i) => ({
    id: 1 + i,
    name: ['全部数据', '本部门数据', '本部门及下级', '本人数据', '自定义范围', '仅本人创建'][i],
    code: ['ALL', 'DEPT', 'DEPT_AND_CHILD', 'SELF', 'CUSTOM', 'CREATED_BY'][i],
    description: ['查看所有数据', '仅本部门数据', '本部门及下级部门', '仅本人数据', '自定义数据范围', '本人创建的数据'][i],
    sort: i,
    createTime: dateOffset(i + 5),
  })),
  totalRow: 6,
};

export const SYS_PROVINCE = AREA_PROVINCES;

export const SYS_CITY = (() => {
  const list: any[] = [];
  Object.entries(CITIES_BY_PROVINCE).forEach(([pid, cities]) => {
    cities.forEach((c) => list.push({ ...c, provinceId: Number(pid), provinceName: AREA_PROVINCES.find((p) => p.id === Number(pid))?.name }));
  });
  return { records: list, totalRow: list.length };
})();

export const SYS_STREET = (() => {
  const list: any[] = [];
  Object.entries(STREETS_BY_CITY).forEach(([cid, streets]) => {
    streets.forEach((s) => list.push({ ...s, cityId: Number(cid) }));
  });
  return { records: list, totalRow: list.length };
})();

export const SYS_AREA = {
  provinces: AREA_PROVINCES,
  cities: CITIES_BY_PROVINCE,
  streets: STREETS_BY_CITY,
};

export const SYS_WEBSITE_DICT = {
  records: range(15).map((i) => ({
    id: 1 + i,
    name: ['笔趣阁', '起点中文', '晋江文学', '哔哩哔哩', '腾讯视频', '爱奇艺', '优酷', '网易云音乐', 'QQ音乐', '豆瓣电影', '猫眼电影', '知乎', '微博', '今日头条', '抖音'][i],
    domain: ['biquge.tw', 'qidian.com', 'jjwxc.net', 'bilibili.com', 'v.qq.com', 'iqiyi.com', 'youku.com', 'music.163.com', 'y.qq.com', 'douban.com', 'maoyan.com', 'zhihu.com', 'weibo.com', 'toutiao.com', 'douyin.com'][i],
    type: pick(['novel', 'novel', 'novel', 'video', 'video', 'video', 'video', 'music', 'music', 'film', 'film', 'qa', 'social', 'news', 'short_video'], i),
    icon: cover(40, 40, i + 567),
    description: `${['笔趣阁', '起点中文', '晋江文学', '哔哩哔哩', '腾讯视频', '爱奇艺', '优酷', '网易云音乐', 'QQ音乐', '豆瓣电影', '猫眼电影', '知乎', '微博', '今日头条', '抖音'][i]} 网站字典配置`,
    sort: i,
    enabled: i % 6 !== 0,
    createTime: dateOffset(i + 5),
  })),
  totalRow: 15,
};

export const NOTICE_LIST = {
  records: range(20).map((i) => ({
    id: 1 + i,
    title: `系统通知 ${i + 1}`,
    content: `这是一条系统通知的详细内容,用于演示通知列表的展示效果,通知 ID: ${i + 1}`,
    type: pick(['system', 'announcement', 'reminder', 'activity'], i),
    level: pick(['info', 'warning', 'success', 'error'], i),
    status: i < 15 ? 'PUBLISH' : 'DRAFT',
    publisher: '系统管理员',
    publishTime: dateOffset(i),
    createTime: dateOffset(i + 1),
  })),
  totalRow: 20,
};

export const USER_CONTACT = {
  records: range(15).map((i) => ({
    id: 1 + i,
    userId: 2000 + i,
    contactId: 3000 + (i + 1) % 15,
    nickname: USER_NICKNAMES[(i + 1) % USER_NICKNAMES.length],
    avatar: avatar(i + 100),
    type: pick(['friend', 'group', 'stranger'], i),
    status: pick(['pending', 'agreed', 'rejected', 'blocked'], i),
    message: '想加你为好友',
    createTime: dateOffset(i),
  })),
  totalRow: 15,
};

export const USER_CONTACT_GROUP = {
  records: range(8).map((i) => ({
    id: 1 + i,
    name: ['工作群', '家人群', '朋友群', '技术交流', '读书会', '运动健身', '美食分享', '旅行爱好者'][i],
    description: '群组描述',
    avatar: cover(60, 60, i + 247),
    ownerId: 100,
    memberCount: 5 + i * 3,
    maxMembers: 100,
    type: pick(['normal', 'vip', 'private'], i),
    status: 'active',
    createTime: dateOffset(i + 5),
  })),
  totalRow: 8,
};

export const USER_CONTACT_RECENT = range(10).map((i) => ({
  id: 1 + i,
  userId: 100,
  contactId: 2000 + (i + 1) % 15,
  contactType: i % 3 === 0 ? 'group' : 'user',
  nickname: USER_NICKNAMES[i % USER_NICKNAMES.length],
  avatar: avatar(i + 200),
  lastMessage: ['在吗?', '晚上一起吃饭', '工作进展如何', '收到文件', '晚安', '今天天气不错', '会议几点开始', '收到,谢谢', '你好', '周末爬山去吗'][i],
  lastMessageTime: dateOffset(i, 14),
  unreadCount: i % 4,
}));

export const USER_SIGN = {
  hasSign: true,
  todayPoint: 10,
  continuousDays: 7,
  totalDays: 42,
  rewardPoint: 10,
  record: range(7).map((i) => ({
    date: dateOffset(i, 9).slice(0, 10),
    signed: true,
    point: 10,
    continuous: 7 - i,
  })),
};

export const USER_RELATION = {
  followers: range(15).map((i) => ({
    id: 5000 + i,
    nickname: USER_NICKNAMES[i % USER_NICKNAMES.length],
    avatar: avatar(i + 300),
    bio: '这个人很懒,什么都没留下~',
    followTime: dateOffset(i, 12),
    fansCount: 100 + i * 50,
  })),
  following: range(10).map((i) => ({
    id: 6000 + i,
    nickname: USER_NICKNAMES[(i + 1) % USER_NICKNAMES.length],
    avatar: avatar(i + 400),
    bio: '专注内容创作',
    followTime: dateOffset(i, 15),
  })),
};

export const MODULE_MENU_TREE = [
  {
    id: 1, name: '分类一', contentId: 1001, type: 'NOVEL',
    children: [
      { id: 2, name: '子分类1-1', contentId: 2001, type: 'NOVEL' },
      { id: 3, name: '子分类1-2', contentId: 2002, type: 'VIDEO' },
    ],
  },
  {
    id: 4, name: '分类二', contentId: 1002, type: 'VIDEO',
    children: [
      { id: 5, name: '子分类2-1', contentId: 2003, type: 'TELEPLAY' },
      { id: 6, name: '子分类2-2', contentId: 2004, type: 'FILM' },
    ],
  },
  {
    id: 7, name: '分类三', contentId: 1003, type: 'MUSIC',
    children: [
      { id: 8, name: '子分类3-1', contentId: 2005, type: 'MUSIC' },
    ],
  },
];

export const USER_PROFILE = {
  id: 1,
  username: 'guest',
  nickname: '游客',
  avatar: avatar(1),
  bio: '这是一个示例用户简介',
  birthday: '1995-01-01',
  location: '北京',
  website: 'https://example.com',
  level: 5,
  levelName: '白银',
  point: 1500,
  registerTime: dateOffset(180, 10),
  lastLoginTime: new Date().toISOString(),
  stats: {
    posts: 28,
    followers: 23,
    following: 131,
    likes: 12480,
  },
};

export const DASHBOARD_RADAR = {
  indicators: [
    { name: '内容产出', max: 100 },
    { name: '用户活跃', max: 100 },
    { name: '互动量', max: 100 },
    { name: '传播力', max: 100 },
    { name: '变现能力', max: 100 },
    { name: '合规度', max: 100 },
  ],
  series: [
    { name: '本月', value: [85, 78, 92, 70, 65, 88] },
    { name: '上月', value: [70, 72, 80, 60, 58, 82] },
  ],
};

// ─── 通知中心 ───
const NOTICE_TITLES = [
  '你关注的小桥流水发布了新作品',
  '海的尽头在评论中@了你',
  '青衫客赞了你的作品《记录日常,分享生活》',
  '杏花微雨关注了你',
  '夜归人回复了你的评论',
  '山间清月 喜欢了你的评论',
  '故园 评论了你的作品',
  '风继续吹 关注了你',
  '那年夏天 提到了你',
  '南风知我意 给你的作品点赞',
];
const NOTICE_PREVIEWS = [
  '视频内容真不错,拍摄角度很独特,配乐也很搭。',
  '看看这个新出炉的 Vlog,日常记录很有感觉。',
  '忍不住点赞了!画面色彩太美了。',
  '作品发布提醒:你关注的人发布了新内容。',
  '回复:我也经常去这家店,改天一起约~',
  '你的评论收到 1 个新的点赞',
  '期待你的下一期作品!',
  '感谢你的关注,一起加油~',
  '提到你:来看看这个搞笑合集',
  '你的作品被收录到「本周精选」',
];
const NOTICE_TYPES = ['comment', 'mention', 'like', 'follow', 'comment', 'like', 'comment', 'follow', 'mention', 'like'];
const NOTICE_NICKS = USER_NICKNAMES.concat(['抖音官方账号', '系统小助手', '小助手', '大海']);

export const NOTICE_INTERACTION = {
  records: range(12).map((i) => ({
    id: 10000 + i,
    type: pick(NOTICE_TYPES, i),
    typeName: { comment: '评论', mention: '@我', like: '赞', follow: '新粉丝' }[pick(NOTICE_TYPES, i)],
    fromUserId: 2000 + i,
    nickname: pick(NOTICE_NICKS, i),
    avatar: avatar(i + 510),
    content: pick(NOTICE_PREVIEWS, i),
    title: pick(NOTICE_TITLES, i),
    targetId: 3000 + i,
    targetType: pick(['video', 'comment', 'post'], i),
    targetCover: cover(120, 80, i + 720),
    unread: i < 6,
    time: dateOffset(Math.floor(i / 2), 10 + (i % 12)),
  })),
  totalRow: 12,
};

export const NOTICE_SYSTEM = {
  records: range(8).map((i) => ({
    id: 20000 + i,
    type: pick(['announcement', 'activity', 'reminder', 'security'], i),
    typeName: { announcement: '官方公告', activity: '平台活动', reminder: '服务提醒', security: '账号安全' }[pick(['announcement', 'activity', 'reminder', 'security'], i)],
    title: [
      '【公告】关于平台升级维护的通知',
      '【活动】创作者激励计划开启',
      '【提醒】你的会员即将到期',
      '【安全】检测到新的登录设备',
      '【公告】内容规范更新',
      '【活动】618 创作大赛报名启动',
      '【提醒】作品版权登记成功',
      '【安全】账号密码已修改',
    ][i],
    content: [
      '为了提供更好的服务,我们将于本周日凌晨 02:00-04:00 进行系统升级,期间部分功能可能短暂不可用。',
      '本期创作者激励计划已开启,完成指定任务可获得额外流量扶持和现金奖励,详情请查看活动页面。',
      '你的会员将于 3 天后到期,开通自动续费可享受 9 折优惠,确保权益不中断。',
      '你的账号于 ' + dateOffset(1, 22).slice(0, 16) + ' 在新设备登录,如非本人操作请及时修改密码。',
      '为营造健康社区环境,我们更新了内容发布规范,请所有创作者在发布前仔细阅读最新版本。',
      '本届创作大赛即日起接受报名,设有一二三等奖及人气奖,获奖作品将获得首页推荐位。',
      '你提交的作品《记录日常,分享生活》已成功完成版权登记,可在创作者中心查看证书。',
      '你的账号密码已成功修改,下次登录请使用新密码。如非本人操作,请立即联系客服。',
    ][i],
    level: pick(['info', 'success', 'warning', 'error'], i),
    unread: i < 3,
    time: dateOffset(i, 9 + (i % 10)),
  })),
  totalRow: 8,
};

// ─── 私信 ───
const DM_SAMPLE_TEXTS = [
  '你好,看到你的作品很有共鸣,方便互关一下吗?',
  '上次的合作很愉快,期待下次再一起!',
  '想咨询一下你用的剪辑软件是什么?',
  '新作品发布啦,记得来看~',
  '昨天视频里出现的那家店在哪里?我也想去',
  '可以加个联系方式吗?',
  '谢谢你的关注,会继续努力更新',
  '你的视频给了我们很多启发,感谢分享',
  '明天的直播有抽奖活动,别错过哦',
  '嗨,刚来抖音,请多关照',
];

export const DM_SESSIONS = [
  {
    id: 1,
    userId: 7001,
    nickname: '工具人研究Hive',
    avatar: avatar(1001),
    bio: '工具人研究 / 效率工具分享',
    isFollowed: false,
    unread: 1,
    lastMessage: '对方回复或关注你之前,只能发送一条文字消息。',
    lastMessageType: 'system',
    lastTime: '04/07',
    pinned: true,
  },
  {
    id: 2,
    userId: 7002,
    nickname: '50651847211',
    avatar: avatar(1002),
    bio: '',
    isFollowed: false,
    unread: 0,
    lastMessage: '你撤回了一条消息',
    lastMessageType: 'recall',
    lastTime: '2025/09/01',
    pinned: false,
  },
  {
    id: 3,
    userId: 7003,
    nickname: '抖音官方账号',
    avatar: avatar(1003),
    bio: '官方通知与服务',
    isOfficial: true,
    isFollowed: true,
    unread: 1,
    lastMessage: '【创作者激励】你的作品已加入流量扶持计划',
    lastMessageType: 'text',
    lastTime: '昨天',
    pinned: true,
  },
  {
    id: 4,
    userId: 7004,
    nickname: '小桥流水',
    avatar: avatar(1004),
    bio: '记录生活,分享美好',
    isFollowed: true,
    unread: 0,
    lastMessage: '好的,周末见~',
    lastMessageType: 'text',
    lastTime: '昨天',
    pinned: false,
  },
  {
    id: 5,
    userId: 7005,
    nickname: '海的尽头',
    avatar: avatar(1005),
    bio: '旅行 / 摄影 / 随笔',
    isFollowed: true,
    unread: 2,
    lastMessage: '那个海边位置发我一下?',
    lastMessageType: 'text',
    lastTime: '2 天前',
    pinned: false,
  },
  {
    id: 6,
    userId: 7006,
    nickname: '南风知我意',
    avatar: avatar(1006),
    bio: '',
    isFollowed: false,
    unread: 0,
    lastMessage: '谢谢推荐,很实用',
    lastMessageType: 'text',
    lastTime: '3 天前',
    pinned: false,
  },
  {
    id: 7,
    userId: 7007,
    nickname: '青衫客',
    avatar: avatar(1007),
    bio: '读书 / 写字 / 慢生活',
    isFollowed: true,
    unread: 0,
    lastMessage: '[图片]',
    lastMessageType: 'image',
    lastTime: '4 天前',
    pinned: false,
  },
  {
    id: 8,
    userId: 7008,
    nickname: '杏花微雨',
    avatar: avatar(1008),
    bio: '',
    isFollowed: false,
    unread: 0,
    lastMessage: '好的,明天一起拍',
    lastMessageType: 'text',
    lastTime: '1 周前',
    pinned: false,
  },
  {
    id: 9,
    userId: 7009,
    nickname: '夜归人',
    avatar: avatar(1009),
    bio: '夜班打工人 / 偶尔写作',
    isFollowed: false,
    unread: 0,
    lastMessage: '新书已收到,非常感谢',
    lastMessageType: 'text',
    lastTime: '1 周前',
    pinned: false,
  },
  {
    id: 10,
    userId: 7010,
    nickname: '山间清月',
    avatar: avatar(1010),
    bio: '登山 / 露营 / 装备评测',
    isFollowed: false,
    unread: 0,
    lastMessage: '改天一起去爬武功山',
    lastMessageType: 'text',
    lastTime: '2 周前',
    pinned: false,
  },
];

// ─── 数据分析看板 ───
export const DASHBOARD_STATS = {
  totalUsers: 28647,
  totalUsersGrowth: 12.5,
  totalContent: 158392,
  totalContentGrowth: 8.3,
  todayRevenue: 48560,
  todayRevenueGrowth: -3.2,
  totalOrders: 6721,
  totalOrdersGrowth: 22.8,
  newUsersToday: 342,
  activeUsersToday: 12856,
  conversionRate: 4.8,
};

export const DASHBOARD_TREND = range(30).map((i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  const day = `${date.getMonth() + 1}/${date.getDate()}`;
  return {
    date: day,
    users: 120 + Math.floor(Math.random() * 200),
    content: 50 + Math.floor(Math.random() * 150),
    revenue: 800 + Math.floor(Math.random() * 1200),
    orders: 30 + Math.floor(Math.random() * 70),
    activeUsers: 400 + Math.floor(Math.random() * 300),
  };
});

export const DASHBOARD_CONTENT_DISTRIBUTION = [
  { type: '视频', count: 45230, percent: 37, color: '#FE2C55' },
  { type: '图文', count: 32150, percent: 26, color: '#25F4EE' },
  { type: '音乐', count: 21580, percent: 18, color: '#FFB400' },
  { type: '小说', count: 12890, percent: 11, color: '#8B5CF6' },
  { type: '动漫', count: 6540, percent: 5, color: '#5DDB96' },
  { type: '其他', count: 3890, percent: 3, color: '#A78BFA' },
];

export const DASHBOARD_TOP_CREATORS = range(10).map((i) => ({
  rank: i + 1,
  id: 8000 + i,
  name: USER_NICKNAMES[i % USER_NICKNAMES.length],
  avatar: avatar(i + 100),
  fans: 100000 - i * 7000 + Math.floor(Math.random() * 3000),
  works: 120 - i * 10 + Math.floor(Math.random() * 8),
  totalViews: 5000000 - i * 400000 + Math.floor(Math.random() * 100000),
  growth: 15 - i + Math.floor(Math.random() * 10),
}));

export const DASHBOARD_RECENT_ACTIVITIES = range(15).map((i) => ({
  id: 9000 + i,
  user: USER_NICKNAMES[(i + 3) % USER_NICKNAMES.length],
  avatar: avatar(i + 500),
  action: pick(['发布了新作品', '更新了内容', '获得精选', '完成订单', '新增粉丝里程碑', '作品破万播放', '开通会员', '收到打赏'], i),
  target: pick(['《记录日常》', '《旅行日记》', '《我的创作故事》', '《生活美学》', '《科技前沿》', '《美食探店》'], i),
  time: dateOffset(Math.floor(i / 2), 8 + (i % 12)),
}));

// ─── 工作台 ───
export const WORKPLACE_USER = {
  name: '系统管理员',
  avatar: avatar(1),
  role: '超级管理员',
  department: '技术部',
  greeting: (() => {
    const h = new Date().getHours();
    if (h < 6) return '夜深了,注意休息';
    if (h < 9) return '早上好';
    if (h < 12) return '上午好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  })(),
};

export const WORKPLACE_QUICK_ACTIONS = [
  { id: 'content', label: '发布内容', icon: 'publish', color: '#FE2C55', path: '/account/content' },
  { id: 'user', label: '添加用户', icon: 'userAdd', color: '#5B8DEF', path: '/system/user' },
  { id: 'hermes', label: '管理智能体', icon: 'bot', color: '#07C160', path: '/system/hermes' },
  { id: 'dict', label: '字典配置', icon: 'dict', color: '#FF8A3D', path: '/system/dict/dict-type' },
  { id: 'log', label: '查看日志', icon: 'log', color: '#25F4EE', path: '/system/log' },
  { id: 'monitor', label: '系统监控', icon: 'monitor', color: '#8B5CF6', path: '/system/dashboard/monitor' },
  { id: 'spider', label: '爬虫管理', icon: 'spider', color: '#F59E0B', path: '/system/spider-dashboard' },
  { id: 'analysis', label: '数据分析', icon: 'chart', color: '#5DDB96', path: '/system/dashboard/analysis' },
];

export const WORKPLACE_TODOS = range(8).map((i) => ({
  id: 100 + i,
  title: [
    '审核新提交的内容作品',
    '处理用户举报申诉',
    '更新系统字典配置',
    '检查爬虫任务运行状态',
    '审核创作者入驻申请',
    '发布平台公告通知',
    '配置微信公众号菜单',
    '巡检数字人管线服务',
  ][i],
  description: [
    '有 12 条新内容待审核',
    '3 个用户提交了申诉请求',
    '产品类型字典需要新增条目',
    '2 个爬虫任务出现异常',
    '5 位新创作者等待审核',
    '新版本上线公告待发布',
    '菜单结构需要调整',
    '检查 avatar-pipeline 健康状态',
  ][i],
  priority: pick(['high', 'medium', 'low', 'medium', 'high', 'medium', 'low', 'high'], i) as 'high' | 'medium' | 'low',
  status: i < 5 ? 'pending' : i < 7 ? 'in_progress' : 'done',
  assignee: USER_NICKNAMES[i % USER_NICKNAMES.length],
  dueDate: dateOffset(-(i - 3), 18),
  createTime: dateOffset(i + 1, 9),
}));

export const WORKPLACE_PROJECTS = range(5).map((i) => ({
  id: 200 + i,
  name: [
    '青丘阅 App 2.0 版本',
    'AI 智能推荐引擎',
    '数字人直播间',
    '创作者激励计划',
    '内容安全审核系统',
  ][i],
  description: [
    '全新 UI 设计与性能优化',
    '基于 Hermes 的多模态推荐',
    '实时数字人直播推流',
    '创作者流量扶持与变现',
    'AI + 人工双重审核流程',
  ][i],
  progress: [75, 60, 45, 90, 30][i],
  status: i < 2 ? 'active' : i < 4 ? 'active' : 'planning',
  members: range(3 + (i % 3)).map((j) => ({
    name: USER_NICKNAMES[(i * 3 + j) % USER_NICKNAMES.length],
    avatar: avatar(i * 10 + j + 200),
  })),
  deadline: dateOffset(-(i - 14), 18),
  updateTime: dateOffset(i, 9),
}));

export const WORKPLACE_TEAM = range(8).map((i) => ({
  id: 300 + i,
  name: USER_NICKNAMES[i],
  avatar: avatar(i + 300),
  role: ['前端开发', '后端开发', '产品经理', 'UI 设计师', '测试工程师', '运营专员', '数据分析', '架构师'][i],
  status: i < 6 ? 'online' : 'offline',
  lastActive: i < 6 ? `${Math.floor(Math.random() * 59)} 分钟前` : `${1 + Math.floor(Math.random() * 24)} 小时前`,
}));

// ─── 数字人资产管理 ───
export const DH_ASSETS = range(8).map((i) => ({
  id: 1000 + i,
  name: ['小秋', '墨染', '云汐', '星河', '月白', '清瑶', '风吟', '沐晨'][i],
  style: pick(['二次元', '二次元', '写实', '二次元', '写实', '二次元', '写实', '二次元'], i),
  status: i < 5 ? 'online' : i < 7 ? 'training' : 'draft',
  statusLabel: { online: '在线', training: '训练中', draft: '草稿' }[i < 5 ? 'online' : i < 7 ? 'training' : 'draft'],
  thumbnail: cover(120, 120, i + 600),
  modelFile: `public/avatars/${['xiaoqiu', 'moran', 'yunxi', 'xinghe', 'yuebai', 'qingyao', 'fengyin', 'muchen'][i]}.glb`,
  blendShapeCount: 12 + i * 2,
  animationCount: 5 + i,
  outfitCount: 2 + (i % 3),
  sceneCount: 1 + (i % 2),
  createdAt: dateOffset(i * 5 + 10, 10),
  updatedAt: dateOffset(i * 3, 12),
  pipelineStage: i < 5 ? 'deployed' : i < 7 ? 'training' : 'mesh',
  quality: [95, 88, 92, 78, 85, 70, 65, 60][i],
  size: [45, 62, 38, 55, 48, 35, 28, 22][i],
  conversations: [1250, 890, 2340, 450, 3200, 120, 45, 10][i],
}));

export const DH_RECENT_JOBS = range(6).map((i) => ({
  id: 5000 + i,
  name: ['真人重建-张三', '二次元生成-墨染', 'Mixamo 动作导入', 'BlendShape 雕刻', '换装系统构建', '场景集成-办公室'][i],
  type: pick(['rebuild', 'generate', 'import', 'sculpt', 'outfit', 'scene'], i),
  status: i < 2 ? 'running' : i < 4 ? 'completed' : i < 5 ? 'failed' : 'queued',
  progress: i < 2 ? 45 + i * 20 : i < 4 ? 100 : i < 5 ? 72 : 0,
  createdAt: dateOffset(i, 8),
  finishedAt: i < 4 ? dateOffset(i - 1, 10) : undefined,
  log: i < 5 ? '执行中...' : '等待队列',
}));

export const DM_MESSAGES: Record<number, Array<{
  id: number;
  sessionId: number;
  fromUserId: number;
  type: 'text' | 'image' | 'system' | 'recall' | 'time';
  content: string;
  time: string;
  status?: 'sent' | 'delivered' | 'read';
}>> = {
  1: [
    { id: 11, sessionId: 1, fromUserId: 0, type: 'time', content: '04/07', time: '2025-04-07T10:00:00Z' },
    { id: 12, sessionId: 1, fromUserId: 0, type: 'system', content: '对方回复或关注你之前,只能发送一条文字消息。请礼貌发言,自觉遵守《抖音自律公约》', time: '2025-04-07T10:01:00Z' },
  ],
  2: [
    { id: 21, sessionId: 2, fromUserId: 0, type: 'time', content: '2025/09/01', time: '2025-09-01T10:00:00Z' },
    { id: 22, sessionId: 2, fromUserId: 7002, type: 'text', content: '你好,请问视频里那家店还在营业吗?', time: '2025-09-01T10:01:00Z' },
    { id: 23, sessionId: 2, fromUserId: 2000, type: 'text', content: '在的,昨天还去过', time: '2025-09-01T10:02:00Z' },
    { id: 24, sessionId: 2, fromUserId: 2000, type: 'recall', content: '你撤回了一条消息', time: '2025-09-01T10:03:00Z' },
  ],
  3: [
    { id: 31, sessionId: 3, fromUserId: 0, type: 'time', content: '昨天 10:24', time: '2026-06-03T10:24:00Z' },
    { id: 32, sessionId: 3, fromUserId: 7003, type: 'text', content: '【创作者激励】你的作品《记录日常》已加入流量扶持计划,有效期 7 天。', time: '2026-06-03T10:25:00Z' },
    { id: 33, sessionId: 3, fromUserId: 7003, type: 'text', content: '点击查看详情 >', time: '2026-06-03T10:26:00Z' },
  ],
  4: [
    { id: 41, sessionId: 4, fromUserId: 0, type: 'time', content: '昨天 18:30', time: '2026-06-03T18:30:00Z' },
    { id: 42, sessionId: 4, fromUserId: 7004, type: 'text', content: '周末有空吗?想约你一起拍视频', time: '2026-06-03T18:31:00Z' },
    { id: 43, sessionId: 4, fromUserId: 2000, type: 'text', content: '周六下午可以', time: '2026-06-03T18:32:00Z' },
    { id: 44, sessionId: 4, fromUserId: 7004, type: 'text', content: '好的,周末见~', time: '2026-06-03T18:33:00Z' },
  ],
  5: [
    { id: 51, sessionId: 5, fromUserId: 0, type: 'time', content: '2 天前', time: '2026-06-02T20:00:00Z' },
    { id: 52, sessionId: 5, fromUserId: 7005, type: 'text', content: '你昨天发的那个海边的视频太好看了', time: '2026-06-02T20:01:00Z' },
    { id: 53, sessionId: 5, fromUserId: 7005, type: 'text', content: '那个海边位置发我一下?', time: '2026-06-02T20:02:00Z' },
    { id: 54, sessionId: 5, fromUserId: 2000, type: 'text', content: '好的,我整理一下路线发给你', time: '2026-06-02T20:03:00Z' },
  ],
  6: [
    { id: 61, sessionId: 6, fromUserId: 0, type: 'time', content: '3 天前', time: '2026-06-01T20:00:00Z' },
    { id: 62, sessionId: 6, fromUserId: 2000, type: 'text', content: '你之前问的剪辑软件是《剪映专业版》', time: '2026-06-01T20:01:00Z' },
    { id: 63, sessionId: 6, fromUserId: 7006, type: 'text', content: '谢谢推荐,很实用', time: '2026-06-01T20:02:00Z' },
  ],
  7: [
    { id: 71, sessionId: 7, fromUserId: 0, type: 'time', content: '4 天前', time: '2026-05-31T20:00:00Z' },
    { id: 72, sessionId: 7, fromUserId: 7007, type: 'image', content: 'https://picsum.photos/seed/dm-img-1/240/180', time: '2026-05-31T20:01:00Z' },
  ],
  8: [
    { id: 81, sessionId: 8, fromUserId: 0, type: 'time', content: '1 周前', time: '2026-05-28T20:00:00Z' },
    { id: 82, sessionId: 8, fromUserId: 7008, type: 'text', content: '周末有安排吗?', time: '2026-05-28T20:01:00Z' },
    { id: 83, sessionId: 8, fromUserId: 2000, type: 'text', content: '没有,有什么计划?', time: '2026-05-28T20:02:00Z' },
    { id: 84, sessionId: 8, fromUserId: 7008, type: 'text', content: '好的,明天一起拍', time: '2026-05-28T20:03:00Z' },
  ],
  9: [
    { id: 91, sessionId: 9, fromUserId: 0, type: 'time', content: '1 周前', time: '2026-05-28T19:00:00Z' },
    { id: 92, sessionId: 9, fromUserId: 7009, type: 'text', content: '你之前推荐的书很棒', time: '2026-05-28T19:01:00Z' },
    { id: 93, sessionId: 9, fromUserId: 7009, type: 'text', content: '新书已收到,非常感谢', time: '2026-05-28T19:02:00Z' },
  ],
  10: [
    { id: 101, sessionId: 10, fromUserId: 0, type: 'time', content: '2 周前', time: '2026-05-21T20:00:00Z' },
    { id: 102, sessionId: 10, fromUserId: 7010, type: 'text', content: '想约你这周末去爬武功山', time: '2026-05-21T20:01:00Z' },
    { id: 103, sessionId: 10, fromUserId: 2000, type: 'text', content: '最近膝盖不太舒服,下次吧', time: '2026-05-21T20:02:00Z' },
    { id: 104, sessionId: 10, fromUserId: 7010, type: 'text', content: '改天一起去爬武功山', time: '2026-05-21T20:03:00Z' },
  ],
};
