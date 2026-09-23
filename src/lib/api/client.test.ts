import { describe, expect, it } from 'vitest';
import { isEnvelope } from './client';

describe('isEnvelope', () => {
  it('recognizes the standard { code, msg, data } wrapper', () => {
    expect(isEnvelope({ code: 200, msg: 'OK', data: { id: 1 } })).toBe(true);
    expect(isEnvelope({ code: 500, msg: '失败' })).toBe(true);
    expect(isEnvelope({ code: 0, data: [] })).toBe(true);
  });

  it('does not treat flat entities that happen to have a code field as envelopes', () => {
    // spider-api 模板 / 属性直接平铺返回,code 是业务编码
    expect(isEnvelope({ id: 3, code: 'douban_movie', name: '豆瓣电影' })).toBe(false);
    expect(isEnvelope({ items: [], total: 0 })).toBe(false);
    expect(isEnvelope([{ code: 1, msg: 'x' }])).toBe(false);
    expect(isEnvelope(null)).toBe(false);
  });
});
