import { describe, expect, it } from 'vitest';
import { sameId, toEntityId } from './id';

describe('toEntityId', () => {
  it('keeps an unsafe BIGINT string exactly', () => {
    expect(toEntityId('1789304372516386790')).toBe('1789304372516386790');
  });

  it('returns safe integers as numbers', () => {
    expect(toEntityId('42')).toBe(42);
    expect(toEntityId(42)).toBe(42);
    expect(toEntityId('7327313609342976')).toBe(7327313609342976);
  });

  it('rejects a number that has already lost precision', () => {
    expect(toEntityId(1789304372516386790)).toBeNull();
  });

  it('rejects empty, zero, negative and malformed ids', () => {
    for (const bad of [null, undefined, '', '0', 0, -1, '-5', '1.5', 'abc', ' ', {}]) {
      expect(toEntityId(bad)).toBeNull();
    }
  });
});

describe('sameId', () => {
  it('compares string and number forms by their decimal literal', () => {
    expect(sameId('42', 42)).toBe(true);
    expect(sameId('1789304372516386790', '1789304372516386790')).toBe(true);
    expect(sameId('1789304372516386790', '1789304372516386791')).toBe(false);
    expect(sameId(null, null)).toBe(false);
  });
});
