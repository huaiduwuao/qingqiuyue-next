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
    for (const bad of [
      'https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/user/login?x=1', '', null, undefined,
      // tab / 换行 / 反斜杠绕过:浏览器会去掉控制字符、把 \\ 当 /
      '/%09/evil.com', '/\t/evil.com', '/%0a/evil.com', '/%5C/evil.com', '%2F%2Fevil.com', '/x\\y',
    ]) {
      expect(safeRedirectPath(bad)).toBeNull();
    }
  });

  it('查询串里的反斜杠 / 换行不影响回跳(只查路径部分)', () => {
    expect(safeRedirectPath('/search?q=a%5Cb')).toBe('/search?q=a\\b');
    expect(safeRedirectPath('/search?q=a%0Ab')).toBe('/search?q=a\nb');
    expect(safeRedirectPath('/community/post?text=x#a\\b')).toBe('/community/post?text=x#a\\b');
    // loginHref → ?redirect= → safeRedirectPath 往返
    const href = loginHref('/search?q=a%5Cb');
    const back = new URL(href, 'http://x').searchParams.get('redirect');
    expect(safeRedirectPath(back)).toBe('/search?q=a\\b');
    // 路径部分照样拒
    for (const bad of ['/%5C/evil.com?q=1', '/%09/evil.com?q=a%5Cb', '?//evil.com', '#//evil.com']) {
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
    // 新增公开频道页时必须同时加进 PUBLIC_PREFIXES,否则匿名访问会被踢去
    // 登录页 —— /poetry 上线当天就这样被挡了一次。
    for (const p of ['/', '/home/recommend', '/detail/video-detail', '/search', '/share/qa', '/user/login', '/account/wallet', '/u', '/poetry', '/poetry/poet', '/my-list/shared', '/welcome']) {
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
