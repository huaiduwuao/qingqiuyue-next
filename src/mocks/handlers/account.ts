/**
 * Account MSW handlers
 */

import { http, passthrough } from 'msw';

export const accountHandlers = [
  // Creator center - all passthrough
  http.get('*/api/core/account/works', () => passthrough()),
  http.get('*/api/core/account/monetize/summary', () => passthrough()),
  http.get('*/api/core/account/interaction/comments', () => passthrough()),
  http.get('*/api/core/activity/list', () => passthrough()),

  // Recharge - passthrough to real backend
  http.get('*/api/core/recharge/packages', () => passthrough()),
  http.get('*/api/core/recharge/benefits', () => passthrough()),
  http.get('*/api/core/recharge/activity', () => passthrough()),

  // Wallpaper - passthrough to real backend
  http.get('*/api/core/wallpaper/list', () => passthrough()),
  http.post('*/api/core/wallpaper/download', () => passthrough()),

  // Wallet - passthrough to real backend
  http.get('*/api/core/wallet', () => passthrough()),
  http.get('*/api/core/wallet/transactions', () => passthrough()),
  http.post('*/api/core/wallet/recharge', () => passthrough()),
  http.post('*/api/core/wallet/recharge/callback', () => passthrough()),
];
