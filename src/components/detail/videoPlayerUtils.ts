/**
 * VideoPlayer 用到的常量与纯函数(从 VideoPlayer.tsx 拆出,行为不变)。
 */

/** 同一段播放里,直链失效后最多自动重新解析几次(防止解析出来的地址本身就坏,来回打转) */
export const MAX_RECOVER_ATTEMPTS = 2;
/**
 * 片源本身是好的(后端从机房能直连),只是看的人这边到不了。采集站 CDN(非凡 / 暴风等)
 * 对海外 IP、走海外代理的访问一律 403/404 —— 这不是内容故障,不进举报队列。
 */
export const NETWORK_BLOCKED_NOTICE = '这个片源只对中国大陆网络开放：当前是海外网络或开着 VPN / 代理，关掉后再试';
/**
 * 反过来:片源 CDN 拒绝中国大陆 IP(欧乐影院等海外资源站),后端从国内机房测也是 403。
 * 国内用户要开 VPN(海外节点)才能看;后端体检会把这类内容换到国内能放的片源,换不到才会看到这句。
 */
export const OVERSEAS_ONLY_NOTICE = '这个片源只对海外网络开放：它拒绝中国大陆 IP，需要开 VPN（海外节点）才能观看，国内片源正在补';
/** 开播前挂在画面上的地区提示(StreamInfo.region),播放失败时再给上面两句完整原因 */
export const REGION_HINT: Record<string, string> = {
  mainland: '仅限国内网络观看 · 开着 VPN / 代理会放不了',
  overseas: '海外片源 · 国内需开 VPN 才能观看',
};
/** 看的人这边的网络问题,不是片源坏了:原样显示,不说「已记录」 */
export const isNetworkNotice = (msg: string | null) => msg === NETWORK_BLOCKED_NOTICE || msg === OVERSEAS_ONLY_NOTICE;
/** 恢复后正常播放超过这么久,重置重试计数(长视频两小时后签名再次过期时还能再救) */
export const RECOVER_RESET_MS = 30_000;
/** 签名到期前多久主动换一条新直链 */
export const PREEMPT_EXPIRY_MS = 60_000;

/** 生命周期 effect 里挂到 <video> 上的事件 */
export const VIDEO_EVENTS = ['timeupdate', 'loadedmetadata', 'resize', 'canplay', 'playing', 'play', 'pause', 'ended', 'error', 'volumechange', 'enterpictureinpicture', 'leavepictureinpicture', 'webkitpresentationmodechanged'];

/**
 * 焦点在输入框 / 可编辑区 / 下拉框里时按键归它们(评论框里打空格不能暂停视频)。
 * 滑块(进度条、音量条的 range input)不算:方向键它们自己处理(MUI 会 preventDefault,
 * 下面据此跳过),空格 / M / F 照样归播放器。
 */
export function typingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el?.tagName) return false;
  if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'range') return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

/** 音量(0–100)记在本机:推荐流每条视频都是新的播放器,不记的话每划一条都回到满音量 */
const VOLUME_KEY = 'qq-video-volume';
export function readVolume(): number {
  try {
    const n = Number(localStorage.getItem(VOLUME_KEY));
    if (localStorage.getItem(VOLUME_KEY) !== null && Number.isFinite(n)) return Math.max(0, Math.min(100, n));
  } catch {
    /* 隐私模式 */
  }
  return 100;
}
export function saveVolume(n: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.round(n)));
  } catch {
    /* 隐私模式 */
  }
}

/** 页内全屏(安卓客户端 / 不支持元素全屏的浏览器)时,原生壳横屏 + 藏系统栏(MainActivity 的 QQScreen) */
export function nativeScreen(): { setFullscreen?: (on: boolean, landscape: boolean) => void } | undefined {
  return (window as unknown as { QQScreen?: { setFullscreen?: (on: boolean, landscape: boolean) => void } }).QQScreen;
}

/**
 * mp4 直链走原生播放(抖音等),m3u8 走 hls.js。
 * ⚠️ 必须用原始 url 判断,不能用 playUrl——B 站等防盗链域名会被 toPlayableUrl()
 * 包成 /api/proxy?url=encodeURIComponent(原始url),encodeURIComponent 会把
 * ".mp4?e=..." 里的 "?" 转义成 "%3F",导致 /\.mp4(\?|$)/ 永远匹配不上 playUrl。
 * 结果是所有经代理的 B 站 mp4 直链都被误判成"不是 mp4",走进 hls.js 分支——
 * 拿一个真正的 mp4 二进制文件当 m3u8 清单解析,播放器卡在 readyState=0 不动,
 * 界面上却显示"正在播放"(进度条是独立于视频本身的模拟状态)。
 */
export function isMp4Stream(url: string, format?: string) {
  return format === 'mp4' || /\.mp4(\?|$)/i.test(url) || url.includes('mime_type=video_mp4') || url.includes('mime_type=video');
}

/** hls.js 致命错误 → 给用户 / 恢复流程看的原因 */
export function hlsFatalMessage(data: { details?: string; context?: { url?: string } }) {
  return data.details === 'manifestLoadError'
    ? '片源清单拉取失败'
    : data.details === 'manifestParsingError'
    ? '清单解析失败'
    : data.details === 'levelLoadError'
    ? '清晰度加载失败'
    : data.details === 'fragmentLoadError'
    ? `分片加载失败: ${data.context?.url || ''}`
    : '播放失败，请尝试切换清晰度';
}

/**
 * 播放进度的小订阅源。timeupdate 每秒 ~4 次,以前每次 setCurrentTime 都让整个播放器(连同
 * 几百行控制条 JSX)重渲染;现在只有订阅它的进度条 / 时间文字两个小组件跟着刷新。
 * 播放器本身的逻辑(断点续播、快进快退、小窗交接)都直接读 <video>.currentTime,不依赖这里。
 */
export type TimeStore = { get: () => number; set: (t: number) => void; subscribe: (fn: () => void) => () => void };
export function createTimeStore(): TimeStore {
  let t = 0;
  const subs = new Set<() => void>();
  return {
    get: () => t,
    set: (n) => {
      if (n === t) return;
      t = n;
      subs.forEach((f) => f());
    },
    subscribe: (fn) => {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
  };
}

export type ScrubHandler = (e: Event, v: number | number[]) => void;
export type ScrubEndHandler = (e: unknown, v: number | number[]) => void;
