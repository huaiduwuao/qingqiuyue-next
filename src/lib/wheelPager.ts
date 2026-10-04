/**
 * 滚轮 / 触控板翻页:一次手势翻一条(推荐视频流)。
 *
 * Mac 触控板(客户端的 WKWebView、Safari)和鼠标滚轮的事件长得很不一样:
 *   - 鼠标:一格一个事件,deltaY 几十到一百多
 *   - 触控板:一次轻扫先是手指阶段一串 1–30px 的小 delta,松手后是持续一两秒、逐渐衰减的惯性事件,
 *     事件间隔 ~16ms,整段看起来是「同一个手势」
 *
 * 以前的判断是:|deltaY| < 8 的事件直接丢;两次事件间隔 > 200ms 才算新手势。于是在 Mac 上:
 *   - 轻轻划一下,手指阶段的 delta 全是个位数 → 一个都不算,完全翻不动
 *   - 上一下的惯性还没停(事件间隔一直 < 200ms)就再划 → 被当成同一手势吞掉
 * 现在:
 *   - 累积同一方向的 delta,够 THRESHOLD 才翻,小 delta 也算数
 *   - 翻页后进入惯性:惯性是单调衰减的,如果 delta 又明显变大(比翻页以来的最小值大一截),
 *     就是手指又划了一下 → 当新手势
 *   - 两次翻页至少隔 MIN_INTERVAL(让滑动动画放完)
 */
const THRESHOLD = 40;
const NEW_GESTURE_GAP = 180;
const MIN_INTERVAL = 380;

export function createWheelPager(onPage: (dir: 1 | -1) => void) {
  let lastAt = -Infinity;
  let lastNavAt = -Infinity;
  let accum = 0;
  let navigated = false;
  /** 翻页之后:手指阶段还在变大的峰值,过峰后(惯性衰减)的最小值 */
  let peak = 0;
  let minAfterPeak = Infinity;

  return (deltaY: number, deltaMode: number, now: number, pageHeight = 800) => {
    // deltaMode 1 = 行、2 = 页(Firefox 的鼠标滚轮等),换算成像素
    const d = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * pageHeight : deltaY;
    const abs = Math.abs(d);
    const gap = now - lastAt;
    lastAt = now;
    if (!abs) return;

    if (gap > NEW_GESTURE_GAP) {
      accum = 0;
      navigated = false;
    } else if (navigated) {
      if (minAfterPeak === Infinity && abs >= peak) peak = abs;
      else minAfterPeak = Math.min(minAfterPeak, abs);
      // 惯性衰减中 delta 又明显变大:手指又划了一下
      if (minAfterPeak !== Infinity && abs > minAfterPeak * 2 + 6 && abs > 12 && now - lastNavAt > MIN_INTERVAL) {
        navigated = false;
        accum = 0;
      }
    }
    if (navigated) return;

    if (accum && Math.sign(d) !== Math.sign(accum)) accum = 0;
    accum += d;
    if (Math.abs(accum) < THRESHOLD || now - lastNavAt < MIN_INTERVAL) return;

    navigated = true;
    lastNavAt = now;
    peak = abs;
    minAfterPeak = Infinity;
    const dir = accum > 0 ? 1 : -1;
    accum = 0;
    onPage(dir);
  };
}
