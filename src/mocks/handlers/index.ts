/**
 * MSW handlers 总出口。
 */

import { http, passthrough } from 'msw';

import { adminHandlers } from './admin';
import { systemHandlers } from './system';
import { contentHandlers } from './content';
import { rewardHandlers } from './reward';
import { rewardTaskHandlers } from './reward-task';
import { spiderHandlers } from './spider';
import { homeHandlers } from './home';
import { accountHandlers } from './account';
import { moduleContentHandlers } from './module-content';
import { wxHandlers } from './wx';
import { avatarHandlers } from './avatar';

// 兜底:任何没被具体 handler 命中的请求(Next.js 页面导航 RSC、_next 资源、HMR、avatar mp4 等)
// 都显式 passthrough,不再走 onUnhandledRequest='bypass' 的内部 fetch 路径,
// 避免页面导航时 underlying fetch 被 abort 抛 "Failed to fetch"。
const passthroughFallback = http.all('*', () => passthrough());

export const handlers = [
  ...avatarHandlers,
  ...adminHandlers,
  ...systemHandlers,
  ...contentHandlers,
  ...rewardHandlers,
  ...rewardTaskHandlers,
  ...spiderHandlers,
  ...homeHandlers,
  ...accountHandlers,
  ...moduleContentHandlers,
  ...wxHandlers,
  passthroughFallback,
];
