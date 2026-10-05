import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime, isMyGroup, isMyItem, privacyActionOf, quickLinkBadge, type MyItem } from './myHomeModel';

const item = (visibility?: MyItem['visibility']) => ({ id: 1, visibility }) as MyItem;

describe('myHomeModel', () => {
  afterEach(() => vi.useRealTimers());

  it('formatRelativeTime 按时间差给相对时间,取不到时间给占位', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:00:00+08:00'));
    const now = Date.now();
    expect(formatRelativeTime(undefined)).toBe('未知时间');
    expect(formatRelativeTime(0)).toBe('未知时间');
    expect(formatRelativeTime(now + 60_000)).toBe('刚刚');
    expect(formatRelativeTime(now - 30_000)).toBe('刚刚');
    expect(formatRelativeTime(now - 5 * 60_000)).toBe('5 分钟前');
    expect(formatRelativeTime(now - 3 * 3600_000)).toBe('3 小时前');
    expect(formatRelativeTime(now - 2 * 86400_000)).toBe('2 天前');
    expect(formatRelativeTime(now - 40 * 86400_000)).toBe(new Date(now - 40 * 86400_000).toLocaleDateString('zh-CN'));
  });

  it('privacyActionOf 只管公开 ⇄ 私密两种状态', () => {
    expect(privacyActionOf(item('public'))).toBe('hide');
    expect(privacyActionOf(item('private'))).toBe('show');
    expect(privacyActionOf(item('reviewing'))).toBeNull();
    expect(privacyActionOf(item('rejected'))).toBeNull();
    expect(privacyActionOf(item(undefined))).toBeNull();
  });

  it('isMyItem / isMyGroup 区分内容卡片和合集卡片', () => {
    const content = { id: 1, contentType: 'VIDEO', cover: 'c' };
    const group = { id: 2, count: 3, updatedAt: 1 };
    expect(isMyItem(content)).toBe(true);
    expect(isMyGroup(content)).toBe(false);
    expect(isMyItem(group)).toBe(false);
    expect(isMyGroup(group)).toBe(true);
    expect(isMyGroup({ ...group, contentType: 'VIDEO' })).toBe(false);
    expect(isMyItem(null)).toBeFalsy();
  });

  it('quickLinkBadge 从各接口数据取徽标,没有数据不显示', () => {
    expect(quickLinkBadge('wallet', { wallet: { balance: 1200 } })).toEqual({ badge: `💎 ${(1200).toLocaleString()}`, badgeColor: 'default' });
    expect(quickLinkBadge('wallet', {})).toEqual({ badge: null, badgeColor: 'default' });
    expect(quickLinkBadge('points', { point: { points: 5 } }).badge).toBe('5');
    expect(quickLinkBadge('order', { order: { total: 7, records: [1] } }).badge).toBe('7');
    expect(quickLinkBadge('order', { order: { records: [1] } }).badge).toBe('1');
    expect(quickLinkBadge('order', { order: {} }).badge).toBeNull();
    expect(quickLinkBadge('vip', { vip: { tiers: [{ active: false }, { active: true }] } })).toEqual({ badge: 'VIP', badgeColor: 'warning' });
    expect(quickLinkBadge('vip', { vip: { tiers: [] } }).badge).toBeNull();
    expect(quickLinkBadge('mall', { wallet: { balance: 9 } }).badge).toBeNull();
  });
});
