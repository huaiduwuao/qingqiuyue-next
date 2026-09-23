import { beforeEach, describe, expect, it } from 'vitest';
import { consumeOauthState, createOauthState, matchesOauthState } from './oauthState';

describe('oauth state', () => {
  beforeEach(() => sessionStorage.clear());

  it('rejects callbacks this browser did not start', () => {
    expect(consumeOauthState('anything')).toBe(false);
    expect(consumeOauthState(null)).toBe(false);
  });

  it('accepts the matching state once', () => {
    const s = createOauthState();
    expect(s).toMatch(/^[0-9a-f]{32}$/);
    expect(matchesOauthState('other')).toBe(false);
    expect(matchesOauthState(s)).toBe(true);
    expect(consumeOauthState(s)).toBe(true);
    expect(consumeOauthState(s)).toBe(false);
  });

  it('accepts a legacy callback without state only when a login is pending', () => {
    createOauthState();
    expect(consumeOauthState(null)).toBe(true);
    // 新后端带 code 时 state 必填:空串不算
    createOauthState();
    expect(consumeOauthState('')).toBe(false);
  });
});
