import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeOauthState, createOauthState, hasPendingOauthState } from './oauthState';

describe('oauth state', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

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

  it('web 只存 sessionStorage', () => {
    createOauthState();
    expect(sessionStorage.getItem('wx_oauth_state')).not.toBeNull();
    expect(localStorage.getItem('wx_oauth_state')).toBeNull();
  });

  describe('客户端(Tauri)', () => {
    beforeEach(() => {
      (window as unknown as { __TAURI__?: unknown }).__TAURI__ = {};
    });
    afterEach(() => {
      delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
      vi.useRealTimers();
    });

    it('存 localStorage,App 重开后仍能用一次', () => {
      const s = createOauthState();
      expect(localStorage.getItem('wx_oauth_state')).not.toBeNull();
      expect(sessionStorage.getItem('wx_oauth_state')).toBeNull();
      sessionStorage.clear(); // 模拟进程重启:sessionStorage 没了
      expect(hasPendingOauthState()).toBe(true);
      expect(consumeOauthState()).toBe(s);
      expect(consumeOauthState()).toBeNull();
      expect(localStorage.getItem('wx_oauth_state')).toBeNull();
    });

    it('过期后不认', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      createOauthState();
      vi.setSystemTime(new Date('2026-01-01T00:11:00Z'));
      expect(hasPendingOauthState()).toBe(false);
      expect(consumeOauthState()).toBeNull();
      expect(localStorage.getItem('wx_oauth_state')).toBeNull();
    });
  });
});
