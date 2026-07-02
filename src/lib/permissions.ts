/**
 * 统一权限码 — 按钮 / 菜单级
 *
 * 命名规范:`{module}:{resource}:{action}`
 *  - module: system / account / content / reward
 *  - resource: role / menu / permission / data-permission / user / ...
 *  - action: list / view / create / update / delete / export
 *
 * 配套 mock 数据在 `mocks/db/user.ts:CURRENT_USER.permissions`,
 * 后端 `/api/admin/user/current` 返 authorities + permissions。
 *
 * 注:行级数据权限不由这里管,后端 GORM 插件根据角色绑定的
 *     DataPermission 配置自动注入 WHERE,前端不参与也不展示。
 */
export const PERMISSIONS = {
  SYSTEM_ROLE: {
    VIEW: 'system:role:list',
    CREATE: 'system:role:create',
    UPDATE: 'system:role:update',
    DELETE: 'system:role:delete',
  },
  SYSTEM_MENU: {
    VIEW: 'system:menu:list',
    CREATE: 'system:menu:create',
    UPDATE: 'system:menu:update',
    DELETE: 'system:menu:delete',
  },
  SYSTEM_PERMISSION: {
    VIEW: 'system:permission:list',
    CREATE: 'system:permission:create',
    UPDATE: 'system:permission:update',
    DELETE: 'system:permission:delete',
  },
  SYSTEM_DATA_PERMISSION: {
    VIEW: 'system:data-permission:list',
    CREATE: 'system:data-permission:create',
    UPDATE: 'system:data-permission:update',
    DELETE: 'system:data-permission:delete',
  },
  SYSTEM_USER: {
    VIEW: 'system:user:list',
    CREATE: 'system:user:create',
    UPDATE: 'system:user:update',
    DELETE: 'system:user:delete',
  },
  SYSTEM_USER_LEVEL: {
    VIEW: 'system:user-level:list',
    CREATE: 'system:user-level:create',
    UPDATE: 'system:user-level:update',
    DELETE: 'system:user-level:delete',
  },
  SYSTEM_USER_POINT: {
    VIEW: 'system:user-point:list',
    CREATE: 'system:user-point:create',
    UPDATE: 'system:user-point:update',
    DELETE: 'system:user-point:delete',
  },
  SYSTEM_BOT: {
    VIEW: 'system:bot:list',
    CREATE: 'system:bot:create',
    UPDATE: 'system:bot:update',
    DELETE: 'system:bot:delete',
  },
  SYSTEM_HERMES: {
    VIEW: 'system:hermes:list',
    CREATE: 'system:hermes:create',
    UPDATE: 'system:hermes:update',
    DELETE: 'system:hermes:delete',
  },
  SYSTEM_HERMES_INSTANCE: {
    VIEW: 'system:hermes:instance:list',
    CREATE: 'system:hermes:instance:create',
    UPDATE: 'system:hermes:instance:update',
    DELETE: 'system:hermes:instance:delete',
  },
  SYSTEM_APP: {
    VIEW: 'system:app:list',
    CREATE: 'system:app:create',
    UPDATE: 'system:app:update',
    DELETE: 'system:app:delete',
  },
  SYSTEM_APP_CONFIG: {
    VIEW: 'system:app-config:list',
    CREATE: 'system:app-config:create',
    UPDATE: 'system:app-config:update',
    DELETE: 'system:app-config:delete',
  },
  SYSTEM_APP_SERVICE: {
    VIEW: 'system:app-service:list',
    CREATE: 'system:app-service:create',
    UPDATE: 'system:app-service:update',
    DELETE: 'system:app-service:delete',
  },
  SYSTEM_RESOURCE: {
    VIEW: 'system:resource:list',
    CREATE: 'system:resource:create',
    UPDATE: 'system:resource:update',
    DELETE: 'system:resource:delete',
  },
  SYSTEM_DICT: {
    VIEW: 'system:dict:list',
    CREATE: 'system:dict:create',
    UPDATE: 'system:dict:update',
    DELETE: 'system:dict:delete',
  },
  SYSTEM_WEBSITE_DICT: {
    VIEW: 'system:website-dict:list',
    CREATE: 'system:website-dict:create',
    UPDATE: 'system:website-dict:update',
    DELETE: 'system:website-dict:delete',
  },
  SYSTEM_ADDRESS: {
    VIEW: 'system:address:list',
    CREATE: 'system:address:create',
    UPDATE: 'system:address:update',
    DELETE: 'system:address:delete',
  },
  SYSTEM_WX_CONFIG: {
    VIEW: 'system:wx-config:list',
    CREATE: 'system:wx-config:create',
    UPDATE: 'system:wx-config:update',
    DELETE: 'system:wx-config:delete',
  },
  SYSTEM_MODERATION: {
    REPORT_LIST: 'system:moderation:report:list',
    REPORT_REVIEW: 'system:moderation:report:review',
    SENSITIVE_WORD_LIST: 'system:moderation:sensitive-word:list',
    SENSITIVE_WORD_CREATE: 'system:moderation:sensitive-word:create',
    SENSITIVE_WORD_DELETE: 'system:moderation:sensitive-word:delete',
  },
  SYSTEM_WAKE_WORD: {
    VIEW: 'system:wake-word:view',
    TRAIN: 'system:wake-word:train',
    RESET: 'system:wake-word:reset',
  },
} as const;

export type PermissionCode = string;
