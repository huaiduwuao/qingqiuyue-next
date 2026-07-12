// 活动页工具函数:无状态、可纯函数,集中在这里便于单元测试和复用。
// (getPrimaryAction 含 JSX,已拆到 ./actionBuilders.tsx)

import type { Activity } from './data';

/**
 * getCountdownLabel — 纯函数,Date.now() 在每次 render 取最新值。
 * 不做实时 setInterval:卡片/Drawer 上"还剩 X 天"对用户来说秒级精度无意义,
 * 真要 1s 刷新反而每张卡都触发全局 setState,得不偿失。给下次 re-render 算。
 */
export function getCountdownLabel(a: Activity): { text: string; color: string } {
  const now = Date.now();
  if (a.status === 'ended') return { text: '已结束', color: '#9CA3AF' };
  if (a.status === 'judging') return { text: '评审中', color: '#FFB400' };
  if (a.status === 'upcoming') {
    const diff = a.startAt - now;
    const d = Math.floor(diff / 86400000);
    return { text: `${d} 天后开放`, color: '#8B5CF6' };
  }
  const diff = a.endAt - now;
  if (diff <= 0) return { text: '截止', color: '#FE2C55' };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 7) return { text: `还剩 ${d} 天`, color: '#9CA3AF' };
  if (d > 0) return { text: `仅剩 ${d} 天`, color: '#FFB400' };
  return { text: `仅剩 ${h} 小时`, color: '#FE2C55' };
}

/**
 * parseRewardCny — 解析"¥10,000 / 5w"等奖励文案为数字。
 * 已知支持:
 *  - "¥X,XXX" / "¥X,XXX,XXX"  (带千分位逗号)
 *  - "Xw"                       (小写 w,= X * 10000)
 * 不支持(暂不写,等后端统一):"¥10000"(无逗号) / "5W" / "5万"。
 * 解析失败返回 0,调用方要决定是否提示。
 */
export function parseRewardCny(reward: string | undefined): number {
  if (!reward) return 0;
  const cnyMatch = reward.match(/¥\s*([\d,]+)/);
  if (cnyMatch) return Number(cnyMatch[1].replace(/,/g, ''));
  const wMatch = reward.match(/(\d+)w/);
  if (wMatch) return Number(wMatch[1]) * 10000;
  return 0;
}