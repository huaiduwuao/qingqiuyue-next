/**
 * 管理后台菜单分组映射
 *
 * 数据库 menu.group 存的是英文 key;前端侧栏需要显示中文 label + 按特定顺序排。
 *
 * 修改这两份常量即可调整侧栏分组标题与顺序,不需要改数据库 seed。
 */

export const MENU_GROUP_LABELS: Record<string, string> = {
  dashboard: '数据看板',
  auth: '认证授权',
  user: '用户管理',
  moderation: '内容治理',
  content: '内容管理',
  resource: '资源管理',
  basic: '基础数据',
  wechat: '微信公众号',
  finance: '财务中心',
  stats: '访问统计',
  digitalHuman: '数字员工',
  capability: '能力',
  execution: '执行',
  observability: '观测与治理',
  ops: '运维监控',
  spider: '爬虫运营',
  default: '其他',
};

/**
 * 侧栏分组从上到下的显示顺序。
 *
 * 这里写死而不依赖数据库返回顺序,理由:
 *   - 不同 DB/索引/迁移顺序可能让 menu.sort 不稳定
 *   - 改顺序是产品决策,不应该让运营改 menu 表就能改侧栏结构
 *
 * 缺失的 group key 不会出现在侧栏(MENU_ICON_MAP 类的过滤在 layout.tsx 里做)。
 */
export const MENU_GROUP_ORDER = [
  'dashboard',
  'auth',
  'user',
  'moderation',
  'content',
  'resource',
  'basic',
  'wechat',
  'finance',
  'stats',
  'digitalHuman',
  'capability',
  'execution',
  'observability',
  'ops',
  'spider',
];
