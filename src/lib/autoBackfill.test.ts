import { describe, expect, it } from 'vitest';
import {
  BACKFILL_DETAIL_MAX_POLLS,
  BACKFILL_DETAIL_POLL_MS,
  backfillNotice,
  backfillPending,
  backfillRefetchInterval,
} from './autoBackfill';

describe('backfillPending', () => {
  it('只在排队 / 运行中为真', () => {
    expect(backfillPending({ availability: { backfill: { status: 'queued' } } })).toBe(true);
    expect(backfillPending({ availability: { backfill: { status: 'running' } } })).toBe(true);
    expect(backfillPending({ availability: { backfill: { status: 'done' } } })).toBe(false);
    expect(backfillPending({ availability: { backfill: { status: 'failed' } } })).toBe(false);
    expect(backfillPending({ availability: {} })).toBe(false);
    expect(backfillPending(undefined)).toBe(false);
    expect(backfillPending(null)).toBe(false);
  });
});

describe('backfillRefetchInterval', () => {
  const q = (data: unknown, dataUpdateCount: number) => ({ state: { data, dataUpdateCount } });
  it('补全中按固定间隔轮询,超过上限停', () => {
    const pending = { availability: { backfill: { status: 'running' } } };
    expect(backfillRefetchInterval(q(pending, 1))).toBe(BACKFILL_DETAIL_POLL_MS);
    expect(backfillRefetchInterval(q(pending, BACKFILL_DETAIL_MAX_POLLS))).toBe(BACKFILL_DETAIL_POLL_MS);
    expect(backfillRefetchInterval(q(pending, BACKFILL_DETAIL_MAX_POLLS + 1))).toBe(false);
  });
  it('没在补全就不轮询', () => {
    expect(backfillRefetchInterval(q({ availability: { backfill: { status: 'done' } } }, 1))).toBe(false);
    expect(backfillRefetchInterval(q(undefined, 1))).toBe(false);
  });
});

describe('backfillNotice', () => {
  it('补全中 / 失败 / 其它各有说法', () => {
    expect(backfillNotice({ backfill: { status: 'queued' } }, 'x')).toContain('已排队');
    expect(backfillNotice({ backfill: { status: 'running' } }, 'x')).toContain('正在从源站补全正文');
    expect(backfillNotice({ backfill: { status: 'running' } }, 'x', '话数与图片')).toContain('话数与图片');
    const failed = backfillNotice({ notice: '本站未收录正文,可前往原站阅读', backfill: { status: 'failed' } }, 'x');
    expect(failed).toContain('暂时没有找到');
    expect(failed).toContain('可前往原站阅读');
    expect(backfillNotice({ notice: '后端说法' }, '兜底')).toBe('后端说法');
    expect(backfillNotice({ backfill: { status: 'done' } }, '兜底')).toBe('兜底');
    expect(backfillNotice(undefined, '兜底')).toBe('兜底');
  });
});
