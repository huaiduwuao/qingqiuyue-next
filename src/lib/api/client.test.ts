import { describe, expect, it } from 'vitest';
import { ApiError, contentClient, formatApiError, isCanceledError, isEnvelope, isNetworkError } from './client';

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

describe('请求取消', () => {
  const neverAdapter = () => new Promise<never>(() => {});

  it('AbortController 取消归为 canceled,不是「网络连接失败」', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const err = await contentClient.get('/x', { signal: ctrl.signal, adapter: neverAdapter }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.category).toBe('canceled');
    expect(err.name).toBe('AbortError');
    expect(isCanceledError(err)).toBe(true);
    expect(isNetworkError(err)).toBe(false);
    expect(formatApiError(err)).not.toContain('网络');
  });

  it('AbortSignal.timeout 触发的取消按超时算', async () => {
    const signal = AbortSignal.abort(new DOMException('timed out', 'TimeoutError'));
    const err = await contentClient.get('/x', { signal, adapter: neverAdapter }).catch((e) => e);
    expect(err.category).toBe('timeout');
    expect(isCanceledError(err)).toBe(false);
  });

  it('识别 fetch 的 AbortError', () => {
    expect(isCanceledError(new DOMException('aborted', 'AbortError'))).toBe(true);
    expect(isCanceledError(new Error('boom'))).toBe(false);
    expect(isCanceledError(new ApiError({ message: 'x', category: 'network' }))).toBe(false);
  });
});
