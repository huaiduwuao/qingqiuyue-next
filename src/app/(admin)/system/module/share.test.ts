import { describe, expect, it } from 'vitest';
import { modulePrice } from './share';

describe('modulePrice:与后端 moduleshare.ParsePrice 同一套规则', () => {
  it.each([
    ['', 0],
    ['{"price":99}', 99],
    ['{"price":"30"}', 30],
    ['{"diamonds":12}', 12],
    ['{"pay":9.9}', 99],
    ['{"pay":0.15}', 2],
    ['50', 50],
    ['12.5', 13],
    ['0', 0],
    ['-3', 0],
    ['{"price":10001}', 0],
    ['abc', 0],
    ['{"price":', 0],
  ])('%s → %d', (input, want) => {
    expect(modulePrice(input)).toBe(want);
  });

  it('非字符串按未定价', () => {
    expect(modulePrice(undefined)).toBe(0);
    expect(modulePrice(42)).toBe(0);
  });
});
