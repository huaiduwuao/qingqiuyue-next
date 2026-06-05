/**
 * MSW browser worker。
 * 仅当 mockEnabled 时被动态 import。
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
