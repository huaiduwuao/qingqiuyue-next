import { contentClient } from '@/lib/api/client';

/**
 * 付费内容状态,随内容详情接口下发(免费内容为 null)。
 * 未解锁时服务端只返回试看部分:正文预览 + 前 freeItems 个章节/分集,不含播放地址。
 */
export interface Paywall {
  paidContentId: number;
  /** 价格(钻石)。钱包按钻石记账,1 钻 = ¥0.1 */
  price: number;
  /** 免费试看/试读的章节(分集)数 */
  freeItems: number;
  unlocked: boolean;
}

export function isLocked(paywall: Paywall | null | undefined): paywall is Paywall {
  return !!paywall && !paywall.unlocked;
}

/** 用钱包余额购买付费内容。已购买/自己的内容也返回成功。contentId 用字符串传,避免雪花 id 精度丢失。 */
export async function unlockContent(contentId: string | number) {
  return contentClient<{ unlocked: boolean; paywall: Paywall | null }>('/module/content/payUnlock', {
    method: 'POST',
    data: { contentId: String(contentId) },
  });
}

/** 金额(分)→ 展示用元,去掉无意义的小数。注意:钱包/付费内容已按钻石计,钻石用 @/apis/wallet 的 diamondsToYuan。 */
export function formatYuan(cents: number): string {
  const yuan = cents / 100;
  return Number.isInteger(yuan) ? String(yuan) : yuan.toFixed(2);
}
