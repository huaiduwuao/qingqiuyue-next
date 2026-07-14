/**
 * 开发日志工具 - 生产环境自动禁用
 * 使用方式: import { devLog } from '@/lib/dev-log';
 * devLog.log('debug message')
 * devLog.warn('warning')
 * devLog.error('error')
 */
const isDev = process.env.NODE_ENV !== 'production';

export const devLog = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug('[dev]', ...args);
  },
  log: (...args: unknown[]) => {
    if (isDev) console.log('[dev]', ...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn('[dev]', ...args);
  },
  error: (...args: unknown[]) => {
    if (isDev) console.error('[dev]', ...args);
  },
};
