import { describe, expect, it } from 'vitest';
import { errMessage, errName } from './errMessage';

describe('errMessage', () => {
  it('Error 实例取 message', () => {
    expect(errMessage(new Error('boom'))).toBe('boom');
  });
  it('普通对象上的字符串 message 也取', () => {
    expect(errMessage({ message: 'x' })).toBe('x');
  });
  it('没有字符串 message 时返回 undefined(与 e?.message 一致)', () => {
    expect(errMessage(undefined)).toBeUndefined();
    expect(errMessage(null)).toBeUndefined();
    expect(errMessage('str')).toBeUndefined();
    expect(errMessage({})).toBeUndefined();
    expect(errMessage({ message: 1 })).toBeUndefined();
  });
  it('空字符串 message 原样返回(|| 回退照旧生效)', () => {
    expect(errMessage(new Error(''))).toBe('');
  });
});

describe('errName', () => {
  it('取 name', () => {
    expect(errName(new DOMException('a', 'AbortError'))).toBe('AbortError');
    expect(errName({ name: 'X' })).toBe('X');
    expect(errName(1)).toBeUndefined();
  });
});
