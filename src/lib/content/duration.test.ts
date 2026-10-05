import { describe, expect, it } from 'vitest';
import { listItemDurationSec } from './duration';

describe('listItemDurationSec', () => {
  it('优先用接口直接给的时长', () => {
    expect(listItemDurationSec({ durationSec: 95, metadata: '{"duration":10}' })).toBe(95);
    expect(listItemDurationSec({ duration: 61 })).toBe(61);
  });

  it('读 metadata.duration(字符串或对象)', () => {
    expect(listItemDurationSec({ metadata: '{"duration":207,"album":"x"}' })).toBe(207);
    expect(listItemDurationSec({ metadata: { duration: '184' } })).toBe(184);
  });

  it('metadata 坏了或没有时长时是 0', () => {
    expect(listItemDurationSec({ metadata: '{bad json' })).toBe(0);
    expect(listItemDurationSec({ metadata: '{"duration":0}' })).toBe(0);
    expect(listItemDurationSec({ metadata: 'null' })).toBe(0);
    expect(listItemDurationSec({})).toBe(0);
  });

  it('不再从正文里抓钟点当时长', () => {
    const item = { content: '2026/9/10 20:38:27 来源:IT之家', metadata: '{}' } as Record<string, unknown>;
    expect(listItemDurationSec(item)).toBe(0);
  });
});
