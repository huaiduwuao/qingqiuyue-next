/**
 * MSW handlers 总出口。
 */

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

export const handlers = [
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
];
