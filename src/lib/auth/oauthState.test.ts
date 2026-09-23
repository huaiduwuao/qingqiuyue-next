import { beforeEach, describe, expect, it } from 'vitest';
import { consumeOauthState, createOauthState, hasPendingOauthState } from './oauthState';

describe('oauth state', () => {
  beforeEach(() => sessionStorage.clear());

  it('has nothing to hand over when this browser did not start the login', () => {
    expect(hasPendingOauthState()).toBe(false);
    expect(consumeOauthState()).toBeNull();
  });

  it('hands over the state exactly once', () => {
    const s = createOauthState();
    expect(s).toMatch(/^[0-9a-f]{32}$/); // 后端要求 16–128 位
    expect(hasPendingOauthState()).toBe(true);
    expect(consumeOauthState()).toBe(s);
    expect(consumeOauthState()).toBeNull();
    expect(hasPendingOauthState()).toBe(false);
  });
});
