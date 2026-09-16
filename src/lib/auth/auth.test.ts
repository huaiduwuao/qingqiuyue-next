import { describe, expect, it } from 'vitest';
import { loginHref, safeRedirectPath } from './redirect';
import { isProtectedPath, isPublicPath } from './routes';
import {
  mobileError,
  passwordError,
  smsCodeError,
  usernameError,
} from '@/app/(auth)/user/login/_components/validation';

describe('safeRedirectPath', () => {
  it('accepts in-site paths with query', () => {
    expect(safeRedirectPath('/detail/novel-detail?id=1')).toBe('/detail/novel-detail?id=1');
    expect(safeRedirectPath(encodeURIComponent('/search?q=a b'))).toBe('/search?q=a b');
  });

  it('rejects open redirects and the login page itself', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/user/login?x=1', '', null, undefined]) {
      expect(safeRedirectPath(bad)).toBeNull();
    }
  });

  it('builds a login href that round-trips', () => {
    const href = loginHref('/share/module-detail?id=9');
    const back = new URL(href, 'http://x').searchParams.get('redirect');
    expect(safeRedirectPath(back)).toBe('/share/module-detail?id=9');
    expect(loginHref('https://evil.com')).toBe('/user/login');
  });
});

describe('route policy', () => {
  it('keeps content pages public so logged-out visitors are not bounced', () => {
    for (const p of ['/', '/home/recommend', '/detail/video-detail', '/search', '/share/qa', '/user/login', '/account/wallet', '/u']) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it('protects back office and creation tools', () => {
    for (const p of ['/system/user', '/video-gen', '/avatar-pipeline', '/gs-viewer']) {
      expect(isProtectedPath(p)).toBe(true);
    }
  });

  it('matches prefixes on segment boundaries', () => {
    expect(isPublicPath('/homepage-admin')).toBe(false);
  });
});

describe('login form validation (mirrors backend rules)', () => {
  it('validates usernames', () => {
    expect(usernameError('alice_01')).toBeNull();
    expect(usernameError('1alice')).not.toBeNull();
    expect(usernameError('abc')).not.toBeNull();
  });

  it('validates passwords and confirmation', () => {
    expect(passwordError('12345678')).toBeNull();
    expect(passwordError('1234567')).not.toBeNull();
    expect(passwordError('12345678', '12345679')).toBe('两次输入的密码不一致');
  });

  it('validates mobile numbers and sms codes', () => {
    expect(mobileError('13800138000')).toBeNull();
    expect(mobileError('2380013800')).not.toBeNull();
    expect(smsCodeError('123456')).toBeNull();
    expect(smsCodeError('12345')).not.toBeNull();
  });
});
