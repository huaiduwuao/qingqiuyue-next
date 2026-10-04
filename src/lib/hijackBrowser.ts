/**
 * 会接管网页 <video> 的安卓国产浏览器。
 *
 * 小米 / 搜狗 / UC / 夸克 / QQ 浏览器 / 百度 / vivo / OPPO / 华为 / 360 …… 这些浏览器发现网页在放视频,
 * 就把 <video> 换成自己的原生播放层:画在所有网页元素之上、触摸归它(推荐流上滑翻不动),
 * 取流也是它自己去取 —— 拿不到就报「视频不存在，刷新」,网页里的播放器连 error 事件都收不到。
 * x5-video-player-type 等同层属性只有 X5 内核认,其余各家没有可靠的关闭办法。
 *
 * 所以在这些浏览器里不创建 <video>,改成引导到清秋月 App 里看(2026-10-04 用户要求)。
 * 只管安卓:App 只有安卓包,iOS 上的浏览器都是 WKWebView,不接管。
 * 微信 / QQ 里的 X5 不算(UA 里也带 MQQBrowser):同层属性管用,而且它们拦自定义协议,拉不起 App。
 */

const HIJACK_UA =
  /MiuiBrowser|SogouMobileBrowser|SogouSearch|UCBrowser|UCWEB|Quark\/|MQQBrowser|baiduboxapp|baidubrowser|VivoBrowser|HeyTapBrowser|OppoBrowser|HuaweiBrowser|HonorBrowser|QihooBrowser|360 Aphone|Mb2345Browser|LieBaoFast/i;

const IN_APP_X5 = /MicroMessenger|\sQQ\/|WeCom|wxwork/i;

/** 当前是不是会接管视频的安卓国产浏览器(UA 判定;客户端 / 服务端渲染时返回 false)。 */
export function isHijackingBrowser(ua?: string): boolean {
  const s = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (!s || !/Android/i.test(s)) return false;
  if (typeof window !== 'undefined' && (window as unknown as { __TAURI__?: unknown }).__TAURI__) return false;
  return HIJACK_UA.test(s) && !IN_APP_X5.test(s);
}

/** 浏览器名字,给提示文案用。 */
export function hijackBrowserName(ua?: string): string {
  const s = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const names: [RegExp, string][] = [
    [/MiuiBrowser/i, '小米浏览器'],
    [/Sogou/i, '搜狗浏览器'],
    [/Quark\//i, '夸克浏览器'],
    [/UCBrowser|UCWEB/i, 'UC 浏览器'],
    [/MQQBrowser/i, 'QQ 浏览器'],
    [/baidu/i, '百度浏览器'],
    [/VivoBrowser/i, 'vivo 浏览器'],
    [/HeyTapBrowser|OppoBrowser/i, 'OPPO 浏览器'],
    [/HuaweiBrowser/i, '华为浏览器'],
    [/HonorBrowser/i, '荣耀浏览器'],
    [/QihooBrowser|360 Aphone/i, '360 浏览器'],
    [/2345/i, '2345 浏览器'],
    [/LieBao/i, '猎豹浏览器'],
  ];
  for (const [re, name] of names) if (re.test(s)) return name;
  return '当前浏览器';
}

/** 拉起 App 并打开站内路径的链接(DeepLinkBridge 接 qingqiuyue://open?path=…)。 */
export function appOpenUrl(path: string): string {
  return `qingqiuyue://open?path=${encodeURIComponent(path)}`;
}
