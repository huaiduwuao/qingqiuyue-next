import type { WalletIncome } from '@/apis/wallet';

/** 作品带来的收入来源(钱包 /wallet/income 的 key):付费、打赏、订阅、礼物 */
export const WORKS_INCOME_KEYS = ['works', 'tip', 'subscription', 'gift'];

/** 作品收益(钻):从钱包的按来源汇总里挑出作品相关的几项 */
export function worksIncome(income?: WalletIncome) {
  const rows = (income?.sources ?? []).filter((r) => WORKS_INCOME_KEYS.includes(r.key));
  return {
    month: rows.reduce((n, r) => n + r.month, 0),
    total: rows.reduce((n, r) => n + r.total, 0),
  };
}
