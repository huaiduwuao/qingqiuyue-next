import { describe, expect, it } from 'vitest';
import { appOpenUrl, hijackBrowserName, isHijackingBrowser } from './hijackBrowser';

const MIUI = 'Mozilla/5.0 (Linux; U; Android 14; zh-cn; 23013RK75C Build/UKQ1.230804.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 XiaoMi/MiuiBrowser/18.6.70920';
const SOGOU = 'Mozilla/5.0 (Linux; Android 12; V2219A Build/SP1A.210812.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36 SogouMobileBrowser/5.38.6';
const QUARK = 'Mozilla/5.0 (Linux; U; Android 13; zh-CN; PGT-AN10 Build/HONORPGT-AN10) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 Quark/6.4.5.420 Mobile Safari/537.36';
const WECHAT = 'Mozilla/5.0 (Linux; Android 13; PGT-AN10 Build/HONORPGT-AN10; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/107.0.5304.141 Mobile Safari/537.36 XWEB/5197 MMWEBSDK/20230805 MMWEBID/2585 MicroMessenger/8.0.42.2460(0x28002A35) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64 MQQBrowser/6.2';
const CHROME = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const IOS_SOGOU = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SogouMobileBrowser/5.38.6';

describe('isHijackingBrowser', () => {
  it('安卓国产浏览器', () => {
    expect(isHijackingBrowser(MIUI)).toBe(true);
    expect(isHijackingBrowser(SOGOU)).toBe(true);
    expect(isHijackingBrowser(QUARK)).toBe(true);
  });
  it('微信 X5、普通 Chrome、iOS 不算', () => {
    expect(isHijackingBrowser(WECHAT)).toBe(false);
    expect(isHijackingBrowser(CHROME)).toBe(false);
    expect(isHijackingBrowser(IOS_SOGOU)).toBe(false);
  });
  it('名字', () => {
    expect(hijackBrowserName(MIUI)).toBe('小米浏览器');
    expect(hijackBrowserName(SOGOU)).toBe('搜狗浏览器');
  });
  it('深链只带编码后的站内路径', () => {
    expect(appOpenUrl('/detail/film-detail?id=1')).toBe('qingqiuyue://open?path=%2Fdetail%2Ffilm-detail%3Fid%3D1');
  });
});
