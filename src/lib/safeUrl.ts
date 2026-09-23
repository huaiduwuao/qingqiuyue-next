// 打开「不是自己写死的」地址(爬来的原文链接、消息里的 link、模型给的网址)的唯一出入口。
//
// - javascript: / data: / file: 之类一律不开:存进库里的一条 javascript: 链接会在本站 origin 上执行。
// - 新标签一律 noopener,noreferrer:否则外站拿 window.opener 能把我们这个标签页换成钓鱼登录页。

function currentOrigin(): string {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
}

/** 只放行 http(s);相对地址按当前站解析。返回规范化后的绝对地址,不安全返回 null。 */
export function safeHttpUrl(raw: string | null | undefined, base: string = currentOrigin()): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  // 控制字符会被浏览器吞掉,java\tscript: 之类靠它绕过前缀判断
  if (/[\x00-\x1f\x7f]/.test(s)) return null;
  try {
    const u = new URL(s, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

/** 新标签打开外链。不安全的地址直接忽略,返回是否真的打开了。 */
export function openExternal(raw: string | null | undefined): boolean {
  const url = safeHttpUrl(raw);
  if (!url || typeof window === 'undefined') return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * 站内路径(给 router.push 用):/ 开头、不含控制字符和反斜杠,按浏览器规则解析后仍在本站。
 * Next 的 router.push 遇到 javascript: 会直接 location.assign,所以服务端给的地址不能直接塞进去。
 */
export function safeSitePath(raw: string | null | undefined): string | null {
  const s = raw ?? '';
  if (!s || /[\x00-\x1f\x7f\\]/.test(s)) return null;
  if (!s.startsWith('/') || s.startsWith('//')) return null;
  try {
    const base = 'http://same-origin.invalid';
    if (new URL(s, base).origin !== base) return null;
  } catch {
    return null;
  }
  return s;
}
